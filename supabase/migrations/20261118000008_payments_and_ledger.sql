-- TekVotes Phase 5: Payments, Double-Entry Financial Ledger, Commissions & Settlements.
-- Implements TAS v1.0 Part 1 section 3.8 and Part 2 sections 10, 11, 12.

create schema if not exists fin;
revoke all on schema fin from public, anon, authenticated;
grant usage on schema fin to service_role;

-- ---------------------------------------------------------------- enums
create type fin.account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
create type fin.entry_direction as enum ('debit', 'credit');
create type fin.payment_status as enum ('initiated', 'pending', 'success', 'failed', 'abandoned', 'reversed', 'disputed');
create type fin.settlement_status as enum (
  'requested', 'under_finance_review', 'finance_approved', 'super_admin_approved',
  'payout_initiated', 'payout_processing', 'completed', 'failed', 'rejected', 'cancelled'
);
create type fin.refund_status as enum (
  'requested', 'under_review', 'approved', 'rejected', 'processing', 'completed', 'failed'
);

-- ---------------------------------------------------------------- payment attempts & transactions
create table fin.payment_attempts (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null unique references public.voting_orders (id) on delete restrict,
  provider            text not null default 'paystack',
  provider_reference  text not null unique,
  access_code         text,
  authorization_url   text,
  channel             text,
  status              fin.payment_status not null default 'initiated',
  amount_minor        bigint not null check (amount_minor > 0),
  currency            char(3) not null default 'GHS' references public.currencies (code),
  initiated_at        timestamptz not null default now(),
  last_checked_at     timestamptz
);

create table fin.payment_transactions (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid unique references fin.payment_attempts (id) on delete restrict,
  order_id            uuid not null unique references public.voting_orders (id) on delete restrict,
  provider            text not null default 'paystack',
  provider_txn_id     text not null,
  provider_reference  text not null,
  amount_minor        bigint not null check (amount_minor > 0),
  currency            char(3) not null default 'GHS' references public.currencies (code),
  provider_fee_minor  bigint not null default 0 check (provider_fee_minor >= 0),
  paid_at             timestamptz not null,
  channel             text,
  raw_verification    jsonb not null default '{}'::jsonb,
  status              fin.payment_status not null default 'success',
  verified_at         timestamptz not null default now(),
  constraint payment_provider_txn_uq unique (provider, provider_txn_id)
);
create index payment_txn_provider_ref_idx on fin.payment_transactions (provider, provider_reference);

create table fin.payment_webhooks (
  id                  uuid primary key default gen_random_uuid(),
  provider            text not null default 'paystack',
  event_type          text not null,
  dedupe_key          text not null,
  signature_valid     boolean not null default false,
  payload             jsonb not null,
  raw_body_sha256     text not null,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,
  process_status      text not null default 'received' check (process_status in ('received', 'processing', 'done', 'ignored', 'error')),
  error               text,
  attempts            integer not null default 0,
  constraint webhook_dedupe_uq unique (provider, dedupe_key)
);
create index payment_webhooks_status_idx on fin.payment_webhooks (process_status, received_at);

-- ---------------------------------------------------------------- double-entry financial ledger
create table fin.financial_accounts (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  type                fin.account_type not null,
  organization_id     uuid references public.organizations (id) on delete restrict,
  currency            char(3) not null default 'GHS' references public.currencies (code),
  owner_kind          text not null check (owner_kind in ('platform', 'organization')),
  name                text not null,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);
create index fin_accounts_org_idx on fin.financial_accounts (organization_id);

create table fin.ledger_journals (
  id                  uuid primary key default gen_random_uuid(),
  journal_type        text not null, -- 'vote_payment', 'settlement', 'refund', 'chargeback'
  source_type         text not null,
  source_id           uuid not null,
  currency            char(3) not null default 'GHS' references public.currencies (code),
  description         text not null,
  effective_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  idempotency_key     text not null unique,
  reverses_journal_id uuid references fin.ledger_journals (id),
  posted_by           uuid references public.profiles (id)
);
create index ledger_journals_source_idx on fin.ledger_journals (source_type, source_id);

create table fin.ledger_entries (
  id                  bigint generated always as identity primary key,
  journal_id          uuid not null references fin.ledger_journals (id) on delete restrict,
  account_id          uuid not null references fin.financial_accounts (id) on delete restrict,
  organization_id     uuid references public.organizations (id) on delete restrict,
  event_id            uuid,
  direction           fin.entry_direction not null,
  amount_minor        bigint not null check (amount_minor > 0),
  currency            char(3) not null default 'GHS' references public.currencies (code),
  created_at          timestamptz not null default now(),
  constraint le_event_org_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete restrict
);
create index ledger_entries_journal_idx on fin.ledger_entries (journal_id);
create index ledger_entries_account_idx on fin.ledger_entries (account_id, created_at desc);
create index ledger_entries_org_event_idx on fin.ledger_entries (organization_id, event_id);

-- Immutability triggers on financial ledger
create trigger ledger_journals_no_mutation before update or delete on fin.ledger_journals
  for each row execute function private.forbid_mutation();

create trigger ledger_entries_no_mutation before update or delete on fin.ledger_entries
  for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------- balanced journal trigger
create or replace function fin.assert_journal_balanced() returns trigger
language plpgsql as $$
declare
  v_debit_sum bigint;
  v_credit_sum bigint;
  v_count integer;
  v_journal_curr char(3);
begin
  select count(*),
         coalesce(sum(case when direction = 'debit' then amount_minor else 0 end), 0),
         coalesce(sum(case when direction = 'credit' then amount_minor else 0 end), 0)
    into v_count, v_debit_sum, v_credit_sum
    from fin.ledger_entries
   where journal_id = new.journal_id;

  if v_count < 2 then
    raise exception 'JOURNAL_INCOMPLETE: Journal % must have at least 2 lines', new.journal_id using errcode = 'P0001';
  end if;

  if v_debit_sum <> v_credit_sum then
    raise exception 'JOURNAL_UNBALANCED: Debits (%) <> Credits (%) in journal %', v_debit_sum, v_credit_sum, new.journal_id using errcode = 'P0001';
  end if;

  select currency into v_journal_curr from fin.ledger_journals where id = new.journal_id;
  if exists (select 1 from fin.ledger_entries where journal_id = new.journal_id and currency <> v_journal_curr) then
    raise exception 'CURRENCY_MISMATCH: Lines must match journal currency' using errcode = 'P0001';
  end if;

  return null;
end $$;

create constraint trigger trg_journal_balanced
  after insert on fin.ledger_entries
  deferrable initially deferred
  for each row execute function fin.assert_journal_balanced();

-- ---------------------------------------------------------------- commission tracking
create table fin.commission_rules (
  id                  uuid primary key default gen_random_uuid(),
  scope               text not null default 'platform_default' check (scope in ('platform_default', 'organization')),
  organization_id     uuid references public.organizations (id) on delete cascade,
  rate_bps            integer not null check (rate_bps between 0 and 10000),
  basis               text not null default 'base_amount' check (basis in ('base_amount', 'gross', 'net_of_provider_fee')),
  rounding            text not null default 'half_up' check (rounding in ('half_up', 'floor', 'ceil')),
  fee_bearer          text not null default 'voter' check (fee_bearer in ('voter', 'organizer', 'platform')),
  valid_from          timestamptz not null default now(),
  valid_to            timestamptz,
  status              text not null default 'active' check (status in ('active', 'retired')),
  created_at          timestamptz not null default now()
);

create table fin.commission_entries (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null unique references public.voting_orders (id) on delete restrict,
  payment_txn_id         uuid not null references fin.payment_transactions (id) on delete restrict,
  rate_bps               integer not null,
  basis                  text not null,
  rounding               text not null,
  gross_charged_minor    bigint not null,
  base_vote_minor        bigint not null,
  voter_surcharge_minor  bigint not null,
  provider_fee_minor     bigint not null,
  commission_minor       bigint not null,
  organizer_net_minor    bigint not null,
  journal_id             uuid not null references fin.ledger_journals (id) on delete restrict,
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------- settlements & refunds
create table fin.settlement_destinations (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete restrict,
  type                   text not null check (type in ('mobile_money', 'bank')),
  provider_recipient_code text not null,
  masked_account         text not null,
  account_name           text not null,
  verified_at            timestamptz not null default now(),
  status                 text not null default 'verified' check (status in ('verified', 'inactive', 'revoked')),
  created_at             timestamptz not null default now()
);

create table fin.settlement_requests (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete restrict,
  requested_by           uuid not null references public.profiles (id),
  amount_minor           bigint not null check (amount_minor > 0),
  currency               char(3) not null default 'GHS' references public.currencies (code),
  destination_id         uuid not null references fin.settlement_destinations (id) on delete restrict,
  status                 fin.settlement_status not null default 'requested',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table fin.settlement_request_items (
  request_id             uuid not null references fin.settlement_requests (id) on delete cascade,
  event_id               uuid not null,
  organization_id        uuid not null,
  amount_minor           bigint not null check (amount_minor > 0),
  primary key (request_id, event_id),
  constraint sri_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete restrict
);

create table fin.settlement_approvals (
  id                     uuid primary key default gen_random_uuid(),
  request_id             uuid not null references fin.settlement_requests (id) on delete cascade,
  stage                  text not null check (stage in ('finance', 'super_admin')),
  approver_id            uuid not null references public.profiles (id),
  decision               text not null check (decision in ('approved', 'rejected')),
  comment                text,
  created_at             timestamptz not null default now(),
  constraint sa_stage_uq unique (request_id, stage)
);

create table fin.settlements (
  id                     uuid primary key default gen_random_uuid(),
  request_id             uuid not null unique references fin.settlement_requests (id) on delete restrict,
  organization_id        uuid not null references public.organizations (id) on delete restrict,
  provider_transfer_ref  text unique,
  amount_minor           bigint not null check (amount_minor > 0),
  currency               char(3) not null default 'GHS' references public.currencies (code),
  status                 fin.settlement_status not null default 'payout_initiated',
  initiated_at           timestamptz not null default now(),
  completed_at           timestamptz,
  failure_reason         text,
  journal_id             uuid references fin.ledger_journals (id),
  created_at             timestamptz not null default now()
);

create table fin.refunds (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.voting_orders (id) on delete restrict,
  payment_txn_id         uuid not null references fin.payment_transactions (id) on delete restrict,
  organization_id        uuid not null references public.organizations (id) on delete restrict,
  event_id               uuid not null,
  amount_minor           bigint not null check (amount_minor > 0),
  reason                 text not null,
  status                 fin.refund_status not null default 'requested',
  approved_by            uuid references public.profiles (id),
  approved_at            timestamptz,
  provider_refund_id     text,
  vote_reversal_ledger_id bigint references public.vote_ledger (id),
  journal_id             uuid references fin.ledger_journals (id),
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------- fund views per event & organization
create or replace view public.v_event_funds with (security_invoker = false) as
select
  e.id as event_id,
  e.organization_id,
  e.name as event_name,
  e.voting_status,
  e.currency,
  coalesce(sum(case when a.code like 'L-ORG-PEND:%' and le.direction = 'credit' then le.amount_minor
                    when a.code like 'L-ORG-PEND:%' and le.direction = 'debit' then -le.amount_minor else 0 end), 0) as total_earned_pending_minor,
  coalesce(sum(case when a.code like 'L-ORG-AVAIL:%' and le.direction = 'credit' then le.amount_minor
                    when a.code like 'L-ORG-AVAIL:%' and le.direction = 'debit' then -le.amount_minor else 0 end), 0) as available_to_settle_minor,
  coalesce(sum(case when a.code like 'L-ORG-INFLIGHT:%' and le.direction = 'credit' then le.amount_minor
                    when a.code like 'L-ORG-INFLIGHT:%' and le.direction = 'debit' then -le.amount_minor else 0 end), 0) as in_flight_settlement_minor
from public.events e
left join fin.ledger_entries le on le.event_id = e.id and le.organization_id = e.organization_id
left join fin.financial_accounts a on a.id = le.account_id
group by e.id, e.organization_id, e.name, e.voting_status, e.currency;

create or replace view public.v_org_funds with (security_invoker = false) as
select
  o.id as organization_id,
  o.name as organization_name,
  o.default_currency as currency,
  coalesce(sum(ef.total_earned_pending_minor), 0) as total_earned_pending_minor,
  coalesce(sum(ef.available_to_settle_minor), 0) as available_to_settle_minor,
  coalesce(sum(ef.in_flight_settlement_minor), 0) as in_flight_settlement_minor
from public.organizations o
left join public.v_event_funds ef on ef.organization_id = o.id
group by o.id, o.name, o.default_currency;
