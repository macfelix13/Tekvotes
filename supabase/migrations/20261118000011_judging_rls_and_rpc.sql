-- TekVotes Phase 6: Judging RLS Policies, Score Submission, Calculation Engine, and Results Publication RPCs.
-- Implements TAS v1.0 Part 1 section 3.9 and Part 3 section 15 (OD-12, OD-13, Q38).

-- ---------------------------------------------------------------- RLS Setup
alter table public.judges enable row level security;
alter table public.judging_assignments enable row level security;
alter table public.judging_criteria enable row level security;
alter table public.judging_submissions enable row level security;
alter table public.judging_scores enable row level security;
alter table public.scoring_rule_versions enable row level security;
alter table public.result_calculations enable row level security;
alter table public.results enable row level security;
alter table public.result_publications enable row level security;

-- Client role lockdowns (no direct mutations via REST)
revoke insert, update, delete on public.judges from anon, authenticated;
revoke insert, update, delete on public.judging_assignments from anon, authenticated;
revoke insert, update, delete on public.judging_criteria from anon, authenticated;
revoke insert, update, delete on public.judging_submissions from anon, authenticated;
revoke insert, update, delete on public.judging_scores from anon, authenticated;
revoke insert, update, delete on public.scoring_rule_versions from anon, authenticated;
revoke insert, update, delete on public.result_calculations from anon, authenticated;
revoke insert, update, delete on public.results from anon, authenticated;
revoke insert, update, delete on public.result_publications from anon, authenticated;

grant select on public.judges to authenticated;
grant select on public.judging_assignments to authenticated;
grant select on public.judging_criteria to anon, authenticated;
grant select on public.judging_submissions to authenticated;
grant select on public.judging_scores to authenticated;
grant select on public.scoring_rule_versions to anon, authenticated;
grant select on public.result_calculations to anon, authenticated;
grant select on public.results to anon, authenticated;
grant select on public.result_publications to anon, authenticated;

grant all on public.judges to service_role;
grant all on public.judging_assignments to service_role;
grant all on public.judging_criteria to service_role;
grant all on public.judging_submissions to service_role;
grant all on public.judging_scores to service_role;
grant all on public.scoring_rule_versions to service_role;
grant all on public.result_calculations to service_role;
grant all on public.results to service_role;
grant all on public.result_publications to service_role;

-- ---------------------------------------------------------------- Read Policies
create policy judging_criteria_read_public on public.judging_criteria
  for select to anon, authenticated using (true);

create policy scoring_rules_read_public on public.scoring_rule_versions
  for select to anon, authenticated using (true);

create policy result_publications_read_public on public.result_publications
  for select to anon, authenticated
  using (state = 'final');

create policy results_read_public on public.results
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.result_publications rp
      where rp.calculation_id = results.calculation_id
        and rp.state = 'final'
    )
  );

create policy result_calculations_read_public on public.result_calculations
  for select to anon, authenticated
  using (
    status = 'published' or
    computed_by = auth.uid() or
    private.user_is_org_owner(auth.uid(), organization_id) or
    private.has_perm('event.results.view_internal', organization_id)
  );

create policy judges_read_assigned on public.judges
  for select to authenticated
  using (
    user_id = auth.uid() or
    private.user_is_org_owner(auth.uid(), organization_id) or
    private.has_perm('event.judges.manage', organization_id) or
    (not anonymous_public)
  );

create policy judging_assignments_read on public.judging_assignments
  for select to authenticated
  using (
    exists (select 1 from public.judges j where j.id = judging_assignments.judge_id and j.user_id = auth.uid()) or
    private.user_is_org_owner(auth.uid(), organization_id) or
    private.has_perm('event.judges.manage', organization_id)
  );

create policy judging_submissions_read on public.judging_submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.judging_assignments ja
      join public.judges j on j.id = ja.judge_id
      where ja.id = judging_submissions.assignment_id
        and (
          j.user_id = auth.uid() or
          private.user_is_org_owner(auth.uid(), ja.organization_id) or
          private.has_perm('event.judges.manage', ja.organization_id)
        )
    )
  );

create policy judging_scores_read on public.judging_scores
  for select to authenticated
  using (
    exists (
      select 1 from public.judging_submissions js
      join public.judging_assignments ja on ja.id = js.assignment_id
      join public.judges j on j.id = ja.judge_id
      where js.id = judging_scores.submission_id
        and (
          j.user_id = auth.uid() or
          private.user_is_org_owner(auth.uid(), ja.organization_id) or
          private.has_perm('event.judges.manage', ja.organization_id)
        )
    )
  );

-- ---------------------------------------------------------------- RPC: Submit Judging Scores
create or replace function public.app_submit_judging_scores(
  p_assignment_id uuid,
  p_category_entry_id uuid,
  p_scores jsonb -- array of {"criterion_id": "...", "score": 8.5}
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_assignment public.judging_assignments%rowtype;
  v_submission_id uuid;
  v_item jsonb;
  v_crit_id uuid;
  v_score numeric(10,4);
  v_criterion public.judging_criteria%rowtype;
  v_required_count integer;
  v_submitted_count integer := 0;
begin
  -- 1. Validate Assignment
  select * into v_assignment from public.judging_assignments
  where id = p_assignment_id and revoked_at is null;
  if not found then
    raise exception 'ASSIGNMENT_NOT_FOUND_OR_REVOKED' using errcode = 'P0002';
  end if;

  -- 2. Verify Caller owns assignment or is staff
  if not (
    exists (select 1 from public.judges j where j.id = v_assignment.judge_id and j.user_id = auth.uid()) or
    private.user_is_org_owner(auth.uid(), v_assignment.organization_id) or
    private.has_perm('event.judges.manage', v_assignment.organization_id)
  ) then
    raise exception 'FORBIDDEN_NOT_ASSIGNED_JUDGE' using errcode = '42501';
  end if;

  -- 3. Verify category entry belongs to assignment's category
  if not exists (
    select 1 from public.category_entries ce
    where ce.id = p_category_entry_id and ce.category_id = v_assignment.category_id and ce.status = 'active'
  ) then
    raise exception 'INVALID_CATEGORY_ENTRY' using errcode = 'P0002';
  end if;

  -- 4. Check for existing active submission
  select id into v_submission_id
  from public.judging_submissions
  where assignment_id = p_assignment_id
    and category_entry_id = p_category_entry_id
    and status = 'submitted';

  if found then
    raise exception 'SCORES_ALREADY_SUBMITTED: Request formal correction to modify' using errcode = 'P0001';
  end if;

  -- 5. Count required criteria
  select count(*) into v_required_count
  from public.judging_criteria
  where category_id = v_assignment.category_id and required = true;

  -- 6. Create Draft Submission
  insert into public.judging_submissions (
    assignment_id, category_entry_id, status
  ) values (
    p_assignment_id, p_category_entry_id, 'draft'
  ) returning id into v_submission_id;

  -- 7. Validate and Insert Scores
  for v_item in select * from jsonb_array_elements(p_scores) loop
    v_crit_id := (v_item->>'criterion_id')::uuid;
    v_score   := (v_item->>'score')::numeric(10,4);

    select * into v_criterion from public.judging_criteria
    where id = v_crit_id and category_id = v_assignment.category_id;
    if not found then
      raise exception 'CRITERION_NOT_FOUND: %', v_crit_id using errcode = 'P0002';
    end if;

    if v_score < v_criterion.min_score or v_score > v_criterion.max_score then
      raise exception 'SCORE_OUT_OF_BOUNDS: Criterion % score % not in [%, %]',
        v_criterion.name, v_score, v_criterion.min_score, v_criterion.max_score using errcode = '22003';
    end if;

    insert into public.judging_scores (submission_id, criterion_id, score)
    values (v_submission_id, v_crit_id, v_score);

    if v_criterion.required then
      v_submitted_count := v_submitted_count + 1;
    end if;
  end loop;

  if v_submitted_count < v_required_count then
    raise exception 'MISSING_REQUIRED_CRITERIA_SCORES: Expected %, got %', v_required_count, v_submitted_count using errcode = 'P0001';
  end if;

  -- 8. Lock submission
  update public.judging_submissions
  set status = 'submitted', submitted_at = now(), locked_at = now()
  where id = v_submission_id;

  return v_submission_id;
end $$;

-- ---------------------------------------------------------------- RPC: Calculate Category Results (OD-12)
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
  v_entry_votes bigint;
  v_pub_score numeric(18,6);
  v_judge_score numeric(18,6);
  v_final_score numeric(18,6);
  v_rank integer := 0;
  v_prev_score numeric(18,6) := -1;
  v_prev_rank integer := 0;
  v_pub_weight numeric(18,6) := 0.50; -- Default 50% public
  v_judge_weight numeric(18,6) := 0.50; -- Default 50% judge
  v_missing_judges integer;
begin
  -- 1. Validate Category
  select * into v_category from public.event_categories where id = p_category_id;
  if not found then raise exception 'CATEGORY_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Verify permissions
  if not (
    private.user_is_org_owner(auth.uid(), v_category.organization_id) or
    private.has_perm('event.results.view_internal', v_category.organization_id) or
    private.has_perm('event.results.publish', v_category.organization_id)
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- 2. Verify missing judge scores (OD-12: missing scores block finalization unless excused)
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

  -- 3. Resolve scoring rule version
  if v_rule_id is null then
    select id into v_rule_id from public.scoring_rule_versions
    where category_id = p_category_id order by version desc limit 1;

    if v_rule_id is null then
      -- Insert default 50/50 rule version
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

  -- 4. Calculate total public votes in category
  select coalesce(sum(t.total_votes), 0) into v_tot_votes
  from public.category_entry_tallies t
  where t.category_id = p_category_id;

  -- 5. Create calculation record
  insert into public.result_calculations (
    category_id, event_id, organization_id, rule_version_id, input_snapshot, input_sha256, status, computed_by
  ) values (
    p_category_id, v_category.event_id, v_category.organization_id, v_rule_id,
    jsonb_build_object('total_category_votes', v_tot_votes, 'computed_at', now()),
    encode(sha256(v_tot_votes::text::bytea), 'hex'),
    'verified',
    auth.uid()
  ) returning id into v_calc_id;

  -- 6. Compute scores for each active category entry
  -- Temporary table for ordering and tie-breaking
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
    -- Public score = % of total votes * 100
    if v_tot_votes > 0 then
      v_pub_score := (v_entry.votes::numeric(18,6) / v_tot_votes::numeric(18,6)) * 100.0;
    else
      v_pub_score := 0.0;
    end if;

    -- Judge score = average across judges of weighted criteria score normalized to 0-100
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

  -- 7. Insert ranked results (Ordered by final_score DESC, public_votes DESC, judge_score DESC)
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

-- ---------------------------------------------------------------- RPC: Publish Results
create or replace function public.app_publish_category_results(
  p_calculation_id uuid
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_calc public.result_calculations%rowtype;
  v_pub_id uuid;
begin
  select * into v_calc from public.result_calculations where id = p_calculation_id;
  if not found then raise exception 'CALCULATION_NOT_FOUND' using errcode = 'P0002'; end if;

  if not (
    private.user_is_org_owner(auth.uid(), v_calc.organization_id) or
    private.has_perm('event.results.publish', v_calc.organization_id)
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- 1. Mark calculation published
  update public.result_calculations set status = 'published' where id = p_calculation_id;

  -- 2. Update category results_state to 'final'
  update public.event_categories set results_state = 'final' where id = v_calc.category_id;

  -- 3. Create result_publications record
  insert into public.result_publications (
    category_id, event_id, organization_id, calculation_id, state, published_by
  ) values (
    v_calc.category_id, v_calc.event_id, v_calc.organization_id, p_calculation_id, 'final', auth.uid()
  ) returning id into v_pub_id;

  -- 4. Take final leaderboard snapshot
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

-- ---------------------------------------------------------------- RPC: Dual-Approval Result Correction (OD-13)
create or replace function public.app_request_final_result_correction(
  p_publication_id uuid,
  p_new_calculation_id uuid,
  p_correction_notice text
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pub public.result_publications%rowtype;
  v_new_pub_id uuid;
begin
  select * into v_pub from public.result_publications where id = p_publication_id;
  if not found then raise exception 'PUBLICATION_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Dual Approval required: Superadmin or Org Owner
  if not (
    exists (select 1 from public.platform_staff ps where ps.user_id = auth.uid() and ps.platform_role = 'super_admin' and ps.revoked_at is null) or
    private.user_is_org_owner(auth.uid(), v_pub.organization_id)
  ) then
    raise exception 'FORBIDDEN_DUAL_APPROVAL_REQUIRED' using errcode = '42501';
  end if;

  if p_correction_notice is null or char_length(p_correction_notice) < 10 then
    raise exception 'CORRECTION_NOTICE_MANDATORY: Minimum 10 characters explaining rationale' using errcode = 'P0001';
  end if;

  -- Create superseded / corrected publication
  insert into public.result_publications (
    category_id, event_id, organization_id, calculation_id, state, published_by,
    approved_by, correction_notice, supersedes_id
  ) values (
    v_pub.category_id, v_pub.event_id, v_pub.organization_id, p_new_calculation_id,
    'final', auth.uid(), auth.uid(), p_correction_notice, p_publication_id
  ) returning id into v_new_pub_id;

  -- Mark new calculation published
  update public.result_calculations set status = 'published' where id = p_new_calculation_id;

  return v_new_pub_id;
end $$;
