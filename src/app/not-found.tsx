import Link from "next/link";
import { Navbar } from "@/components/navigation/Navbar";
import { Search, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#D9DBEA] p-8 text-center space-y-4 shadow-sm">
          <span className="inline-block font-mono text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#E8E5FD] text-[#4B35E0]">
            404 · Page Not Found
          </span>
          <h1 className="font-heading font-extrabold text-2xl text-[#0E1030]">
            We could not find that page
          </h1>
          <p className="text-sm text-[#5B5F85]">
            The competition or link you are looking for may have moved or is no longer available.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8]"
            >
              <Home className="w-3.5 h-3.5" /> Home
            </Link>
            <Link
              href="/competitions"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#0E1030] hover:bg-[#F6F7FC]"
            >
              <Search className="w-3.5 h-3.5" /> Browse Events
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
