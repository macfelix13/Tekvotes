import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEvent } from "@/lib/public-events";
import { TicketEventPurchaseClient } from "./TicketEventPurchaseClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) {
    return { title: "Event Tickets Not Found | TekVotes" };
  }
  const title = `Buy Tickets: ${event.name} | TekVotes Ghana`;
  const description =
    event.description ||
    `Purchase official tickets for ${event.name} organized by ${event.organizerName} on TekVotes Ghana.`;
  const flyer = event.ticketFlyerUrl || event.bannerUrl;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(flyer ? { images: [{ url: flyer, alt: event.name }] } : {}),
    },
  };
}

export default async function TicketEventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <TicketEventPurchaseClient event={event} />;
}
