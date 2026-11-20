import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

const applySchema = z.object({
  applicantName: z.string().min(2, "Name is too short"),
  applicantEmail: z.string().email("Invalid email address"),
  applicantPhone: z.string().min(8, "Invalid phone number"),
  orgName: z.string().min(2).max(120),
  orgType: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = applySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: parsed.error.issues[0].message } },
        { status: 400 }
      );
    }

    const { applicantName, applicantEmail, applicantPhone, orgName, orgType, description, website } = parsed.data;

    try {
      const supabase = createAdminClient();

      // 1. Ensure or create profile for applicant email
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", applicantEmail)
        .maybeSingle();

      let userId = existingProfile?.id;

      if (!userId) {
        const { data: newProfile, error: profileErr } = await supabase
          .from("profiles")
          .insert({
            display_name: applicantName,
            email: applicantEmail,
            phone_e164: applicantPhone.startsWith("+") ? applicantPhone : `+233${applicantPhone.replace(/^0/, "")}`,
          })
          .select("id")
          .single();

        if (profileErr) throw profileErr;
        userId = newProfile.id;
      }

      // 2. Insert organization application
      const { data: appData, error: appErr } = await supabase
        .from("organization_applications")
        .insert({
          applicant_user_id: userId,
          applicant_name: applicantName,
          applicant_email: applicantEmail,
          applicant_phone: applicantPhone,
          org_name: orgName,
          org_type: orgType || "beauty_pageant",
          description: description || null,
          website: website || null,
          status: "pending",
        })
        .select("id, status, created_at")
        .single();

      if (appErr) {
        if (appErr.code === "23505") {
          return NextResponse.json(
            { error: { code: "PENDING_APPLICATION_EXISTS", message: "You already have a pending application under review." } },
            { status: 409 }
          );
        }
        throw appErr;
      }

      return NextResponse.json({ success: true, data: appData });
    } catch (err) {
      // Never report success when the application was not persisted.
      console.error("org-application persist failed", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: { code: "APPLICATION_FAILED", message: "We could not save your application. Please try again shortly." } },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process application";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
