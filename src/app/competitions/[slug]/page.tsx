import { Suspense } from "react";
import { EventClient } from "./EventClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return [
    { slug: "miss-hijab-ghana-2026" },
    { slug: "mempeasem-circuit-awards-2026" },
    { slug: "kids-talent-show-2026" },
    { slug: "miss-campus-ghana-2026" },
    { slug: "ghana-gospel-industry-awards" },
    { slug: "accra-varsity-dance-championship" },
  ];
}

export default async function CompetitionDetailPage({ params }: PageProps) {
  const resolved = await params;
  return (
    <Suspense fallback={<div className="p-12 text-center text-[#5B5F85]">Loading event...</div>}>
      <EventClient slug={resolved.slug} />
    </Suspense>
  );
}
