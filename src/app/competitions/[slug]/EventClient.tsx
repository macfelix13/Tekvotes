"use client";

import { useState } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import { VotingDrawer, Contestant } from "@/components/voting/VotingDrawer";
import {
  Building2,
  Calendar,
  Trophy,
  Search,
  Flame,
  BarChart3,
  Users,
  Lock,
} from "lucide-react";

interface EventClientProps {
  slug: string;
}

interface EventConfig {
  title: string;
  organizer: string;
  category: string;
  closesAt: string;
  unitPriceGhs: number;
  votingOpen: boolean;
  banner: string;
  description: string;
  contestants: Contestant[];
}

const EVENT_CATALOG: Record<string, EventConfig> = {
  "miss-hijab-ghana-2026": {
    title: "Miss Hijab Ghana 3RD EDITION",
    organizer: "Model Tv Ghana",
    category: "Pageant & Awards",
    closesAt: "Dec 21, 2026",
    unitPriceGhs: 1.0,
    votingOpen: true,
    banner: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&w=1200&q=80",
    description:
      "Celebrating beauty, intellect, and Islamic moral values. Public voting accounts for 50% of the overall final score, alongside our esteemed panel of grand jury adjudicators.",
    contestants: [
      { id: "c-1", name: "Fatima Abubakar", code: "FA01", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80", categoryName: "Queen Category", votes: 6840 },
      { id: "c-2", name: "Mariam Zakaria", code: "MZ04", photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80", categoryName: "Queen Category", votes: 5910 },
      { id: "c-3", name: "Amina Sulemana", code: "AS07", photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80", categoryName: "Queen Category", votes: 4320 },
      { id: "c-4", name: "Zeinab Haruna", code: "ZH02", photo: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80", categoryName: "Queen Category", votes: 3890 },
      { id: "c-5", name: "Rukaya Mohammed", code: "RM09", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80", categoryName: "Queen Category", votes: 3100 },
      { id: "c-6", name: "Hafsa Issah", code: "HI12", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80", categoryName: "Queen Category", votes: 2750 },
    ],
  },
  "mempeasem-circuit-awards-2026": {
    title: "MEMPEASEM CIRCUIT MYF DINNER AND AWARDS 2026",
    organizer: "Mempeasem Circuit MYF",
    category: "Awards",
    closesAt: "Dec 21, 2026",
    unitPriceGhs: 1.0,
    votingOpen: true,
    banner: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
    description:
      "Annual youth fellowship dinner and excellence awards night honoring outstanding youth leaders, choir vocalists, and community trailblazers.",
    contestants: [
      { id: "m-1", name: "Emmanuel Ofori", code: "MYF01", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80", categoryName: "Youth Leader of the Year", votes: 4210 },
      { id: "m-2", name: "Grace Asante", code: "MYF02", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80", categoryName: "Youth Leader of the Year", votes: 3980 },
      { id: "m-3", name: "Daniel Mensah", code: "MYF03", photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80", categoryName: "Best Vocalist", votes: 2650 },
      { id: "m-4", name: "Priscilla Owusu", code: "MYF04", photo: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80", categoryName: "Best Vocalist", votes: 2110 },
    ],
  },
  "kids-talent-show-2026": {
    title: "KID'S TALENT SHOW 5th Edition 2026",
    organizer: "Kids Talent Show Network",
    category: "Talent Show",
    closesAt: "Jan 15, 2027",
    unitPriceGhs: 2.0,
    votingOpen: true,
    banner: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
    description:
      "Showcasing Ghana's brightest young performers in dance, spoken word, live instrumentation, and acrobatics.",
    contestants: [
      { id: "k-1", name: "Kwesi Junior (The Drummer)", code: "KTS01", photo: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", categoryName: "Grand Talent", votes: 11400 },
      { id: "k-2", name: "Nana Ama Spoken Word", code: "KTS02", photo: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80", categoryName: "Grand Talent", votes: 9850 },
      { id: "k-3", name: " Golden Stars Dance Crew", code: "KTS03", photo: "https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=600&q=80", categoryName: "Grand Talent", votes: 7620 },
      { id: "k-4", name: "Little Maestro Kojo", code: "KTS04", photo: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80", categoryName: "Grand Talent", votes: 5240 },
    ],
  },
  "miss-campus-ghana-2026": {
    title: "MISS CAMPUS GHANA 2026 FINALS",
    organizer: "Campus Media Group",
    category: "Pageant",
    closesAt: "Dec 30, 2026",
    unitPriceGhs: 1.5,
    votingOpen: true,
    banner: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80",
    description:
      "Empowering female university leaders across Ghana's public and private tertiary institutions.",
    contestants: [
      { id: "mc-1", name: "Naa Mensah (UG Legon)", code: "MCG01", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80", categoryName: "Campus Queen", votes: 9420 },
      { id: "mc-2", name: "Akosua Appiah (KNUST)", code: "MCG02", photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80", categoryName: "Campus Queen", votes: 8710 },
      { id: "mc-3", name: "Esi Baidoo (UCC)", code: "MCG03", photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80", categoryName: "Campus Queen", votes: 6150 },
      { id: "mc-4", name: "Adwoa Serwaa (UPSA)", code: "MCG04", photo: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=600&q=80", categoryName: "Campus Queen", votes: 5200 },
    ],
  },
  "ghana-gospel-industry-awards": {
    title: "Ghana National Gospel Music Honors 2026",
    organizer: "Gospel Music Guild",
    category: "Awards",
    closesAt: "Starts Dec 01, 2026",
    unitPriceGhs: 1.0,
    votingOpen: false,
    banner: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
    description:
      "Public Preview (Rule OD-14 / ND-07): Nominees are published for public discovery. Voting checkout unlocks automatically once Super Admin voting approval takes effect.",
    contestants: [
      { id: "gg-1", name: "Minister Joe Praize GH", code: "GGM01", photo: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80", categoryName: "Artiste of the Year", votes: 0 },
      { id: "gg-2", name: "Sister Empress Comfort", code: "GGM02", photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80", categoryName: "Artiste of the Year", votes: 0 },
    ],
  },
};

export function EventClient({ slug }: EventClientProps) {
  const initialConfig = EVENT_CATALOG[slug] || EVENT_CATALOG["miss-hijab-ghana-2026"];
  const [selectedContestant, setSelectedContestant] = useState<Contestant | null>(null);
  const [activeTab, setActiveTab] = useState<"contestants" | "leaderboard">("contestants");
  const [searchTerm, setSearchTerm] = useState("");
  const [contestants, setContestants] = useState<Contestant[]>(initialConfig.contestants);

  const filteredContestants = contestants.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalEventVotes = contestants.reduce((acc, curr) => acc + curr.votes, 0);

  const handleVoteSuccess = (_orderRef: string, voteCount: number) => {
    if (selectedContestant) {
      setContestants((prev) =>
        prev.map((c) => (c.id === selectedContestant.id ? { ...c, votes: c.votes + voteCount } : c))
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 pb-20">
        {/* Event Banner & Header */}
        <div className="relative bg-[#0E1030] text-white">
          <div className="absolute inset-0 opacity-25">
            <img src={initialConfig.banner} alt={initialConfig.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E1030] via-[#0E1030]/80 to-transparent" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative z-10">
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#4B35E0] text-white text-xs font-bold">
                  {initialConfig.category}
                </span>
                {initialConfig.votingOpen ? (
                  <span className="px-3 py-1 rounded-full bg-[#E6F8F0] text-[#0F9D6B] text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0F9D6B] animate-pulse" />
                    Voting Active
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-[#FDF3D6] text-[#C77700] text-xs font-bold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Coming Soon Preview (OD-14)
                  </span>
                )}
              </div>

              <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white leading-tight">
                {initialConfig.title}
              </h1>

              <p className="text-white/80 text-sm sm:text-base leading-relaxed">
                {initialConfig.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm text-white/70">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#F2A900]" /> {initialConfig.organizer}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#F2A900]" /> {initialConfig.closesAt}
                </span>
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-[#F2A900]" /> GHS {initialConfig.unitPriceGhs.toFixed(2)} / vote
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Navigation & Search */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
          <div className="bg-white rounded-2xl p-4 border border-[#D9DBEA] shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveTab("contestants")}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "contestants"
                    ? "bg-[#4B35E0] text-white shadow-sm"
                    : "bg-[#F6F7FC] text-[#5B5F85] hover:text-[#0E1030]"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Contestants ({contestants.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("leaderboard")}
                className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "leaderboard"
                    ? "bg-[#4B35E0] text-white shadow-sm"
                    : "bg-[#F6F7FC] text-[#5B5F85] hover:text-[#0E1030]"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Live Leaderboard</span>
              </button>
            </div>

            {/* Contestant Search */}
            <div className="w-full sm:w-80 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contestant or short code..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
              />
              <Search className="w-4 h-4 text-[#5B5F85] absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Tab 1: Contestants Grid */}
        {activeTab === "contestants" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredContestants.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl overflow-hidden border border-[#D9DBEA] shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
                >
                  <div className="relative aspect-[3/4] w-full bg-[#0E1030] overflow-hidden">
                    <img
                      src={c.photo}
                      alt={c.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 font-mono font-bold text-xs bg-[#0E1030]/80 backdrop-blur-xs text-white px-2.5 py-1 rounded-md border border-white/20">
                      Code: {c.code}
                    </span>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <span className="text-[11px] font-semibold text-[#F2A900] block">
                        {c.categoryName}
                      </span>
                      <h3 className="font-heading font-bold text-base leading-tight">
                        {c.name}
                      </h3>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#5B5F85]">
                      <span>Current Standing</span>
                      <span className="font-heading font-extrabold text-[#4B35E0] text-sm">
                        {c.votes.toLocaleString()} votes
                      </span>
                    </div>

                    {initialConfig.votingOpen ? (
                      <button
                        type="button"
                        onClick={() => setSelectedContestant(c)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white font-semibold text-xs hover:bg-[#3B28B8] shadow-sm transition-all cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5 fill-[#F2A900] text-[#F2A900]" />
                        <span>Vote Now</span>
                      </button>
                    ) : (
                      <div className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-[#5B5F85] font-semibold text-xs">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Voting Locked (Coming Soon)</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Live Leaderboard (OD-11) */}
        {activeTab === "leaderboard" && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D9DBEA] shadow-lg space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#D9DBEA]">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
                    Official Standings
                  </span>
                  <h2 className="font-heading font-extrabold text-2xl text-[#0E1030] mt-0.5">
                    Live Leaderboard
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#5B5F85] block">Total Category Votes</span>
                  <span className="font-heading font-extrabold text-lg text-[#0E1030]">
                    {totalEventVotes.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {[...contestants]
                  .sort((a, b) => b.votes - a.votes)
                  .map((c, index) => {
                    const percent = totalEventVotes > 0 ? ((c.votes / totalEventVotes) * 100).toFixed(1) : "0";
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] hover:border-[#4B35E0]/40 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-heading font-bold text-sm ${
                              index === 0
                                ? "bg-[#F2A900] text-[#0E1030] shadow-sm"
                                : index === 1
                                ? "bg-[#D9DBEA] text-[#0E1030]"
                                : index === 2
                                ? "bg-[#E8E5FD] text-[#4B35E0]"
                                : "bg-white text-[#5B5F85] border border-[#D9DBEA]"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <img
                            src={c.photo}
                            alt={c.name}
                            className="w-12 h-12 rounded-xl object-cover border border-white shadow-xs"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#4B35E0]">
                                {c.code}
                              </span>
                              <p className="font-heading font-bold text-sm text-[#0E1030]">
                                {c.name}
                              </p>
                            </div>
                            <div className="w-32 sm:w-48 bg-[#D9DBEA] h-2 rounded-full overflow-hidden mt-1.5">
                              <div
                                className="bg-[#4B35E0] h-full rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-heading font-extrabold text-[#0E1030] text-base block">
                            {c.votes.toLocaleString()}
                          </span>
                          <span className="text-xs font-medium text-[#5B5F85]">{percent}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Voting Drawer Modal */}
      {selectedContestant && (
        <VotingDrawer
          contestant={selectedContestant}
          eventName={initialConfig.title}
          unitPriceGhs={initialConfig.unitPriceGhs}
          onClose={() => setSelectedContestant(null)}
          onSuccess={handleVoteSuccess}
        />
      )}
    </div>
  );
}
