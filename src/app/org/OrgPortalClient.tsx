"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import type { OrgMembership } from "@/lib/auth";
import {
  Trophy,
  Users,
  Wallet,
  Plus,
  Eye,
  Lock,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
  X,
  LogOut,
  Send,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface OrgEventRow {
  id: string;
  slug: string;
  name: string;
  code: string;
  eventType: string;
  approvalStatus: string;
  votingStatus: string;
  totalVotes: number;
  pendingEscrowMinor: number;
  availableMinor: number;
  currency: string;
}

export interface OrgCategoryRow {
  id: string;
  eventId: string;
  eventName: string;
  name: string;
  unitPriceMinor: number;
  resultsState: "hidden" | "live" | "final";
  liveVisibility: "ranks_only" | "counts" | "percent";
}

export interface OrgContestantRow {
  categoryEntryId: string;
  code: string;
  name: string;
  eventName: string;
  categoryName: string;
  status: string;
  votes: number;
}

interface OrgPortalProps {
  userEmail: string;
  org: OrgMembership;
  events: OrgEventRow[];
  categories: OrgCategoryRow[];
  contestants: OrgContestantRow[];
  totals: {
    totalVotes: number;
    pendingEscrowMinor: number;
    availableMinor: number;
    inFlightMinor: number;
  };
}

const fmtGhs = (minor: number, currency = "GHS") =>
  `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function OrgPortalClient({
  userEmail,
  org,
  events,
  categories,
  contestants,
  totals,
}: OrgPortalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"events" | "contestants" | "funds">("events");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Create Event modal state
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventCode, setNewEventCode] = useState("");
  const [newEventType, setNewEventType] = useState<"beauty_pageant" | "award_show" | "talent_show" | "campus_contest" | "other">("beauty_pageant");
  const [newCategoryName, setNewCategoryName] = useState("Main Category");
  const [newEventPrice, setNewEventPrice] = useState("1.00");

  // Add Contestant modal state
  const [showNewContestantModal, setShowNewContestantModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    categories.find((c) => c.eventId === (events[0]?.id ?? ""))?.id ?? categories[0]?.id ?? ""
  );
  const [newContestantName, setNewContestantName] = useState("");
  const [newContestantCode, setNewContestantCode] = useState("");

  // Leaderboard visibility editor state
  const [editCatId, setEditCatId] = useState(categories[0]?.id ?? "");
  const activeCat = categories.find((c) => c.id === editCatId) ?? categories[0];
  const [visState, setVisState] = useState<"hidden" | "live" | "final">(activeCat?.resultsState ?? "live");
  const [visMode, setVisMode] = useState<"ranks_only" | "counts" | "percent">(activeCat?.liveVisibility ?? "counts");

  const handleSelectEditCategory = (catId: string) => {
    setEditCatId(catId);
    const cat = categories.find((c) => c.id === catId);
    if (cat) {
      setVisState(cat.resultsState);
      setVisMode(cat.liveVisibility);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId("create-event");
    setNotice(null);
    try {
      const res = await fetch("/api/v1/org/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          name: newEventName.trim(),
          publicCode: newEventCode.trim(),
          eventType: newEventType,
          categoryName: newCategoryName.trim() || "Main Category",
          unitPriceGhs: Number(newEventPrice) || 1,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Failed to create event." });
        return;
      }
      setShowNewEventModal(false);
      setNewEventName("");
      setNewEventCode("");
      setNotice({ kind: "ok", text: `Created event "${data.event.name}" (${data.event.public_code}).` });
      router.refresh();
    } catch {
      setNotice({ kind: "err", text: "Network error creating event." });
    } finally {
      setBusyId(null);
    }
  };

  const handleAddContestant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyId("create-contestant");
    setNotice(null);
    try {
      const res = await fetch("/api/v1/org/contestants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          eventId: selectedEventId,
          categoryId: selectedCategoryId,
          displayName: newContestantName.trim(),
          publicCode: newContestantCode.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Failed to register contestant." });
        return;
      }
      setShowNewContestantModal(false);
      setNewContestantName("");
      setNewContestantCode("");
      setNotice({
        kind: "ok",
        text: `Added contestant ${data.contestant.display_name} (${data.entry.public_code}).`,
      });
      router.refresh();
    } catch {
      setNotice({ kind: "err", text: "Network error adding contestant." });
    } finally {
      setBusyId(null);
    }
  };

  const handleSubmitForApproval = async (eventId: string) => {
    setBusyId(eventId);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/org/events/${eventId}/submit`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Unable to submit event for approval." });
        return;
      }
      setNotice({ kind: "ok", text: "Event submitted to Super Admin for voting approval." });
      router.refresh();
    } catch {
      setNotice({ kind: "err", text: "Network error submitting event." });
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveVisibility = async () => {
    if (!activeCat) return;
    setBusyId("save-visibility");
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/org/categories/${activeCat.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          resultsState: visState,
          liveVisibility: visMode,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Failed to update visibility." });
        return;
      }
      setNotice({ kind: "ok", text: `Updated leaderboard visibility for "${activeCat.name}".` });
      router.refresh();
    } catch {
      setNotice({ kind: "err", text: "Network error saving visibility." });
    } finally {
      setBusyId(null);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  };

  const categoriesForSelectedEvent = categories.filter((c) => c.eventId === selectedEventId);

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-[#0E1030] text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#F2A900] text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Verified Organizer Workspace · {userEmail}
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">
                {org.name} — Organiser Portal
              </h1>
              <p className="text-xs sm:text-sm text-white/75 max-w-2xl">
                Create events, register contestants with short codes, manage leaderboard visibility, and track escrowed &amp; post-close balances.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {events[0] ? (
                <Link
                  href={`/competitions/${events[0].slug}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15"
                >
                  <Eye className="w-4 h-4" /> Public Event Page
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setShowNewEventModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F2A900] text-[#0E1030] font-bold text-xs hover:bg-[#D99600] cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create New Event
              </button>
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
              <span className="text-xs font-semibold text-[#5B5F85]">Total Credited Votes</span>
              <div className="font-heading font-extrabold text-2xl text-[#0E1030] mt-1">
                {totals.totalVotes.toLocaleString()}
              </div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                Ledger-verified whole votes
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Held Escrow (L-ORG-PEND)</span>
              <div className="font-heading font-extrabold text-2xl text-[#4B35E0] mt-1">
                {fmtGhs(totals.pendingEscrowMinor, org.defaultCurrency)}
              </div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                Unlocks after voting closes
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Available Post-Close (L-ORG-AVAIL)</span>
              <div className="font-heading font-extrabold text-2xl text-[#0F9D6B] mt-1">
                {fmtGhs(totals.availableMinor, org.defaultCurrency)}
              </div>
              <span className="text-[11px] text-[#0F9D6B] font-semibold mt-1 block">
                Ready for Super Admin settlement
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D9DBEA] shadow-xs">
              <span className="text-xs font-semibold text-[#5B5F85]">Published Competitions</span>
              <div className="font-heading font-extrabold text-2xl text-[#0E1030] mt-1">
                {events.length}
              </div>
              <span className="text-[11px] text-[#5B5F85] mt-1 block">
                {contestants.length} registered entries
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[#D9DBEA] pb-3">
            {(
              [
                { id: "events", label: `Events & Visibility (${events.length})`, Icon: Trophy },
                { id: "contestants", label: `Contestants & Short Codes (${contestants.length})`, Icon: Users },
                { id: "funds", label: "Event Funds & Post-Close Payouts", Icon: Wallet },
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

          {activeTab === "events" && (
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
                <h2 className="font-heading font-bold text-lg text-[#0E1030]">Your Competitions</h2>
                {events.length === 0 ? (
                  <p className="text-sm text-[#5B5F85]">
                    No events yet. Click <strong>Create New Event</strong> above to start.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {events.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#E8E5FD] text-[#4B35E0]">
                              {ev.code}
                            </span>
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-[#D9DBEA] text-[#0E1030]">
                              Approval: {ev.approvalStatus}
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
                            {ev.totalVotes.toLocaleString()} votes · Pending Escrow:{" "}
                            <strong className="text-[#0E1030]">{fmtGhs(ev.pendingEscrowMinor, ev.currency)}</strong> ·
                            Available:{" "}
                            <strong className="text-[#0F9D6B]">{fmtGhs(ev.availableMinor, ev.currency)}</strong>
                          </p>
                        </div>

                        <div className="flex flex-col sm:items-end gap-2">
                          {(ev.approvalStatus === "not_submitted" || ev.approvalStatus === "rejected") && (
                            <button
                              type="button"
                              disabled={busyId === ev.id}
                              onClick={() => void handleSubmitForApproval(ev.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
                            >
                              {busyId === ev.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              Submit for Approval
                            </button>
                          )}
                          <Link
                            href={`/competitions/${ev.slug}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#4B35E0] hover:underline"
                          >
                            View Public Page <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-5">
                <div>
                  <span className="text-xs font-bold uppercase text-[#4B35E0]">Rule OD-11 / ND-06</span>
                  <h3 className="font-heading font-bold text-lg text-[#0E1030] mt-0.5">
                    Category Leaderboard Visibility
                  </h3>
                </div>

                {activeCat ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-[#0E1030] mb-1.5">Category</label>
                      <select
                        value={activeCat.id}
                        onChange={(e) => handleSelectEditCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.eventName} — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#0E1030]">Results State</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["hidden", "live", "final"] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setVisState(st)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                              visState === st
                                ? "bg-[#0E1030] text-white border-[#0E1030]"
                                : "bg-[#F6F7FC] text-[#5B5F85] border-[#D9DBEA]"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[#0E1030]">Public Display Mode</label>
                      {(
                        [
                          { id: "counts", label: "Exact Vote Counts & Ranks" },
                          { id: "percent", label: "Percentage Share Only (%)" },
                          { id: "ranks_only", label: "Ranks Only (Hide Counts)" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setVisMode(m.id)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center justify-between ${
                            visMode === m.id
                              ? "bg-[#E8E5FD] text-[#4B35E0] border-[#4B35E0]"
                              : "bg-[#F6F7FC] text-[#0E1030] border-[#D9DBEA]"
                          }`}
                        >
                          <span>{m.label}</span>
                          {visMode === m.id ? <CheckCircle2 className="w-4 h-4 text-[#4B35E0]" /> : null}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={busyId === "save-visibility"}
                      onClick={() => void handleSaveVisibility()}
                      className="w-full py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
                    >
                      {busyId === "save-visibility" ? "Saving..." : "Save Visibility Settings"}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-[#5B5F85]">Create an event first to configure category visibility.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === "contestants" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading font-bold text-lg text-[#0E1030]">
                    Contestant Entries &amp; Short Codes
                  </h2>
                  <p className="text-xs text-[#5B5F85]">
                    Every registered contestant receives a unique short code for instant voter lookup.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={events.length === 0}
                  onClick={() => setShowNewContestantModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
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
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Verified Votes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9DBEA]">
                    {contestants.map((c) => (
                      <tr key={c.categoryEntryId} className="hover:bg-[#F6F7FC]">
                        <td className="py-3 px-4 font-mono font-bold text-[#4B35E0]">{c.code}</td>
                        <td className="py-3 px-4 font-bold text-[#0E1030]">{c.name}</td>
                        <td className="py-3 px-4 text-[#5B5F85]">{c.eventName}</td>
                        <td className="py-3 px-4 text-[#5B5F85]">{c.categoryName}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-[#E6F8F0] text-[#0F9D6B] font-bold">
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#0E1030]">
                          {c.votes.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {contestants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#5B5F85]">
                          No contestants registered yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "funds" && (
            <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#D9DBEA]">
                <div>
                  <span className="text-xs font-bold uppercase text-[#4B35E0]">Central Paystack Ledger</span>
                  <h2 className="font-heading font-bold text-lg text-[#0E1030]">
                    Event Escrow &amp; Post-Close Payout Balances
                  </h2>
                </div>
                <span className="text-xs font-semibold text-[#5B5F85] inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#C77700]" />
                  In-Flight Settlement: {fmtGhs(totals.inFlightMinor, org.defaultCurrency)}
                </span>
              </div>

              <div className="space-y-3">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#4B35E0] mr-2">{ev.code}</span>
                      <strong className="text-sm text-[#0E1030]">{ev.name}</strong>
                      <p className="text-[#5B5F85] mt-0.5">Voting status: {ev.votingStatus.toUpperCase()}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="text-[#5B5F85] block">Escrow Held</span>
                        <span className="font-mono font-bold text-[#C77700]">
                          {fmtGhs(ev.pendingEscrowMinor, ev.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#5B5F85] block">Available Post-Close</span>
                        <span className="font-mono font-extrabold text-[#0F9D6B]">
                          {fmtGhs(ev.availableMinor, ev.currency)}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#5B5F85]">
                        {ev.votingStatus === "closed" ? (
                          <CheckCircle2 className="w-4 h-4 text-[#0F9D6B]" />
                        ) : (
                          <Lock className="w-4 h-4 text-[#C77700]" />
                        )}
                        {ev.votingStatus === "closed" ? "Post-Close" : "Locked Active"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {showNewEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#D9DBEA] shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-xl text-[#0E1030]">Create Competition</h3>
              <button type="button" onClick={() => setShowNewEventModal(false)} className="p-1.5 rounded-full hover:bg-[#F6F7FC]">
                <X className="w-5 h-5 text-[#5B5F85]" />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="e.g. TekVotes Campus Awards 2026"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#5B5F85] uppercase mb-1">Short Code *</label>
                  <input
                    type="text"
                    required
                    value={newEventCode}
                    onChange={(e) => setNewEventCode(e.target.value)}
                    placeholder="e.g. TCA26"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-mono text-[#0E1030]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5B5F85] uppercase mb-1">Price / Vote (GHS) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={newEventPrice}
                    onChange={(e) => setNewEventPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#5B5F85] uppercase mb-1">Type</label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value as typeof newEventType)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                  >
                    <option value="beauty_pageant">Beauty Pageant</option>
                    <option value="award_show">Award Show</option>
                    <option value="talent_show">Talent Show</option>
                    <option value="campus_contest">Campus Contest</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#5B5F85] uppercase mb-1">First Category *</label>
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={busyId === "create-event"}
                className="w-full py-3 rounded-xl bg-[#4B35E0] text-white font-bold text-sm hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
              >
                {busyId === "create-event" ? "Creating Event..." : "Publish Event Preview"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showNewContestantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#D9DBEA] shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-extrabold text-xl text-[#0E1030]">Register Contestant</h3>
              <button type="button" onClick={() => setShowNewContestantModal(false)} className="p-1.5 rounded-full hover:bg-[#F6F7FC]">
                <X className="w-5 h-5 text-[#5B5F85]" />
              </button>
            </div>
            <form onSubmit={handleAddContestant} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Event *</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    const evId = e.target.value;
                    setSelectedEventId(evId);
                    const firstCat = categories.find((c) => c.eventId === evId);
                    if (firstCat) setSelectedCategoryId(firstCat.id);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Category *</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                >
                  {categoriesForSelectedEvent.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Contestant Name *</label>
                <input
                  type="text"
                  required
                  value={newContestantName}
                  onChange={(e) => setNewContestantName(e.target.value)}
                  placeholder="e.g. Efua Mensah"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Short Code *</label>
                <input
                  type="text"
                  required
                  value={newContestantCode}
                  onChange={(e) => setNewContestantCode(e.target.value)}
                  placeholder="e.g. DPG26-07"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-mono text-[#0E1030]"
                />
              </div>
              <button
                type="submit"
                disabled={busyId === "create-contestant"}
                className="w-full py-3 rounded-xl bg-[#4B35E0] text-white font-bold text-sm hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
              >
                {busyId === "create-contestant" ? "Registering..." : "Add to Competition"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
