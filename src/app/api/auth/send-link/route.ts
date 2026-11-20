import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

const SendLinkSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  purpose: z.enum(["magic", "reset"]),
  redirectTo: z.string().optional(),
});

function safeNext(raw?: string): string {
  if (!raw) return "/org";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/org";
  return trimmed;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = SendLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const purpose = parsed.data.purpose;
    const nextPath = purpose === "reset" ? "/auth/reset-password" : safeNext(parsed.data.redirectTo);
    const origin = req.nextUrl.origin;

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: purpose === "reset" ? "recovery" : "magiclink",
      email,
    });

    if (error || !data?.properties?.hashed_token) {
      return NextResponse.json(
        { error: error?.message || "Could not generate sign-in link for this email." },
        { status: 400 }
      );
    }

    const otpType = purpose === "reset" ? "recovery" : "magiclink";
    const callbackUrl = `${origin}/auth/callback?token_hash=${encodeURIComponent(
      data.properties.hashed_token
    )}&type=${otpType}&next=${encodeURIComponent(nextPath)}`;

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.NOTIFICATIONS_FROM_EMAIL || "onboarding@resend.dev";

    if (resendKey) {
      const subject =
        purpose === "reset" ? "Set your TekVotes password" : "Your TekVotes Magic Sign-In Link";
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0E1030; margin-bottom: 12px;">${subject}</h2>
          <p style="color: #5B5F85; font-size: 14px; line-height: 1.6;">
            Click the button below to ${purpose === "reset" ? "set a new password for" : "sign in to"} your TekVotes workspace:
          </p>
          <p style="margin: 24px 0;">
            <a href="${callbackUrl}" style="background: #4B35E0; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
              ${purpose === "reset" ? "Set Password" : "Sign In to TekVotes"}
            </a>
          </p>
          <p style="color: #8A8EAE; font-size: 12px;">
            If the button does not work, copy and paste this link into your browser:<br />
            <a href="${callbackUrl}">${callbackUrl}</a>
          </p>
        </div>
      `;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject,
          html,
        }),
      });

      if (resendRes.ok) {
        return NextResponse.json({ ok: true, provider: "resend" });
      }
    }

    return NextResponse.json({ ok: false, fallbackRequired: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send sign-in link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
