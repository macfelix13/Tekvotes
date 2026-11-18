-- TekVotes Phase 3: Events, Categories, Contestants, Entries, Sponsors, Branding.
-- Implements TAS v1.0 Part 1 sections 3.5, 3.6 and Part 3 sections 15, 16.

-- ---------------------------------------------------------------- enums
create type public.event_approval_status   as enum ('not_submitted', 'submitted', 'under_review', 'approved', 'rejected', 'revoked');
create type public.event_publication_status as enum ('unpublished', 'published', 'archived');
create type public.event_voting_status      as enum ('not_started', 'active', 'paused', 'closed', 'cancelled');
create type public.category_results_state   as enum ('hidden', 'live', 'final');
create type public.entry_status             as enum ('draft', 'pending', 'approved', 'withdrawn', 'disqualified', 'removed');
create type public.scoring_mode             as enum ('public', 'judges', 'public_plus_judges', 'weighted');

-- ---------------------------------------------------------------- events
create table public.events (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete restrict,
  slug                    citext not null,
  public_code             text not null unique,
  name                    text not null check (char_length(name) between 2 and 150),
  description             text,
  rules_text              text,
  event_type              text not null default 'beauty_pageant',
  venue                   text,
  contact_email           citext,
  contact_phone           text,
  event_date              timestamptz,
  timezone                text not null default 'Africa/Accra',
  currency                char(3) not null default 'GHS' references public.currencies (code),
  voting_opens_at         timestamptz,
  voting_closes_at        timestamptz,
  approval_status         public.event_approval_status not null default 'not_submitted',
  publication_status      public.event_publication_status not null default 'unpublished',
  voting_status           public.event_voting_status not null default 'not_started',
  pause_reason            text,
  paused_at               timestamptz,
  cancelled_at            timestamptz,
  cancel_reason           text,
  duplicated_from_event_id uuid references public.events (id) on delete set null,
  created_by              uuid not null references public.profiles (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  archived_at             timestamptz,
  constraint events_org_slug_uq unique (organization_id, slug),
  constraint events_composite_uq unique (id, organization_id),
  constraint events_dates_check check (voting_closes_at is null or voting_opens_at is null or voting_closes_at > voting_opens_at),
  constraint events_approval_voting_guard check (voting_status <> 'active' or approval_status = 'approved'),
  constraint events_pause_reason_check check (voting_status <> 'paused' or (pause_reason is not null and char_length(btrim(pause_reason)) > 0)),
  constraint events_cancel_reason_check check (voting_status <> 'cancelled' or (cancel_reason is not null and char_length(btrim(cancel_reason)) > 0))
);
create index events_org_idx on public.events (organization_id);
create index events_status_idx on public.events (publication_status, approval_status, voting_status);

create trigger events_updated_at before update on public.events
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------- event approvals & history
create table public.event_approvals (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null,
  organization_id  uuid not null,
  submitted_by     uuid not null references public.profiles (id),
  submitted_at     timestamptz not null default now(),
  reviewer_id      uuid references public.profiles (id),
  decision         public.event_approval_status not null,
  decision_reason  text,
  decided_at       timestamptz,
  constraint event_approvals_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade,
  constraint event_approvals_rejected_reason check (decision <> 'rejected' or (decision_reason is not null and char_length(btrim(decision_reason)) > 0))
);
create index event_approvals_event_idx on public.event_approvals (event_id);

create table public.event_status_history (
  id               bigint generated always as identity primary key,
  event_id         uuid not null,
  organization_id  uuid not null,
  dimension        text not null check (dimension in ('approval', 'publication', 'voting')),
  from_status      text not null,
  to_status        text not null,
  reason           text,
  actor_id         uuid references public.profiles (id),
  actor_kind       text not null default 'user' check (actor_kind in ('user', 'system')),
  created_at       timestamptz not null default now(),
  constraint status_history_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade
);
create index event_status_history_idx on public.event_status_history (event_id, created_at desc);

create trigger event_status_history_no_mutations before update or delete on public.event_status_history
  for each row execute function private.forbid_mutation();

-- ---------------------------------------------------------------- categories & pricing
create table public.event_categories (
  id                          uuid primary key default gen_random_uuid(),
  event_id                    uuid not null,
  organization_id             uuid not null,
  name                        text not null check (char_length(name) between 2 and 100),
  slug                        citext not null,
  description                 text,
  sort_order                  integer not null default 0,
  results_state               public.category_results_state not null default 'hidden',
  live_visibility             text not null default 'counts' check (live_visibility in ('ranks_only', 'counts', 'percent')),
  voting_enabled              boolean not null default true,
  scoring_mode                public.scoring_mode not null default 'public',
  unit_price_minor            bigint not null check (unit_price_minor > 0),
  currency                    char(3) not null default 'GHS' references public.currencies (code),
  min_votes                   integer check (min_votes is null or min_votes > 0),
  max_votes                   integer check (max_votes is null or max_votes > 0),
  sponsor_id                  uuid, -- FK added after sponsors
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint cat_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade,
  constraint cat_event_slug_uq unique (event_id, slug),
  constraint cat_composite_uq unique (id, event_id, organization_id),
  constraint cat_min_max_votes check (max_votes is null or min_votes is null or max_votes >= min_votes)
);
create index event_categories_event_idx on public.event_categories (event_id, sort_order);

create trigger event_categories_updated_at before update on public.event_categories
  for each row execute function private.set_updated_at();

create table public.vote_packages (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid not null,
  event_id         uuid not null,
  organization_id  uuid not null,
  label            text not null,
  votes            integer not null check (votes > 0),
  price_minor      bigint not null check (price_minor > 0),
  currency         char(3) not null default 'GHS' references public.currencies (code),
  sort_order       integer not null default 0,
  active           boolean not null default true,
  valid_from       timestamptz,
  valid_until      timestamptz,
  created_at       timestamptz not null default now(),
  constraint vote_packages_cat_fk foreign key (category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete cascade,
  constraint vote_packages_dates check (valid_until is null or valid_from is null or valid_until > valid_from)
);
create index vote_packages_category_idx on public.vote_packages (category_id, active, sort_order);

create table public.event_voting_limits (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null,
  organization_id  uuid not null,
  category_id      uuid,
  scope_dimension  text not null check (scope_dimension in ('phone', 'account', 'device', 'ip', 'contestant', 'category', 'event')),
  window_seconds   integer check (window_seconds is null or window_seconds > 0),
  max_votes        integer check (max_votes is null or max_votes > 0),
  max_orders       integer check (max_orders is null or max_orders > 0),
  max_amount_minor bigint check (max_amount_minor is null or max_amount_minor > 0),
  enforcement      text not null default 'block' check (enforcement in ('block', 'flag')),
  constraint limits_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade,
  constraint limits_cat_fk foreign key (category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete cascade
);
create index event_limits_event_idx on public.event_voting_limits (event_id);

-- ---------------------------------------------------------------- sponsors & branding
create table public.sponsors (
  id                      uuid primary key default gen_random_uuid(),
  event_id                uuid not null,
  organization_id         uuid not null,
  name                    text not null,
  logo_public_id          text,
  banner_public_id        text,
  website_url             text,
  description             text,
  tier                    text not null default 'bronze',
  sort_order              integer not null default 0,
  sponsored_category_id   uuid,
  created_at              timestamptz not null default now(),
  constraint sponsors_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade,
  constraint sponsors_cat_fk foreign key (sponsored_category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete set null
);
create index sponsors_event_idx on public.sponsors (event_id, sort_order);

alter table public.event_categories
  add constraint cat_sponsor_fk foreign key (sponsor_id)
  references public.sponsors (id) on delete set null;

create table public.branding_settings (
  event_id         uuid primary key,
  organization_id  uuid not null,
  primary_color    text not null default '#4B35E0',
  accent_color     text not null default '#F2A900',
  font_key         text not null default 'default',
  logo_public_id   text,
  banner_public_id text,
  card_style       text not null default 'modern',
  hide_platform_attribution boolean not null default false,
  updated_at       timestamptz not null default now(),
  constraint branding_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade
);

-- ---------------------------------------------------------------- contestants & entries
create table public.contestants (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  display_name     text not null check (char_length(display_name) between 2 and 120),
  legal_name       text,
  gender           text,
  date_of_birth    date,
  bio              text,
  profile_public_id text,
  status           text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint contestants_composite_uq unique (id, organization_id)
);
create index contestants_org_idx on public.contestants (organization_id);

create trigger contestants_updated_at before update on public.contestants
  for each row execute function private.set_updated_at();

create table public.contestant_media (
  id                    uuid primary key default gen_random_uuid(),
  contestant_id         uuid not null,
  organization_id       uuid not null,
  entry_id              uuid,
  kind                  text not null check (kind in ('image', 'video_link')),
  cloudinary_public_id  text not null,
  sort_order            integer not null default 0,
  moderation_status     text not null default 'approved' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint media_contestant_fk foreign key (contestant_id, organization_id)
    references public.contestants (id, organization_id) on delete cascade
);
create index contestant_media_idx on public.contestant_media (contestant_id, sort_order);

create table public.contestant_social_links (
  id             uuid primary key default gen_random_uuid(),
  contestant_id  uuid not null,
  organization_id uuid not null,
  platform       text not null check (platform in ('instagram', 'tiktok', 'facebook', 'x', 'youtube', 'linkedin', 'website')),
  url            text not null check (url ~ '^https?://'),
  sort_order     integer not null default 0,
  constraint social_contestant_fk foreign key (contestant_id, organization_id)
    references public.contestants (id, organization_id) on delete cascade
);
create index contestant_social_idx on public.contestant_social_links (contestant_id);

create table public.contestant_entries (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null,
  organization_id       uuid not null,
  contestant_id         uuid not null,
  contestant_number     integer not null check (contestant_number > 0),
  public_code           text not null unique,
  event_bio             text,
  status                public.entry_status not null default 'approved',
  disqualified_reason   text,
  qr_asset_public_id    text,
  registered_by         uuid not null references public.profiles (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint entries_event_fk foreign key (event_id, organization_id)
    references public.events (id, organization_id) on delete cascade,
  constraint entries_contestant_fk foreign key (contestant_id, organization_id)
    references public.contestants (id, organization_id) on delete restrict,
  constraint entries_event_num_uq unique (event_id, contestant_number),
  constraint entries_event_contestant_uq unique (event_id, contestant_id),
  constraint entries_composite_uq unique (id, event_id, organization_id)
);
create index contestant_entries_event_idx on public.contestant_entries (event_id, status);

create trigger contestant_entries_updated_at before update on public.contestant_entries
  for each row execute function private.set_updated_at();

create table public.category_entries (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null,
  organization_id  uuid not null,
  category_id      uuid not null,
  entry_id         uuid not null,
  status           text not null default 'active' check (status in ('active', 'withdrawn', 'disqualified')),
  display_order    integer not null default 0,
  created_at       timestamptz not null default now(),
  constraint ce_cat_fk foreign key (category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete cascade,
  constraint ce_entry_fk foreign key (entry_id, event_id, organization_id)
    references public.contestant_entries (id, event_id, organization_id) on delete cascade,
  constraint ce_cat_entry_uq unique (category_id, entry_id),
  constraint ce_composite_uq unique (id, category_id, event_id, organization_id)
);
create index category_entries_cat_idx on public.category_entries (category_id, status, display_order);

-- Link role_assignments composite FKs to Phase 3 resources
alter table public.role_assignments
  add constraint ra_event_fk foreign key (event_id, organization_id)
  references public.events (id, organization_id) on delete cascade;

alter table public.role_assignments
  add constraint ra_entry_fk foreign key (entry_id, event_id, organization_id)
  references public.contestant_entries (id, event_id, organization_id) on delete cascade;
