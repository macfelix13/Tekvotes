-- TekVotes Phase 2: functions (authorization, audit, org workflow, delegation).
-- Implements TAS v1.0 Part 2 sections 6-7.

-- ---------------------------------------------------------------- generic triggers
create or replace function private.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger organizations_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();

create or replace function private.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'IMMUTABLE_TABLE: % on % is not allowed', tg_op, tg_table_name
    using errcode = 'P0001';
end $$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.forbid_mutation();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.forbid_mutation();

-- profile auto-creation when an auth user appears
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- audit helper
create or replace function private.write_audit(
  p_actor uuid, p_action text, p_resource_type text, p_resource_id text,
  p_org uuid default null, p_event uuid default null,
  p_before jsonb default null, p_after jsonb default null, p_reason text default null,
  p_actor_kind text default 'user')
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_logs
    (actor_id, actor_kind, action, resource_type, resource_id, organization_id, event_id, before, after, reason)
  values (p_actor, p_actor_kind, p_action, p_resource_type, p_resource_id, p_org, p_event, p_before, p_after, p_reason);
$$;

-- ---------------------------------------------------------------- authorization
create or replace function private.user_is_platform(p_user uuid, p_role text default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.platform_staff s
    where s.user_id = p_user and s.revoked_at is null
      and (p_role is null or s.platform_role::text = p_role));
$$;

create or replace function private.is_platform(p_role text default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.user_is_platform((select auth.uid()), p_role);
$$;

-- Effective permission check for an explicit user. Deny overrides always win.
create or replace function private.user_has_perm(
  p_user uuid, p_perm text, p_org uuid, p_event uuid default null,
  p_category uuid default null, p_entry uuid default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  with live as (
    select ra.id, ra.role_template_id
    from public.role_assignments ra
    join public.organizations o on o.id = ra.organization_id and o.status = 'approved'
    where ra.user_id = p_user
      and ra.status = 'active'
      and (ra.expires_at is null or ra.expires_at > now())
      and ra.organization_id = p_org
      and (ra.event_id    is null or ra.event_id    = p_event)
      and (ra.category_id is null or ra.category_id = p_category)
      and (ra.entry_id    is null or ra.entry_id    = p_entry)
  )
  select
    (
      exists (select 1 from live l
              join public.role_template_permissions rtp
                on rtp.role_template_id = l.role_template_id and rtp.permission_key = p_perm)
      or exists (select 1 from live l
              join public.role_assignment_overrides og
                on og.assignment_id = l.id and og.permission_key = p_perm and og.effect = 'grant')
    )
    and not exists (
      select 1 from live l
      join public.role_assignment_overrides od
        on od.assignment_id = l.id and od.permission_key = p_perm and od.effect = 'deny');
$$;

create or replace function private.has_perm(
  p_perm text, p_org uuid, p_event uuid default null,
  p_category uuid default null, p_entry uuid default null)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select private.user_has_perm((select auth.uid()), p_perm, p_org, p_event, p_category, p_entry);
$$;

-- Any active assignment touching this event (lets managers/judges read parent event metadata).
create or replace function private.has_any_event_assignment(p_org uuid, p_event uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.role_assignments ra
    join public.organizations o on o.id = ra.organization_id and o.status = 'approved'
    where ra.user_id = (select auth.uid())
      and ra.status = 'active'
      and (ra.expires_at is null or ra.expires_at > now())
      and ra.organization_id = p_org
      and (ra.event_id is null or ra.event_id = p_event));
$$;

create or replace function private.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.organization_members m
                 where m.organization_id = p_org and m.user_id = (select auth.uid()) and m.status = 'active');
$$;

create or replace function private.user_is_org_owner(p_user uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.organization_members m
                 where m.organization_id = p_org and m.user_id = p_user and m.is_owner and m.status = 'active');
$$;

-- ---------------------------------------------------------------- delegation guard
-- Raises if the actor may not create this grant. No privilege escalation, no unauthorised financial grants.
create or replace function private.assert_can_grant(
  p_actor uuid, p_template_id uuid, p_org uuid, p_event uuid, p_category uuid, p_entry uuid,
  p_grants text[])
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_template public.role_templates%rowtype;
  v_perm record;
begin
  select * into v_template from public.role_templates where id = p_template_id;
  if not found then raise exception 'TEMPLATE_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_template.key = 'org_owner' then
    raise exception 'OWNER_ROLE_NOT_GRANTABLE: use ownership transfer' using errcode = 'P0001';
  end if;
  if v_template.organization_id is not null and v_template.organization_id <> p_org then
    raise exception 'TEMPLATE_WRONG_ORG' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(p_grants, '{}')) g
             where not exists (select 1 from public.permissions p where p.key = g)) then
    raise exception 'UNKNOWN_PERMISSION' using errcode = 'P0001';
  end if;

  if private.user_is_platform(p_actor, 'super_admin') then
    return;  -- platform override; caller audits
  end if;

  if not private.user_has_perm(p_actor, 'organization.roles.delegate', p_org, p_event, p_category, p_entry) then
    raise exception 'NOT_AUTHORISED_TO_DELEGATE' using errcode = '42501';
  end if;

  for v_perm in
    select p.key, p.is_financial
    from public.permissions p
    where p.key in (select permission_key from public.role_template_permissions where role_template_id = p_template_id)
       or p.key = any (coalesce(p_grants, '{}'))
  loop
    if not private.user_has_perm(p_actor, v_perm.key, p_org, p_event, p_category, p_entry) then
      raise exception 'PRIVILEGE_ESCALATION: actor lacks %', v_perm.key using errcode = '42501';
    end if;
    if v_perm.is_financial and not private.user_is_org_owner(p_actor, p_org) then
      raise exception 'FINANCIAL_PERMISSION_REQUIRES_OWNER: %', v_perm.key using errcode = '42501';
    end if;
  end loop;
end $$;

create or replace function private.do_grant(
  p_actor uuid, p_user uuid, p_template_id uuid, p_org uuid,
  p_event uuid, p_category uuid, p_entry uuid,
  p_grants text[], p_denies text[], p_can_delegate boolean, p_expires timestamptz)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_perm text;
begin
  if p_user = p_actor and not private.user_is_platform(p_actor, 'super_admin') then
    raise exception 'SELF_GRANT_NOT_ALLOWED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_org and o.status = 'approved') then
    raise exception 'ORG_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(p_denies, '{}')) d
             where not exists (select 1 from public.permissions p where p.key = d)) then
    raise exception 'UNKNOWN_PERMISSION' using errcode = 'P0001';
  end if;

  perform private.assert_can_grant(p_actor, p_template_id, p_org, p_event, p_category, p_entry, p_grants);

  insert into public.organization_members (organization_id, user_id)
  values (p_org, p_user)
  on conflict (organization_id, user_id) do update set status = 'active';

  insert into public.role_assignments
    (user_id, role_template_id, organization_id, event_id, category_id, entry_id,
     can_delegate, granted_by, expires_at)
  values (p_user, p_template_id, p_org, p_event, p_category, p_entry,
          coalesce(p_can_delegate, false), p_actor, p_expires)
  returning id into v_id;

  foreach v_perm in array coalesce(p_grants, '{}') loop
    insert into public.role_assignment_overrides values (v_id, v_perm, 'grant')
    on conflict do nothing;
  end loop;
  foreach v_perm in array coalesce(p_denies, '{}') loop
    insert into public.role_assignment_overrides values (v_id, v_perm, 'deny')
    on conflict (assignment_id, permission_key) do update set effect = 'deny';
  end loop;

  perform private.write_audit(p_actor, 'role.grant', 'role_assignment', v_id::text, p_org, p_event,
    null, jsonb_build_object('user_id', p_user, 'template_id', p_template_id,
      'event_id', p_event, 'category_id', p_category, 'entry_id', p_entry,
      'grants', coalesce(p_grants, '{}'), 'denies', coalesce(p_denies, '{}')));
  return v_id;
end $$;

-- ---------------------------------------------------------------- server-only RPCs
create or replace function public.app_grant_role(
  p_actor uuid, p_user uuid, p_template_id uuid, p_org uuid,
  p_event uuid default null, p_category uuid default null, p_entry uuid default null,
  p_grants text[] default '{}', p_denies text[] default '{}',
  p_can_delegate boolean default false, p_expires timestamptz default null)
returns uuid language sql security definer set search_path = public, pg_temp as $$
  select private.do_grant(p_actor, p_user, p_template_id, p_org, p_event, p_category, p_entry,
                          p_grants, p_denies, p_can_delegate, p_expires);
$$;

create or replace function public.app_revoke_role(p_assignment uuid, p_actor uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ra public.role_assignments%rowtype;
  v_tpl_key text;
begin
  if coalesce(char_length(btrim(p_reason)), 0) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_ra from public.role_assignments where id = p_assignment for update;
  if not found or v_ra.status <> 'active' then
    raise exception 'ASSIGNMENT_NOT_ACTIVE' using errcode = 'P0002';
  end if;
  select key into v_tpl_key from public.role_templates where id = v_ra.role_template_id;
  if v_tpl_key = 'org_owner' then
    raise exception 'OWNER_ROLE_NOT_REVOCABLE: use ownership transfer' using errcode = 'P0001';
  end if;
  if not (private.user_is_platform(p_actor, 'super_admin')
          or private.user_has_perm(p_actor, 'organization.members.manage', v_ra.organization_id)) then
    raise exception 'NOT_AUTHORISED' using errcode = '42501';
  end if;
  update public.role_assignments
     set status = 'revoked', revoked_at = now(), revoked_by = p_actor
   where id = p_assignment;
  perform private.write_audit(p_actor, 'role.revoke', 'role_assignment', p_assignment::text,
    v_ra.organization_id, v_ra.event_id, to_jsonb(v_ra), null, p_reason);
end $$;

create or replace function public.app_approve_org_application(p_app uuid, p_reviewer uuid, p_slug text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_app public.organization_applications%rowtype;
  v_org uuid;
  v_owner_tpl uuid;
begin
  if not private.user_is_platform(p_reviewer, 'super_admin') then
    raise exception 'NOT_AUTHORISED: super admin required' using errcode = '42501';
  end if;
  select * into v_app from public.organization_applications where id = p_app for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_app.status <> 'pending' then raise exception 'APPLICATION_NOT_PENDING' using errcode = 'P0001'; end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'INVALID_SLUG' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reserved_slugs r where r.slug = p_slug::citext) then
    raise exception 'RESERVED_SLUG' using errcode = 'P0001';
  end if;

  select id into v_owner_tpl from public.role_templates where key = 'org_owner' and organization_id is null;

  insert into public.organizations (application_id, slug, name, owner_user_id, contact_email, contact_phone)
  values (v_app.id, p_slug, v_app.org_name, v_app.applicant_user_id, v_app.applicant_email, v_app.applicant_phone)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, is_owner)
  values (v_org, v_app.applicant_user_id, true);

  insert into public.role_assignments (user_id, role_template_id, organization_id, can_delegate, granted_by)
  values (v_app.applicant_user_id, v_owner_tpl, v_org, true, p_reviewer);

  update public.organization_applications
     set status = 'approved', reviewed_by = p_reviewer, reviewed_at = now()
   where id = p_app;

  perform private.write_audit(p_reviewer, 'organization.approve', 'organization_application', p_app::text,
    v_org, null, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'approved', 'slug', p_slug));
  return v_org;
end $$;

create or replace function public.app_reject_org_application(p_app uuid, p_reviewer uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_app public.organization_applications%rowtype;
begin
  if not private.user_is_platform(p_reviewer, 'super_admin') then
    raise exception 'NOT_AUTHORISED: super admin required' using errcode = '42501';
  end if;
  if coalesce(char_length(btrim(p_reason)), 0) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  select * into v_app from public.organization_applications where id = p_app for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_app.status <> 'pending' then raise exception 'APPLICATION_NOT_PENDING' using errcode = 'P0001'; end if;
  update public.organization_applications
     set status = 'rejected', reviewed_by = p_reviewer, reviewed_at = now(), rejection_reason = p_reason
   where id = p_app;
  perform private.write_audit(p_reviewer, 'organization.reject', 'organization_application', p_app::text,
    null, null, jsonb_build_object('status', 'pending'), jsonb_build_object('status', 'rejected'), p_reason);
end $$;

create or replace function public.app_create_invitation(
  p_actor uuid, p_org uuid, p_email citext, p_template_id uuid,
  p_token_hash text, p_event uuid default null, p_category uuid default null, p_entry uuid default null,
  p_grants text[] default '{}', p_denies text[] default '{}', p_can_delegate boolean default false,
  p_ttl interval default interval '7 days')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  perform private.assert_can_grant(p_actor, p_template_id, p_org, p_event, p_category, p_entry, p_grants);
  insert into public.organization_invitations
    (organization_id, email, role_template_id, event_id, category_id, entry_id,
     grants, denies, can_delegate, token_hash, expires_at, invited_by)
  values (p_org, p_email, p_template_id, p_event, p_category, p_entry,
          coalesce(p_grants, '{}'), coalesce(p_denies, '{}'), coalesce(p_can_delegate, false),
          p_token_hash, now() + p_ttl, p_actor)
  returning id into v_id;
  perform private.write_audit(p_actor, 'invitation.create', 'organization_invitation', v_id::text, p_org, p_event);
  return v_id;
end $$;

create or replace function public.app_accept_invitation(p_token_hash text, p_user uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_inv public.organization_invitations%rowtype;
  v_email citext;
  v_ra uuid;
begin
  select * into v_inv from public.organization_invitations where token_hash = p_token_hash for update;
  if not found then raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'INVITATION_NOT_USABLE' using errcode = 'P0001';
  end if;
  select email into v_email from public.profiles where id = p_user;
  if v_email is null or v_email <> v_inv.email then
    raise exception 'INVITATION_EMAIL_MISMATCH' using errcode = '42501';
  end if;
  -- authority of the inviter is re-checked at acceptance time
  begin
    v_ra := private.do_grant(v_inv.invited_by, p_user, v_inv.role_template_id, v_inv.organization_id,
      v_inv.event_id, v_inv.category_id, v_inv.entry_id, v_inv.grants, v_inv.denies, v_inv.can_delegate, null);
  exception when insufficient_privilege then
    raise exception 'INVITER_LOST_AUTHORITY' using errcode = '42501';
  end;
  update public.organization_invitations set accepted_at = now(), accepted_by = p_user where id = v_inv.id;
  perform private.write_audit(p_user, 'invitation.accept', 'organization_invitation', v_inv.id::text,
    v_inv.organization_id, v_inv.event_id);
  return v_ra;
end $$;

create or replace function public.app_bootstrap_super_admin(p_email citext)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;
begin
  select id into v_user from public.profiles where email = p_email;
  if v_user is null then
    raise exception 'USER_NOT_FOUND: register and confirm this email first' using errcode = 'P0002';
  end if;
  insert into public.platform_staff (user_id, platform_role, granted_by)
  values (v_user, 'super_admin', v_user)
  on conflict (user_id, platform_role) do update set revoked_at = null;
  perform private.write_audit(null, 'platform.bootstrap_super_admin', 'platform_staff', v_user::text,
    null, null, null, jsonb_build_object('email', p_email), null, 'system');
end $$;

-- Lock down: these RPCs are callable only by the service role (server code).
revoke all on function
  public.app_grant_role(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text[], text[], boolean, timestamptz),
  public.app_revoke_role(uuid, uuid, text),
  public.app_approve_org_application(uuid, uuid, text),
  public.app_reject_org_application(uuid, uuid, text),
  public.app_create_invitation(uuid, uuid, citext, uuid, text, uuid, uuid, uuid, text[], text[], boolean, interval),
  public.app_accept_invitation(text, uuid),
  public.app_bootstrap_super_admin(citext)
from public, anon, authenticated;
grant execute on function
  public.app_grant_role(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text[], text[], boolean, timestamptz),
  public.app_revoke_role(uuid, uuid, text),
  public.app_approve_org_application(uuid, uuid, text),
  public.app_reject_org_application(uuid, uuid, text),
  public.app_create_invitation(uuid, uuid, citext, uuid, text, uuid, uuid, uuid, text[], text[], boolean, interval),
  public.app_accept_invitation(text, uuid),
  public.app_bootstrap_super_admin(citext)
to service_role;

-- private helpers must be callable inside RLS policies by client roles, but private schema stays unexposed.
grant usage on schema private to anon, authenticated, service_role;
revoke all on all functions in schema private from public;
grant execute on function
  private.is_platform(text),
  private.has_perm(text, uuid, uuid, uuid, uuid),
  private.has_any_event_assignment(uuid, uuid),
  private.is_org_member(uuid)
to anon, authenticated, service_role;
grant execute on all functions in schema private to service_role;
