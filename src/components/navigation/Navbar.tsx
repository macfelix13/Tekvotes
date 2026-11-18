import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#D9DBEA] bg-white/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Logo />

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#5B5F85]">
          <Link href="/competitions" className="hover:text-[#4B35E0] transition-colors">
            Competitions
          </Link>
          <Link href="/how-it-works" className="hover:text-[#4B35E0] transition-colors">
            How It Works
          </Link>
          <Link href="/apply" className="hover:text-[#4B35E0] transition-colors">
            For Organisers
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-semibold px-4 py-2 rounded-xl text-[#0E1030] hover:bg-[#F6F7FC] transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/apply"
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#4B35E0] text-white hover:bg-[#3B28B8] shadow-sm transition-all"
          >
            Apply as Organiser
          </Link>
        </div>
      </div>
    </header>
  );
}
