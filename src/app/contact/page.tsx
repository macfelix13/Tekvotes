"use client";

import { useState } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import { Reveal } from "@/components/ui/Reveal";
import { MessageCircle, Mail, MapPin, Send, CheckCircle2, AlertCircle } from "lucide-react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/v1/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus({ kind: "err", text: data?.message || "Could not send message." });
        return;
      }
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setStatus({
        kind: "ok",
        text: "Inquiry sent! Our support team will reply to your email shortly.",
      });
    } catch {
      setStatus({ kind: "err", text: "Network error sending inquiry. Please email frametek93@gmail.com." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <Reveal className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">Helpdesk &amp; Support</span>
            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#0E1030]">
              Contact TekVotes Ghana
            </h1>
            <p className="text-sm text-[#5B5F85]">
              Our voter support and organizer onboarding teams are available 24/7.
            </p>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-[#D9DBEA] shadow-xs space-y-2">
              <MessageCircle className="w-6 h-6 text-[#25D366]" />
              <h3 className="font-heading font-bold text-base text-[#0E1030]">Voter Receipt Lookup</h3>
              <p className="text-xs text-[#5B5F85]">Instant verification for MoMo &amp; Card vote orders.</p>
              <a
                href="/verify"
                className="inline-block text-xs font-bold text-[#4B35E0] hover:underline pt-1"
              >
                Verify Vote Reference →
              </a>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#D9DBEA] shadow-xs space-y-2">
              <Mail className="w-6 h-6 text-[#4B35E0]" />
              <h3 className="font-heading font-bold text-base text-[#0E1030]">Email Desk</h3>
              <p className="text-xs text-[#5B5F85]">Official inquiries &amp; partnership applications.</p>
              <a
                href="mailto:frametek93@gmail.com"
                className="block font-mono text-xs font-bold text-[#0E1030] hover:text-[#4B35E0] pt-1"
              >
                frametek93@gmail.com
              </a>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#D9DBEA] shadow-xs space-y-2">
              <MapPin className="w-6 h-6 text-[#F2A900]" />
              <h3 className="font-heading font-bold text-base text-[#0E1030]">Headquarters</h3>
              <p className="text-xs text-[#5B5F85]">Accra Digital Centre, Ring Road West, Accra, Ghana.</p>
            </div>
          </div>
          </Reveal>

          <Reveal delayMs={140}>
            <div className="bg-white rounded-3xl border border-[#D9DBEA] p-6 sm:p-8 shadow-xs space-y-5">
            <div>
              <h2 className="font-heading font-bold text-xl text-[#0E1030]">Send a Support Message</h2>
              <p className="text-xs text-[#5B5F85] mt-0.5">
                Need help with an event, payout, or vote reference? Send us a direct message below.
              </p>
            </div>

            {status ? (
              <div
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  status.kind === "ok"
                    ? "bg-[#E6F8F0] border-[#0F9D6B]/30 text-[#0F9D6B]"
                    : "bg-[#D13A3A]/10 border-[#D13A3A]/30 text-[#D13A3A]"
                }`}
              >
                {status.kind === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{status.text}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#5B5F85] uppercase mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ama Serwaa"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#5B5F85] uppercase mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ama@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Event onboarding / Vote verification / Payout support"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Message *</label>
                <textarea
                  rows={4}
                  required
                  minLength={10}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Include your event code or vote reference (TV-...) if applicable..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#4B35E0] text-white font-bold text-sm hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? "Sending..." : "Send Message"}</span>
              </button>
            </form>
          </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
