import { NextResponse } from "next/server";

// Paid voting is not wired yet: orders must be created by the
// app_create_voting_order RPC with server-side pricing, paid through Paystack,
// and credited only after webhook + verify (CLAUDE.md payment contract).
// Until that lands, refuse explicitly instead of issuing a receipt.
export async function POST() {
  return NextResponse.json(
    {
      error: "PAYMENTS_NOT_ENABLED",
      message: "Voting checkout is not enabled on this site yet. No payment was taken and no votes were recorded.",
    },
    { status: 503 }
  );
}
