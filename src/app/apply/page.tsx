"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/navigation/Navbar";
import { Building2, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";

export default function ApplyPage() {
  const [formData, setFormData] = useState({
    applicantName: "",
    applicantEmail: "",
    applicantPhone: "",
    orgName: "",
    orgType: "beauty_pageant",
    description: "",
    website: "",
  });

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/v1/public/org-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to submit application");
      }

      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />

      <main className="flex-1 py-12 md:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">Organizer Application</span>
            <h1 className="text-3xl font-extrabold text-[#0E1030] mt-1">Host Competitions on TekVotes</h1>
            <p className="text-sm text-[#5B5F85] mt-2">
              All platform features and event creation are 100% free. TekVotes charges a transparent commission on successful voting transactions only.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#D9DBEA]">
            {status === "success" ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#0F9D6B]/10 text-[#0F9D6B] flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="font-heading font-bold text-xl text-[#0E1030]">Application Submitted!</h3>
                <p className="text-sm text-[#5B5F85] max-w-md mx-auto">
                  Our Super Admin team reviews all organizer applications to maintain platform trust. You will receive an email update once your application is reviewed.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {status === "error" && (
                  <div className="p-4 rounded-xl bg-[#D13A3A]/10 border border-[#D13A3A]/20 flex items-start gap-3 text-sm text-[#D13A3A]">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-[#5B5F85] tracking-wider border-b border-[#D9DBEA] pb-2">
                    Organization Information
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-[#0E1030] mb-1.5">
                      Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Miss Campus Media Ltd"
                      value={formData.orgName}
                      onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DBEA] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B35E0] focus:border-transparent bg-[#F6F7FC]/50"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0E1030] mb-1.5">
                        Competition Type *
                      </label>
                      <select
                        value={formData.orgType}
                        onChange={(e) => setFormData({ ...formData, orgType: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DBEA] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B35E0] bg-[#F6F7FC]/50"
                      >
                        <option value="beauty_pageant">Beauty Pageant</option>
                        <option value="award_show">Award Show</option>
                        <option value="talent_show">Talent Show / Competition</option>
                        <option value="campus_contest">Campus / Student Election</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0E1030] mb-1.5">
                        Website / Social Page
                      </label>
                      <input
                        type="url"
                        placeholder="https://instagram.com/pageant"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DBEA] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B35E0] bg-[#F6F7FC]/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0E1030] mb-1.5">
                      Description / Past Events
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Briefly tell us about your competition history or goals..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DBEA] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B35E0] bg-[#F6F7FC]/50"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold uppercase text-[#5B5F85] tracking-wider border-b border-[#D9DBEA] pb-2">
                    Primary Contact / Owner
                  </h3>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0E1030] mb-1.5">
                        Your Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Kofi Mensah"
                        value={formData.applicantName}
                        onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DBEA] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B35E0] bg-[#F6F7FC]/50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0E1030] mb-1.5">
                        Phone Number (WhatsApp) *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+233 24 123 4567"
                        value={formData.applicantPhone}
                        onChange={(e) => setFormData({ ...formData, applicantPhone: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DBEA] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B35E0] bg-[#F6F7FC]/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0E1030] mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="kofi@organization.com"
                      value={formData.applicantEmail}
                      onChange={(e) => setFormData({ ...formData, applicantEmail: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9DBEA] text-sm focus:outline-none focus:ring-2 focus:ring-[#4B35E0] bg-[#F6F7FC]/50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="w-full py-3 rounded-xl bg-[#4B35E0] text-white font-semibold text-sm hover:bg-[#3B28B8] disabled:opacity-50 transition-all flex items-center justify-center gap-2 mt-6"
                >
                  {status === "submitting" ? "Submitting Application..." : "Submit Application for Review"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
