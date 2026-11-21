import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const PatchEventSchema = z.object({
  name: z.string().trim().min(2, "Event title must be at least 2 characters").max(150).optional(),
  publicCode: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(/^[A-Za-z0-9_-]+$/, "Event code can only contain letters, numbers, hyphens, or underscores")
    .optional(),
  eventType: z
    .enum(["beauty_pageant", "award_show", "talent_show", "campus_contest", "ticketed_event", "other"])
    .optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  venue: z.string().trim().max(200).optional().or(z.literal("")),
  eventDate: z.string().datetime({ offset: true }).nullable().optional().or(z.literal("")),
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

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid event ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid event update payload." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: ev, error: evErr } = await admin
    .from("events")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (evErr || !ev) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Event not found." }, { status: 404 });
  }

  // Allows both Organiser members and Super Admin, before or after approval
  const auth = await requireApiOrgMember(ev.organization_id);
  if (!auth.ok) return auth.response;

  const { name, publicCode, eventType, description, venue, eventDate, votingOpensAt, votingClosesAt, bannerUrl, ticketFlyerUrl } = parsed.data;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (publicCode !== undefined) updates.public_code = publicCode.toUpperCase();
  if (eventType !== undefined) updates.event_type = eventType;
  if (description !== undefined) updates.description = description.trim() || null;
  if (venue !== undefined) updates.venue = venue.trim() || null;
  if (eventDate !== undefined) {
    updates.event_date = eventDate ? new Date(eventDate).toISOString() : null;
  }
  if (votingOpensAt !== undefined) {
    updates.voting_opens_at = votingOpensAt ? new Date(votingOpensAt).toISOString() : null;
  }
  if (votingClosesAt !== undefined) {
    updates.voting_closes_at = votingClosesAt ? new Date(votingClosesAt).toISOString() : null;
  }

  if (
    updates.voting_opens_at &&
    updates.voting_closes_at &&
    new Date(updates.voting_closes_at as string).getTime() <= new Date(updates.voting_opens_at as string).getTime()
  ) {
    return NextResponse.json(
      { error: "INVALID_DATES", message: "Voting closing date/time must be after the opening date/time." },
      { status: 400 }
    );
  }

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await admin
      .from("events")
      .update(updates)
      .eq("id", ev.id);

    if (updErr) {
      if (updErr.code === "23505") {
        return NextResponse.json(
          { error: "DUPLICATE_CODE", message: "That event short code is already in use." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "UPDATE_FAILED", message: updErr.message }, { status: 500 });
    }
  }

  if (bannerUrl !== undefined || ticketFlyerUrl !== undefined) {
    const brandPatch: Record<string, unknown> = {
      event_id: ev.id,
      organization_id: ev.organization_id,
    };
    if (bannerUrl !== undefined) brandPatch.banner_public_id = bannerUrl.trim() || null;
    if (ticketFlyerUrl !== undefined) brandPatch.ticket_flyer_public_id = ticketFlyerUrl.trim() || null;

    const { error: brandErr } = await admin.from("branding_settings").upsert(
      brandPatch,
      { onConflict: "event_id" }
    );
    if (brandErr) {
      return NextResponse.json({ error: "BRANDING_FAILED", message: brandErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, eventId: ev.id });
}
