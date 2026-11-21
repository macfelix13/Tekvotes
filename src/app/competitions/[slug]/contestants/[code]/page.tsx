import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContestantTracker } from "@/lib/public-events";
import { ContestantTrackerClient } from "./ContestantTrackerClient";

interface PageProps {
  params: Promise<{ slug: string; code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, code } = await params;
  const tracker = await getContestantTracker(slug, code);
  if (!tracker) {
    return { title: "Contestant Not Found | TekVotes" };
  }
  const title = `${tracker.contestant.name} (${tracker.contestant.code}) — ${tracker.event.name}`;
  const description =
    tracker.contestant.bio ||
    `Support and vote for ${tracker.contestant.name} in ${tracker.event.name} on TekVotes Ghana.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(tracker.contestant.photoUrl
        ? { images: [{ url: tracker.contestant.photoUrl, alt: tracker.contestant.name }] }
        : tracker.event.bannerUrl
        ? { images: [{ url: tracker.event.bannerUrl, alt: tracker.event.name }] }
        : {}),
    },
  };
}

export default async function ContestantTrackerPage({ params }: PageProps) {
  const { slug, code } = await params;
  const tracker = await getContestantTracker(slug, code);
  if (!tracker) notFound();
  return <ContestantTrackerClient tracker={tracker} />;
}
