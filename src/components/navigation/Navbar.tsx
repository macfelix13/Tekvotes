"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { createClient } from "@/lib/supabase/client";
import {
  Search,
  ChevronDown,
  Scale,
  Building2,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  LogIn,
} from "lucide-react";

const PORTAL_LINKS = [
  { href: "/judge", label: "Judge Ballot", desc: "Adjudicator scoring", Icon: Scale },
  { href: "/org", label: "Organiser Portal", desc: "Events & contestants", Icon: Building2 },
  { href: "/admin", label: "Super Admin", desc: "Approvals & treasury", Icon: ShieldCheck },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [portalsOpen, setPortalsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (active) setUserEmail(data.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPortalsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/signout", { method: "POST" });
      setUserEmail(null);
      setMobileOpen(false);
      setPortalsOpen(false);
      router.push("/auth/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const isPortalActive =
    pathname.startsWith("/judge") || pathname.startsWith("/org") || pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#D9DBEA] bg-white/95 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        <Logo />

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 text-[15px] font-medium text-[#5B5F85]">
          <Link
            href="/"
            className={`hover:text-[#4B35E0] transition-colors ${
              pathname === "/" ? "font-semibold text-[#0E1030]" : ""
            }`}
          >
            Home
          </Link>
          <Link
            href="/competitions"
            className={`hover:text-[#4B35E0] transition-colors ${
              pathname.startsWith("/competitions") ? "font-semibold text-[#0E1030]" : ""
            }`}
          >
            Events
          </Link>
          <Link
            href="/verify"
            className={`hover:text-[#4B35E0] transition-colors ${
              pathname.startsWith("/verify") ? "font-semibold text-[#0E1030]" : ""
            }`}
          >
            Verify Vote
          </Link>

          {/* Unified Portals Dropdown (Judge, Organiser, Admin) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setPortalsOpen((prev) => !prev)}
              aria-expanded={portalsOpen}
              className={`inline-flex items-center gap-1.5 py-2 px-3 rounded-xl transition-colors cursor-pointer ${
                isPortalActive || portalsOpen
                  ? "bg-[#E8E5FD]/70 text-[#4B35E0] font-semibold"
                  : "hover:text-[#0E1030] hover:bg-[#F6F7FC]"
              }`}
            >
              <span>Portals</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${portalsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {portalsOpen && (
              <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-white border border-[#D9DBEA] shadow-xl p-2 space-y-1 z-50">
                {PORTAL_LINKS.map(({ href, label, desc, Icon }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setPortalsOpen(false)}
                      className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                        active
                          ? "bg-[#E8E5FD] text-[#4B35E0]"
                          : "hover:bg-[#F6F7FC] text-[#0E1030]"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#F6F7FC] border border-[#D9DBEA] flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-[#4B35E0]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold leading-tight">{label}</div>
                        <div className="text-[11px] text-[#5B5F85]">{desc}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/competitions"
            aria-label="Search events"
            className="p-2 sm:p-2.5 rounded-full text-[#5B5F85] hover:text-[#4B35E0] hover:bg-[#F6F7FC] transition-colors"
          >
            <Search className="w-5 h-5" />
          </Link>

          {userEmail ? (
            <div className="hidden lg:flex items-center gap-2.5">
              <span className="text-xs font-semibold text-[#5B5F85] max-w-[160px] truncate px-3 py-1.5 rounded-lg bg-[#F6F7FC] border border-[#D9DBEA]">
                {userEmail}
              </span>
              <button
                type="button"
                disabled={signingOut}
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-[#D9DBEA] text-[#0E1030] hover:bg-[#F6F7FC] disabled:opacity-50 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-[#D13A3A]" />
                <span>{signingOut ? "Signing out..." : "Logout"}</span>
              </button>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-2.5">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-[#0E1030] hover:bg-[#F6F7FC] transition-all"
              >
                <LogIn className="w-4 h-4 text-[#4B35E0]" />
                <span>Login</span>
              </Link>

              <Link
                href="/apply"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 transition-all"
              >
                Register
              </Link>
            </div>
          )}

          {/* Mobile Hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="lg:hidden p-2 rounded-xl border border-[#D9DBEA] text-[#0E1030] hover:bg-[#F6F7FC] cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#D9DBEA] bg-white px-4 py-4 space-y-4 shadow-lg">
          <div className="space-y-1">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2.5 rounded-xl text-sm font-semibold ${
                pathname === "/" ? "bg-[#E8E5FD] text-[#4B35E0]" : "text-[#0E1030] hover:bg-[#F6F7FC]"
              }`}
            >
              Home
            </Link>
            <Link
              href="/competitions"
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2.5 rounded-xl text-sm font-semibold ${
                pathname.startsWith("/competitions")
                  ? "bg-[#E8E5FD] text-[#4B35E0]"
                  : "text-[#0E1030] hover:bg-[#F6F7FC]"
              }`}
            >
              Events
            </Link>
            <Link
              href="/verify"
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2.5 rounded-xl text-sm font-semibold ${
                pathname.startsWith("/verify")
                  ? "bg-[#E8E5FD] text-[#4B35E0]"
                  : "text-[#0E1030] hover:bg-[#F6F7FC]"
              }`}
            >
              Verify Vote
            </Link>
          </div>

          <div className="pt-3 border-t border-[#D9DBEA] space-y-1.5">
            <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#5B5F85] block">
              Portals
            </span>
            {PORTAL_LINKS.map(({ href, label, desc, Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                    active ? "bg-[#E8E5FD] text-[#4B35E0]" : "text-[#0E1030] hover:bg-[#F6F7FC]"
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#4B35E0] shrink-0" />
                  <div>
                    <div className="text-sm font-semibold leading-tight">{label}</div>
                    <div className="text-[11px] text-[#5B5F85]">{desc}</div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#D9DBEA] space-y-2">
            {userEmail ? (
              <>
                <div className="px-3 text-xs text-[#5B5F85] truncate">
                  Signed in as <strong className="text-[#0E1030]">{userEmail}</strong>
                </div>
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => void handleLogout()}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#D9DBEA] text-sm font-semibold text-[#D13A3A] hover:bg-[#D13A3A]/5 disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{signingOut ? "Signing out..." : "Logout"}</span>
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-[#D9DBEA] text-sm font-semibold text-[#0E1030] hover:bg-[#F6F7FC]"
                >
                  <LogIn className="w-4 h-4 text-[#4B35E0]" />
                  <span>Login</span>
                </Link>
                <Link
                  href="/apply"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-[#4B35E0] text-white text-sm font-semibold hover:bg-[#3B28B8]"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
