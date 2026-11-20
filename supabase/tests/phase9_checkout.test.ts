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
    `select public.app_approve_org_application($1, $2, 'test-org') as id`,
    [appRows[0].id, U.superAdmin]
  );
  orgId = orgRows[0].id;

  const evRows = await q(
    `insert into public.events (organization_id, slug, public_code, name, publication_status, created_by)
     values ($1, 'test-ev', 'TEV26', 'Test Event', 'published', $2) returning id`,
    [orgId, U.aliceOwner]
  );
  eventId = evRows[0].id;

  const catRows = await q(
    `insert into public.event_categories (event_id, organization_id, name, slug, unit_price_minor)
     values ($1, $2, 'Main Category', 'main', 100) returning id`,
    [eventId, orgId]
  );
  categoryId = catRows[0].id;

  const conRows = await q(
    `insert into public.contestants (organization_id, display_name, created_by)
     values ($1, 'Ama Test', $2) returning id`,
    [orgId, U.aliceOwner]
  );
  const entRows = await q(
    `insert into public.contestant_entries (event_id, organization_id, contestant_id, contestant_number, public_code, registered_by)
     values ($1, $2, $3, 1, 'TEV-01', $4) returning id`,
    [eventId, orgId, conRows[0].id, U.aliceOwner]
  );
  const ceRows = await q(
    `insert into public.category_entries (event_id, organization_id, category_id, entry_id)
     values ($1, $2, $3, $4) returning id`,
    [eventId, orgId, categoryId, entRows[0].id]
  );
  categoryEntryId = ceRows[0].id;

  await q(`select public.app_submit_event_for_approval($1, $2, $3)`, [U.aliceOwner, eventId, orgId]);
  await q(`select public.app_review_event_approval($1, $2, 'approved')`, [U.superAdmin, eventId]);
  await q(`update public.events set voting_status = 'active' where id = $1`, [eventId]);

  const vRows = await q(`insert into public.voters (phone_e164) values ('+233240000111') returning id`);
  voterId = vRows[0].id;
});

describe("Phase 9: Paystack Checkout & Receipt Helpers", () => {
  it("records payment attempt, processes zero-fee payment cleanly, and exposes non-PII receipt", async () => {
    const [o] = await q(
      `select public.app_create_voting_order($1, $2, 'custom', null, 500, 10) as id`,
      [voterId, categoryEntryId]
    );
    const orderId = o.id;
    const [orderRow] = await q(`select reference from public.voting_orders where id = $1`, [orderId]);

    const [attempt] = await q(
      `select public.app_record_payment_attempt($1, $2, 'acc_123', 'https://checkout.paystack.com/acc_123', 510, 'GHS') as id`,
      [orderId, orderRow.reference]
    );
    expect(attempt.id).toBeTruthy();

    const [initiated] = await q(`select status::text from public.voting_orders where id = $1`, [orderId]);
    expect(initiated.status).toBe("payment_initiated");

    // Zero provider fee must NOT violate fin.ledger_entries.amount_minor > 0
    const [proc] = await q<{ ok: boolean }>(
      `select public.app_process_payment_success($1, 'ps_txn_zerofee', 0, 'mobile_money', '{}'::jsonb) as ok`,
      [orderId]
    );
    expect(proc.ok).toBe(true);

    // Receipt lookup returns complete data and no PII (no phone_e164 / email)
    const [rec] = await q<{ data: Record<string, unknown> }>(
      `select public.app_get_receipt_by_reference($1) as data`,
      [orderRow.reference.toLowerCase()]
    );
    expect(rec.data.status).toBe("credited");
    expect(rec.data.contestantCode).toBe("TEV-01");
    expect(rec.data.votes).toBe(5);
    expect(rec.data.totalAmountMinor).toBe(510);
    expect(rec.data.ledgerId).toBeGreaterThan(0);
    expect(rec.data).not.toHaveProperty("phone");
    expect(rec.data).not.toHaveProperty("email");
  });

  it("deduplicates webhooks and keeps paid_uncredited idempotent", async () => {
    const [w1] = await q<{ webhook_id: string; already_processed: boolean }>(
      `select * from public.app_record_payment_webhook('paystack', 'charge.success', 'charge.success:999', true, '{}'::jsonb, 'abc')`
    );
    expect(w1.already_processed).toBe(false);

    await q(`select public.app_mark_webhook_status($1, 'done', null)`, [w1.webhook_id]);

    const [w2] = await q<{ webhook_id: string; already_processed: boolean }>(
      `select * from public.app_record_payment_webhook('paystack', 'charge.success', 'charge.success:999', true, '{}'::jsonb, 'abc')`
    );
    expect(w2.webhook_id).toBe(w1.webhook_id);
    expect(w2.already_processed).toBe(true);

    // Create order, pause event, then verify app_process_payment_success is idempotent on paid_uncredited
    const [o2] = await q(
      `select public.app_create_voting_order($1, $2, 'custom', null, 1000, 20) as id`,
      [voterId, categoryEntryId]
    );
    await q(`select public.app_pause_event_voting($1, $2, $3, 'audit test')`, [U.aliceOwner, eventId, orgId]);

    const [first] = await q<{ ok: boolean }>(
      `select public.app_process_payment_success($1, 'ps_txn_paused', 20, 'mobile_money', '{}'::jsonb) as ok`,
      [o2.id]
    );
    expect(first.ok).toBe(false);

    const [second] = await q<{ ok: boolean }>(
      `select public.app_process_payment_success($1, 'ps_txn_paused', 20, 'mobile_money', '{}'::jsonb) as ok`,
      [o2.id]
    );
    expect(second.ok).toBe(false);
  });
});
