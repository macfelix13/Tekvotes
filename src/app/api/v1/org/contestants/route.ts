import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL starting with https://")
  .refine((u) => u.startsWith("https://") || u.startsWith("http://"), "URL must start with http(s)://")
  .optional()
  .or(z.literal(""));

const CreateContestantSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  eventId: z.string().uuid("Invalid event ID"),
  categoryId: z.string().uuid("Invalid category ID"),
  displayName: z.string().trim().min(2, "Contestant name is too short").max(120),
  publicCode: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Short code can only contain letters, numbers, hyphens, or underscores"),
  gender: z.string().trim().max(40).optional().or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  photoUrl: z
    .string()
    .trim()
    .url("Photo URL must be valid")
    .refine((u) => u.startsWith("https://"), "Photo URL must use HTTPS")
    .optional()
    .or(z.literal("")),
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  facebookUrl: optionalUrl,
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateContestantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid contestant details." },
      { status: 400 }
    );
  }

  const {
    organizationId,
    eventId,
    categoryId,
    displayName,
    publicCode,
    gender,
    bio,
    photoUrl,
    instagramUrl,
    tiktokUrl,
    facebookUrl,
  } = parsed.data;

  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: cat, error: catErr } = await admin
    .from("event_categories")
    .select("id")
    .eq("id", categoryId)
    .eq("event_id", eventId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (catErr || !cat) {
    return NextResponse.json(
      { error: "CATEGORY_NOT_FOUND", message: "Selected category does not belong to this event." },
      { status: 404 }
    );
  }

  const { data: maxRow } = await admin
    .from("contestant_entries")
    .select("contestant_number")
    .eq("event_id", eventId)
    .order("contestant_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNum = Number(maxRow?.contestant_number ?? 0) + 1;
  const normalizedCode = publicCode.toUpperCase();
  const cleanPhoto = photoUrl?.trim() || null;
  const cleanBio = bio?.trim() || null;
  const cleanGender = gender?.trim() || null;

  const { data: contestant, error: cErr } = await admin
    .from("contestants")
    .insert({
      organization_id: organizationId,
      display_name: displayName,
      gender: cleanGender,
      bio: cleanBio,
      profile_public_id: cleanPhoto,
      created_by: auth.user.id,
    })
    .select("id, display_name, bio, gender, profile_public_id")
    .single();

  if (cErr || !contestant) {
    return NextResponse.json(
      { error: "CONTESTANT_CREATE_FAILED", message: cErr?.message || "Could not create contestant." },
      { status: 500 }
    );
  }

  const { data: entry, error: entErr } = await admin
    .from("contestant_entries")
    .insert({
      event_id: eventId,
      organization_id: organizationId,
      contestant_id: contestant.id,
      contestant_number: nextNum,
      public_code: normalizedCode,
      event_bio: cleanBio,
      status: "approved",
      registered_by: auth.user.id,
    })
    .select("id, public_code, contestant_number")
    .single();

  if (entErr || !entry) {
    await admin.from("contestants").delete().eq("id", contestant.id);
    if (entErr?.code === "23505") {
      return NextResponse.json(
        { error: "DUPLICATE_SHORT_CODE", message: "That contestant short code is already in use." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "ENTRY_CREATE_FAILED", message: entErr?.message || "Could not register contestant entry." },
      { status: 500 }
    );
  }

  const { data: catEntry, error: ceErr } = await admin
    .from("category_entries")
    .insert({
      event_id: eventId,
      organization_id: organizationId,
      category_id: categoryId,
      entry_id: entry.id,
      status: "active",
      display_order: nextNum - 1,
    })
    .select("id")
    .single();

  if (ceErr || !catEntry) {
    return NextResponse.json(
      { error: "CATEGORY_ENTRY_FAILED", message: ceErr?.message || "Could not assign contestant to category." },
      { status: 500 }
    );
  }

  if (cleanPhoto) {
    await admin.from("contestant_media").insert({
      contestant_id: contestant.id,
      organization_id: organizationId,
      entry_id: entry.id,
      kind: "image",
      cloudinary_public_id: cleanPhoto,
      sort_order: 0,
      moderation_status: "approved",
    });
  }

  const socials = [
    { platform: "instagram", url: instagramUrl?.trim() },
    { platform: "tiktok", url: tiktokUrl?.trim() },
    { platform: "facebook", url: facebookUrl?.trim() },
  ]
    .filter((s): s is { platform: string; url: string } => Boolean(s.url))
    .map((s, idx) => ({
      contestant_id: contestant.id,
      organization_id: organizationId,
      platform: s.platform,
      url: s.url,
      sort_order: idx,
    }));

  if (socials.length > 0) {
    await admin.from("contestant_social_links").insert(socials);
  }

  return NextResponse.json({ contestant, entry, categoryEntry: catEntry }, { status: 201 });
}
