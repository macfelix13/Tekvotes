"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navigation/Navbar";
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
} from "lucide-react";

export default function SuperAdminConsolePage() {
  const [activeTab, setActiveTab] = useState<"treasury" | "approvals" | "refunds">("treasury");

  const [eventFunds, setEventFunds] = useState([
    {
      id: "ev-active-1",
      eventCode: "MHG26",
      eventName: "Miss Hijab Ghana 3RD EDITION",
      orgName: "Model Tv Ghana",
      votingStatus: "active",
      grossCollectedGhs: 27332.8,
      baseVotesGhs: 26810.0,
      surchargeRecoveredGhs: 522.8,
      platformCommissionGhs: 2681.0,
      orgNetFundGhs: 24129.0,
    },
    {
      id: "ev-active-2",
      eventCode: "MYF26",
      eventName: "MEMPEASEM CIRCUIT MYF DINNER & AWARDS",
      orgName: "Mempeasem Circuit MYF",
      votingStatus: "active",
      grossCollectedGhs: 13202.53,
      baseVotesGhs: 12950.0,
      surchargeRecoveredGhs: 252.53,
      platformCommissionGhs: 1295.0,
      orgNetFundGhs: 11655.0,
    },
    {
      id: "ev-closed-1",
      eventCode: "MFH25",
      eventName: "Model Tv Annual Fashion Honors 2025",
      orgName: "Model Tv Ghana",
      votingStatus: "closed",
      grossCollectedGhs: 14476.9,
      baseVotesGhs: 14200.0,
      surchargeRecoveredGhs: 276.9,
      platformCommissionGhs: 1420.0,
      orgNetFundGhs: 12780.0,
    },
    {
      id: "ev-closed-2",
      eventCode: "KTS25",
      eventName: "KID'S TALENT SHOW 4th Edition",
      orgName: "Kids Talent Show Network",
      votingStatus: "closed",
      grossCollectedGhs: 34775.15,
      baseVotesGhs: 34110.0,
      surchargeRecoveredGhs: 665.15,
      platformCommissionGhs: 3411.0,
      orgNetFundGhs: 30699.0,
    },
  ]);

  const [releasedEvents, setReleasedEvents] = useState<Record<string, boolean>>({
    "ev-closed-1": true,
  });
  const [approvedSettlements, setApprovedSettlements] = useState<Record<string, boolean>>({});

  const [pendingApps, setPendingApps] = useState([
    {
      id: "app-1",
      orgName: "Gospel Music Guild Ghana",
      applicant: "Rev. Samuel Osei (samuel@gospelguild.gh)",
      eventType: "Ghana National Gospel Music Honors 2026",
      status: "pending",
    },
    {
      id: "app-2",
      orgName: "Ashanti Youth Excellence Foundation",
      applicant: "Nana Kwame Boateng (kwame@ayef.org)",
      eventType: "Kumasi Student Leadership Awards",
      status: "pending",
    },
  ]);

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem("tekvotes_org_applications") || "[]");
      if (Array.isArray(stored) && stored.length > 0) {
        setPendingApps((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const additions = stored.filter((a: any) => !existingIds.has(a.id));
          return [...additions, ...prev];
        });
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const [pendingRefunds, setPendingRefunds] = useState([
    {
      id: "ref-1",
      orderRef: "TK-710294",
      voterPhone: "024 891 2201",
      eventName: "Model Tv Annual Fashion Honors 2025 (CLOSED)",
      amountGhs: "50.98",
      reason: "Late payment webhook arrived 410s after close (>180s grace window ND-01 · paid_uncredited)",
      status: "pending_post_close_refund",
    },
  ]);

  const closeEventVoting = (id: string) => {
    setEventFunds((prev) => prev.map((e) => (e.id === id ? { ...e, votingStatus: "closed" } : e)));
  };

  const orgFunds = [
    {
      orgSlug: "model-tv-ghana",
      orgName: "Model Tv Ghana",
      eventsCount: 2,
      totalBaseVotesGhs: 41010.0,
      totalCommissionGhs: 4101.0,
      pendingEscrowGhs: eventFunds.find((e) => e.id === "ev-active-1")?.votingStatus === "active" ? 24129.0 : 0.0,
      availablePostCloseGhs:
        eventFunds.find((e) => e.id === "ev-active-1")?.votingStatus === "closed" ? 36909.0 : 12780.0,
    },
    {
      orgSlug: "mempeasem-circuit-myf",
      orgName: "Mempeasem Circuit MYF",
      eventsCount: 1,
      totalBaseVotesGhs: 12950.0,
      totalCommissionGhs: 1295.0,
      pendingEscrowGhs: eventFunds.find((e) => e.id === "ev-active-2")?.votingStatus === "active" ? 11655.0 : 0.0,
      availablePostCloseGhs:
        eventFunds.find((e) => e.id === "ev-active-2")?.votingStatus === "closed" ? 11655.0 : 0.0,
    },
    {
      orgSlug: "kids-talent-network",
      orgName: "Kids Talent Show Network",
      eventsCount: 1,
      totalBaseVotesGhs: 34110.0,
      totalCommissionGhs: 3411.0,
      pendingEscrowGhs: 0.0,
      availablePostCloseGhs: 30699.0,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Super Admin Banner */}
          <div className="bg-gradient-to-r from-[#0E1030] to-[#231B68] text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2A900] text-[#0E1030] text-xs font-extrabold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" /> Super Admin Root Authority · frametek93@gmail.com
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">
                TekVotes Central Treasury & Governance Console
              </h1>
              <p className="text-xs sm:text-sm text-white/80 max-w-3xl">
                All voter payments are received into the central Super Admin Paystack account. Every transaction is permanently recorded in the double-entry ledger by Event (<code className="font-mono text-[#F2A900]">v_event_funds</code>) and by Organization (<code className="font-mono text-[#F2A900]">v_org_funds</code>). Payout transfers & refunds are executed strictly after an event closes.
              </p>
            </div>
          </div>

          {/* Central Treasury Metrics */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Total Central Paystack Collections</span>
              <div className="font-heading font-extrabold text-2xl text-[#0E1030] mt-1">GHS 89,787.38</div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                Base votes + voter fee surcharges
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">TekVotes Platform Commission (10%)</span>
              <div className="font-heading font-extrabold text-2xl text-[#4B35E0] mt-1">GHS 8,807.00</div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                Earned on base vote amount (OD-01)
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Active Events Escrow (Held)</span>
              <div className="font-heading font-extrabold text-2xl text-[#C77700] mt-1">
                GHS{" "}
                {eventFunds
                  .filter((e) => e.votingStatus !== "closed")
                  .reduce((acc, e) => acc + e.orgNetFundGhs, 0)
                  .toLocaleString()}
              </div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                Locked while voting is active
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Closed Events Ready for Transfer</span>
              <div className="font-heading font-extrabold text-2xl text-[#0F9D6B] mt-1">
                GHS{" "}
                {eventFunds
                  .filter((e) => e.votingStatus === "closed")
                  .reduce((acc, e) => acc + e.orgNetFundGhs, 0)
                  .toLocaleString()}
              </div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                Eligible for post-close settlement
              </span>
            </div>
          </div>

          {/* Admin Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#D9DBEA] pb-3">
            {[
              { id: "treasury", label: "Event & Org Fund Ledgers (v_event_funds / v_org_funds)", icon: Landmark },
              { id: "approvals", label: `Organiser & Event Approvals (${pendingApps.filter((a) => a.status === "pending").length})`, icon: ClipboardCheck },
              { id: "refunds", label: "Post-Event Voter Refunds (ND-01)", icon: RotateCcw },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === t.id
                      ? "bg-[#4B35E0] text-white shadow-sm"
                      : "bg-white text-[#5B5F85] hover:text-[#0E1030] border border-[#D9DBEA]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === "treasury" && (
            <>
              {/* 1. Per-Event Fund Records (v_event_funds) */}
              <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9DBEA] pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-[#4B35E0] flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4" /> Ledger View: fin.v_event_funds
                    </span>
                    <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                      Per-Event Fund Records & Post-Close Release Controls
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
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Gross Collected</th>
                        <th className="py-3 px-3">Base Votes</th>
                        <th className="py-3 px-3">TekVotes Comm</th>
                        <th className="py-3 px-3">Net Organiser Fund</th>
                        <th className="py-3 px-3 text-right">Post-Event Fund Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9DBEA]">
                      {eventFunds.map((ef) => {
                        const isReleased = !!releasedEvents[ef.id];
                        const isSettled = !!approvedSettlements[ef.id];
                        return (
                          <tr key={ef.id} className="hover:bg-[#F6F7FC]">
                            <td className="py-3.5 px-3">
                              <span className="font-mono font-bold text-[#4B35E0] mr-1.5">{ef.eventCode}</span>
                              <span className="font-semibold text-[#0E1030]">{ef.eventName}</span>
                            </td>
                            <td className="py-3.5 px-3 text-[#5B5F85]">{ef.orgName}</td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold ${
                                  ef.votingStatus === "closed"
                                    ? "bg-[#D9DBEA] text-[#0E1030]"
                                    : "bg-[#E6F8F0] text-[#0F9D6B]"
                                }`}
                              >
                                {ef.votingStatus.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 font-mono">GHS {ef.grossCollectedGhs.toLocaleString()}</td>
                            <td className="py-3.5 px-3 font-mono">GHS {ef.baseVotesGhs.toLocaleString()}</td>
                            <td className="py-3.5 px-3 font-mono text-[#4B35E0] font-semibold">
                              GHS {ef.platformCommissionGhs.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-3 font-mono font-extrabold text-[#0E1030]">
                              GHS {ef.orgNetFundGhs.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              {ef.votingStatus !== "closed" ? (
                                <div className="inline-flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 text-[#C77700] font-semibold">
                                    <Lock className="w-3.5 h-3.5" /> Held in Escrow
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => closeEventVoting(ef.id)}
                                    title="Simulate Event Closing to unlock post-event transfer"
                                    className="px-2.5 py-1 rounded-lg bg-[#0E1030] text-white text-[11px] font-bold hover:bg-[#1A1D47] cursor-pointer inline-flex items-center gap-1"
                                  >
                                    <Power className="w-3 h-3 text-[#F2A900]" /> End Event
                                  </button>
                                </div>
                              ) : !isReleased ? (
                                <button
                                  type="button"
                                  onClick={() => setReleasedEvents((p) => ({ ...p, [ef.id]: true }))}
                                  className="px-3 py-1.5 rounded-lg bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] cursor-pointer"
                                >
                                  Release Closed Event Funds
                                </button>
                              ) : !isSettled ? (
                                <button
                                  type="button"
                                  onClick={() => setApprovedSettlements((p) => ({ ...p, [ef.id]: true }))}
                                  className="px-3 py-1.5 rounded-lg bg-[#0F9D6B] text-white font-bold hover:bg-[#0C8258] cursor-pointer"
                                >
                                  Approve Bank/MoMo Transfer
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[#0F9D6B] font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Transferred Post-Close
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Per-Organization Fund Records (v_org_funds) */}
              <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
                <div className="border-b border-[#D9DBEA] pb-4">
                  <span className="text-xs font-bold uppercase text-[#4B35E0] flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" /> Ledger View: fin.v_org_funds
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
                        <th className="py-3 px-4">Events Hosted</th>
                        <th className="py-3 px-4">Cumulative Base Votes</th>
                        <th className="py-3 px-4">Platform Commission</th>
                        <th className="py-3 px-4">Active Escrow (L-ORG-PEND)</th>
                        <th className="py-3 px-4 text-right">Closed Available (L-ORG-AVAIL)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D9DBEA]">
                      {orgFunds.map((of) => (
                        <tr key={of.orgSlug} className="hover:bg-[#F6F7FC]">
                          <td className="py-3.5 px-4 font-bold text-[#0E1030] flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-[#4B35E0]" />
                            {of.orgName}
                          </td>
                          <td className="py-3.5 px-4">{of.eventsCount}</td>
                          <td className="py-3.5 px-4 font-mono">GHS {of.totalBaseVotesGhs.toLocaleString()}</td>
                          <td className="py-3.5 px-4 font-mono text-[#4B35E0] font-semibold">
                            GHS {of.totalCommissionGhs.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[#C77700] font-semibold">
                            GHS {of.pendingEscrowGhs.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-extrabold text-[#0F9D6B]">
                            GHS {of.availablePostCloseGhs.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === "approvals" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
              <div>
                <span className="text-xs font-bold uppercase text-[#4B35E0]">Tenant Onboarding & OD-14 Gate</span>
                <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                  Pending Organiser Applications & Voting Activations
                </h2>
              </div>

              <div className="space-y-3">
                {pendingApps.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <h3 className="font-heading font-bold text-base text-[#0E1030]">{app.orgName}</h3>
                      <p className="text-xs text-[#5B5F85]">{app.applicant}</p>
                      <p className="text-xs font-semibold text-[#4B35E0] mt-1">
                        Proposed Event: {app.eventType}
                      </p>
                    </div>
                    <div>
                      {app.status === "pending" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingApps((prev) =>
                              prev.map((a) => (a.id === app.id ? { ...a, status: "approved" } : a))
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-[#0F9D6B] text-white text-xs font-bold hover:bg-[#0C8258] cursor-pointer"
                        >
                          Approve Organiser & Provision Workspace
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0F9D6B]">
                          <CheckCircle2 className="w-4 h-4" /> Approved & Tenant Provisioned
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "refunds" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
              <div>
                <span className="text-xs font-bold uppercase text-[#4B35E0]">Rule ND-01 · Late Payment Governance</span>
                <h2 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                  Post-Close Uncredited Orders Eligible for Voter Refund
                </h2>
                <p className="text-xs text-[#5B5F85]">
                  Orders paid outside the 180-second post-close grace window are marked <code className="font-mono">paid_uncredited</code> and queued for post-event refund.
                </p>
              </div>

              <div className="space-y-3">
                {pendingRefunds.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#4B35E0]">{r.orderRef}</span>
                        <span className="text-xs font-semibold text-[#0E1030]">Voter MoMo: {r.voterPhone}</span>
                      </div>
                      <p className="text-xs font-bold text-[#0E1030]">{r.eventName}</p>
                      <p className="text-xs text-[#5B5F85]">{r.reason}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-sm text-[#0E1030]">GHS {r.amountGhs}</span>
                      {r.status === "pending_post_close_refund" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingRefunds((prev) =>
                              prev.map((x) => (x.id === r.id ? { ...x, status: "refunded" } : x))
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] cursor-pointer"
                        >
                          Execute Post-Event Refund
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0F9D6B]">
                          <CheckCircle2 className="w-4 h-4" /> Refund Disbursed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
