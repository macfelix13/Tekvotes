import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().trim().min(3, "Please enter a subject").max(150),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = ContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid inquiry details." },
      { status: 400 }
    );
  }

  const { name, email, subject, message } = parsed.data;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NOTIFICATIONS_FROM_EMAIL || "onboarding@resend.dev";
  const adminEmail = process.env.SUPER_ADMIN_ROOT_EMAIL || "frametek93@gmail.com";

  if (resendKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        reply_to: email,
        subject: `[TekVotes Support] ${subject}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      }),
    }).catch(() => null);

    if (res && res.ok) {
      return NextResponse.json({ ok: true, delivered: true });
    }
  }

  return NextResponse.json({
    ok: true,
    delivered: false,
    fallbackEmail: adminEmail,
  });
}
