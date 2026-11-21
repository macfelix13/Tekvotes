"use client";

import { useState } from "react";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import type { PublicTicketedEvent } from "@/lib/public-events";
import { Ticket, MapPin, Building2, Search, ShieldCheck, ArrowRight, Sparkles, Calendar } from "lucide-react";

const formatEventDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Accra",
      })
    : "Date TBA";

export function TicketsClient({ events }: { events: PublicTicketedEvent[] }) {
  const [searchInput, setSearchInput] = useState("");

  const filtered = events.filter((e) => {
    const q = searchInput.trim().toLowerCase();
    return (
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.organizerName.toLowerCase().includes(q) ||
      (e.venue ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      <div className="bg-gradient-to-r from-[#0E1030] to-[#231B68] text-white rounded-3xl p-6 sm:p-10 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 text-[#F2A900] text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Digital Event Box Office &amp; E-Tickets
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-white">
            Buy Official Event Tickets &amp; VIP Passes
          </h1>
          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            Instant Mobile Money &amp; Card checkout for awards nights, grand finales, and campus shows. Every purchase issues verifiable digital ticket pass codes (<code className="font-mono text-[#F2A900]">TT-...</code>).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link
            href="/verify"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/15"
          >
            <ShieldCheck className="w-4 h-4 text-[#F2A900]" />
            <span>Verify Ticket Pass</span>
          </Link>
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search event, venue, or organiser..."
              aria-label="Search events"
              className="w-full sm:w-72 pl-9 pr-4 py-3 rounded-xl bg-white text-[#0E1030] text-xs font-medium focus:outline-none"
            />
            <Search className="w-4 h-4 text-[#5B5F85] absolute left-3 top-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-[#D9DBEA] p-12 text-center text-sm text-[#5B5F85]">
          No events match your search.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {filtered.map((ev, idx) => {
            const minPrice = ev.tiers.length
              ? Math.min(...ev.tiers.map((t) => t.priceMinor))
              : null;
            return (
              <Reveal key={ev.id} delayMs={Math.min(idx, 5) * 60}>
                <div className="bg-white rounded-3xl overflow-hidden border border-[#D9DBEA] shadow-xs hover:shadow-xl transition-all flex flex-col group h-full">
                  <Link
                    href={`/tickets/${ev.slug}`}
                    className="relative aspect-[4/5] w-full bg-[#0E1030] overflow-hidden flex items-end p-5 block"
                  >
                    {ev.ticketFlyerUrl ? (
                      <>
                        <img
                          src={ev.ticketFlyerUrl}
                          alt={ev.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1030] via-[#0E1030]/45 to-transparent" />
                      </>
                    ) : null}
                    <span className="relative z-10 font-heading font-extrabold text-white text-2xl leading-tight line-clamp-2 drop-shadow-md">
                      {ev.name}
                    </span>
                    <span className="relative z-10 absolute top-3.5 left-3.5 text-xs font-bold text-white px-3 py-1 rounded-full bg-[#4B35E0] shadow-xs inline-flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5" />
                      {ev.tiers.length > 0 ? `${ev.tiers.length} Ticket Tier(s)` : "Ticket Event"}
                    </span>
                  </Link>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FDF3D6] text-[#C77700] text-xs font-bold">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>Official Date: {formatEventDateTime(ev.eventDate)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#5B5F85]">
                        <span className="inline-flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" /> {ev.organizerName}
                        </span>
                        {ev.venue ? (
                          <span className="inline-flex items-center gap-1 text-[#0E1030] font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-[#4B35E0]" /> {ev.venue}
                          </span>
                        ) : null}
                      </div>

                      {ev.tiers.length > 0 ? (
                        <div className="space-y-1.5 pt-2">
                          {ev.tiers.map((t) => {
                            const soldOut = t.capacity != null && t.soldCount >= t.capacity;
                            return (
                              <Link
                                key={t.id}
                                href={`/tickets/${ev.slug}`}
                                className="w-full text-left px-3 py-2 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E5FD] border border-[#D9DBEA] flex items-center justify-between text-xs transition-colors"
                              >
                                <span className="font-bold text-[#0E1030]">{t.name}</span>
                                <span className="font-mono font-bold text-[#4B35E0]">
                                  {soldOut ? "SOLD OUT" : `${t.currency} ${(t.priceMinor / 100).toFixed(2)}`}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#5B5F85] pt-1">
                          Ticket tiers will be published shortly.
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#D9DBEA] flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-[#5B5F85] block">Ticket Price</span>
                        <span className="font-heading font-bold text-sm text-[#0E1030]">
                          {minPrice != null ? `From GHS ${(minPrice / 100).toFixed(2)}` : "Coming Soon"}
                        </span>
                      </div>

                      <Link
                        href={`/tickets/${ev.slug}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white font-bold text-xs hover:bg-[#3B28B8] shadow-xs"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        <span>Purchase Tickets</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
