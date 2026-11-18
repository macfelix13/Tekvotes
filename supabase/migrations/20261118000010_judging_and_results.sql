-- TekVotes Phase 6: Judging, Scoring Criteria, Submissions, Calculations, and Results Publication.
-- Implements TAS v1.0 Part 1 section 3.9 and Part 3 section 15.

-- ---------------------------------------------------------------- enums
create type public.submission_status as enum ('draft', 'submitted', 'superseded');
create type public.calc_status       as enum ('draft', 'verified', 'published', 'superseded');

-- ---------------------------------------------------------------- judges & assignments
create table public.judges (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete restrict,
  organization_id   uuid not null references public.organizations (id) on delete restrict,
  display_name      text not null,
  public_alias      text,
  anonymous_public  boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint judges_user_org_uq unique (user_id, organization_id)
);
create index judges_org_idx on public.judges (organization_id);

create table public.judging_assignments (
  id                uuid primary key default gen_random_uuid(),
  judge_id          uuid not null references public.judges (id) on delete restrict,
  event_id          uuid not null,
  category_id       uuid not null,
  organization_id   uuid not null,
  assigned_by       uuid not null references public.profiles (id),
  revoked_at        timestamptz,
  created_at        timestamptz not null default now(),
  constraint ja_cat_fk foreign key (category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete cascade,
  constraint ja_judge_cat_uq unique (judge_id, category_id)
);
create index ja_category_idx on public.judging_assignments (category_id);

-- ---------------------------------------------------------------- criteria
create table public.judging_criteria (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null,
  event_id          uuid not null,
  organization_id   uuid not null,
  name              text not null check (char_length(name) between 2 and 100),
  description       text,
  weight_bps        integer not null check (weight_bps between 1 and 10000),
  min_score         numeric(10,4) not null default 0.0000,
  max_score         numeric(10,4) not null default 10.0000,
  step              numeric(10,4) not null default 0.5000,
  required          boolean not null default true,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  constraint jc_cat_fk foreign key (category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete cascade,
  constraint jc_score_range check (max_score > min_score and step > 0)
);
create index jc_category_idx on public.judging_criteria (category_id, sort_order);

-- ---------------------------------------------------------------- submissions & scores
create table public.judging_submissions (
  id                     uuid primary key default gen_random_uuid(),
  assignment_id          uuid not null references public.judging_assignments (id) on delete restrict,
  category_entry_id      uuid not null,
  status                 public.submission_status not null default 'draft',
  version                integer not null default 1,
  supersedes_id          uuid references public.judging_submissions (id),
  correction_reason      text,
  correction_approved_by uuid references public.profiles (id),
  submitted_at           timestamptz,
  locked_at              timestamptz,
  created_at             timestamptz not null default now(),
  constraint js_ce_fk foreign key (category_entry_id)
    references public.category_entries (id) on delete cascade
);
create unique index js_one_active_submission on public.judging_submissions (assignment_id, category_entry_id) where status = 'submitted';

create table public.judging_scores (
  id                     uuid primary key default gen_random_uuid(),
  submission_id          uuid not null references public.judging_submissions (id) on delete cascade,
  criterion_id           uuid not null references public.judging_criteria (id) on delete restrict,
  score                  numeric(10,4) not null,
  created_at             timestamptz not null default now(),
  constraint js_sub_crit_uq unique (submission_id, criterion_id)
);
create index judging_scores_submission_idx on public.judging_scores (submission_id);

-- Lock submitted scores from direct mutation (Q38)
create or replace function private.assert_score_editable() returns trigger
language plpgsql as $$
declare
  v_status public.submission_status;
begin
  select status into v_status from public.judging_submissions where id = old.submission_id;
  if v_status in ('submitted', 'superseded') then
    raise exception 'SCORES_LOCKED: Submitted scores cannot be directly edited. Request a formal correction version' using errcode = 'P0001';
  end if;
  return old;
end $$;

create trigger trg_scores_no_mutation before update or delete on public.judging_scores
  for each row execute function private.assert_score_editable();

-- ---------------------------------------------------------------- scoring rules & calculations
create table public.scoring_rule_versions (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null,
  version           integer not null default 1,
  definition        jsonb not null default '{}'::jsonb,
  definition_sha256 text not null,
  created_by        uuid not null references public.profiles (id),
  approved_by       uuid references public.profiles (id),
  effective_at      timestamptz not null default now(),
  constraint srv_cat_ver_uq unique (category_id, version)
);

create table public.result_calculations (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null,
  event_id          uuid not null,
  organization_id   uuid not null,
  rule_version_id   uuid not null references public.scoring_rule_versions (id) on delete restrict,
  input_snapshot    jsonb not null default '{}'::jsonb,
  input_sha256      text not null,
  status            public.calc_status not null default 'draft',
  computed_by       uuid not null references public.profiles (id),
  computed_at       timestamptz not null default now(),
  constraint rc_cat_fk foreign key (category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete cascade
);
create index rc_cat_status_idx on public.result_calculations (category_id, status);

create table public.results (
  id                     uuid primary key default gen_random_uuid(),
  calculation_id         uuid not null references public.result_calculations (id) on delete cascade,
  category_entry_id      uuid not null references public.category_entries (id) on delete cascade,
  rank                   integer,
  final_score            numeric(18,6) not null default 0,
  public_vote_score      numeric(18,6) not null default 0,
  judge_aggregate_score  numeric(18,6) not null default 0,
  components             jsonb not null default '{}'::jsonb,
  tie_break_trace        jsonb not null default '[]'::jsonb,
  disqualified           boolean not null default false,
  constraint results_calc_entry_uq unique (calculation_id, category_entry_id)
);
create index results_calc_rank_idx on public.results (calculation_id, rank);

create table public.result_publications (
  id                     uuid primary key default gen_random_uuid(),
  category_id            uuid not null,
  event_id               uuid not null,
  organization_id        uuid not null,
  calculation_id         uuid not null references public.result_calculations (id) on delete restrict,
  state                  public.category_results_state not null default 'final',
  published_by           uuid not null references public.profiles (id),
  approved_by            uuid references public.profiles (id),
  published_at           timestamptz not null default now(),
  correction_notice      text,
  supersedes_id          uuid references public.result_publications (id),
  constraint rp_cat_fk foreign key (category_id, event_id, organization_id)
    references public.event_categories (id, event_id, organization_id) on delete cascade
);
