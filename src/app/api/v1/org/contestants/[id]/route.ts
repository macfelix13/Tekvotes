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

const PatchContestantSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  displayName: z.string().trim().min(2, "Contestant name is too short").max(120).optional(),
  publicCode: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Short code can only contain letters, numbers, hyphens, or underscores")
    .optional(),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  gender: z.string().trim().max(40).optional().or(z.literal("")),
  photoUrl: z
    .string()
    .trim()
    .url("Photo URL must be valid")
    .refine((u) => u.startsWith("https://"), "Photo URL must use HTTPS")
    .optional()
    .or(z.literal("")),
  status: z.enum(["active", "suspended"]).optional(),
  instagramUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  facebookUrl: optionalUrl,
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid contestant ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchContestantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid contestant update." },
      { status: 400 }
    );
  }

  const {
    organizationId,
    categoryId,
    displayName,
    publicCode,
    bio,
    gender,
    photoUrl,
    status,
    instagramUrl,
    tiktokUrl,
    facebookUrl,
  } = parsed.data;

  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: existing, error: fetchErr } = await admin
    .from("contestants")
    .select("id, profile_public_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Contestant not found in this organization." },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (displayName !== undefined) updates.display_name = displayName;
  if (bio !== undefined) updates.bio = bio.trim() || null;
  if (gender !== undefined) updates.gender = gender.trim() || null;
  if (photoUrl !== undefined) updates.profile_public_id = photoUrl.trim() || null;
  if (status !== undefined) updates.status = status;

  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await admin
      .from("contestants")
      .update(updates)
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (updErr) {
      return NextResponse.json({ error: "UPDATE_FAILED", message: updErr.message }, { status: 500 });
    }
  }

  if (bio !== undefined || publicCode !== undefined) {
    const entryUpdates: Record<string, unknown> = {};
    if (bio !== undefined) entryUpdates.event_bio = bio.trim() || null;
    if (publicCode !== undefined) entryUpdates.public_code = publicCode.toUpperCase();

    const { error: entryErr } = await admin
      .from("contestant_entries")
      .update(entryUpdates)
      .eq("contestant_id", id)
      .eq("organization_id", organizationId);

    if (entryErr) {
      if (entryErr.code === "23505") {
        return NextResponse.json(
          { error: "DUPLICATE_SHORT_CODE", message: "That contestant short code is already in use." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "ENTRY_UPDATE_FAILED", message: entryErr.message }, { status: 500 });
    }
  }

  if (status !== undefined || categoryId !== undefined) {
    const { data: entryRows } = await admin
      .from("contestant_entries")
      .select("id, event_id")
      .eq("contestant_id", id)
      .eq("organization_id", organizationId);

    const entryIds = (entryRows ?? []).map((r) => r.id as string);

    if (status !== undefined) {
      await admin
        .from("contestant_entries")
        .update({ status: status === "active" ? "approved" : "withdrawn" })
        .eq("contestant_id", id)
        .eq("organization_id", organizationId);

      if (entryIds.length > 0) {
        await admin
          .from("category_entries")
          .update({ status: status === "active" ? "active" : "withdrawn" })
          .in("entry_id", entryIds)
          .eq("organization_id", organizationId);
      }
    }

    if (categoryId !== undefined && entryIds.length > 0) {
      const { data: targetCat } = await admin
        .from("event_categories")
        .select("id, event_id")
        .eq("id", categoryId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (targetCat) {
        const matchingEntryIds = (entryRows ?? [])
          .filter((r) => r.event_id === targetCat.event_id)
          .map((r) => r.id as string);

        if (matchingEntryIds.length > 0) {
          await admin
            .from("category_entries")
            .update({ category_id: targetCat.id })
            .in("entry_id", matchingEntryIds)
            .eq("organization_id", organizationId);
        }
      }
    }
  }

  const nextPhoto = photoUrl?.trim() || null;
  if (photoUrl !== undefined && nextPhoto && nextPhoto !== existing.profile_public_id) {
    await admin.from("contestant_media").insert({
      contestant_id: id,
      organization_id: organizationId,
      kind: "image",
      cloudinary_public_id: nextPhoto,
      sort_order: 0,
      moderation_status: "approved",
    });
  }

  const socialUpdates: Array<{ platform: "instagram" | "tiktok" | "facebook"; url: string | undefined }> = [];
  if (instagramUrl !== undefined) socialUpdates.push({ platform: "instagram", url: instagramUrl.trim() });
  if (tiktokUrl !== undefined) socialUpdates.push({ platform: "tiktok", url: tiktokUrl.trim() });
  if (facebookUrl !== undefined) socialUpdates.push({ platform: "facebook", url: facebookUrl.trim() });

  if (socialUpdates.length > 0) {
    const platforms = socialUpdates.map((s) => s.platform);
    await admin
      .from("contestant_social_links")
      .delete()
      .eq("contestant_id", id)
      .eq("organization_id", organizationId)
      .in("platform", platforms);

    const inserts = socialUpdates
      .filter((s): s is { platform: "instagram" | "tiktok" | "facebook"; url: string } => Boolean(s.url))
      .map((s, idx) => ({
        contestant_id: id,
        organization_id: organizationId,
        platform: s.platform,
        url: s.url,
        sort_order: idx,
      }));

    if (inserts.length > 0) {
      await admin.from("contestant_social_links").insert(inserts);
    }
  }

  const { data: updated } = await admin
    .from("contestants")
    .select("id, display_name, bio, gender, profile_public_id, status")
    .eq("id", id)
    .single();

  return NextResponse.json({ contestant: updated });
}
