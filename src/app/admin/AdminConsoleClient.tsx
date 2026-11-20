"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import {
  ContestantProfileModal,
  type EditableContestantProfile,
} from "@/components/admin/ContestantProfileModal";
import {
  ShieldCheck,
  Building2,
  Landmark,
  CheckCircle2,
  Lock,
  FileSpreadsheet,
  ClipboardCheck,
  RotateCcw,
  Power,
  PauseCircle,
  PlayCircle,
  XCircle,
  LogOut,
  Loader2,
  AlertCircle,
  Users,
  Plus,
  Pencil,
  Search,
  User,
} from "lucide-react";

export interface AdminEventFundRow {
  id: string;
  organizationId: string;
  slug: string;
  eventCode: string;
  eventName: string;
  orgName: string;
  approvalStatus: string;
  votingStatus: string;
  currency: string;
  grossCollectedMinor: number;
  baseVotesMinor: number;
  commissionMinor: number;
  pendingEscrowMinor: number;
  availableMinor: number;
}

export interface AdminOrgFundRow {
  organizationId: string;
  orgName: string;
  currency: string;
  eventsCount: number;
  totalBaseVotesMinor: number;
  totalCommissionMinor: number;
  pendingEscrowMinor: number;
  availablePostCloseMinor: number;
}

export interface AdminApplicationRow {
  id: string;
  orgName: string;
  applicantName: string;
  applicantEmail: string;
  orgType: string;
  description: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

export interface AdminUncreditedOrderRow {
  id: string;
  reference: string;
  maskedPhone: string;
  eventName: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
}

export interface AdminCategoryRow {
  id: string;
  eventId: string;
  name: string;
}

export interface AdminContestantRow {
  categoryEntryId: string;
  contestantId: string;
  organizationId: string;
  eventId: string;
  eventName: string;
  orgName: string;
  categoryName: string;
  code: string;
  displayName: string;
  gender: string;
  bio: string;
  photoUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  status: string;
  votes: number;
}

interface AdminConsoleProps {
  adminEmail: string;
  eventFunds: AdminEventFundRow[];
  orgFunds: AdminOrgFundRow[];
  applications: AdminApplicationRow[];
  uncreditedOrders: AdminUncreditedOrderRow[];
  categories: AdminCategoryRow[];
  contestants: AdminContestantRow[];
  totals: {
    grossCollectedMinor: number;
    commissionMinor: number;
    activeEscrowMinor: number;
    closedAvailableMinor: number;
  };
}

const fmtGhs = (minor: number, currency = "GHS") =>
  `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AdminConsoleClient({
  adminEmail,
  eventFunds,
  orgFunds,
  applications,
  uncreditedOrders,
  categories,
  contestants,
  totals,
}: AdminConsoleProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"treasury" | "contestants" | "approvals" | "refunds">("treasury");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [contestantSearch, setContestantSearch] = useState("");
  const [contestantEventFilter, setContestantEventFilter] = useState("all");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<EditableContestantProfile | null>(null);

  const pendingApps = applications.filter((a) => a.status === "pending");
  const eventsNeedingAttention = eventFunds.filter(
    (e) => e.approvalStatus !== "approved" || e.votingStatus === "not_started"
  );

  const filteredContestants = contestants.filter((c) => {
    const matchesEvent = contestantEventFilter === "all" || c.eventId === contestantEventFilter;
    const q = contestantSearch.trim().toLowerCase();
    const matchesQ =
      !q ||
      c.displayName.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.eventName.toLowerCase().includes(q) ||
      c.orgName.toLowerCase().includes(q);
    return matchesEvent && matchesQ;
  });

  const runEventAction = async (
    eventId: string,
    action: "approve" | "revoke" | "open_voting" | "pause" | "resume" | "close" | "release_funds",
    reason?: string
  ) => {
    setBusyId(eventId);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/admin/events/${eventId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Action failed." });
        return;
      }
      if (action === "release_funds") {
        setNotice({
          kind: "ok",
          text: `Released ${fmtGhs(Number(data?.releasedMinor ?? 0))} from escrow to organizer available balance.`,
        });
      } else {
        setNotice({ kind: "ok", text: `Updated event (${action.replace(/_/g, " ")}).` });
      }
      router.refresh();
    } catch {
      setNotice({ kind: "err", text: "Network error performing action." });
    } finally {
      setBusyId(null);
    }
  };

  const decideApplication = async (appId: string, decision: "approve" | "reject") => {
    let reason: string | undefined;
    if (decision === "reject") {
      const input = window.prompt("Enter rejection reason (required):");
      if (!input || !input.trim()) return;
      reason = input.trim();
    }

    setBusyId(appId);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/admin/applications/${appId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Failed to update application." });
        return;
      }
      setNotice({
        kind: "ok",
        text:
          decision === "approve"
            ? `Approved application and provisioned organization (${data?.slug}).`
            : "Application rejected and audited.",
      });
      router.refresh();
    } catch {
      setNotice({ kind: "err", text: "Network error updating application." });
    } finally {
      setBusyId(null);
    }
  };

  const openCreateProfile = () => {
    setEditingProfile(null);
    setProfileModalOpen(true);
  };

  const openEditProfile = (c: AdminContestantRow) => {
    setEditingProfile({
      contestantId: c.contestantId,
      organizationId: c.organizationId,
      eventName: c.eventName,
      categoryName: c.categoryName,
      code: c.code,
      displayName: c.displayName,
      gender: c.gender,
      bio: c.bio,
      photoUrl: c.photoUrl,
      instagramUrl: c.instagramUrl,
      tiktokUrl: c.tiktokUrl,
      facebookUrl: c.facebookUrl,
    });
    setProfileModalOpen(true);
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-gradient-to-r from-[#0E1030] to-[#231B68] text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2A900] text-[#0E1030] text-xs font-extrabold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" /> Super Admin Authority · {adminEmail}
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">
                TekVotes Central Treasury &amp; Governance Console
              </h1>
              <p className="text-xs sm:text-sm text-white/80 max-w-3xl">
                Manage <code className="font-mono text-[#F2A900]">v_event_funds</code>,{" "}
                <code className="font-mono text-[#F2A900]">v_org_funds</code>, contestant profiles &amp; portraits, and organizer approvals.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={eventFunds.length === 0}
                onClick={openCreateProfile}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F2A900] text-[#0E1030] font-bold text-xs hover:bg-[#D99600] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Contestant Profile
              </button>
              <Link
                href="/org"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15"
              >
                Organiser View
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>

          {notice ? (
            <div
              className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
                notice.kind === "ok"
                  ? "bg-[#E6F8F0] border-[#0F9D6B]/30 text-[#0F9D6B]"
                  : "bg-[#D13A3A]/10 border-[#D13A3A]/30 text-[#D13A3A]"
              }`}
            >
              {notice.kind === "ok" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Credited Collections</span>
              <div className="font-heading font-extrabold text-2xl text-[#0E1030] mt-1">
                {fmtGhs(totals.grossCollectedMinor)}
              </div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                Base votes + voter fee surcharges
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Platform Commission (10%)</span>
              <div className="font-heading font-extrabold text-2xl text-[#4B35E0] mt-1">
                {fmtGhs(totals.commissionMinor)}
              </div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                Earned on base vote amount (OD-01)
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Held Escrow (L-ORG-PEND)</span>
              <div className="font-heading font-extrabold text-2xl text-[#C77700] mt-1">
                {fmtGhs(totals.activeEscrowMinor)}
              </div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                Locked until event closes &amp; funds release
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Available Post-Close (L-ORG-AVAIL)</span>
              <div className="font-heading font-extrabold text-2xl text-[#0F9D6B] mt-1">
                {fmtGhs(totals.closedAvailableMinor)}
              </div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                Eligible for post-close settlement
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[#D9DBEA] pb-3">
            {(
              [
                { id: "treasury", label: "Event & Org Fund Ledgers (v_event_funds / v_org_funds)", Icon: Landmark },
                { id: "contestants", label: `Contestants & Profiles (${contestants.length})`, Icon: Users },
                {
                  id: "approvals",
                  label: `Organiser & Event Approvals (${pendingApps.length + eventsNeedingAttention.length})`,
                  Icon: ClipboardCheck,
                },
                {
                  id: "refunds",
                  label: `Post-Event Uncredited Orders (${uncreditedOrders.length})`,
                  Icon: RotateCcw,
                },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === id
                    ? "bg-[#4B35E0] text-white shadow-sm"
                    : "bg-white text-[#5B5F85] hover:text-[#0E1030] border border-[#D9DBEA]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {activeTab === "treasury" && (
            <>
              <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9DBEA] pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-[#4B35E0] flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4" /> Ledger View: public.v_event_funds
                    </span>
                    <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                      Per-Event Fund Records &amp; Lifecycle Controls
                    </h2>
                  </div>
                  <span className="text-xs font-semibold text-[#0F9D6B] bg-[#E6F8F0] px-3 py-1 rounded-full">
                    Double-Entry Balanced (SUM Debit = SUM Credit)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#D9DBEA] text-[#5B5F85] uppercase">
                        <th className="py-3 px-3">Event</th>
                        <th className="py-3 px-3">Organization</th>
                        <th className="py-3 px-3">State</th>
                        <th className="py-3 px-3">Gross Collected</th>
                        <th className="py-3 px-3">Commission</th>
                        <th className="py-3 px-3">Pending Escrow</th>
                        <th className="py-3 px-3">Available</th>
                        <th className="py-3 px-3 text-right">Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9DBEA]">
                      {eventFunds.map((ef) => {
                        const isBusy = busyId === ef.id;
                        return (
                          <tr key={ef.id} className="hover:bg-[#F6F7FC]">
                            <td className="py-3.5 px-3">
                              <span className="font-mono font-bold text-[#4B35E0] mr-1.5">{ef.eventCode}</span>
                              <Link href={`/competitions/${ef.slug}`} className="font-semibold text-[#0E1030] hover:underline">
                                {ef.eventName}
                              </Link>
                            </td>
                            <td className="py-3.5 px-3 text-[#5B5F85]">{ef.orgName}</td>
                            <td className="py-3.5 px-3 space-x-1.5">
                              <span className="px-2 py-0.5 rounded-full font-bold bg-[#E8E5FD] text-[#4B35E0]">
                                {ef.approvalStatus}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold ${
                                  ef.votingStatus === "active"
                                    ? "bg-[#E6F8F0] text-[#0F9D6B]"
                                    : ef.votingStatus === "closed"
                                    ? "bg-[#D9DBEA] text-[#0E1030]"
                                    : "bg-[#FDF3D6] text-[#C77700]"
                                }`}
                              >
                                {ef.votingStatus}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 font-mono">{fmtGhs(ef.grossCollectedMinor, ef.currency)}</td>
                            <td className="py-3.5 px-3 font-mono text-[#4B35E0] font-semibold">
                              {fmtGhs(ef.commissionMinor, ef.currency)}
                            </td>
                            <td className="py-3.5 px-3 font-mono text-[#C77700] font-semibold">
                              {fmtGhs(ef.pendingEscrowMinor, ef.currency)}
                            </td>
                            <td className="py-3.5 px-3 font-mono font-bold text-[#0F9D6B]">
                              {fmtGhs(ef.availableMinor, ef.currency)}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                {ef.approvalStatus !== "approved" ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void runEventAction(ef.id, "approve")}
                                    className="px-2.5 py-1 rounded-lg bg-[#0F9D6B] text-white font-bold hover:bg-[#0C8258] disabled:opacity-50 cursor-pointer"
                                  >
                                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}
                                  </button>
                                ) : ef.votingStatus === "not_started" ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void runEventAction(ef.id, "open_voting")}
                                    className="px-2.5 py-1 rounded-lg bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
                                  >
                                    Open Voting
                                  </button>
                                ) : ef.votingStatus === "active" ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void runEventAction(ef.id, "pause", "Admin review pause")}
                                      className="px-2.5 py-1 rounded-lg bg-[#FDF3D6] text-[#C77700] font-bold hover:bg-[#FCE8B2] disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <PauseCircle className="w-3 h-3" /> Pause
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void runEventAction(ef.id, "close")}
                                      className="px-2.5 py-1 rounded-lg bg-[#0E1030] text-white font-bold hover:bg-[#1A1D47] disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Power className="w-3 h-3 text-[#F2A900]" /> End Event
                                    </button>
                                  </>
                                ) : ef.votingStatus === "paused" ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void runEventAction(ef.id, "resume", "Admin resumed voting")}
                                      className="px-2.5 py-1 rounded-lg bg-[#0F9D6B] text-white font-bold hover:bg-[#0C8258] disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <PlayCircle className="w-3 h-3" /> Resume
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => void runEventAction(ef.id, "close")}
                                      className="px-2.5 py-1 rounded-lg bg-[#0E1030] text-white font-bold hover:bg-[#1A1D47] disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Power className="w-3 h-3 text-[#F2A900]" /> End Event
                                    </button>
                                  </>
                                ) : ef.pendingEscrowMinor > 0 ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void runEventAction(ef.id, "release_funds")}
                                    className="px-3 py-1.5 rounded-lg bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
                                  >
                                    Release Closed Funds
                                  </button>
                                ) : ef.availableMinor > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[#0F9D6B] font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Available to Settle
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[#5B5F85] font-semibold">
                                    <Lock className="w-3.5 h-3.5" /> Closed
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {eventFunds.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-[#5B5F85]">
                            No events created yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
                <div className="border-b border-[#D9DBEA] pb-4">
                  <span className="text-xs font-bold uppercase text-[#4B35E0] flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" /> Ledger View: public.v_org_funds
                  </span>
                  <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                    Per-Organization Cumulative Fund Statements
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#D9DBEA] text-[#5B5F85] uppercase">
                        <th className="py-3 px-4">Organization</th>
                        <th className="py-3 px-4">Events</th>
                        <th className="py-3 px-4">Credited Base Votes</th>
                        <th className="py-3 px-4">Platform Commission</th>
                        <th className="py-3 px-4">Active Escrow (L-ORG-PEND)</th>
                        <th className="py-3 px-4 text-right">Available (L-ORG-AVAIL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9DBEA]">
                      {orgFunds.map((of) => (
                        <tr key={of.organizationId} className="hover:bg-[#F6F7FC]">
                          <td className="py-3.5 px-4 font-bold text-[#0E1030] flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#4B35E0]" />
                            {of.orgName}
                          </td>
                          <td className="py-3.5 px-4">{of.eventsCount}</td>
                          <td className="py-3.5 px-4 font-mono">{fmtGhs(of.totalBaseVotesMinor, of.currency)}</td>
                          <td className="py-3.5 px-4 font-mono text-[#4B35E0] font-semibold">
                            {fmtGhs(of.totalCommissionMinor, of.currency)}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#C77700] font-semibold">
                            {fmtGhs(of.pendingEscrowMinor, of.currency)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-[#0F9D6B]">
                            {fmtGhs(of.availablePostCloseMinor, of.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === "contestants" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-5 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#D9DBEA] pb-4">
                <div>
                  <span className="text-xs font-bold uppercase text-[#4B35E0]">Platform Roster Management</span>
                  <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                    Contestant Profiles &amp; Portraits Across All Events
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={contestantEventFilter}
                    onChange={(e) => setContestantEventFilter(e.target.value)}
                    aria-label="Filter contestants by event"
                    className="px-3 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030]"
                  >
                    <option value="all">All events ({eventFunds.length})</option>
                    {eventFunds.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.eventName} ({ev.eventCode})
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="text"
                      value={contestantSearch}
                      onChange={(e) => setContestantSearch(e.target.value)}
                      placeholder="Search name or code..."
                      className="pl-9 pr-3 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030] w-56"
                    />
                    <Search className="w-3.5 h-3.5 text-[#5B5F85] absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    disabled={eventFunds.length === 0}
                    onClick={openCreateProfile}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Contestant Profile
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D9DBEA] text-[#5B5F85] uppercase">
                      <th className="py-3 px-3">Contestant Profile</th>
                      <th className="py-3 px-3">Code</th>
                      <th className="py-3 px-3">Event &amp; Category</th>
                      <th className="py-3 px-3">Organization</th>
                      <th className="py-3 px-3 text-right">Votes</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DBEA]">
                    {filteredContestants.map((c) => (
                      <tr key={c.categoryEntryId} className="hover:bg-[#F6F7FC]">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            {c.photoUrl ? (
                              <img
                                src={c.photoUrl}
                                alt={c.displayName}
                                className="w-10 h-10 rounded-xl object-cover border border-[#D9DBEA] shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-[#0E1030] text-white flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-white/70" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-[#0E1030]">{c.displayName}</div>
                              {c.bio ? (
                                <p className="text-[11px] text-[#5B5F85] line-clamp-1 max-w-xs">{c.bio}</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-[#4B35E0]">{c.code}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#0E1030]">{c.eventName}</div>
                          <div className="text-[11px] text-[#5B5F85]">{c.categoryName}</div>
                        </td>
                        <td className="py-3 px-3 text-[#5B5F85]">{c.orgName}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#0E1030]">
                          {c.votes.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditProfile(c)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D9DBEA] bg-white text-[#0E1030] font-semibold hover:border-[#4B35E0] hover:text-[#4B35E0] cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" /> Edit Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredContestants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#5B5F85]">
                          No contestant profiles match this filter.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "approvals" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
                <div>
                  <span className="text-xs font-bold uppercase text-[#4B35E0]">Tenant Onboarding</span>
                  <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                    Organizer Applications ({applications.length})
                  </h2>
                </div>

                {applications.length === 0 ? (
                  <p className="text-sm text-[#5B5F85]">No organizer applications submitted yet.</p>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app) => {
                      const isBusy = busyId === app.id;
                      return (
                        <div
                          key={app.id}
                          className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <h3 className="font-heading font-bold text-base text-[#0E1030]">{app.orgName}</h3>
                            <p className="text-xs text-[#5B5F85]">
                              {app.applicantName} ({app.applicantEmail}) · {app.orgType.replace(/_/g, " ")}
                            </p>
                            {app.description ? (
                              <p className="text-xs text-[#5B5F85] mt-1">{app.description}</p>
                            ) : null}
                            {app.rejectionReason ? (
                              <p className="text-xs text-[#D13A3A] mt-1">Reason: {app.rejectionReason}</p>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            {app.status === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void decideApplication(app.id, "approve")}
                                  className="px-4 py-2 rounded-xl bg-[#0F9D6B] text-white text-xs font-bold hover:bg-[#0C8258] disabled:opacity-50 cursor-pointer"
                                >
                                  Approve &amp; Provision
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void decideApplication(app.id, "reject")}
                                  className="px-3 py-2 rounded-xl bg-white border border-[#D13A3A]/30 text-[#D13A3A] text-xs font-bold hover:bg-[#D13A3A]/10 disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-bold ${
                                  app.status === "approved" ? "text-[#0F9D6B]" : "text-[#D13A3A]"
                                }`}
                              >
                                <CheckCircle2 className="w-4 h-4" /> {app.status.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
                <div>
                  <span className="text-xs font-bold uppercase text-[#4B35E0]">Rule OD-14 Gate</span>
                  <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                    Events Awaiting Approval or Voting Activation ({eventsNeedingAttention.length})
                  </h2>
                </div>

                {eventsNeedingAttention.length === 0 ? (
                  <p className="text-sm text-[#5B5F85]">All events are approved and activated.</p>
                ) : (
                  <div className="space-y-3">
                    {eventsNeedingAttention.map((ev) => {
                      const isBusy = busyId === ev.id;
                      return (
                        <div
                          key={ev.id}
                          className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#4B35E0]">{ev.eventCode}</span>
                              <span className="text-xs font-semibold text-[#5B5F85]">{ev.orgName}</span>
                            </div>
                            <h3 className="font-heading font-bold text-base text-[#0E1030]">{ev.eventName}</h3>
                            <p className="text-xs text-[#5B5F85]">
                              Approval: <strong>{ev.approvalStatus}</strong> · Voting: <strong>{ev.votingStatus}</strong>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {ev.approvalStatus !== "approved" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void runEventAction(ev.id, "approve")}
                                className="px-4 py-2 rounded-xl bg-[#0F9D6B] text-white text-xs font-bold hover:bg-[#0C8258] disabled:opacity-50 cursor-pointer"
                              >
                                Approve Event
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void runEventAction(ev.id, "open_voting")}
                                className="px-4 py-2 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
                              >
                                Activate Live Voting
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "refunds" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
              <div>
                <span className="text-xs font-bold uppercase text-[#4B35E0]">Rule ND-01 · Late Payment Governance</span>
                <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                  Uncredited Paid Orders Eligible for Post-Close Refund
                </h2>
                <p className="text-xs text-[#5B5F85]">
                  Orders paid after voting paused or past the 180-second grace window are marked{" "}
                  <code className="font-mono">paid_uncredited</code> in <code className="font-mono">public.voting_orders</code>.
                </p>
              </div>

              {uncreditedOrders.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] text-center text-sm text-[#5B5F85]">
                  No <code className="font-mono">paid_uncredited</code> orders at this time.
                </div>
              ) : (
                <div className="space-y-3">
                  {uncreditedOrders.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#4B35E0]">{r.reference}</span>
                          <span className="text-xs font-semibold text-[#0E1030]">Voter: {r.maskedPhone}</span>
                        </div>
                        <p className="text-xs font-bold text-[#0E1030]">{r.eventName}</p>
                        <p className="text-[11px] text-[#5B5F85]">{r.createdAt.replace("T", " ").slice(0, 19)} UTC</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-[#0E1030]">
                          {fmtGhs(r.amountMinor, r.currency)}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-[#FDF3D6] text-[#C77700] text-xs font-bold">
                          paid_uncredited
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {profileModalOpen && (
        <ContestantProfileModal
          events={eventFunds.map((e) => ({
            id: e.id,
            organizationId: e.organizationId,
            name: e.eventName,
            code: e.eventCode,
          }))}
          categories={categories}
          editing={editingProfile}
          onClose={() => {
            setProfileModalOpen(false);
            setEditingProfile(null);
          }}
          onSaved={(msg) => {
            setProfileModalOpen(false);
            setEditingProfile(null);
            setNotice({ kind: "ok", text: msg });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
