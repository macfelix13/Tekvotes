-- TekVotes Phase 4: Voting Engine, Orders, Vote Ledger, Tallies, and Leaderboard Snapshots.
-- Implements TAS v1.0 Part 1 sections 3.7, Part 2 sections 8, 9, 13, 14.

-- ---------------------------------------------------------------- enums
create type public.order_status      as enum ('pending', 'payment_initiated', 'paid_uncredited', 'credited', 'failed', 'expired', 'reversed');
create type public.ledger_entry_type as enum ('credit', 'reversal', 'correction');

-- ---------------------------------------------------------------- voters & sessions
create table public.voters (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid unique references public.profiles (id) on delete set null,
  phone_e164          text,
  phone_verified_at   timestamptz,
  email               citext,
  marketing_consent   boolean not null default false,
  created_at          timestamptz not null default now()
);
create unique index voters_phone_verified_uq on public.voters (phone_e164) where phone_verified_at is not null;
create index voters_user_idx on public.voters (user_id);

create table public.voter_otp_challenges (
  id           uuid primary key default gen_random_uuid(),
  phone_e164   text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  code_hash    text not null,
  purpose      text not null default 'guest_vote_auth',
  attempts     integer not null default 0,
  max_attempts integer not null default 5,
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  ip_hash      text,
  device_hash  text,
  created_at   timestamptz not null default now()
);
create index voter_otp_phone_idx on public.voter_otp_challenges (phone_e164, created_at desc);

create table public.voter_sessions (
  id           uuid primary key default gen_random_uuid(),
  voter_id     uuid not null references public.voters (id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  ip_hash      text,
  device_hash  text,
  created_at   timestamptz not null default now()
);
create index voter_sessions_token_idx on public.voter_sessions (token_hash);

create table public.voter_favourites (
  voter_id            uuid not null references public.voters (id) on delete cascade,
  contestant_entry_id uuid not null references public.contestant_entries (id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (voter_id, contestant_entry_id)
);

-- ---------------------------------------------------------------- voting orders
create table public.voting_orders (
  id                          uuid primary key default gen_random_uuid(),
  reference                   text not null unique,
  organization_id             uuid not null,
  event_id                    uuid not null,
  category_id                 uuid not null,
  category_entry_id           uuid not null,
  voter_id                    uuid not null references public.voters (id) on delete restrict,
  status                      public.order_status not null default 'pending',
  pricing_mode                text not null check (pricing_mode in ('package', 'custom')),
  snapshot_package_id         uuid references public.vote_packages (id) on delete restrict,
  snapshot_unit_price_minor   bigint not null check (snapshot_unit_price_minor > 0),
  snapshot_votes              integer not null check (snapshot_votes > 0),
  snapshot_base_amount_minor  bigint not null check (snapshot_base_amount_minor > 0),
  snapshot_surcharge_minor    bigint not null default 0 check (snapshot_surcharge_minor >= 0),
  snapshot_amount_minor       bigint not null check (snapshot_amount_minor > 0),
  snapshot_currency           char(3) not null default 'GHS' references public.currencies (code),
  commission_bps              integer not null default 1000 check (commission_bps between 0 and 10000),
  fee_bearer_snapshot         text not null default 'voter',
  risk_score                  integer default 0,
  risk_signals                jsonb default '{}'::jsonb,
  expires_at                  timestamptz not null,
  client_ip_hash              text,
  device_hash                 text,
  user_agent_hash             text,
  created_at                  timestamptz not null default now(),
  credited_at                 timestamptz,
  constraint vo_ce_fk foreign key (category_entry_id, category_id, event_id, organization_id)
    references public.category_entries (id, category_id, event_id, organization_id) on delete restrict,
  constraint vo_total_amount_check check (snapshot_amount_minor = snapshot_base_amount_minor + snapshot_surcharge_minor),
  constraint vo_custom_whole_votes_check check (
    (pricing_mode = 'custom' and snapshot_package_id is null and snapshot_base_amount_minor = snapshot_votes * snapshot_unit_price_minor)
    or
    (pricing_mode = 'package' and snapshot_package_id is not null)
  )
);
create index voting_orders_cat_entry_idx on public.voting_orders (category_entry_id, status);
create index voting_orders_voter_idx on public.voting_orders (voter_id, created_at desc);
create index voting_orders_event_idx on public.voting_orders (event_id, status, created_at desc);

-- ---------------------------------------------------------------- vote ledger (append-only)
create table public.vote_ledger (
  id                  bigint generated always as identity primary key,
  organization_id     uuid not null,
  event_id            uuid not null,
  category_id         uuid not null,
  category_entry_id   uuid not null,
  entry_type          public.ledger_entry_type not null,
  votes               integer not null,
  order_id            uuid references public.voting_orders (id) on delete restrict,
  reverses_ledger_id  bigint references public.vote_ledger (id) on delete restrict,
  reason              text,
  actor_id            uuid references public.profiles (id),
  idempotency_key     text not null unique,
  created_at          timestamptz not null default now(),
  constraint vl_ce_fk foreign key (category_entry_id, category_id, event_id, organization_id)
    references public.category_entries (id, category_id, event_id, organization_id) on delete restrict,
  constraint vl_credit_check check (entry_type <> 'credit' or (votes > 0 and order_id is not null)),
  constraint vl_reversal_check check (entry_type <> 'reversal' or (votes < 0 and reverses_ledger_id is not null and reason is not null)),
  constraint vl_correction_check check (entry_type <> 'correction' or (votes <> 0 and reason is not null))
);
create unique index vote_ledger_credit_one_per_order on public.vote_ledger (order_id) where entry_type = 'credit';
create index vote_ledger_entry_idx on public.vote_ledger (category_entry_id, created_at);
create index vote_ledger_event_idx on public.vote_ledger (event_id, created_at);

create trigger vote_ledger_no_mutation before update or delete on public.vote_ledger
  for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------- tallies (rebuildable cache)
create table public.category_entry_tallies (
  category_entry_id   uuid primary key,
  category_id         uuid not null,
  event_id            uuid not null,
  organization_id     uuid not null,
  total_votes         bigint not null default 0 check (total_votes >= 0),
  last_ledger_id      bigint references public.vote_ledger (id),
  updated_at          timestamptz not null default now(),
  constraint tallies_ce_fk foreign key (category_entry_id, category_id, event_id, organization_id)
    references public.category_entries (id, category_id, event_id, organization_id) on delete cascade
);
create index tallies_leaderboard_idx on public.category_entry_tallies (category_id, total_votes desc);

-- ---------------------------------------------------------------- leaderboard snapshots
create table public.leaderboard_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid not null,
  event_id            uuid not null,
  organization_id     uuid not null,
  results_state       public.category_results_state not null,
  visibility_mode     text not null check (visibility_mode in ('ranks_only', 'counts', 'percent')),
  payload             jsonb not null,
  source_ledger_max_id bigint,
  published           boolean not null default false,
  created_at          timestamptz not null default now(),
  constraint lb_snapshots_cat_fk foreign key (category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete cascade
);
create index lb_snapshots_cat_idx on public.leaderboard_snapshots (category_id, published, created_at desc);
