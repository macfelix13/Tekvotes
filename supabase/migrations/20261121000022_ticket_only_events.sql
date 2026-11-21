-- TekVotes Phase 22: Support Ticket-Only Events (e.g., Movie Premieres, Concerts, Shows with No Contestants)
-- Updates app_submit_event_for_approval so an event can be submitted for approval when it has EITHER:
--   1. At least one category + at least one approved contestant (Voting Competition), OR
--   2. At least one active ticket tier (Ticket-Only Event), OR
--   3. event_type = 'ticketed_event'.

create or replace function public.app_submit_event_for_approval(
  p_actor uuid, p_event_id uuid, p_org_id uuid
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_event public.events%rowtype;
  v_has_contestants boolean;
  v_has_tickets boolean;
begin
  if not (private.user_has_perm(p_actor, 'event.submit_for_approval', p_org_id, p_event_id)
          or private.user_is_platform(p_actor, 'super_admin')) then
    raise exception 'NOT_AUTHORISED: lacks event.submit_for_approval' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id and organization_id = p_org_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002'; end if;

  v_has_contestants := exists (
    select 1 from public.contestant_entries where event_id = p_event_id and status = 'approved'
  );
  v_has_tickets := exists (
    select 1 from public.event_ticket_tiers where event_id = p_event_id and active = true
  );

  if not v_has_contestants and not v_has_tickets and v_event.event_type <> 'ticketed_event' then
    raise exception 'NO_CONTESTANTS_OR_TICKETS: Add at least one contestant (for voting) or one ticket tier (for ticketing) before submitting for approval' using errcode = 'P0001';
  end if;

  update public.events set approval_status = 'submitted', updated_at = now() where id = p_event_id;

  insert into public.event_approvals (event_id, organization_id, submitted_by, decision)
  values (p_event_id, p_org_id, p_actor, 'submitted');

  insert into public.event_status_history (event_id, organization_id, dimension, from_status, to_status, actor_id)
  values (p_event_id, p_org_id, 'approval', v_event.approval_status::text, 'submitted', p_actor);

  perform private.write_audit(p_actor, 'event.submit_approval', 'events', p_event_id::text, p_org_id, p_event_id);
end $$;
