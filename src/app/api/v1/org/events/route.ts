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
  eventType: z.enum(["beauty_pageant", "award_show", "talent_show", "campus_contest", "other"]).default("beauty_pageant"),
  categoryName: z.string().trim().min(2).max(100).default("Main Category"),
  unitPriceGhs: z.number().positive("Price per vote must be greater than zero").max(10000),
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
    description,
    votingOpensAt,
    votingClosesAt,
    bannerUrl,
  } = parsed.data;
  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const opensIso = votingOpensAt ? new Date(votingOpensAt).toISOString() : null;
  const closesIso = votingClosesAt ? new Date(votingClosesAt).toISOString() : null;
  if (opensIso && closesIso && new Date(closesIso).getTime() <= new Date(opensIso).getTime()) {
    return NextResponse.json(
      { error: "INVALID_DATES", message: "Voting closing date/time must be after the opening date/time." },
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
  if (cleanBanner) {
    await admin.from("branding_settings").upsert(
      {
        event_id: event.id,
        organization_id: organizationId,
        banner_public_id: cleanBanner,
      },
      { onConflict: "event_id" }
    );
  }

  const catSlug = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "main";

  const { data: category, error: catErr } = await admin
    .from("event_categories")
    .insert({
      event_id: event.id,
      organization_id: organizationId,
      name: categoryName,
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
