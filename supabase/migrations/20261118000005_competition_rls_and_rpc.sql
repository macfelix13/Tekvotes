-- TekVotes Phase 3: RLS Policies and RPCs for Event & Contestant Management.
-- Implements TAS v1.0 Part 1 sections 3.5, 3.6, Part 2 section 7, and Part 3 section 16.

-- ---------------------------------------------------------------- enable RLS
alter table public.events                   enable row level security;
alter table public.event_approvals          enable row level security;
alter table public.event_status_history     enable row level security;
alter table public.event_categories         enable row level security;
alter table public.vote_packages            enable row level security;
alter table public.event_voting_limits      enable row level security;
alter table public.sponsors                 enable row level security;
alter table public.branding_settings        enable row level security;
alter table public.contestants              enable row level security;
alter table public.contestant_media         enable row level security;
alter table public.contestant_social_links  enable row level security;
alter table public.contestant_entries       enable row level security;
alter table public.category_entries         enable row level security;

-- ---------------------------------------------------------------- grants
grant select on public.events                   to anon, authenticated;
grant select on public.event_categories         to anon, authenticated;
grant select on public.vote_packages            to anon, authenticated;
grant select on public.sponsors                 to anon, authenticated;
grant select on public.branding_settings        to anon, authenticated;
grant select on public.contestants              to anon, authenticated;
grant select on public.contestant_media         to anon, authenticated;
grant select on public.contestant_social_links  to anon, authenticated;
grant select on public.contestant_entries       to anon, authenticated;
grant select on public.category_entries         to anon, authenticated;
grant select on public.event_approvals          to authenticated;
grant select on public.event_status_history     to authenticated;
grant select on public.event_voting_limits      to authenticated;

grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------- policies: events
create policy events_public on public.events for select to anon, authenticated
  using (
    publication_status = 'published'
    and approval_status not in ('rejected', 'revoked')
  );

create policy events_staff on public.events for select to authenticated
  using (
    private.is_platform()
    or private.has_any_event_assignment(organization_id, id)
    or private.has_perm('organization.events.create', organization_id)
  );

-- ---------------------------------------------------------------- policies: categories & packages
create policy categories_public on public.event_categories for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.publication_status = 'published'
        and e.approval_status not in ('rejected', 'revoked')
    )
  );

create policy categories_staff on public.event_categories for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.categories.manage', organization_id, event_id)
    or private.has_any_event_assignment(organization_id, event_id)
  );

create policy packages_public on public.vote_packages for select to anon, authenticated
  using (
    active
    and exists (
      select 1 from public.event_categories c
      join public.events e on e.id = c.event_id
      where c.id = category_id
        and c.voting_enabled
        and e.publication_status = 'published'
    )
  );

create policy packages_staff on public.vote_packages for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.pricing.manage', organization_id, event_id)
  );

-- ---------------------------------------------------------------- policies: contestants & entries
create policy contestants_read on public.contestants for select to authenticated
  using (
    private.is_org_member(organization_id)
    or private.is_platform()
  );

create policy contestant_entries_public on public.contestant_entries for select to anon, authenticated
  using (
    status = 'approved'
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.publication_status = 'published'
        and e.approval_status not in ('rejected', 'revoked')
    )
  );

create policy contestant_entries_staff on public.contestant_entries for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.contestants.manage', organization_id, event_id)
    or private.has_perm('entry.profile.edit', organization_id, event_id, null, id)
    or private.has_perm('entry.stats.view', organization_id, event_id, null, id)
  );

create policy category_entries_public on public.category_entries for select to anon, authenticated
  using (
    status = 'active'
    and exists (
      select 1 from public.contestant_entries ce
      join public.events e on e.id = ce.event_id
      where ce.id = entry_id
        and ce.status = 'approved'
        and e.publication_status = 'published'
    )
  );

create policy category_entries_staff on public.category_entries for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.contestants.manage', organization_id, event_id)
    or private.has_perm('entry.stats.view', organization_id, event_id, null, entry_id)
  );

create policy media_public on public.contestant_media for select to anon, authenticated
  using (
    moderation_status = 'approved'
    and deleted_at is null
  );

create policy social_public on public.contestant_social_links for select to anon, authenticated
  using (true);

create policy sponsors_public on public.sponsors for select to anon, authenticated
  using (true);

create policy branding_public on public.branding_settings for select to anon, authenticated
  using (true);

create policy approvals_staff on public.event_approvals for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.settings.manage', organization_id, event_id)
  );

create policy history_staff on public.event_status_history for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.settings.manage', organization_id, event_id)
  );

create policy limits_staff on public.event_voting_limits for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.limits.manage', organization_id, event_id)
  );

-- ---------------------------------------------------------------- RPCs (Service Role only)
create or replace function public.app_submit_event_for_approval(
  p_actor uuid, p_event_id uuid, p_org_id uuid
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.events%rowtype;
begin
  if not (private.user_has_perm(p_actor, 'event.submit_for_approval', p_org_id, p_event_id)
          or private.user_is_platform(p_actor, 'super_admin')) then
    raise exception 'NOT_AUTHORISED: lacks event.submit_for_approval' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id and organization_id = p_org_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;

  if not exists (select 1 from public.event_categories where event_id = p_event_id) then
    raise exception 'NO_CATEGORIES: Event must have at least one category before approval submission' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.contestant_entries where event_id = p_event_id and status = 'approved') then
    raise exception 'NO_CONTESTANTS: Event must have at least one approved contestant before approval submission' using errcode = 'P0001';
  end if;

  update public.events set approval_status = 'submitted', updated_at = now() where id = p_event_id;

  insert into public.event_approvals (event_id, organization_id, submitted_by, decision)
  values (p_event_id, p_org_id, p_actor, 'submitted');

  insert into public.event_status_history (event_id, organization_id, dimension, from_status, to_status, actor_id)
  values (p_event_id, p_org_id, 'approval', v_event.approval_status::text, 'submitted', p_actor);

  perform private.write_audit(p_actor, 'event.submit_approval', 'events', p_event_id::text, p_org_id, p_event_id);
end $$;

create or replace function public.app_review_event_approval(
  p_reviewer uuid, p_event_id uuid, p_decision text, p_reason text default null
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.events%rowtype;
  v_status public.event_approval_status;
begin
  if not private.user_is_platform(p_reviewer, 'super_admin') then
    raise exception 'NOT_AUTHORISED: Super Admin required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected', 'revoked') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;

  v_status := p_decision::public.event_approval_status;

  if v_status in ('rejected', 'revoked') and coalesce(char_length(btrim(p_reason)), 0) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;

  -- If revoked, also pause voting atomically if currently active
  if v_status = 'revoked' and v_event.voting_status = 'active' then
    update public.events
    set approval_status = v_status,
        voting_status = 'paused',
        pause_reason = coalesce(p_reason, 'Approval revoked by Super Admin'),
        paused_at = now(),
        updated_at = now()
    where id = p_event_id;

    insert into public.event_status_history (event_id, organization_id, dimension, from_status, to_status, reason, actor_id)
    values (p_event_id, v_event.organization_id, 'voting', 'active', 'paused', p_reason, p_reviewer);
  else
    update public.events
    set approval_status = v_status, updated_at = now()
    where id = p_event_id;
  end if;

  insert into public.event_approvals (event_id, organization_id, submitted_by, reviewer_id, decision, decision_reason, decided_at)
  values (p_event_id, v_event.organization_id, v_event.created_by, p_reviewer, v_status, p_reason, now());

  insert into public.event_status_history (event_id, organization_id, dimension, from_status, to_status, reason, actor_id)
  values (p_event_id, v_event.organization_id, 'approval', v_event.approval_status::text, v_status::text, p_reason, p_reviewer);

  perform private.write_audit(p_reviewer, 'event.review_approval', 'events', p_event_id::text, v_event.organization_id, p_event_id,
    null, jsonb_build_object('decision', p_decision), p_reason);
end $$;

create or replace function public.app_pause_event_voting(
  p_actor uuid, p_event_id uuid, p_org_id uuid, p_reason text
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.events%rowtype;
begin
  if coalesce(char_length(btrim(p_reason)), 0) = 0 then
    raise exception 'REASON_REQUIRED: Reason is required to pause voting' using errcode = 'P0001';
  end if;

  if not (private.user_has_perm(p_actor, 'event.voting.pause', p_org_id, p_event_id)
          or private.user_is_platform(p_actor, 'super_admin')) then
    raise exception 'NOT_AUTHORISED: lacks event.voting.pause' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id and organization_id = p_org_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_event.voting_status <> 'active' then
    raise exception 'INVALID_STATE: voting is not currently active' using errcode = 'P0001';
  end if;

  update public.events
  set voting_status = 'paused', pause_reason = p_reason, paused_at = now(), updated_at = now()
  where id = p_event_id;

  insert into public.event_status_history (event_id, organization_id, dimension, from_status, to_status, reason, actor_id)
  values (p_event_id, p_org_id, 'voting', 'active', 'paused', p_reason, p_actor);

  perform private.write_audit(p_actor, 'event.voting.pause', 'events', p_event_id::text, p_org_id, p_event_id, null, null, p_reason);
end $$;

create or replace function public.app_resume_event_voting(
  p_actor uuid, p_event_id uuid, p_org_id uuid, p_reason text
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.events%rowtype;
begin
  if not (private.user_has_perm(p_actor, 'event.voting.resume', p_org_id, p_event_id)
          or private.user_is_platform(p_actor, 'super_admin')) then
    raise exception 'NOT_AUTHORISED: lacks event.voting.resume' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id and organization_id = p_org_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_event.voting_status <> 'paused' then
    raise exception 'INVALID_STATE: voting is not paused' using errcode = 'P0001';
  end if;
  if v_event.approval_status <> 'approved' then
    raise exception 'NOT_APPROVED: event approval is revoked or pending' using errcode = 'P0001';
  end if;

  update public.events
  set voting_status = 'active', pause_reason = null, paused_at = null, updated_at = now()
  where id = p_event_id;

  insert into public.event_status_history (event_id, organization_id, dimension, from_status, to_status, reason, actor_id)
  values (p_event_id, p_org_id, 'voting', 'paused', 'active', p_reason, p_actor);

  perform private.write_audit(p_actor, 'event.voting.resume', 'events', p_event_id::text, p_org_id, p_event_id, null, null, p_reason);
end $$;

-- ---------------------------------------------------------------- lock down functions
revoke all on function
  public.app_submit_event_for_approval(uuid, uuid, uuid),
  public.app_review_event_approval(uuid, uuid, text, text),
  public.app_pause_event_voting(uuid, uuid, uuid, text),
  public.app_resume_event_voting(uuid, uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.app_submit_event_for_approval(uuid, uuid, uuid),
  public.app_review_event_approval(uuid, uuid, text, text),
  public.app_pause_event_voting(uuid, uuid, uuid, text),
  public.app_resume_event_voting(uuid, uuid, uuid, text)
to service_role;
