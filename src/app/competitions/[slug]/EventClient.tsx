"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { Reveal } from "@/components/ui/Reveal";
import { VotingDrawer, type Contestant } from "@/components/voting/VotingDrawer";
import type { PublicEventDetail, PublicCategoryEntry } from "@/lib/public-events";
import { Building2, Calendar, Trophy, Search, Flame, BarChart3, Users, Lock, Share2, Check } from "lucide-react";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Accra" })
    : "TBA";

function Portrait({ name, photoUrl, className }: { name: string; photoUrl: string | null; className: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`object-cover ${className}`} />;
  }
  return (
    <div aria-hidden className={`bg-[#0E1030] text-white font-heading font-bold flex items-center justify-center ${className}`}>
      {initials(name)}
    </div>
  );
}

export function EventClient({ event, initialCode }: { event: PublicEventDetail; initialCode?: string }) {
  const cleanedInitial = initialCode?.trim() ?? "";
  const initialMatch = cleanedInitial
    ? event.entries.find((e) => e.code.toLowerCase() === cleanedInitial.toLowerCase()) ?? null
    : null;

  const [selected, setSelected] = useState<PublicCategoryEntry | null>(
    event.votingOpen && initialMatch ? initialMatch : null
  );
  const [activeTab, setActiveTab] = useState<"contestants" | "leaderboard">("contestants");
  const [searchTerm, setSearchTerm] = useState(cleanedInitial);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleShareContestant = async (c: PublicCategoryEntry) => {
    const shareUrl = `${window.location.origin}/competitions/${event.slug}?code=${encodeURIComponent(c.code)}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Vote for ${c.name} (${c.code}) — ${event.name}`,
          text: `Support ${c.name} in ${event.name} on TekVotes!`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fall through to clipboard copy if user cancels native share
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      setCopiedCode(c.id);
      setTimeout(() => setCopiedCode((prev) => (prev === c.id ? null : prev)), 2000);
    }
  };

  const minPrice = event.categories.length ? Math.min(...event.categories.map((c) => c.unitPriceMinor)) : null;

  const filtered = event.entries.filter((e) => {
    const q = searchTerm.toLowerCase();
    const matchesQ = !q || e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q);
    return matchesQ && (activeCategoryId === "all" || e.categoryId === activeCategoryId);
  });

  const leaderboard = useMemo(
    () =>
      event.categories.map((cat) => {
        const rows = event.entries
          .filter((e) => e.categoryId === cat.id)
          .sort((a, b) => {
            if (a.officialResult && b.officialResult) {
              return a.officialResult.rank - b.officialResult.rank;
            }
            return (b.votes ?? 0) - (a.votes ?? 0) || a.contestantNumber - b.contestantNumber;
          });
        const total = rows.reduce((acc, r) => acc + (r.votes ?? 0), 0);
        return { cat, rows, total };
      }),
    [event]
  );

  const drawerContestant: Contestant | null = selected
    ? {
        id: selected.id,
        name: selected.name,
        code: selected.code,
        photo: selected.photoUrl,
        categoryName: selected.categoryName,
        votes: selected.votes ?? 0,
      }
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 pb-20">
        <div className="relative bg-[#0E1030] text-white overflow-hidden">
          {event.bannerUrl ? (
            <div className="absolute inset-0 opacity-30">
              <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E1030] via-[#0E1030]/80 to-transparent" />
            </div>
          ) : null}

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative z-10">
            <div className="max-w-3xl space-y-4 animate-hero-in">
              <div className="flex flex-wrap items-center gap-2">
                {event.votingOpen ? (
                  <span className="px-3 py-1 rounded-full bg-[#E6F8F0] text-[#0F9D6B] text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0F9D6B] animate-pulse" />
                    Voting Active
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-[#FDF3D6] text-[#C77700] text-xs font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    {event.votingStatus === "closed" ? "Voting Closed" : "Coming Soon"}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white leading-tight">{event.name}</h1>
              {event.description ? (
                <p className="text-white/80 text-sm sm:text-base leading-relaxed">{event.description}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm text-white/70">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#F2A900]" /> {event.organizerName}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#F2A900]" />
                  {event.votingOpen ? `Closes ${formatDate(event.closesAt)}` : `Opens ${formatDate(event.opensAt)}`}
                </span>
                {minPrice != null ? (
                  <span className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-[#F2A900]" /> From GHS {(minPrice / 100).toFixed(2)} / vote
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
          <div className="bg-white rounded-2xl p-4 border border-[#D9DBEA] shadow-lg flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full lg:w-auto">
              {(
                [
                  { id: "contestants", label: `Contestants (${event.entries.length})`, Icon: Users },
                  { id: "leaderboard", label: "Leaderboard", Icon: BarChart3 },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === id ? "bg-[#4B35E0] text-white shadow-sm" : "bg-[#F6F7FC] text-[#5B5F85] hover:text-[#0E1030]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {activeTab === "contestants" ? (
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                {event.categories.length > 1 ? (
                  <select
                    value={activeCategoryId}
                    onChange={(e) => setActiveCategoryId(e.target.value)}
                    aria-label="Filter by category"
                    className="px-3 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                  >
                    <option value="all">All categories</option>
                    {event.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="w-full sm:w-80 relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search contestant or short code..."
                    aria-label="Search contestant or short code"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                  />
                  <Search className="w-4 h-4 text-[#5B5F85] absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {activeTab === "contestants" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#D9DBEA] p-12 text-center text-sm text-[#5B5F85]">
                {event.entries.length === 0 ? "No contestants have been published yet." : "No contestants match your search."}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {filtered.map((c, idx) => (
                  <Reveal key={c.id} delayMs={Math.min(idx, 7) * 50}>
                    <div className="bg-white rounded-2xl overflow-hidden border border-[#D9DBEA] shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group h-full">
                    <div className="relative aspect-[3/4] w-full bg-[#0E1030] overflow-hidden">
                      <Portrait
                        name={c.name}
                        photoUrl={c.photoUrl}
                        className="w-full h-full text-5xl group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                      <span className="absolute top-3 left-3 font-mono font-bold text-xs bg-[#0E1030]/80 text-white px-2.5 py-1 rounded-md border border-white/20">
                        Code: {c.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleShareContestant(c)}
                        title="Share contestant vote link"
                        className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0E1030]/80 hover:bg-[#4B35E0] text-white text-[11px] font-semibold border border-white/20 transition-colors cursor-pointer"
                      >
                        {copiedCode === c.id ? <Check className="w-3 h-3 text-[#0F9D6B]" /> : <Share2 className="w-3 h-3" />}
                        <span>{copiedCode === c.id ? "Copied" : "Share"}</span>
                      </button>
                      <div className="absolute bottom-3 left-3 right-3 text-white">
                        <span className="text-[11px] font-semibold text-[#F2A900] block">{c.categoryName}</span>
                        <h3 className="font-heading font-bold text-base leading-tight">{c.name}</h3>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      {c.bio ? (
                        <p className="text-xs text-[#5B5F85] line-clamp-2">{c.bio}</p>
                      ) : null}

                      <div className="flex items-center justify-between text-xs text-[#5B5F85]">
                        <span>GHS {(c.unitPriceMinor / 100).toFixed(2)} / vote</span>
                        <span className="font-heading font-extrabold text-[#4B35E0] text-sm">
                          {c.votes == null
                            ? "Results hidden"
                            : event.categories.find((cat) => cat.id === c.categoryId)?.liveVisibility === "ranks_only"
                            ? "Ranked Live"
                            : `${c.votes.toLocaleString()} votes`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {event.votingOpen ? (
                          <button
                            type="button"
                            onClick={() => setSelected(c)}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white font-semibold text-xs hover:bg-[#3B28B8] shadow-sm transition-all cursor-pointer"
                          >
                            <Flame className="w-3.5 h-3.5 fill-[#F2A900] text-[#F2A900]" />
                            <span>Vote Now</span>
                          </button>
                        ) : (
                          <div className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-[#5B5F85] font-semibold text-xs">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Voting Locked</span>
                          </div>
                        )}
                        <Link
                          href={`/competitions/${event.slug}/contestants/${encodeURIComponent(c.code)}`}
                          className="px-3 py-2.5 rounded-xl border border-[#D9DBEA] bg-white text-[#0E1030] text-xs font-semibold hover:border-[#4B35E0] hover:text-[#4B35E0] shrink-0"
                        >
                          Track
                        </Link>
                      </div>
                    </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
            {leaderboard.map(({ cat, rows, total }) => (
              <Reveal key={cat.id}>
                <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D9DBEA] shadow-lg space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#D9DBEA]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">Category</span>
                      {cat.isFinal ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#E6F8F0] text-[#0F9D6B] text-[10px] font-bold uppercase">
                          Official Final Results
                        </span>
                      ) : null}
                    </div>
                    <h2 className="font-heading font-extrabold text-2xl text-[#0E1030] mt-0.5">{cat.name}</h2>
                  </div>
                  {cat.resultsVisible && cat.liveVisibility === "counts" ? (
                    <div className="text-right">
                      <span className="text-xs text-[#5B5F85] block">Total votes</span>
                      <span className="font-heading font-extrabold text-lg text-[#0E1030]">{total.toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>

                {!cat.resultsVisible ? (
                  <p className="text-sm text-[#5B5F85]">The organiser has hidden live results for this category.</p>
                ) : (
                  <div className="space-y-3">
                    {rows.map((c, index) => {
                      const percent = total > 0 ? (((c.votes ?? 0) / total) * 100).toFixed(1) : "0.0";
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA]"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-heading font-bold text-sm ${
                                index === 0 && total > 0
                                  ? "bg-[#F2A900] text-[#0E1030]"
                                  : "bg-white text-[#5B5F85] border border-[#D9DBEA]"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <Portrait name={c.name} photoUrl={c.photoUrl} className="w-12 h-12 rounded-xl text-sm shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#4B35E0]">{c.code}</span>
                                <p className="font-heading font-bold text-sm text-[#0E1030]">{c.name}</p>
                              </div>
                              <div className="w-32 sm:w-48 bg-[#D9DBEA] h-2 rounded-full overflow-hidden mt-1.5">
                                <div
                                  className="bg-[#4B35E0] h-full rounded-full"
                                  style={{ width: cat.liveVisibility === "ranks_only" ? "100%" : `${percent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {c.officialResult ? (
                              <>
                                <span className="font-heading font-extrabold text-[#4B35E0] text-base block">
                                  {c.officialResult.finalScore.toFixed(2)} pts
                                </span>
                                <span className="text-[11px] font-medium text-[#5B5F85]">
                                  Public {c.officialResult.publicVoteScore.toFixed(1)} · Judge{" "}
                                  {c.officialResult.judgeScore.toFixed(1)} ({(c.votes ?? 0).toLocaleString()} votes)
                                </span>
                              </>
                            ) : cat.liveVisibility === "ranks_only" ? (
                              <span className="text-xs font-bold text-[#4B35E0]">Rank #{index + 1}</span>
                            ) : cat.liveVisibility === "percent" ? (
                              <span className="font-heading font-extrabold text-[#0E1030] text-base block">
                                {percent}%
                              </span>
                            ) : (
                              <>
                                <span className="font-heading font-extrabold text-[#0E1030] text-base block">
                                  {(c.votes ?? 0).toLocaleString()}
                                </span>
                                <span className="text-xs font-medium text-[#5B5F85]">{percent}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </section>
              </Reveal>
            ))}
          </div>
        )}
      </main>

      {selected && drawerContestant && (
        <VotingDrawer
          contestant={drawerContestant}
          eventName={event.name}
          unitPriceGhs={selected.unitPriceMinor / 100}
          onClose={() => setSelected(null)}
          onSuccess={() => setSelected(null)}
        />
      )}
    </div>
  );
}
