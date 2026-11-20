import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const CreateCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 characters").max(100),
  unitPriceGhs: z.number().positive("Price per vote must be greater than zero").max(10000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid event ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid category details." },
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

  const auth = await requireApiOrgMember(ev.organization_id);
  if (!auth.ok) return auth.response;

  const { name, unitPriceGhs } = parsed.data;
  const unitPriceMinor = Math.round(unitPriceGhs * 100);
  if (unitPriceMinor <= 0) {
    return NextResponse.json({ error: "INVALID_PRICE", message: "Price per vote must be at least GHS 0.01." }, { status: 400 });
  }

  const baseSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "category";

  const { count } = await admin
    .from("event_categories")
    .select("id", { count: "exact", head: true })
    .eq("event_id", ev.id);

  const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: category, error: catErr } = await admin
    .from("event_categories")
    .insert({
      event_id: ev.id,
      organization_id: ev.organization_id,
      name,
      slug: uniqueSlug,
      sort_order: Number(count ?? 0),
      results_state: "live",
      live_visibility: "counts",
      voting_enabled: true,
      unit_price_minor: unitPriceMinor,
    })
    .select("id, name, slug, unit_price_minor")
    .single();

  if (catErr || !category) {
    return NextResponse.json(
      { error: "CREATE_CATEGORY_FAILED", message: catErr?.message || "Could not create category." },
      { status: 500 }
    );
  }

  const defaultPackages = [10, 50, 100].map((votes, idx) => ({
    category_id: category.id,
    event_id: ev.id,
    organization_id: ev.organization_id,
    label: `${votes} votes`,
    votes,
    price_minor: votes * unitPriceMinor,
    sort_order: idx,
  }));

  await admin.from("vote_packages").insert(defaultPackages);

  return NextResponse.json({ category }, { status: 201 });
}
