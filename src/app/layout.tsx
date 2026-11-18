import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TekVotes | Competitions & Voting Platform",
  description: "Centralized multi-tenant digital platform for awards, pageants, and voting competitions in Ghana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Sora:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-[#F6F7FC] text-[#2A2D55]">{children}</body>
    </html>
  );
}
