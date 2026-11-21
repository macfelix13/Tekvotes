import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { initializePaystackTransaction } from "@/lib/paystack";

const CreateTicketOrderSchema = z.object({
  tierId: z.string().uuid("Invalid ticket tier ID"),
  quantity: z.number().int().min(1).max(20),
  buyerName: z.string().trim().min(2, "Enter your full name").max(120),
  buyerPhone: z.string().min(9, "Enter a valid mobile number").max(20),
  buyerEmail: z.string().email("Enter a valid email address").optional().or(z.literal("")),
});

function normalizeGhanaPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s()-]/g, "");
  if (/^\+[1-9][0-9]{7,14}$/.test(cleaned)) return cleaned;
  if (/^0[0-9]{9}$/.test(cleaned)) return `+233${cleaned.slice(1)}`;
  if (/^233[0-9]{9}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}

function resolveOrigin(req: NextRequest): string {
  const fwdHost = req.headers.get("x-forwarded-host");
  const fwdProto = req.headers.get("x-forwarded-proto");
  if (fwdHost) return `${fwdProto || "https"}://${fwdHost}`;
  const host = req.headers.get("host");
  if (host) return `${req.nextUrl.protocol.replace(":", "") || "https"}://${host}`;
  return req.nextUrl.origin;
}

function generateTicketOrderRef(): string {
  const now = new Date();
  const y = String(now.getUTCFullYear()).slice(-2);
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `TT-${y}${m}${d}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = CreateTicketOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid ticket order." },
        { status: 400 }
      );
    }

    const { tierId, quantity, buyerName, buyerPhone, buyerEmail } = parsed.data;
    const phoneE164 = normalizeGhanaPhone(buyerPhone);
    if (!phoneE164) {
      return NextResponse.json(
        { error: "INVALID_PHONE", message: "Please enter a valid 10-digit Ghanaian mobile number (e.g. 0241234567)." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: tier, error: tierErr } = await admin
      .from("event_ticket_tiers")
      .select("id, event_id, organization_id, name, price_minor, currency, capacity, sold_count, max_per_order, active")
      .eq("id", tierId)
      .maybeSingle();

    if (tierErr || !tier || !tier.active) {
      return NextResponse.json({ error: "TIER_NOT_FOUND", message: "This ticket tier is unavailable." }, { status: 404 });
    }

    if (quantity > Number(tier.max_per_order ?? 10)) {
      return NextResponse.json(
        { error: "MAX_PER_ORDER", message: `Maximum ${tier.max_per_order} tickets allowed per order.` },
        { status: 400 }
      );
    }

    if (tier.capacity != null && Number(tier.sold_count) + quantity > Number(tier.capacity)) {
      const remaining = Math.max(0, Number(tier.capacity) - Number(tier.sold_count));
      return NextResponse.json(
        { error: "SOLD_OUT", message: remaining === 0 ? "This ticket tier is sold out." : `Only ${remaining} ticket(s) remaining.` },
        { status: 409 }
      );
    }

    const { data: ev } = await admin
      .from("events")
      .select("id, name, approval_status, publication_status, commission_bps")
      .eq("id", tier.event_id)
      .maybeSingle();

    if (!ev || ev.publication_status !== "published" || ev.approval_status === "rejected" || ev.approval_status === "revoked") {
      return NextResponse.json({ error: "EVENT_UNAVAILABLE", message: "Event is not accepting ticket orders." }, { status: 409 });
    }

    const unitPriceMinor = Number(tier.price_minor);
    const baseAmountMinor = unitPriceMinor * quantity;
    const surchargeMinor = Math.floor((baseAmountMinor * 195 + 5000) / 10000);
    const totalAmountMinor = baseAmountMinor + surchargeMinor;
    const reference = generateTicketOrderRef();
    const cleanEmail = buyerEmail?.trim() || null;

    const { data: order, error: insErr } = await admin
      .from("ticket_orders")
      .insert({
        reference,
        organization_id: tier.organization_id,
        event_id: tier.event_id,
        tier_id: tier.id,
        buyer_name: buyerName,
        buyer_phone_e164: phoneE164,
        buyer_email: cleanEmail,
        quantity,
        unit_price_minor: unitPriceMinor,
        base_amount_minor: baseAmountMinor,
        surcharge_minor: surchargeMinor,
        total_amount_minor: totalAmountMinor,
        currency: tier.currency || "GHS",
        commission_bps: Number(ev.commission_bps ?? 1000),
        status: "payment_initiated",
      })
      .select("id, reference, total_amount_minor, currency")
      .single();

    if (insErr || !order) {
      return NextResponse.json({ error: "ORDER_FAILED", message: insErr?.message || "Could not create ticket order." }, { status: 500 });
    }

    const origin = resolveOrigin(req);
    const callbackUrl = `${origin}/verify?ref=${encodeURIComponent(order.reference)}`;
    const paystackEmail = cleanEmail || `ticket-${phoneE164.replace(/\D/g, "")}@voters.tekvotes.app`;

    let paystackInit;
    try {
      paystackInit = await initializePaystackTransaction({
        email: paystackEmail,
        amountMinor: Number(order.total_amount_minor),
        currency: String(order.currency),
        reference: order.reference,
        callbackUrl,
        metadata: {
          ticketOrderId: order.id,
          tierId: tier.id,
          quantity,
        },
      });
    } catch (err) {
      await admin.from("ticket_orders").update({ status: "failed" }).eq("id", order.id);
      const msg = err instanceof Error ? err.message : "Payment initialization failed.";
      return NextResponse.json({ error: "PAYMENT_INIT_FAILED", message: msg }, { status: 502 });
    }

    return NextResponse.json(
      {
        orderId: order.id,
        reference: order.reference,
        authorizationUrl: paystackInit.authorizationUrl,
        accessCode: paystackInit.accessCode,
        quantity,
        baseAmountMinor,
        surchargeMinor,
        totalAmountMinor,
        currency: order.currency,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create ticket order error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Unexpected server error." }, { status: 500 });
  }
}
