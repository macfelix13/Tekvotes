"use client";

import { useState } from "react";
import { X, ShieldCheck, Smartphone, Loader2, ExternalLink, Mail } from "lucide-react";

export interface Contestant {
  id: string;
  name: string;
  code: string;
  photo?: string | null;
  categoryName: string;
  votes: number;
}

export interface VotePackageOption {
  id: string;
  label: string;
  votes: number;
  priceMinor: number;
}

interface VotingDrawerProps {
  contestant: Contestant | null;
  eventName: string;
  unitPriceGhs: number;
  packages?: VotePackageOption[];
  onClose: () => void;
  onSuccess?: (orderRef: string, voteCount: number) => void;
}

export function VotingDrawer({ contestant, eventName, unitPriceGhs, packages = [], onClose }: VotingDrawerProps) {
  const [selectedPackageId, setSelectedPackageId] = useState<string>(packages[0]?.id ?? "");
  const [selectedVotes, setSelectedVotes] = useState<number>(packages[0]?.votes ?? 10);
  const [customVotes, setCustomVotes] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [checkoutUrl, setCheckoutUrl] = useState<string>("");
  const [orderRef, setOrderRef] = useState<string>("");

  if (!contestant) return null;

  const activePackage = !customVotes && selectedPackageId ? packages.find((p) => p.id === selectedPackageId) : undefined;
  const currentVotes = customVotes
    ? Math.max(1, parseInt(customVotes, 10) || 1)
    : activePackage
    ? activePackage.votes
    : selectedVotes;
  const baseMinor = activePackage ? activePackage.priceMinor : currentVotes * Math.round(unitPriceGhs * 100);
  const surchargeMinor = Math.floor((baseMinor * 195 + 5000) / 10000);
  const totalMinor = baseMinor + surchargeMinor;
  const baseAmount = baseMinor / 100;
  const surcharge = surchargeMinor / 100;
  const totalAmount = totalMinor / 100;

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
          ...(activePackage ? { packageId: activePackage.id } : { voteQuantity: currentVotes }),
          voterPhone: cleanPhone,
          voterEmail: email.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.authorizationUrl || !data?.reference) {
        setErrorMsg(data?.message || "Unable to start Paystack checkout. No payment was taken.");
        return;
      }

      setOrderRef(data.reference);
      setCheckoutUrl(data.authorizationUrl);
      window.location.assign(data.authorizationUrl);
    } catch {
      setErrorMsg("Network error starting checkout. No payment was taken. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-[#D9DBEA] overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 sm:p-6 border-b border-[#D9DBEA] flex items-center justify-between bg-[#F6F7FC]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
              {eventName}
            </span>
            <h2 className="font-heading font-extrabold text-xl text-[#0E1030] mt-0.5">
              Vote for {contestant.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voting drawer"
            className="p-2 rounded-full hover:bg-white text-[#5B5F85] hover:text-[#0E1030] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {checkoutUrl ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#E8E5FD] text-[#4B35E0] flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
                  Redirecting to Paystack
                </span>
                <h3 className="font-heading font-extrabold text-xl text-[#0E1030] mt-1">
                  Complete Payment on Paystack
                </h3>
                <p className="text-sm text-[#5B5F85] mt-1 max-w-sm mx-auto">
                  Votes are credited only after Paystack confirms your payment of{" "}
                  <strong className="text-[#0E1030]">GHS {totalAmount.toFixed(2)}</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] text-left text-xs space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-[#5B5F85]">Order Reference</span>
                  <span className="font-mono font-bold text-[#0E1030]">{orderRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5B5F85]">Votes</span>
                  <span className="font-bold text-[#4B35E0]">{currentVotes} votes</span>
                </div>
              </div>

              <a
                href={checkoutUrl}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8]"
              >
                <span>Continue to Paystack Checkout</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <>
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

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5B5F85] mb-2.5">
                  Select Vote Package
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {packages.length > 0
                    ? packages.map((pkg) => {
                        const isSelected = !customVotes && selectedPackageId === pkg.id;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => {
                              setSelectedPackageId(pkg.id);
                              setSelectedVotes(pkg.votes);
                              setCustomVotes("");
                            }}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#4B35E0] text-white border-[#4B35E0] shadow-md shadow-[#4B35E0]/20 font-bold"
                                : "bg-[#F6F7FC] text-[#0E1030] border-[#D9DBEA] hover:border-[#4B35E0]/50 font-medium"
                            }`}
                          >
                            <div className="text-sm">{pkg.label}</div>
                            <div className={`text-xs ${isSelected ? "text-white/80" : "text-[#5B5F85]"}`}>
                              GHS {(pkg.priceMinor / 100).toFixed(2)}
                            </div>
                          </button>
                        );
                      })
                    : [5, 10, 25, 50, 100, 250].map((num) => {
                        const isSelected = !customVotes && selectedVotes === num;
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              setSelectedPackageId("");
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
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5B5F85] mb-1.5">
                  Email (Optional for Paystack receipt)
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                  />
                  <Mail className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3" />
                </div>
              </div>

              {errorMsg ? (
                <p className="text-xs font-semibold text-[#D13A3A] bg-[#D13A3A]/10 border border-[#D13A3A]/20 rounded-xl px-3.5 py-2.5">
                  {errorMsg}
                </p>
              ) : null}

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

              <div className="flex items-center gap-2 text-[11px] text-[#5B5F85]">
                <ShieldCheck className="w-4 h-4 text-[#0F9D6B] shrink-0" />
                <span>Secured by Paystack. Votes credit only after verified payment confirmation.</span>
              </div>
            </>
          )}
        </div>

        <div className="p-5 sm:p-6 border-t border-[#D9DBEA] bg-white flex items-center justify-between gap-3">
          {checkoutUrl ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-[#D9DBEA] text-sm font-semibold text-[#5B5F85] hover:bg-[#F6F7FC] cursor-pointer"
            >
              Close
            </button>
          ) : (
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
                    <span>Starting Paystack...</span>
                  </>
                ) : (
                  <span>Pay GHS {totalAmount.toFixed(2)}</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
