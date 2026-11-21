// Server-only loaders for the public competition pages.
//
// Events, categories, entries, branding and organizations are read with the anon key
// so Supabase RLS decides what is public (published + not rejected/revoked).
// Narrow service-role reads are scoped to IDs the anon query already proved public:
//   - contestants (display_name, bio, profile_public_id)
//   - category_entry_tallies (only when category.results_state is 'live' or 'final').
import { connection } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface PublicEventSummary {
  id: string;
  slug: string;
  name: string;
  eventType: string;
  organizerName: string;
  votingOpen: boolean;
  votingStatus: string;
  contestantsCount: number;
  minUnitPriceMinor: number | null;
  closesAt: string | null;
  bannerUrl: string | null;
}

export interface PublicCategoryEntry {
  id: string; // category_entries.id (what a vote targets)
  categoryId: string;
  categoryName: string;
  unitPriceMinor: number;
  code: string;
  contestantNumber: number;
  name: string;
  bio: string | null;
  photoUrl: string | null;
  socials: { platform: string; url: string }[];
  votes: number | null; // null when the category hides results
  officialResult?: {
    rank: number;
    finalScore: number;
    publicVoteScore: number;
    judgeScore: number;
  } | null;
}

export interface PublicVotePackage {
  id: string;
  label: string;
  votes: number;
  priceMinor: number;
}

export interface PublicEventDetail extends Omit<PublicEventSummary, "contestantsCount" | "minUnitPriceMinor"> {
  description: string | null;
  venue: string | null;
  opensAt: string | null;
  categories: {
    id: string;
    name: string;
    unitPriceMinor: number;
    resultsVisible: boolean;
    liveVisibility: "ranks_only" | "counts" | "percent";
    contestantResultsVisible: boolean;
    isFinal: boolean;
    packages: PublicVotePackage[];
  }[];
  entries: PublicCategoryEntry[];
}

export interface ContestantTrackerDetail {
  event: {
    id: string;
    slug: string;
    name: string;
    organizerName: string;
    votingOpen: boolean;
    votingStatus: string;
    bannerUrl: string | null;
  };
  category: {
    id: string;
    name: string;
    unitPriceMinor: number;
    contestantResultsVisible: boolean;
    publicResultsVisible: boolean;
    isFinal: boolean;
    packages: PublicVotePackage[];
  };
  contestant: {
    id: string; // category_entries.id
    code: string;
    contestantNumber: number;
    name: string;
    bio: string | null;
    photoUrl: string | null;
    socials: { platform: string; url: string }[];
    votes: number | null;
    rank: number | null;
    totalCategoryVotes: number | null;
    totalContestantsInCategory: number;
  };
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

function anon(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), noSession);
}

function service(): SupabaseClient {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), noSession);
}

type OrgEmbed = { name: string } | { name: string }[] | null;
const orgName = (o: OrgEmbed) => (Array.isArray(o) ? o[0]?.name : o?.name) ?? "Organiser";

export interface PublicMarqueeItem {
  id: string;
  name: string;
  subtitle: string;
  badge: "Event" | "Sponsor" | "Partner";
  logoUrl: string | null;
  href?: string;
}

export async function listPublicMarqueeItems(events: PublicEventSummary[]): Promise<PublicMarqueeItem[]> {
  await connection();
  const db = anon();
  const [{ data: sponsors }, { data: cmsItems }] = await Promise.all([
    db
      .from("sponsors")
      .select("id, name, tier, logo_public_id, website_url")
      .order("sort_order", { ascending: true })
      .limit(12),
    db
      .from("platform_marquee_items")
      .select("id, name, subtitle, badge, logo_url, website_url")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
  ]);

  const eventItems: PublicMarqueeItem[] = events.map((e) => ({
    id: `event-${e.id}`,
    name: e.name,
    subtitle: e.organizerName,
    badge: "Event",
    logoUrl: e.bannerUrl,
    href: `/competitions/${e.slug}`,
  }));

  const sponsorItems: PublicMarqueeItem[] = (sponsors ?? []).map((s) => ({
    id: `sponsor-${s.id as string}`,
    name: String(s.name),
    subtitle: `${String(s.tier || "Official").replace(/^\w/, (c) => c.toUpperCase())} Sponsor`,
    badge: "Sponsor",
    logoUrl: (s.logo_public_id as string | null) ?? null,
    href: (s.website_url as string | null) || undefined,
  }));

  const cmsPartnerItems: PublicMarqueeItem[] = (cmsItems ?? []).map((p) => ({
    id: `cms-${String(p.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${String(p.id).slice(0, 6)}`,
    name: String(p.name),
    subtitle: String(p.subtitle || ""),
    badge: (p.badge as "Event" | "Sponsor" | "Partner") || "Partner",
    logoUrl: (p.logo_url as string | null) ?? null,
    href: (p.website_url as string | null) || undefined,
  }));

  return [...eventItems, ...sponsorItems, ...cmsPartnerItems];
}

export async function listPublicEvents(): Promise<PublicEventSummary[]> {
  await connection();
  const db = anon();

  const { data: events, error } = await db
    .from("events")
    .select("id, slug, name, event_type, voting_status, approval_status, voting_closes_at, organizations(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load events: ${error.message}`);
  if (!events?.length) return [];

  const ids = events.map((e) => e.id);
  const [{ data: cats, error: catErr }, { data: entries, error: entErr }, { data: brandings }] = await Promise.all([
    db.from("event_categories").select("event_id, unit_price_minor").in("event_id", ids),
    db.from("contestant_entries").select("event_id").in("event_id", ids),
    db.from("branding_settings").select("event_id, banner_public_id").in("event_id", ids),
  ]);
  if (catErr) throw new Error(`Failed to load categories: ${catErr.message}`);
  if (entErr) throw new Error(`Failed to load entries: ${entErr.message}`);

  const bannerByEvent = new Map(
    (brandings ?? []).map((b) => [b.event_id as string, (b.banner_public_id as string | null) ?? null])
  );

  return events.map((e) => {
    const prices = (cats ?? []).filter((c) => c.event_id === e.id).map((c) => Number(c.unit_price_minor));
    return {
      id: e.id,
      slug: e.slug,
      name: e.name,
      eventType: e.event_type,
      organizerName: orgName(e.organizations as OrgEmbed),
      votingStatus: e.voting_status,
      votingOpen: e.voting_status === "active" && e.approval_status === "approved",
      contestantsCount: (entries ?? []).filter((x) => x.event_id === e.id).length,
      minUnitPriceMinor: prices.length ? Math.min(...prices) : null,
      closesAt: e.voting_closes_at,
      bannerUrl: bannerByEvent.get(e.id) ?? null,
    };
  });
}

export async function getPublicEvent(slug: string): Promise<PublicEventDetail | null> {
  await connection();
  const db = anon();

  const { data: event, error } = await db
    .from("events")
    .select(
      "id, slug, name, description, venue, event_type, voting_status, approval_status, voting_opens_at, voting_closes_at, organizations(name)"
    )
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load event: ${error.message}`);
  if (!event) return null;

  const [{ data: cats, error: catErr }, { data: catEntries, error: ceErr }, { data: branding }, { data: pkgRows }] =
    await Promise.all([
      db
        .from("event_categories")
        .select("id, name, unit_price_minor, results_state, live_visibility, contestant_results_visible, sort_order")
        .eq("event_id", event.id)
        .order("sort_order"),
      db
        .from("category_entries")
        .select("id, category_id, display_order, contestant_entries(public_code, contestant_number, contestant_id, event_bio)")
        .eq("event_id", event.id)
        .order("display_order"),
      db
        .from("branding_settings")
        .select("banner_public_id")
        .eq("event_id", event.id)
        .maybeSingle(),
      db
        .from("vote_packages")
        .select("id, category_id, label, votes, price_minor, sort_order")
        .eq("event_id", event.id)
        .eq("active", true)
        .order("sort_order"),
    ]);
  if (catErr) throw new Error(`Failed to load categories: ${catErr.message}`);
  if (ceErr) throw new Error(`Failed to load entries: ${ceErr.message}`);

  type EntryEmbed = { public_code: string; contestant_number: number; contestant_id: string; event_bio: string | null };
  const rows = (catEntries ?? [])
    .map((ce) => {
      const raw = ce.contestant_entries as EntryEmbed | EntryEmbed[] | null;
      return { ...ce, entry: Array.isArray(raw) ? raw[0] : raw };
    })
    .filter((r) => r.entry);

  const packagesByCat = new Map<string, PublicVotePackage[]>();
  for (const p of pkgRows ?? []) {
    const cid = p.category_id as string;
    const list = packagesByCat.get(cid) ?? [];
    list.push({
      id: p.id as string,
      label: String(p.label),
      votes: Number(p.votes),
      priceMinor: Number(p.price_minor),
    });
    packagesByCat.set(cid, list);
  }

  const categories = (cats ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    unitPriceMinor: Number(c.unit_price_minor),
    resultsVisible: c.results_state === "live" || c.results_state === "final",
    liveVisibility: (c.live_visibility as "ranks_only" | "counts" | "percent") ?? "counts",
    contestantResultsVisible: c.contestant_results_visible !== false,
    isFinal: c.results_state === "final",
    packages: packagesByCat.get(c.id as string) ?? [],
  }));
  const catById = new Map(categories.map((c) => [c.id, c]));

  const svc = service();
  const contestantIds = [...new Set(rows.map((r) => r.entry!.contestant_id))];
  const visibleCeIds = rows.filter((r) => catById.get(r.category_id)?.resultsVisible).map((r) => r.id);
  const finalCatIds = categories.filter((c) => c.isFinal).map((c) => c.id);

  const [{ data: people, error: pErr }, { data: tallies, error: tErr }, { data: socialRows }, { data: pubRows }] =
    await Promise.all([
      contestantIds.length
        ? svc.from("contestants").select("id, display_name, bio, profile_public_id").in("id", contestantIds)
        : Promise.resolve({ data: [], error: null }),
      visibleCeIds.length
        ? svc.from("category_entry_tallies").select("category_entry_id, total_votes").in("category_entry_id", visibleCeIds)
        : Promise.resolve({ data: [], error: null }),
      contestantIds.length
        ? db.from("contestant_social_links").select("contestant_id, platform, url").in("contestant_id", contestantIds).order("sort_order")
        : Promise.resolve({ data: [] }),
      finalCatIds.length
        ? db
            .from("result_publications")
            .select("category_id, calculation_id, published_at")
            .in("category_id", finalCatIds)
            .eq("state", "final")
            .order("published_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
  if (pErr) throw new Error(`Failed to load contestants: ${pErr.message}`);
  if (tErr) throw new Error(`Failed to load tallies: ${tErr.message}`);

  const latestCalcByCat = new Map<string, string>();
  for (const p of pubRows ?? []) {
    if (!latestCalcByCat.has(p.category_id as string)) {
      latestCalcByCat.set(p.category_id as string, p.calculation_id as string);
    }
  }
  const calcIds = [...new Set(latestCalcByCat.values())];
  const { data: officialRows } =
    calcIds.length > 0
      ? await db
          .from("results")
          .select("calculation_id, category_entry_id, rank, final_score, public_vote_score, judge_aggregate_score")
          .in("calculation_id", calcIds)
      : { data: [] };

  const officialByCe = new Map<
    string,
    { rank: number; finalScore: number; publicVoteScore: number; judgeScore: number }
  >();
  for (const r of officialRows ?? []) {
    officialByCe.set(r.category_entry_id as string, {
      rank: Number(r.rank ?? 0),
      finalScore: Number(r.final_score ?? 0),
      publicVoteScore: Number(r.public_vote_score ?? 0),
      judgeScore: Number(r.judge_aggregate_score ?? 0),
    });
  }

  const personById = new Map(
    (people ?? []).map((p) => [
      p.id as string,
      {
        name: p.display_name as string,
        bio: (p.bio as string | null) ?? null,
        photoUrl: (p.profile_public_id as string | null) ?? null,
      },
    ])
  );
  const votesByCe = new Map((tallies ?? []).map((t) => [t.category_entry_id as string, Number(t.total_votes)]));
  const socialsByContestant = new Map<string, { platform: string; url: string }[]>();
  for (const s of socialRows ?? []) {
    const cid = s.contestant_id as string;
    const list = socialsByContestant.get(cid) ?? [];
    list.push({ platform: String(s.platform), url: String(s.url) });
    socialsByContestant.set(cid, list);
  }

  const entries: PublicCategoryEntry[] = rows.map((r) => {
    const cat = catById.get(r.category_id)!;
    const person = personById.get(r.entry!.contestant_id);
    return {
      id: r.id,
      categoryId: r.category_id,
      categoryName: cat?.name ?? "",
      unitPriceMinor: cat?.unitPriceMinor ?? 0,
      code: r.entry!.public_code,
      contestantNumber: r.entry!.contestant_number,
      name: person?.name ?? `Contestant ${r.entry!.contestant_number}`,
      bio: r.entry!.event_bio ?? person?.bio ?? null,
      photoUrl: person?.photoUrl ?? null,
      socials: socialsByContestant.get(r.entry!.contestant_id) ?? [],
      votes: cat?.resultsVisible ? votesByCe.get(r.id) ?? 0 : null,
      officialResult: officialByCe.get(r.id) ?? null,
    };
  });

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    description: event.description,
    venue: event.venue,
    eventType: event.event_type,
    organizerName: orgName(event.organizations as OrgEmbed),
    votingStatus: event.voting_status,
    votingOpen: event.voting_status === "active" && event.approval_status === "approved",
    opensAt: event.voting_opens_at,
    closesAt: event.voting_closes_at,
    bannerUrl: (branding?.banner_public_id as string | null) ?? null,
    categories,
    entries,
  };
}

export async function getContestantTracker(
  slug: string,
  code: string
): Promise<ContestantTrackerDetail | null> {
  const detail = await getPublicEvent(slug);
  if (!detail) return null;

  const target = detail.entries.find((e) => e.code.toLowerCase() === code.trim().toLowerCase());
  if (!target) return null;

  const cat = detail.categories.find((c) => c.id === target.categoryId);
  if (!cat) return null;

  const svc = service();
  const catEntryIds = detail.entries.filter((e) => e.categoryId === cat.id).map((e) => e.id);

  let votes: number | null = null;
  let rank: number | null = null;
  let totalCategoryVotes: number | null = null;

  if (cat.contestantResultsVisible) {
    const { data: tallies } =
      catEntryIds.length > 0
        ? await svc
            .from("category_entry_tallies")
            .select("category_entry_id, total_votes")
            .in("category_entry_id", catEntryIds)
        : { data: [] };

    const voteMap = new Map((tallies ?? []).map((t) => [t.category_entry_id as string, Number(t.total_votes)]));
    const ranked = catEntryIds
      .map((id) => ({ id, votes: voteMap.get(id) ?? 0 }))
      .sort((a, b) => b.votes - a.votes);

    totalCategoryVotes = ranked.reduce((acc, r) => acc + r.votes, 0);
    const idx = ranked.findIndex((r) => r.id === target.id);
    votes = voteMap.get(target.id) ?? 0;
    rank = idx >= 0 ? idx + 1 : null;
  }

  return {
    event: {
      id: detail.id,
      slug: detail.slug,
      name: detail.name,
      organizerName: detail.organizerName,
      votingOpen: detail.votingOpen,
      votingStatus: detail.votingStatus,
      bannerUrl: detail.bannerUrl,
    },
    category: {
      id: cat.id,
      name: cat.name,
      unitPriceMinor: cat.unitPriceMinor,
      contestantResultsVisible: cat.contestantResultsVisible,
      publicResultsVisible: cat.resultsVisible,
      isFinal: cat.isFinal,
      packages: cat.packages,
    },
    contestant: {
      id: target.id,
      code: target.code,
      contestantNumber: target.contestantNumber,
      name: target.name,
      bio: target.bio,
      photoUrl: target.photoUrl,
      socials: target.socials,
      votes,
      rank,
      totalCategoryVotes,
      totalContestantsInCategory: catEntryIds.length,
    },
  };
}
