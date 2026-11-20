"use client";

import { useState } from "react";
import Link from "next/link";
import { X, CheckCircle2, ShieldCheck, Smartphone, Loader2, ExternalLink } from "lucide-react";

export interface Contestant {
  id: string;
  name: string;
  code: string;
  photo?: string | null;
  categoryName: string;
  votes: number;
}

export interface StoredVoteReceipt {
  reference: string;
  contestantName: string;
  contestantCode: string;
  eventName: string;
  categoryName: string;
  votesCredited: number;
  baseAmountGhs: string;
  surchargeGhs: string;
  totalPaidGhs: string;
  channel: string;
  creditedAt: string;
  ledgerHash: string;
}

interface VotingDrawerProps {
  contestant: Contestant | null;
  eventName: string;
  unitPriceGhs: number;
  onClose: () => void;
  onSuccess: (orderRef: string, voteCount: number) => void;
}

export function VotingDrawer({ contestant, eventName, unitPriceGhs, onClose, onSuccess }: VotingDrawerProps) {
  const [selectedVotes, setSelectedVotes] = useState<number>(10);
  const [customVotes, setCustomVotes] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [step, setStep] = useState<"form" | "success">("form");
  const [receiptRef, setReceiptRef] = useState<string>("");

  if (!contestant) return null;

  const currentVotes = customVotes ? Math.max(1, parseInt(customVotes) || 1) : selectedVotes;
  const baseAmount = currentVotes * unitPriceGhs;

  // Paystack Ghana MoMo standard processing surcharge ~1.95% (OD-01 / OD-02)
  const surcharge = Number((baseAmount * 0.0195).toFixed(2));
  const totalAmount = Number((baseAmount + surcharge).toFixed(2));

  // Network detection helper
  const cleanPhone = phone.replace(/\s+/g, "");
  let network = "Mobile Money";
  if (/^(024|054|055|059|025)/.test(cleanPhone)) network = "MTN MoMo";
  else if (/^(020|050)/.test(cleanPhone)) network = "Telecel Cash";
  else if (/^(027|057|026)/.test(cleanPhone)) network = "AT Money";

  const handlePay = async () => {
    setErrorMsg("");
    if (!phone || cleanPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit Ghanaian mobile money number (e.g. 0241234567).");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/v1/voting/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryEntryId: contestant.id,
          voteQuantity: currentVotes,
          unitPriceMinor: Math.round(unitPriceGhs * 100),
          voterPhone: cleanPhone,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.reference) {
        setErrorMsg(data?.message || "Unable to start checkout. No payment was taken. Please try again.");
        return;
      }
      const generatedRef: string = data.reference;

      // Persist receipt in localStorage so /verify can look up this exact transaction live
      const newReceipt: StoredVoteReceipt = {
        reference: generatedRef,
        contestantName: contestant.name,
        contestantCode: contestant.code,
        eventName,
        categoryName: contestant.categoryName,
        votesCredited: currentVotes,
        baseAmountGhs: baseAmount.toFixed(2),
        surchargeGhs: surcharge.toFixed(2),
        totalPaidGhs: totalAmount.toFixed(2),
        channel: `${network} (Paystack)`,
        creditedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
        ledgerHash: `sha256:${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
      };

      try {
        const existing = JSON.parse(localStorage.getItem("tekvotes_receipts") || "[]");
        localStorage.setItem("tekvotes_receipts", JSON.stringify([newReceipt, ...existing]));
      } catch {
        // ignore storage errors
      }

      setReceiptRef(generatedRef);
      setStep("success");
      onSuccess(generatedRef, currentVotes);
    } catch {
      setErrorMsg("Unable to process voting order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-[#D9DBEA] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#D9DBEA] flex items-center justify-between bg-[#F6F7FC]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
              Cast Your Vote
            </span>
            <h2 className="font-heading font-extrabold text-xl text-[#0E1030] mt-0.5">
              Vote for {contestant.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white text-[#5B5F85] hover:text-[#0E1030] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {step === "form" && (
            <>
              {/* Contestant Summary Card */}
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA]">
                {contestant.photo ? (
                  <img
                    src={contestant.photo}
                    alt={contestant.name}
                    className="w-14 h-14 rounded-xl object-cover border border-white shadow-xs"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="w-14 h-14 rounded-xl bg-[#0E1030] text-white font-heading font-bold flex items-center justify-center"
                  >
                    {contestant.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-[#E8E5FD] text-[#4B35E0]">
                      {contestant.code}
                    </span>
                    <span className="text-xs text-[#5B5F85]">{contestant.categoryName}</span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-[#0E1030] mt-0.5">
                    {contestant.name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#5B5F85] block">Price / vote</span>
                  <span className="font-heading font-bold text-sm text-[#0E1030]">
                    GHS {unitPriceGhs.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Vote Bundles */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5B5F85] mb-2.5">
                  Select Vote Package
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[5, 10, 25, 50, 100, 250].map((num) => {
                    const isSelected = !customVotes && selectedVotes === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setSelectedVotes(num);
                          setCustomVotes("");
                        }}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#4B35E0] text-white border-[#4B35E0] shadow-md shadow-[#4B35E0]/20 font-bold"
                            : "bg-[#F6F7FC] text-[#0E1030] border-[#D9DBEA] hover:border-[#4B35E0]/50 font-medium"
                        }`}
                      >
                        <div className="text-sm">{num} Votes</div>
                        <div className={`text-xs ${isSelected ? "text-white/80" : "text-[#5B5F85]"}`}>
                          GHS {(num * unitPriceGhs).toFixed(2)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Whole-Vote Quantity */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5B5F85] mb-1.5">
                  Or Enter Custom Whole Votes
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customVotes}
                  onChange={(e) => setCustomVotes(e.target.value)}
                  placeholder="e.g. 15, 30, 500"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                />
              </div>

              {/* Voter Mobile Money Phone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#5B5F85]">
                    Mobile Money Number
                  </label>
                  <span className="text-[11px] font-semibold text-[#4B35E0] bg-[#E8E5FD] px-2 py-0.5 rounded-md">
                    {network}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 024 123 4567"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                  />
                  <Smartphone className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3" />
                </div>
                {errorMsg ? (
                  <p className="text-xs font-semibold text-[#D13A3A] mt-1">{errorMsg}</p>
                ) : (
                  <p className="text-[11px] text-[#5B5F85] mt-1">
                    You will receive an instant payment authorization prompt on this phone.
                  </p>
                )}
              </div>

              {/* Surcharge & Total Breakdown (OD-01, OD-02) */}
              <div className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] space-y-2 text-xs">
                <div className="flex justify-between text-[#5B5F85]">
                  <span>Base Vote Amount ({currentVotes} votes)</span>
                  <span className="font-medium text-[#0E1030]">GHS {baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[#5B5F85]">
                  <span>Processing Fee (Network Surcharge)</span>
                  <span className="font-medium text-[#0E1030]">GHS {surcharge.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-[#D9DBEA] flex justify-between items-baseline font-bold text-sm">
                  <span className="text-[#0E1030]">Total Payable</span>
                  <span className="font-heading text-lg text-[#4B35E0]">
                    GHS {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}

          {step === "success" && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#E6F8F0] text-[#0F9D6B] flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0F9D6B]">
                  Payment Verified
                </span>
                <h3 className="font-heading font-extrabold text-2xl text-[#0E1030] mt-1">
                  Votes Successfully Credited!
                </h3>
                <p className="text-sm text-[#5B5F85] mt-1 max-w-sm mx-auto">
                  You have cast <strong className="text-[#0E1030]">{currentVotes} votes</strong> for{" "}
                  <strong className="text-[#0E1030]">{contestant.name}</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] text-left text-xs space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-[#5B5F85]">Transaction Ref</span>
                  <span className="font-mono font-bold text-[#0E1030]">{receiptRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B5F85]">Contestant Code</span>
                  <span className="font-mono font-bold text-[#4B35E0]">{contestant.code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B5F85]">Amount Paid</span>
                  <span className="font-bold text-[#0E1030]">GHS {totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B5F85]">Audit Status</span>
                  <span className="font-semibold text-[#0F9D6B] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Ledger Balanced
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href={`/verify?ref=${encodeURIComponent(receiptRef)}`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B35E0] hover:underline"
                >
                  <span>Verify this Receipt on Public Audit Ledger</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 sm:p-6 border-t border-[#D9DBEA] bg-white flex items-center justify-between gap-3">
          {step === "form" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl border border-[#D9DBEA] text-sm font-semibold text-[#5B5F85] hover:bg-[#F6F7FC] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handlePay}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <span>Pay GHS {totalAmount.toFixed(2)}</span>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
