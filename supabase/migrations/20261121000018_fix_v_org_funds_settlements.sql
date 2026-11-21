-- Fix v_org_funds so completed organizer settlement payouts reduce available_to_settle_minor.

create or replace view public.v_org_funds with (security_invoker = false) as
select
  o.id as organization_id,
  o.name as organization_name,
  o.default_currency as currency,
  coalesce(sum(ef.total_earned_pending_minor), 0) as total_earned_pending_minor,
  greatest(
    0,
    coalesce(sum(ef.available_to_settle_minor), 0) -
    coalesce(
      (select sum(st.amount_minor)
       from fin.settlements st
       where st.organization_id = o.id and st.status = 'completed'),
      0
    )
  ) as available_to_settle_minor,
  coalesce(sum(ef.in_flight_settlement_minor), 0) as in_flight_settlement_minor
from public.organizations o
left join public.v_event_funds ef on ef.organization_id = o.id
group by o.id, o.name, o.default_currency;
