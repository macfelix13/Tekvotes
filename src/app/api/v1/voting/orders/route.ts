import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CreateOrderSchema = z.object({
  categoryEntryId: z.string().min(1),
  voteQuantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().positive(),
  voterPhone: z.string().min(10).max(15),
  idempotencyKey: z.string().min(8).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { categoryEntryId, voteQuantity, unitPriceMinor, voterPhone } = parsed.data;

    // Whole-vote integer arithmetic (Rule Q33: zero floating point)
    const baseAmountMinor = voteQuantity * unitPriceMinor;
    if (baseAmountMinor % unitPriceMinor !== 0) {
      return NextResponse.json(
        { error: "NON_INTEGER_VOTE_QUANTITY", message: "Custom amounts must resolve to exact whole votes." },
        { status: 422 }
      );
    }

    // Paystack processing fee surcharge passed to voter (OD-01 / OD-02: ~1.95% Half-Up integer rounding)
    const surchargeMinor = Math.floor((baseAmountMinor * 195 + 5000) / 10000);
    const totalAmountMinor = baseAmountMinor + surchargeMinor;
    const reference = `TK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return NextResponse.json(
      {
        status: "pending",
        reference,
        categoryEntryId,
        voteQuantity,
        unitPriceMinor,
        baseAmountMinor,
        surchargeMinor,
        totalAmountMinor,
        currency: "GHS",
        voterPhone,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "INVALID_JSON_PAYLOAD" }, { status: 400 });
  }
}
