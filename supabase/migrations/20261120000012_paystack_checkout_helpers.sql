-- TekVotes Phase 9: Server-side Paystack Checkout, Webhook Idempotency & Public Receipt Helpers.
-- Exposes service_role-only SECURITY DEFINER RPCs in public so Next.js API routes can
-- interact with fin.* tables without exposing the fin schema over PostgREST.

-- ---------------------------------------------------------------- 1. Harden app_process_payment_success
-- Handles zero provider fees cleanly (fin.ledger_entries enforces amount_minor > 0),
-- returns false idempotently when already paid_uncredited, and syncs payment_attempts.
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
  v_fee bigint;
begin
  v_fee := greatest(0, coalesce(p_provider_fee_minor, 0));

  -- 1. Lock and retrieve order
  select * into v_order from public.voting_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_order.status = 'credited' then
    return true;
  end if;
  if v_order.status = 'paid_uncredited' then
    return false;
  end if;

  -- 2. Record Payment Transaction (idempotent ON CONFLICT)
  insert into fin.payment_transactions (
    order_id, provider, provider_txn_id, provider_reference,
    amount_minor, currency, provider_fee_minor, paid_at, channel, raw_verification
  ) values (
    v_order.id, 'paystack', p_provider_txn_id, v_order.reference,
    v_order.snapshot_amount_minor, v_order.snapshot_currency, v_fee, now(), p_channel, p_raw_verification
  )
  on conflict (provider, provider_txn_id) do nothing
  returning id into v_txn_id;

  if v_txn_id is null then
    select id into v_txn_id from fin.payment_transactions where provider = 'paystack' and provider_txn_id = p_provider_txn_id;
  end if;

  update fin.payment_attempts
     set status = 'success',
         channel = coalesce(p_channel, channel),
         last_checked_at = now()
   where order_id = v_order.id;

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

    insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
    values (v_journal_id, v_clearing_acc, 'debit', v_order.snapshot_amount_minor - v_fee, v_order.snapshot_currency);

    if v_fee > 0 then
      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_fees_acc, 'debit', v_fee, v_order.snapshot_currency);
    end if;

    insert into fin.ledger_entries (journal_id, account_id, organization_id, event_id, direction, amount_minor, currency)
    values (v_journal_id, v_org_pend_acc, v_order.organization_id, v_order.event_id, 'credit', v_org_net, v_order.snapshot_currency);

    insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
    values (v_journal_id, v_comm_acc, 'credit', v_commission, v_order.snapshot_currency);

    if v_order.snapshot_surcharge_minor > 0 then
      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_recovery_acc, 'credit', v_order.snapshot_surcharge_minor, v_order.snapshot_currency);
    end if;

    insert into fin.commission_entries (
      order_id, payment_txn_id, rate_bps, basis, rounding,
      gross_charged_minor, base_vote_minor, voter_surcharge_minor, provider_fee_minor,
      commission_minor, organizer_net_minor, journal_id
    ) values (
      v_order.id, v_txn_id, v_rate_bps, 'base_amount', 'half_up',
      v_order.snapshot_amount_minor, v_order.snapshot_base_amount_minor, v_order.snapshot_surcharge_minor,
      v_fee, v_commission, v_org_net, v_journal_id
    );
  else
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

      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_clearing_acc, 'debit', v_order.snapshot_amount_minor - v_fee, v_order.snapshot_currency);

      if v_fee > 0 then
        insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
        values (v_journal_id, v_fees_acc, 'debit', v_fee, v_order.snapshot_currency);
      end if;

      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_suspense_acc, 'credit', v_order.snapshot_amount_minor, v_order.snapshot_currency);
    end;
  end if;

  return v_ok;
end $$;

-- ---------------------------------------------------------------- 2. Record payment attempt
create or replace function public.app_record_payment_attempt(
  p_order_id uuid,
  p_provider_reference text,
  p_access_code text,
  p_authorization_url text,
  p_amount_minor bigint,
  p_currency char(3)
) returns uuid language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_attempt_id uuid;
begin
  insert into fin.payment_attempts (
    order_id, provider, provider_reference, access_code, authorization_url,
    status, amount_minor, currency, last_checked_at
  ) values (
    p_order_id, 'paystack', p_provider_reference, p_access_code, p_authorization_url,
    'initiated', p_amount_minor, p_currency, now()
  )
  on conflict (order_id) do update set
    provider_reference = excluded.provider_reference,
    access_code = excluded.access_code,
    authorization_url = excluded.authorization_url,
    last_checked_at = now()
  returning id into v_attempt_id;

  update public.voting_orders
     set status = 'payment_initiated'
   where id = p_order_id and status = 'pending';

  return v_attempt_id;
end $$;

-- ---------------------------------------------------------------- 3. Record webhook idempotently
create or replace function public.app_record_payment_webhook(
  p_provider text,
  p_event_type text,
  p_dedupe_key text,
  p_signature_valid boolean,
  p_payload jsonb,
  p_raw_body_sha256 text
) returns table(webhook_id uuid, already_processed boolean)
language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_id uuid;
  v_status text;
begin
  insert into fin.payment_webhooks (
    provider, event_type, dedupe_key, signature_valid, payload, raw_body_sha256
  ) values (
    p_provider, p_event_type, p_dedupe_key, p_signature_valid, p_payload, p_raw_body_sha256
  )
  on conflict (provider, dedupe_key) do nothing
  returning id into v_id;

  if v_id is not null then
    webhook_id := v_id;
    already_processed := false;
    return next;
    return;
  end if;

  select w.id, w.process_status into v_id, v_status
    from fin.payment_webhooks w
   where w.provider = p_provider and w.dedupe_key = p_dedupe_key;

  webhook_id := v_id;
  already_processed := (v_status = 'done');
  return next;
end $$;

-- ---------------------------------------------------------------- 4. Mark webhook status
create or replace function public.app_mark_webhook_status(
  p_webhook_id uuid,
  p_status text,
  p_error text default null
) returns void language plpgsql security definer set search_path = public, fin, pg_temp as $$
begin
  update fin.payment_webhooks
     set process_status = p_status,
         processed_at = now(),
         error = p_error,
         attempts = attempts + 1
   where id = p_webhook_id;
end $$;

-- ---------------------------------------------------------------- 5. Public non-PII receipt lookup
create or replace function public.app_get_receipt_by_reference(p_reference text)
returns jsonb language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_row record;
begin
  select
    o.id as order_id,
    o.reference,
    o.status::text as status,
    c.display_name as contestant_name,
    ent.public_code as contestant_code,
    ev.name as event_name,
    ev.slug as event_slug,
    cat.name as category_name,
    o.snapshot_votes as votes,
    o.snapshot_base_amount_minor as base_amount_minor,
    o.snapshot_surcharge_minor as surcharge_minor,
    o.snapshot_amount_minor as total_amount_minor,
    o.snapshot_currency as currency,
    coalesce(pt.channel, pa.channel, 'mobile_money') as channel,
    o.created_at,
    o.credited_at,
    vl.id as ledger_id,
    pt.provider_txn_id
  into v_row
  from public.voting_orders o
  join public.events ev on ev.id = o.event_id
  join public.event_categories cat on cat.id = o.category_id
  join public.category_entries ce on ce.id = o.category_entry_id
  join public.contestant_entries ent on ent.id = ce.entry_id
  join public.contestants c on c.id = ent.contestant_id
  left join public.vote_ledger vl on vl.order_id = o.id and vl.entry_type = 'credit'
  left join fin.payment_transactions pt on pt.order_id = o.id
  left join fin.payment_attempts pa on pa.order_id = o.id
  where upper(o.reference) = upper(btrim(p_reference))
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'orderId', v_row.order_id,
    'reference', v_row.reference,
    'status', v_row.status,
    'contestantName', v_row.contestant_name,
    'contestantCode', v_row.contestant_code,
    'eventName', v_row.event_name,
    'eventSlug', v_row.event_slug,
    'categoryName', v_row.category_name,
    'votes', v_row.votes,
    'baseAmountMinor', v_row.base_amount_minor,
    'surchargeMinor', v_row.surcharge_minor,
    'totalAmountMinor', v_row.total_amount_minor,
    'currency', v_row.currency,
    'channel', v_row.channel,
    'createdAt', v_row.created_at,
    'creditedAt', v_row.credited_at,
    'ledgerId', v_row.ledger_id,
    'providerTxnId', v_row.provider_txn_id
  );
end $$;

-- ---------------------------------------------------------------- lock down execution
revoke all on function
  public.app_process_payment_success(uuid, text, bigint, text, jsonb),
  public.app_record_payment_attempt(uuid, text, text, text, bigint, char),
  public.app_record_payment_webhook(text, text, text, boolean, jsonb, text),
  public.app_mark_webhook_status(uuid, text, text),
  public.app_get_receipt_by_reference(text)
from public, anon, authenticated;

grant execute on function
  public.app_process_payment_success(uuid, text, bigint, text, jsonb),
  public.app_record_payment_attempt(uuid, text, text, text, bigint, char),
  public.app_record_payment_webhook(text, text, text, boolean, jsonb, text),
  public.app_mark_webhook_status(uuid, text, text),
  public.app_get_receipt_by_reference(text)
to service_role;
