"use client";

import { useState } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import { Scale, Lock, CheckCircle2, Sparkles, AlertCircle } from "lucide-react";

interface JudgeEntry {
  id: string;
  code: string;
  name: string;
  poiseScore: number;
  talentScore: number;
  eloquenceScore: number;
  locked: boolean;
}

export default function JudgePortalPage() {
  const [entries, setEntries] = useState<JudgeEntry[]>([
    { id: "e-1", code: "FA01", name: "Fatima Abubakar", poiseScore: 8.5, talentScore: 9.0, eloquenceScore: 9.0, locked: true },
    { id: "e-2", code: "MZ04", name: "Mariam Zakaria", poiseScore: 8.0, talentScore: 8.5, eloquenceScore: 8.5, locked: false },
    { id: "e-3", code: "AS07", name: "Amina Sulemana", poiseScore: 7.5, talentScore: 8.0, eloquenceScore: 8.5, locked: false },
  ]);

  const updateScore = (id: string, field: "poiseScore" | "talentScore" | "eloquenceScore", val: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id && !e.locked ? { ...e, [field]: Math.min(10, Math.max(0, val)) } : e))
    );
  };

  const lockSubmission = (id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, locked: true } : e)));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="bg-[#0E1030] text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#F2A900] text-xs font-bold uppercase tracking-wider">
                <Scale className="w-3.5 h-3.5" /> Official Adjudicator Ballot · Phase 6 Engine
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl">
                Judge Panel — Miss Hijab Ghana 3RD EDITION
              </h1>
              <p className="text-xs sm:text-sm text-white/75">
                Criteria weights: Poise & Elegance (30%) · Talent Showcase (40%) · Eloquence & Q&A (30%). Once submitted, scores are cryptographically locked (Rule Q38).
              </p>
            </div>
          </div>

          <div className="grid gap-6">
            {entries.map((entry) => {
              const weighted100 = (
                (entry.poiseScore / 10) * 30 +
                (entry.talentScore / 10) * 40 +
                (entry.eloquenceScore / 10) * 30
              ).toFixed(2);

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl border border-[#D9DBEA] p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                >
                  <div className="space-y-1 min-w-[200px]">
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
                      Normalized Judge Score: <strong className="text-[#4B35E0]">{weighted100} / 100</strong>
                    </p>
                  </div>

                  {/* Criteria Inputs */}
                  <div className="grid sm:grid-cols-3 gap-4 flex-1">
                    <div>
                      <label className="block text-[11px] font-bold text-[#5B5F85] uppercase mb-1">
                        Poise (30%) · 0–10
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        disabled={entry.locked}
                        value={entry.poiseScore}
                        onChange={(e) => updateScore(entry.id, "poiseScore", parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono font-bold text-sm text-[#0E1030] disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#5B5F85] uppercase mb-1">
                        Talent (40%) · 0–10
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        disabled={entry.locked}
                        value={entry.talentScore}
                        onChange={(e) => updateScore(entry.id, "talentScore", parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono font-bold text-sm text-[#0E1030] disabled:opacity-60"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#5B5F85] uppercase mb-1">
                        Eloquence (30%) · 0–10
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        disabled={entry.locked}
                        value={entry.eloquenceScore}
                        onChange={(e) => updateScore(entry.id, "eloquenceScore", parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono font-bold text-sm text-[#0E1030] disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Submit & Lock Button */}
                  <div className="flex items-center justify-end">
                    {entry.locked ? (
                      <div className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs font-bold text-[#5B5F85]">
                        <CheckCircle2 className="w-4 h-4 text-[#0F9D6B]" />
                        Submitted & Immutable
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => lockSubmission(entry.id)}
                        className="px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] shadow-sm cursor-pointer"
                      >
                        Submit & Lock Score
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
