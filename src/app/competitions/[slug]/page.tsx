import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicEvent } from "@/lib/public-events";
import { EventClient } from "./EventClient";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) {
    return { title: "Competition Not Found | TekVotes" };
  }
  const title = `${event.name} | TekVotes Ghana`;
  const description =
    event.description ||
    `Vote live in ${event.name} organized by ${event.organizerName} on TekVotes Ghana.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(event.bannerUrl ? { images: [{ url: event.bannerUrl, alt: event.name }] } : {}),
    },
    twitter: {
      card: event.bannerUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(event.bannerUrl ? { images: [event.bannerUrl] } : {}),
    },
  };
}

export default async function CompetitionDetailPage({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <EventClient event={event} initialCode={query.code} />;
}
