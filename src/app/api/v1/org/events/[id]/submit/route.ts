import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid event ID." }, { status: 400 });
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

  const { error: submitErr } = await admin.rpc("app_submit_event_for_approval", {
    p_actor: auth.user.id,
    p_event_id: ev.id,
    p_org_id: ev.organization_id,
  });

  if (submitErr) {
    const msg = submitErr.message;
    const status = msg.includes("NO_CATEGORIES") || msg.includes("NO_CONTESTANTS") ? 422 : 400;
    return NextResponse.json({ error: "SUBMIT_FAILED", message: msg }, { status });
  }

  return NextResponse.json({ ok: true });
}
