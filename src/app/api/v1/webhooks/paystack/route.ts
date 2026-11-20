import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { fulfillPaystackOrderByReference, verifyPaystackSignature } from "@/lib/paystack";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-paystack-signature");
  const rawBody = await req.text();

  try {
    if (!verifyPaystackSignature(rawBody, signature)) {
      return NextResponse.json({ error: "INVALID_PAYSTACK_SIGNATURE" }, { status: 401 });
    }
  } catch (err) {
    console.error("Webhook signature verification error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "WEBHOOK_CONFIG_ERROR" }, { status: 500 });
  }

  let payload: { event?: string; data?: { id?: string | number; reference?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "MALFORMED_WEBHOOK_BODY" }, { status: 400 });
  }

  const eventType = String(payload?.event || "unknown");
  const data = payload?.data;
  const rawBodySha256 = createHash("sha256").update(rawBody).digest("hex");
  const dedupeKey = `${eventType}:${data?.id ?? data?.reference ?? rawBodySha256}`;

  const supabase = createAdminClient();

  const { data: recRows, error: recErr } = await supabase.rpc("app_record_payment_webhook", {
    p_provider: "paystack",
    p_event_type: eventType,
    p_dedupe_key: dedupeKey,
    p_signature_valid: true,
    p_payload: payload,
    p_raw_body_sha256: rawBodySha256,
  });

  if (recErr) {
    console.error("Failed recording webhook:", recErr.message);
    return NextResponse.json({ error: "WEBHOOK_RECORD_FAILED" }, { status: 500 });
  }

  const record = Array.isArray(recRows) ? recRows[0] : recRows;
  if (record?.already_processed) {
    return NextResponse.json({ received: true, duplicate: true, event: eventType });
  }

  const webhookId = record?.webhook_id as string | undefined;

  try {
    if (eventType === "charge.success" && data?.reference) {
      const result = await fulfillPaystackOrderByReference(String(data.reference));
      if (webhookId) {
        await supabase.rpc("app_mark_webhook_status", {
          p_webhook_id: webhookId,
          p_status: result.found ? "done" : "ignored",
          p_error: result.found ? null : "ORDER_NOT_FOUND",
        });
      }
      return NextResponse.json({
        received: true,
        event: eventType,
        reference: data.reference,
        credited: result.found ? result.credited : false,
      });
    }

    if (webhookId) {
      await supabase.rpc("app_mark_webhook_status", {
        p_webhook_id: webhookId,
        p_status: "ignored",
        p_error: null,
      });
    }
    return NextResponse.json({ received: true, event: eventType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook processing failed";
    console.error("Paystack webhook fulfillment error:", msg);
    if (webhookId) {
      await supabase.rpc("app_mark_webhook_status", {
        p_webhook_id: webhookId,
        p_status: "error",
        p_error: msg,
      });
    }
    return NextResponse.json({ error: "WEBHOOK_PROCESSING_FAILED" }, { status: 500 });
  }
}
