import { Suspense } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import { listPublicEvents } from "@/lib/public-events";
import { CompetitionsClient } from "./CompetitionsClient";

export default async function CompetitionsPage() {
  const events = await listPublicEvents();
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 py-12">
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-12 text-center text-[#5B5F85]">Loading competitions...</div>}>
          <CompetitionsClient events={events} />
        </Suspense>
      </main>
    </div>
  );
}
