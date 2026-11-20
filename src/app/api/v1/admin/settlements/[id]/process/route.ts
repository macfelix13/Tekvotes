import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const ProcessSettlementSchema = z.object({
  action: z.enum(["complete", "reject"]),
  transferRef: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Invalid settlement request ID." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ProcessSettlementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid payload." },
      { status: 400 }
    );
  }

  const { action, transferRef, comment } = parsed.data;
  const admin = createAdminClient();

  const { data: settlementId, error } = await admin.rpc("app_process_settlement_payout", {
    p_request_id: id,
    p_actor: auth.user.id,
    p_action: action,
    p_transfer_ref: transferRef || null,
    p_comment: comment || null,
  });

  if (error) {
    return NextResponse.json(
      { error: "SETTLEMENT_PROCESS_FAILED", message: error.message || "Could not process payout request." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, action, settlementId });
}
