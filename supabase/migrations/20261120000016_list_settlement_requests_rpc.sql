-- TekVotes Phase 13 fix: Expose service_role-only RPC to list fin.settlement_requests
-- without exposing schema fin over PostgREST.

create or replace function public.app_list_settlement_requests(
  p_org_id uuid default null
) returns table (
  id uuid,
  organization_id uuid,
  amount_minor bigint,
  currency char(3),
  status text,
  masked_account text,
  account_name text,
  provider_transfer_ref text,
  created_at timestamptz
) language sql security definer set search_path = public, fin, pg_temp as $$
  select
    sr.id,
    sr.organization_id,
    sr.amount_minor,
    sr.currency,
    sr.status::text,
    sd.masked_account,
    sd.account_name,
    s.provider_transfer_ref,
    sr.created_at
  from fin.settlement_requests sr
  left join fin.settlement_destinations sd on sd.id = sr.destination_id
  left join fin.settlements s on s.request_id = sr.id
  where (p_org_id is null or sr.organization_id = p_org_id)
  order by sr.created_at desc;
$$;

revoke all on function public.app_list_settlement_requests(uuid) from public, anon, authenticated;
grant execute on function public.app_list_settlement_requests(uuid) to service_role;
