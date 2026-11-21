-- TekVotes Phase 16: Separate contestant/nominee vote & leaderboard visibility control
-- alongside public leaderboard visibility on event_categories.

alter table public.event_categories
  add column if not exists contestant_results_visible boolean not null default true;
