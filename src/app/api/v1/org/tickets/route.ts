import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiOrgMember } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

const CreateTierSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  eventId: z.string().uuid("Invalid event ID"),
  name: z.string().trim().min(2, "Tier name is required").max(120),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  priceGhs: z.number().positive("Ticket price must be greater than zero").max(50000),
  capacity: z.number().int().positive().max(1000000).nullable().optional(),
});

const CheckInSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
  ticketCode: z.string().trim().min(4, "Enter a ticket pass code"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateTierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid ticket tier." },
      { status: 400 }
    );
  }

  const { organizationId, eventId, name, description, priceGhs, capacity } = parsed.data;
  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const priceMinor = Math.round(priceGhs * 100);
  const admin = createAdminClient();

  const { data: ev } = await admin
    .from("events")
    .select("id, currency")
    .eq("id", eventId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!ev) {
    return NextResponse.json({ error: "EVENT_NOT_FOUND", message: "Event not found." }, { status: 404 });
  }

  const { data: tier, error } = await admin
    .from("event_ticket_tiers")
    .insert({
      event_id: eventId,
      organization_id: organizationId,
      name,
      description: description?.trim() || "",
      price_minor: priceMinor,
      currency: ev.currency || "GHS",
      capacity: capacity ?? null,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "CREATE_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ tier }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CheckInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid ticket pass code." },
      { status: 400 }
    );
  }

  const { organizationId, ticketCode } = parsed.data;
  const auth = await requireApiOrgMember(organizationId);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const cleanCode = ticketCode.toUpperCase();

  const { data: pass } = await admin
    .from("issued_tickets")
    .select("id, ticket_code, holder_name, status, checked_in_at, events(name), event_ticket_tiers(name)")
    .eq("organization_id", organizationId)
    .eq("ticket_code", cleanCode)
    .maybeSingle();

  if (!pass) {
    return NextResponse.json(
      { error: "PASS_NOT_FOUND", message: `No ticket pass found matching "${cleanCode}".` },
      { status: 404 }
    );
  }

  if (pass.status === "checked_in") {
    return NextResponse.json(
      {
        error: "ALREADY_CHECKED_IN",
        message: `Ticket ${cleanCode} (${pass.holder_name}) was already checked in at ${String(pass.checked_in_at).replace("T", " ").slice(0, 19)} UTC.`,
      },
      { status: 409 }
    );
  }

  const { data: updated, error: updErr } = await admin
    .from("issued_tickets")
    .update({
      status: "checked_in",
      checked_in_at: new Date().toISOString(),
      checked_in_by: auth.user.id,
    })
    .eq("id", pass.id)
    .select("id, ticket_code, holder_name, status, checked_in_at")
    .single();

  if (updErr) {
    return NextResponse.json({ error: "CHECKIN_FAILED", message: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ pass: updated });
}

export async function DELETE(req: NextRequest) {
  const tierId = req.nextUrl.searchParams.get("tierId") ?? "";
  if (!z.string().uuid().safeParse(tierId).success) {
    return NextResponse.json({ error: "INVALID_ID", message: "Valid tierId required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tier } = await admin
    .from("event_ticket_tiers")
    .select("id, organization_id, sold_count")
    .eq("id", tierId)
    .maybeSingle();

  if (!tier) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Ticket tier not found." }, { status: 404 });
  }

  const auth = await requireApiOrgMember(tier.organization_id as string);
  if (!auth.ok) return auth.response;

  if (Number(tier.sold_count) > 0) {
    await admin.from("event_ticket_tiers").update({ active: false }).eq("id", tierId);
    return NextResponse.json({ deactivated: true });
  }

  await admin.from("event_ticket_tiers").delete().eq("id", tierId);
  return NextResponse.json({ deleted: true });
}
