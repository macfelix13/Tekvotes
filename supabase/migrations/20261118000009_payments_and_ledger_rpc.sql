-- TekVotes Phase 5: RPCs for Payment Verification, Ledger Postings, and Post-Close Settlements.
-- Implements TAS v1.0 Part 2 sections 10, 11, 12 and the confirmed funds-holding rules.

-- ---------------------------------------------------------------- account provisioning
create or replace function fin.get_or_create_account(
  p_code text, p_type fin.account_type, p_owner_kind text, p_name text,
  p_org_id uuid default null, p_curr char(3) default 'GHS'
) returns uuid language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_id uuid;
begin
  select id into v_id from fin.financial_accounts where code = p_code;
  if not found then
    insert into fin.financial_accounts (code, type, owner_kind, name, organization_id, currency)
    values (p_code, p_type, p_owner_kind, p_name, p_org_id, p_curr)
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------- credit payment & balanced journal post
create or replace function public.app_process_payment_success(
  p_order_id uuid,
  p_provider_txn_id text,
  p_provider_fee_minor bigint,
  p_channel text default 'mobile_money',
  p_raw_verification jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_order public.voting_orders%rowtype;
  v_txn_id uuid;
  v_journal_id uuid;
  v_rate_bps integer;
  v_commission bigint;
  v_org_net bigint;
  v_clearing_acc uuid;
  v_fees_acc uuid;
  v_org_pend_acc uuid;
  v_comm_acc uuid;
  v_recovery_acc uuid;
  v_ok boolean;
begin
  -- 1. Lock and retrieve order
  select * into v_order from public.voting_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_order.status = 'credited' then
    return true; -- Already processed idempotently
  end if;

  -- 2. Record Payment Transaction (idempotent ON CONFLICT)
  insert into fin.payment_transactions (
    order_id, provider, provider_txn_id, provider_reference,
    amount_minor, currency, provider_fee_minor, paid_at, channel, raw_verification
  ) values (
    v_order.id, 'paystack', p_provider_txn_id, v_order.reference,
    v_order.snapshot_amount_minor, v_order.snapshot_currency, p_provider_fee_minor, now(), p_channel, p_raw_verification
  )
  on conflict (provider, provider_txn_id) do nothing
  returning id into v_txn_id;

  if v_txn_id is null then
    select id into v_txn_id from fin.payment_transactions where provider = 'paystack' and provider_txn_id = p_provider_txn_id;
  end if;

  -- 3. Calculate Commission on Base Vote Amount (OD-01, Half-Up rounding)
  v_rate_bps := v_order.commission_bps;
  v_commission := ((v_order.snapshot_base_amount_minor * v_rate_bps) + 5000) / 10000;
  v_org_net := v_order.snapshot_base_amount_minor - v_commission;

  -- 4. Execute atomic vote credit (with 180s grace window logic)
  v_ok := public.app_credit_paid_order(v_order.id, 'credit:' || v_order.id::text);

  -- 5. Provision Financial Accounts
  v_clearing_acc := fin.get_or_create_account('A-PROV-CLEAR', 'asset', 'platform', 'Paystack Clearing Account');
  v_fees_acc     := fin.get_or_create_account('X-PROV-FEES', 'expense', 'platform', 'Payment Processing Fees');
  v_comm_acc     := fin.get_or_create_account('R-COMMISSION', 'revenue', 'platform', 'Platform Commission Revenue');
  v_recovery_acc := fin.get_or_create_account('R-FEE-RECOVERY', 'revenue', 'platform', 'Voter Surcharge Fee Recovery');

  if v_ok then
    -- Successful vote: Organizer earns pending balance
    v_org_pend_acc := fin.get_or_create_account(
      'L-ORG-PEND:' || v_order.organization_id::text, 'liability', 'organization',
      'Organizer Pending Share', v_order.organization_id
    );

    insert into fin.ledger_journals (
      journal_type, source_type, source_id, currency, description, idempotency_key
    ) values (
      'vote_payment', 'voting_orders', v_order.id, v_order.snapshot_currency,
      'Vote payment for ' || v_order.reference, 'journal:order:' || v_order.id::text
    )
    returning id into v_journal_id;

    -- Balanced Journal Entry Lines
    -- Dr A-PROV-CLEAR (Gross - Fee)
    insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
    values (v_journal_id, v_clearing_acc, 'debit', v_order.snapshot_amount_minor - p_provider_fee_minor, v_order.snapshot_currency);

    -- Dr X-PROV-FEES (Actual provider fee)
    insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
    values (v_journal_id, v_fees_acc, 'debit', p_provider_fee_minor, v_order.snapshot_currency);

    -- Cr L-ORG-PEND (Organizer Net Share with Event & Org Tracking)
    insert into fin.ledger_entries (journal_id, account_id, organization_id, event_id, direction, amount_minor, currency)
    values (v_journal_id, v_org_pend_acc, v_order.organization_id, v_order.event_id, 'credit', v_org_net, v_order.snapshot_currency);

    -- Cr R-COMMISSION (Platform Commission)
    insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
    values (v_journal_id, v_comm_acc, 'credit', v_commission, v_order.snapshot_currency);

    -- Cr R-FEE-RECOVERY (Surcharge collected from voter)
    if v_order.snapshot_surcharge_minor > 0 then
      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_recovery_acc, 'credit', v_order.snapshot_surcharge_minor, v_order.snapshot_currency);
    end if;

    -- Record Commission Entry
    insert into fin.commission_entries (
      order_id, payment_txn_id, rate_bps, basis, rounding,
      gross_charged_minor, base_vote_minor, voter_surcharge_minor, provider_fee_minor,
      commission_minor, organizer_net_minor, journal_id
    ) values (
      v_order.id, v_txn_id, v_rate_bps, 'base_amount', 'half_up',
      v_order.snapshot_amount_minor, v_order.snapshot_base_amount_minor, v_order.snapshot_surcharge_minor,
      p_provider_fee_minor, v_commission, v_org_net, v_journal_id
    );
  else
    -- Gate failed (e.g., event paused/cancelled): Post to Suspense Unallocated
    declare
      v_suspense_acc uuid;
    begin
      v_suspense_acc := fin.get_or_create_account('L-SUSPENSE-UNALLOC', 'liability', 'platform', 'Suspense Unallocated Payments');

      insert into fin.ledger_journals (
        journal_type, source_type, source_id, currency, description, idempotency_key
      ) values (
        'vote_payment_unallocated', 'voting_orders', v_order.id, v_order.snapshot_currency,
        'Paid uncredited vote order ' || v_order.reference, 'journal:order:' || v_order.id::text
      )
      returning id into v_journal_id;

      -- Dr A-PROV-CLEAR (Gross - Fee)
      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_clearing_acc, 'debit', v_order.snapshot_amount_minor - p_provider_fee_minor, v_order.snapshot_currency);

      -- Dr X-PROV-FEES (Provider Fee)
      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_fees_acc, 'debit', p_provider_fee_minor, v_order.snapshot_currency);

      -- Cr L-SUSPENSE-UNALLOC (Full Gross Amount)
      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_suspense_acc, 'credit', v_order.snapshot_amount_minor, v_order.snapshot_currency);
    end;
  end if;

  return v_ok;
end $$;

-- ---------------------------------------------------------------- post-event fund release RPC
-- Releases pending organizer funds to available balance once the event voting is closed
create or replace function public.app_release_closed_event_funds(
  p_event_id uuid,
  p_actor uuid
) returns bigint language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_event public.events%rowtype;
  v_total_pending bigint;
  v_org_pend_acc uuid;
  v_org_avail_acc uuid;
  v_journal_id uuid;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Funds are only released after the voting event ends (Owner Ruling)
  if v_event.voting_status <> 'closed' then
    raise exception 'EVENT_NOT_CLOSED: Organizer transfers are executed only after event voting has ended' using errcode = 'P0001';
  end if;

  select coalesce(sum(case when direction = 'credit' then amount_minor else -amount_minor end), 0)
    into v_total_pending
    from fin.ledger_entries le
    join fin.financial_accounts a on a.id = le.account_id
   where a.code = 'L-ORG-PEND:' || v_event.organization_id::text
     and le.event_id = p_event_id;

  if v_total_pending <= 0 then
    return 0; -- No pending funds to release
  end if;

  v_org_pend_acc  := fin.get_or_create_account('L-ORG-PEND:' || v_event.organization_id::text, 'liability', 'organization', 'Organizer Pending', v_event.organization_id);
  v_org_avail_acc := fin.get_or_create_account('L-ORG-AVAIL:' || v_event.organization_id::text, 'liability', 'organization', 'Organizer Available to Settle', v_event.organization_id);

  insert into fin.ledger_journals (
    journal_type, source_type, source_id, currency, description, idempotency_key, posted_by
  ) values (
    'fund_release', 'events', p_event_id, v_event.currency,
    'Post-close fund release for event ' || v_event.name, 'release:event:' || p_event_id::text, p_actor
  )
  returning id into v_journal_id;

  -- Dr L-ORG-PEND (Decrement pending)
  insert into fin.ledger_entries (journal_id, account_id, organization_id, event_id, direction, amount_minor, currency)
  values (v_journal_id, v_org_pend_acc, v_event.organization_id, p_event_id, 'debit', v_total_pending, v_event.currency);

  -- Cr L-ORG-AVAIL (Increment available to settle)
  insert into fin.ledger_entries (journal_id, account_id, organization_id, event_id, direction, amount_minor, currency)
  values (v_journal_id, v_org_avail_acc, v_event.organization_id, p_event_id, 'credit', v_total_pending, v_event.currency);

  perform private.write_audit(p_actor, 'event.funds.release', 'events', p_event_id::text, v_event.organization_id, p_event_id,
    null, jsonb_build_object('released_minor', v_total_pending));

  return v_total_pending;
end $$;

-- ---------------------------------------------------------------- settlement dual-approval RPC
create or replace function public.app_review_settlement_request(
  p_request_id uuid,
  p_reviewer uuid,
  p_stage text, -- 'finance' or 'super_admin'
  p_decision text, -- 'approved' or 'rejected'
  p_comment text default null
) returns void language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_req fin.settlement_requests%rowtype;
  v_other_approver uuid;
begin
  select * into v_req from fin.settlement_requests where id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;

  -- 1. Separation of duties: Requester cannot approve their own settlement
  if p_reviewer = v_req.requested_by then
    raise exception 'SEPARATION_OF_DUTIES: Requester cannot approve own settlement' using errcode = '42501';
  end if;

  -- 2. Stage role checks
  if p_stage = 'finance' then
    if not (private.user_is_platform(p_reviewer, 'finance_admin') or private.user_is_platform(p_reviewer, 'super_admin')) then
      raise exception 'NOT_AUTHORISED: Finance Admin required' using errcode = '42501';
    end if;
    if v_req.status <> 'requested' then
      raise exception 'INVALID_STAGE: request is not in requested status' using errcode = 'P0001';
    end if;
  elsif p_stage = 'super_admin' then
    if not private.user_is_platform(p_reviewer, 'super_admin') then
      raise exception 'NOT_AUTHORISED: Super Admin required' using errcode = '42501';
    end if;
    if v_req.status <> 'finance_approved' then
      raise exception 'INVALID_STAGE: finance review must precede super admin approval' using errcode = 'P0001';
    end if;

    -- Ensure Finance Admin and Super Admin approvers are distinct individuals (ND-09)
    select approver_id into v_other_approver from fin.settlement_approvals where request_id = p_request_id and stage = 'finance';
    if v_other_approver = p_reviewer then
      raise exception 'SEPARATION_OF_DUTIES: Finance and Super Admin approvers must be distinct individuals' using errcode = '42501';
    end if;
  else
    raise exception 'INVALID_STAGE_SPECIFIER' using errcode = 'P0001';
  end if;

  insert into fin.settlement_approvals (request_id, stage, approver_id, decision, comment)
  values (p_request_id, p_stage, p_reviewer, p_decision, p_comment);

  if p_decision = 'rejected' then
    update fin.settlement_requests set status = 'rejected', updated_at = now() where id = p_request_id;
  elsif p_stage = 'finance' then
    update fin.settlement_requests set status = 'finance_approved', updated_at = now() where id = p_request_id;
  elsif p_stage = 'super_admin' then
    update fin.settlement_requests set status = 'super_admin_approved', updated_at = now() where id = p_request_id;
  end if;

  perform private.write_audit(p_reviewer, 'settlement.review', 'settlement_requests', p_request_id::text,
    v_req.organization_id, null, null, jsonb_build_object('stage', p_stage, 'decision', p_decision));
end $$;

-- ---------------------------------------------------------------- lock down execution
revoke all on function
  public.app_process_payment_success(uuid, text, bigint, text, jsonb),
  public.app_release_closed_event_funds(uuid, uuid),
  public.app_review_settlement_request(uuid, uuid, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.app_process_payment_success(uuid, text, bigint, text, jsonb),
  public.app_release_closed_event_funds(uuid, uuid),
  public.app_review_settlement_request(uuid, uuid, text, text, text)
to service_role;
