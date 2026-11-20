import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { initializePaystackTransaction } from "@/lib/paystack";

const CreateOrderSchema = z
  .object({
    categoryEntryId: z.string().uuid("Invalid contestant entry ID"),
    voteQuantity: z.number().int().min(1).max(100000).optional(),
    packageId: z.string().uuid().optional(),
    voterPhone: z.string().min(9, "Enter a valid mobile number").max(20),
    voterEmail: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  })
  .refine((d) => Boolean(d.packageId || d.voteQuantity), {
    message: "Either packageId or voteQuantity is required",
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
  if (fwdHost) {
    return `${fwdProto || "https"}://${fwdHost}`;
  }
  const host = req.headers.get("host");
  if (host) {
    return `${req.nextUrl.protocol.replace(":", "") || "https"}://${host}`;
  }
  return req.nextUrl.origin;
}

function mapDomainError(message: string): { status: number; code: string; userMessage: string } {
  if (message.includes("CATEGORY_ENTRY_NOT_FOUND") || message.includes("PACKAGE_NOT_FOUND")) {
    return { status: 404, code: "NOT_FOUND", userMessage: "Selected contestant or vote package was not found." };
  }
  if (message.includes("EVENT_VOTING_NOT_ACTIVE") || message.includes("EVENT_NOT_APPROVED")) {
    return { status: 409, code: "VOTING_NOT_ACTIVE", userMessage: "Voting is not currently active for this event." };
  }
  if (message.includes("VOTING_ALREADY_CLOSED") || message.includes("VOTING_NOT_YET_OPEN")) {
    return { status: 409, code: "VOTING_CLOSED", userMessage: "Voting window is not open for this event." };
  }
  if (message.includes("VOTING_DISABLED") || message.includes("ENTRY_NOT_ACTIVE")) {
    return { status: 409, code: "ENTRY_UNAVAILABLE", userMessage: "Voting is currently disabled for this entry." };
  }
  if (message.includes("VOTES_BELOW_MINIMUM") || message.includes("VOTES_ABOVE_MAXIMUM") || message.includes("NOT_WHOLE_VOTES")) {
    return { status: 422, code: "INVALID_VOTE_COUNT", userMessage: message };
  }
  return { status: 500, code: "ORDER_FAILED", userMessage: "Unable to create voting order. Please try again." };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "INVALID_JSON", message: "Invalid JSON payload." }, { status: 400 });
    }

    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message || "Invalid order details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { categoryEntryId, voteQuantity, packageId, voterPhone, voterEmail } = parsed.data;
    const phoneE164 = normalizeGhanaPhone(voterPhone);
    if (!phoneE164) {
      return NextResponse.json(
        {
          error: "INVALID_PHONE",
          message: "Please enter a valid 10-digit Ghanaian mobile number (e.g. 0241234567).",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Load server-authoritative pricing & active state
    const { data: ce, error: ceErr } = await supabase
      .from("category_entries")
      .select(
        "id, category_id, status, event_categories(id, unit_price_minor, currency, voting_enabled, min_votes, max_votes), events(id, approval_status, voting_status)"
      )
      .eq("id", categoryEntryId)
      .maybeSingle();

    if (ceErr) {
      console.error("Failed loading category entry", ceErr.message);
      return NextResponse.json({ error: "DB_ERROR", message: "Could not verify contestant entry." }, { status: 500 });
    }
    if (!ce) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Contestant entry not found." }, { status: 404 });
    }

    type CatRow = { id: string; unit_price_minor: number; currency: string; voting_enabled: boolean };
    type EvRow = { id: string; approval_status: string; voting_status: string };
    const catRaw = ce.event_categories as CatRow | CatRow[] | null;
    const evRaw = ce.events as EvRow | EvRow[] | null;
    const cat = Array.isArray(catRaw) ? catRaw[0] : catRaw;
    const ev = Array.isArray(evRaw) ? evRaw[0] : evRaw;

    if (!cat || !ev || ce.status !== "active" || !cat.voting_enabled || ev.approval_status !== "approved" || ev.voting_status !== "active") {
      return NextResponse.json(
        { error: "VOTING_NOT_ACTIVE", message: "Voting is not currently active for this competition." },
        { status: 409 }
      );
    }

    let pricingMode: "package" | "custom" = "custom";
    let baseAmountMinor = 0;

    if (packageId) {
      const { data: pkg, error: pkgErr } = await supabase
        .from("vote_packages")
        .select("id, votes, price_minor, active")
        .eq("id", packageId)
        .eq("category_id", cat.id)
        .eq("active", true)
        .maybeSingle();

      if (pkgErr || !pkg) {
        return NextResponse.json({ error: "PACKAGE_NOT_FOUND", message: "Selected vote package is unavailable." }, { status: 404 });
      }
      pricingMode = "package";
      baseAmountMinor = Number(pkg.price_minor);
    } else if (voteQuantity) {
      baseAmountMinor = voteQuantity * Number(cat.unit_price_minor);
    }

    // Paystack Ghana surcharge (~1.95% Half-Up integer rounding, OD-01 / OD-02)
    const surchargeMinor = Math.floor((baseAmountMinor * 195 + 5000) / 10000);

    // 2. Find or create guest voter row by phone_e164
    const cleanEmail = voterEmail?.trim() || null;
    const { data: existingVoter, error: voterLookupErr } = await supabase
      .from("voters")
      .select("id, email")
      .eq("phone_e164", phoneE164)
      .limit(1)
      .maybeSingle();

    if (voterLookupErr) {
      console.error("Voter lookup error", voterLookupErr.message);
      return NextResponse.json({ error: "DB_ERROR", message: "Could not initialize voter profile." }, { status: 500 });
    }

    let voterId = existingVoter?.id as string | undefined;
    if (!voterId) {
      const { data: createdVoter, error: voterInsErr } = await supabase
        .from("voters")
        .insert({ phone_e164: phoneE164, email: cleanEmail })
        .select("id")
        .single();
      if (voterInsErr || !createdVoter) {
        console.error("Voter create error", voterInsErr?.message);
        return NextResponse.json({ error: "DB_ERROR", message: "Could not create voter profile." }, { status: 500 });
      }
      voterId = createdVoter.id;
    }

    // 3. Create authoritative voting order in Postgres
    const { data: orderId, error: orderRpcErr } = await supabase.rpc("app_create_voting_order", {
      p_voter_id: voterId,
      p_category_entry_id: categoryEntryId,
      p_pricing_mode: pricingMode,
      p_package_id: packageId ?? null,
      p_custom_base_amount_minor: pricingMode === "custom" ? baseAmountMinor : null,
      p_surcharge_minor: surchargeMinor,
    });

    if (orderRpcErr || !orderId) {
      const mapped = mapDomainError(orderRpcErr?.message || "");
      return NextResponse.json({ error: mapped.code, message: mapped.userMessage }, { status: mapped.status });
    }

    const { data: order, error: fetchOrderErr } = await supabase
      .from("voting_orders")
      .select("id, reference, snapshot_votes, snapshot_base_amount_minor, snapshot_surcharge_minor, snapshot_amount_minor, snapshot_currency")
      .eq("id", orderId)
      .single();

    if (fetchOrderErr || !order) {
      return NextResponse.json({ error: "ORDER_LOAD_FAILED", message: "Order created but could not be loaded." }, { status: 500 });
    }

    // 4. Initialize Paystack transaction
    const origin = resolveOrigin(req);
    const callbackUrl = `${origin}/verify?ref=${encodeURIComponent(order.reference)}`;
    const paystackEmail = cleanEmail || `voter-${phoneE164.replace(/\D/g, "")}@voters.tekvotes.app`;

    let paystackInit;
    try {
      paystackInit = await initializePaystackTransaction({
        email: paystackEmail,
        amountMinor: Number(order.snapshot_amount_minor),
        currency: String(order.snapshot_currency),
        reference: order.reference,
        callbackUrl,
        metadata: {
          orderId: order.id,
          categoryEntryId,
          votes: order.snapshot_votes,
        },
      });
    } catch (err) {
      await supabase.from("voting_orders").update({ status: "failed" }).eq("id", order.id);
      const msg = err instanceof Error ? err.message : "Payment initialization failed.";
      console.error("Paystack initialize error:", msg);
      return NextResponse.json({ error: "PAYMENT_INIT_FAILED", message: msg }, { status: 502 });
    }

    // 5. Record attempt in fin.payment_attempts and move order to payment_initiated
    const { error: attemptErr } = await supabase.rpc("app_record_payment_attempt", {
      p_order_id: order.id,
      p_provider_reference: paystackInit.reference,
      p_access_code: paystackInit.accessCode,
      p_authorization_url: paystackInit.authorizationUrl,
      p_amount_minor: Number(order.snapshot_amount_minor),
      p_currency: String(order.snapshot_currency),
    });

    if (attemptErr) {
      console.error("Failed recording payment attempt:", attemptErr.message);
    }

    return NextResponse.json(
      {
        orderId: order.id,
        reference: order.reference,
        authorizationUrl: paystackInit.authorizationUrl,
        accessCode: paystackInit.accessCode,
        votes: order.snapshot_votes,
        baseAmountMinor: Number(order.snapshot_base_amount_minor),
        surchargeMinor: Number(order.snapshot_surcharge_minor),
        totalAmountMinor: Number(order.snapshot_amount_minor),
        currency: order.snapshot_currency,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Unexpected checkout error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Unexpected error while starting checkout." },
      { status: 500 }
    );
  }
}
