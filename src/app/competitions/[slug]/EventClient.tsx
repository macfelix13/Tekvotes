"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { Reveal } from "@/components/ui/Reveal";
import { VotingDrawer, type Contestant } from "@/components/voting/VotingDrawer";
import { TicketCheckoutDrawer } from "@/components/tickets/TicketCheckoutDrawer";
import type { PublicEventDetail, PublicCategoryEntry, PublicEventGalleryPhoto } from "@/lib/public-events";
import {
  Building2,
  Calendar,
  Trophy,
  Search,
  Flame,
  BarChart3,
  Users,
  Lock,
  Share2,
  Check,
  Info,
  Images,
  MapPin,
  ShieldCheck,
  X,
  Ticket,
} from "lucide-react";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const formatDate = (iso: string | null, fallback = "TBA") =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Accra" })
    : fallback;

const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Accra",
      })
    : null;

function formatDurationBadge(event: PublicEventDetail): string {
  const opens = formatDateTime(event.opensAt);
  const closes = formatDateTime(event.closesAt);
  if (event.votingStatus === "closed") {
    return closes ? `Ended ${closes}` : "Voting Closed";
  }
  if (event.votingOpen) {
    return closes ? `Closes ${closes}` : "Live · Open-Ended (TBA Close)";
  }
  if (opens && closes) {
    return `Scheduled: ${opens} – ${closes}`;
  }
  if (opens) {
    return `Opens ${opens}`;
  }
  return "Schedule TBA";
}

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

  const isTicketOnlyEvent =
    event.eventType === "ticketed_event" ||
    (event.entries.length === 0 && (event.ticketTiers?.length ?? 0) > 0);

  const [selected, setSelected] = useState<PublicCategoryEntry | null>(
    event.votingOpen && initialMatch ? initialMatch : null
  );
  const [activeTab, setActiveTab] = useState<"contestants" | "leaderboard" | "about" | "gallery">(
    isTicketOnlyEvent ? "about" : "contestants"
  );
  const [searchTerm, setSearchTerm] = useState(cleanedInitial);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [galleryFilter, setGalleryFilter] = useState<"all" | "event" | "contestant">("all");
  const [lightboxPhoto, setLightboxPhoto] = useState<PublicEventGalleryPhoto | null>(null);
  const [ticketDrawerOpen, setTicketDrawerOpen] = useState(false);

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

  const filteredGallery = event.galleryPhotos.filter((g) =>
    galleryFilter === "all" ? true : g.source === galleryFilter
  );

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

  const heroFlyerUrl = isTicketOnlyEvent
    ? event.ticketFlyerUrl || event.bannerUrl
    : event.bannerUrl;

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 pb-20">
        <div className="relative bg-[#0E1030] text-white overflow-hidden">
          {heroFlyerUrl ? (
            <div className="absolute inset-0 opacity-35">
              <img src={heroFlyerUrl} alt={event.name} className="w-full h-full object-cover" />
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

              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm text-white/75">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#F2A900]" /> {event.organizerName}
                </span>
                {event.venue ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#F2A900]" /> {event.venue}
                  </span>
                ) : null}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#F2A900]" />
                  {isTicketOnlyEvent
                    ? event.eventDate
                      ? `Event Date: ${formatDateTime(event.eventDate)}`
                      : "Event Date TBA"
                    : formatDurationBadge(event)}
                </span>
                {minPrice != null ? (
                  <span className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-[#F2A900]" /> From GHS {(minPrice / 100).toFixed(2)} / vote
                  </span>
                ) : null}
                {event.ticketTiers && event.ticketTiers.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setTicketDrawerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#F2A900] text-[#0E1030] font-bold text-xs hover:bg-[#D99600] cursor-pointer shadow-sm"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>Buy Event Tickets</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
          <div className="bg-white rounded-2xl p-4 border border-[#D9DBEA] shadow-lg flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {(
                isTicketOnlyEvent
                  ? ([
                      { id: "about", label: "Event Details & Tickets", Icon: Info },
                      { id: "gallery", label: `Gallery (${event.galleryPhotos.length})`, Icon: Images },
                    ] as const)
                  : ([
                      { id: "contestants", label: `Contestants (${event.entries.length})`, Icon: Users },
                      { id: "leaderboard", label: "Leaderboard", Icon: BarChart3 },
                      { id: "about", label: "About", Icon: Info },
                      { id: "gallery", label: `Gallery (${event.galleryPhotos.length})`, Icon: Images },
                    ] as const)
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
                {filtered.map((c, idx) => (
                  <Reveal key={c.id} delayMs={Math.min(idx, 7) * 50}>
                    <div className="bg-white rounded-3xl overflow-hidden border border-[#D9DBEA] shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col group h-full">
                      <div className="relative aspect-[3/4] min-h-[380px] sm:min-h-[420px] w-full bg-[#0E1030] overflow-hidden">
                        <Portrait
                          name={c.name}
                          photoUrl={c.photoUrl}
                          className="w-full h-full text-6xl object-top group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1030] via-[#0E1030]/45 to-transparent pointer-events-none" />
                        <span className="absolute top-3.5 left-3.5 font-mono font-bold text-xs bg-[#0E1030]/90 text-[#F2A900] px-3 py-1 rounded-lg border border-white/20 shadow-sm">
                          Code: {c.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleShareContestant(c)}
                          title="Share contestant vote link"
                          className="absolute top-3.5 right-3.5 inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#0E1030]/90 hover:bg-[#4B35E0] text-white text-xs font-semibold border border-white/20 transition-colors cursor-pointer shadow-sm"
                        >
                          {copiedCode === c.id ? <Check className="w-3.5 h-3.5 text-[#0F9D6B]" /> : <Share2 className="w-3.5 h-3.5" />}
                          <span>{copiedCode === c.id ? "Copied" : "Share"}</span>
                        </button>
                        <div className="absolute bottom-4 left-4 right-4 z-10">
                          <span className="inline-block text-xs font-bold uppercase tracking-wider text-white/95 bg-[#4B35E0]/90 px-2.5 py-0.5 rounded-full mb-1.5 shadow-xs">
                            {c.categoryName}
                          </span>
                          <h3
                            style={{ color: "#F2A900" }}
                            className="font-heading font-extrabold text-xl sm:text-2xl leading-tight text-[#F2A900] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
                          >
                            {c.name}
                          </h3>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-heading font-extrabold text-base text-[#0E1030]">
                              {c.name}
                            </span>
                            <span className="font-mono text-xs font-bold text-[#4B35E0] bg-[#E8E5FD] px-2 py-0.5 rounded-md">
                              {c.code}
                            </span>
                          </div>
                          {c.bio ? (
                            <p className="text-xs text-[#5B5F85] line-clamp-2 mt-1.5 leading-relaxed">{c.bio}</p>
                          ) : null}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs text-[#5B5F85] pt-2 border-t border-[#D9DBEA]/80">
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
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#4B35E0] text-white font-bold text-xs hover:bg-[#3B28B8] shadow-sm transition-all cursor-pointer"
                              >
                                <Flame className="w-4 h-4 fill-[#F2A900] text-[#F2A900]" />
                                <span>Vote Now</span>
                              </button>
                            ) : (
                              <div className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-[#5B5F85] font-semibold text-xs">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Voting Locked</span>
                              </div>
                            )}
                            <Link
                              href={`/competitions/${event.slug}/contestants/${encodeURIComponent(c.code)}`}
                              className="px-3.5 py-3 rounded-xl border border-[#D9DBEA] bg-white text-[#0E1030] text-xs font-bold hover:border-[#4B35E0] hover:text-[#4B35E0] shrink-0"
                            >
                              Track
                            </Link>
                          </div>
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
                            <Portrait name={c.name} photoUrl={c.photoUrl} className="w-14 h-14 rounded-xl text-sm shrink-0" />
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

        {activeTab === "about" && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
            <Reveal>
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-[#D9DBEA] shadow-sm space-y-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">About This Competition</span>
                    <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0E1030] mt-1">
                      {event.name}
                    </h2>
                  </div>

                  {event.bannerUrl ? (
                    <div className="rounded-2xl overflow-hidden border border-[#D9DBEA] aspect-[16/9] bg-[#0E1030]">
                      <img src={event.bannerUrl} alt={event.name} className="w-full h-full object-cover" />
                    </div>
                  ) : null}

                  <div className="space-y-4 text-sm text-[#5B5F85] leading-relaxed">
                    <p className="whitespace-pre-line">
                      {event.description ||
                        `${event.name} is an official digital voting competition hosted by ${event.organizerName} on TekVotes Ghana. Cast verified votes for your favourite nominees using MTN Mobile Money, Telecel Cash, AT Money, or Visa/Mastercard.`}
                    </p>
                    {event.rulesText ? (
                      <div className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] space-y-1.5">
                        <h3 className="font-heading font-bold text-sm text-[#0E1030]">Event Rules &amp; Guidelines</h3>
                        <p className="text-xs text-[#5B5F85] whitespace-pre-line">{event.rulesText}</p>
                      </div>
                    ) : null}
                    {event.ticketTiers && event.ticketTiers.length > 0 ? (
                      <div className="p-5 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-heading font-bold text-base text-[#0E1030]">
                            Available Ticket Tiers
                          </h3>
                          <button
                            type="button"
                            onClick={() => setTicketDrawerOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4B35E0] text-white font-bold text-xs hover:bg-[#3B28B8] cursor-pointer"
                          >
                            <Ticket className="w-3.5 h-3.5" />
                            <span>Buy Tickets Now</span>
                          </button>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {event.ticketTiers.map((t) => (
                            <div
                              key={t.id}
                              onClick={() => setTicketDrawerOpen(true)}
                              className="p-3.5 rounded-xl bg-white border border-[#D9DBEA] hover:border-[#4B35E0] flex items-center justify-between cursor-pointer"
                            >
                              <div>
                                <div className="font-bold text-xs text-[#0E1030]">{t.name}</div>
                                {t.description ? (
                                  <div className="text-[11px] text-[#5B5F85]">{t.description}</div>
                                ) : null}
                              </div>
                              <span className="font-mono font-extrabold text-sm text-[#4B35E0]">
                                {t.currency} {(t.priceMinor / 100).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white rounded-3xl p-6 border border-[#D9DBEA] shadow-sm space-y-4">
                    <h3 className="font-heading font-bold text-base text-[#0E1030]">Event Facts &amp; Schedule</h3>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between py-2 border-b border-[#D9DBEA]">
                        <span className="text-[#5B5F85]">Organiser</span>
                        <strong className="text-[#0E1030]">{event.organizerName}</strong>
                      </div>
                      {event.venue ? (
                        <div className="flex items-center justify-between py-2 border-b border-[#D9DBEA]">
                          <span className="text-[#5B5F85]">Venue</span>
                          <strong className="text-[#0E1030]">{event.venue}</strong>
                        </div>
                      ) : null}
                      {event.eventDate ? (
                        <div className="flex items-center justify-between py-2 border-b border-[#D9DBEA]">
                          <span className="text-[#5B5F85]">Event Date &amp; Time</span>
                          <strong className="text-[#C77700]">{formatDateTime(event.eventDate)}</strong>
                        </div>
                      ) : null}
                      {!isTicketOnlyEvent ? (
                        <>
                          <div className="flex items-center justify-between py-2 border-b border-[#D9DBEA]">
                            <span className="text-[#5B5F85]">Duration Mode</span>
                            <strong className="text-[#4B35E0]">
                              {event.opensAt || event.closesAt ? "Scheduled Window" : "Open-Ended / TBA"}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-[#D9DBEA]">
                            <span className="text-[#5B5F85]">Voting Opens</span>
                            <strong className="text-[#0E1030]">
                              {formatDateTime(event.opensAt) ?? (event.votingOpen ? "Active Now" : "TBA")}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-[#D9DBEA]">
                            <span className="text-[#5B5F85]">Voting Closes</span>
                            <strong className="text-[#0E1030]">
                              {formatDateTime(event.closesAt) ?? (event.votingOpen ? "Open-Ended (TBA)" : formatDate(event.closesAt))}
                            </strong>
                          </div>
                        </>
                      ) : null}
                      <div className="flex items-center justify-between py-2 border-b border-[#D9DBEA]">
                        <span className="text-[#5B5F85]">Categories</span>
                        <strong className="text-[#0E1030]">{event.categories.length}</strong>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-[#5B5F85]">Registered Nominees</span>
                        <strong className="text-[#0E1030]">{event.entries.length}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#0E1030] text-white rounded-3xl p-6 space-y-3 shadow-lg">
                    <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-[#F2A900]">
                      <ShieldCheck className="w-4 h-4" /> Audited Voting Ledger
                    </div>
                    <h4 className="font-heading font-bold text-base text-white">
                      Every Vote is Verified &amp; Receipted
                    </h4>
                    <p className="text-xs text-white/80 leading-relaxed">
                      Every transaction generates a unique <code className="font-mono text-[#F2A900]">TV-...</code> reference that can be verified anytime on the public receipt verifier.
                    </p>
                    <Link
                      href="/verify"
                      className="inline-block text-xs font-bold text-[#F2A900] hover:underline pt-1"
                    >
                      Verify a Vote Receipt →
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        )}

        {activeTab === "gallery" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-6">
            <div className="bg-white rounded-2xl p-4 border border-[#D9DBEA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-heading font-bold text-lg text-[#0E1030]">
                  {event.name} — Photo Gallery
                </h2>
                <p className="text-xs text-[#5B5F85]">
                  Official event highlights and contestant portraits. Click any photo to view full screen.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: "all", label: `All Photos (${event.galleryPhotos.length})` },
                    {
                      id: "event",
                      label: `Event Photos (${event.galleryPhotos.filter((g) => g.source === "event").length})`,
                    },
                    {
                      id: "contestant",
                      label: `Contestants (${event.galleryPhotos.filter((g) => g.source === "contestant").length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setGalleryFilter(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      galleryFilter === tab.id
                        ? "bg-[#4B35E0] text-white"
                        : "bg-[#F6F7FC] text-[#5B5F85] hover:text-[#0E1030]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredGallery.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#D9DBEA] p-12 text-center text-sm text-[#5B5F85]">
                No photos uploaded in this gallery filter yet.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGallery.map((photo, idx) => (
                  <Reveal key={photo.id} delayMs={Math.min(idx, 6) * 50}>
                    <div
                      onClick={() => setLightboxPhoto(photo)}
                      className="group relative rounded-3xl overflow-hidden bg-[#0E1030] border border-[#D9DBEA] shadow-sm hover:shadow-xl transition-all cursor-pointer aspect-[4/5]"
                    >
                      <img
                        src={photo.imageUrl}
                        alt={photo.caption}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0E1030] via-[#0E1030]/35 to-transparent" />
                      <span
                        className={`absolute top-3.5 left-3.5 text-[11px] font-bold uppercase px-2.5 py-1 rounded-full ${
                          photo.source === "event"
                            ? "bg-[#4B35E0] text-white"
                            : "bg-[#F2A900] text-[#0E1030]"
                        }`}
                      >
                        {photo.source === "event" ? "Event Photo" : `Nominee · ${photo.contestantCode}`}
                      </span>
                      <div className="absolute bottom-4 left-4 right-4">
                        {photo.categoryName ? (
                          <span className="text-xs font-semibold text-white/90 block mb-0.5">
                            {photo.categoryName}
                          </span>
                        ) : null}
                        <p
                          style={{ color: "#FFFFFF" }}
                          className="font-heading font-extrabold text-lg text-white leading-tight drop-shadow-md"
                        >
                          {photo.caption}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {lightboxPhoto ? (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-[#0E1030] rounded-3xl overflow-hidden border border-white/20 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              aria-label="Close photo"
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxPhoto.imageUrl}
              alt={lightboxPhoto.caption}
              className="w-full max-h-[75vh] object-contain bg-black"
            />
            <div className="p-4 flex items-center justify-between gap-4 text-white">
              <div>
                <span className="text-[11px] font-bold uppercase text-[#F2A900]">
                  {lightboxPhoto.source === "event" ? "Event Highlight" : `Contestant · ${lightboxPhoto.contestantCode}`}
                </span>
                <p className="font-heading font-bold text-base text-white">{lightboxPhoto.caption}</p>
              </div>
              {lightboxPhoto.contestantCode ? (
                <button
                  type="button"
                  onClick={() => {
                    const entry = event.entries.find((e) => e.code === lightboxPhoto.contestantCode);
                    setLightboxPhoto(null);
                    if (entry && event.votingOpen) {
                      setSelected(entry);
                    } else {
                      setActiveTab("contestants");
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-[#F2A900] text-[#0E1030] font-bold text-xs hover:bg-[#D99600] cursor-pointer shrink-0"
                >
                  {event.votingOpen ? "Vote This Contestant" : "View Contestant"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selected && drawerContestant && (
        <VotingDrawer
          contestant={drawerContestant}
          eventName={event.name}
          unitPriceGhs={selected.unitPriceMinor / 100}
          packages={event.categories.find((c) => c.id === selected.categoryId)?.packages}
          onClose={() => setSelected(null)}
          onSuccess={() => setSelected(null)}
        />
      )}

      {ticketDrawerOpen && event.ticketTiers && event.ticketTiers.length > 0 ? (
        <TicketCheckoutDrawer
          eventName={event.name}
          venue={event.venue}
          tiers={event.ticketTiers}
          onClose={() => setTicketDrawerOpen(false)}
        />
      ) : null}
    </div>
  );
}
