import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("currencies").select("code").limit(1);

    return NextResponse.json(
      {
        status: error ? "degraded" : "ok",
        supabase: !error,
        paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        timestamp: new Date().toISOString(),
      },
      { status: error ? 503 : 200 }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        supabase: false,
        paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
      },
      { status: 500 }
    );
  }
}
