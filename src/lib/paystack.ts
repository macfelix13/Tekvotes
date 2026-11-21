import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

const PAYSTACK_API_BASE = "https://api.paystack.co";

export function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  return key;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = getPaystackSecretKey();
  const expectedSig = createHmac("sha512", secret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

export interface PaystackInitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializePaystackTransaction(params: {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitializeResult> {
  const secret = getPaystackSecretKey();
  const res = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountMinor,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      channels: ["mobile_money", "card"],
      metadata: params.metadata ?? {},
    }),
    signal: AbortSignal.timeout(15000),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.status || !payload?.data?.authorization_url) {
    throw new Error(payload?.message || `Paystack initialize failed (${res.status})`);
  }

  return {
    authorizationUrl: payload.data.authorization_url as string,
    accessCode: payload.data.access_code as string,
    reference: (payload.data.reference as string) || params.reference,
  };
}

export interface PaystackVerifyResult {
  status: string;
  reference: string;
  amountMinor: number;
  currency: string;
  feesMinor: number;
  channel: string;
  transactionId: string;
  raw: Record<string, unknown>;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResult> {
  const secret = getPaystackSecretKey();
  const res = await fetch(
    `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    }
  );

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.status || !payload?.data) {
    throw new Error(payload?.message || `Paystack verify failed (${res.status})`);
  }

  const d = payload.data as Record<string, unknown>;
  return {
    status: String(d.status ?? ""),
    reference: String(d.reference ?? reference),
    amountMinor: Number(d.amount ?? 0),
    currency: String(d.currency ?? "GHS"),
    feesMinor: Number(d.fees ?? 0),
    channel: String(d.channel ?? "mobile_money"),
    transactionId: String(d.id ?? ""),
    raw: d,
  };
}

export type FulfillmentResult =
  | { found: false }
  | { found: true; status: string; credited: boolean; alreadyFinal: boolean; paystackStatus?: string };

export async function fulfillPaystackOrderByReference(reference: string): Promise<FulfillmentResult> {
  const supabase = createAdminClient();
  const { data: order, error: orderErr } = await supabase
    .from("voting_orders")
    .select("id, reference, status, snapshot_amount_minor, snapshot_currency")
    .eq("reference", reference)
    .maybeSingle();

  if (orderErr) throw new Error(orderErr.message);
  if (!order) return { found: false };

  if (order.status === "credited" || order.status === "paid_uncredited") {
    return {
      found: true,
      status: order.status,
      credited: order.status === "credited",
      alreadyFinal: true,
    };
  }

  const verified = await verifyPaystackTransaction(order.reference);
  if (verified.status !== "success") {
    return {
      found: true,
      status: order.status,
      credited: false,
      alreadyFinal: false,
      paystackStatus: verified.status,
    };
  }

  if (
    verified.currency.toUpperCase() !== String(order.snapshot_currency).toUpperCase() ||
    verified.amountMinor !== Number(order.snapshot_amount_minor)
  ) {
    throw new Error("AMOUNT_OR_CURRENCY_MISMATCH");
  }

  const { data: ok, error: procErr } = await supabase.rpc("app_process_payment_success", {
    p_order_id: order.id,
    p_provider_txn_id: verified.transactionId,
    p_provider_fee_minor: Math.max(0, Number(verified.feesMinor ?? 0)),
    p_channel: verified.channel || "mobile_money",
    p_raw_verification: verified.raw,
  });

  if (procErr) {
    throw new Error(procErr.message);
  }

  const credited = Boolean(ok);

  if (credited) {
    void sendVoterReceiptEmail(supabase, order.id, order.reference).catch((err) => {
      console.warn("Voter receipt email failed:", err instanceof Error ? err.message : err);
    });
  }

  return {
    found: true,
    status: credited ? "credited" : "paid_uncredited",
    credited,
    alreadyFinal: false,
  };
}

async function sendVoterReceiptEmail(
  supabase: ReturnType<typeof createAdminClient>,
  orderId: string,
  reference: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const [{ data: orderRow }, { data: receiptData }] = await Promise.all([
    supabase.from("voting_orders").select("voters(email)").eq("id", orderId).maybeSingle(),
    supabase.rpc("app_get_receipt_by_reference", { p_reference: reference }),
  ]);

  type VoterJoin = { email: string | null } | { email: string | null }[] | null;
  const vRaw = (orderRow?.voters ?? null) as VoterJoin;
  const voterEmail = Array.isArray(vRaw) ? vRaw[0]?.email : vRaw?.email;
  if (!voterEmail || !receiptData) return;

  const receipt = receiptData as ReceiptRecord;
  const auditHash = computeAuditHash(receipt) ?? "Pending";
  const fromEmail = process.env.NOTIFICATIONS_FROM_EMAIL || "onboarding@resend.dev";
  const totalFormatted = `${receipt.currency} ${(receipt.totalAmountMinor / 100).toFixed(2)}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [voterEmail],
      subject: `TekVotes Receipt ${receipt.reference} — ${receipt.votes} vote(s) for ${receipt.contestantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #D9DBEA; border-radius: 16px;">
          <h2 style="color: #0E1030; margin-bottom: 8px;">Vote Credited Successfully</h2>
          <p style="color: #5B5F85; font-size: 14px;">
            Thank you for voting in <strong>${receipt.eventName}</strong>.
          </p>
          <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #5B5F85;">Reference</td><td style="font-weight: bold; text-align: right;">${receipt.reference}</td></tr>
            <tr><td style="padding: 6px 0; color: #5B5F85;">Contestant</td><td style="font-weight: bold; text-align: right;">${receipt.contestantName} (${receipt.contestantCode})</td></tr>
            <tr><td style="padding: 6px 0; color: #5B5F85;">Category</td><td style="text-align: right;">${receipt.categoryName}</td></tr>
            <tr><td style="padding: 6px 0; color: #5B5F85;">Votes Credited</td><td style="font-weight: bold; color: #4B35E0; text-align: right;">${receipt.votes}</td></tr>
            <tr><td style="padding: 6px 0; color: #5B5F85;">Total Paid</td><td style="font-weight: bold; text-align: right;">${totalFormatted}</td></tr>
          </table>
          <p style="color: #8A8EAE; font-size: 11px; word-break: break-all;">
            Audit Hash: ${auditHash}
          </p>
        </div>
      `,
    }),
  });
}

export interface ReceiptRecord {
  orderId: string;
  reference: string;
  status: string;
  contestantName: string;
  contestantCode: string;
  eventName: string;
  eventSlug: string;
  categoryName: string;
  votes: number;
  baseAmountMinor: number;
  surchargeMinor: number;
  totalAmountMinor: number;
  currency: string;
  channel: string;
  createdAt: string;
  creditedAt: string | null;
  ledgerId: number | null;
  providerTxnId: string | null;
}

export function computeAuditHash(receipt: ReceiptRecord): string | null {
  if (receipt.ledgerId == null) return null;
  const input = [
    receipt.orderId,
    receipt.ledgerId,
    receipt.reference,
    receipt.votes,
    receipt.totalAmountMinor,
    receipt.creditedAt ?? "",
  ].join("|");
  return `sha256:${createHash("sha256").update(input).digest("hex")}`;
}
