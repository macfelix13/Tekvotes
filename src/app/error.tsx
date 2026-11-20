"use client";

import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#D9DBEA] p-8 text-center space-y-4 shadow-sm">
          <AlertTriangle className="w-10 h-10 text-[#D13A3A] mx-auto" />
          <h1 className="font-heading font-extrabold text-2xl text-[#0E1030]">
            Something went wrong
          </h1>
          <p className="text-sm text-[#5B5F85]">
            An unexpected error occurred while loading this page. No payments or votes were lost.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Try Again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#0E1030] hover:bg-[#F6F7FC]"
            >
              <Home className="w-3.5 h-3.5" /> Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
