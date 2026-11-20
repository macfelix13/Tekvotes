import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const CriteriaItemSchema = z.object({
  name: z.string().trim().min(2).max(100),
  weightBps: z.number().int().min(100).max(10000),
  minScore: z.number().min(0).max(100).default(0),
  maxScore: z.number().min(1).max(1000).default(10),
  step: z.number().positive().max(100).default(0.5),
});

const JudgingActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setup_criteria"),
    criteria: z.array(CriteriaItemSchema).min(1).max(12),
  }),
  z.object({
    action: z.literal("assign_judge"),
    email: z.string().email("Enter a valid judge email"),
    displayName: z.string().trim().min(2).max(120).optional(),
    password: z.string().min(8).optional(),
  }),
  z.object({
    action: z.literal("revoke_judge"),
    assignmentId: z.string().uuid("Invalid assignment ID"),
  }),
]);

export async function GET(
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
    .select("id, event_id, organization_id, name, results_state")
    .eq("id", id)
    .maybeSingle();

  if (!cat) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Category not found." }, { status: 404 });
  }

  const auth = await requireApiOrgMember(cat.organization_id);
  if (!auth.ok) return auth.response;

  const [{ data: criteria }, { data: assignments }, { data: entries }, { data: pub }] = await Promise.all([
    admin
      .from("judging_criteria")
      .select("id, name, weight_bps, min_score, max_score, step, sort_order")
      .eq("category_id", id)
      .order("sort_order", { ascending: true }),
    admin
      .from("judging_assignments")
      .select("id, judge_id, revoked_at, created_at, judges(id, user_id, display_name)")
      .eq("category_id", id)
      .is("revoked_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("category_entries")
      .select("id")
      .eq("category_id", id)
      .eq("status", "active"),
    admin
      .from("result_publications")
      .select("id, published_at, state")
      .eq("category_id", id)
      .eq("state", "final")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } =
    assignmentIds.length > 0
      ? await admin
          .from("judging_submissions")
          .select("id, assignment_id, category_entry_id, status")
          .in("assignment_id", assignmentIds)
          .eq("status", "submitted")
      : { data: [] };

  return NextResponse.json({
    category: cat,
    criteria: criteria ?? [],
    assignments: assignments ?? [],
    activeEntryCount: (entries ?? []).length,
    submittedBallotsCount: (submissions ?? []).length,
    latestPublication: pub ?? null,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid category ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = JudgingActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid judging payload." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: cat } = await admin
    .from("event_categories")
    .select("id, event_id, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (!cat) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Category not found." }, { status: 404 });
  }

  const auth = await requireApiOrgMember(cat.organization_id);
  if (!auth.ok) return auth.response;

  const payload = parsed.data;

  if (payload.action === "setup_criteria") {
    const totalBps = payload.criteria.reduce((sum, c) => sum + c.weightBps, 0);
    if (totalBps !== 10000) {
      return NextResponse.json(
        { error: "WEIGHT_MISMATCH", message: `Criteria weights must sum to 100% (10,000 bps). Currently ${totalBps} bps.` },
        { status: 400 }
      );
    }

    const { count: existingSubs } = await admin
      .from("judging_criteria")
      .select("id", { count: "exact", head: true })
      .eq("category_id", cat.id);

    if ((existingSubs ?? 0) > 0) {
      const { error: delErr } = await admin
        .from("judging_criteria")
        .delete()
        .eq("category_id", cat.id);
      if (delErr) {
        return NextResponse.json(
          {
            error: "CRITERIA_IN_USE",
            message: "Cannot replace criteria after judges have already submitted scores.",
          },
          { status: 409 }
        );
      }
    }

    const rows = payload.criteria.map((c, idx) => ({
      category_id: cat.id,
      event_id: cat.event_id,
      organization_id: cat.organization_id,
      name: c.name,
      weight_bps: c.weightBps,
      min_score: c.minScore,
      max_score: c.maxScore,
      step: c.step,
      required: true,
      sort_order: idx,
    }));

    const { data: inserted, error: insErr } = await admin
      .from("judging_criteria")
      .insert(rows)
      .select("id, name, weight_bps, min_score, max_score, step, sort_order");

    if (insErr) {
      return NextResponse.json({ error: "CRITERIA_FAILED", message: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, criteria: inserted }, { status: 201 });
  }

  if (payload.action === "assign_judge") {
    const email = payload.email.trim().toLowerCase();
    const displayName = payload.displayName?.trim() || email.split("@")[0];

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("email", email)
      .maybeSingle();

    let judgeUserId = existingProfile?.id as string | undefined;
    let accountCreated = false;

    if (!judgeUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: payload.password || randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { full_name: displayName },
      });

      if (created?.user?.id) {
        judgeUserId = created.user.id;
        accountCreated = true;
      } else {
        const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const matched = listData?.users?.find((u) => u.email?.toLowerCase() === email);
        if (!matched) {
          return NextResponse.json(
            { error: "USER_PROVISION_FAILED", message: createErr?.message || "Could not provision judge user." },
            { status: 500 }
          );
        }
        judgeUserId = matched.id;
      }

      await admin.from("profiles").upsert(
        { id: judgeUserId, display_name: displayName, email },
        { onConflict: "id" }
      );
    }

    const { data: existingJudge } = await admin
      .from("judges")
      .select("id")
      .eq("user_id", judgeUserId)
      .eq("organization_id", cat.organization_id)
      .maybeSingle();

    let judgeId = existingJudge?.id as string | undefined;
    if (!judgeId) {
      const { data: newJudge, error: jErr } = await admin
        .from("judges")
        .insert({
          user_id: judgeUserId,
          organization_id: cat.organization_id,
          display_name: existingProfile?.display_name || displayName,
        })
        .select("id")
        .single();
      if (jErr || !newJudge) {
        return NextResponse.json(
          { error: "JUDGE_CREATE_FAILED", message: jErr?.message || "Could not create judge record." },
          { status: 500 }
        );
      }
      judgeId = newJudge.id;
    }

    const { data: existingAssign } = await admin
      .from("judging_assignments")
      .select("id")
      .eq("judge_id", judgeId)
      .eq("category_id", cat.id)
      .maybeSingle();

    let assignmentId = existingAssign?.id as string | undefined;
    if (assignmentId) {
      await admin
        .from("judging_assignments")
        .update({ revoked_at: null, assigned_by: auth.user.id })
        .eq("id", assignmentId);
    } else {
      const { data: insertedAssign, error: aErr } = await admin
        .from("judging_assignments")
        .insert({
          judge_id: judgeId,
          event_id: cat.event_id,
          category_id: cat.id,
          organization_id: cat.organization_id,
          assigned_by: auth.user.id,
        })
        .select("id")
        .single();
      if (aErr || !insertedAssign) {
        return NextResponse.json(
          { error: "ASSIGN_FAILED", message: aErr?.message || "Could not assign judge to category." },
          { status: 500 }
        );
      }
      assignmentId = insertedAssign.id;
    }

    return NextResponse.json({
      ok: true,
      assignmentId,
      judgeId,
      email,
      accountCreated,
    });
  }

  // revoke_judge
  const { error: revErr } = await admin
    .from("judging_assignments")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", payload.assignmentId)
    .eq("category_id", cat.id);

  if (revErr) {
    return NextResponse.json({ error: "REVOKE_FAILED", message: revErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
