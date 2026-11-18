import { Navbar } from "@/components/navigation/Navbar";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 bg-white p-8 rounded-3xl border border-[#D9DBEA] shadow-xs space-y-6">
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#0E1030]">
            Terms of Service & Voting Governance Policy
          </h1>
          <div className="space-y-4 text-xs sm:text-sm text-[#5B5F85] leading-relaxed">
            <p>
              <strong className="text-[#0E1030]">1. Whole-Vote Arithmetic (Q33):</strong> All votes cast on TekVotes are processed in whole integers. Payment network processing fees are transparently displayed at checkout prior to Mobile Money authorization.
            </p>
            <p>
              <strong className="text-[#0E1030]">2. Late Payment Grace Window (ND-01):</strong> Orders initiated prior to a competition&apos;s scheduled close time have a 180-second grace window for payment webhook confirmation. Payments confirmed after a manual pause, cancellation, or outside the grace window are recorded as <code className="font-mono">paid_uncredited</code> for post-event refund processing.
            </p>
            <p>
              <strong className="text-[#0E1030]">3. Central Treasury & Post-Event Settlements (OD-07):</strong> All voting funds are received into the central TekVotes Super Admin treasury, tracked permanently by event (<code className="font-mono">fin.v_event_funds</code>) and by organization (<code className="font-mono">fin.v_org_funds</code>), and disbursed to verified organizers after voting has officially closed.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
