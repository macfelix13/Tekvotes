import Link from "next/link";
import { connection } from "next/server";
import { requireOrgPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navigation/Navbar";
import {
  OrgPortalClient,
  type OrgCategoryRow,
  type OrgContestantRow,
  type OrgEventRow,
  type OrgSettlementRow,
} from "./OrgPortalClient";
import { Building2 } from "lucide-react";

export default async function OrganiserPortalPage() {
  await connection();
  const { user, activeOrg } = await requireOrgPage();

  const admin = createAdminClient();

  if (!activeOrg) {
    const { data: latestApp } = await admin
      .from("organization_applications")
      .select("org_name, status, rejection_reason, created_at")
      .eq("applicant_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (
      <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl border border-[#D9DBEA] p-8 text-center space-y-4 shadow-sm">
            <Building2 className="w-10 h-10 text-[#4B35E0] mx-auto" />
            <h1 className="font-heading font-extrabold text-xl text-[#0E1030]">
              {latestApp?.status === "pending"
                ? "Application Under Review"
                : latestApp?.status === "rejected"
                ? "Application Not Approved"
                : "No Active Organization Workspace"}
            </h1>
            <p className="text-sm text-[#5B5F85]">
              Signed in as <strong>{user.email}</strong>.{" "}
              {latestApp?.status === "pending" ? (
                <>
                  Your application for <strong>{latestApp.org_name}</strong> is pending Super Admin approval. Once
                  approved in <code className="font-mono text-[#4B35E0]">/admin</code>, refresh this page to open your
                  workspace.
                </>
              ) : latestApp?.status === "rejected" ? (
                <>
                  Your application for <strong>{latestApp.org_name}</strong> was not approved
                  {latestApp.rejection_reason ? `: ${latestApp.rejection_reason}` : "."}
                </>
              ) : (
                "Apply to host an event or wait for Super Admin approval to unlock your organizer workspace."
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!latestApp || latestApp.status === "rejected" ? (
                <Link
                  href="/apply"
                  className="px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8]"
                >
                  Apply as Organiser
                </Link>
              ) : null}
              <Link
                href="/competitions"
                className="px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#0E1030] hover:bg-[#F6F7FC]"
              >
                Browse Events
              </Link>
              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#5B5F85] hover:bg-[#F6F7FC] cursor-pointer"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }
  const [{ data: evRows }, { data: catRows }, { data: fundRows }, { data: ceRows }, { data: socialRows }, { data: settleReqRows }] =
    await Promise.all([
      admin
        .from("events")
        .select("id, slug, public_code, name, event_type, approval_status, voting_status, currency")
        .eq("organization_id", activeOrg.id)
        .order("created_at", { ascending: false }),
      admin
        .from("event_categories")
        .select("id, event_id, name, unit_price_minor, results_state, live_visibility, sort_order")
        .eq("organization_id", activeOrg.id)
        .order("sort_order"),
      admin.from("v_event_funds").select("*").eq("organization_id", activeOrg.id),
      admin
        .from("category_entries")
        .select(
          "id, event_id, category_id, status, contestant_entries(public_code, event_bio, contestants(id, display_name, bio, gender, profile_public_id)), category_entry_tallies(total_votes)"
        )
        .eq("organization_id", activeOrg.id),
      admin
        .from("contestant_social_links")
        .select("contestant_id, platform, url")
        .eq("organization_id", activeOrg.id)
        .order("sort_order"),
      admin.rpc("app_list_settlement_requests", { p_org_id: activeOrg.id }),
    ]);

  const fundByEvent = new Map((fundRows ?? []).map((f) => [f.event_id as string, f]));
  const eventNameById = new Map((evRows ?? []).map((e) => [e.id as string, e.name as string]));
  const catNameById = new Map((catRows ?? []).map((c) => [c.id as string, c.name as string]));

  const socialsByContestant = new Map<string, Record<string, string>>();
  for (const s of socialRows ?? []) {
    const cid = s.contestant_id as string;
    const map = socialsByContestant.get(cid) ?? {};
    map[String(s.platform)] = String(s.url);
    socialsByContestant.set(cid, map);
  }

  const votesByEvent = new Map<string, number>();

  type TallyEmbed = { total_votes: number } | { total_votes: number }[] | null;
  type ContestantEmbed =
    | { id: string; display_name: string; bio: string | null; gender: string | null; profile_public_id: string | null }
    | { id: string; display_name: string; bio: string | null; gender: string | null; profile_public_id: string | null }[]
    | null;
  type EntryEmbed =
    | { public_code: string; event_bio: string | null; contestants: ContestantEmbed }
    | { public_code: string; event_bio: string | null; contestants: ContestantEmbed }[]
    | null;

  const contestants: OrgContestantRow[] = (ceRows ?? []).map((ce) => {
    const entryRaw = ce.contestant_entries as EntryEmbed;
    const entry = Array.isArray(entryRaw) ? entryRaw[0] : entryRaw;
    const conRaw = entry?.contestants ?? null;
    const con = Array.isArray(conRaw) ? conRaw[0] : conRaw;
    const tallyRaw = ce.category_entry_tallies as TallyEmbed;
    const tally = Array.isArray(tallyRaw) ? tallyRaw[0] : tallyRaw;
    const votes = Number(tally?.total_votes ?? 0);
    const contestantId = con?.id ?? "";
    const links = socialsByContestant.get(contestantId) ?? {};

    votesByEvent.set(ce.event_id, (votesByEvent.get(ce.event_id) ?? 0) + votes);

    return {
      categoryEntryId: ce.id,
      contestantId,
      organizationId: activeOrg.id,
      code: entry?.public_code ?? "—",
      name: con?.display_name ?? "Contestant",
      gender: con?.gender ?? "",
      bio: con?.bio ?? entry?.event_bio ?? "",
      photoUrl: con?.profile_public_id ?? "",
      instagramUrl: links.instagram ?? "",
      tiktokUrl: links.tiktok ?? "",
      facebookUrl: links.facebook ?? "",
      eventName: eventNameById.get(ce.event_id) ?? "Event",
      categoryName: catNameById.get(ce.category_id) ?? "Category",
      status: ce.status,
      votes,
    };
  });

  const events: OrgEventRow[] = (evRows ?? []).map((ev) => {
    const vf = fundByEvent.get(ev.id);
    return {
      id: ev.id,
      organizationId: activeOrg.id,
      slug: ev.slug,
      name: ev.name,
      code: ev.public_code,
      eventType: ev.event_type,
      approvalStatus: ev.approval_status,
      votingStatus: ev.voting_status,
      totalVotes: votesByEvent.get(ev.id) ?? 0,
      pendingEscrowMinor: Number(vf?.total_earned_pending_minor ?? 0),
      availableMinor: Number(vf?.available_to_settle_minor ?? 0),
      currency: ev.currency,
    };
  });

  const categories: OrgCategoryRow[] = (catRows ?? []).map((c) => ({
    id: c.id,
    eventId: c.event_id,
    eventName: eventNameById.get(c.event_id) ?? "Event",
    name: c.name,
    unitPriceMinor: Number(c.unit_price_minor),
    resultsState: c.results_state as "hidden" | "live" | "final",
    liveVisibility: c.live_visibility as "ranks_only" | "counts" | "percent",
  }));

  const totals = {
    totalVotes: events.reduce((acc, e) => acc + e.totalVotes, 0),
    pendingEscrowMinor: (fundRows ?? []).reduce((acc, f) => acc + Number(f.total_earned_pending_minor ?? 0), 0),
    availableMinor: (fundRows ?? []).reduce((acc, f) => acc + Number(f.available_to_settle_minor ?? 0), 0),
    inFlightMinor: (fundRows ?? []).reduce((acc, f) => acc + Number(f.in_flight_settlement_minor ?? 0), 0),
  };

  type SettlementRpcRow = {
    id: string;
    amount_minor: number;
    currency: string;
    status: string;
    masked_account: string | null;
    account_name: string | null;
    provider_transfer_ref: string | null;
    created_at: string;
  };

  const settlements: OrgSettlementRow[] = ((settleReqRows as SettlementRpcRow[] | null) ?? []).map((sr) => ({
    id: sr.id,
    amountMinor: Number(sr.amount_minor),
    currency: sr.currency,
    status: sr.status,
    destinationLabel: sr.masked_account ?? "Destination",
    accountName: sr.account_name ?? "",
    transferRef: sr.provider_transfer_ref ?? null,
    createdAt: sr.created_at,
  }));

  return (
    <OrgPortalClient
      userEmail={user.email ?? ""}
      org={activeOrg}
      events={events}
      categories={categories}
      contestants={contestants}
      settlements={settlements}
      totals={totals}
    />
  );
}
