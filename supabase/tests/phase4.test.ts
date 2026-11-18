import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const U = {
  root: "00000000-0000-0000-0000-0000000000a1",
  alice: "00000000-0000-0000-0000-0000000000b1",
  voterUser: "00000000-0000-0000-0000-0000000000d1",
};

let db: PGlite;
let orgId: string;
let eventId: string;
let categoryId: string;
let categoryEntryId: string;
let voterId: string;
let packageId: string;

const svc = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, any>[];
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

  await svc(`select public.app_bootstrap_super_admin('root@example.com')`);

  // Setup Org & Approved Active Event
  const app = (await sup(`insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
    values ($1,'Alice','alice@example.com','Org Voting') returning id`, [U.alice]))[0].id;
  orgId = (await svc(`select public.app_approve_org_application($1,$2,'org-voting') as id`, [app, U.root]))[0].id;

  eventId = (await sup(`insert into public.events (organization_id, slug, public_code, name, approval_status, voting_status, created_by)
    values ($1, 'voting-event', 'VOTE01', 'Voting Event 2026', 'approved', 'active', $2) returning id`, [orgId, U.alice]))[0].id;

  // Category with unit price = 50 pesewas (0.50 GHS)
  categoryId = (await sup(`insert into public.event_categories (event_id, organization_id, name, slug, unit_price_minor)
    values ($1, $2, 'Pageant Queen', 'queen', 50) returning id`, [eventId, orgId]))[0].id;

  // Fixed Package: 10 votes for 450 pesewas (discounted bundle)
  packageId = (await sup(`insert into public.vote_packages (category_id, event_id, organization_id, label, votes, price_minor)
    values ($1, $2, $3, '10 Votes Bundle', 10, 450) returning id`, [categoryId, eventId, orgId]))[0].id;

  // Contestant and Entry
  const contestant = (await sup(`insert into public.contestants (organization_id, display_name, created_by)
    values ($1, 'Jessica Boateng', $2) returning id`, [orgId, U.alice]))[0].id;

  const entry = (await sup(`insert into public.contestant_entries (event_id, organization_id, contestant_id, contestant_number, public_code, registered_by)
    values ($1, $2, $3, 10, 'JB10', $4) returning id`, [eventId, orgId, contestant, U.alice]))[0].id;

  categoryEntryId = (await sup(`insert into public.category_entries (event_id, organization_id, category_id, entry_id)
    values ($1, $2, $3, $4) returning id`, [eventId, orgId, categoryId, entry]))[0].id;

  // Registered Voter
  voterId = (await sup(`insert into public.voters (user_id, phone_e164, phone_verified_at)
    values ($1, '+233241234567', now()) returning id`, [U.voterUser]))[0].id;
});

describe("Phase 4: Voting Engine & Order Arithmetic", () => {
  it("enforces exact whole votes for custom amount purchases (Q33)", async () => {
    // Unit price is 50 pesewas. 125 pesewas is 2.5 votes -> must be rejected
    await expect(
      svc(`select public.app_create_voting_order($1, $2, 'custom', null, 125, 0)`, [voterId, categoryEntryId])
    ).rejects.toThrow(/NOT_WHOLE_VOTES/);

    // 150 pesewas is exactly 3 whole votes -> succeeds
    const orderId = (await svc(
      `select public.app_create_voting_order($1, $2, 'custom', null, 150, 5) as id`,
      [voterId, categoryEntryId]
    ))[0].id;

    const order = (await sup(`select * from public.voting_orders where id = $1`, [orderId]))[0];
    expect(order.snapshot_votes).toBe(3);
    expect(Number(order.snapshot_base_amount_minor)).toBe(150);
    expect(Number(order.snapshot_surcharge_minor)).toBe(5);
    expect(Number(order.snapshot_amount_minor)).toBe(155);
    expect(order.status).toBe("pending");
  });

  it("handles fixed package orders correctly (Q7)", async () => {
    const orderId = (await svc(
      `select public.app_create_voting_order($1, $2, 'package', $3, null, 10) as id`,
      [voterId, categoryEntryId, packageId]
    ))[0].id;

    const order = (await sup(`select * from public.voting_orders where id = $1`, [orderId]))[0];
    expect(order.snapshot_votes).toBe(10);
    expect(Number(order.snapshot_base_amount_minor)).toBe(450);
    expect(Number(order.snapshot_surcharge_minor)).toBe(10);
    expect(Number(order.snapshot_amount_minor)).toBe(460);
  });

  it("credits votes atomically, updates vote ledger and derived tallies", async () => {
    const orderId = (await svc(
      `select public.app_create_voting_order($1, $2, 'custom', null, 200, 0) as id`,
      [voterId, categoryEntryId]
    ))[0].id; // 200 / 50 = 4 votes

    const success = (await svc(`select public.app_credit_paid_order($1) as ok`, [orderId]))[0].ok;
    expect(success).toBe(true);

    // Order status is credited
    const order = (await sup(`select status, credited_at from public.voting_orders where id = $1`, [orderId]))[0];
    expect(order.status).toBe("credited");
    expect(order.credited_at).not.toBeNull();

    // Vote Ledger recorded credit
    const ledger = await sup(`select votes, entry_type from public.vote_ledger where order_id = $1`, [orderId]);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].votes).toBe(4);
    expect(ledger[0].entry_type).toBe("credit");

    // Tallies updated to 4 votes
    const tally = (await sup(`select total_votes from public.category_entry_tallies where category_entry_id = $1`, [categoryEntryId]))[0];
    expect(Number(tally.total_votes)).toBe(4);
  });

  it("is idempotent: duplicate credit executions do not create duplicate votes", async () => {
    const orderId = (await sup(`select id from public.voting_orders where status = 'credited' limit 1`))[0].id;

    // Call credit again on already credited order
    const result = (await svc(`select public.app_credit_paid_order($1) as ok`, [orderId]))[0].ok;
    expect(result).toBe(true);

    // Ledger still has exactly 1 credit for this order
    const ledger = await sup(`select id from public.vote_ledger where order_id = $1`, [orderId]);
    expect(ledger).toHaveLength(1);

    // Tally remains unchanged at 4
    const tally = (await sup(`select total_votes from public.category_entry_tallies where category_entry_id = $1`, [categoryEntryId]))[0];
    expect(Number(tally.total_votes)).toBe(4);
  });

  it("honors 3-minute grace window after scheduled close (ND-01)", async () => {
    // 1. Order created before scheduled close (set closing time in the future)
    await sup(`update public.events set voting_closes_at = now() + interval '10 seconds' where id = $1`, [eventId]);

    const orderId = (await svc(
      `select public.app_create_voting_order($1, $2, 'custom', null, 100, 0) as id`,
      [voterId, categoryEntryId]
    ))[0].id;

    // Simulate order created_at slightly earlier than close:
    await sup(`update public.voting_orders set created_at = now() - interval '20 seconds' where id = $1`, [orderId]);
    await sup(`update public.events set voting_closes_at = now() - interval '10 seconds' where id = $1`, [eventId]);

    // Payment succeeds within 180s grace window -> votes credited!
    const ok = (await svc(`select public.app_credit_paid_order($1) as ok`, [orderId]))[0].ok;
    expect(ok).toBe(true);

    // Total tally now 4 + 2 = 6
    const tally = (await sup(`select total_votes from public.category_entry_tallies where category_entry_id = $1`, [categoryEntryId]))[0];
    expect(Number(tally.total_votes)).toBe(6);
  });

  it("marks order paid_uncredited if voting was paused (ND-01 strict pause rule)", async () => {
    // Pause the event
    await sup(`update public.events set voting_status = 'paused', pause_reason = 'Investigation' where id = $1`, [eventId]);

    // Order created prior but payment webhook arrives while paused
    const orderId = (await sup(`insert into public.voting_orders (
      reference, organization_id, event_id, category_id, category_entry_id, voter_id,
      pricing_mode, snapshot_unit_price_minor, snapshot_votes, snapshot_base_amount_minor,
      snapshot_surcharge_minor, snapshot_amount_minor, snapshot_currency, expires_at
    ) values (
      'TEST-PAUSE-REF', $1, $2, $3, $4, $5,
      'custom', 50, 2, 100, 0, 100, 'GHS', now() + interval '15 minutes'
    ) returning id`, [orgId, eventId, categoryId, categoryEntryId, voterId]))[0].id;

    const ok = (await svc(`select public.app_credit_paid_order($1) as ok`, [orderId]))[0].ok;
    expect(ok).toBe(false);

    // Order marked paid_uncredited for refund review
    const order = (await sup(`select status from public.voting_orders where id = $1`, [orderId]))[0];
    expect(order.status).toBe("paid_uncredited");
  });
});
