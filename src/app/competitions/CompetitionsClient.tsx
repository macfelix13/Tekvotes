"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Search, Filter } from "lucide-react";
import type { PublicEventSummary } from "@/lib/public-events";

type Bucket = "All" | "Pageants" | "Awards" | "Talent";

const bucketFor = (eventType: string): Exclude<Bucket, "All"> | "Other" => {
  if (eventType === "beauty_pageant") return "Pageants";
  if (eventType === "award_show") return "Awards";
  if (eventType === "talent_show" || eventType === "campus_contest") return "Talent";
  return "Other";
};

const formatGhs = (minor: number | null) => (minor == null ? "—" : `GHS ${(minor / 100).toFixed(2)}`);

export function CompetitionsClient({ events }: { events: PublicEventSummary[] }) {
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState<Bucket>("All");

  const filteredEvents = events.filter((e) => {
    const matchesCat = activeCategory === "All" || bucketFor(e.eventType) === activeCategory;
    const q = searchInput.trim().toLowerCase();
    const matchesQuery = !q || e.name.toLowerCase().includes(q) || e.organizerName.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0E1030]">Discover Competitions</h1>
        <p className="text-sm sm:text-base text-[#5B5F85] mt-1.5">
          Browse ongoing pageants, awards ceremonies, and talent shows across Ghana.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-[#D9DBEA] shadow-xs mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          <span className="text-xs font-bold uppercase text-[#5B5F85] flex items-center gap-1 mr-2">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {(
            [
              { id: "All", label: `All Events (${events.length})` },
              { id: "Pageants", label: "Pageants" },
              { id: "Awards", label: "Awards" },
              { id: "Talent", label: "Talent Shows" },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-[#4B35E0] text-white shadow-xs"
                  : "bg-[#F6F7FC] text-[#5B5F85] hover:text-[#0E1030]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72 relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search events or organizers..."
            aria-label="Search events or organizers"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
          />
          <Search className="w-4 h-4 text-[#5B5F85] absolute left-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#D9DBEA] p-12 text-center text-sm text-[#5B5F85]">
          {events.length === 0 ? "No competitions are published yet." : "No competitions match your search."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const bucket = bucketFor(event.eventType);
            return (
              <div
                key={event.id}
                className="bg-white rounded-2xl overflow-hidden border border-[#D9DBEA] shadow-xs hover:shadow-lg transition-all flex flex-col group"
              >
                <div className="relative aspect-[16/9] w-full bg-[#0E1030] overflow-hidden flex items-end p-4">
                  {event.bannerUrl ? (
                    <>
                      <img
                        src={event.bannerUrl}
                        alt={event.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0E1030]/90 via-[#0E1030]/35 to-transparent" />
                    </>
                  ) : null}
                  <span className="relative z-10 font-heading font-extrabold text-white/95 text-2xl leading-tight line-clamp-2">
                    {event.name}
                  </span>
                  <span className="relative z-10 absolute top-3 left-3 text-[11px] font-bold text-white px-2.5 py-1 rounded-full bg-[#4B35E0] shadow-xs">
                    {bucket}
                  </span>
                  <span
                    className={`relative z-10 absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      event.votingOpen ? "bg-[#E6F8F0] text-[#0F9D6B]" : "bg-[#FDF3D6] text-[#C77700]"
                    }`}
                  >
                    {event.votingOpen ? "Voting Open" : event.votingStatus === "closed" ? "Closed" : "Coming Soon"}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-[#0E1030] line-clamp-2 leading-snug group-hover:text-[#4B35E0] transition-colors">
                      {event.name}
                    </h3>
                    <div className="mt-2 flex items-center justify-between text-xs text-[#5B5F85]">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {event.organizerName}
                      </span>
                      <span>{event.contestantsCount} contestants</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#D9DBEA] flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-[#5B5F85] block">Price per vote</span>
                      <span className="font-heading font-bold text-sm text-[#0E1030]">
                        {formatGhs(event.minUnitPriceMinor)}
                      </span>
                    </div>
                    <Link
                      href={`/competitions/${event.slug}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4B35E0] text-white font-semibold text-xs hover:bg-[#3B28B8] transition-all shadow-xs"
                    >
                      {event.votingOpen ? "Vote Contestants" : "View Event"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
