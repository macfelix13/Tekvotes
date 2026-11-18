import React from "react";
import Link from "next/link";
import { Sparkles, Trophy } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className = "", showText = true }: LogoProps) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 group ${className}`}>
      {/* Icon: Direction 1 - Bold T forming a checkmark with gold spark */}
      <div className="relative w-9 h-9 rounded-xl bg-[#0E1030] flex items-center justify-center text-white shadow-md shadow-[#0E1030]/20 group-hover:scale-105 transition-transform">
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Stem of T */}
          <path d="M12 7v13" />
          {/* Crossbar that sweeps up into a check */}
          <path d="M5 7h14l-3 4" />
        </svg>
        {/* Gold spark accent */}
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F2A900] opacity-60" />
          <Sparkles className="relative w-3.5 h-3.5 text-[#F2A900] fill-[#F2A900]" />
        </span>
      </div>

      {showText && (
        <span className="font-heading font-extrabold text-xl tracking-tight text-[#0E1030]">
          Tek<span className="text-[#4B35E0]">Votes</span>
        </span>
      )}
    </Link>
  );
}
