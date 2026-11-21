import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const VisibilitySchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  resultsState: z.enum(["hidden", "live", "final"]),
  liveVisibility: z.enum(["ranks_only", "counts", "percent"]),
  contestantResultsVisible: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid category ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = VisibilitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid visibility settings." },
      { status: 400 }
    );
  }

  const { organizationId, resultsState, liveVisibility, contestantResultsVisible } = parsed.data;
  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const updates: Record<string, unknown> = {
    results_state: resultsState,
    live_visibility: liveVisibility,
  };
  if (contestantResultsVisible !== undefined) {
    updates.contestant_results_visible = contestantResultsVisible;
  }

  const { data, error } = await admin
    .from("event_categories")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id, results_state, live_visibility, contestant_results_visible")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "UPDATE_FAILED", message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Category not found for this organization." }, { status: 404 });
  }

  return NextResponse.json({ category: data });
}
