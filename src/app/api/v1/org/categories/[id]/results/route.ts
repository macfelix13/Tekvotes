import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid category ID." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: cat } = await admin
    .from("event_categories")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!cat) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Category not found." }, { status: 404 });
  }

  const auth = await requireApiOrgMember(cat.organization_id);
  if (!auth.ok) return auth.response;

  const supabase = await createClient();
  const { data: calculationId, error: calcErr } = await supabase.rpc("app_calculate_category_results", {
    p_category_id: cat.id,
  });

  if (calcErr || !calculationId) {
    const msg = calcErr?.message || "Could not calculate category results.";
    const status = msg.includes("MISSING_JUDGE_SCORES") ? 409 : 400;
    return NextResponse.json({ error: "CALCULATION_FAILED", message: msg }, { status });
  }

  const { data: publicationId, error: pubErr } = await supabase.rpc("app_publish_category_results", {
    p_calculation_id: calculationId,
  });

  if (pubErr || !publicationId) {
    return NextResponse.json(
      { error: "PUBLICATION_FAILED", message: pubErr?.message || "Calculated results but failed to publish." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, calculationId, publicationId }, { status: 201 });
}
