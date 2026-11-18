"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users } from "lucide-react";

export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState("contestant");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      router.push("/competitions");
      return;
    }
    router.push(`/competitions?q=${encodeURIComponent(query.trim())}&type=${searchType}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 -mt-10 sm:-mt-12 relative z-20">
      <div className="bg-white rounded-2xl shadow-xl border border-[#D9DBEA] p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="w-full flex-1 flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-auto">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#5B5F85] mb-1 sm:hidden">
              What to Search
            </span>
            <div className="hidden sm:block text-xs font-bold uppercase tracking-wider text-[#5B5F85] pr-2 border-r border-[#D9DBEA]">
              Search
            </div>
          </div>

          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter contestant code (e.g. SK01) or event name..."
              className="w-full px-4 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030] placeholder-[#5B5F85] focus:outline-none focus:ring-2 focus:ring-[#4B35E0] focus:border-transparent transition-all"
            />
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="px-3.5 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-medium text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
            >
              <option value="contestant">Contestant</option>
              <option value="event">Event</option>
            </select>

            <button
              type="submit"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>
        </form>

        {/* Social Proof Stats Pill */}
        <div className="hidden lg:flex items-center gap-3 pl-6 border-l border-[#D9DBEA]">
          <div className="w-10 h-10 rounded-full bg-[#E8E5FD] flex items-center justify-center text-[#4B35E0]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="font-heading font-extrabold text-lg text-[#0E1030] leading-tight">50,717+</div>
            <div className="text-xs font-medium text-[#5B5F85]">Active Voters</div>
          </div>
        </div>
      </div>
    </div>
  );
}
