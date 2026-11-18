import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const U = {
  superAdmin: "00000000-0000-0000-0000-0000000000a1",
  aliceOwner: "00000000-0000-0000-0000-0000000000b1",
  judge1: "00000000-0000-0000-0000-0000000000c1",
  judge2: "00000000-0000-0000-0000-0000000000c2",
  voterUser: "00000000-0000-0000-0000-0000000000d1",
};

let db: PGlite;
let orgId: string;
let eventId: string;
let categoryId: string;
let entry1Id: string;
let entry2Id: string;
let judge1Id: string;
let assign1Id: string;
let critPoiseId: string;
let critTalentId: string;

const svc = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, any>[];
const sup = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, any>[];
const asUser = async (uid: string, sql: string, p: unknown[] = []) => {
  await db.query(`set request.jwt.claim.sub = '${uid}'`);
  try {
    return (await db.query(sql, p)).rows as Record<string, any>[];
  } finally {
    await db.query(`reset request.jwt.claim.sub`);
  }
};

beforeAll(async () => {
  db = new PGlite({ extensions: { citext } });
  await db.exec(`create extension if not exists citext;`);
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create or replace function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);

  const dir = join(__dirname, "..", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }

  for (const [name, id] of Object.entries(U)) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${name}@example.com`]);
  }

  // Super Admin bootstrap
  await svc(`select public.app_bootstrap_super_admin('superAdmin@example.com')`);

  // Setup Org
  const app = (await sup(`insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
    values ($1,'Alice','alice@example.com','Org Judging') returning id`, [U.aliceOwner]))[0].id;
  orgId = (await svc(`select public.app_approve_org_application($1,$2,'org-judging') as id`, [app, U.superAdmin]))[0].id;

  // Setup Event & Category
  eventId = (await sup(`insert into public.events (organization_id, slug, public_code, name, approval_status, voting_status, created_by)
    values ($1, 'miss-ghana-2026', 'MG2026', 'Miss Ghana 2026', 'approved', 'active', $2) returning id`, [orgId, U.aliceOwner]))[0].id;

  categoryId = (await sup(`insert into public.event_categories (event_id, organization_id, name, slug, unit_price_minor)
    values ($1, $2, 'Pageant Queen', 'queen', 100) returning id`, [eventId, orgId]))[0].id;

  // Setup 2 Contestants and entries
  const c1 = (await sup(`insert into public.contestants (organization_id, display_name, created_by)
    values ($1, 'Adwoa Smart', $2) returning id`, [orgId, U.aliceOwner]))[0].id;
  const c2 = (await sup(`insert into public.contestants (organization_id, display_name, created_by)
    values ($1, 'Abena Korantemaa', $2) returning id`, [orgId, U.aliceOwner]))[0].id;

  const e1 = (await sup(`insert into public.contestant_entries (event_id, organization_id, contestant_id, contestant_number, public_code, registered_by)
    values ($1, $2, $3, 1, 'AS01', $4) returning id`, [eventId, orgId, c1, U.aliceOwner]))[0].id;
  const e2 = (await sup(`insert into public.contestant_entries (event_id, organization_id, contestant_id, contestant_number, public_code, registered_by)
    values ($1, $2, $3, 2, 'AK02', $4) returning id`, [eventId, orgId, c2, U.aliceOwner]))[0].id;

  entry1Id = (await sup(`insert into public.category_entries (category_id, event_id, organization_id, entry_id, status)
    values ($1, $2, $3, $4, 'active') returning id`, [categoryId, eventId, orgId, e1]))[0].id;
  entry2Id = (await sup(`insert into public.category_entries (category_id, event_id, organization_id, entry_id, status)
    values ($1, $2, $3, $4, 'active') returning id`, [categoryId, eventId, orgId, e2]))[0].id;

  // Setup tallies: Entry 1 gets 600 votes, Entry 2 gets 400 votes (Total 1000 votes)
  await sup(`insert into public.category_entry_tallies (category_entry_id, category_id, event_id, organization_id, total_votes)
    values ($1, $2, $3, $4, 600)`, [entry1Id, categoryId, eventId, orgId]);
  await sup(`insert into public.category_entry_tallies (category_entry_id, category_id, event_id, organization_id, total_votes)
    values ($1, $2, $3, $4, 400)`, [entry2Id, categoryId, eventId, orgId]);

  // Setup Criteria: Poise (40% weight, 0-10) and Talent (60% weight, 0-10)
  critPoiseId = (await sup(`insert into public.judging_criteria (category_id, event_id, organization_id, name, weight_bps, min_score, max_score, sort_order)
    values ($1, $2, $3, 'Poise & Elegance', 4000, 0, 10, 1) returning id`, [categoryId, eventId, orgId]))[0].id;
  critTalentId = (await sup(`insert into public.judging_criteria (category_id, event_id, organization_id, name, weight_bps, min_score, max_score, sort_order)
    values ($1, $2, $3, 'Talent Showcase', 6000, 0, 10, 2) returning id`, [categoryId, eventId, orgId]))[0].id;

  // Setup Judge 1
  judge1Id = (await sup(`insert into public.judges (user_id, organization_id, display_name)
    values ($1, $2, 'Judge Shirley Frimpong') returning id`, [U.judge1, orgId]))[0].id;

  assign1Id = (await sup(`insert into public.judging_assignments (judge_id, event_id, category_id, organization_id, assigned_by)
    values ($1, $2, $3, $4, $5) returning id`, [judge1Id, eventId, categoryId, orgId, U.aliceOwner]))[0].id;
});

describe("TekVotes Phase 6: Judging, Scoring & Results Engine", () => {
  it("submits judging scores and locks submission from direct mutation (Q38)", async () => {
    // Judge 1 scores Entry 1: Poise = 8.0, Talent = 9.0
    const subScores1 = [
      { criterion_id: critPoiseId, score: 8.0 },
      { criterion_id: critTalentId, score: 9.0 },
    ];

    const submissionId = (await asUser(U.judge1, `select public.app_submit_judging_scores($1, $2, $3::jsonb) as id`, [
      assign1Id,
      entry1Id,
      JSON.stringify(subScores1),
    ]))[0].id;

    expect(submissionId).toBeDefined();

    // Verify submission is marked 'submitted'
    const sub = (await sup(`select status, locked_at from public.judging_submissions where id = $1`, [submissionId]))[0];
    expect(sub.status).toBe("submitted");
    expect(sub.locked_at).not.toBeNull();

    // Verify attempt to mutate submitted scores directly fails due to trigger (Q38)
    await expect(
      sup(`update public.judging_scores set score = 10.0 where submission_id = $1 and criterion_id = $2`, [
        submissionId,
        critPoiseId,
      ])
    ).rejects.toThrow(/SCORES_LOCKED/);
  });

  it("blocks calculation if assigned judge scores are missing for active entries (OD-12)", async () => {
    // Entry 2 has NOT been scored by Judge 1 yet!
    await expect(
      asUser(U.aliceOwner, `select public.app_calculate_category_results($1) as id`, [categoryId])
    ).rejects.toThrow(/MISSING_JUDGE_SCORES/);
  });

  it("calculates weighted public & judge scores and determines deterministic rank (OD-12)", async () => {
    // Score Entry 2: Poise = 9.0, Talent = 7.0
    const subScores2 = [
      { criterion_id: critPoiseId, score: 9.0 },
      { criterion_id: critTalentId, score: 7.0 },
    ];

    await asUser(U.judge1, `select public.app_submit_judging_scores($1, $2, $3::jsonb) as id`, [
      assign1Id,
      entry2Id,
      JSON.stringify(subScores2),
    ]);

    // Now calculate category results
    const calcId = (await asUser(U.aliceOwner, `select public.app_calculate_category_results($1) as id`, [categoryId]))[0].id;
    expect(calcId).toBeDefined();

    const results = await sup(`select * from public.results where calculation_id = $1 order by rank asc`, [calcId]);
    expect(results.length).toBe(2);

    // Entry 1:
    // Public votes: 600 / 1000 = 60.0% -> public_score = 60.0
    // Judge 1: (8/10 * 100 * 0.4) + (9/10 * 100 * 0.6) = 32 + 54 = 86.0
    // Final score = (60 * 0.5) + (86 * 0.5) = 30 + 43 = 73.0 -> Rank 1
    const rank1 = results[0];
    expect(rank1.category_entry_id).toBe(entry1Id);
    expect(rank1.rank).toBe(1);
    expect(Number(rank1.final_score)).toBeCloseTo(73.0, 1);
    expect(Number(rank1.public_vote_score)).toBeCloseTo(60.0, 1);
    expect(Number(rank1.judge_aggregate_score)).toBeCloseTo(86.0, 1);

    // Entry 2:
    // Public votes: 400 / 1000 = 40.0% -> public_score = 40.0
    // Judge 1: (9/10 * 100 * 0.4) + (7/10 * 100 * 0.6) = 36 + 42 = 78.0
    // Final score = (40 * 0.5) + (78 * 0.5) = 20 + 39 = 59.0 -> Rank 2
    const rank2 = results[1];
    expect(rank2.category_entry_id).toBe(entry2Id);
    expect(rank2.rank).toBe(2);
    expect(Number(rank2.final_score)).toBeCloseTo(59.0, 1);
  });

  it("publishes results, snapshots leaderboard, and requires dual approval for corrections (OD-13)", async () => {
    const calc = (await sup(`select id from public.result_calculations where category_id = $1 order by computed_at desc limit 1`, [categoryId]))[0];

    // Publish results
    const pubId = (await asUser(U.aliceOwner, `select public.app_publish_category_results($1) as id`, [calc.id]))[0].id;
    expect(pubId).toBeDefined();

    // Category results_state should now be 'final'
    const cat = (await sup(`select results_state from public.event_categories where id = $1`, [categoryId]))[0];
    expect(cat.results_state).toBe("final");

    // Leaderboard snapshot of results_state = 'final' must exist
    const snap = (await sup(`select results_state, payload from public.leaderboard_snapshots where category_id = $1 and results_state = 'final'`, [categoryId]))[0];
    expect(snap).toBeDefined();
    expect(snap.payload.length).toBe(2);

    // Requesting result correction without valid notice fails
    await expect(
      asUser(U.aliceOwner, `select public.app_request_final_result_correction($1, $2, 'short') as id`, [pubId, calc.id])
    ).rejects.toThrow(/CORRECTION_NOTICE_MANDATORY/);

    // Org Owner requests correction with valid reason
    const newPubId = (await asUser(U.aliceOwner, `select public.app_request_final_result_correction($1, $2, 'Official auditor discrepancy resolved post-adjudication') as id`, [
      pubId,
      calc.id,
    ]))[0].id;
    expect(newPubId).toBeDefined();

    const correctedPub = (await sup(`select state, supersedes_id, correction_notice from public.result_publications where id = $1`, [newPubId]))[0];
    expect(correctedPub.state).toBe("final");
    expect(correctedPub.supersedes_id).toBe(pubId);
  });
});
