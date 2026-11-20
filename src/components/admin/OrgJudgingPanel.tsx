"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Award, UserPlus } from "lucide-react";

interface CategoryOption {
  id: string;
  eventId: string;
  eventName: string;
  name: string;
  resultsState: "hidden" | "live" | "final";
}

interface CriterionRow {
  id: string;
  name: string;
  weight_bps: number;
  min_score: number;
  max_score: number;
  step: number;
}

interface AssignmentRow {
  id: string;
  judge_id: string;
  judges: { id: string; user_id: string; display_name: string } | { id: string; user_id: string; display_name: string }[] | null;
}

interface JudgingState {
  criteria: CriterionRow[];
  assignments: AssignmentRow[];
  activeEntryCount: number;
  submittedBallotsCount: number;
  latestPublication: { id: string; published_at: string; state: string } | null;
}

export function OrgJudgingPanel({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [catId, setCatId] = useState(categories[0]?.id ?? "");
  const [state, setState] = useState<JudgingState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [judgeEmail, setJudgeEmail] = useState("");
  const [judgeName, setJudgeName] = useState("");
  const [judgePassword, setJudgePassword] = useState("");

  const fetchJudgingData = useCallback(async (targetCatId: string): Promise<JudgingState | null> => {
    const res = await fetch(`/api/v1/org/categories/${targetCatId}/judging`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) return null;
    return {
      criteria: data.criteria ?? [],
      assignments: data.assignments ?? [],
      activeEntryCount: Number(data.activeEntryCount ?? 0),
      submittedBallotsCount: Number(data.submittedBallotsCount ?? 0),
      latestPublication: data.latestPublication ?? null,
    };
  }, []);

  const loadJudging = useCallback(
    async (targetCatId: string) => {
      if (!targetCatId) return;
      const next = await fetchJudgingData(targetCatId);
      if (next) setState(next);
    },
    [fetchJudgingData]
  );

  useEffect(() => {
    if (!catId) return;
    let active = true;
    void fetchJudgingData(catId).then((next) => {
      if (active && next) setState(next);
    });
    return () => {
      active = false;
    };
  }, [catId, fetchJudgingData]);

  const loading = Boolean(catId) && state === null;

  const handleSetupStandardCriteria = async () => {
    if (!catId) return;
    setBusy("criteria");
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/org/categories/${catId}/judging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setup_criteria",
          criteria: [
            { name: "Poise & Presentation", weightBps: 3000, minScore: 0, maxScore: 10, step: 0.5 },
            { name: "Talent & Creativity", weightBps: 4000, minScore: 0, maxScore: 10, step: 0.5 },
            { name: "Eloquence & Q&A", weightBps: 3000, minScore: 0, maxScore: 10, step: 0.5 },
          ],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Could not set up criteria." });
        return;
      }
      setNotice({ kind: "ok", text: "Judging criteria configured (Poise 30%, Talent 40%, Eloquence 30%)." });
      await loadJudging(catId);
    } catch {
      setNotice({ kind: "err", text: "Network error configuring criteria." });
    } finally {
      setBusy(null);
    }
  };

  const handleAssignJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catId || !judgeEmail.trim()) return;
    setBusy("assign");
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/org/categories/${catId}/judging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_judge",
          email: judgeEmail.trim(),
          displayName: judgeName.trim() || undefined,
          password: judgePassword.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Could not assign judge." });
        return;
      }
      setJudgeEmail("");
      setJudgeName("");
      setJudgePassword("");
      setNotice({
        kind: "ok",
        text: `Assigned judge ${data.email}. They can sign in at /auth/login?redirectTo=/judge.`,
      });
      await loadJudging(catId);
    } catch {
      setNotice({ kind: "err", text: "Network error assigning judge." });
    } finally {
      setBusy(null);
    }
  };

  const handleRevokeJudge = async (assignmentId: string) => {
    if (!catId) return;
    setBusy(assignmentId);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/org/categories/${catId}/judging`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_judge", assignmentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setNotice({ kind: "err", text: data?.message || "Could not revoke judge." });
        return;
      }
      setNotice({ kind: "ok", text: "Judge assignment revoked." });
      await loadJudging(catId);
    } finally {
      setBusy(null);
    }
  };

  const handlePublishResults = async () => {
    if (!catId) return;
    setBusy("publish");
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/org/categories/${catId}/results`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice({ kind: "err", text: data?.message || "Could not calculate and publish results." });
        return;
      }
      setNotice({ kind: "ok", text: "Official category results calculated and published live!" });
      await loadJudging(catId);
      router.refresh();
    } catch {
      setNotice({ kind: "err", text: "Network error publishing results." });
    } finally {
      setBusy(null);
    }
  };

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#D9DBEA] p-8 text-center text-sm text-[#5B5F85]">
        Create an event and category first to configure judging criteria and publish results.
      </div>
    );
  }

  const expectedBallots = (state?.assignments.length ?? 0) * (state?.activeEntryCount ?? 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase text-[#4B35E0]">Phase 12 · Adjudication &amp; Final Tally</span>
          <h2 className="font-heading font-bold text-lg text-[#0E1030]">Judging Panel &amp; Results Publication</h2>
        </div>
        <select
          value={catId}
          onChange={(e) => {
            setCatId(e.target.value);
            setNotice(null);
          }}
          className="px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs font-semibold text-[#0E1030]"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.eventName} — {c.name} ({c.resultsState})
            </option>
          ))}
        </select>
      </div>

      {notice ? (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            notice.kind === "ok"
              ? "bg-[#E6F8F0] border-[#0F9D6B]/30 text-[#0F9D6B]"
              : "bg-[#D13A3A]/10 border-[#D13A3A]/30 text-[#D13A3A]"
          }`}
        >
          {notice.kind === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      ) : null}

      {loading && !state ? (
        <div className="bg-white rounded-2xl border border-[#D9DBEA] p-8 text-center text-xs text-[#5B5F85]">
          Loading judging configuration...
        </div>
      ) : state ? (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base text-[#0E1030] flex items-center gap-2">
                <Scale className="w-4 h-4 text-[#4B35E0]" /> Scoring Criteria (100%)
              </h3>
              <button
                type="button"
                disabled={busy === "criteria"}
                onClick={() => void handleSetupStandardCriteria()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#E8E5FD] text-[#4B35E0] text-xs font-bold hover:bg-[#DBD5FC] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {state.criteria.length > 0 ? "Reset to Standard 30/40/30" : "Apply Standard 30/40/30"}
              </button>
            </div>

            {state.criteria.length === 0 ? (
              <p className="text-xs text-[#5B5F85]">
                No criteria configured yet. Click <strong>Apply Standard 30/40/30</strong> to set up Poise (30%), Talent (40%), and Eloquence (30%).
              </p>
            ) : (
              <div className="space-y-2">
                {state.criteria.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-[#0E1030]">{c.name}</span>
                    <span className="font-mono font-bold text-[#4B35E0]">
                      {Math.round(c.weight_bps / 100)}% ({c.min_score}–{c.max_score})
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-[#D9DBEA] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5B5F85]">Submitted Ballots</span>
                <strong className="font-mono text-[#0E1030]">
                  {state.submittedBallotsCount} / {expectedBallots}
                </strong>
              </div>
              {state.latestPublication ? (
                <div className="p-3 rounded-xl bg-[#E6F8F0] border border-[#0F9D6B]/30 text-xs text-[#0F9D6B] font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4 shrink-0" />
                  Final results published on {state.latestPublication.published_at.slice(0, 10)}.
                </div>
              ) : null}
              <button
                type="button"
                disabled={busy === "publish"}
                onClick={() => void handlePublishResults()}
                className="w-full py-2.5 rounded-xl bg-[#0E1030] text-white text-xs font-bold hover:bg-[#1A1D47] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {busy === "publish" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Award className="w-3.5 h-3.5 text-[#F2A900]" />}
                <span>Calculate &amp; Publish Final Results (50% Public / 50% Judge)</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
            <h3 className="font-heading font-bold text-base text-[#0E1030] flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#4B35E0]" /> Assigned Judges
            </h3>

            <form onSubmit={handleAssignJudge} className="space-y-3 text-xs bg-[#F6F7FC] p-4 rounded-2xl border border-[#D9DBEA]">
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  required
                  value={judgeEmail}
                  onChange={(e) => setJudgeEmail(e.target.value)}
                  placeholder="judge@domain.com *"
                  className="px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-[#0E1030]"
                />
                <input
                  type="text"
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  placeholder="Display Name (optional)"
                  className="px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-[#0E1030]"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="password"
                  minLength={8}
                  value={judgePassword}
                  onChange={(e) => setJudgePassword(e.target.value)}
                  placeholder="Initial Password (for new judge account)"
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-[#0E1030]"
                />
                <button
                  type="submit"
                  disabled={busy === "assign"}
                  className="px-4 py-2 rounded-xl bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
                >
                  {busy === "assign" ? "Assigning..." : "Assign Judge"}
                </button>
              </div>
            </form>

            {state.assignments.length === 0 ? (
              <p className="text-xs text-[#5B5F85]">No judges assigned to this category yet.</p>
            ) : (
              <div className="space-y-2">
                {state.assignments.map((a) => {
                  const j = Array.isArray(a.judges) ? a.judges[0] : a.judges;
                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-[#0E1030]">{j?.display_name ?? "Assigned Judge"}</span>
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => void handleRevokeJudge(a.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D13A3A]/30 text-[#D13A3A] font-semibold hover:bg-[#D13A3A]/10 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Revoke
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
