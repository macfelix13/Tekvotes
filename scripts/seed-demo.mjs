// Seeds clearly-labelled DEMO data into the live Supabase project.
// Idempotent: if the demo organization already exists, the script exits without changes.
//
//   node --env-file=.env.local scripts/seed-demo.mjs
//
// Flow uses the real platform RPCs (bootstrap super admin, approve org application,
// submit + review event approval) so the audit log and status history are genuine.
import { randomBytes } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const ROOT_EMAIL = process.env.SUPER_ADMIN_ROOT_EMAIL;
if (!SUPABASE_DB_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ROOT_EMAIL) {
  console.error("Missing SUPABASE_DB_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPER_ADMIN_ROOT_EMAIL");
  process.exit(1);
}

const ORG_SLUG = "tekvotes-demo";
const DAY = 24 * 60 * 60 * 1000;

const EVENTS = [
  {
    slug: "demo-pageant-2026",
    code: "DPG26",
    name: "TekVotes Demo Pageant 2026",
    type: "beauty_pageant",
    description: "Demonstration event for testing TekVotes. Not a real competition. Payments run in Paystack test mode.",
    venue: "Accra (demo)",
    live: true,
    categories: [{ name: "Demo Queen", slug: "demo-queen", priceMinor: 100 }],
    contestants: ["Ama Demo", "Efua Sample", "Akosua Test", "Abena Preview", "Adwoa Example", "Yaa Placeholder"],
  },
  {
    slug: "demo-music-awards-2026",
    code: "DMA26",
    name: "TekVotes Demo Music Awards 2026",
    type: "award_show",
    description: "Demonstration awards event with multiple categories. Not a real competition.",
    venue: "Kumasi (demo)",
    live: true,
    categories: [
      { name: "Demo Artiste of the Year", slug: "demo-artiste-of-the-year", priceMinor: 100 },
      { name: "Demo New Act", slug: "demo-new-act", priceMinor: 100 },
    ],
    contestants: ["Kofi Demo Beats", "Kwame Sample Sound", "Esi Test Vocals", "Yaw Preview Band", "Nana Example"],
  },
  {
    slug: "demo-campus-talent-2026",
    code: "DCT26",
    name: "TekVotes Demo Campus Talent 2026",
    type: "talent_show",
    description: "Demonstration 'coming soon' event: visible publicly, voting locked until Super Admin approval.",
    venue: "Cape Coast (demo)",
    live: false,
    categories: [{ name: "Demo Best Performer", slug: "demo-best-performer", priceMinor: 200 }],
    contestants: ["Kojo Demo Dance", "Afia Sample Poet", "Kwesi Test Comic"],
  },
];

const PACKAGES = [
  { label: "10 votes", votes: 10 },
  { label: "50 votes", votes: 50 },
  { label: "100 votes", votes: 100 },
];

async function ensureRootUser() {
  const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === ROOT_EMAIL.toLowerCase());
  if (existing) return existing.id;

  // Random password that is never printed. The owner sets a real one via
  // Supabase Dashboard -> Authentication -> Users -> "Send password recovery".
  const { data, error } = await admin.auth.admin.createUser({
    email: ROOT_EMAIL,
    password: randomBytes(24).toString("base64url"),
    email_confirm: true,
    user_metadata: { full_name: "TekVotes Super Admin" },
  });
  if (error) throw error;
  console.log(`Created root auth user ${ROOT_EMAIL}`);
  return data.user.id;
}

async function main() {
  const rootId = await ensureRootUser();

  const db = new pg.Client({ connectionString: SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const q = (sql, params = []) => db.query(sql, params);

  try {
    const { rows: existingOrg } = await q("select id from public.organizations where slug = $1", [ORG_SLUG]);
    if (existingOrg.length) {
      console.log("Demo organization already exists - nothing to do.");
      return;
    }

    await q("begin");

    // Profile row is created by the on_auth_user_created trigger.
    await q("select public.app_bootstrap_super_admin($1::citext)", [ROOT_EMAIL]);

    const { rows: [app] } = await q(
      `insert into public.organization_applications
         (applicant_user_id, applicant_name, applicant_email, org_name, org_type, description)
       values ($1, 'TekVotes Super Admin', $2, 'TekVotes Demo Organiser', 'other',
               'Internal demo organiser used for staging and testing.')
       returning id`,
      [rootId, ROOT_EMAIL]
    );
    const { rows: [{ org_id: orgId }] } = await q(
      "select public.app_approve_org_application($1, $2, $3) as org_id",
      [app.id, rootId, ORG_SLUG]
    );

    const now = Date.now();

    for (const ev of EVENTS) {
      const { rows: [event] } = await q(
        `insert into public.events
           (organization_id, slug, public_code, name, description, event_type, venue,
            voting_opens_at, voting_closes_at, publication_status, created_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'published',$10) returning id`,
        [orgId, ev.slug, ev.code, ev.name, ev.description, ev.type, ev.venue,
         new Date(now + (ev.live ? 0 : 14 * DAY)), new Date(now + (ev.live ? 30 : 44) * DAY), rootId]
      );

      const categoryIds = [];
      for (const [i, cat] of ev.categories.entries()) {
        const { rows: [c] } = await q(
          `insert into public.event_categories
             (event_id, organization_id, name, slug, sort_order, results_state, unit_price_minor)
           values ($1,$2,$3,$4,$5,'live',$6) returning id`,
          [event.id, orgId, cat.name, cat.slug, i, cat.priceMinor]
        );
        categoryIds.push(c.id);
        for (const [p, pkg] of PACKAGES.entries()) {
          await q(
            `insert into public.vote_packages
               (category_id, event_id, organization_id, label, votes, price_minor, sort_order)
             values ($1,$2,$3,$4,$5,$6,$7)`,
            [c.id, event.id, orgId, pkg.label, pkg.votes, pkg.votes * cat.priceMinor, p]
          );
        }
      }

      for (const [n, displayName] of ev.contestants.entries()) {
        const { rows: [contestant] } = await q(
          `insert into public.contestants (organization_id, display_name, bio, created_by)
           values ($1,$2,'Demo contestant - not a real person.',$3) returning id`,
          [orgId, displayName, rootId]
        );
        const { rows: [entry] } = await q(
          `insert into public.contestant_entries
             (event_id, organization_id, contestant_id, contestant_number, public_code, registered_by)
           values ($1,$2,$3,$4,$5,$6) returning id`,
          [event.id, orgId, contestant.id, n + 1, `${ev.code}-${String(n + 1).padStart(2, "0")}`, rootId]
        );
        for (const [ci, categoryId] of categoryIds.entries()) {
          await q(
            `insert into public.category_entries (event_id, organization_id, category_id, entry_id, display_order)
             values ($1,$2,$3,$4,$5)`,
            [event.id, orgId, categoryId, entry.id, n]
          );
          void ci;
        }
      }

      if (ev.live) {
        await q("select public.app_submit_event_for_approval($1,$2,$3)", [rootId, event.id, orgId]);
        await q("select public.app_review_event_approval($1,$2,'approved')", [rootId, event.id]);
        await q("update public.events set voting_status = 'active' where id = $1", [event.id]);
        await q(
          `insert into public.event_status_history
             (event_id, organization_id, dimension, from_status, to_status, reason, actor_id)
           values ($1,$2,'voting','not_started','active','Demo seed: voting opened',$3)`,
          [event.id, orgId, rootId]
        );
      }
      console.log(`Seeded ${ev.name} (${ev.live ? "voting active" : "coming soon"})`);
    }

    await q("commit");
    console.log("Demo seed complete.");
  } catch (err) {
    await q("rollback").catch(() => {});
    throw err;
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err.message ?? err);
  process.exit(1);
});
