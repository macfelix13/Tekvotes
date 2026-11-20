import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  computeAuditHash,
  fulfillPaystackOrderByReference,
  type ReceiptRecord,
} from "@/lib/paystack";

const REF_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const { reference } = await context.params;
  const cleaned = reference.trim();

  if (!REF_PATTERN.test(cleaned)) {
    return NextResponse.json(
      { error: "INVALID_REFERENCE", message: "Invalid receipt reference format." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: initialData, error: initErr } = await supabase.rpc("app_get_receipt_by_reference", {
    p_reference: cleaned,
  });

  if (initErr) {
    console.error("Receipt lookup error:", initErr.message);
    return NextResponse.json({ error: "LOOKUP_FAILED", message: "Failed to query receipt." }, { status: 500 });
  }

  let receipt = initialData as ReceiptRecord | null;
  if (!receipt) {
    return NextResponse.json(
      { error: "RECEIPT_NOT_FOUND", message: "No voting order found for that reference." },
      { status: 404 }
    );
  }

  // If the order is still awaiting webhook/verification, verify authoritatively with Paystack
  if (receipt.status === "pending" || receipt.status === "payment_initiated") {
    try {
      await fulfillPaystackOrderByReference(receipt.reference);
      const { data: refreshed } = await supabase.rpc("app_get_receipt_by_reference", {
        p_reference: receipt.reference,
      });
      if (refreshed) {
        receipt = refreshed as ReceiptRecord;
      }
    } catch (err) {
      // Transient Paystack error or amount mismatch — keep returning current DB state safely
      console.warn("Paystack verify on receipt lookup:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    receipt: {
      ...receipt,
      auditHash: computeAuditHash(receipt),
    },
  });
}
