import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { HomeSearch } from "@/components/search/HomeSearch";
import { LogoMarquee } from "@/components/home/LogoMarquee";
import { Reveal } from "@/components/ui/Reveal";
import { listPublicEvents, getPublicEvent, listPublicMarqueeItems } from "@/lib/public-events";
import { getPlatformCmsSettings } from "@/lib/cms";
import {
  ArrowRight,
  Search,
  Hash,
  Smartphone,
  Building2,
  CheckCircle2,
  MessageCircle,
  Trophy,
  ShieldCheck,
} from "lucide-react";

const formatType = (eventType: string) => {
  if (eventType === "beauty_pageant") return { label: "Pageant", color: "bg-[#4B35E0]" };
  if (eventType === "award_show") return { label: "Awards", color: "bg-[#0E1030]" };
  if (eventType === "talent_show" || eventType === "campus_contest") return { label: "Talent Show", color: "bg-[#C77700]" };
  return { label: "Competition", color: "bg-[#0F9D6B]" };
};

export default async function HomePage() {
  const liveEvents = await listPublicEvents();
  const [featuredDetail, marqueeItems, cms] = await Promise.all([
    (liveEvents.find((e) => e.votingOpen) ?? liveEvents[0])
      ? getPublicEvent((liveEvents.find((e) => e.votingOpen) ?? liveEvents[0])!.slug)
      : Promise.resolve(null),
    listPublicMarqueeItems(liveEvents),
    getPlatformCmsSettings(),
  ]);
  const featuredTop = (featuredDetail?.entries ?? []).slice(0, 2);

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      {cms.announcementEnabled && cms.announcementText ? (
        <div className="bg-[#F2A900] text-[#0E1030] px-4 py-2 text-center text-xs font-bold">
          {cms.announcementLink ? (
            <Link href={cms.announcementLink} className="hover:underline inline-flex items-center gap-1.5">
              <span>{cms.announcementText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <span>{cms.announcementText}</span>
          )}
        </div>
      ) : null}
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-b from-[#0E1030] to-[#1A1D47] text-white pt-16 pb-24 lg:pt-20 lg:pb-32 overflow-hidden">
          {/* Subtle background circles */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 rounded-full border-2 border-white" />
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-white" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left animate-hero-in">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-white">
                  {cms.heroTitle} <span className="text-[#F2A900]">{cms.heroHighlight}</span>
                </h1>

                <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                  {cms.heroSubtitle}
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                  <Link
                    href="/competitions"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-[#4B35E0] text-white font-semibold text-base hover:bg-[#3B28B8] shadow-lg shadow-[#4B35E0]/30 transition-all"
                  >
                    {cms.heroPrimaryCta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/apply"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-white/20 bg-white/5 text-white font-semibold text-base hover:bg-white/10 transition-all backdrop-blur-xs"
                  >
                    {cms.heroSecondaryCta}
                  </Link>
                </div>
              </div>

              {/* Right Hero Visual + Live Event Preview */}
              <div className="lg:col-span-5 relative space-y-4 animate-hero-in" style={{ animationDelay: "120ms" }}>
                <div className="relative mx-auto max-w-md rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-[#1A1D47]">
                  <img
                    src={cms.heroImageUrl || "/images/hero-voter.jpg"}
                    alt="Excited TekVotes supporter voting on mobile"
                    className="w-full h-56 sm:h-64 object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0E1030]/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white">
                    <span className="font-semibold">Instant MoMo &amp; Card Voting</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F2A900] text-[#0E1030] font-bold">
                      Verified Live
                    </span>
                  </div>
                </div>

                <div className="relative mx-auto max-w-md rounded-2xl bg-white text-[#0E1030] p-6 shadow-2xl border border-white/20">
                  <div className="flex items-center justify-between pb-4 border-b border-[#D9DBEA]">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">Live Competition</span>
                      <h3 className="font-heading font-extrabold text-lg text-[#0E1030]">
                        {featuredDetail?.name ?? "No Active Event Yet"}
                      </h3>
                    </div>
                    {featuredDetail?.votingOpen ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E6F8F0] text-[#0F9D6B]">
                        <span className="w-2 h-2 rounded-full bg-[#0F9D6B] animate-pulse" />
                        Voting Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FDF3D6] text-[#C77700]">
                        Coming Soon
                      </span>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    {featuredTop.length > 0 ? (
                      featuredTop.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA]/70"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-xs ${
                                idx === 0 ? "bg-[#4B35E0]" : "bg-[#0E1030]"
                              }`}
                            >
                              {String(idx + 1).padStart(2, "0")}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-[#0E1030]">{entry.name}</p>
                              <p className="text-xs text-[#5B5F85]">
                                Code: <span className="font-mono font-bold text-[#4B35E0]">{entry.code}</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-heading font-extrabold text-[#4B35E0] text-base">
                              {entry.votes == null ? "—" : entry.votes.toLocaleString()}
                            </span>
                            <p className="text-[11px] text-[#5B5F85]">votes</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[#5B5F85] py-4 text-center">
                        Published competitions will appear here automatically.
                      </p>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#D9DBEA] flex items-center justify-between text-xs text-[#5B5F85]">
                    <span className="flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-4 h-4 text-[#0F9D6B]" /> Bank-grade Audit Ledger
                    </span>
                    <Link
                      href={featuredDetail ? `/competitions/${featuredDetail.slug}` : "/competitions"}
                      className="font-semibold text-[#4B35E0] hover:underline"
                    >
                      View all contestants →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Search Bar Overlay */}
        <HomeSearch />

        {/* Events, Sponsors & Partners Marquee */}
        {cms.marqueeEnabled ? (
          <LogoMarquee
            items={marqueeItems}
            heading={cms.marqueeHeading}
            subheading={cms.marqueeSubheading}
          />
        ) : null}

        {/* Voting Process: How to Vote for a Contestant (Screenshots 3 reference) */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">Voting Process</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0E1030] mt-1.5">
                How to Vote for a Contestant
              </h2>
              <p className="text-base text-[#5B5F85] mt-2">
                Voting takes less than 30 seconds with zero registration required for voters.
              </p>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 01 */}
              <Reveal delayMs={0}>
                <div className="relative p-8 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] hover:border-[#4B35E0]/40 transition-all hover:shadow-lg group h-full">
                <span className="absolute top-6 right-6 font-heading font-black text-4xl text-[#D9DBEA] group-hover:text-[#4B35E0]/20 transition-colors">
                  01
                </span>
                <div className="w-14 h-14 rounded-2xl bg-[#4B35E0] text-white flex items-center justify-center mb-6 shadow-md shadow-[#4B35E0]/20">
                  <Search className="w-7 h-7" />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#0E1030] mb-2.5">
                  Find your contestant
                </h3>
                <p className="text-sm text-[#5B5F85] leading-relaxed">
                  Search for your contestant using their short code (e.g. <span className="font-mono font-semibold text-[#0E1030]">AS01</span>) or name, or browse directly through the competition categories.
                </p>
                </div>
              </Reveal>

              {/* Step 02 */}
              <Reveal delayMs={90}>
                <div className="relative p-8 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] hover:border-[#4B35E0]/40 transition-all hover:shadow-lg group h-full">
                <span className="absolute top-6 right-6 font-heading font-black text-4xl text-[#D9DBEA] group-hover:text-[#4B35E0]/20 transition-colors">
                  02
                </span>
                <div className="w-14 h-14 rounded-2xl bg-[#0E1030] text-white flex items-center justify-center mb-6 shadow-md shadow-[#0E1030]/20">
                  <Hash className="w-7 h-7" />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#0E1030] mb-2.5">
                  Enter number of votes
                </h3>
                <p className="text-sm text-[#5B5F85] leading-relaxed">
                  Your vote counts. Select convenient bundles or enter any custom whole-vote amount you like to boost your favourite contestant.
                </p>
                </div>
              </Reveal>

              {/* Step 03 */}
              <Reveal delayMs={180}>
                <div className="relative p-8 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] hover:border-[#4B35E0]/40 transition-all hover:shadow-lg group h-full">
                <span className="absolute top-6 right-6 font-heading font-black text-4xl text-[#D9DBEA] group-hover:text-[#4B35E0]/20 transition-colors">
                  03
                </span>
                <div className="w-14 h-14 rounded-2xl bg-[#F2A900] text-[#0E1030] flex items-center justify-center mb-6 shadow-md shadow-[#F2A900]/20">
                  <Smartphone className="w-7 h-7" />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#0E1030] mb-2.5">
                  Follow the prompts
                </h3>
                <p className="text-sm text-[#5B5F85] leading-relaxed">
                  Choose your preferred payment option (MTN Mobile Money, Telecel Cash, AT Money, or Card) and approve the payment prompt on your phone.
                </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Active and Ongoing Voting (Screenshots 4 reference) */}
        <section className="py-20 bg-[#F6F7FC] border-t border-[#D9DBEA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">Events</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0E1030] mt-1">
                  Active and Ongoing Voting
                </h2>
                <p className="text-sm text-[#5B5F85] mt-1.5">
                  Discover verified competitions currently accepting live public votes across Ghana.
                </p>
              </div>

              <Link
                href="/competitions"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] transition-all self-start sm:self-auto shadow-sm"
              >
                Browse All
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Reveal>

            {/* Events Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {liveEvents.slice(0, 4).map((event, idx) => {
                const badge = formatType(event.eventType);
                return (
                  <Reveal key={event.id} delayMs={idx * 70}>
                    <div className="bg-white rounded-2xl overflow-hidden border border-[#D9DBEA] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group h-full">
                    {/* Poster Header */}
                    <div className="relative aspect-[4/3] w-full bg-[#0E1030] overflow-hidden flex items-end p-4">
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
                      <span className="relative z-10 font-heading font-extrabold text-white/95 text-xl leading-tight line-clamp-2">
                        {event.name}
                      </span>
                      <span
                        className={`relative z-10 absolute top-3 left-3 text-[11px] font-bold text-white px-2.5 py-1 rounded-full ${badge.color} shadow-xs`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h3 className="font-heading font-bold text-base text-[#0E1030] line-clamp-2 leading-snug group-hover:text-[#4B35E0] transition-colors">
                          {event.name}
                        </h3>

                        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[#5B5F85]">
                          <Building2 className="w-3.5 h-3.5 text-[#5B5F85]" />
                          <span className="truncate">{event.organizerName}</span>
                        </div>
                      </div>

                      <Link
                        href={`/competitions/${event.slug}`}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] transition-all shadow-xs"
                      >
                        {event.votingOpen ? "Vote Now" : "View Event"}
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Organiser Callout & "About TekVotes" (Screenshots 1 & 2 reference) */}
        <section id="about" className="py-20 bg-white border-t border-[#D9DBEA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="grid lg:grid-cols-12 gap-12 items-center">
              {/* Left Column: Organiser Headline & Actions */}
              <div className="lg:col-span-7 space-y-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8E5FD] text-[#4B35E0] text-xs font-semibold uppercase tracking-wider">
                  <Trophy className="w-4 h-4 text-[#4B35E0]" />
                  For Event Organisers & Creators
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0E1030] leading-[1.2]">
                  {cms.organiserHeading}
                </h2>

                <p className="text-base sm:text-lg text-[#5B5F85] leading-relaxed">
                  {cms.organiserDescription}
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href="/apply"
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-[#4B35E0] text-white font-semibold text-base hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 transition-all"
                  >
                    Join Now!!
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0E1030] text-white font-semibold text-base hover:bg-[#1A1D47] shadow-md transition-all"
                  >
                    <MessageCircle className="w-5 h-5 text-[#F2A900]" />
                    <span>Contact Support</span>
                  </Link>
                </div>
              </div>

              {/* Right Column: "About TekVotes" Card (Screenshot 1 & 2 reference) */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl bg-gradient-to-br from-[#4B35E0] to-[#2B1B9A] text-white p-8 sm:p-10 shadow-2xl relative overflow-hidden">
                  <div className="relative z-10 space-y-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-white/80">
                      About TekVotes
                    </span>

                    <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                      {cms.aboutHeading}
                    </h3>

                    <p className="text-sm sm:text-base text-white/90 leading-relaxed">
                      {cms.aboutDescription}
                    </p>

                    <div className="pt-4 border-t border-white/20 space-y-3 text-xs sm:text-sm text-white/80">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#F2A900]" />
                        <span>Centralized Ghanaian Mobile Money settlements</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#F2A900]" />
                        <span>Instant automated SMS and digital vote receipts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#F2A900]" />
                        <span>Hybrid public vote & judge adjudication engine</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0E1030] text-white py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1 space-y-3">
              <span className="font-heading font-extrabold text-2xl text-white">TekVotes</span>
              <p className="text-xs text-[#5B5F85] leading-relaxed">
                {cms.footerTagline}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Voters</h4>
              <ul className="space-y-2 text-xs text-white/80">
                <li><Link href="/competitions" className="hover:text-white">Active Competitions</Link></li>
                <li><Link href="/#how-it-works" className="hover:text-white">How to Vote</Link></li>
                <li><Link href="/verify" className="hover:text-white">Verify Receipt</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Organisers</h4>
              <ul className="space-y-2 text-xs text-white/80">
                <li><Link href="/apply" className="hover:text-white">Apply as Organiser</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Fee Structure</Link></li>
                <li><Link href="/auth/login" className="hover:text-white">Organiser Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/60 mb-3">Support</h4>
              <ul className="space-y-2 text-xs text-white/80">
                <li><Link href="/contact" className="hover:text-white">Support Desk</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Commission Rules</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms &amp; Privacy</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5B5F85]">
            <p>{cms.footerCopyright}</p>
            <p>Developed by <a href="https://frametekgh.com">FrameTek Ghana</a>.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
