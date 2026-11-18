import { Navbar } from "@/components/navigation/Navbar";
import { MessageCircle, Mail, Phone, MapPin } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC]">
      <Navbar />
      <main className="flex-1 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4B35E0]">Helpdesk & Support</span>
            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-[#0E1030]">
              Contact TekVotes Ghana
            </h1>
            <p className="text-sm text-[#5B5F85]">
              Our voter support and organizer onboarding teams are available 24/7.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-[#D9DBEA] shadow-xs space-y-2">
              <MessageCircle className="w-6 h-6 text-[#25D366]" />
              <h3 className="font-heading font-bold text-base text-[#0E1030]">WhatsApp Helpdesk</h3>
              <p className="text-xs text-[#5B5F85]">Instant support for organizers and voters.</p>
              <a
                href="https://wa.me/233240000000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold text-[#25D366] hover:underline pt-1"
              >
                Chat on WhatsApp →
              </a>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#D9DBEA] shadow-xs space-y-2">
              <Mail className="w-6 h-6 text-[#4B35E0]" />
              <h3 className="font-heading font-bold text-base text-[#0E1030]">Email Desk</h3>
              <p className="text-xs text-[#5B5F85]">Official inquiries & partnership applications.</p>
              <span className="block font-mono text-xs font-bold text-[#0E1030] pt-1">
                frametek93@gmail.com
              </span>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#D9DBEA] shadow-xs space-y-2">
              <MapPin className="w-6 h-6 text-[#F2A900]" />
              <h3 className="font-heading font-bold text-base text-[#0E1030]">Headquarters</h3>
              <p className="text-xs text-[#5B5F85]">Accra Digital Centre, Ring Road West, Accra, Ghana.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
