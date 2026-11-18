-- TekVotes Phase 2: core identity, access, organizations, audit.
-- Implements TAS v1.0 Part 1 sections 3.1-3.4 and 3.10 (subset).
-- Notes:
--  * role_assignments.event_id/category_id/entry_id are plain uuid columns in Phase 2.
--    Composite FKs to events/categories/entries are added in the Phase 3 migration.
--  * Money tables (fin schema) arrive in Phase 5.

create extension if not exists citext;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------- enums
create type public.org_application_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
create type public.org_status            as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.platform_role         as enum ('super_admin', 'finance_admin');
create type public.scope_level           as enum ('platform', 'organization', 'event', 'category', 'entry');
create type public.override_effect       as enum ('grant', 'deny');

-- ---------------------------------------------------------------- currencies
create table public.currencies (
  code                 char(3) primary key,
  minor_unit_exponent  smallint not null check (minor_unit_exponent between 0 and 4),
  enabled              boolean  not null default false
);

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id             uuid primary key,  -- = auth.users.id
  display_name   text not null default '',
  email          citext,
  phone_e164     text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_public_id text,
  locale         text not null default 'en',
  status         text not null default 'active' check (status in ('active', 'suspended')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create unique index profiles_email_uq on public.profiles (email) where email is not null;
create unique index profiles_phone_uq on public.profiles (phone_e164) where phone_e164 is not null;

-- ---------------------------------------------------------------- platform staff
create table public.platform_staff (
  user_id       uuid not null references public.profiles (id) on delete restrict,
  platform_role public.platform_role not null,
  granted_by    uuid references public.profiles (id),
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  primary key (user_id, platform_role)
);

-- ---------------------------------------------------------------- permissions & roles
create table public.permissions (
  key          text primary key check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  scope_level  public.scope_level not null,
  is_financial boolean not null default false,
  description  text not null default ''
);

create table public.role_templates (
  id              uuid primary key default gen_random_uuid(),
  key             text not null,
  name            text not null,
  scope_level     public.scope_level not null,
  is_system       boolean not null default false,
  organization_id uuid,   -- FK added after organizations
  created_at      timestamptz not null default now()
);
create unique index role_templates_key_uq
  on public.role_templates (key, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.role_template_permissions (
  role_template_id uuid not null references public.role_templates (id) on delete cascade,
  permission_key   text not null references public.permissions (key) on delete restrict,
  primary key (role_template_id, permission_key)
);

-- ---------------------------------------------------------------- organizations
create table public.reserved_slugs (slug citext primary key);

create table public.organization_applications (
  id                 uuid primary key default gen_random_uuid(),
  applicant_user_id  uuid not null references public.profiles (id) on delete restrict,
  applicant_name     text not null,
  applicant_email    citext not null,
  applicant_phone    text,
  org_name           text not null check (char_length(org_name) between 2 and 120),
  org_type           text,
  description        text,
  website            text,
  country            char(2) not null default 'GH',
  documents          jsonb not null default '[]'::jsonb,
  status             public.org_application_status not null default 'pending',
  reviewed_by        uuid references public.profiles (id),
  reviewed_at        timestamptz,
  rejection_reason   text,
  created_at         timestamptz not null default now(),
  constraint app_rejected_needs_reason check (status <> 'rejected' or coalesce(char_length(btrim(rejection_reason)), 0) > 0),
  constraint app_reviewed_consistency check (status = 'pending' or status = 'withdrawn' or (reviewed_by is not null and reviewed_at is not null))
);
create index org_applications_status_idx on public.organization_applications (status, created_at);
create unique index org_applications_one_pending_per_user
  on public.organization_applications (applicant_user_id) where status = 'pending';

create table public.organizations (
  id                      uuid primary key default gen_random_uuid(),
  application_id          uuid unique references public.organization_applications (id),
  slug                    citext not null unique
                          check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name                    text not null,
  status                  public.org_status not null default 'approved',
  owner_user_id           uuid not null references public.profiles (id),
  default_currency        char(3) not null default 'GHS' references public.currencies (code),
  finance_access_enabled  boolean not null default false,
  logo_public_id          text,
  contact_email           citext,
  contact_phone           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.role_templates
  add constraint role_templates_org_fk foreign key (organization_id)
  references public.organizations (id) on delete cascade;

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id         uuid not null references public.profiles (id) on delete restrict,
  is_owner        boolean not null default false,
  status          text not null default 'active' check (status in ('active', 'removed')),
  joined_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create unique index organization_members_one_owner
  on public.organization_members (organization_id) where is_owner and status = 'active';

-- ---------------------------------------------------------------- role assignments
create table public.role_assignments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete restrict,
  role_template_id uuid not null references public.role_templates (id) on delete restrict,
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  event_id         uuid,
  category_id      uuid,
  entry_id         uuid,
  status           text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  can_delegate     boolean not null default false,
  granted_by       uuid not null references public.profiles (id),
  granted_at       timestamptz not null default now(),
  expires_at       timestamptz,
  revoked_at       timestamptz,
  revoked_by       uuid references public.profiles (id),
  constraint ra_scope_coherent check (
    (category_id is null or event_id is not null)
    and (entry_id is null or event_id is not null)
    and not (category_id is not null and entry_id is not null)
  ),
  constraint ra_revoked_consistency check (status <> 'revoked' or (revoked_at is not null and revoked_by is not null))
);
create unique index role_assignments_active_uq on public.role_assignments (
  user_id, role_template_id, organization_id,
  coalesce(event_id,    '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(entry_id,    '00000000-0000-0000-0000-000000000000'::uuid)
) where status = 'active';
create index role_assignments_user_idx on public.role_assignments (user_id, status);
create index role_assignments_org_event_idx on public.role_assignments (organization_id, event_id);

create table public.role_assignment_overrides (
  assignment_id  uuid not null references public.role_assignments (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete restrict,
  effect         public.override_effect not null,
  primary key (assignment_id, permission_key)
);

-- ---------------------------------------------------------------- invitations
create table public.organization_invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete restrict,
  email            citext not null,
  role_template_id uuid not null references public.role_templates (id),
  event_id         uuid,
  category_id      uuid,
  entry_id         uuid,
  grants           text[] not null default '{}',
  denies           text[] not null default '{}',
  can_delegate     boolean not null default false,
  token_hash       text not null unique,
  expires_at       timestamptz not null,
  accepted_at      timestamptz,
  accepted_by      uuid references public.profiles (id),
  revoked_at       timestamptz,
  invited_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now()
);
create index org_invitations_org_idx on public.organization_invitations (organization_id, email);

-- ---------------------------------------------------------------- audit & idempotency
create table public.audit_logs (
  id              bigint generated always as identity primary key,
  at              timestamptz not null default now(),
  actor_id        uuid,
  actor_kind      text not null default 'user' check (actor_kind in ('user', 'system', 'webhook')),
  action          text not null,
  resource_type   text not null,
  resource_id     text,
  organization_id uuid,
  event_id        uuid,
  before          jsonb,
  after           jsonb,
  reason          text,
  request_id      text
);
create index audit_logs_org_at_idx on public.audit_logs (organization_id, at desc);
create index audit_logs_resource_idx on public.audit_logs (resource_type, resource_id);

create table public.idempotency_records (
  scope         text not null,
  key           text not null,
  request_hash  text not null,
  response      jsonb,
  status        text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '48 hours'),
  primary key (scope, key)
);

create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  version     integer not null default 1,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);
