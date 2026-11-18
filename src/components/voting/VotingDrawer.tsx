"use client";

import { useState } from "react";
import { X, CheckCircle2, ShieldCheck, Smartphone, Sparkles, Loader2 } from "lucide-react";

export interface Contestant {
  id: string;
  name: string;
  code: string;
  photo: string;
  categoryName: string;
  votes: number;
}

interface VotingDrawerProps {
  contestant: Contestant | null;
  unitPriceGhs: number;
  onClose: () => void;
  onSuccess: (orderRef: string, voteCount: number) => void;
}

export function VotingDrawer({ contestant, unitPriceGhs, onClose, onSuccess }: VotingDrawerProps) {
  const [selectedVotes, setSelectedVotes] = useState<number>(10);
  const [customVotes, setCustomVotes] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [receiptRef, setReceiptRef] = useState<string>("");

  if (!contestant) return null;

  const currentVotes = customVotes ? Math.max(1, parseInt(customVotes) || 1) : selectedVotes;
  const baseAmount = currentVotes * unitPriceGhs;

  // Paystack Ghana MoMo standard processing surcharge ~1.95%
  const surcharge = Number((baseAmount * 0.0195).toFixed(2));
  const totalAmount = Number((baseAmount + surcharge).toFixed(2));

  // Network detection helper
  const cleanPhone = phone.replace(/\s+/g, "");
  let network = "Mobile Money";
  if (/^(024|054|055|059|025)/.test(cleanPhone)) network = "MTN MoMo";
  else if (/^(020|050)/.test(cleanPhone)) network = "Telecel Cash";
  else if (/^(027|057|026)/.test(cleanPhone)) network = "AT Money";

  const handlePay = async () => {
    if (!phone || cleanPhone.length < 10) {
      alert("Please enter a valid 10-digit Ghanaian mobile money number.");
      return;
    }

    setIsSubmitting(true);

    // Simulate atomic order creation + MoMo prompt
    setTimeout(() => {
      setIsSubmitting(false);
      const generatedRef = "TK-" + Math.floor(100000 + Math.random() * 900000);
      setReceiptRef(generatedRef);
      setStep("success");
      onSuccess(generatedRef, currentVotes);
    }, 1500);
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
            className="p-2 rounded-full hover:bg-white text-[#5B5F85] hover:text-[#0E1030] transition-colors"
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
                <img
                  src={contestant.photo}
                  alt={contestant.name}
                  className="w-14 h-14 rounded-xl object-cover border border-white shadow-xs"
                />
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
                        className={`p-3 rounded-xl border text-center transition-all ${
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
                  Or Enter Custom Votes
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
                <p className="text-[11px] text-[#5B5F85] mt-1">
                  You will receive an instant payment authorization prompt on this phone.
                </p>
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
                className="px-5 py-3 rounded-xl border border-[#D9DBEA] text-sm font-semibold text-[#5B5F85] hover:bg-[#F6F7FC]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handlePay}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payment...</span>
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
              className="w-full py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
