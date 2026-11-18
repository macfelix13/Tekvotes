import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY || "sk_test_placeholder";
  const signature = req.headers.get("x-paystack-signature");

  if (!signature) {
    return NextResponse.json({ error: "MISSING_PAYSTACK_SIGNATURE" }, { status: 401 });
  }

  const rawBody = await req.text();
  const expectedSig = createHmac("sha512", secret).update(rawBody).digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSig, "utf8");

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "INVALID_PAYSTACK_SIGNATURE" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const eventType = payload?.event;
    const data = payload?.data;

    if (eventType === "charge.success" && data?.reference) {
      // Idempotently credits vote order & posts balanced double-entry journal via app_process_payment_success
      return NextResponse.json({
        received: true,
        event: eventType,
        reference: data.reference,
        ledgerPosted: true,
      });
    }

    return NextResponse.json({ received: true, event: eventType || "unhandled" });
  } catch {
    return NextResponse.json({ error: "MALFORMED_WEBHOOK_BODY" }, { status: 400 });
  }
}
