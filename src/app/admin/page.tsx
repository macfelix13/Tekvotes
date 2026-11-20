import Link from "next/link";
import { connection } from "next/server";
import { requireSuperAdminPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navigation/Navbar";
import {
  AdminConsoleClient,
  type AdminApplicationRow,
  type AdminCategoryRow,
  type AdminContestantRow,
  type AdminEventFundRow,
  type AdminOrgFundRow,
  type AdminSettlementRow,
  type AdminUncreditedOrderRow,
} from "./AdminConsoleClient";
import { ShieldAlert } from "lucide-react";

function maskPhone(raw: string | null | undefined): string {
  if (!raw) return "Unknown";
  if (raw.length <= 6) return "***";
  return `${raw.slice(0, 6)}•••${raw.slice(-3)}`;
}

export default async function SuperAdminPage() {
  await connection();
  const { user, authorized } = await requireSuperAdminPage();

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl border border-[#D9DBEA] p-8 text-center space-y-4 shadow-sm">
            <ShieldAlert className="w-10 h-10 text-[#D13A3A] mx-auto" />
            <h1 className="font-heading font-extrabold text-xl text-[#0E1030]">Super Admin Access Required</h1>
            <p className="text-sm text-[#5B5F85]">
              Signed in as <strong>{user.email}</strong>, which does not hold <code className="font-mono">super_admin</code> authority.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/org"
                className="px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8]"
              >
                Go to Organiser Portal
              </Link>
              <Link
                href="/"
                className="px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#0E1030] hover:bg-[#F6F7FC]"
              >
                Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const admin = createAdminClient();
  const [
    { data: eventFundRows },
    { data: eventRows },
    { data: orgFundRows },
    { data: creditedOrders },
    { data: appRows },
    { data: uncreditedRows },
    { data: catRows },
    { data: ceRows },
    { data: socialRows },
    { data: settleReqRows },
  ] = await Promise.all([
    admin.from("v_event_funds").select("*"),
    admin
      .from("events")
      .select("id, slug, public_code, name, organization_id, approval_status, voting_status, currency, commission_bps, organizations(name)")
      .order("created_at", { ascending: false }),
    admin.from("v_org_funds").select("*"),
    admin
      .from("voting_orders")
      .select("event_id, organization_id, snapshot_base_amount_minor, snapshot_amount_minor, commission_bps")
      .eq("status", "credited"),
    admin
      .from("organization_applications")
      .select("id, org_name, applicant_name, applicant_email, org_type, description, status, rejection_reason, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("voting_orders")
      .select("id, reference, snapshot_amount_minor, snapshot_currency, created_at, events(name), voters(phone_e164)")
      .eq("status", "paid_uncredited")
      .order("created_at", { ascending: false }),
    admin.from("event_categories").select("id, event_id, name").order("sort_order"),
    admin
      .from("category_entries")
      .select(
        "id, event_id, organization_id, category_id, status, contestant_entries(public_code, event_bio, contestants(id, display_name, bio, gender, profile_public_id)), category_entry_tallies(total_votes)"
      )
      .order("created_at", { ascending: false }),
    admin.from("contestant_social_links").select("contestant_id, platform, url").order("sort_order"),
    admin
      .schema("fin")
      .from("settlement_requests")
      .select("id, organization_id, amount_minor, currency, status, created_at, settlement_destinations(masked_account, account_name), settlements(provider_transfer_ref)")
      .order("created_at", { ascending: false }),
  ]);

  const fundByEventId = new Map((eventFundRows ?? []).map((f) => [f.event_id as string, f]));

  const orderTotalsByEvent = new Map<string, { gross: number; base: number; comm: number }>();
  const orderTotalsByOrg = new Map<string, { base: number; comm: number }>();

  for (const ord of creditedOrders ?? []) {
    const base = Number(ord.snapshot_base_amount_minor ?? 0);
    const gross = Number(ord.snapshot_amount_minor ?? 0);
    const bps = Number(ord.commission_bps ?? 1000);
    const comm = Math.floor((base * bps + 5000) / 10000);

    const evAgg = orderTotalsByEvent.get(ord.event_id) ?? { gross: 0, base: 0, comm: 0 };
    evAgg.gross += gross;
    evAgg.base += base;
    evAgg.comm += comm;
    orderTotalsByEvent.set(ord.event_id, evAgg);

    const orgAgg = orderTotalsByOrg.get(ord.organization_id) ?? { base: 0, comm: 0 };
    orgAgg.base += base;
    orgAgg.comm += comm;
    orderTotalsByOrg.set(ord.organization_id, orgAgg);
  }

  type OrgNameEmbed = { name: string } | { name: string }[] | null;
  const readOrgName = (o: OrgNameEmbed) => (Array.isArray(o) ? o[0]?.name : o?.name) ?? "Organization";

  const eventCountByOrg = new Map<string, number>();
  const eventMetaById = new Map<string, { name: string; orgName: string }>();

  const eventFunds: AdminEventFundRow[] = (eventRows ?? []).map((ev) => {
    eventCountByOrg.set(ev.organization_id, (eventCountByOrg.get(ev.organization_id) ?? 0) + 1);
    const orgName = readOrgName(ev.organizations as OrgNameEmbed);
    eventMetaById.set(ev.id, { name: ev.name, orgName });

    const vf = fundByEventId.get(ev.id);
    const ord = orderTotalsByEvent.get(ev.id) ?? { gross: 0, base: 0, comm: 0 };
    return {
      id: ev.id,
      organizationId: ev.organization_id,
      slug: ev.slug,
      eventCode: ev.public_code,
      eventName: ev.name,
      orgName,
      approvalStatus: ev.approval_status,
      votingStatus: ev.voting_status,
      currency: ev.currency,
      commissionBps: Number(ev.commission_bps ?? 1000),
      grossCollectedMinor: ord.gross,
      baseVotesMinor: ord.base,
      commissionMinor: ord.comm,
      pendingEscrowMinor: Number(vf?.total_earned_pending_minor ?? 0),
      availableMinor: Number(vf?.available_to_settle_minor ?? 0),
    };
  });

  const orgFunds: AdminOrgFundRow[] = (orgFundRows ?? []).map((of) => {
    const ord = orderTotalsByOrg.get(of.organization_id) ?? { base: 0, comm: 0 };
    return {
      organizationId: of.organization_id,
      orgName: of.organization_name,
      currency: of.currency,
      eventsCount: eventCountByOrg.get(of.organization_id) ?? 0,
      totalBaseVotesMinor: ord.base,
      totalCommissionMinor: ord.comm,
      pendingEscrowMinor: Number(of.total_earned_pending_minor ?? 0),
      availablePostCloseMinor: Number(of.available_to_settle_minor ?? 0),
    };
  });

  const applications: AdminApplicationRow[] = (appRows ?? []).map((a) => ({
    id: a.id,
    orgName: a.org_name,
    applicantName: a.applicant_name,
    applicantEmail: a.applicant_email,
    orgType: a.org_type || "other",
    description: a.description,
    status: a.status,
    rejectionReason: a.rejection_reason,
    createdAt: a.created_at,
  }));

  type EvEmbed = { name: string } | { name: string }[] | null;
  type VoterEmbed = { phone_e164: string | null } | { phone_e164: string | null }[] | null;
  const pickEv = (x: EvEmbed) => (Array.isArray(x) ? x[0] : x);
  const pickVoter = (x: VoterEmbed) => (Array.isArray(x) ? x[0] : x);

  const uncreditedOrders: AdminUncreditedOrderRow[] = (uncreditedRows ?? []).map((r) => {
    const ev = pickEv(r.events as EvEmbed);
    const v = pickVoter(r.voters as VoterEmbed);
    return {
      id: r.id,
      reference: r.reference,
      maskedPhone: maskPhone(v?.phone_e164),
      eventName: ev?.name ?? "Event",
      amountMinor: Number(r.snapshot_amount_minor ?? 0),
      currency: r.snapshot_currency,
      createdAt: r.created_at,
    };
  });

  const categories: AdminCategoryRow[] = (catRows ?? []).map((c) => ({
    id: c.id,
    eventId: c.event_id,
    name: c.name,
  }));
  const catNameById = new Map(categories.map((c) => [c.id, c.name]));

  const socialsByContestant = new Map<string, Record<string, string>>();
  for (const s of socialRows ?? []) {
    const cid = s.contestant_id as string;
    const map = socialsByContestant.get(cid) ?? {};
    map[String(s.platform)] = String(s.url);
    socialsByContestant.set(cid, map);
  }

  type TallyEmbed = { total_votes: number } | { total_votes: number }[] | null;
  type ContestantEmbed =
    | { id: string; display_name: string; bio: string | null; gender: string | null; profile_public_id: string | null }
    | { id: string; display_name: string; bio: string | null; gender: string | null; profile_public_id: string | null }[]
    | null;
  type EntryEmbed =
    | { public_code: string; event_bio: string | null; contestants: ContestantEmbed }
    | { public_code: string; event_bio: string | null; contestants: ContestantEmbed }[]
    | null;

  const contestants: AdminContestantRow[] = (ceRows ?? []).map((ce) => {
    const entryRaw = ce.contestant_entries as EntryEmbed;
    const entry = Array.isArray(entryRaw) ? entryRaw[0] : entryRaw;
    const conRaw = entry?.contestants ?? null;
    const con = Array.isArray(conRaw) ? conRaw[0] : conRaw;
    const tallyRaw = ce.category_entry_tallies as TallyEmbed;
    const tally = Array.isArray(tallyRaw) ? tallyRaw[0] : tallyRaw;
    const contestantId = con?.id ?? "";
    const links = socialsByContestant.get(contestantId) ?? {};
    const evMeta = eventMetaById.get(ce.event_id);

    return {
      categoryEntryId: ce.id,
      contestantId,
      organizationId: ce.organization_id,
      eventId: ce.event_id,
      eventName: evMeta?.name ?? "Event",
      orgName: evMeta?.orgName ?? "Organization",
      categoryName: catNameById.get(ce.category_id) ?? "Category",
      code: entry?.public_code ?? "—",
      displayName: con?.display_name ?? "Contestant",
      gender: con?.gender ?? "",
      bio: con?.bio ?? entry?.event_bio ?? "",
      photoUrl: con?.profile_public_id ?? "",
      instagramUrl: links.instagram ?? "",
      tiktokUrl: links.tiktok ?? "",
      facebookUrl: links.facebook ?? "",
      status: ce.status,
      votes: Number(tally?.total_votes ?? 0),
    };
  });

  const orgNameById = new Map((orgFundRows ?? []).map((o) => [o.organization_id as string, o.organization_name as string]));
  type DestEmbed = { masked_account: string; account_name: string } | { masked_account: string; account_name: string }[] | null;
  type SettleEmbed = { provider_transfer_ref: string | null } | { provider_transfer_ref: string | null }[] | null;

  const settlements: AdminSettlementRow[] = (settleReqRows ?? []).map((sr) => {
    const dRaw = sr.settlement_destinations as DestEmbed;
    const sRaw = sr.settlements as SettleEmbed;
    const d = Array.isArray(dRaw) ? dRaw[0] : dRaw;
    const s = Array.isArray(sRaw) ? sRaw[0] : sRaw;
    return {
      id: sr.id,
      organizationId: sr.organization_id,
      orgName: orgNameById.get(sr.organization_id) ?? "Organization",
      amountMinor: Number(sr.amount_minor),
      currency: sr.currency,
      status: sr.status,
      destinationLabel: d?.masked_account ?? "Destination",
      accountName: d?.account_name ?? "",
      transferRef: s?.provider_transfer_ref ?? null,
      createdAt: sr.created_at,
    };
  });

  const totals = {
    grossCollectedMinor: eventFunds.reduce((acc, e) => acc + e.grossCollectedMinor, 0),
    commissionMinor: eventFunds.reduce((acc, e) => acc + e.commissionMinor, 0),
    activeEscrowMinor: eventFunds.reduce((acc, e) => acc + e.pendingEscrowMinor, 0),
    closedAvailableMinor: eventFunds.reduce((acc, e) => acc + e.availableMinor, 0),
  };

  return (
    <AdminConsoleClient
      adminEmail={user.email ?? "super_admin"}
      eventFunds={eventFunds}
      orgFunds={orgFunds}
      applications={applications}
      uncreditedOrders={uncreditedOrders}
      categories={categories}
      contestants={contestants}
      settlements={settlements}
      totals={totals}
    />
  );
}
