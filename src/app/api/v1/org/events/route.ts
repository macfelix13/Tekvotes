import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const CreateEventSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  name: z.string().trim().min(2, "Event title must be at least 2 characters").max(150),
  publicCode: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9_-]+$/, "Event code can only contain letters, numbers, hyphens, or underscores"),
  eventType: z
    .enum(["beauty_pageant", "award_show", "talent_show", "campus_contest", "ticketed_event", "other"])
    .default("beauty_pageant"),
  categoryName: z.string().trim().max(100).optional(),
  unitPriceGhs: z.number().positive("Price must be greater than zero").max(50000).default(1),
  ticketTierName: z.string().trim().max(120).optional(),
  ticketPriceGhs: z.number().positive("Ticket price must be greater than zero").max(50000).optional(),
  eventDate: z.string().datetime({ offset: true }).nullable().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional(),
  votingOpensAt: z.string().datetime({ offset: true }).nullable().optional().or(z.literal("")),
  votingClosesAt: z.string().datetime({ offset: true }).nullable().optional().or(z.literal("")),
  bannerUrl: z
    .string()
    .trim()
    .url("Banner URL must be valid")
    .refine((u) => u.startsWith("https://"), "Banner URL must use HTTPS")
    .optional()
    .or(z.literal("")),
  ticketFlyerUrl: z
    .string()
    .trim()
    .url("Ticket flyer URL must be valid")
    .refine((u) => u.startsWith("https://"), "Ticket flyer URL must use HTTPS")
    .optional()
    .or(z.literal("")),
});

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `event-${suffix}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid event details." },
      { status: 400 }
    );
  }

  const {
    organizationId,
    name,
    publicCode,
    eventType,
    categoryName,
    unitPriceGhs,
    ticketTierName,
    ticketPriceGhs,
    eventDate,
    description,
    votingOpensAt,
    votingClosesAt,
    bannerUrl,
    ticketFlyerUrl,
  } = parsed.data;
  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const opensIso = votingOpensAt ? new Date(votingOpensAt).toISOString() : null;
  const closesIso = votingClosesAt ? new Date(votingClosesAt).toISOString() : null;
  const eventDateIso = eventDate ? new Date(eventDate).toISOString() : null;
  if (opensIso && closesIso && new Date(closesIso).getTime() <= new Date(opensIso).getTime()) {
    return NextResponse.json(
      { error: "INVALID_DATES", message: "Voting closing date/time must be after the opening date/time." },
      { status: 400 }
    );
  }
  if (eventType === "ticketed_event" && !eventDateIso) {
    return NextResponse.json(
      { error: "EVENT_DATE_REQUIRED", message: "Please specify the exact date and time for this ticketed event." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const unitPriceMinor = Math.round(unitPriceGhs * 100);
  if (unitPriceMinor <= 0) {
    return NextResponse.json({ error: "INVALID_PRICE", message: "Price per vote must be at least GHS 0.01." }, { status: 400 });
  }

  const eventSlug = slugify(name);
  const normalizedCode = publicCode.toUpperCase();

  const { data: event, error: evErr } = await admin
    .from("events")
    .insert({
      organization_id: organizationId,
      slug: eventSlug,
      public_code: normalizedCode,
      name,
      description: description || null,
      event_type: eventType,
      event_date: eventDateIso,
      voting_opens_at: opensIso,
      voting_closes_at: closesIso,
      publication_status: "published",
      approval_status: "not_submitted",
      voting_status: "not_started",
      created_by: auth.user.id,
    })
    .select("id, slug, public_code, name")
    .single();

  if (evErr || !event) {
    if (evErr?.code === "23505") {
      return NextResponse.json(
        { error: "DUPLICATE_CODE", message: "That event short code is already in use. Please choose another." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "CREATE_EVENT_FAILED", message: evErr?.message || "Could not create event." },
      { status: 500 }
    );
  }

  const cleanBanner = bannerUrl?.trim() || null;
  const cleanTicketFlyer = ticketFlyerUrl?.trim() || null;
  if (cleanBanner || cleanTicketFlyer) {
    await admin.from("branding_settings").upsert(
      {
        event_id: event.id,
        organization_id: organizationId,
        banner_public_id: eventType === "ticketed_event" ? null : cleanBanner,
        ticket_flyer_public_id: eventType === "ticketed_event" ? (cleanTicketFlyer || cleanBanner) : cleanTicketFlyer,
      },
      { onConflict: "event_id" }
    );
  }

  if (eventType === "ticketed_event") {
    const firstTierName = ticketTierName?.trim() || "Regular Ticket";
    const firstTierPriceMinor = Math.round((ticketPriceGhs || unitPriceGhs || 50) * 100);
    const { data: ticketTier, error: tierErr } = await admin
      .from("event_ticket_tiers")
      .insert({
        event_id: event.id,
        organization_id: organizationId,
        name: firstTierName,
        description: "Official event admission pass",
        price_minor: firstTierPriceMinor,
        currency: "GHS",
        created_by: auth.user.id,
      })
      .select("id, name, price_minor")
      .single();

    if (tierErr) {
      return NextResponse.json(
        { error: "CREATE_TIER_FAILED", message: tierErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ event, ticketTier }, { status: 201 });
  }

  const finalCatName = categoryName?.trim() || "Main Category";
  const catSlug = finalCatName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "main";

  const { data: category, error: catErr } = await admin
    .from("event_categories")
    .insert({
      event_id: event.id,
      organization_id: organizationId,
      name: finalCatName,
      slug: catSlug,
      sort_order: 0,
      results_state: "live",
      live_visibility: "counts",
      voting_enabled: true,
      unit_price_minor: unitPriceMinor,
    })
    .select("id, name, unit_price_minor")
    .single();

  if (catErr || !category) {
    return NextResponse.json(
      { error: "CREATE_CATEGORY_FAILED", message: catErr?.message || "Event created but default category failed." },
      { status: 500 }
    );
  }

  const defaultPackages = [10, 50, 100].map((votes, idx) => ({
    category_id: category.id,
    event_id: event.id,
    organization_id: organizationId,
    label: `${votes} votes`,
    votes,
    price_minor: votes * unitPriceMinor,
    sort_order: idx,
  }));

  await admin.from("vote_packages").insert(defaultPackages);

  return NextResponse.json({ event, category }, { status: 201 });
}
