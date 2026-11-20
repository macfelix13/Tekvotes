"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { Scale, Lock, CheckCircle2, AlertCircle, Loader2, LogOut, User, ArrowUpRight } from "lucide-react";

export interface JudgeCriterion {
  id: string;
  name: string;
  weightBps: number;
  minScore: number;
  maxScore: number;
  step: number;
}

export interface JudgeBallotEntry {
  categoryEntryId: string;
  code: string;
  number: number;
  name: string;
  photoUrl: string | null;
  locked: boolean;
  submittedAt: string | null;
  savedScores: Record<string, number>;
}

export interface JudgeAssignmentBundle {
  assignmentId: string;
  judgeName: string;
  eventName: string;
  eventSlug: string;
  categoryId: string;
  categoryName: string;
  resultsState: string;
  criteria: JudgeCriterion[];
  entries: JudgeBallotEntry[];
}

export function JudgePortalClient({
  userEmail,
  assignments,
}: {
  userEmail: string;
  assignments: JudgeAssignmentBundle[];
}) {
  const router = useRouter();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(assignments[0]?.assignmentId ?? "");
  const active =
    assignments.find((a) => a.assignmentId === selectedAssignmentId) ?? assignments[0] ?? null;

  const [draftScores, setDraftScores] = useState<Record<string, Record<string, number>>>({});
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/auth/login");
    router.refresh();
  };

  const getScore = (entry: JudgeBallotEntry, crit: JudgeCriterion): number => {
    if (entry.locked && entry.savedScores[crit.id] !== undefined) {
      return entry.savedScores[crit.id];
    }
    const local = draftScores[entry.categoryEntryId]?.[crit.id];
    if (local !== undefined) return local;
    return crit.minScore;
  };

  const setScore = (entryId: string, crit: JudgeCriterion, rawVal: number) => {
    const clamped = Math.min(crit.maxScore, Math.max(crit.minScore, Number.isFinite(rawVal) ? rawVal : crit.minScore));
    setDraftScores((prev) => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] ?? {}),
        [crit.id]: clamped,
      },
    }));
  };

  const computeWeighted100 = (entry: JudgeBallotEntry, criteria: JudgeCriterion[]): string => {
    if (criteria.length === 0) return "0.00";
    let total = 0;
    for (const c of criteria) {
      const val = getScore(entry, c);
      total += (val / c.maxScore) * 100 * (c.weightBps / 10000);
    }
    return total.toFixed(2);
  };

  const handleSubmitBallot = async (entry: JudgeBallotEntry) => {
    if (!active) return;
    setBusyEntryId(entry.categoryEntryId);
    setNotice(null);

    try {
      const scores = active.criteria.map((c) => ({
        criterionId: c.id,
        score: getScore(entry, c),
      }));

      const res = await fetch("/api/v1/judge/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: active.assignmentId,
          categoryEntryId: entry.categoryEntryId,
          scores,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Could not submit ballot." });
        return;
      }

      setNotice({
        kind: "ok",
        text: `Ballot locked for ${entry.name} (${entry.code}). Scores are now immutable.`,
      });
      router.refresh();
    } catch {
      setNotice({ kind: "err", text: "Network error submitting ballot." });
    } finally {
      setBusyEntryId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-[#0E1030] text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#F2A900] text-xs font-bold uppercase tracking-wider">
                <Scale className="w-3.5 h-3.5" /> Official Adjudicator Ballot · Phase 12
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">
                {active ? `${active.eventName} — ${active.categoryName}` : "TekVotes Judge Ballot Portal"}
              </h1>
              <p className="text-xs sm:text-sm text-white/75">
                Signed in as <strong>{userEmail}</strong>. Once submitted, scores are cryptographically locked (Rule Q38).
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {active?.eventSlug ? (
                <Link
                  href={`/competitions/${active.eventSlug}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold"
                >
                  Public Event <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>

          {notice ? (
            <div
              className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 ${
                notice.kind === "ok"
                  ? "bg-[#E6F8F0] border-[#0F9D6B]/30 text-[#0F9D6B]"
                  : "bg-[#D13A3A]/10 border-[#D13A3A]/30 text-[#D13A3A]"
              }`}
            >
              {notice.kind === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{notice.text}</span>
            </div>
          ) : null}

          {!active ? (
            <div className="bg-white rounded-3xl border border-[#D9DBEA] p-8 text-center space-y-3 shadow-xs">
              <Scale className="w-10 h-10 text-[#4B35E0] mx-auto" />
              <h2 className="font-heading font-extrabold text-xl text-[#0E1030]">
                No Active Judging Assignments Yet
              </h2>
              <p className="text-sm text-[#5B5F85] max-w-md mx-auto">
                An Organiser or Super Admin must assign <strong>{userEmail}</strong> to a competition category under{" "}
                <code className="font-mono text-[#4B35E0]">/org → Judging &amp; Results</code> before ballots appear here.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                <Link
                  href="/org"
                  className="px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8]"
                >
                  Go to Organiser Portal
                </Link>
                <Link
                  href="/competitions"
                  className="px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#0E1030] hover:bg-[#F6F7FC]"
                >
                  Browse Events
                </Link>
              </div>
            </div>
          ) : (
            <>
              {assignments.length > 1 ? (
                <div className="bg-white rounded-2xl border border-[#D9DBEA] p-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase text-[#5B5F85]">Assigned Category Ballot</span>
                  <select
                    value={active.assignmentId}
                    onChange={(e) => {
                      setSelectedAssignmentId(e.target.value);
                      setNotice(null);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs font-semibold text-[#0E1030]"
                  >
                    {assignments.map((a) => (
                      <option key={a.assignmentId} value={a.assignmentId}>
                        {a.eventName} — {a.categoryName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {active.criteria.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 text-center text-sm text-[#5B5F85]">
                  Judging criteria have not been configured for <strong>{active.categoryName}</strong> yet. Ask the
                  organizer to set up criteria in <code className="font-mono text-[#4B35E0]">/org</code>.
                </div>
              ) : active.entries.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 text-center text-sm text-[#5B5F85]">
                  No active contestants found in <strong>{active.categoryName}</strong>.
                </div>
              ) : (
                <div className="grid gap-6">
                  {active.entries.map((entry) => {
                    const weighted100 = computeWeighted100(entry, active.criteria);
                    const isBusy = busyEntryId === entry.categoryEntryId;

                    return (
                      <div
                        key={entry.categoryEntryId}
                        className="bg-white rounded-2xl border border-[#D9DBEA] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                      >
                        <div className="flex items-center gap-4 min-w-[230px]">
                          {entry.photoUrl ? (
                            <img
                              src={entry.photoUrl}
                              alt={entry.name}
                              className="w-14 h-14 rounded-2xl object-cover border border-[#D9DBEA] shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-[#0E1030] text-white flex items-center justify-center shrink-0">
                              <User className="w-6 h-6 text-white/70" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#E8E5FD] text-[#4B35E0]">
                                {entry.code}
                              </span>
                              {entry.locked ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E6F8F0] text-[#0F9D6B]">
                                  <Lock className="w-3 h-3" /> Locked
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FDF3D6] text-[#C77700]">
                                  Draft Ballot
                                </span>
                              )}
                            </div>
                            <h3 className="font-heading font-bold text-lg text-[#0E1030]">{entry.name}</h3>
                            <p className="text-xs text-[#5B5F85]">
                              Weighted Score: <strong className="text-[#4B35E0]">{weighted100} / 100</strong>
                            </p>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-3 gap-4 flex-1">
                          {active.criteria.map((crit) => (
                            <div key={crit.id}>
                              <label className="block text-[11px] font-bold text-[#5B5F85] uppercase mb-1">
                                {crit.name} ({Math.round(crit.weightBps / 100)}%) · {crit.minScore}–{crit.maxScore}
                              </label>
                              <input
                                type="number"
                                step={crit.step}
                                min={crit.minScore}
                                max={crit.maxScore}
                                disabled={entry.locked || isBusy}
                                value={getScore(entry, crit)}
                                onChange={(e) => setScore(entry.categoryEntryId, crit, parseFloat(e.target.value))}
                                className="w-full px-3.5 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono font-bold text-sm text-[#0E1030] disabled:opacity-60"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-end shrink-0">
                          {entry.locked ? (
                            <div className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs font-bold text-[#5B5F85]">
                              <CheckCircle2 className="w-4 h-4 text-[#0F9D6B]" />
                              Submitted &amp; Immutable
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleSubmitBallot(entry)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] shadow-sm disabled:opacity-50 cursor-pointer"
                            >
                              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                              <span>{isBusy ? "Locking..." : "Submit & Lock Ballot"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
