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

    const supabase = createAdminClient();

    // 1. Ensure or create profile for applicant email
    // In actual auth signup, Supabase trigger does this. For public guest apply:
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", applicantEmail)
      .maybeSingle();

    let userId = existingProfile?.id;

    if (!userId) {
      // Create guest profile placeholder until they claim it via invite/signup
      const { data: newProfile, error: profileErr } = await supabase
        .from("profiles")
        .insert({
          display_name: applicantName,
          email: applicantEmail,
          phone_e164: applicantPhone.startsWith("+") ? applicantPhone : `+233${applicantPhone.replace(/^0/, "")}`,
        })
        .select("id")
        .single();

      if (profileErr) {
        return NextResponse.json(
          { error: { code: "PROFILE_CREATION_FAILED", message: profileErr.message } },
          { status: 500 }
        );
      }
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
      return NextResponse.json(
        { error: { code: "APPLICATION_FAILED", message: appErr.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: appData });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: err.message || "Failed to process application" } },
      { status: 500 }
    );
  }
}
