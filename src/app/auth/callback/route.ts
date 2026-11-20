import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/org";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/org";
  return trimmed;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextPath = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(nextPath, url.origin));
    }
  }

  const loginUrl = new URL("/auth/login", url.origin);
  loginUrl.searchParams.set("redirectTo", nextPath);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(loginUrl);
}
