import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const ActionSchema = z.object({
  action: z.enum(["approve", "revoke", "open_voting", "pause", "resume", "close", "release_funds", "set_commission"]),
  reason: z.string().trim().optional(),
  commissionPct: z.number().min(0).max(50).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid event ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid action payload." },
      { status: 400 }
    );
  }

  const { action, reason, commissionPct } = parsed.data;
  const admin = createAdminClient();

  const { data: ev, error: evErr } = await admin
    .from("events")
    .select("id, organization_id, approval_status, voting_status")
    .eq("id", id)
    .maybeSingle();

  if (evErr || !ev) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Event not found." }, { status: 404 });
  }

  if (action === "set_commission") {
    if (ev.voting_status !== "not_started") {
      return NextResponse.json(
        { error: "COMMISSION_LOCKED", message: "Commission percentage can only be changed before voting starts." },
        { status: 409 }
      );
    }
    if (commissionPct === undefined || !Number.isFinite(commissionPct)) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Provide a valid commission percentage (0% to 50%)." },
        { status: 400 }
      );
    }
    const bps = Math.round(commissionPct * 100);
    const { error: commErr } = await admin
      .from("events")
      .update({ commission_bps: bps })
      .eq("id", id);
    if (commErr) return NextResponse.json({ error: "ACTION_FAILED", message: commErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, action, commissionBps: bps });
  }

  if (action === "approve") {
    if (commissionPct !== undefined) {
      if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 50) {
        return NextResponse.json(
          { error: "VALIDATION_ERROR", message: "Commission percentage must be between 0% and 50%." },
          { status: 400 }
        );
      }
      if (ev.voting_status === "not_started") {
        const bps = Math.round(commissionPct * 100);
        const { error: commErr } = await admin
          .from("events")
          .update({ commission_bps: bps })
          .eq("id", id);
        if (commErr) return NextResponse.json({ error: "ACTION_FAILED", message: commErr.message }, { status: 400 });
      }
    }
    const { error } = await admin.rpc("app_review_event_approval", {
      p_reviewer: auth.user.id,
      p_event_id: id,
      p_decision: "approved",
      p_reason: reason || null,
    });
    if (error) return NextResponse.json({ error: "ACTION_FAILED", message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, action });
  }

  if (action === "revoke") {
    const cleanReason = reason || "Approval revoked by Super Admin";
    const { error } = await admin.rpc("app_review_event_approval", {
      p_reviewer: auth.user.id,
      p_event_id: id,
      p_decision: "revoked",
      p_reason: cleanReason,
    });
    if (error) return NextResponse.json({ error: "ACTION_FAILED", message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, action });
  }

  if (action === "open_voting") {
    if (ev.approval_status !== "approved") {
      return NextResponse.json(
        { error: "NOT_APPROVED", message: "Event must be approved before voting can start." },
        { status: 409 }
      );
    }
    if (ev.voting_status !== "not_started") {
      return NextResponse.json(
        { error: "INVALID_STATE", message: "Voting can only be opened from not_started status." },
        { status: 409 }
      );
    }
    const { error: updErr } = await admin
      .from("events")
      .update({ voting_status: "active", publication_status: "published" })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: "ACTION_FAILED", message: updErr.message }, { status: 400 });

    await admin.from("event_status_history").insert({
      event_id: id,
      organization_id: ev.organization_id,
      dimension: "voting",
      from_status: ev.voting_status,
      to_status: "active",
      reason: reason || "Super Admin opened voting",
      actor_id: auth.user.id,
    });
    return NextResponse.json({ ok: true, action });
  }

  if (action === "pause") {
    const cleanReason = reason || "Paused by Super Admin";
    const { error } = await admin.rpc("app_pause_event_voting", {
      p_actor: auth.user.id,
      p_event_id: id,
      p_org_id: ev.organization_id,
      p_reason: cleanReason,
    });
    if (error) return NextResponse.json({ error: "ACTION_FAILED", message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, action });
  }

  if (action === "resume") {
    const cleanReason = reason || "Resumed by Super Admin";
    const { error } = await admin.rpc("app_resume_event_voting", {
      p_actor: auth.user.id,
      p_event_id: id,
      p_org_id: ev.organization_id,
      p_reason: cleanReason,
    });
    if (error) return NextResponse.json({ error: "ACTION_FAILED", message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, action });
  }

  if (action === "close") {
    if (ev.voting_status !== "active" && ev.voting_status !== "paused") {
      return NextResponse.json(
        { error: "INVALID_STATE", message: "Only active or paused voting can be closed." },
        { status: 409 }
      );
    }
    const { error: updErr } = await admin
      .from("events")
      .update({ voting_status: "closed" })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: "ACTION_FAILED", message: updErr.message }, { status: 400 });

    await admin.from("event_status_history").insert({
      event_id: id,
      organization_id: ev.organization_id,
      dimension: "voting",
      from_status: ev.voting_status,
      to_status: "closed",
      reason: reason || "Event voting closed by Super Admin",
      actor_id: auth.user.id,
    });
    return NextResponse.json({ ok: true, action });
  }

  // release_funds
  const { data: releasedMinor, error: relErr } = await admin.rpc("app_release_closed_event_funds", {
    p_event_id: id,
    p_actor: auth.user.id,
  });
  if (relErr) {
    return NextResponse.json({ error: "RELEASE_FAILED", message: relErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, action, releasedMinor: Number(releasedMinor ?? 0) });
}
