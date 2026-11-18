import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Search } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#D9DBEA] bg-white/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Logo />

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-[15px] font-medium text-[#5B5F85]">
          <Link href="/" className="hover:text-[#4B35E0] transition-colors font-semibold text-[#0E1030]">
            Home
          </Link>
          <Link href="/#about" className="hover:text-[#4B35E0] transition-colors">
            About
          </Link>
          <Link href="/competitions" className="hover:text-[#4B35E0] transition-colors">
            Events
          </Link>
          <Link href="/tickets" className="hover:text-[#4B35E0] transition-colors">
            Tickets
          </Link>
          <Link href="/contact" className="hover:text-[#4B35E0] transition-colors">
            Contact Us
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/competitions?focus=search"
            aria-label="Search"
            className="p-2.5 rounded-full text-[#5B5F85] hover:text-[#4B35E0] hover:bg-[#F6F7FC] transition-colors"
          >
            <Search className="w-5 h-5" />
          </Link>

          <Link
            href="/auth/login"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-[#0E1030] hover:bg-[#F6F7FC] transition-all"
          >
            <span className="text-base">→]</span> Login
          </Link>

          <Link
            href="/apply"
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 transition-all"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}
