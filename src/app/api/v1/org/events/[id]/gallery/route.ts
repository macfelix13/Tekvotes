import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const CreateGallerySchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  imageUrl: z
    .string()
    .trim()
    .url("Image URL must be valid")
    .refine((u) => u.startsWith("https://"), "Image URL must use HTTPS"),
  caption: z.string().trim().max(240).optional().or(z.literal("")),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid event ID." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("event_gallery_media")
    .select("id, event_id, organization_id, image_url, caption, sort_order, created_at")
    .eq("event_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "LOAD_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid event ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateGallerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid gallery photo." },
      { status: 400 }
    );
  }

  const { organizationId, imageUrl, caption } = parsed.data;
  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("events")
    .select("id, organization_id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!ev) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Event not found." }, { status: 404 });
  }

  const { data, error } = await admin
    .from("event_gallery_media")
    .insert({
      event_id: id,
      organization_id: organizationId,
      image_url: imageUrl,
      caption: caption?.trim() || "",
      created_by: auth.user.id,
    })
    .select("id, event_id, organization_id, image_url, caption, sort_order, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "CREATE_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const mediaId = req.nextUrl.searchParams.get("mediaId") ?? "";
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(mediaId).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Valid event and media ID required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("event_gallery_media")
    .select("id, organization_id")
    .eq("id", mediaId)
    .eq("event_id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Gallery image not found." }, { status: 404 });
  }

  const auth = await requireApiOrgMember(existing.organization_id as string);
  if (!auth.ok) return auth.response;

  const { error } = await admin
    .from("event_gallery_media")
    .delete()
    .eq("id", mediaId)
    .eq("event_id", id);

  if (error) {
    return NextResponse.json({ error: "DELETE_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
