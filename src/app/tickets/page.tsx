import type { Metadata } from "next";
import { Navbar } from "@/components/navigation/Navbar";
import { listPublicTicketedEvents } from "@/lib/public-events";
import { TicketsClient } from "./TicketsClient";

export const metadata: Metadata = {
  title: "Event Tickets & Digital Passes | TekVotes Ghana",
  description:
    "Purchase official event tickets and VIP passes for pageants, awards shows, and live concerts across Ghana with instant MoMo & Card checkout.",
};

export default async function TicketsPage() {
  const events = await listPublicTicketedEvents();
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 py-12">
        <TicketsClient events={events} />
      </main>
    </div>
  );
}
