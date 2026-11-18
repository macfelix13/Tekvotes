"use client";

import { useState } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import {
  ShieldCheck,
  Building2,
  Landmark,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";

export default function SuperAdminConsolePage() {
  const [releasedEvents, setReleasedEvents] = useState<Record<string, boolean>>({
    "ev-closed-1": true,
  });
  const [approvedSettlements, setApprovedSettlements] = useState<Record<string, boolean>>({});

  const eventFunds = [
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
  ];

  const orgFunds = [
    {
      orgSlug: "model-tv-ghana",
      orgName: "Model Tv Ghana",
      eventsCount: 2,
      totalBaseVotesGhs: 41010.0,
      totalCommissionGhs: 4101.0,
      pendingEscrowGhs: 24129.0,
      availablePostCloseGhs: 12780.0,
    },
    {
      orgSlug: "mempeasem-circuit-myf",
      orgName: "Mempeasem Circuit MYF",
      eventsCount: 1,
      totalBaseVotesGhs: 12950.0,
      totalCommissionGhs: 1295.0,
      pendingEscrowGhs: 11655.0,
      availablePostCloseGhs: 0.0,
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
              <div className="font-heading font-extrabold text-2xl text-[#C77700] mt-1">GHS 35,784.00</div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                Locked while voting is active
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Closed Events Ready for Transfer</span>
              <div className="font-heading font-extrabold text-2xl text-[#0F9D6B] mt-1">GHS 43,479.00</div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                Eligible for post-close settlement
              </span>
            </div>
          </div>

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
                            <span className="inline-flex items-center gap-1 text-[#C77700] font-semibold">
                              <Lock className="w-3.5 h-3.5" /> Held Until Voting Ends
                            </span>
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
        </div>
      </main>
    </div>
  );
}
