import { notFound } from "next/navigation";
import { getPublicEvent } from "@/lib/public-events";
import { EventClient } from "./EventClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompetitionDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <EventClient event={event} />;
}
