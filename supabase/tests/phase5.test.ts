import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const U = {
  superAdmin: "00000000-0000-0000-0000-0000000000a1",
  financeAdmin: "00000000-0000-0000-0000-0000000000a2",
  aliceOwner: "00000000-0000-0000-0000-0000000000b1",
  voterUser: "00000000-0000-0000-0000-0000000000d1",
};

let db: PGlite;
let orgId: string;
let eventId: string;
let categoryId: string;
let categoryEntryId: string;
let voterId: string;
let orderId: string;
let destinationId: string;
let settlementReqId: string;

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

  // Super Admin & Finance Admin roles
  await svc(`select public.app_bootstrap_super_admin('superAdmin@example.com')`);
  await sup(`insert into public.platform_staff (user_id, platform_role) values ($1, 'finance_admin')`, [U.financeAdmin]);

  // Setup Org
  const app = (await sup(`insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
    values ($1,'Alice','alice@example.com','Org Finance') returning id`, [U.aliceOwner]))[0].id;
  orgId = (await svc(`select public.app_approve_org_application($1,$2,'org-finance') as id`, [app, U.superAdmin]))[0].id;

  // Setup Event & Category
  eventId = (await sup(`insert into public.events (organization_id, slug, public_code, name, approval_status, voting_status, created_by)
    values ($1, 'fin-event', 'FIN001', 'Pageant Finals 2026', 'approved', 'active', $2) returning id`, [orgId, U.aliceOwner]))[0].id;

  categoryId = (await sup(`insert into public.event_categories (event_id, organization_id, name, slug, unit_price_minor)
    values ($1, $2, 'Grand Final', 'final', 100) returning id`, [eventId, orgId]))[0].id; // 1 GHS unit price

  const contestant = (await sup(`insert into public.contestants (organization_id, display_name, created_by)
    values ($1, 'Serwaa Kobi', $2) returning id`, [orgId, U.aliceOwner]))[0].id;

  const entry = (await sup(`insert into public.contestant_entries (event_id, organization_id, contestant_id, contestant_number, public_code, registered_by)
    values ($1, $2, $3, 1, 'SK01', $4) returning id`, [eventId, orgId, contestant, U.aliceOwner]))[0].id;

  categoryEntryId = (await sup(`insert into public.category_entries (event_id, organization_id, category_id, entry_id)
    values ($1, $2, $3, $4) returning id`, [eventId, orgId, categoryId, entry]))[0].id;

  voterId = (await sup(`insert into public.voters (user_id, phone_e164, phone_verified_at)
    values ($1, '+233240000001', now()) returning id`, [U.voterUser]))[0].id;

  // Destination for settlements
  destinationId = (await sup(`insert into fin.settlement_destinations (organization_id, type, provider_recipient_code, masked_account, account_name)
    values ($1, 'mobile_money', 'RCP_123', '***4567', 'Org Media MoMo') returning id`, [orgId]))[0].id;
});

describe("Phase 5: Payments, Accounting & Double-Entry Ledger", () => {
  it("processes successful payment, posts balanced journal, and calculates commission on base vote amount (OD-01)", async () => {
    // 10 votes = 1,000 pesewas base vote, 20 pesewas surcharge, total charged = 1,020 pesewas
    orderId = (await svc(
      `select public.app_create_voting_order($1, $2, 'custom', null, 1000, 20) as id`,
      [voterId, categoryEntryId]
    ))[0].id;

    // Process Paystack success webhook (20 pesewas provider fee)
    const ok = (await svc(
      `select public.app_process_payment_success($1, 'PSTK_TXN_991', 20, 'mobile_money') as ok`,
      [orderId]
    ))[0].ok;

    expect(ok).toBe(true);

    // Verify order credited
    const order = (await sup(`select status, credited_at from public.voting_orders where id = $1`, [orderId]))[0];
    expect(order.status).toBe("credited");

    // Commission entry verified:
    // Base = 1,000; Rate = 10% (1,000 bps) -> Commission = 100 pesewas; Org Net = 900 pesewas
    const comm = (await sup(`select * from fin.commission_entries where order_id = $1`, [orderId]))[0];
    expect(Number(comm.base_vote_minor)).toBe(1000);
    expect(Number(comm.commission_minor)).toBe(100);
    expect(Number(comm.organizer_net_minor)).toBe(900);
    expect(Number(comm.voter_surcharge_minor)).toBe(20);

    // Verify Balanced Double-Entry Journal:
    // Dr A-PROV-CLEAR: 1000
    // Dr X-PROV-FEES: 20
    // Cr L-ORG-PEND: 900
    // Cr R-COMMISSION: 100
    // Cr R-FEE-RECOVERY: 20
    // Total Debits (1020) = Total Credits (1020)
    const journalId = comm.journal_id;
    const lines = await sup(`select direction, amount_minor from fin.ledger_entries where journal_id = $1`, [journalId]);
    expect(lines.length).toBe(5);

    const debits = lines.filter((l) => l.direction === "debit").reduce((acc, l) => acc + Number(l.amount_minor), 0);
    const credits = lines.filter((l) => l.direction === "credit").reduce((acc, l) => acc + Number(l.amount_minor), 0);
    expect(debits).toBe(1020);
    expect(credits).toBe(1020);
  });

  it("keeps funds in pending status and forbids organizer release before event voting ends (Owner Ruling)", async () => {
    // Event is currently active; attempting to release funds must be rejected
    await expect(
      svc(`select public.app_release_closed_event_funds($1, $2)`, [eventId, U.superAdmin])
    ).rejects.toThrow(/EVENT_NOT_CLOSED/);

    // Verify views reflect pending funds
    const eventFund = (await sup(`select total_earned_pending_minor, available_to_settle_minor from public.v_event_funds where event_id = $1`, [eventId]))[0];
    expect(Number(eventFund.total_earned_pending_minor)).toBe(900);
    expect(Number(eventFund.available_to_settle_minor)).toBe(0);
  });

  it("releases organizer funds to available balance after event voting closes", async () => {
    // Close the event voting
    await sup(`update public.events set voting_status = 'closed', voting_closes_at = now() - interval '1 minute' where id = $1`, [eventId]);

    // Release funds
    const released = (await svc(`select public.app_release_closed_event_funds($1, $2) as amt`, [eventId, U.superAdmin]))[0].amt;
    expect(Number(released)).toBe(900);

    // Event funds now show 0 pending and 900 available to settle
    const eventFund = (await sup(`select total_earned_pending_minor, available_to_settle_minor from public.v_event_funds where event_id = $1`, [eventId]))[0];
    expect(Number(eventFund.total_earned_pending_minor)).toBe(0);
    expect(Number(eventFund.available_to_settle_minor)).toBe(900);
  });

  it("enforces dual-approval and separation of duties for settlements (Q28, ND-09)", async () => {
    // Create settlement request for 900 pesewas
    settlementReqId = (await sup(`insert into fin.settlement_requests (organization_id, requested_by, amount_minor, destination_id)
      values ($1, $2, 900, $3) returning id`, [orgId, U.aliceOwner, destinationId]))[0].id;

    // 1. Requester cannot approve own settlement
    await expect(
      svc(`select public.app_review_settlement_request($1, $2, 'finance', 'approved')`, [settlementReqId, U.aliceOwner])
    ).rejects.toThrow(/SEPARATION_OF_DUTIES/);

    // 2. Finance Admin conducts finance review
    await svc(`select public.app_review_settlement_request($1, $2, 'finance', 'approved', 'Reconciliation clean')`, [settlementReqId, U.financeAdmin]);

    let req = (await sup(`select status from fin.settlement_requests where id = $1`, [settlementReqId]))[0];
    expect(req.status).toBe("finance_approved");

    // 3. Finance approver cannot also act as Super Admin approver (distinct individual required)
    await expect(
      svc(`select public.app_review_settlement_request($1, $2, 'super_admin', 'approved')`, [settlementReqId, U.financeAdmin])
    ).rejects.toThrow(/NOT_AUTHORISED|SEPARATION_OF_DUTIES/);

    // 4. Distinct Super Admin grants final approval
    await svc(`select public.app_review_settlement_request($1, $2, 'super_admin', 'approved', 'Authorized for transfer')`, [settlementReqId, U.superAdmin]);

    req = (await sup(`select status from fin.settlement_requests where id = $1`, [settlementReqId]))[0];
    expect(req.status).toBe("super_admin_approved");
  });
});
