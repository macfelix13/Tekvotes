"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import {
  Trophy,
  Users,
  Wallet,
  Plus,
  Eye,
  Lock,
  CheckCircle2,
  Clock,
  Scale,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

export default function OrganizerDashboardPage() {
  const [activeTab, setActiveTab] = useState<"events" | "contestants" | "judging" | "funds">("events");
  const [visibilityMode, setVisibilityMode] = useState<"counts" | "percent" | "ranks_only">("counts");
  const [resultsState, setResultsState] = useState<"hidden" | "live" | "final">("live");
  const [payoutNotice, setPayoutNotice] = useState<string>("");
  const [resultsPublished, setResultsPublished] = useState(false);

  // Modals
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventCode, setNewEventCode] = useState("");
  const [newEventPrice, setNewEventPrice] = useState("1.00");

  const [showNewContestantModal, setShowNewContestantModal] = useState(false);
  const [newContestantName, setNewContestantName] = useState("");
  const [newContestantCode, setNewContestantCode] = useState("");
  const [newContestantCat, setNewContestantCat] = useState("Queen Category");

  const [orgEvents, setOrgEvents] = useState([
    {
      id: "ev-1",
      name: "Miss Hijab Ghana 3RD EDITION",
      code: "MHG26",
      approvalStatus: "approved",
      votingStatus: "active",
      totalVotes: 26810,
      grossBaseGhs: 26810.0,
      commissionGhs: 2681.0,
      netPayableGhs: 24129.0,
      escrowState: "Held in Escrow (Event Active)",
      closesAt: "Dec 21, 2026",
    },
    {
      id: "ev-0",
      name: "Model Tv Annual Fashion Honors 2025",
      code: "MFH25",
      approvalStatus: "approved",
      votingStatus: "closed",
      totalVotes: 14200,
      grossBaseGhs: 14200.0,
      commissionGhs: 1420.0,
      netPayableGhs: 12780.0,
      escrowState: "Released for Post-Event Transfer",
      closesAt: "Ended Nov 10, 2026",
    },
  ]);

  const [contestantList, setContestantList] = useState([
    { code: "FA01", name: "Fatima Abubakar", cat: "Queen Category", status: "Active", votes: 6840 },
    { code: "MZ04", name: "Mariam Zakaria", cat: "Queen Category", status: "Active", votes: 5910 },
    { code: "AS07", name: "Amina Sulemana", cat: "Queen Category", status: "Active", votes: 4320 },
    { code: "ZH02", name: "Zeinab Haruna", cat: "Queen Category", status: "Active", votes: 3890 },
  ]);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim() || !newEventCode.trim()) return;
    setOrgEvents((prev) => [
      {
        id: `ev-${Date.now()}`,
        name: newEventName.trim(),
        code: newEventCode.trim().toUpperCase(),
        approvalStatus: "pending_review",
        votingStatus: "scheduled",
        totalVotes: 0,
        grossBaseGhs: 0,
        commissionGhs: 0,
        netPayableGhs: 0,
        escrowState: "Pending Super Admin Voting Approval (OD-14)",
        closesAt: "Dec 31, 2026",
      },
      ...prev,
    ]);
    setNewEventName("");
    setNewEventCode("");
    setShowNewEventModal(false);
  };

  const handleAddContestant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContestantName.trim() || !newContestantCode.trim()) return;
    setContestantList((prev) => [
      ...prev,
      {
        code: newContestantCode.trim().toUpperCase(),
        name: newContestantName.trim(),
        cat: newContestantCat,
        status: "Active",
        votes: 0,
      },
    ]);
    setNewContestantName("");
    setNewContestantCode("");
    setShowNewContestantModal(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Top Org Header */}
          <div className="bg-[#0E1030] text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#F2A900] text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Verified Organizer Workspace
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">
                Model Tv Ghana — Organiser Portal
              </h1>
              <p className="text-xs sm:text-sm text-white/75 max-w-2xl">
                Manage events, contestant short codes, live leaderboard visibility, hybrid judging scores, and post-event settlement requests.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/competitions/miss-hijab-ghana-2026"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-all"
              >
                <Eye className="w-4 h-4" /> Public Event Page
              </Link>
              <button
                type="button"
                onClick={() => setShowNewEventModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F2A900] text-[#0E1030] font-bold text-xs hover:bg-[#D99600] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create New Event
              </button>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Total Credited Votes</span>
              <div className="font-heading font-extrabold text-2xl text-[#0E1030] mt-1">41,010</div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                100% ledger-verified whole votes
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Active Event Escrow (L-ORG-PEND)</span>
              <div className="font-heading font-extrabold text-2xl text-[#4B35E0] mt-1">GHS 24,129.00</div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                Unlocks after voting closes
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Closed Event Available (L-ORG-AVAIL)</span>
              <div className="font-heading font-extrabold text-2xl text-[#0F9D6B] mt-1">GHS 12,780.00</div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                Ready for Super Admin payout
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Leaderboard Mode (OD-11)</span>
              <div className="font-heading font-extrabold text-2xl text-[#0E1030] mt-1 capitalize">
                {resultsState} · {visibilityMode.replace("_", " ")}
              </div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                Real-time public visibility
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#D9DBEA] pb-3">
            {[
              { id: "events", label: "Events & Leaderboard Settings", icon: Trophy },
              { id: "contestants", label: `Contestants & Short Codes (${contestantList.length})`, icon: Users },
              { id: "judging", label: "Judging & Hybrid Results (OD-12)", icon: Scale },
              { id: "funds", label: "Event Funds & Post-Close Payouts", icon: Wallet },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-[#4B35E0] text-white shadow-sm"
                      : "bg-white text-[#5B5F85] hover:text-[#0E1030] border border-[#D9DBEA]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab 1: Events & Leaderboard Controls */}
          {activeTab === "events" && (
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
                <h2 className="font-heading font-bold text-lg text-[#0E1030]">Your Competitions</h2>
                <div className="space-y-4">
                  {orgEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#E8E5FD] text-[#4B35E0]">
                            {ev.code}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              ev.votingStatus === "active"
                                ? "bg-[#E6F8F0] text-[#0F9D6B]"
                                : ev.votingStatus === "closed"
                                ? "bg-[#D9DBEA] text-[#0E1030]"
                                : "bg-[#FDF3D6] text-[#C77700]"
                            }`}
                          >
                            Voting: {ev.votingStatus.toUpperCase()}
                          </span>
                        </div>
                        <h3 className="font-heading font-bold text-base text-[#0E1030]">{ev.name}</h3>
                        <p className="text-xs text-[#5B5F85]">
                          {ev.totalVotes.toLocaleString()} votes · Net Organiser Share:{" "}
                          <strong className="text-[#0E1030]">GHS {ev.netPayableGhs.toLocaleString()}</strong>
                        </p>
                      </div>

                      <div className="flex flex-col sm:items-end gap-2">
                        <span className="text-[11px] font-semibold text-[#5B5F85]">{ev.escrowState}</span>
                        <Link
                          href="/competitions/miss-hijab-ghana-2026"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#4B35E0] hover:underline"
                        >
                          View Public Page <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4 bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-5">
                <div>
                  <span className="text-xs font-bold uppercase text-[#4B35E0]">Rule OD-11 / ND-06</span>
                  <h3 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                    Live Leaderboard Visibility
                  </h3>
                  <p className="text-xs text-[#5B5F85] mt-1">
                    Control how voters see category standings during active voting.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#0E1030]">Category Results State</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["hidden", "live", "final"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setResultsState(st)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                          resultsState === st
                            ? "bg-[#0E1030] text-white border-[#0E1030]"
                            : "bg-[#F6F7FC] text-[#5B5F85] border-[#D9DBEA]"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#0E1030]">Public Display Mode</label>
                  <div className="space-y-2">
                    {[
                      { id: "counts", label: "Exact Vote Counts & Ranks (Default)" },
                      { id: "percent", label: "Percentage Share Only (%)" },
                      { id: "ranks_only", label: "Ranks Only (Hide Vote Totals)" },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setVisibilityMode(m.id as any)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-between ${
                          visibilityMode === m.id
                            ? "bg-[#E8E5FD] text-[#4B35E0] border-[#4B35E0]"
                            : "bg-[#F6F7FC] text-[#0E1030] border-[#D9DBEA]"
                        }`}
                      >
                        <span>{m.label}</span>
                        {visibilityMode === m.id && <CheckCircle2 className="w-4 h-4 text-[#4B35E0]" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Contestants */}
          {activeTab === "contestants" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading font-bold text-lg text-[#0E1030]">
                    Contestant Entries & Short Codes
                  </h2>
                  <p className="text-xs text-[#5B5F85]">
                    Each contestant receives a unique short code for instant voter lookup and QR flyers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewContestantModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] cursor-pointer"
                >
                  + Add Contestant
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D9DBEA] text-[#5B5F85] uppercase">
                      <th className="py-3 px-4">Short Code</th>
                      <th className="py-3 px-4">Contestant Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Credited Votes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DBEA]">
                    {contestantList.map((c) => (
                      <tr key={c.code} className="hover:bg-[#F6F7FC]">
                        <td className="py-3 px-4 font-mono font-bold text-[#4B35E0]">{c.code}</td>
                        <td className="py-3 px-4 font-semibold text-[#0E1030]">{c.name}</td>
                        <td className="py-3 px-4 text-[#5B5F85]">{c.cat}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-[#E6F8F0] text-[#0F9D6B] font-bold">
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-heading font-bold text-[#0E1030]">
                          {c.votes.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Judging Engine */}
          {activeTab === "judging" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D9DBEA] pb-4">
                <div>
                  <span className="text-xs font-bold uppercase text-[#4B35E0]">Phase 6 Adjudication Engine</span>
                  <h2 className="font-heading font-bold text-lg text-[#0E1030]">
                    Hybrid Public Vote (50%) + Judge Score (50%) Calculation
                  </h2>
                  <p className="text-xs text-[#5B5F85]">
                    Submitted judge scores are locked from direct mutation (Q38). Missing judge scores block final publication (OD-12).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E6F8F0] text-[#0F9D6B] text-xs font-bold">
                    <Lock className="w-3.5 h-3.5" /> All Judge Submissions Locked
                  </span>
                  {!resultsPublished ? (
                    <button
                      type="button"
                      onClick={() => {
                        setResultsPublished(true);
                        setResultsState("final");
                      }}
                      className="px-4 py-2 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] cursor-pointer"
                    >
                      Publish Official Final Results
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#0E1030] text-[#F2A900] text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Final Snapshot Published
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D9DBEA] text-[#5B5F85] uppercase">
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Contestant</th>
                      <th className="py-3 px-4">Public Score (0-100)</th>
                      <th className="py-3 px-4">Judge Score (0-100)</th>
                      <th className="py-3 px-4">Weighted Final (50/50)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DBEA]">
                    <tr className="bg-[#FDF3D6]/40">
                      <td className="py-3 px-4 font-heading font-bold text-[#C77700]">#1</td>
                      <td className="py-3 px-4 font-bold text-[#0E1030]">Fatima Abubakar (FA01)</td>
                      <td className="py-3 px-4">32.63</td>
                      <td className="py-3 px-4">88.50</td>
                      <td className="py-3 px-4 font-heading font-extrabold text-[#4B35E0]">60.57</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-heading font-bold text-[#5B5F85]">#2</td>
                      <td className="py-3 px-4 font-bold text-[#0E1030]">Mariam Zakaria (MZ04)</td>
                      <td className="py-3 px-4">28.19</td>
                      <td className="py-3 px-4">84.00</td>
                      <td className="py-3 px-4 font-heading font-extrabold text-[#0E1030]">56.10</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 4: Funds & Post-Close Settlements */}
          {activeTab === "funds" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-6">
              <div className="p-4 rounded-2xl bg-[#E8E5FD]/60 border border-[#4B35E0]/30 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-[#4B35E0] shrink-0 mt-0.5" />
                <div className="text-xs text-[#0E1030] space-y-1">
                  <p className="font-bold">Confirmed Governance Rule: Post-Event Fund Transfers & Refunds</p>
                  <p className="text-[#5B5F85]">
                    All voting funds are collected centrally by the Super Admin account and recorded per event (<code className="font-mono">v_event_funds</code>) and per organization (<code className="font-mono">v_org_funds</code>). Transfers to organisers and voter refunds are unlocked strictly after the voting event ends (<code className="font-mono">voting_status = &apos;closed&apos;</code>).
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D9DBEA] text-[#5B5F85] uppercase">
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Voting Status</th>
                      <th className="py-3 px-4">Gross Base Votes</th>
                      <th className="py-3 px-4">Platform Comm (10%)</th>
                      <th className="py-3 px-4">Net Organiser Fund</th>
                      <th className="py-3 px-4 text-right">Settlement Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DBEA]">
                    {orgEvents.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-3.5 px-4 font-bold text-[#0E1030]">{ev.name}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold ${
                              ev.votingStatus === "closed"
                                ? "bg-[#E6F8F0] text-[#0F9D6B]"
                                : "bg-[#FDF3D6] text-[#C77700]"
                            }`}
                          >
                            {ev.votingStatus.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">GHS {ev.grossBaseGhs.toFixed(2)}</td>
                        <td className="py-3.5 px-4 font-mono text-[#5B5F85]">GHS {ev.commissionGhs.toFixed(2)}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[#0E1030]">
                          GHS {ev.netPayableGhs.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {ev.votingStatus === "closed" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPayoutNotice(
                                  `Settlement request for ${ev.name} (GHS ${ev.netPayableGhs.toFixed(2)}) submitted to Super Admin for dual-approval payout.`
                                )
                              }
                              className="px-3.5 py-1.5 rounded-lg bg-[#0F9D6B] text-white font-bold hover:bg-[#0C8258] cursor-pointer"
                            >
                              Request Post-Event Payout
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#5B5F85] font-medium">
                              <Clock className="w-3.5 h-3.5" /> Locked Until Event Ends
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {payoutNotice && (
                <div className="p-4 rounded-xl bg-[#E6F8F0] border border-[#0F9D6B] text-[#0F9D6B] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{payoutNotice}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal 1: Create New Event Wizard */}
      {showNewEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#D9DBEA] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#D9DBEA] pb-3">
              <div>
                <span className="text-xs font-bold uppercase text-[#4B35E0]">New Competition</span>
                <h3 className="font-heading font-extrabold text-lg text-[#0E1030]">
                  Create Event & Submit for Approval
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewEventModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F6F7FC]"
              >
                <X className="w-5 h-5 text-[#5B5F85]" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="e.g. Ghana Tertiary Excellence Awards 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1">
                    Event Public Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newEventCode}
                    onChange={(e) => setNewEventCode(e.target.value)}
                    placeholder="e.g. GTEA26"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono text-xs text-[#0E1030]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1">
                    Vote Unit Price (GHS)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0.50"
                    value={newEventPrice}
                    onChange={(e) => setNewEventPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono text-xs text-[#0E1030]"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[#5B5F85]">
                Per Rule OD-14 / ND-07, your event can be previewed as &quot;Coming Soon&quot; immediately while Super Admin reviews voting activation.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewEventModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#5B5F85]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] cursor-pointer"
                >
                  Create & Request Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Contestant */}
      {showNewContestantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#D9DBEA] shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#D9DBEA] pb-3">
              <div>
                <span className="text-xs font-bold uppercase text-[#4B35E0]">Register Nominee</span>
                <h3 className="font-heading font-extrabold text-lg text-[#0E1030]">
                  Add Contestant & Short Code
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewContestantModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F6F7FC]"
              >
                <X className="w-5 h-5 text-[#5B5F85]" />
              </button>
            </div>

            <form onSubmit={handleAddContestant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1">
                  Contestant Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newContestantName}
                  onChange={(e) => setNewContestantName(e.target.value)}
                  placeholder="e.g. Khadija Osman"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1">
                    Short Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newContestantCode}
                    onChange={(e) => setNewContestantCode(e.target.value)}
                    placeholder="e.g. KO15"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono text-xs text-[#0E1030]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newContestantCat}
                    onChange={(e) => setNewContestantCat(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewContestantModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#5B5F85]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] cursor-pointer"
                >
                  Add Contestant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
