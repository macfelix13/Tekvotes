import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const CreateMarqueeItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  subtitle: z.string().trim().max(120).optional().or(z.literal("")),
  badge: z.enum(["Event", "Sponsor", "Partner"]).default("Partner"),
  logoUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  websiteUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(9999).default(50),
  active: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = CreateMarqueeItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid marquee item." },
      { status: 400 }
    );
  }

  const { name, subtitle, badge, logoUrl, websiteUrl, sortOrder, active } = parsed.data;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("platform_marquee_items")
    .insert({
      name,
      subtitle: subtitle?.trim() || "",
      badge,
      logo_url: logoUrl?.trim() || null,
      website_url: websiteUrl?.trim() || null,
      sort_order: sortOrder,
      active,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "CREATE_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
