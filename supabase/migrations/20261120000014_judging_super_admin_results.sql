-- TekVotes Phase 12: Allow platform super_admin to calculate and publish category results
-- alongside organization owners and permitted staff.

create or replace function public.app_calculate_category_results(
  p_category_id uuid,
  p_rule_version_id uuid default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_category public.event_categories%rowtype;
  v_rule_id uuid := p_rule_version_id;
  v_calc_id uuid;
  v_tot_votes bigint;
  v_entry record;
  v_pub_score numeric(18,6);
  v_judge_score numeric(18,6);
  v_final_score numeric(18,6);
  v_rank integer := 0;
  v_pub_weight numeric(18,6) := 0.50;
  v_judge_weight numeric(18,6) := 0.50;
  v_missing_judges integer;
  v_is_super boolean := false;
begin
  select * into v_category from public.event_categories where id = p_category_id;
  if not found then raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002'; end if;

  select exists (
    select 1 from public.platform_staff ps
    where ps.user_id = auth.uid() and ps.platform_role = 'super_admin' and ps.revoked_at is null
  ) into v_is_super;

  if not (
    v_is_super or
    private.user_is_org_owner(auth.uid(), v_category.organization_id) or
    private.has_perm('event.results.view_internal', v_category.organization_id) or
    private.has_perm('event.results.publish', v_category.organization_id)
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select count(distinct ja.id) into v_missing_judges
  from public.judging_assignments ja
  cross join public.category_entries ce
  left join public.judging_submissions js
    on js.assignment_id = ja.id and js.category_entry_id = ce.id and js.status = 'submitted'
  where ja.category_id = p_category_id
    and ja.revoked_at is null
    and ce.category_id = p_category_id
    and ce.status = 'active'
    and js.id is null;

  if v_missing_judges > 0 then
    raise exception 'MISSING_JUDGE_SCORES: % judge assignment submissions pending', v_missing_judges using errcode = 'P0001';
  end if;

  if v_rule_id is null then
    select id into v_rule_id from public.scoring_rule_versions
    where category_id = p_category_id order by version desc limit 1;

    if v_rule_id is null then
      insert into public.scoring_rule_versions (
        category_id, version, definition, definition_sha256, created_by
      ) values (
        p_category_id, 1,
        '{"public_weight_bps": 5000, "judge_weight_bps": 5000, "tie_breaker": ["public_votes", "judge_score"]}'::jsonb,
        encode(sha256('default'::bytea), 'hex'),
        auth.uid()
      ) returning id into v_rule_id;
    end if;
  end if;

  select coalesce(sum(t.total_votes), 0) into v_tot_votes
  from public.category_entry_tallies t
  where t.category_id = p_category_id;

  insert into public.result_calculations (
    category_id, event_id, organization_id, rule_version_id, input_snapshot, input_sha256, status, computed_by
  ) values (
    p_category_id, v_category.event_id, v_category.organization_id, v_rule_id,
    jsonb_build_object('total_category_votes', v_tot_votes, 'computed_at', now()),
    encode(sha256(v_tot_votes::text::bytea), 'hex'),
    'verified',
    auth.uid()
  ) returning id into v_calc_id;

  create temp table _tmp_entry_scores (
    category_entry_id uuid,
    public_votes bigint,
    pub_score numeric(18,6),
    judge_score numeric(18,6),
    final_score numeric(18,6)
  ) on commit drop;

  for v_entry in (
    select ce.id as entry_id,
           coalesce(t.total_votes, 0) as votes
    from public.category_entries ce
    left join public.category_entry_tallies t on t.category_entry_id = ce.id
    where ce.category_id = p_category_id and ce.status = 'active'
  ) loop
    if v_tot_votes > 0 then
      v_pub_score := (v_entry.votes::numeric(18,6) / v_tot_votes::numeric(18,6)) * 100.0;
    else
      v_pub_score := 0.0;
    end if;

    select coalesce(avg(j_total.judge_total), 0.0) into v_judge_score
    from (
      select js.assignment_id,
             sum( (s.score / jc.max_score) * 100.0 * (jc.weight_bps::numeric(18,6) / 10000.0) ) as judge_total
      from public.judging_submissions js
      join public.judging_scores s on s.submission_id = js.id
      join public.judging_criteria jc on jc.id = s.criterion_id
      where js.category_entry_id = v_entry.entry_id and js.status = 'submitted'
      group by js.assignment_id
    ) j_total;

    v_final_score := (v_pub_score * v_pub_weight) + (v_judge_score * v_judge_weight);

    insert into _tmp_entry_scores values (v_entry.entry_id, v_entry.votes, v_pub_score, v_judge_score, v_final_score);
  end loop;

  for v_entry in (
    select * from _tmp_entry_scores
    order by final_score desc, public_votes desc, judge_score desc
  ) loop
    v_rank := v_rank + 1;

    insert into public.results (
      calculation_id, category_entry_id, rank, final_score, public_vote_score, judge_aggregate_score,
      components, tie_break_trace
    ) values (
      v_calc_id, v_entry.category_entry_id, v_rank, v_entry.final_score, v_entry.pub_score, v_entry.judge_score,
      jsonb_build_object('public_votes', v_entry.public_votes, 'total_votes', v_tot_votes),
      jsonb_build_array('rank_assigned_' || v_rank)
    );
  end loop;

  return v_calc_id;
end $$;

create or replace function public.app_publish_category_results(
  p_calculation_id uuid
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_calc public.result_calculations%rowtype;
  v_pub_id uuid;
  v_is_super boolean := false;
begin
  select * into v_calc from public.result_calculations where id = p_calculation_id;
  if not found then raise exception 'CALCULATION_NOT_FOUND' using errcode = 'P0002'; end if;

  select exists (
    select 1 from public.platform_staff ps
    where ps.user_id = auth.uid() and ps.platform_role = 'super_admin' and ps.revoked_at is null
  ) into v_is_super;

  if not (
    v_is_super or
    private.user_is_org_owner(auth.uid(), v_calc.organization_id) or
    private.has_perm('event.results.publish', v_calc.organization_id)
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.result_calculations set status = 'published' where id = p_calculation_id;
  update public.event_categories set results_state = 'final' where id = v_calc.category_id;

  insert into public.result_publications (
    category_id, event_id, organization_id, calculation_id, state, published_by
  ) values (
    v_calc.category_id, v_calc.event_id, v_calc.organization_id, p_calculation_id, 'final', auth.uid()
  ) returning id into v_pub_id;

  insert into public.leaderboard_snapshots (
    category_id, event_id, organization_id, results_state, visibility_mode, payload, published
  )
  select v_calc.category_id, v_calc.event_id, v_calc.organization_id, 'final', 'counts', jsonb_agg(
    jsonb_build_object(
      'rank', r.rank,
      'category_entry_id', r.category_entry_id,
      'final_score', r.final_score,
      'public_vote_score', r.public_vote_score,
      'judge_aggregate_score', r.judge_aggregate_score
    ) order by r.rank asc
  ), true
  from public.results r
  where r.calculation_id = p_calculation_id;

  return v_pub_id;
end $$;
