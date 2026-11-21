import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { fulfillTicketOrderByReference } from "@/lib/paystack";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const { reference } = await context.params;
  const cleaned = reference.trim().toUpperCase();
  if (!cleaned) {
    return NextResponse.json({ error: "INVALID_REF", message: "Enter a valid ticket reference." }, { status: 400 });
  }

  const admin = createAdminClient();

  // First check if it's an individual ticket pass code (e.g. TT-261121-ABCD1234-01)
  let orderRef = cleaned;
  if (/^TT-[0-9A-Z]+-[0-9A-Z]+-[0-9]{2}$/.test(cleaned)) {
    orderRef = cleaned.replace(/-[0-9]{2}$/, "");
  }

  let { data: order } = await admin
    .from("ticket_orders")
    .select(
      "id, reference, status, buyer_name, buyer_phone_e164, buyer_email, quantity, unit_price_minor, base_amount_minor, surcharge_minor, total_amount_minor, currency, channel, paid_at, created_at, events(name, slug, venue), event_ticket_tiers(name)"
    )
    .eq("reference", orderRef)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Ticket order not found." }, { status: 404 });
  }

  if (order.status !== "paid") {
    try {
      await fulfillTicketOrderByReference(orderRef);
      const refreshed = await admin
        .from("ticket_orders")
        .select(
          "id, reference, status, buyer_name, buyer_phone_e164, buyer_email, quantity, unit_price_minor, base_amount_minor, surcharge_minor, total_amount_minor, currency, channel, paid_at, created_at, events(name, slug, venue), event_ticket_tiers(name)"
        )
        .eq("reference", orderRef)
        .maybeSingle();
      if (refreshed.data) order = refreshed.data;
    } catch {
      // Keep current state if Paystack verify fails
    }
  }

  const { data: passes } = await admin
    .from("issued_tickets")
    .select("id, ticket_code, holder_name, status, checked_in_at")
    .eq("order_id", order.id)
    .order("ticket_code", { ascending: true });

  type EvJoin = { name: string; slug: string; venue: string | null } | { name: string; slug: string; venue: string | null }[] | null;
  type TierJoin = { name: string } | { name: string }[] | null;
  const ev = Array.isArray(order.events as EvJoin) ? (order.events as EvJoin[])[0] : (order.events as EvJoin);
  const tier = Array.isArray(order.event_ticket_tiers as TierJoin)
    ? (order.event_ticket_tiers as TierJoin[])[0]
    : (order.event_ticket_tiers as TierJoin);

  return NextResponse.json({
    ticketReceipt: {
      orderId: order.id,
      reference: order.reference,
      status: order.status,
      buyerName: order.buyer_name,
      eventName: (ev as { name?: string } | null)?.name ?? "Event",
      eventSlug: (ev as { slug?: string } | null)?.slug ?? "",
      venue: (ev as { venue?: string | null } | null)?.venue ?? null,
      tierName: (tier as { name?: string } | null)?.name ?? "Ticket",
      quantity: Number(order.quantity),
      unitPriceMinor: Number(order.unit_price_minor),
      baseAmountMinor: Number(order.base_amount_minor),
      surchargeMinor: Number(order.surcharge_minor),
      totalAmountMinor: Number(order.total_amount_minor),
      currency: order.currency,
      channel: order.channel || "paystack",
      createdAt: order.created_at,
      paidAt: order.paid_at,
      passes: (passes ?? []).map((p) => ({
        id: p.id,
        ticketCode: p.ticket_code,
        holderName: p.holder_name,
        status: p.status,
        checkedInAt: p.checked_in_at,
      })),
    },
  });
}
