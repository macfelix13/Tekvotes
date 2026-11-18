import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const U = {
  root: "00000000-0000-0000-0000-0000000000a1",
  alice: "00000000-0000-0000-0000-0000000000b1", // Owner of Org A
  bob: "00000000-0000-0000-0000-0000000000b2", // Owner of Org B
  dave: "00000000-0000-0000-0000-0000000000c2", // Event Manager of Event 1
  erin: "00000000-0000-0000-0000-0000000000c3", // Contestant Manager of Entry 1
  mallory: "00000000-0000-0000-0000-0000000000d1", // Visitor / Random user
};

let db: PGlite;
let orgA: string;
let orgB: string;
let event1: string;
let event2: string;
let cat1: string;
let cat2: string;
let contestant1: string;
let contestant2: string;
let entry1: string;
let entry2: string;
const tpl: Record<string, string> = {};

async function run(role: "anon" | "authenticated" | "service_role", uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`);
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
    return (await db.query(sql, params)).rows as Record<string, any>[];
  } finally {
    await db.exec("reset role");
  }
}
const asUser = (uid: string, sql: string, p: unknown[] = []) => run("authenticated", uid, sql, p);
const asAnon = (sql: string, p: unknown[] = []) => run("anon", null, sql, p);
const svc = (sql: string, p: unknown[] = []) => run("service_role", null, sql, p);
const sup = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, any>[];

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

  for (const t of await sup(`select id, key from public.role_templates where organization_id is null`)) {
    tpl[t.key] = t.id;
  }

  await svc(`select public.app_bootstrap_super_admin('root@example.com')`);

  // Create Organizations A & B
  const appA = (await sup(`insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
    values ($1,'Alice','alice@example.com','Org Alpha') returning id`, [U.alice]))[0].id;
  orgA = (await svc(`select public.app_approve_org_application($1,$2,'org-alpha') as id`, [appA, U.root]))[0].id;

  const appB = (await sup(`insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
    values ($1,'Bob','bob@example.com','Org Beta') returning id`, [U.bob]))[0].id;
  orgB = (await svc(`select public.app_approve_org_application($1,$2,'org-beta') as id`, [appB, U.root]))[0].id;

  // Create Events for Org A and Org B
  event1 = (await sup(`insert into public.events (organization_id, slug, public_code, name, created_by)
    values ($1, 'pageant-2026', 'EVT001', 'Miss Ghana 2026', $2) returning id`, [orgA, U.alice]))[0].id;

  event2 = (await sup(`insert into public.events (organization_id, slug, public_code, name, created_by)
    values ($1, 'awards-2026', 'EVT002', 'Tech Awards 2026', $2) returning id`, [orgB, U.bob]))[0].id;

  // Categories
  cat1 = (await sup(`insert into public.event_categories (event_id, organization_id, name, slug, unit_price_minor)
    values ($1, $2, 'Main Pageant', 'main', 100) returning id`, [event1, orgA]))[0].id;

  cat2 = (await sup(`insert into public.event_categories (event_id, organization_id, name, slug, unit_price_minor)
    values ($1, $2, 'Best Talent', 'talent', 150) returning id`, [event1, orgA]))[0].id;

  // Contestants (reusable identities within Org A)
  contestant1 = (await sup(`insert into public.contestants (organization_id, display_name, created_by)
    values ($1, 'Naa Mensah', $2) returning id`, [orgA, U.alice]))[0].id;

  contestant2 = (await sup(`insert into public.contestants (organization_id, display_name, created_by)
    values ($1, 'Akosua Appiah', $2) returning id`, [orgA, U.alice]))[0].id;

  // Entries
  entry1 = (await sup(`insert into public.contestant_entries (event_id, organization_id, contestant_id, contestant_number, public_code, registered_by)
    values ($1, $2, $3, 1, 'C01', $4) returning id`, [event1, orgA, contestant1, U.alice]))[0].id;

  entry2 = (await sup(`insert into public.contestant_entries (event_id, organization_id, contestant_id, contestant_number, public_code, registered_by)
    values ($1, $2, $3, 2, 'C02', $4) returning id`, [event1, orgA, contestant2, U.alice]))[0].id;

  // Contestant enters both categories in Event 1 (Q41 verified)
  await sup(`insert into public.category_entries (event_id, organization_id, category_id, entry_id)
    values ($1, $2, $3, $4), ($1, $2, $5, $4)`, [event1, orgA, cat1, entry1, cat2]);

  // Delegations: Dave is Event Manager of Event 1; Erin is Contestant Manager of Entry 1
  await svc(`select public.app_grant_role($1, $2, $3, $4, $5)`, [U.alice, U.dave, tpl.event_manager, orgA, event1]);
  await svc(`select public.app_grant_role($1, $2, $3, $4, $5, null, $6)`, [U.alice, U.erin, tpl.contestant_manager, orgA, event1, entry1]);
});

describe("Phase 3: Events & Competition Lifecycle", () => {
  it("enforces approval before voting can become active (Q48)", async () => {
    // Attempting to set voting_status='active' when approval_status='not_submitted' must fail CHECK constraint
    await expect(sup(`update public.events set voting_status = 'active' where id = $1`, [event1])).rejects.toThrow(/events_approval_voting_guard/);
  });

  it("submits event for approval and Super Admin reviews it", async () => {
    await svc(`select public.app_submit_event_for_approval($1, $2, $3)`, [U.alice, event1, orgA]);
    const ev = (await sup(`select approval_status from public.events where id = $1`, [event1]))[0];
    expect(ev.approval_status).toBe("submitted");

    // Super admin approves
    await svc(`select public.app_review_event_approval($1, $2, 'approved')`, [U.root, event1]);
    const evApproved = (await sup(`select approval_status from public.events where id = $1`, [event1]))[0];
    expect(evApproved.approval_status).toBe("approved");

    // Now voting status can become active
    await sup(`update public.events set voting_status = 'active' where id = $1`, [event1]);
  });

  it("pauses and resumes voting with audit reason (Q42)", async () => {
    await expect(svc(`select public.app_pause_event_voting($1, $2, $3, '')`, [U.alice, event1, orgA])).rejects.toThrow(/REASON_REQUIRED/);

    await svc(`select public.app_pause_event_voting($1, $2, $3, 'Emergency audit review')`, [U.alice, event1, orgA]);
    const ev = (await sup(`select voting_status, pause_reason from public.events where id = $1`, [event1]))[0];
    expect(ev.voting_status).toBe("paused");
    expect(ev.pause_reason).toBe("Emergency audit review");

    // Resume
    await svc(`select public.app_resume_event_voting($1, $2, $3, 'Audit cleared')`, [U.alice, event1, orgA]);
    const evResumed = (await sup(`select voting_status, pause_reason from public.events where id = $1`, [event1]))[0];
    expect(evResumed.voting_status).toBe("active");
    expect(evResumed.pause_reason).toBeNull();
  });

  it("revoking approval automatically pauses an active event", async () => {
    await svc(`select public.app_review_event_approval($1, $2, 'revoked', 'Suspicious activity detected')`, [U.root, event1]);
    const ev = (await sup(`select approval_status, voting_status, pause_reason from public.events where id = $1`, [event1]))[0];
    expect(ev.approval_status).toBe("revoked");
    expect(ev.voting_status).toBe("paused");
    expect(ev.pause_reason).toBe("Suspicious activity detected");

    // Re-approve to continue tests
    await svc(`select public.app_review_event_approval($1, $2, 'approved')`, [U.root, event1]);
    await svc(`select public.app_resume_event_voting($1, $2, $3, 'Cleared')`, [U.alice, event1, orgA]);
  });
});

describe("Phase 3: Contestants, Multiple Categories & Isolation", () => {
  it("allows a contestant to enter multiple categories in the same event (Q41)", async () => {
    const cats = await sup(`select category_id from public.category_entries where entry_id = $1`, [entry1]);
    expect(cats.length).toBe(2);
  });

  it("enforces tenant boundaries between Org A and Org B", async () => {
    // Org A cannot see Org B's contestants
    const orgAContestants = await asUser(U.alice, `select id, organization_id from public.contestants`);
    expect(orgAContestants.every((c) => c.organization_id === orgA)).toBe(true);
  });

  it("restricts contestant manager to assigned entry only (Q35, least privilege)", async () => {
    // Erin is manager of Entry 1 only
    expect(await asUser(U.erin, `select id from public.contestant_entries where id = $1`, [entry1])).toHaveLength(1);

    // Erin cannot see Entry 2 while event is unpublished
    await sup(`update public.events set publication_status = 'unpublished' where id = $1`, [event1]);
    expect(await asUser(U.erin, `select id from public.contestant_entries where id = $1`, [entry2])).toHaveLength(0);

    // Dave (Event Manager) can see both entries for his event
    expect(await asUser(U.dave, `select id from public.contestant_entries where event_id = $1`, [event1])).toHaveLength(2);
  });

  it("allows public to preview published events before voting is approved (OD-14)", async () => {
    // Set event to published and approval to submitted, while voting is not_started
    await sup(`update public.events set publication_status = 'published', approval_status = 'submitted', voting_status = 'not_started' where id = $1`, [event1]);

    // Public / Anon can view the event
    const publicEvents = await asAnon(`select id, name from public.events where id = $1`, [event1]);
    expect(publicEvents).toHaveLength(1);
    expect(publicEvents[0].name).toBe("Miss Ghana 2026");
  });
});
