import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { Reveal } from "@/components/ui/Reveal";
import { ArrowRight } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <Reveal className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
              Transparent Economics (OD-01 / OD-02 / OD-07)
            </span>
            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#0E1030]">
              Zero Upfront Cost for Event Organisers
            </h1>
            <p className="text-sm sm:text-base text-[#5B5F85]">
              Create unlimited categories, contestants, and judging panels for free. TekVotes only earns a standard percentage commission on base votes collected.
            </p>
          </Reveal>

          <Reveal delayMs={90}>
            <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-[#D9DBEA] shadow-sm space-y-4">
              <span className="text-xs font-bold uppercase text-[#4B35E0]">1 · Event Setup</span>
              <div className="font-heading font-extrabold text-3xl text-[#0E1030]">GHS 0.00</div>
              <p className="text-xs text-[#5B5F85] leading-relaxed">
                Free organization registration, unlimited contestant short codes, custom vote pricing, and live leaderboards.
              </p>
            </div>

            <div className="bg-[#0E1030] text-white rounded-3xl p-6 shadow-xl space-y-4">
              <span className="text-xs font-bold uppercase text-[#F2A900]">2 · Platform Commission</span>
              <div className="font-heading font-extrabold text-3xl text-white">10-35% on Base Votes</div>
              <p className="text-xs text-white/80 leading-relaxed">
                Calculated strictly on the base vote value (<code className="font-mono text-[#F2A900]">snapshot_base_amount_minor</code>). Network processing fee surcharges are transparently passed to the voter at checkout.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-[#D9DBEA] shadow-sm space-y-4">
              <span className="text-xs font-bold uppercase text-[#0F9D6B]">3 · Post-Event Payout</span>
              <div className="font-heading font-extrabold text-3xl text-[#0E1030]">100% Audited</div>
              <p className="text-xs text-[#5B5F85] leading-relaxed">
                All voting funds are held securely by the Super Admin treasury with live per-event (<code className="font-mono">v_event_funds</code>) and per-org (<code className="font-mono">v_org_funds</code>) tracking, transferred after voting closes.
              </p>
            </div>
          </div>
          </Reveal>

          <div className="text-center pt-4">
            <Link
              href="/apply"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-lg shadow-[#4B35E0]/20"
            >
              Apply as an Organiser Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
