import Link from "next/link";
import { connection } from "next/server";
import { requireSuperAdminPage } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navigation/Navbar";
import {
  AdminConsoleClient,
  type AdminApplicationRow,
  type AdminEventFundRow,
  type AdminOrgFundRow,
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
  ] = await Promise.all([
    admin.from("v_event_funds").select("*"),
    admin
      .from("events")
      .select("id, slug, public_code, name, organization_id, approval_status, voting_status, currency, organizations(name)")
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
  const eventFunds: AdminEventFundRow[] = (eventRows ?? []).map((ev) => {
    eventCountByOrg.set(ev.organization_id, (eventCountByOrg.get(ev.organization_id) ?? 0) + 1);
    const vf = fundByEventId.get(ev.id);
    const ord = orderTotalsByEvent.get(ev.id) ?? { gross: 0, base: 0, comm: 0 };
    return {
      id: ev.id,
      slug: ev.slug,
      eventCode: ev.public_code,
      eventName: ev.name,
      orgName: readOrgName(ev.organizations as OrgNameEmbed),
      approvalStatus: ev.approval_status,
      votingStatus: ev.voting_status,
      currency: ev.currency,
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
      totals={totals}
    />
  );
}
