"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { VotingDrawer } from "@/components/voting/VotingDrawer";
import type { ContestantTrackerDetail } from "@/lib/public-events";
import {
  ArrowLeft,
  Flame,
  Lock,
  Share2,
  Check,
  Trophy,
  BarChart3,
  Building2,
  ExternalLink,
  User,
} from "lucide-react";

export function ContestantTrackerClient({ tracker }: { tracker: ContestantTrackerDetail }) {
  const [votingOpen, setVotingOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { event, category, contestant } = tracker;
  const sharePct =
    contestant.votes != null && contestant.totalCategoryVotes && contestant.totalCategoryVotes > 0
      ? ((contestant.votes / contestant.totalCategoryVotes) * 100).toFixed(1)
      : "0.0";

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/competitions/${event.slug}/contestants/${encodeURIComponent(
      contestant.code
    )}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Vote for ${contestant.name} (${contestant.code})`,
          text: `Support ${contestant.name} in ${event.name}!`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/competitions/${event.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4B35E0] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {event.name}
            </Link>
            <button
              type="button"
              onClick={() => void handleCopyLink()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#D9DBEA] text-xs font-bold text-[#0E1030] hover:border-[#4B35E0] cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#0F9D6B]" /> : <Share2 className="w-3.5 h-3.5 text-[#4B35E0]" />}
              <span>{copied ? "Tracker Link Copied!" : "Share Nominee Page"}</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-[#D9DBEA] shadow-lg overflow-hidden grid md:grid-cols-12 animate-hero-in">
            <div className="md:col-span-5 bg-[#0E1030] relative aspect-[3/4] md:aspect-auto min-h-[280px]">
              {contestant.photoUrl ? (
                <img
                  src={contestant.photoUrl}
                  alt={contestant.name}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/70">
                  <User className="w-16 h-16" />
                </div>
              )}
              <span className="absolute top-4 left-4 font-mono font-bold text-xs bg-[#0E1030]/85 text-white px-3 py-1.5 rounded-lg border border-white/20">
                Code: {contestant.code}
              </span>
            </div>

            <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
                    {category.name}
                  </span>
                  <span className="text-xs text-[#5B5F85] inline-flex items-center gap-1">
                    · <Building2 className="w-3.5 h-3.5" /> {event.organizerName}
                  </span>
                </div>

                <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0E1030]">
                  {contestant.name}
                </h1>

                {contestant.bio ? (
                  <p className="text-sm text-[#5B5F85] leading-relaxed">{contestant.bio}</p>
                ) : null}

                {contestant.socials.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {contestant.socials.map((s) => (
                      <a
                        key={s.platform}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F6F7FC] border border-[#D9DBEA] text-xs font-semibold text-[#0E1030] hover:border-[#4B35E0] capitalize"
                      >
                        {s.platform} <ExternalLink className="w-3 h-3 text-[#5B5F85]" />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Nominee / Contestant Vote Tracker Card */}
              <div className="p-5 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0] flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4" /> Contestant Vote Tracker
                  </span>
                  <span className="text-xs font-semibold text-[#5B5F85]">
                    GHS {(category.unitPriceMinor / 100).toFixed(2)} / vote
                  </span>
                </div>

                {category.contestantResultsVisible ? (
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-xl border border-[#D9DBEA]">
                      <span className="text-[11px] text-[#5B5F85] block">Total Votes</span>
                      <span className="font-heading font-extrabold text-xl text-[#4B35E0]">
                        {(contestant.votes ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#D9DBEA]">
                      <span className="text-[11px] text-[#5B5F85] block">Current Rank</span>
                      <span className="font-heading font-extrabold text-xl text-[#0E1030] inline-flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-[#F2A900]" />
                        {contestant.rank ? `#${contestant.rank}` : "—"}
                        <span className="text-xs font-normal text-[#5B5F85]">
                          /{contestant.totalContestantsInCategory}
                        </span>
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-[#D9DBEA]">
                      <span className="text-[11px] text-[#5B5F85] block">Category Share</span>
                      <span className="font-heading font-extrabold text-xl text-[#0F9D6B]">
                        {sharePct}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-white border border-[#D9DBEA] flex items-center gap-2.5 text-xs text-[#5B5F85]">
                    <Lock className="w-4 h-4 text-[#C77700] shrink-0" />
                    <span>
                      Live vote counts and rankings are currently hidden for nominees by the event organizer.
                    </span>
                  </div>
                )}
              </div>

              {event.votingOpen ? (
                <button
                  type="button"
                  onClick={() => setVotingOpen(true)}
                  className="w-full py-3.5 rounded-xl bg-[#4B35E0] text-white font-bold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Flame className="w-4 h-4 fill-[#F2A900] text-[#F2A900]" />
                  <span>Vote for {contestant.name}</span>
                </button>
              ) : (
                <div className="w-full py-3.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-[#5B5F85] font-semibold text-sm inline-flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Voting is currently {event.votingStatus === "closed" ? "closed" : "not open yet"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {votingOpen && (
        <VotingDrawer
          contestant={{
            id: contestant.id,
            name: contestant.name,
            code: contestant.code,
            photo: contestant.photoUrl,
            categoryName: category.name,
            votes: contestant.votes ?? 0,
          }}
          eventName={event.name}
          unitPriceGhs={category.unitPriceMinor / 100}
          packages={category.packages}
          onClose={() => setVotingOpen(false)}
          onSuccess={() => setVotingOpen(false)}
        />
      )}
    </div>
  );
}
