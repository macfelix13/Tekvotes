import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { JudgePortalClient, type JudgeAssignmentBundle } from "./JudgePortalClient";

export default async function JudgePortalPage() {
  await connection();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirectTo=/judge");
  }

  const admin = createAdminClient();

  const { data: judgeRows } = await admin
    .from("judges")
    .select("id, display_name, organization_id")
    .eq("user_id", user.id);

  const judgeIds = (judgeRows ?? []).map((j) => j.id);

  const { data: rawAssignments } =
    judgeIds.length > 0
      ? await admin
          .from("judging_assignments")
          .select("id, judge_id, event_id, category_id, organization_id")
          .in("judge_id", judgeIds)
          .is("revoked_at", null)
          .order("created_at", { ascending: true })
      : { data: [] };

  const assignments = rawAssignments ?? [];
  const categoryIds = Array.from(new Set(assignments.map((a) => a.category_id)));
  const eventIds = Array.from(new Set(assignments.map((a) => a.event_id)));
  const assignmentIds = assignments.map((a) => a.id);

  const [{ data: events }, { data: categories }, { data: criteria }, { data: catEntries }, { data: submissions }] =
    categoryIds.length > 0
      ? await Promise.all([
          admin.from("events").select("id, name, slug, public_code").in("id", eventIds),
          admin.from("event_categories").select("id, name, results_state").in("id", categoryIds),
          admin
            .from("judging_criteria")
            .select("id, category_id, name, weight_bps, min_score, max_score, step, sort_order")
            .in("category_id", categoryIds)
            .order("sort_order", { ascending: true }),
          admin
            .from("category_entries")
            .select(
              "id, category_id, contestant_entries(public_code, contestant_number), contestants(display_name, profile_public_id)"
            )
            .in("category_id", categoryIds)
            .eq("status", "active"),
          admin
            .from("judging_submissions")
            .select("id, assignment_id, category_entry_id, status, submitted_at")
            .in("assignment_id", assignmentIds)
            .eq("status", "submitted"),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const submissionIds = (submissions ?? []).map((s) => s.id);
  const { data: scoreRows } =
    submissionIds.length > 0
      ? await admin
          .from("judging_scores")
          .select("submission_id, criterion_id, score")
          .in("submission_id", submissionIds)
      : { data: [] };

  const eventMap = new Map((events ?? []).map((e) => [e.id, e]));
  const catMap = new Map((categories ?? []).map((c) => [c.id, c]));
  const judgeMap = new Map((judgeRows ?? []).map((j) => [j.id, j]));

  type EntryJoin = { public_code?: string; contestant_number?: number };
  type ContestantJoin = { display_name?: string; profile_public_id?: string | null };

  const bundles: JudgeAssignmentBundle[] = assignments.map((a) => {
    const ev = eventMap.get(a.event_id);
    const cat = catMap.get(a.category_id);
    const jg = judgeMap.get(a.judge_id);

    const catCriteria = (criteria ?? [])
      .filter((c) => c.category_id === a.category_id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        weightBps: Number(c.weight_bps),
        minScore: Number(c.min_score),
        maxScore: Number(c.max_score),
        step: Number(c.step),
      }));

    const entries = (catEntries ?? [])
      .filter((ce) => ce.category_id === a.category_id)
      .map((ce) => {
        const ceRaw = ce.contestant_entries as EntryJoin | EntryJoin[] | null;
        const cRaw = ce.contestants as ContestantJoin | ContestantJoin[] | null;
        const ceRow = Array.isArray(ceRaw) ? ceRaw[0] : ceRaw;
        const cRow = Array.isArray(cRaw) ? cRaw[0] : cRaw;

        const sub = (submissions ?? []).find(
          (s) => s.assignment_id === a.id && s.category_entry_id === ce.id
        );
        const scoresMap: Record<string, number> = {};
        if (sub) {
          for (const sr of (scoreRows ?? []).filter((r) => r.submission_id === sub.id)) {
            scoresMap[sr.criterion_id] = Number(sr.score);
          }
        }

        return {
          categoryEntryId: ce.id,
          code: ceRow?.public_code ?? "—",
          number: Number(ceRow?.contestant_number ?? 0),
          name: cRow?.display_name ?? "Contestant",
          photoUrl: cRow?.profile_public_id ?? null,
          locked: Boolean(sub),
          submittedAt: sub?.submitted_at ?? null,
          savedScores: scoresMap,
        };
      })
      .sort((x, y) => x.number - y.number);

    return {
      assignmentId: a.id,
      judgeName: jg?.display_name ?? user.email ?? "Judge",
      eventName: ev?.name ?? "Competition",
      eventSlug: ev?.slug ?? "",
      categoryId: a.category_id,
      categoryName: cat?.name ?? "Category",
      resultsState: cat?.results_state ?? "live",
      criteria: catCriteria,
      entries,
    };
  });

  return <JudgePortalClient userEmail={user.email ?? ""} assignments={bundles} />;
}
