"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck, Lock, Mail, Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

function sanitizeRedirect(raw: string | null): string {
  if (!raw) return "/org";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/org";
  return trimmed;
}

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirectTo");
  const redirectTo = sanitizeRedirect(rawRedirect);
  const urlError = searchParams.get("error");

  const [mode, setMode] = useState<"password" | "magic" | "reset">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    urlError === "auth_callback_failed"
      ? "Sign-in link expired or invalid. Please request a fresh link."
      : ""
  );
  const [sentMessage, setSentMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSentMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg("Enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      if (mode === "magic" || mode === "reset") {
        const res = await fetch("/api/auth/send-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: trimmedEmail,
            purpose: mode,
            redirectTo,
          }),
        });
        const data = await res.json().catch(() => null);

        if (res.ok && data?.ok) {
          setSentMessage(
            mode === "reset"
              ? `We sent a password reset link to ${trimmedEmail}. Open the link to set your new password.`
              : `We sent a one-time sign-in link to ${trimmedEmail}. Open the link to continue to ${redirectTo}.`
          );
          return;
        }

        if (res.ok && data?.fallbackRequired) {
          if (mode === "magic") {
            const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
            const { error } = await supabase.auth.signInWithOtp({
              email: trimmedEmail,
              options: {
                shouldCreateUser: false,
                emailRedirectTo: callbackUrl,
              },
            });
            if (error) {
              setErrorMsg(error.message);
              return;
            }
            setSentMessage(`We sent a one-time sign-in link to ${trimmedEmail}. Open the link to continue to ${redirectTo}.`);
            return;
          }

          const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`;
          const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
            redirectTo: callbackUrl,
          });
          if (error) {
            setErrorMsg(error.message);
            return;
          }
          setSentMessage(`We sent a password reset link to ${trimmedEmail}. Open the link to set your new password.`);
          return;
        }

        setErrorMsg(data?.error || "Could not send sign-in link.");
        return;
      }

      if (!password) {
        setErrorMsg("Enter your password.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }

      let target = redirectTo;
      if (!rawRedirect) {
        const landingRes = await fetch("/api/auth/landing").catch(() => null);
        const landingData = landingRes ? await landingRes.json().catch(() => null) : null;
        if (landingData?.redirectTo) {
          target = landingData.redirectTo;
        }
      }

      router.push(target);
      router.refresh();
    } catch {
      setErrorMsg("Unable to complete sign-in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="bg-white rounded-3xl p-8 border border-[#D9DBEA] shadow-xl space-y-6">
        <div className="text-center space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
            TekVotes Workspace Access
          </span>
          <h1 className="font-heading font-extrabold text-2xl text-[#0E1030]">
            Sign in to your account
          </h1>
          <p className="text-xs text-[#5B5F85]">
            Organisers, Judges, and Platform Administrators
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA]">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setErrorMsg("");
              setSentMessage("");
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === "password" ? "bg-[#4B35E0] text-white shadow-xs" : "text-[#5B5F85] hover:text-[#0E1030]"
            }`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("magic");
              setErrorMsg("");
              setSentMessage("");
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === "magic" ? "bg-[#4B35E0] text-white shadow-xs" : "text-[#5B5F85] hover:text-[#0E1030]"
            }`}
          >
            Email Magic Link
          </button>
        </div>

        {sentMessage ? (
          <div className="p-5 rounded-2xl bg-[#E6F8F0] border border-[#0F9D6B]/30 text-center space-y-2">
            <CheckCircle2 className="w-7 h-7 text-[#0F9D6B] mx-auto" />
            <h2 className="font-heading font-bold text-base text-[#0E1030]">Check your inbox</h2>
            <p className="text-xs text-[#5B5F85]">{sentMessage}</p>
            <button
              type="button"
              onClick={() => {
                setSentMessage("");
                setMode("password");
              }}
              className="mt-2 text-xs font-semibold text-[#4B35E0] hover:underline cursor-pointer"
            >
              Back to Password Sign-In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg ? (
              <div className="p-3.5 rounded-xl bg-[#D13A3A]/10 border border-[#D13A3A]/20 flex items-start gap-2.5 text-xs font-medium text-[#D13A3A]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@organization.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                />
                <Mail className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3" />
              </div>
            </div>

            {mode === "password" ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-[#5B5F85]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setErrorMsg("");
                    }}
                    className="text-[11px] font-semibold text-[#4B35E0] hover:underline cursor-pointer"
                  >
                    Forgot / Set Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                  />
                  <Lock className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3" />
                </div>
              </div>
            ) : mode === "reset" ? (
              <p className="text-[11px] text-[#5B5F85] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#4B35E0] shrink-0" />
                Enter your email and we will send a password setup/reset link.
              </p>
            ) : (
              <p className="text-[11px] text-[#5B5F85] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#4B35E0] shrink-0" />
                Receive a one-time email link for Super Admin or Organisers.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              <span>
                {loading
                  ? "Submitting..."
                  : mode === "magic"
                  ? "Send Magic Sign-In Link"
                  : mode === "reset"
                  ? "Send Password Reset Link"
                  : "Sign In"}
              </span>
            </button>
          </form>
        )}

        <div className="pt-5 border-t border-[#D9DBEA] flex items-center justify-between text-xs text-[#5B5F85]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#0F9D6B]" /> Supabase Auth
          </span>
          <Link href="/apply" className="font-semibold text-[#4B35E0] hover:underline">
            Apply as Organiser →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <Suspense
          fallback={
            <div className="text-sm text-[#5B5F85]">Loading sign-in form...</div>
          }
        >
          <LoginFormContent />
        </Suspense>
      </main>
    </div>
  );
}
