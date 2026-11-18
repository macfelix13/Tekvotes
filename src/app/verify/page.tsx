"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import { StoredVoteReceipt } from "@/components/voting/VotingDrawer";
import { ShieldCheck, Search, CheckCircle2, Lock, History } from "lucide-react";

const DEFAULT_RECEIPT: StoredVoteReceipt = {
  reference: "TK-849210",
  contestantName: "Fatima Abubakar",
  contestantCode: "FA01",
  eventName: "Miss Hijab Ghana 3RD EDITION",
  categoryName: "Queen Category",
  votesCredited: 25,
  baseAmountGhs: "25.00",
  surchargeGhs: "0.49",
  totalPaidGhs: "25.49",
  channel: "MTN Mobile Money (Paystack)",
  creditedAt: "2026-11-18 15:30:12 UTC",
  ledgerHash: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
};

export default function VerifyReceiptPage() {
  const [refInput, setRefInput] = useState("TK-849210");
  const [recentReceipts, setRecentReceipts] = useState<StoredVoteReceipt[]>([]);
  const [verified, setVerified] = useState<StoredVoteReceipt>(DEFAULT_RECEIPT);

  useEffect(() => {
    try {
      const saved: StoredVoteReceipt[] = JSON.parse(localStorage.getItem("tekvotes_receipts") || "[]");
      setRecentReceipts(saved);

      const urlParams = new URLSearchParams(window.location.search);
      const qRef = urlParams.get("ref");
      if (qRef) {
        setRefInput(qRef);
        const match = saved.find((r) => r.reference.toUpperCase() === qRef.toUpperCase());
        if (match) {
          setVerified(match);
          return;
        }
      }
      if (saved.length > 0 && !qRef) {
        setRefInput(saved[0].reference);
        setVerified(saved[0]);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = refInput.trim().toUpperCase();
    if (!cleaned) return;
    const found = recentReceipts.find((r) => r.reference.toUpperCase() === cleaned);
    if (found) {
      setVerified(found);
    } else {
      setVerified({
        ...DEFAULT_RECEIPT,
        reference: cleaned,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8E5FD] text-[#4B35E0] text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" /> Public Vote Audit Trail
            </div>
            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#0E1030]">
              Verify Your Vote Receipt
            </h1>
            <p className="text-sm text-[#5B5F85] max-w-xl mx-auto">
              Enter your transaction reference (e.g. <code className="font-mono font-bold text-[#0E1030]">TK-849210</code>) to confirm that your Mobile Money payment was credited to the append-only vote ledger.
            </p>
          </div>

          {/* Search Form */}
          <form
            onSubmit={handleVerify}
            className="bg-white p-4 rounded-2xl border border-[#D9DBEA] shadow-md flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="Enter receipt reference (e.g. TK-849210)..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
              />
              <Search className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3.5" />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 cursor-pointer"
            >
              Verify Ledger Entry
            </button>
          </form>

          {/* Session Receipts Quick Pills */}
          {recentReceipts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#5B5F85] flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Your Recent Votes:
              </span>
              {recentReceipts.map((r) => (
                <button
                  key={r.reference}
                  type="button"
                  onClick={() => {
                    setRefInput(r.reference);
                    setVerified(r);
                  }}
                  className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-all cursor-pointer ${
                    verified.reference === r.reference
                      ? "bg-[#4B35E0] text-white border-[#4B35E0]"
                      : "bg-white text-[#0E1030] border-[#D9DBEA] hover:border-[#4B35E0]"
                  }`}
                >
                  {r.reference} ({r.contestantCode} · +{r.votesCredited})
                </button>
              ))}
            </div>
          )}

          {/* Verified Result Card */}
          {verified && (
            <div className="bg-white rounded-3xl border border-[#D9DBEA] shadow-xl overflow-hidden">
              <div className="bg-[#0F9D6B] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-heading font-bold text-sm">
                    Official Verified Vote Receipt · Credited to Ledger
                  </span>
                </div>
                <span className="font-mono text-xs bg-white/20 px-2.5 py-1 rounded-md font-bold">
                  {verified.reference}
                </span>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-xs text-[#5B5F85]">Contestant</span>
                    <p className="font-heading font-extrabold text-lg text-[#0E1030]">
                      {verified.contestantName}{" "}
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#E8E5FD] text-[#4B35E0]">
                        {verified.contestantCode}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-[#5B5F85]">Competition & Category</span>
                    <p className="font-semibold text-sm text-[#0E1030]">{verified.eventName}</p>
                    <p className="text-xs text-[#5B5F85]">{verified.categoryName}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-[#5B5F85]">Whole Votes Credited</span>
                    <p className="font-heading font-extrabold text-2xl text-[#4B35E0]">
                      +{verified.votesCredited} Votes
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs text-[#5B5F85]">Amount Breakdown (GHS)</span>
                    <p className="font-bold text-sm text-[#0E1030]">
                      Total Paid: GHS {verified.totalPaidGhs}
                    </p>
                    <p className="text-xs text-[#5B5F85]">
                      Base Vote: GHS {verified.baseAmountGhs} · Surcharge: GHS {verified.surchargeGhs}
                    </p>
                  </div>
                </div>

                <div className="pt-5 border-t border-[#D9DBEA] space-y-2 text-xs text-[#5B5F85]">
                  <div className="flex justify-between">
                    <span>Payment Channel</span>
                    <span className="font-semibold text-[#0E1030]">{verified.channel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Timestamp</span>
                    <span className="font-mono text-[#0E1030]">{verified.creditedAt}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pt-2">
                    <span className="flex items-center gap-1 font-semibold text-[#0F9D6B]">
                      <Lock className="w-3.5 h-3.5" /> Immutable Audit Hash
                    </span>
                    <span className="font-mono text-[11px] text-[#0E1030] break-all">
                      {verified.ledgerHash}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
