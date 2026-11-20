import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  slug: z.string().trim().optional(),
  reason: z.string().trim().optional(),
});

function buildSlug(orgName: string, appId: string): string {
  const base = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  const suffix = appId.slice(0, 4).toLowerCase();
  const raw = base.length >= 2 ? `${base}-${suffix}` : `org-${suffix}`;
  return raw.replace(/^-+|-+$/g, "");
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid application ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid decision payload." },
      { status: 400 }
    );
  }

  const { decision, slug, reason } = parsed.data;
  const admin = createAdminClient();

  if (decision === "reject") {
    if (!reason || reason.length < 3) {
      return NextResponse.json(
        { error: "REASON_REQUIRED", message: "Please provide a reason for rejecting this application." },
        { status: 400 }
      );
    }

    const { error } = await admin.rpc("app_reject_org_application", {
      p_app: id,
      p_reviewer: auth.user.id,
      p_reason: reason,
    });
    if (error) {
      return NextResponse.json({ error: "REJECT_FAILED", message: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, decision: "rejected" });
  }

  const { data: appRow, error: fetchErr } = await admin
    .from("organization_applications")
    .select("id, org_name, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !appRow) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Application not found." }, { status: 404 });
  }

  const candidateSlug = (slug || buildSlug(appRow.org_name, appRow.id)).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(candidateSlug)) {
    return NextResponse.json(
      { error: "INVALID_SLUG", message: "Slug must be 3–40 lowercase letters, numbers, or hyphens." },
      { status: 400 }
    );
  }

  const { data: orgId, error: approveErr } = await admin.rpc("app_approve_org_application", {
    p_app: id,
    p_reviewer: auth.user.id,
    p_slug: candidateSlug,
  });

  if (approveErr) {
    const status = approveErr.message.includes("APPLICATION_NOT_PENDING") ? 409 : 400;
    return NextResponse.json({ error: "APPROVE_FAILED", message: approveErr.message }, { status });
  }

  return NextResponse.json({ ok: true, decision: "approved", organizationId: orgId, slug: candidateSlug });
}
