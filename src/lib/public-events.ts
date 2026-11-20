// Server-only loaders for the public competition pages.
//
// Events, categories, entries and organizations are read with the anon key so
// Supabase RLS decides what is public (published + not rejected/revoked).
// Two things are deliberately NOT anon-readable in the schema and are read with
// the service role using a narrow projection, only for rows the anon read
// already proved public:
//   - contestants.display_name (contestants table is member-only)
//   - category_entry_tallies (staff-only); counts are only returned for
//     categories whose results_state is 'live' or 'final'.
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
}

export interface PublicCategoryEntry {
  id: string; // category_entries.id (what a vote targets)
  categoryId: string;
  categoryName: string;
  unitPriceMinor: number;
  code: string;
  contestantNumber: number;
  name: string;
  votes: number | null; // null when the category hides results
}

export interface PublicEventDetail extends Omit<PublicEventSummary, "contestantsCount" | "minUnitPriceMinor"> {
  description: string | null;
  venue: string | null;
  opensAt: string | null;
  categories: { id: string; name: string; unitPriceMinor: number; resultsVisible: boolean }[];
  entries: PublicCategoryEntry[];
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
  const [{ data: cats, error: catErr }, { data: entries, error: entErr }] = await Promise.all([
    db.from("event_categories").select("event_id, unit_price_minor").in("event_id", ids),
    db.from("contestant_entries").select("event_id").in("event_id", ids),
  ]);
  if (catErr) throw new Error(`Failed to load categories: ${catErr.message}`);
  if (entErr) throw new Error(`Failed to load entries: ${entErr.message}`);

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

  const [{ data: cats, error: catErr }, { data: catEntries, error: ceErr }] = await Promise.all([
    db
      .from("event_categories")
      .select("id, name, unit_price_minor, results_state, sort_order")
      .eq("event_id", event.id)
      .order("sort_order"),
    db
      .from("category_entries")
      .select("id, category_id, display_order, contestant_entries(public_code, contestant_number, contestant_id)")
      .eq("event_id", event.id)
      .order("display_order"),
  ]);
  if (catErr) throw new Error(`Failed to load categories: ${catErr.message}`);
  if (ceErr) throw new Error(`Failed to load entries: ${ceErr.message}`);

  type EntryEmbed = { public_code: string; contestant_number: number; contestant_id: string };
  const rows = (catEntries ?? []).map((ce) => {
    const raw = ce.contestant_entries as EntryEmbed | EntryEmbed[] | null;
    return { ...ce, entry: Array.isArray(raw) ? raw[0] : raw };
  }).filter((r) => r.entry);

  const categories = (cats ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    unitPriceMinor: Number(c.unit_price_minor),
    resultsVisible: c.results_state === "live" || c.results_state === "final",
  }));
  const catById = new Map(categories.map((c) => [c.id, c]));

  // Narrow service-role reads, scoped to ids the anon query already returned.
  const svc = service();
  const contestantIds = [...new Set(rows.map((r) => r.entry!.contestant_id))];
  const visibleCeIds = rows.filter((r) => catById.get(r.category_id)?.resultsVisible).map((r) => r.id);
  const [{ data: people, error: pErr }, { data: tallies, error: tErr }] = await Promise.all([
    contestantIds.length
      ? svc.from("contestants").select("id, display_name").in("id", contestantIds)
      : Promise.resolve({ data: [], error: null }),
    visibleCeIds.length
      ? svc.from("category_entry_tallies").select("category_entry_id, total_votes").in("category_entry_id", visibleCeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (pErr) throw new Error(`Failed to load contestants: ${pErr.message}`);
  if (tErr) throw new Error(`Failed to load tallies: ${tErr.message}`);

  const nameById = new Map((people ?? []).map((p) => [p.id as string, p.display_name as string]));
  const votesByCe = new Map((tallies ?? []).map((t) => [t.category_entry_id as string, Number(t.total_votes)]));

  const entries: PublicCategoryEntry[] = rows.map((r) => {
    const cat = catById.get(r.category_id)!;
    return {
      id: r.id,
      categoryId: r.category_id,
      categoryName: cat?.name ?? "",
      unitPriceMinor: cat?.unitPriceMinor ?? 0,
      code: r.entry!.public_code,
      contestantNumber: r.entry!.contestant_number,
      name: nameById.get(r.entry!.contestant_id) ?? `Contestant ${r.entry!.contestant_number}`,
      votes: cat?.resultsVisible ? votesByCe.get(r.id) ?? 0 : null,
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
    categories,
    entries,
  };
}
