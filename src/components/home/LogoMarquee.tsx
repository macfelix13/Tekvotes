import Link from "next/link";
import type { PublicMarqueeItem } from "@/lib/public-events";
import { Trophy, ShieldCheck, Sparkles, Award } from "lucide-react";

const PARTNER_STYLES: Record<
  string,
  { bg: string; text: string; abbr: string }
> = {
  "partner-paystack": { bg: "bg-[#00C3F7]/15 border-[#00C3F7]/30", text: "text-[#0099C4]", abbr: "PS" },
  "partner-mtn-momo": { bg: "bg-[#FFCC00]/25 border-[#FFCC00]/50", text: "text-[#0E1030]", abbr: "MTN" },
  "partner-telecel-cash": { bg: "bg-[#E60000]/12 border-[#E60000]/30", text: "text-[#E60000]", abbr: "TC" },
  "partner-at-money": { bg: "bg-[#0055A5]/15 border-[#0055A5]/30", text: "text-[#0055A5]", abbr: "AT" },
  "partner-visa-mastercard": { bg: "bg-[#1A1F71]/12 border-[#1A1F71]/30", text: "text-[#1A1F71]", abbr: "V/M" },
  "partner-frametek": { bg: "bg-[#4B35E0]/12 border-[#4B35E0]/30", text: "text-[#4B35E0]", abbr: "FT" },
};

function MarqueeCard({ item }: { item: PublicMarqueeItem }) {
  const partnerStyle = PARTNER_STYLES[item.id];
  const badgeStyle =
    item.badge === "Event"
      ? "bg-[#E8E5FD] text-[#4B35E0]"
      : item.badge === "Sponsor"
      ? "bg-[#FDF3D6] text-[#C77700]"
      : "bg-[#E6F8F0] text-[#0F9D6B]";

  const content = (
    <div className="flex items-center gap-3.5 px-5 py-3.5 rounded-2xl bg-white border border-[#D9DBEA] shadow-xs hover:border-[#4B35E0]/50 hover:shadow-md transition-all min-w-[250px] sm:min-w-[275px]">
      {item.logoUrl ? (
        <img
          src={item.logoUrl}
          alt={item.name}
          className="w-11 h-11 rounded-xl object-cover border border-[#D9DBEA] shrink-0 bg-[#0E1030]"
        />
      ) : partnerStyle ? (
        <div
          className={`w-11 h-11 rounded-xl border flex items-center justify-center font-heading font-extrabold text-xs shrink-0 ${partnerStyle.bg} ${partnerStyle.text}`}
        >
          {partnerStyle.abbr}
        </div>
      ) : (
        <div className="w-11 h-11 rounded-xl bg-[#0E1030] text-[#F2A900] flex items-center justify-center shrink-0">
          {item.badge === "Event" ? (
            <Trophy className="w-5 h-5" />
          ) : item.badge === "Sponsor" ? (
            <Award className="w-5 h-5" />
          ) : (
            <ShieldCheck className="w-5 h-5" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeStyle}`}>
            {item.badge}
          </span>
        </div>
        <p className="font-heading font-bold text-sm text-[#0E1030] truncate mt-1">{item.name}</p>
        <p className="text-[11px] text-[#5B5F85] truncate">{item.subtitle}</p>
      </div>
    </div>
  );

  if (item.href) {
    if (item.href.startsWith("http")) {
      return (
        <a href={item.href} target="_blank" rel="noopener noreferrer" className="block shrink-0">
          {content}
        </a>
      );
    }
    return (
      <Link href={item.href} className="block shrink-0">
        {content}
      </Link>
    );
  }

  return <div className="shrink-0">{content}</div>;
}

export function LogoMarquee({ items }: { items: PublicMarqueeItem[] }) {
  if (items.length === 0) return null;

  // Duplicate items twice so the -50% infinite loop is seamless on wide screens
  const baseTrack = items.length < 6 ? [...items, ...items] : items;
  const track = [...baseTrack, ...baseTrack];

  return (
    <section
      aria-label="Featured Events, Sponsors and Partners"
      className="py-12 bg-[#F6F7FC] border-y border-[#D9DBEA] overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Trusted Events, Official Sponsors &amp; Payment Partners</span>
        </div>
        <span className="text-xs text-[#5B5F85]">
          Powering verified digital competitions &amp; instant MoMo voting across Ghana
        </span>
      </div>

      <div className="relative">
        {/* Left & Right edge fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-24 bg-gradient-to-r from-[#F6F7FC] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-24 bg-gradient-to-l from-[#F6F7FC] to-transparent z-10" />

        <div className="animate-marquee gap-4 px-2">
          {track.map((item, idx) => (
            <MarqueeCard key={`${item.id}-${idx}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
