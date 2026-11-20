import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const SubmitBallotSchema = z.object({
  assignmentId: z.string().uuid("Invalid assignment ID"),
  categoryEntryId: z.string().uuid("Invalid contestant entry ID"),
  scores: z
    .array(
      z.object({
        criterionId: z.string().uuid("Invalid criterion ID"),
        score: z.number().min(0).max(1000),
      })
    )
    .min(1, "At least one criterion score is required"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = SubmitBallotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid ballot payload." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "Sign in required." }, { status: 401 });
  }

  const { assignmentId, categoryEntryId, scores } = parsed.data;
  const rpcScores = scores.map((s) => ({
    criterion_id: s.criterionId,
    score: s.score,
  }));

  const { data: submissionId, error } = await supabase.rpc("app_submit_judging_scores", {
    p_assignment_id: assignmentId,
    p_category_entry_id: categoryEntryId,
    p_scores: rpcScores,
  });

  if (error) {
    const msg = error.message || "Could not submit judging ballot.";
    const status = msg.includes("FORBIDDEN")
      ? 403
      : msg.includes("SCORES_ALREADY_SUBMITTED")
      ? 409
      : msg.includes("OUT_OF_BOUNDS") || msg.includes("MISSING_REQUIRED")
      ? 422
      : 400;
    return NextResponse.json({ error: "SUBMIT_FAILED", message: msg }, { status });
  }

  return NextResponse.json({ ok: true, submissionId }, { status: 201 });
}
