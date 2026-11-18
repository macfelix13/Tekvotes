"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Search, Filter } from "lucide-react";

export function CompetitionsClient() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<"All" | "Pageants" | "Awards" | "Talent">("All");

  const allEvents = [
    {
      id: "ev-1",
      slug: "miss-hijab-ghana-2026",
      title: "Miss Hijab Ghana 3RD EDITION",
      category: "Pageants" as const,
      organizer: "Model Tv Ghana",
      image: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=600&q=80",
      contestantsCount: 16,
      status: "Voting Open",
      unitPriceGhs: "1.00",
    },
    {
      id: "ev-2",
      slug: "mempeasem-circuit-awards-2026",
      title: "MEMPEASEM CIRCUIT MYF DINNER AND AWARDS 2026",
      category: "Awards" as const,
      organizer: "Mempeasem Circuit MYF",
      image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80",
      contestantsCount: 24,
      status: "Voting Open",
      unitPriceGhs: "1.00",
    },
    {
      id: "ev-3",
      slug: "kids-talent-show-2026",
      title: "KID'S TALENT SHOW 5th Edition 2026",
      category: "Talent" as const,
      organizer: "Kids Talent Show Network",
      image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80",
      contestantsCount: 30,
      status: "Voting Open",
      unitPriceGhs: "2.00",
    },
    {
      id: "ev-4",
      slug: "miss-campus-ghana-2026",
      title: "MISS CAMPUS GHANA 2026 FINALS",
      category: "Pageants" as const,
      organizer: "Campus Media Group",
      image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
      contestantsCount: 12,
      status: "Voting Open",
      unitPriceGhs: "1.50",
    },
    {
      id: "ev-5",
      slug: "ghana-gospel-industry-awards",
      title: "Ghana National Gospel Music Honors 2026",
      category: "Awards" as const,
      organizer: "Gospel Music Guild",
      image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80",
      contestantsCount: 45,
      status: "Coming Soon",
      unitPriceGhs: "1.00",
    },
    {
      id: "ev-6",
      slug: "accra-varsity-dance-championship",
      title: "Accra Varsity Dance Clash 2026",
      category: "Talent" as const,
      organizer: "Inter-Campus Arts Council",
      image: "https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=600&q=80",
      contestantsCount: 18,
      status: "Voting Open",
      unitPriceGhs: "1.00",
    },
  ];

  const filteredEvents = allEvents.filter((e) => {
    const matchesCat = activeCategory === "All" || e.category === activeCategory;
    const matchesQuery =
      !searchInput.trim() ||
      e.title.toLowerCase().includes(searchInput.toLowerCase()) ||
      e.organizer.toLowerCase().includes(searchInput.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0E1030]">
          Discover Competitions
        </h1>
        <p className="text-sm sm:text-base text-[#5B5F85] mt-1.5">
          Browse ongoing pageants, awards ceremonies, and talent shows across Ghana.
        </p>
      </div>

      {/* Interactive Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#D9DBEA] shadow-xs mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          <span className="text-xs font-bold uppercase text-[#5B5F85] flex items-center gap-1 mr-2">
            <Filter className="w-3.5 h-3.5" /> Category:
          </span>
          {(
            [
              { id: "All", label: `All Events (${allEvents.length})` },
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
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
          />
          <Search className="w-4 h-4 text-[#5B5F85] absolute left-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            className="bg-white rounded-2xl overflow-hidden border border-[#D9DBEA] shadow-xs hover:shadow-lg transition-all flex flex-col group"
          >
            <div className="relative aspect-[16/9] w-full bg-[#0E1030] overflow-hidden">
              <img
                src={event.image}
                alt={event.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="absolute top-3 left-3 text-[11px] font-bold text-white px-2.5 py-1 rounded-full bg-[#4B35E0] shadow-xs">
                {event.category}
              </span>
              <span
                className={`absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  event.status === "Voting Open"
                    ? "bg-[#E6F8F0] text-[#0F9D6B]"
                    : "bg-[#FDF3D6] text-[#C77700]"
                }`}
              >
                {event.status}
              </span>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0E1030] line-clamp-2 leading-snug group-hover:text-[#4B35E0] transition-colors">
                  {event.title}
                </h3>

                <div className="mt-2 flex items-center justify-between text-xs text-[#5B5F85]">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {event.organizer}
                  </span>
                  <span>{event.contestantsCount} contestants</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#D9DBEA] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#5B5F85] block">Price per vote</span>
                  <span className="font-heading font-bold text-sm text-[#0E1030]">GHS {event.unitPriceGhs}</span>
                </div>

                <Link
                  href={`/competitions/${event.slug}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4B35E0] text-white font-semibold text-xs hover:bg-[#3B28B8] transition-all shadow-xs"
                >
                  Vote Contestants
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
