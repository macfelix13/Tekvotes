"use client";

import { useState } from "react";
import type { PublicTicketTier } from "@/lib/public-events";
import { X, Ticket, ShieldCheck, Smartphone, CreditCard, Loader2, Minus, Plus } from "lucide-react";

interface TicketCheckoutDrawerProps {
  eventName: string;
  venue: string | null;
  tiers: PublicTicketTier[];
  initialTierId?: string;
  onClose: () => void;
}

export function TicketCheckoutDrawer({
  eventName,
  venue,
  tiers,
  initialTierId,
  onClose,
}: TicketCheckoutDrawerProps) {
  const [selectedTierId, setSelectedTierId] = useState(initialTierId || tiers[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const activeTier = tiers.find((t) => t.id === selectedTierId) ?? tiers[0];
  if (!activeTier) return null;

  const remaining =
    activeTier.capacity != null ? Math.max(0, activeTier.capacity - activeTier.soldCount) : null;
  const maxAllowed =
    remaining != null ? Math.min(activeTier.maxPerOrder, remaining) : activeTier.maxPerOrder;

  const baseAmountMinor = activeTier.priceMinor * quantity;
  const surchargeMinor = Math.floor((baseAmountMinor * 195 + 5000) / 10000);
  const totalAmountMinor = baseAmountMinor + surchargeMinor;
  const fmt = (minor: number) => `${activeTier.currency} ${(minor / 100).toFixed(2)}`;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/tickets/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: activeTier.id,
          quantity,
          buyerName: buyerName.trim(),
          buyerPhone: buyerPhone.trim(),
          buyerEmail: buyerEmail.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.authorizationUrl) {
        setErrorMsg(data?.message || "Unable to initialize ticket checkout.");
        setSubmitting(false);
        return;
      }
      window.location.href = data.authorizationUrl as string;
    } catch {
      setErrorMsg("Network error connecting to payment service.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-xs">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 border border-[#D9DBEA] shadow-2xl space-y-5">
        <div className="flex items-start justify-between border-b border-[#D9DBEA] pb-3.5">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
              <Ticket className="w-3.5 h-3.5" /> Official Event Tickets
            </span>
            <h3 className="font-heading font-extrabold text-xl text-[#0E1030] mt-0.5">{eventName}</h3>
            {venue ? <p className="text-xs text-[#5B5F85]">{venue}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close ticket drawer"
            className="p-1.5 rounded-full hover:bg-[#F6F7FC] cursor-pointer"
          >
            <X className="w-5 h-5 text-[#5B5F85]" />
          </button>
        </div>

        <form onSubmit={handleCheckout} className="space-y-4 text-xs">
          {errorMsg ? (
            <div className="p-3 rounded-xl bg-[#D13A3A]/10 border border-[#D13A3A]/30 text-[#D13A3A] font-semibold">
              {errorMsg}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block font-bold text-[#5B5F85] uppercase">1 · Select Ticket Tier</label>
            <div className="space-y-2">
              {tiers.map((t) => {
                const isSoldOut = t.capacity != null && t.soldCount >= t.capacity;
                const isSelected = t.id === activeTier.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={isSoldOut}
                    onClick={() => {
                      setSelectedTierId(t.id);
                      setQuantity(1);
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? "bg-[#E8E5FD] border-[#4B35E0] text-[#0E1030]"
                        : "bg-[#F6F7FC] border-[#D9DBEA] text-[#0E1030] hover:border-[#4B35E0]/40"
                    } ${isSoldOut ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div>
                      <div className="font-heading font-bold text-sm">{t.name}</div>
                      {t.description ? <p className="text-[11px] text-[#5B5F85] mt-0.5">{t.description}</p> : null}
                      {t.capacity != null ? (
                        <span className="text-[10px] font-bold text-[#4B35E0] block mt-1">
                          {isSoldOut ? "SOLD OUT" : `${Math.max(0, t.capacity - t.soldCount)} tickets left`}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-heading font-extrabold text-base text-[#4B35E0]">
                        {t.currency} {(t.priceMinor / 100).toFixed(2)}
                      </span>
                      <span className="block text-[10px] text-[#5B5F85]">per ticket</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA]">
            <div>
              <span className="block font-bold text-[#0E1030]">2 · Number of Tickets</span>
              <span className="text-[11px] text-[#5B5F85]">Each ticket receives a unique verification pass code</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-xl bg-white border border-[#D9DBEA] flex items-center justify-center hover:border-[#4B35E0] cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-heading font-extrabold text-base text-[#0E1030] w-6 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(Math.max(1, maxAllowed), q + 1))}
                className="w-8 h-8 rounded-xl bg-white border border-[#D9DBEA] flex items-center justify-center hover:border-[#4B35E0] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block font-bold text-[#5B5F85] uppercase">3 · Ticket Holder Details</label>
            <div>
              <label className="block font-semibold text-[#0E1030] mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="e.g. Kwame Boateng"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#0E1030] mb-1">Mobile Number (MoMo) *</label>
                <input
                  type="tel"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="024 123 4567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0E1030] mb-1">Email (for E-Ticket)</label>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E1030] text-white space-y-2">
            <div className="flex justify-between text-white/75">
              <span>
                {activeTier.name} × {quantity}
              </span>
              <span className="font-mono">{fmt(baseAmountMinor)}</span>
            </div>
            <div className="flex justify-between text-white/75">
              <span>Processing Fee Surcharge (~1.95%)</span>
              <span className="font-mono">{fmt(surchargeMinor)}</span>
            </div>
            <div className="pt-2 border-t border-white/15 flex justify-between items-center">
              <span className="font-bold text-sm">Total Due</span>
              <span className="font-heading font-extrabold text-lg text-[#F2A900]">{fmt(totalAmountMinor)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || maxAllowed <= 0}
            className="w-full py-3.5 rounded-xl bg-[#4B35E0] text-white font-bold text-sm hover:bg-[#3B28B8] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#4B35E0]/25"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
            <span>{submitting ? "Redirecting to Paystack..." : `Pay ${fmt(totalAmountMinor)} & Get E-Ticket`}</span>
          </button>

          <div className="flex items-center justify-between text-[11px] text-[#5B5F85] pt-1">
            <span className="inline-flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-[#4B35E0]" /> MTN · Telecel · AT Money
            </span>
            <span className="inline-flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-[#0F9D6B]" /> Visa / Mastercard
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F9D6B]" /> Verified Pass
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
