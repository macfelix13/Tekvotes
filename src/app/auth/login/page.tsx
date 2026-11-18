"use client";

import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { ShieldCheck, Building2, ArrowRight, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-[#D9DBEA] shadow-xl space-y-6">
            <div className="text-center space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
                TekVotes Workspace Access
              </span>
              <h1 className="font-heading font-extrabold text-2xl text-[#0E1030]">
                Sign in to your account
              </h1>
              <p className="text-xs text-[#5B5F85]">
                Organisers, Judges, and Platform Administrators
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = "/org";
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    defaultValue="frametek93@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                  />
                  <Mail className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    defaultValue="••••••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                  />
                  <Lock className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3" />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 cursor-pointer"
              >
                Sign In
              </button>
            </form>

            {/* Quick Live Preview Switcher */}
            <div className="pt-5 border-t border-[#D9DBEA] space-y-3">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#5B5F85] text-center">
                Quick Live Preview Consoles
              </span>

              <div className="grid grid-cols-1 gap-2.5">
                <Link
                  href="/org"
                  className="flex items-center justify-between p-3 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E5FD]/50 border border-[#D9DBEA] text-xs font-bold text-[#0E1030] transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#4B35E0]" />
                    Organiser Dashboard (Model Tv)
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#4B35E0]" />
                </Link>

                <Link
                  href="/admin"
                  className="flex items-center justify-between p-3 rounded-xl bg-[#0E1030] hover:bg-[#1A1D47] text-xs font-bold text-white transition-all"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#F2A900]" />
                    Super Admin Console (frametek93@gmail.com)
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#F2A900]" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
