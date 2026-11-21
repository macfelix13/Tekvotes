import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const U = {
  superAdmin: "00000000-0000-0000-0000-0000000000a1",
  aliceOwner: "00000000-0000-0000-0000-0000000000b1",
};

let db: PGlite;
let orgId: string;
let eventId: string;
let categoryId: string;
let categoryEntryId: string;
let voterId: string;

const q = async <T = Record<string, string>>(sql: string, p: unknown[] = []): Promise<T[]> =>
  (await db.query<T>(sql, p)).rows;

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

  for (const [id, email] of [
    [U.superAdmin, "sa@tekvotes.test"],
    [U.aliceOwner, "alice@tekvotes.test"],
  ]) {
    await q(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  }
  await q(`select public.app_bootstrap_super_admin('sa@tekvotes.test')`);

  const appRows = await q(
    `insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
     values ($1, 'Alice', 'alice@tekvotes.test', 'Test Org') returning id`,
    [U.aliceOwner]
  );
  const orgRows = await q(
    `select public.app_approve_org_application($1, $2, 'test-org-p17') as id`,
    [appRows[0].id, U.superAdmin]
  );
  orgId = orgRows[0].id;

  // Event with custom 15% commission (1500 bps) set prior to approval
  const evRows = await q(
    `insert into public.events (organization_id, slug, public_code, name, approval_status, voting_status, commission_bps, created_by)
     values ($1, 'p17-event', 'P17E', 'Phase 17 Event', 'approved', 'active', 1500, $2) returning id`,
    [orgId, U.aliceOwner]
  );
  eventId = evRows[0].id;

  const catRows = await q(
    `insert into public.event_categories (event_id, organization_id, name, slug, unit_price_minor, results_state)
     values ($1, $2, 'Main', 'main', 100, 'live') returning id`,
    [eventId, orgId]
  );
  categoryId = catRows[0].id;

  const conRows = await q(
    `insert into public.contestants (organization_id, display_name, created_by)
     values ($1, 'Ama Test', $2) returning id`,
    [orgId, U.aliceOwner]
  );
  const entRows = await q(
    `insert into public.contestant_entries (event_id, organization_id, contestant_id, contestant_number, public_code, status, registered_by)
     values ($1, $2, $3, 1, 'AMA01', 'approved', $4) returning id`,
    [eventId, orgId, conRows[0].id, U.aliceOwner]
  );
  const ceRows = await q(
    `insert into public.category_entries (event_id, organization_id, category_id, entry_id, status)
     values ($1, $2, $3, $4, 'active') returning id`,
    [eventId, orgId, categoryId, entRows[0].id]
  );
  categoryEntryId = ceRows[0].id;

  const voterRows = await q(
    `insert into public.voters (phone_e164, email) values ('+233240001122', 'voter@tekvotes.test') returning id`
  );
  voterId = voterRows[0].id;
});

describe("Phase 17: Per-Event Commission, Settlements & Nominee Visibility", () => {
  it("snapshots event commission_bps (15%), releases closed funds, and completes payout request", async () => {
    // 1. Create order for 10 votes @ GHS 1.00 = 1000 minor base + 20 minor surcharge
    const ordRows = await q<{ id: string }>(
      `select public.app_create_voting_order($1, $2, 'custom', null, 1000, 20, 'TV-P17-001') as id`,
      [voterId, categoryEntryId]
    );
    const orderId = ordRows[0].id;

    const snap = await q<{ commission_bps: number }>(
      `select commission_bps from public.voting_orders where id = $1`,
      [orderId]
    );
    expect(Number(snap[0].commission_bps)).toBe(1500);

    // 2. Fulfill payment -> 15% of 1000 = 150 commission, 850 pending escrow
    const okRows = await q<{ ok: boolean }>(
      `select public.app_process_payment_success($1, 'ps-p17-1', 15, 'mobile_money', '{}'::jsonb) as ok`,
      [orderId]
    );
    expect(okRows[0].ok).toBe(true);

    // 3. Close event & release escrow to available balance (850 minor)
    await q(`update public.events set voting_status = 'closed' where id = $1`, [eventId]);
    const relRows = await q<{ released: string }>(
      `select public.app_release_closed_event_funds($1, $2) as released`,
      [eventId, U.superAdmin]
    );
    expect(Number(relRows[0].released)).toBe(850);

    // 4. Reject over-withdrawal request (> 850 minor)
    await expect(
      q(
        `select public.app_request_settlement($1, $2, 900, 'mobile_money', 'MTN MoMo', '0241112233', 'Alice Owner')`,
        [orgId, U.aliceOwner]
      )
    ).rejects.toThrow(/INSUFFICIENT_AVAILABLE_BALANCE/);

    // 5. Submit valid withdrawal request for full 850 minor
    const reqRows = await q<{ id: string }>(
      `select public.app_request_settlement($1, $2, 850, 'mobile_money', 'MTN MoMo', '0241112233', 'Alice Owner') as id`,
      [orgId, U.aliceOwner]
    );
    const requestId = reqRows[0].id;

    // 6. List via app_list_settlement_requests RPC
    const listed = await q<{ id: string; amount_minor: string; status: string; masked_account: string }>(
      `select id, amount_minor, status, masked_account from public.app_list_settlement_requests($1)`,
      [orgId]
    );
    expect(listed).toHaveLength(1);
    expect(Number(listed[0].amount_minor)).toBe(850);
    expect(listed[0].status).toBe("requested");
    expect(listed[0].masked_account).toContain("2233");

    // 7. Super Admin completes payout -> available_to_settle_minor drops to 0
    await q(
      `select public.app_process_settlement_payout($1, $2, 'complete', 'MOMO-REF-99', 'Paid')`,
      [requestId, U.superAdmin]
    );

    const funds = await q<{ available_to_settle_minor: string }>(
      `select available_to_settle_minor from public.v_org_funds where organization_id = $1`,
      [orgId]
    );
    expect(Number(funds[0].available_to_settle_minor)).toBe(0);
  });

  it("supports independent contestant_results_visible toggle on event_categories", async () => {
    const initial = await q<{ contestant_results_visible: boolean }>(
      `select contestant_results_visible from public.event_categories where id = $1`,
      [categoryId]
    );
    expect(initial[0].contestant_results_visible).toBe(true);

    await q(`update public.event_categories set contestant_results_visible = false where id = $1`, [categoryId]);
    const updated = await q<{ contestant_results_visible: boolean; results_state: string }>(
      `select contestant_results_visible, results_state from public.event_categories where id = $1`,
      [categoryId]
    );
    expect(updated[0].contestant_results_visible).toBe(false);
    expect(updated[0].results_state).toBe("live");
  });
});
