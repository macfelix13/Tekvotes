-- TekVotes Phase 2: grants, RLS policies, seed data.
-- Implements TAS v1.0 Part 2 sections 6-7. Client roles are SELECT-only; all writes go through server RPCs.

-- ---------------------------------------------------------------- lock down default grants
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------- enable RLS everywhere
alter table public.currencies                 enable row level security;
alter table public.profiles                   enable row level security;
alter table public.platform_staff             enable row level security;
alter table public.permissions                enable row level security;
alter table public.role_templates             enable row level security;
alter table public.role_template_permissions  enable row level security;
alter table public.reserved_slugs             enable row level security;
alter table public.organization_applications  enable row level security;
alter table public.organizations              enable row level security;
alter table public.organization_members       enable row level security;
alter table public.role_assignments           enable row level security;
alter table public.role_assignment_overrides  enable row level security;
alter table public.organization_invitations   enable row level security;
alter table public.audit_logs                 enable row level security;
alter table public.idempotency_records        enable row level security;
alter table public.platform_settings          enable row level security;

-- ---------------------------------------------------------------- column/table grants (SELECT only)
grant select on public.currencies                to anon, authenticated;
grant select on public.profiles                  to authenticated;
grant select on public.platform_staff            to authenticated;
grant select on public.permissions               to authenticated;
grant select on public.role_templates            to authenticated;
grant select on public.role_template_permissions to authenticated;
grant select on public.organization_applications to authenticated;
grant select (id, slug, name, status, logo_public_id, created_at) on public.organizations to anon, authenticated;
grant select on public.organization_members      to authenticated;
grant select on public.role_assignments          to authenticated;
grant select on public.role_assignment_overrides to authenticated;
grant select (id, organization_id, email, role_template_id, event_id, category_id, entry_id,
              grants, denies, can_delegate, expires_at, accepted_at, revoked_at, invited_by, created_at)
  on public.organization_invitations to authenticated;   -- token_hash intentionally excluded
grant select on public.audit_logs                to authenticated;
-- reserved_slugs, idempotency_records, platform_settings: no client grants.

-- ---------------------------------------------------------------- policies
create policy currencies_read on public.currencies for select to anon, authenticated using (enabled);

create policy profiles_self on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_platform());

create policy staff_read on public.platform_staff for select to authenticated
  using (user_id = (select auth.uid()) or private.is_platform());

create policy permissions_read on public.permissions for select to authenticated using (true);

create policy role_templates_read on public.role_templates for select to authenticated
  using (organization_id is null
         or private.is_org_member(organization_id)
         or private.is_platform());

create policy rtp_read on public.role_template_permissions for select to authenticated using (
  exists (select 1 from public.role_templates t where t.id = role_template_id
          and (t.organization_id is null or private.is_org_member(t.organization_id) or private.is_platform())));

create policy applications_read on public.organization_applications for select to authenticated
  using (applicant_user_id = (select auth.uid()) or private.is_platform());

create policy organizations_public on public.organizations for select to anon, authenticated
  using (status = 'approved');
create policy organizations_members on public.organizations for select to authenticated
  using (private.is_org_member(id) or private.is_platform());

create policy members_read on public.organization_members for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_perm('organization.members.manage', organization_id)
         or private.is_platform());

create policy ra_read on public.role_assignments for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_perm('organization.members.manage', organization_id)
         or private.is_platform());

create policy rao_read on public.role_assignment_overrides for select to authenticated using (
  exists (select 1 from public.role_assignments ra where ra.id = assignment_id
          and (ra.user_id = (select auth.uid())
               or private.has_perm('organization.members.manage', ra.organization_id)
               or private.is_platform())));

create policy invitations_read on public.organization_invitations for select to authenticated
  using (private.has_perm('organization.members.manage', organization_id) or private.is_platform());

create policy audit_read on public.audit_logs for select to authenticated
  using (private.is_platform('super_admin')
         or (organization_id is not null and private.has_perm('organization.members.manage', organization_id)));

-- ---------------------------------------------------------------- seed: currencies, slugs
insert into public.currencies (code, minor_unit_exponent, enabled) values ('GHS', 2, true);

insert into public.reserved_slugs (slug) values
  ('admin'), ('api'), ('app'), ('www'), ('support'), ('help'), ('login'), ('register'), ('auth'),
  ('static'), ('assets'), ('cdn'), ('mail'), ('tekvotes'), ('official'), ('billing'), ('payments'),
  ('me'), ('manage'), ('judge'), ('org'), ('orgs'), ('events'), ('event'), ('competitions'), ('vote');

-- ---------------------------------------------------------------- seed: permissions (TAS 6.1)
insert into public.permissions (key, scope_level, is_financial, description) values
  ('platform.orgs.review',        'platform', false, 'Review and decide organization applications'),
  ('platform.orgs.suspend',       'platform', false, 'Suspend or reinstate organizations'),
  ('platform.events.approve',     'platform', false, 'Approve events for voting'),
  ('platform.commission.manage',  'platform', true,  'Manage commission rules'),
  ('platform.users.manage',       'platform', false, 'Manage platform users'),
  ('platform.staff.manage',       'platform', false, 'Manage platform staff'),
  ('platform.fraud.manage',       'platform', false, 'Manage fraud flags'),
  ('platform.domains.manage',     'platform', false, 'Manage domains and white-label'),
  ('platform.audit.view',         'platform', false, 'View platform audit log'),
  ('platform.settings.manage',    'platform', false, 'Manage platform settings'),
  ('finance.payments.view',       'platform', true,  'View payments'),
  ('finance.reconcile.run',       'platform', true,  'Run reconciliation'),
  ('finance.refunds.review',      'platform', true,  'Review refunds'),
  ('finance.refunds.approve',     'platform', true,  'Approve refunds'),
  ('finance.settlements.review',  'platform', true,  'Finance review of settlements'),
  ('finance.settlements.approve', 'platform', true,  'Super Admin approval of settlements'),
  ('finance.reports.view',        'platform', true,  'View finance reports'),
  ('finance.reports.export',      'platform', true,  'Export finance reports'),
  ('organization.profile.manage',    'organization', false, 'Manage organization profile'),
  ('organization.members.manage',    'organization', false, 'Manage members and assignments'),
  ('organization.roles.delegate',    'organization', false, 'Delegate roles within own scope'),
  ('organization.events.create',     'organization', false, 'Create events'),
  ('organization.finance.view',      'organization', true,  'View organization finances'),
  ('settlement.request',             'organization', true,  'Request settlements'),
  ('settlement.destination.manage',  'organization', true,  'Manage payout destinations'),
  ('event.settings.manage',      'event', false, 'Manage event settings'),
  ('event.submit_for_approval',  'event', false, 'Submit event for approval'),
  ('event.publish',              'event', false, 'Publish or unpublish event pages'),
  ('event.categories.manage',    'event', false, 'Manage categories'),
  ('event.pricing.manage',       'event', false, 'Manage prices and packages'),
  ('event.limits.manage',        'event', false, 'Manage voting limits'),
  ('event.contestants.register', 'event', false, 'Register contestants'),
  ('event.contestants.manage',   'event', false, 'Manage contestants and entries'),
  ('event.managers.assign',      'event', false, 'Assign contestant managers'),
  ('event.sponsors.manage',      'event', false, 'Manage sponsors'),
  ('event.branding.manage',      'event', false, 'Manage branding'),
  ('event.voting.pause',         'event', false, 'Pause voting'),
  ('event.voting.resume',        'event', false, 'Resume voting'),
  ('event.voting.close',         'event', false, 'Close voting'),
  ('event.cancel.request',       'event', false, 'Request event cancellation'),
  ('event.judges.manage',        'event', false, 'Manage judges and criteria'),
  ('event.results.view_internal','event', false, 'View internal vote totals and results'),
  ('event.results.publish',      'event', false, 'Publish results'),
  ('event.leaderboard.set_state','event', false, 'Set leaderboard Hidden/Live/Final'),
  ('event.announcements.send',   'event', false, 'Send announcements'),
  ('event.reports.export',       'event', false, 'Export event reports'),
  ('event.duplicate',            'event', false, 'Duplicate events'),
  ('event.moderation.handle',    'event', false, 'Handle moderation reports'),
  ('entry.profile.edit',         'entry', false, 'Edit contestant profile'),
  ('entry.media.manage',         'entry', false, 'Manage contestant media'),
  ('entry.social.manage',        'entry', false, 'Manage contestant social links'),
  ('entry.stats.view',           'entry', false, 'View contestant performance'),
  ('judging.score.submit',       'category', false, 'Submit judging scores'),
  ('judging.assigned.view',      'category', false, 'View assigned judging data'),
  ('judging.correction.request', 'category', false, 'Request score correction');

-- ---------------------------------------------------------------- seed: system role templates (TAS 6.2)
insert into public.role_templates (key, name, scope_level, is_system) values
  ('org_owner',          'Organization Owner', 'organization', true),
  ('org_admin',          'Organization Admin', 'organization', true),
  ('event_manager',      'Event Manager',      'event',        true),
  ('contestant_manager', 'Contestant Manager', 'entry',        true),
  ('judge',              'Judge',              'category',     true);

-- Owner: everything organization/event/entry scoped (not platform.*, finance.*, judging.*).
insert into public.role_template_permissions (role_template_id, permission_key)
select t.id, p.key from public.role_templates t
join public.permissions p on p.scope_level in ('organization', 'event', 'entry')
where t.key = 'org_owner';

-- Org Admin: no defaults. Everything is granted explicitly via overrides (financial never automatic).

-- Event Manager defaults (the rest are grantable overrides).
insert into public.role_template_permissions (role_template_id, permission_key)
select t.id, k from public.role_templates t,
  unnest(array['event.settings.manage','event.categories.manage','event.contestants.register',
               'event.contestants.manage','event.sponsors.manage','event.branding.manage',
               'event.announcements.send','entry.profile.edit','entry.media.manage',
               'entry.social.manage','entry.stats.view']) k
where t.key = 'event_manager';

-- Contestant Manager: assigned entry only.
insert into public.role_template_permissions (role_template_id, permission_key)
select t.id, k from public.role_templates t,
  unnest(array['entry.profile.edit','entry.media.manage','entry.social.manage','entry.stats.view']) k
where t.key = 'contestant_manager';

-- Judge: assigned category only.
insert into public.role_template_permissions (role_template_id, permission_key)
select t.id, k from public.role_templates t,
  unnest(array['judging.score.submit','judging.assigned.view','judging.correction.request']) k
where t.key = 'judge';
