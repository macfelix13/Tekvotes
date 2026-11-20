import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const RequestSettlementSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  amountGhs: z.number().positive("Amount must be greater than zero").max(1000000),
  destinationType: z.enum(["mobile_money", "bank"]),
  provider: z.string().trim().min(2, "Enter MoMo network or Bank name").max(60),
  accountNumber: z.string().trim().min(6, "Enter a valid account or MoMo number").max(40),
  accountName: z.string().trim().min(2, "Enter account holder name").max(120),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSettlementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid payout request." },
      { status: 400 }
    );
  }

  const { organizationId, amountGhs, destinationType, provider, accountNumber, accountName } = parsed.data;
  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const amountMinor = Math.round(amountGhs * 100);
  if (amountMinor <= 0) {
    return NextResponse.json({ error: "INVALID_AMOUNT", message: "Amount must be at least 0.01." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: requestId, error } = await admin.rpc("app_request_settlement", {
    p_org_id: organizationId,
    p_actor: auth.user.id,
    p_amount_minor: amountMinor,
    p_dest_type: destinationType,
    p_provider: provider,
    p_account_number: accountNumber,
    p_account_name: accountName,
  });

  if (error) {
    const msg = error.message || "Could not submit payout request.";
    const status = msg.includes("INSUFFICIENT_AVAILABLE_BALANCE") ? 409 : 400;
    return NextResponse.json({ error: "SETTLEMENT_REQUEST_FAILED", message: msg }, { status });
  }

  return NextResponse.json({ ok: true, requestId }, { status: 201 });
}
