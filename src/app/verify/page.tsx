"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

interface ApiReceipt {
  orderId: string;
  reference: string;
  status: string;
  contestantName: string;
  contestantCode: string;
  eventName: string;
  eventSlug: string;
  categoryName: string;
  votes: number;
  baseAmountMinor: number;
  surchargeMinor: number;
  totalAmountMinor: number;
  currency: string;
  channel: string;
  createdAt: string;
  creditedAt: string | null;
  ledgerId: number | null;
  providerTxnId: string | null;
  auditHash: string | null;
}

const fmtGhs = (minor: number, currency: string) => `${currency} ${(minor / 100).toFixed(2)}`;
const fmtUtc = (iso: string | null) =>
  iso ? `${iso.replace("T", " ").slice(0, 19)} UTC` : "Pending";

async function fetchReceiptByRef(ref: string): Promise<{ receipt: ApiReceipt | null; error: string }> {
  try {
    const res = await fetch(`/api/v1/voting/orders/${encodeURIComponent(ref)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.receipt) {
      return {
        receipt: null,
        error: data?.message || "No voting receipt found for that reference.",
      };
    }
    return { receipt: data.receipt as ApiReceipt, error: "" };
  } catch {
    return { receipt: null, error: "Unable to contact verification service. Please try again." };
  }
}

function VerifyReceiptContent({ initialRef }: { initialRef: string }) {
  const [refInput, setRefInput] = useState(initialRef);
  const [receipt, setReceipt] = useState<ApiReceipt | null>(null);
  const [loading, setLoading] = useState(Boolean(initialRef));
  const [errorMsg, setErrorMsg] = useState("");

  const lookupReference = useCallback(async (ref: string) => {
    const cleaned = ref.trim();
    if (!cleaned) return;
    setLoading(true);
    setErrorMsg("");
    const result = await fetchReceiptByRef(cleaned);
    setReceipt(result.receipt);
    setErrorMsg(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialRef) return;
    let active = true;
    void fetchReceiptByRef(initialRef).then((result) => {
      if (!active) return;
      setReceipt(result.receipt);
      setErrorMsg(result.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [initialRef]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    void lookupReference(refInput);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8E5FD] text-[#4B35E0] text-xs font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" /> Public Vote Audit Trail
        </div>
        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#0E1030]">
          Verify Your Vote Receipt
        </h1>
        <p className="text-sm text-[#5B5F85] max-w-xl mx-auto">
          Enter your order reference (e.g. <code className="font-mono font-bold text-[#0E1030]">TV-261120-...</code>) to verify payment confirmation and inspect the vote ledger record.
        </p>
      </div>

      <form
        onSubmit={handleVerify}
        className="bg-white p-4 rounded-2xl border border-[#D9DBEA] shadow-md flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            placeholder="Enter order reference..."
            aria-label="Order reference"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
          />
          <Search className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3.5" />
        </div>
        <button
          type="submit"
          disabled={loading || !refInput.trim()}
          className="px-6 py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Checking..." : "Verify Ledger Entry"}
        </button>
      </form>

      {loading && (
        <div className="bg-white rounded-3xl border border-[#D9DBEA] p-10 text-center space-y-3 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-[#4B35E0] mx-auto" />
          <p className="text-sm font-semibold text-[#0E1030]">
            Verifying payment with Paystack &amp; audit ledger...
          </p>
        </div>
      )}

      {!loading && errorMsg && (
        <div className="bg-white rounded-3xl border border-[#D13A3A]/30 p-8 text-center space-y-3 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-[#D13A3A] mx-auto" />
          <h2 className="font-heading font-bold text-lg text-[#0E1030]">Receipt Not Verified</h2>
          <p className="text-sm text-[#5B5F85]">{errorMsg}</p>
        </div>
      )}

      {!loading && !errorMsg && !receipt && (
        <div className="bg-white rounded-3xl border border-[#D9DBEA] p-8 text-center text-sm text-[#5B5F85]">
          Paste your order reference above after completing Paystack checkout to inspect your ledger receipt.
        </div>
      )}

      {!loading && receipt && (
        <div className="bg-white rounded-3xl border border-[#D9DBEA] shadow-xl overflow-hidden">
          {receipt.status === "credited" ? (
            <div className="bg-[#0F9D6B] text-white px-6 py-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-heading font-bold text-sm">
                  Official Verified Vote Receipt · Credited to Ledger
                </span>
              </div>
              <span className="font-mono text-xs bg-white/20 px-2.5 py-1 rounded-md font-bold">
                {receipt.reference}
              </span>
            </div>
          ) : receipt.status === "paid_uncredited" ? (
            <div className="bg-[#D13A3A] text-white px-6 py-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="font-heading font-bold text-sm">
                  Paid Uncredited · Queued for Post-Close Refund Review (ND-01)
                </span>
              </div>
              <span className="font-mono text-xs bg-white/20 px-2.5 py-1 rounded-md font-bold">
                {receipt.reference}
              </span>
            </div>
          ) : (
            <div className="bg-[#C77700] text-white px-6 py-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 shrink-0" />
                <span className="font-heading font-bold text-sm">
                  Payment Status: {receipt.status.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <span className="font-mono text-xs bg-white/20 px-2.5 py-1 rounded-md font-bold">
                {receipt.reference}
              </span>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-xs text-[#5B5F85]">Contestant</span>
                <p className="font-heading font-extrabold text-lg text-[#0E1030]">
                  {receipt.contestantName}{" "}
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#E8E5FD] text-[#4B35E0]">
                    {receipt.contestantCode}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-[#5B5F85]">Competition &amp; Category</span>
                <p className="font-semibold text-sm text-[#0E1030]">{receipt.eventName}</p>
                <p className="text-xs text-[#5B5F85]">{receipt.categoryName}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-[#5B5F85]">
                  {receipt.status === "credited" ? "Whole Votes Credited" : "Requested Votes"}
                </span>
                <p className="font-heading font-extrabold text-2xl text-[#4B35E0]">
                  {receipt.status === "credited" ? `+${receipt.votes}` : receipt.votes} Votes
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-[#5B5F85]">Amount Breakdown ({receipt.currency})</span>
                <p className="font-bold text-sm text-[#0E1030]">
                  Total: {fmtGhs(receipt.totalAmountMinor, receipt.currency)}
                </p>
                <p className="text-xs text-[#5B5F85]">
                  Base Vote: {fmtGhs(receipt.baseAmountMinor, receipt.currency)} · Surcharge:{" "}
                  {fmtGhs(receipt.surchargeMinor, receipt.currency)}
                </p>
              </div>
            </div>

            <div className="pt-5 border-t border-[#D9DBEA] space-y-2 text-xs text-[#5B5F85]">
              <div className="flex justify-between">
                <span>Payment Channel</span>
                <span className="font-semibold text-[#0E1030]">{receipt.channel}</span>
              </div>
              <div className="flex justify-between">
                <span>{receipt.creditedAt ? "Credited At" : "Created At"}</span>
                <span className="font-mono text-[#0E1030]">
                  {fmtUtc(receipt.creditedAt ?? receipt.createdAt)}
                </span>
              </div>
              {receipt.auditHash ? (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 pt-2">
                  <span className="flex items-center gap-1 font-semibold text-[#0F9D6B]">
                    <Lock className="w-3.5 h-3.5" /> Ledger Audit Hash (#{receipt.ledgerId})
                  </span>
                  <span className="font-mono text-[11px] text-[#0E1030] break-all">
                    {receipt.auditHash}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t border-[#D9DBEA] flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/competitions/${receipt.eventSlug}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B35E0] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to {receipt.eventName}
              </Link>

              {(receipt.status === "pending" || receipt.status === "payment_initiated") && (
                <button
                  type="button"
                  onClick={() => void lookupReference(receipt.reference)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs font-bold text-[#0E1030] hover:border-[#4B35E0] cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-check Status
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerifyReceiptWithParams() {
  const searchParams = useSearchParams();
  const initialRef = (searchParams.get("ref") || searchParams.get("reference") || "").trim();
  return <VerifyReceiptContent key={initialRef} initialRef={initialRef} />;
}

export default function VerifyReceiptPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 py-12">
        <Suspense
          fallback={
            <div className="max-w-3xl mx-auto px-4 py-12 text-center text-sm text-[#5B5F85]">
              Loading receipt verifier...
            </div>
          }
        >
          <VerifyReceiptWithParams />
        </Suspense>
      </main>
    </div>
  );
}
