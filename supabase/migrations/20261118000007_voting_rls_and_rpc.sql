-- TekVotes Phase 4: Voting Engine RLS Policies and Credit Execution Logic.
-- Implements TAS v1.0 Part 2 sections 7, 9, 13, 14.

-- ---------------------------------------------------------------- enable RLS
alter table public.voters                   enable row level security;
alter table public.voter_otp_challenges     enable row level security;
alter table public.voter_sessions           enable row level security;
alter table public.voter_favourites         enable row level security;
alter table public.voting_orders            enable row level security;
alter table public.vote_ledger              enable row level security;
alter table public.category_entry_tallies   enable row level security;
alter table public.leaderboard_snapshots    enable row level security;

-- ---------------------------------------------------------------- grants
grant select on public.voter_favourites       to authenticated;
grant select on public.voting_orders          to authenticated;
grant select on public.vote_ledger            to authenticated;
grant select on public.category_entry_tallies to authenticated;
grant select on public.leaderboard_snapshots  to anon, authenticated;

grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------- policies: voter favourites
create policy voter_fav_read on public.voter_favourites for select to authenticated
  using (
    exists (
      select 1 from public.voters v where v.id = voter_id and v.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------- policies: voting orders
create policy orders_self_read on public.voting_orders for select to authenticated
  using (
    exists (
      select 1 from public.voters v where v.id = voter_id and v.user_id = (select auth.uid())
    )
    or private.is_platform()
    or private.has_perm('event.results.view_internal', organization_id, event_id, category_id)
  );

-- ---------------------------------------------------------------- policies: vote ledger
create policy vl_staff_read on public.vote_ledger for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.results.view_internal', organization_id, event_id, category_id)
    or private.has_perm('entry.stats.view', organization_id, event_id, category_id, (
      select ce.entry_id from public.category_entries ce where ce.id = category_entry_id
    ))
  );

-- ---------------------------------------------------------------- policies: tallies
create policy tallies_staff_read on public.category_entry_tallies for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.results.view_internal', organization_id, event_id, category_id)
    or private.has_perm('entry.stats.view', organization_id, event_id, category_id, (
      select ce.entry_id from public.category_entries ce where ce.id = category_entry_id
    ))
  );

-- ---------------------------------------------------------------- policies: leaderboard snapshots
create policy lb_snapshots_public on public.leaderboard_snapshots for select to anon, authenticated
  using (
    published and results_state in ('live', 'final')
  );

create policy lb_snapshots_staff on public.leaderboard_snapshots for select to authenticated
  using (
    private.is_platform()
    or private.has_perm('event.results.view_internal', organization_id, event_id, category_id)
  );

-- ---------------------------------------------------------------- RPC: Create Voting Order
create or replace function public.app_create_voting_order(
  p_voter_id uuid,
  p_category_entry_id uuid,
  p_pricing_mode text,
  p_package_id uuid default null,
  p_custom_base_amount_minor bigint default null,
  p_surcharge_minor bigint default 0,
  p_order_reference text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ce record;
  v_votes integer;
  v_base_amount bigint;
  v_unit_price bigint;
  v_ref text;
  v_order_id uuid;
begin
  -- 1. Validate Category Entry & Parent Event State
  select
    ce.id as ce_id, ce.category_id, ce.event_id, ce.organization_id, ce.status as ce_status,
    c.voting_enabled, c.unit_price_minor, c.currency as cat_currency, c.min_votes, c.max_votes,
    e.approval_status, e.voting_status, e.voting_opens_at, e.voting_closes_at
  into v_ce
  from public.category_entries ce
  join public.event_categories c on c.id = ce.category_id
  join public.events e on e.id = ce.event_id
  where ce.id = p_category_entry_id;

  if not found then raise exception 'CATEGORY_ENTRY_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_ce.ce_status <> 'active' then raise exception 'ENTRY_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if not v_ce.voting_enabled then raise exception 'VOTING_DISABLED_IN_CATEGORY' using errcode = 'P0001'; end if;
  if v_ce.approval_status <> 'approved' then raise exception 'EVENT_NOT_APPROVED_FOR_VOTING' using errcode = 'P0001'; end if;
  if v_ce.voting_status <> 'active' then raise exception 'EVENT_VOTING_NOT_ACTIVE' using errcode = 'P0001'; end if;

  if v_ce.voting_opens_at is not null and now() < v_ce.voting_opens_at then
    raise exception 'VOTING_NOT_YET_OPEN' using errcode = 'P0001';
  end if;
  if v_ce.voting_closes_at is not null and now() >= v_ce.voting_closes_at then
    raise exception 'VOTING_ALREADY_CLOSED' using errcode = 'P0001';
  end if;

  -- 2. Price and whole votes computation
  v_unit_price := v_ce.unit_price_minor;

  if p_pricing_mode = 'package' then
    if p_package_id is null then raise exception 'PACKAGE_ID_REQUIRED' using errcode = 'P0001'; end if;
    select votes, price_minor into v_votes, v_base_amount
    from public.vote_packages
    where id = p_package_id and category_id = v_ce.category_id and active;

    if not found then raise exception 'PACKAGE_NOT_FOUND_OR_INACTIVE' using errcode = 'P0002'; end if;
  elsif p_pricing_mode = 'custom' then
    if p_custom_base_amount_minor is null or p_custom_base_amount_minor <= 0 then
      raise exception 'INVALID_CUSTOM_AMOUNT' using errcode = 'P0001';
    end if;

    -- Enforce exact whole votes: modulo must equal zero (Q33)
    if (p_custom_base_amount_minor % v_unit_price) <> 0 then
      raise exception 'NOT_WHOLE_VOTES: Custom amount must produce an exact whole number of votes' using errcode = 'P0001';
    end if;

    v_votes := p_custom_base_amount_minor / v_unit_price;
    v_base_amount := p_custom_base_amount_minor;

    if v_ce.min_votes is not null and v_votes < v_ce.min_votes then
      raise exception 'VOTES_BELOW_MINIMUM: Minimum is % votes', v_ce.min_votes using errcode = 'P0001';
    end if;
    if v_ce.max_votes is not null and v_votes > v_ce.max_votes then
      raise exception 'VOTES_ABOVE_MAXIMUM: Maximum is % votes', v_ce.max_votes using errcode = 'P0001';
    end if;
  else
    raise exception 'INVALID_PRICING_MODE' using errcode = 'P0001';
  end if;

  v_ref := coalesce(p_order_reference, 'TV-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(gen_random_uuid()::text, 1, 8)));

  insert into public.voting_orders (
    reference, organization_id, event_id, category_id, category_entry_id, voter_id,
    pricing_mode, snapshot_package_id, snapshot_unit_price_minor, snapshot_votes,
    snapshot_base_amount_minor, snapshot_surcharge_minor, snapshot_amount_minor,
    snapshot_currency, expires_at
  ) values (
    v_ref, v_ce.organization_id, v_ce.event_id, v_ce.category_id, v_ce.ce_id, p_voter_id,
    p_pricing_mode, p_package_id, v_unit_price, v_votes,
    v_base_amount, coalesce(p_surcharge_minor, 0), v_base_amount + coalesce(p_surcharge_minor, 0),
    v_ce.cat_currency, now() + interval '15 minutes'
  )
  returning id into v_order_id;

  return v_order_id;
end $$;

-- ---------------------------------------------------------------- RPC: Credit Paid Order
create or replace function public.app_credit_paid_order(
  p_order_id uuid,
  p_idempotency_key text default null
) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.voting_orders%rowtype;
  v_event public.events%rowtype;
  v_ce public.category_entries%rowtype;
  v_ledger_id bigint;
  v_idem text;
begin
  -- 1. Lock Order Row to prevent parallel credit executions
  select * into v_order from public.voting_orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_order.status = 'credited' then
    return true; -- Idempotent success (already credited)
  end if;

  -- 2. Advisory Lock on Voter & Entry to serialize hard-limit enforcement
  perform pg_advisory_xact_lock(hashtext('lim:voter:' || v_order.voter_id::text || ':' || v_order.event_id::text));
  perform pg_advisory_xact_lock(hashtext('lim:entry:' || v_order.category_entry_id::text));

  -- 3. Gate Re-Check (with confirmed ND-01 180s Grace Window)
  select * into v_event from public.events where id = v_order.event_id;
  select * into v_ce from public.category_entries where id = v_order.category_entry_id;

  if v_event.approval_status <> 'approved'
     or v_ce.status <> 'active'
     or v_event.voting_status in ('paused', 'cancelled')
     or not (
       (v_event.voting_status = 'active' and (v_event.voting_closes_at is null or now() < v_event.voting_closes_at))
       or
       (v_event.voting_status in ('active', 'closed') and v_event.voting_closes_at is not null and v_order.created_at <= v_event.voting_closes_at and now() <= (v_event.voting_closes_at + interval '180 seconds'))
     )
  then
    -- Gate failed: Order was paid but cannot be credited due to closure/pause/revocation
    update public.voting_orders set status = 'paid_uncredited' where id = p_order_id;
    return false;
  end if;

  v_idem := coalesce(p_idempotency_key, 'credit:' || p_order_id::text);

  -- 4. Insert into append-only Vote Ledger
  insert into public.vote_ledger (
    organization_id, event_id, category_id, category_entry_id,
    entry_type, votes, order_id, idempotency_key
  ) values (
    v_order.organization_id, v_order.event_id, v_order.category_id, v_order.category_entry_id,
    'credit', v_order.snapshot_votes, v_order.id, v_idem
  )
  returning id into v_ledger_id;

  -- 5. Synchronize Derived Category Entry Tally
  insert into public.category_entry_tallies (
    category_entry_id, category_id, event_id, organization_id, total_votes, last_ledger_id, updated_at
  ) values (
    v_order.category_entry_id, v_order.category_id, v_order.event_id, v_order.organization_id,
    v_order.snapshot_votes, v_ledger_id, now()
  )
  on conflict (category_entry_id) do update set
    total_votes = public.category_entry_tallies.total_votes + excluded.total_votes,
    last_ledger_id = excluded.last_ledger_id,
    updated_at = now();

  -- 6. Mark Order Credited
  update public.voting_orders
  set status = 'credited', credited_at = now()
  where id = p_order_id;

  return true;
end $$;

-- ---------------------------------------------------------------- lock down execution
revoke all on function
  public.app_create_voting_order(uuid, uuid, text, uuid, bigint, bigint, text),
  public.app_credit_paid_order(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.app_create_voting_order(uuid, uuid, text, uuid, bigint, bigint, text),
  public.app_credit_paid_order(uuid, text)
to service_role;
