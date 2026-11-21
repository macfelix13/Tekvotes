-- TekVotes Phase 21: Event Ticketing System (Ticket Tiers, Ticket Orders, Passes, Paystack Ledger Posting & Check-In)

create table if not exists public.event_ticket_tiers (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null,
  organization_id    uuid not null,
  name               text not null check (char_length(btrim(name)) between 2 and 120),
  description        text not null default '',
  price_minor        bigint not null check (price_minor > 0),
  currency           char(3) not null default 'GHS' references public.currencies (code),
  capacity           integer check (capacity is null or capacity > 0),
  sold_count         integer not null default 0 check (sold_count >= 0),
  max_per_order      integer not null default 10 check (max_per_order between 1 and 100),
  sales_opens_at     timestamptz,
  sales_closes_at    timestamptz,
  active             boolean not null default true,
  sort_order         integer not null default 0,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint ticket_tiers_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade,
  constraint ticket_tiers_composite_uq unique (id, event_id, organization_id)
);

create index if not exists event_ticket_tiers_event_idx
  on public.event_ticket_tiers (event_id, active, sort_order);

create trigger event_ticket_tiers_updated_at before update on public.event_ticket_tiers
  for each row execute function private.set_updated_at();

create table if not exists public.ticket_orders (
  id                       uuid primary key default gen_random_uuid(),
  reference                text not null unique,
  organization_id          uuid not null,
  event_id                 uuid not null,
  tier_id                  uuid not null,
  buyer_name               text not null,
  buyer_phone_e164         text not null,
  buyer_email              citext,
  quantity                 integer not null check (quantity between 1 and 100),
  unit_price_minor         bigint not null check (unit_price_minor > 0),
  base_amount_minor        bigint not null check (base_amount_minor > 0),
  surcharge_minor          bigint not null default 0 check (surcharge_minor >= 0),
  total_amount_minor       bigint not null check (total_amount_minor > 0),
  currency                 char(3) not null default 'GHS' references public.currencies (code),
  commission_bps           integer not null default 1000 check (commission_bps between 0 and 10000),
  status                   text not null default 'pending'
                           check (status in ('pending', 'payment_initiated', 'paid', 'failed', 'cancelled', 'refunded')),
  provider_txn_id          text,
  provider_fee_minor       bigint not null default 0,
  channel                  text,
  paid_at                  timestamptz,
  journal_id               uuid,
  raw_verification         jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint ticket_orders_tier_fk foreign key (tier_id, event_id, organization_id)
    references public.event_ticket_tiers (id, event_id, organization_id) on delete restrict
);

create index if not exists ticket_orders_event_idx on public.ticket_orders (event_id, status, created_at desc);
create index if not exists ticket_orders_org_idx on public.ticket_orders (organization_id, status);

create trigger ticket_orders_updated_at before update on public.ticket_orders
  for each row execute function private.set_updated_at();

create table if not exists public.issued_tickets (
  id                 uuid primary key default gen_random_uuid(),
  ticket_code        text not null unique,
  order_id           uuid not null references public.ticket_orders (id) on delete cascade,
  organization_id    uuid not null,
  event_id           uuid not null,
  tier_id            uuid not null,
  holder_name        text not null,
  holder_phone_e164  text not null,
  holder_email       citext,
  status             text not null default 'valid' check (status in ('valid', 'checked_in', 'cancelled')),
  checked_in_at      timestamptz,
  checked_in_by      uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists issued_tickets_order_idx on public.issued_tickets (order_id);
create index if not exists issued_tickets_event_idx on public.issued_tickets (event_id, status);

alter table public.event_ticket_tiers enable row level security;
alter table public.ticket_orders enable row level security;
alter table public.issued_tickets enable row level security;

grant select on public.event_ticket_tiers to anon, authenticated;
grant select on public.ticket_orders to authenticated;
grant select on public.issued_tickets to authenticated;

grant all on public.event_ticket_tiers to service_role;
grant all on public.ticket_orders to service_role;
grant all on public.issued_tickets to service_role;

create policy event_ticket_tiers_public_read on public.event_ticket_tiers
  for select to anon, authenticated using (true);

create policy ticket_orders_staff_read on public.ticket_orders
  for select to authenticated using (
    private.is_platform() or private.is_org_member(organization_id)
  );

create policy issued_tickets_staff_read on public.issued_tickets
  for select to authenticated using (
    private.is_platform() or private.is_org_member(organization_id)
  );

-- Atomic RPC to process a successful Paystack ticket order payment, post balanced ledger entries,
-- increment sold_count, and issue individual ticket passes.
create or replace function public.app_process_ticket_payment_success(
  p_ticket_order_id uuid,
  p_provider_txn_id text,
  p_provider_fee_minor bigint,
  p_channel text default 'mobile_money',
  p_raw_verification jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path = public, fin, pg_temp as $$
declare
  v_order public.ticket_orders%rowtype;
  v_journal_id uuid;
  v_rate_bps integer;
  v_commission bigint;
  v_org_net bigint;
  v_clearing_acc uuid;
  v_fees_acc uuid;
  v_org_pend_acc uuid;
  v_comm_acc uuid;
  v_recovery_acc uuid;
  v_idx integer;
  v_code text;
begin
  select * into v_order from public.ticket_orders where id = p_ticket_order_id for update;
  if not found then
    raise exception 'TICKET_ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_order.status = 'paid' then
    return true;
  end if;

  v_rate_bps := coalesce(v_order.commission_bps, 1000);
  v_commission := ((v_order.base_amount_minor * v_rate_bps) + 5000) / 10000;
  v_org_net := v_order.base_amount_minor - v_commission;

  v_clearing_acc := fin.get_or_create_account('A-PROV-CLEAR', 'asset', 'platform', 'Paystack Clearing Account');
  v_fees_acc     := fin.get_or_create_account('X-PROV-FEES', 'expense', 'platform', 'Payment Processing Fees');
  v_comm_acc     := fin.get_or_create_account('R-COMMISSION', 'revenue', 'platform', 'Platform Commission Revenue');
  v_recovery_acc := fin.get_or_create_account('R-FEE-RECOVERY', 'revenue', 'platform', 'Voter Surcharge Fee Recovery');
  v_org_pend_acc := fin.get_or_create_account(
    'L-ORG-PEND:' || v_order.organization_id::text, 'liability', 'organization',
    'Organizer Pending Share', v_order.organization_id
  );

  insert into fin.ledger_journals (
    journal_type, source_type, source_id, currency, description, idempotency_key
  ) values (
    'ticket_payment', 'ticket_orders', v_order.id, v_order.currency,
    'Ticket payment for ' || v_order.reference, 'journal:ticket_order:' || v_order.id::text
  )
  on conflict (idempotency_key) do nothing
  returning id into v_journal_id;

  if v_journal_id is not null then
    -- Dr A-PROV-CLEAR (Gross - Fee)
    insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
    values (v_journal_id, v_clearing_acc, 'debit', v_order.total_amount_minor - p_provider_fee_minor, v_order.currency);

    -- Dr X-PROV-FEES
    insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
    values (v_journal_id, v_fees_acc, 'debit', p_provider_fee_minor, v_order.currency);

    -- Cr L-ORG-PEND (Organizer Net Share with Event & Org Tracking)
    insert into fin.ledger_entries (journal_id, account_id, organization_id, event_id, direction, amount_minor, currency)
    values (v_journal_id, v_org_pend_acc, v_order.organization_id, v_order.event_id, 'credit', v_org_net, v_order.currency);

    -- Cr R-COMMISSION
    insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
    values (v_journal_id, v_comm_acc, 'credit', v_commission, v_order.currency);

    -- Cr R-FEE-RECOVERY
    if v_order.surcharge_minor > 0 then
      insert into fin.ledger_entries (journal_id, account_id, direction, amount_minor, currency)
      values (v_journal_id, v_recovery_acc, 'credit', v_order.surcharge_minor, v_order.currency);
    end if;
  end if;

  update public.ticket_orders
  set status = 'paid',
      provider_txn_id = p_provider_txn_id,
      provider_fee_minor = p_provider_fee_minor,
      channel = p_channel,
      paid_at = now(),
      journal_id = coalesce(v_journal_id, journal_id),
      raw_verification = p_raw_verification,
      updated_at = now()
  where id = v_order.id;

  update public.event_ticket_tiers
  set sold_count = sold_count + v_order.quantity,
      updated_at = now()
  where id = v_order.tier_id;

  for v_idx in 1..v_order.quantity loop
    v_code := v_order.reference || '-' || lpad(v_idx::text, 2, '0');
    insert into public.issued_tickets (
      ticket_code, order_id, organization_id, event_id, tier_id,
      holder_name, holder_phone_e164, holder_email, status
    ) values (
      v_code, v_order.id, v_order.organization_id, v_order.event_id, v_order.tier_id,
      v_order.buyer_name, v_order.buyer_phone_e164, v_order.buyer_email, 'valid'
    )
    on conflict (ticket_code) do nothing;
  end loop;

  return true;
end $$;
