"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import type { PublicEventDetail } from "@/lib/public-events";
import {
  Ticket,
  Calendar,
  MapPin,
  Building2,
  ShieldCheck,
  Smartphone,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ArrowLeft,
} from "lucide-react";

const formatOfficialDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Accra",
      })
    : "Date TBA";

export function TicketEventPurchaseClient({ event }: { event: PublicEventDetail }) {
  const tiers = event.ticketTiers ?? [];
  const [selectedTierId, setSelectedTierId] = useState(tiers[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const activeTier = tiers.find((t) => t.id === selectedTierId) ?? tiers[0] ?? null;
  const remaining =
    activeTier && activeTier.capacity != null
      ? Math.max(0, activeTier.capacity - activeTier.soldCount)
      : null;
  const maxAllowed = activeTier
    ? remaining != null
      ? Math.min(activeTier.maxPerOrder, remaining)
      : activeTier.maxPerOrder
    : 0;

  const baseAmountMinor = activeTier ? activeTier.priceMinor * quantity : 0;
  const surchargeMinor = Math.floor((baseAmountMinor * 195 + 5000) / 10000);
  const totalAmountMinor = baseAmountMinor + surchargeMinor;
  const currency = activeTier?.currency ?? "GHS";
  const fmt = (minor: number) => `${currency} ${(minor / 100).toFixed(2)}`;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTier) return;
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
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B35E0] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to All Event Tickets
          </Link>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Left: Official Ticket Event Flyer & Details */}
            <div className="lg:col-span-5 space-y-5">
              <div className="relative rounded-3xl overflow-hidden bg-[#0E1030] border border-[#D9DBEA] shadow-xl aspect-[4/5]">
                {event.ticketFlyerUrl ? (
                  <img
                    src={event.ticketFlyerUrl}
                    alt={event.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-white space-y-3">
                    <Ticket className="w-14 h-14 text-[#F2A900]" />
                    <span className="font-heading font-extrabold text-2xl">{event.name}</span>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-[#D9DBEA] p-6 space-y-4 shadow-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDF3D6] text-[#C77700] text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5" />
                  Official Event Date: {formatOfficialDate(event.eventDate)}
                </span>

                <h1 className="font-heading font-extrabold text-2xl text-[#0E1030]">{event.name}</h1>

                <div className="space-y-2 text-xs text-[#5B5F85]">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#4B35E0]" />
                    <span>
                      Organised by <strong className="text-[#0E1030]">{event.organizerName}</strong>
                    </span>
                  </div>
                  {event.venue ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#4B35E0]" />
                      <strong className="text-[#0E1030]">{event.venue}</strong>
                    </div>
                  ) : null}
                </div>

                {event.description ? (
                  <p className="text-xs text-[#5B5F85] leading-relaxed pt-2 border-t border-[#D9DBEA] whitespace-pre-line">
                    {event.description}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Right: Direct Ticket Purchase Form */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-[#D9DBEA] p-6 sm:p-8 shadow-xl space-y-6">
              <div className="border-b border-[#D9DBEA] pb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
                  <Ticket className="w-4 h-4" /> Official Box Office Checkout
                </span>
                <h2 className="font-heading font-extrabold text-2xl text-[#0E1030] mt-1">
                  Select Tickets &amp; Purchase Pass
                </h2>
                <p className="text-xs text-[#5B5F85] mt-0.5">
                  Instant digital pass codes (<code className="font-mono font-bold text-[#0E1030]">TT-...</code>) issued immediately after Mobile Money or Card payment.
                </p>
              </div>

              {tiers.length === 0 || !activeTier ? (
                <div className="p-8 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] text-center space-y-2">
                  <p className="font-heading font-bold text-base text-[#0E1030]">
                    Ticket Tiers Coming Soon
                  </p>
                  <p className="text-xs text-[#5B5F85]">
                    The organiser has not published ticket tiers for this event yet. Please check back shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleCheckout} className="space-y-5 text-xs">
                  {errorMsg ? (
                    <div className="p-3 rounded-xl bg-[#D13A3A]/10 border border-[#D13A3A]/30 text-[#D13A3A] font-semibold">
                      {errorMsg}
                    </div>
                  ) : null}

                  <div className="space-y-2.5">
                    <label className="block font-bold text-[#5B5F85] uppercase">1 · Choose Ticket Tier</label>
                    <div className="grid sm:grid-cols-2 gap-3">
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
                            className={`text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? "bg-[#E8E5FD] border-[#4B35E0] ring-2 ring-[#4B35E0]/20"
                                : "bg-[#F6F7FC] border-[#D9DBEA] hover:border-[#4B35E0]/40"
                            } ${isSoldOut ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div>
                              <div className="font-heading font-bold text-sm text-[#0E1030]">{t.name}</div>
                              {t.description ? (
                                <p className="text-[11px] text-[#5B5F85] mt-0.5">{t.description}</p>
                              ) : null}
                              {t.capacity != null ? (
                                <span className="text-[10px] font-bold text-[#4B35E0] block mt-1">
                                  {isSoldOut ? "SOLD OUT" : `${Math.max(0, t.capacity - t.soldCount)} left`}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-heading font-extrabold text-base text-[#4B35E0]">
                                {t.currency} {(t.priceMinor / 100).toFixed(2)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA]">
                    <div>
                      <span className="block font-bold text-[#0E1030] text-sm">2 · Ticket Quantity</span>
                      <span className="text-[11px] text-[#5B5F85]">
                        Each ticket gets its own unique entrance verification code
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-9 h-9 rounded-xl bg-white border border-[#D9DBEA] flex items-center justify-center hover:border-[#4B35E0] cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-heading font-extrabold text-lg text-[#0E1030] w-7 text-center">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(Math.max(1, maxAllowed), q + 1))}
                        className="w-9 h-9 rounded-xl bg-white border border-[#D9DBEA] flex items-center justify-center hover:border-[#4B35E0] cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block font-bold text-[#5B5F85] uppercase">3 · Attendee Information</label>
                    <div>
                      <label className="block font-semibold text-[#0E1030] mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="e.g. Ama Serwaa"
                        className="w-full px-4 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
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
                          className="w-full px-4 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-[#0E1030] mb-1">Email Address</label>
                        <input
                          type="email"
                          value={buyerEmail}
                          onChange={(e) => setBuyerEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full px-4 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#0E1030] text-white space-y-2.5">
                    <div className="flex justify-between text-white/80">
                      <span>
                        {activeTier.name} × {quantity}
                      </span>
                      <span className="font-mono">{fmt(baseAmountMinor)}</span>
                    </div>
                    <div className="flex justify-between text-white/80">
                      <span>Processing Fee Surcharge (~1.95%)</span>
                      <span className="font-mono">{fmt(surchargeMinor)}</span>
                    </div>
                    <div className="pt-2.5 border-t border-white/15 flex justify-between items-center">
                      <span className="font-bold text-sm">Total Amount Due</span>
                      <span className="font-heading font-extrabold text-xl text-[#F2A900]">
                        {fmt(totalAmountMinor)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || maxAllowed <= 0}
                    className="w-full py-4 rounded-xl bg-[#4B35E0] text-white font-bold text-sm hover:bg-[#3B28B8] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#4B35E0]/25"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
                    <span>
                      {submitting ? "Redirecting to Paystack..." : `Pay ${fmt(totalAmountMinor)} & Get Digital Ticket`}
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B5F85] pt-1">
                    <span className="inline-flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-[#4B35E0]" /> MTN · Telecel · AT Money
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-[#0F9D6B]" /> Visa / Mastercard
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0F9D6B]" /> Verified Gate Pass
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
