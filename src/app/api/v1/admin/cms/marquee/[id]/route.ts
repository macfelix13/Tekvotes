import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const PatchMarqueeItemSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  subtitle: z.string().trim().max(120).optional(),
  badge: z.enum(["Event", "Sponsor", "Partner"]).optional(),
  logoUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  websiteUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid item ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchMarqueeItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid update." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) updates.name = d.name;
  if (d.subtitle !== undefined) updates.subtitle = d.subtitle;
  if (d.badge !== undefined) updates.badge = d.badge;
  if (d.logoUrl !== undefined) updates.logo_url = d.logoUrl.trim() || null;
  if (d.websiteUrl !== undefined) updates.website_url = d.websiteUrl.trim() || null;
  if (d.sortOrder !== undefined) updates.sort_order = d.sortOrder;
  if (d.active !== undefined) updates.active = d.active;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_marquee_items")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid item ID." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("platform_marquee_items").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "DELETE_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
