import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

const applySchema = z.object({
  applicantName: z.string().min(2, "Name is too short"),
  applicantEmail: z.string().email("Invalid email address"),
  applicantPhone: z.string().min(8, "Invalid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  orgName: z.string().min(2).max(120),
  orgType: z.string().optional(),
  description: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
});

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s()-]/g, "");
  if (/^\+[1-9][0-9]{7,14}$/.test(cleaned)) return cleaned;
  if (/^0[0-9]{9}$/.test(cleaned)) return `+233${cleaned.slice(1)}`;
  if (/^233[0-9]{9}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}

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

    const {
      applicantName,
      applicantEmail,
      applicantPhone,
      password,
      orgName,
      orgType,
      description,
      website,
    } = parsed.data;

    const phoneE164 = normalizePhone(applicantPhone);
    const supabase = createAdminClient();
    const normalizedEmail = applicantEmail.trim().toLowerCase();

    // 1. Find existing profile or create confirmed Auth user (on_auth_user_created creates profiles row)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let userId = existingProfile?.id as string | undefined;
    let accountCreated = false;

    if (!userId) {
      const { data: created, error: authErr } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password: password || randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { full_name: applicantName },
      });

      if (created?.user?.id) {
        userId = created.user.id;
        accountCreated = true;
      } else {
        // Handle case where user already exists in auth.users without profile email match
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const matched = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
        if (!matched) {
          throw authErr ?? new Error("Could not provision applicant account");
        }
        userId = matched.id;
      }

      await supabase.from("profiles").upsert(
        {
          id: userId,
          display_name: applicantName,
          email: normalizedEmail,
          phone_e164: phoneE164,
        },
        { onConflict: "id" }
      );
    } else if (phoneE164) {
      await supabase
        .from("profiles")
        .update({ display_name: applicantName, phone_e164: phoneE164 })
        .eq("id", userId);
    }

    // 2. Insert organization application
    const { data: appData, error: appErr } = await supabase
      .from("organization_applications")
      .insert({
        applicant_user_id: userId,
        applicant_name: applicantName,
        applicant_email: normalizedEmail,
        applicant_phone: phoneE164 ?? applicantPhone,
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
          {
            error: {
              code: "PENDING_APPLICATION_EXISTS",
              message: "You already have a pending application under review.",
            },
          },
          { status: 409 }
        );
      }
      throw appErr;
    }

    return NextResponse.json({ success: true, accountCreated, data: appData }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process application";
    console.error("org-application persist failed:", message);
    return NextResponse.json(
      { error: { code: "APPLICATION_FAILED", message: "We could not save your application. Please try again shortly." } },
      { status: 500 }
    );
  }
}
