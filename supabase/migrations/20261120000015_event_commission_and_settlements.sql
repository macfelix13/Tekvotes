-- TekVotes Phase 13: Per-event commission percentage + Organiser Payout Requests & Super Admin Settlement Processing.

-- 1. Add per-event commission_bps (default 1000 bps = 10.00%)
alter table public.events
  add column if not exists commission_bps integer not null default 1000
  check (commission_bps between 0 and 10000);

-- 2. Update app_create_voting_order to snapshot event.commission_bps into voting_orders
create or replace function public.app_create_voting_order(
  p_voter_id uuid,
  p_category_entry_id uuid,
  p_pricing_mode text,
  p_package_id uuid default null,
  p_custom_base_amount_minor bigint default null,
  p_surcharge_minor bigint default 0,
  p_order_reference text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ce record;
  v_votes integer;
  v_base_amount bigint;
  v_unit_price bigint;
  v_ref text;
  v_order_id uuid;
begin
  select
    ce.id as ce_id, ce.category_id, ce.event_id, ce.organization_id, ce.status as ce_status,
    c.voting_enabled, c.unit_price_minor, c.currency as cat_currency, c.min_votes, c.max_votes,
    e.approval_status, e.voting_status, e.voting_opens_at, e.voting_closes_at, e.commission_bps
  into v_ce
  from public.category_entries ce
  join public.event_categories c on c.id = ce.category_id
  join public.events e on e.id = ce.event_id
  where ce.id = p_category_entry_id;

  if not found then raise exception 'CATEGORY_ENTRY_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_ce.ce_status <> 'active' then raise exception 'ENTRY_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if not v_ce.voting_enabled then raise exception 'VOTING_DISABLED_IN_CATEGORY' using errcode = 'P0001'; end if;
  if v_ce.approval_status <> 'approved' then raise exception 'EVENT_NOT_APPROVED_FOR_VOTING' using errcode = 'P0001'; end if;
  if v_ce.voting_status <> 'active' then raise exception 'EVENT_VOTING_NOT_ACTIVE' using errcode = 'P0001'; end if;

  if v_ce.voting_opens_at is not null and now() < v_ce.voting_opens_at then
    raise exception 'VOTING_NOT_YET_OPEN' using errcode = 'P0001';
  end if;
  if v_ce.voting_closes_at is not null and now() >= v_ce.voting_closes_at then
    raise exception 'VOTING_ALREADY_CLOSED' using errcode = 'P0001';
  end if;

  v_unit_price := v_ce.unit_price_minor;

  if p_pricing_mode = 'package' then
    if p_package_id is null then raise exception 'PACKAGE_ID_REQUIRED' using errcode = 'P0001'; end if;
    select votes, price_minor into v_votes, v_base_amount
    from public.vote_packages
    where id = p_package_id and category_id = v_ce.category_id and active;

    if not found then raise exception 'PACKAGE_NOT_FOUND_OR_INACTIVE' using errcode = 'P0002'; end if;
  elsif p_pricing_mode = 'custom' then
    if p_custom_base_amount_minor is null or p_custom_base_amount_minor <= 0 then
      raise exception 'INVALID_CUSTOM_AMOUNT' using errcode = 'P0001';
    end if;

    if (p_custom_base_amount_minor % v_unit_price) <> 0 then
      raise exception 'NOT_WHOLE_VOTES: Custom amount must produce an exact whole number of votes' using errcode = 'P0001';
    end if;

    v_votes := p_custom_base_amount_minor / v_unit_price;
    v_base_amount := p_custom_base_amount_minor;

    if v_ce.min_votes is not null and v_votes < v_ce.min_votes then
      raise exception 'VOTES_BELOW_MINIMUM: Minimum is % votes', v_ce.min_votes using errcode = 'P0001';
    end if;
    if v_ce.max_votes is not null and v_votes > v_ce.max_votes then
      raise exception 'VOTES_ABOVE_MAXIMUM: Maximum is % votes', v_ce.max_votes using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_PRICING_MODE' using errcode = 'P0001';
  end if;

  v_ref := coalesce(p_order_reference, 'TV-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8)));

  insert into public.voting_orders (
    reference, organization_id, event_id, category_id, category_entry_id, voter_id,
    pricing_mode, snapshot_package_id, snapshot_unit_price_minor, snapshot_votes,
    snapshot_base_amount_minor, snapshot_surcharge_minor, snapshot_amount_minor,
    snapshot_currency, commission_bps, expires_at
  ) values (
    v_ref, v_ce.organization_id, v_ce.event_id, v_ce.category_id, v_ce.ce_id, p_voter_id,
    p_pricing_mode, p_package_id, v_unit_price, v_votes,
    v_base_amount, coalesce(p_surcharge_minor, 0), v_base_amount + coalesce(p_surcharge_minor, 0),
    v_ce.cat_currency, coalesce(v_ce.commission_bps, 1000), now() + interval '15 minutes'
  )
  returning id into v_order_id;

  return v_order_id;
end $$;

-- 3. Organiser Payout Request RPC
create or replace function public.app_request_settlement(
  p_org_id uuid,
  p_actor uuid,
  p_amount_minor bigint,
  p_dest_type text,      -- 'mobile_money' or 'bank'
  p_provider text,       -- e.g. 'MTN MoMo', 'Telecel Cash', 'GCB Bank'
  p_account_number text,
  p_account_name text
) returns uuid language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_currency char(3);
  v_avail bigint;
  v_reserved bigint;
  v_remaining bigint;
  v_dest_id uuid;
  v_req_id uuid;
  v_masked text;
  v_clean_acct text;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  if p_dest_type not in ('mobile_money', 'bank') then
    raise exception 'INVALID_DESTINATION_TYPE' using errcode = 'P0001';
  end if;

  select default_currency into v_currency from public.organizations where id = p_org_id;
  if not found then
    raise exception 'ORG_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Lock org row to serialize concurrent withdrawal requests
  perform 1 from public.organizations where id = p_org_id for update;

  select coalesce(available_to_settle_minor, 0) into v_avail
  from public.v_org_funds where organization_id = p_org_id;

  select coalesce(sum(amount_minor), 0) into v_reserved
  from fin.settlement_requests
  where organization_id = p_org_id
    and status in ('requested', 'under_finance_review', 'finance_approved', 'super_admin_approved', 'payout_initiated', 'payout_processing');

  v_remaining := coalesce(v_avail, 0) - coalesce(v_reserved, 0);
  if p_amount_minor > v_remaining then
    raise exception 'INSUFFICIENT_AVAILABLE_BALANCE: Available % minor, requested % minor', v_remaining, p_amount_minor using errcode = 'P0001';
  end if;

  v_clean_acct := regexp_replace(coalesce(p_account_number, ''), '\s+', '', 'g');
  if char_length(v_clean_acct) < 6 then
    raise exception 'INVALID_ACCOUNT_NUMBER' using errcode = 'P0001';
  end if;

  v_masked := p_provider || ' · ••••' || right(v_clean_acct, 4);

  insert into fin.settlement_destinations (
    organization_id, type, provider_recipient_code, masked_account, account_name
  ) values (
    p_org_id, p_dest_type, p_provider || ':' || v_clean_acct, v_masked, trim(p_account_name)
  ) returning id into v_dest_id;

  insert into fin.settlement_requests (
    organization_id, requested_by, amount_minor, currency, destination_id, status
  ) values (
    p_org_id, p_actor, p_amount_minor, v_currency, v_dest_id, 'requested'
  ) returning id into v_req_id;

  perform private.write_audit(
    p_actor, 'settlement.request', 'settlement_requests', v_req_id::text, p_org_id, null,
    null, jsonb_build_object('amount_minor', p_amount_minor, 'destination', v_masked)
  );

  return v_req_id;
end $$;

-- 4. Super Admin Payout Processing RPC (approve & mark paid, or reject)
create or replace function public.app_process_settlement_payout(
  p_request_id uuid,
  p_actor uuid,
  p_action text, -- 'complete' or 'reject'
  p_transfer_ref text default null,
  p_comment text default null
) returns uuid language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_req fin.settlement_requests%rowtype;
  v_org_avail_acc uuid;
  v_clearing_acc uuid;
  v_journal_id uuid;
  v_settlement_id uuid;
  v_ref text;
begin
  if not private.user_is_platform(p_actor, 'super_admin') then
    raise exception 'FORBIDDEN_SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_req from fin.settlement_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_req.status not in ('requested', 'under_finance_review', 'finance_approved', 'super_admin_approved') then
    raise exception 'INVALID_REQUEST_STATUS: %', v_req.status using errcode = 'P0001';
  end if;

  if p_action = 'reject' then
    update fin.settlement_requests set status = 'rejected', updated_at = now() where id = p_request_id;
    insert into fin.settlement_approvals (request_id, stage, approver_id, decision, comment)
    values (p_request_id, 'super_admin', p_actor, 'rejected', coalesce(nullif(trim(p_comment), ''), 'Rejected by Super Admin'))
    on conflict (request_id, stage) do update set decision = 'rejected', comment = excluded.comment;
    return null;
  end if;

  if p_action <> 'complete' then
    raise exception 'INVALID_ACTION' using errcode = 'P0001';
  end if;

  v_ref := coalesce(nullif(trim(p_transfer_ref), ''), 'PAYOUT-' || upper(substr(p_request_id::text, 1, 8)));
  v_org_avail_acc := fin.get_or_create_account('L-ORG-AVAIL:' || v_req.organization_id::text, 'liability', 'organization', 'Organizer Available to Settle', v_req.organization_id);
  v_clearing_acc  := fin.get_or_create_account('A-PROV-CLEAR', 'asset', 'platform', 'Paystack Clearing Account');

  insert into fin.ledger_journals (
    journal_type, source_type, source_id, currency, description, idempotency_key, posted_by
  ) values (
    'settlement_payout', 'settlement_requests', p_request_id, v_req.currency,
    'Organizer settlement payout ' || v_ref, 'payout:' || p_request_id::text, p_actor
  ) returning id into v_journal_id;

  -- Dr L-ORG-AVAIL (decrement available organizer liability)
  insert into fin.ledger_entries (journal_id, account_id, organization_id, direction, amount_minor, currency)
  values (v_journal_id, v_org_avail_acc, v_req.organization_id, 'debit', v_req.amount_minor, v_req.currency);

  -- Cr A-PROV-CLEAR (cash/clearing outflow)
  insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
  values (v_journal_id, v_clearing_acc, 'credit', v_req.amount_minor, v_req.currency);

  insert into fin.settlements (
    request_id, organization_id, provider_transfer_ref, amount_minor, currency, status, completed_at, journal_id
  ) values (
    p_request_id, v_req.organization_id, v_ref, v_req.amount_minor, v_req.currency, 'completed', now(), v_journal_id
  ) returning id into v_settlement_id;

  update fin.settlement_requests set status = 'completed', updated_at = now() where id = p_request_id;

  insert into fin.settlement_approvals (request_id, stage, approver_id, decision, comment)
  values (p_request_id, 'super_admin', p_actor, 'approved', coalesce(nullif(trim(p_comment), ''), 'Paid ref: ' || v_ref))
  on conflict (request_id, stage) do update set decision = 'approved', comment = excluded.comment;

  perform private.write_audit(
    p_actor, 'settlement.complete', 'settlement_requests', p_request_id::text, v_req.organization_id, null,
    null, jsonb_build_object('settlement_id', v_settlement_id, 'transfer_ref', v_ref, 'amount_minor', v_req.amount_minor)
  );

  return v_settlement_id;
end $$;

-- 5. Lock down execution
revoke all on function
  public.app_request_settlement(uuid, uuid, bigint, text, text, text, text),
  public.app_process_settlement_payout(uuid, uuid, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.app_request_settlement(uuid, uuid, bigint, text, text, text, text),
  public.app_process_settlement_payout(uuid, uuid, text, text, text)
to service_role;
