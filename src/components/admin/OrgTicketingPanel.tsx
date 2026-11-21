"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { downloadCsv } from "@/lib/csv";
import { Ticket, Plus, Trash2, CheckCircle2, Search, Loader2, Download } from "lucide-react";

export interface OrgTicketOrderRow {
  id: string;
  reference: string;
  eventName: string;
  tierName: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  quantity: number;
  baseAmountMinor: number;
  surchargeMinor: number;
  totalAmountMinor: number;
  currency: string;
  status: string;
  channel: string;
  paidAt: string | null;
  createdAt: string;
}

export interface OrgTicketTierRow {
  id: string;
  eventId: string;
  eventName: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  capacity: number | null;
  soldCount: number;
  active: boolean;
}

export interface OrgIssuedTicketRow {
  id: string;
  ticketCode: string;
  holderName: string;
  holderPhone: string;
  eventName: string;
  tierName: string;
  status: string;
  checkedInAt: string | null;
  createdAt: string;
}

interface OrgTicketingPanelProps {
  organizationId: string;
  defaultCurrency: string;
  events: Array<{ id: string; name: string; code: string }>;
  tiers: OrgTicketTierRow[];
  ticketOrders?: OrgTicketOrderRow[];
  issuedTickets: OrgIssuedTicketRow[];
  onNotice: (notice: { kind: "ok" | "err"; text: string }) => void;
}

export function OrgTicketingPanel({
  organizationId,
  defaultCurrency,
  events,
  tiers,
  ticketOrders = [],
  issuedTickets,
  onNotice,
}: OrgTicketingPanelProps) {
  const router = useRouter();
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceGhs, setPriceGhs] = useState("50.00");
  const [capacity, setCapacity] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [checkInCode, setCheckInCode] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !name.trim()) return;
    setBusyId("create-tier");
    try {
      const res = await fetch("/api/v1/org/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          eventId,
          name: name.trim(),
          description: description.trim(),
          priceGhs: Number(priceGhs),
          capacity: capacity.trim() ? Number(capacity) : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        onNotice({ kind: "err", text: data?.message || "Failed to create ticket tier." });
        return;
      }
      setName("");
      setDescription("");
      setCapacity("");
      onNotice({ kind: "ok", text: `Published ticket tier "${data.tier.name}".` });
      router.refresh();
    } catch {
      onNotice({ kind: "err", text: "Network error creating ticket tier." });
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    setBusyId(tierId);
    try {
      const res = await fetch(`/api/v1/org/tickets?tierId=${tierId}`, { method: "DELETE" });
      if (!res.ok) {
        onNotice({ kind: "err", text: "Could not remove ticket tier." });
        return;
      }
      onNotice({ kind: "ok", text: "Ticket tier removed." });
      router.refresh();
    } catch {
      onNotice({ kind: "err", text: "Network error removing ticket tier." });
    } finally {
      setBusyId(null);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInCode.trim()) return;
    setCheckingIn(true);
    try {
      const res = await fetch("/api/v1/org/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          ticketCode: checkInCode.trim().toUpperCase(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        onNotice({ kind: "err", text: data?.message || "Check-in failed." });
        return;
      }
      setCheckInCode("");
      onNotice({
        kind: "ok",
        text: `Checked in ${data.pass.holder_name} (${data.pass.ticket_code})!`,
      });
      router.refresh();
    } catch {
      onNotice({ kind: "err", text: "Network error checking in ticket." });
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Create Ticket Tier */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
          <div>
            <span className="text-xs font-bold uppercase text-[#4B35E0] flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5" /> Event Box Office Setup
            </span>
            <h2 className="font-heading font-bold text-lg text-[#0E1030]">
              Create Ticket Tiers (Regular, VIP, VVIP, Table)
            </h2>
            <p className="text-xs text-[#5B5F85]">
              Ticket revenue flows directly into your Event Escrow (<code className="font-mono">v_event_funds</code>) for post-event payout.
            </p>
          </div>

          <form onSubmit={handleCreateTier} className="space-y-3 text-xs">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Event *</label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-[#0E1030]"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Tier Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Regular / VIP Pass / VVIP Table"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-[#0E1030]"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">
                  Price ({defaultCurrency}) *
                </label>
                <input
                  type="number"
                  step="0.50"
                  min="1"
                  required
                  value={priceGhs}
                  onChange={(e) => setPriceGhs(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono font-bold text-[#0E1030]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Max Capacity (Optional)</label>
                <input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono text-[#0E1030]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Perks / Note</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Front row + cocktail"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-[#0E1030]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyId === "create-tier" || events.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{busyId === "create-tier" ? "Creating..." : "Publish Ticket Tier"}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-[#D9DBEA] space-y-2.5">
            <h3 className="font-heading font-bold text-sm text-[#0E1030]">
              Published Ticket Tiers ({tiers.length})
            </h3>
            {tiers.length === 0 ? (
              <p className="text-xs text-[#5B5F85]">No ticket tiers created yet.</p>
            ) : (
              <div className="space-y-2">
                {tiers.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#0E1030]">
                        {t.name} ·{" "}
                        <span className="font-mono text-[#4B35E0]">
                          {t.currency} {(t.priceMinor / 100).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5B5F85]">
                        {t.eventName} · Sold: <strong>{t.soldCount}</strong>
                        {t.capacity != null ? ` / ${t.capacity}` : " (Unlimited)"}
                        {t.description ? ` · ${t.description}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => void handleDeleteTier(t.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D13A3A]/30 bg-white text-[#D13A3A] font-semibold hover:bg-[#D13A3A]/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Venue Gate Check-In Scanner */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
          <div>
            <span className="text-xs font-bold uppercase text-[#0F9D6B]">Venue Entrance Control</span>
            <h2 className="font-heading font-bold text-lg text-[#0E1030]">
              Ticket Pass Verification &amp; Check-In
            </h2>
            <p className="text-xs text-[#5B5F85]">
              Enter an attendee&apos;s pass code (e.g. <code className="font-mono">TT-261121-XXXX-01</code>) to verify authenticity and mark it checked in at the gate.
            </p>
          </div>

          <form onSubmit={handleCheckIn} className="space-y-3 text-xs">
            <div className="relative">
              <input
                type="text"
                required
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value.toUpperCase())}
                placeholder="TT-261121-XXXX-01"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono text-sm text-[#0E1030]"
              />
              <Search className="w-4 h-4 text-[#5B5F85] absolute left-3 top-3.5 pointer-events-none" />
            </div>
            <button
              type="submit"
              disabled={checkingIn || !checkInCode.trim()}
              className="w-full py-3 rounded-xl bg-[#0F9D6B] text-white font-bold hover:bg-[#0C8258] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {checkingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{checkingIn ? "Verifying Pass..." : "Verify & Check In Attendee"}</span>
            </button>
          </form>

          <div className="pt-4 border-t border-[#D9DBEA] space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-[#0E1030]">
                Issued Digital Passes ({issuedTickets.length})
              </h3>
              {issuedTickets.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      `ticket-passes-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Pass Code", "Holder Name", "Phone", "Event", "Tier", "Status", "Checked In At"],
                      issuedTickets.map((p) => [
                        p.ticketCode,
                        p.holderName,
                        p.holderPhone,
                        p.eventName,
                        p.tierName,
                        p.status,
                        p.checkedInAt ?? "",
                      ])
                    )
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4B35E0] hover:underline cursor-pointer"
                >
                  <Download className="w-3 h-3" /> Export Passes CSV
                </button>
              ) : null}
            </div>
            {issuedTickets.length === 0 ? (
              <p className="text-xs text-[#5B5F85]">No tickets sold yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {issuedTickets.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#4B35E0] block">{p.ticketCode}</span>
                      <span className="font-semibold text-[#0E1030]">{p.holderName} · {p.holderPhone}</span>
                      <span className="text-[11px] text-[#5B5F85] block">
                        {p.eventName} — {p.tierName}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        p.status === "valid"
                          ? "bg-[#E6F8F0] text-[#0F9D6B]"
                          : "bg-[#FDF3D6] text-[#C77700]"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Ticket Purchase Orders & Buyer Ledger */}
      <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9DBEA] pb-3">
          <div>
            <span className="text-xs font-bold uppercase text-[#4B35E0]">Separate Ticketing Sales Ledger</span>
            <h2 className="font-heading font-bold text-lg text-[#0E1030]">
              Ticket Purchase Orders &amp; Buyer Records ({ticketOrders.length})
            </h2>
            <p className="text-xs text-[#5B5F85]">
              All ticket purchases (<code className="font-mono">TT-...</code>) are recorded separately from voting orders (<code className="font-mono">TV-...</code>).
            </p>
          </div>
          <button
            type="button"
            disabled={ticketOrders.length === 0}
            onClick={() =>
              downloadCsv(
                `ticket-orders-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Reference", "Event", "Tier", "Buyer Name", "Phone", "Email", "Qty", "Ticket Amount", "Total Paid", "Status", "Paid At"],
                ticketOrders.map((o) => [
                  o.reference,
                  o.eventName,
                  o.tierName,
                  o.buyerName,
                  o.buyerPhone,
                  o.buyerEmail,
                  o.quantity,
                  (o.baseAmountMinor / 100).toFixed(2),
                  (o.totalAmountMinor / 100).toFixed(2),
                  o.status,
                  o.paidAt ?? o.createdAt,
                ])
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D9DBEA] bg-white text-xs font-bold text-[#0E1030] hover:border-[#4B35E0] disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Ticket Sales CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#D9DBEA] text-[#5B5F85] uppercase">
                <th className="py-3 px-3">Order Ref</th>
                <th className="py-3 px-3">Buyer</th>
                <th className="py-3 px-3">Event &amp; Tier</th>
                <th className="py-3 px-3">Qty</th>
                <th className="py-3 px-3">Ticket Revenue</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DBEA]">
              {ticketOrders.map((o) => (
                <tr key={o.id} className="hover:bg-[#F6F7FC]">
                  <td className="py-3 px-3 font-mono font-bold text-[#4B35E0]">{o.reference}</td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-[#0E1030]">{o.buyerName}</div>
                    <div className="text-[11px] text-[#5B5F85]">
                      {o.buyerPhone}
                      {o.buyerEmail ? ` · ${o.buyerEmail}` : ""}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-[#0E1030]">{o.eventName}</div>
                    <div className="text-[11px] text-[#5B5F85]">{o.tierName}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold">{o.quantity}</td>
                  <td className="py-3 px-3 font-mono font-bold text-[#0E1030]">
                    {o.currency} {(o.baseAmountMinor / 100).toFixed(2)}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        o.status === "paid"
                          ? "bg-[#E6F8F0] text-[#0F9D6B]"
                          : "bg-[#FDF3D6] text-[#C77700]"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-[#5B5F85] font-mono">
                    {(o.paidAt ?? o.createdAt).slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))}
              {ticketOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#5B5F85]">
                    No ticket purchase orders recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
