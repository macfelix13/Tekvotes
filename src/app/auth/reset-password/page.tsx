"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navigation/Navbar";
import { createClient } from "@/lib/supabase/client";
import { Lock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/auth/login");
      }, 1500);
    } catch {
      setErrorMsg("Unable to update password. Please request a fresh reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-[#D9DBEA] shadow-xl space-y-6">
          <div className="text-center space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">
              Account Security
            </span>
            <h1 className="font-heading font-extrabold text-2xl text-[#0E1030]">
              Set a new password
            </h1>
            <p className="text-xs text-[#5B5F85]">
              Choose a strong password for your TekVotes Organiser or Admin account.
            </p>
          </div>

          {done ? (
            <div className="p-5 rounded-2xl bg-[#E6F8F0] border border-[#0F9D6B]/30 text-center space-y-2">
              <CheckCircle2 className="w-7 h-7 text-[#0F9D6B] mx-auto" />
              <h2 className="font-heading font-bold text-base text-[#0E1030]">Password updated!</h2>
              <p className="text-xs text-[#5B5F85]">
                Redirecting you to the sign-in page...
              </p>
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
                  New Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                  />
                  <Lock className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#5B5F85] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030] focus:outline-none focus:ring-2 focus:ring-[#4B35E0]"
                  />
                  <Lock className="w-4 h-4 text-[#5B5F85] absolute left-3.5 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] shadow-md shadow-[#4B35E0]/20 disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{loading ? "Saving..." : "Save Password"}</span>
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-[#D9DBEA] text-center">
            <Link href="/auth/login" className="text-xs font-semibold text-[#4B35E0] hover:underline">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
