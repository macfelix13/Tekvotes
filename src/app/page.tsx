import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Smartphone, Award, Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E8E5FD] text-[#4B35E0] text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 fill-[#4B35E0]" />
                  Multi-Tenant E-Voting Platform for Ghana
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0E1030] leading-[1.1]">
                  Empowering <span className="text-[#4B35E0]">Competitions,</span> Pageants & Award Shows
                </h1>

                <p className="text-lg sm:text-xl text-[#5B5F85] max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  TekVotes provides independent organizations and event creators with bank-grade voting engines, instant Mobile Money checkout, and transparent leaderboards.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                  <Link
                    href="/competitions"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#4B35E0] text-white font-semibold text-base hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 transition-all"
                  >
                    Explore Competitions
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href="/apply"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-[#D9DBEA] bg-white text-[#0E1030] font-semibold text-base hover:bg-[#F6F7FC] transition-all"
                  >
                    Apply to Host an Event
                  </Link>
                </div>

                <div className="pt-6 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs font-medium text-[#5B5F85]">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0F9D6B]" /> MTN MoMo, Telecel & AT Cash
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0F9D6B]" /> Free Event Creation
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0F9D6B]" /> Tamper-Proof Audit Ledger
                  </span>
                </div>
              </div>

              {/* Visual Card / Highlights */}
              <div className="lg:col-span-5 relative">
                <div className="relative mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#D9DBEA]">
                  <div className="flex items-center justify-between pb-4 border-b border-[#D9DBEA]">
                    <div>
                      <span className="text-xs font-semibold uppercase text-[#5B5F85]">Featured Pageant</span>
                      <h3 className="font-heading font-bold text-lg text-[#0E1030]">Miss Campus Ghana 2026</h3>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FDF3D6] text-[#C77700]">
                      <Trophy className="w-3.5 h-3.5 text-[#F2A900] fill-[#F2A900]" /> Live
                    </span>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA]/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#4B35E0] text-white flex items-center justify-center font-bold text-sm">
                          01
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#0E1030]">Naa Mensah</p>
                          <p className="text-xs text-[#5B5F85]">University of Ghana</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-heading font-bold text-[#4B35E0]">4,820</span>
                        <p className="text-[11px] text-[#5B5F85]">votes</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA]/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#5B5F85] text-white flex items-center justify-center font-bold text-sm">
                          02
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#0E1030]">Akosua Appiah</p>
                          <p className="text-xs text-[#5B5F85]">KNUST</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-heading font-bold text-[#0E1030]">3,910</span>
                        <p className="text-[11px] text-[#5B5F85]">votes</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#D9DBEA] flex items-center justify-between text-xs text-[#5B5F85]">
                    <span>Official verified counts</span>
                    <span className="font-semibold text-[#0F9D6B] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Server Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Step Process (Voter UX Reference) */}
        <section className="py-16 bg-white border-y border-[#D9DBEA]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">How Voting Works</span>
              <h2 className="text-3xl font-extrabold text-[#0E1030] mt-1">Simple, Secure & Transparent</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#4B35E0] text-white flex items-center justify-center font-heading font-bold text-lg mx-auto shadow-sm">
                  1
                </div>
                <h3 className="font-heading font-bold text-lg text-[#0E1030]">Find Your Contestant</h3>
                <p className="text-sm text-[#5B5F85]">
                  Search by contestant code, name, or scan their unique QR code directly on flyers and social media.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#0E1030] text-white flex items-center justify-center font-heading font-bold text-lg mx-auto shadow-sm">
                  2
                </div>
                <h3 className="font-heading font-bold text-lg text-[#0E1030]">Choose Vote Quantity</h3>
                <p className="text-sm text-[#5B5F85]">
                  Select a fixed vote bundle or enter any custom whole-vote amount in Ghana Cedis (GHS).
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#F2A900] text-[#0E1030] flex items-center justify-center font-heading font-bold text-lg mx-auto shadow-sm">
                  3
                </div>
                <h3 className="font-heading font-bold text-lg text-[#0E1030]">Approve on Your Phone</h3>
                <p className="text-sm text-[#5B5F85]">
                  Receive an instant Mobile Money prompt on your phone. Votes credit in real-time with digital receipt.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0E1030] text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-lg text-white">TekVotes</span>
            <span className="text-xs text-[#5B5F85]">© 2026 All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-white/70">
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/apply" className="hover:text-[#F2A900]">Organiser Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
