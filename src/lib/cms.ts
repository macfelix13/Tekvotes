import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";

export interface PlatformCmsSettings {
  announcementEnabled: boolean;
  announcementText: string;
  announcementLink: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  marqueeEnabled: boolean;
  marqueeHeading: string;
  marqueeSubheading: string;
  organiserHeading: string;
  organiserDescription: string;
  aboutHeading: string;
  aboutDescription: string;
  pricingCommissionLabel: string;
  supportEmail: string;
  supportAddress: string;
  footerTagline: string;
  footerCopyright: string;
}

export interface PlatformMarqueeItemRow {
  id: string;
  name: string;
  subtitle: string;
  badge: "Event" | "Sponsor" | "Partner";
  logoUrl: string;
  websiteUrl: string;
  sortOrder: number;
  active: boolean;
}

export const DEFAULT_CMS_SETTINGS: PlatformCmsSettings = {
  announcementEnabled: false,
  announcementText: "",
  announcementLink: "",
  heroTitle: "Cast Your Vote for Ghana's Next",
  heroHighlight: "Champions",
  heroSubtitle:
    "Instant, transparent and fraud-free digital voting for awards, pageants, and talent competitions. Pay securely with MTN MoMo, Telecel Cash, and AT Money.",
  heroImageUrl: "/images/hero-voter.jpg",
  heroPrimaryCta: "Browse Active Competitions",
  heroSecondaryCta: "Host an Event",
  marqueeEnabled: true,
  marqueeHeading: "Trusted Events, Official Sponsors & Payment Partners",
  marqueeSubheading: "Powering verified digital competitions & instant MoMo voting across Ghana",
  organiserHeading:
    "Join our platform as an organiser and create your events for voting and ticketing",
  organiserDescription:
    "All you need to do is to create an account and verify your email. That's it. Your account is ready to be used with comprehensive category setups, custom vote pricing, and real-time bank settlements.",
  aboutHeading:
    "It's an e-voting platform where Organisers create and run their award & pageant events with ease",
  aboutDescription:
    "All they have to do is create an account and verify their email address, and they are ready to start using our platform.",
  pricingCommissionLabel: "10-35% on Base Votes",
  supportEmail: "frametek93@gmail.com",
  supportAddress: "Accra Digital Centre, Ring Road West, Accra, Ghana.",
  footerTagline:
    "Ghana's premier multi-tenant digital competition management and voting infrastructure.",
  footerCopyright: "© 2026 TekVotes Ghana Ltd. All rights reserved.",
};

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function mapCmsRow(row: Record<string, unknown> | null | undefined): PlatformCmsSettings {
  if (!row) return DEFAULT_CMS_SETTINGS;
  return {
    announcementEnabled: Boolean(row.announcement_enabled ?? DEFAULT_CMS_SETTINGS.announcementEnabled),
    announcementText: String(row.announcement_text ?? DEFAULT_CMS_SETTINGS.announcementText),
    announcementLink: String(row.announcement_link ?? DEFAULT_CMS_SETTINGS.announcementLink),
    heroTitle: String(row.hero_title ?? DEFAULT_CMS_SETTINGS.heroTitle),
    heroHighlight: String(row.hero_highlight ?? DEFAULT_CMS_SETTINGS.heroHighlight),
    heroSubtitle: String(row.hero_subtitle ?? DEFAULT_CMS_SETTINGS.heroSubtitle),
    heroImageUrl: String(row.hero_image_url || DEFAULT_CMS_SETTINGS.heroImageUrl),
    heroPrimaryCta: String(row.hero_primary_cta ?? DEFAULT_CMS_SETTINGS.heroPrimaryCta),
    heroSecondaryCta: String(row.hero_secondary_cta ?? DEFAULT_CMS_SETTINGS.heroSecondaryCta),
    marqueeEnabled: row.marquee_enabled !== false,
    marqueeHeading: String(row.marquee_heading ?? DEFAULT_CMS_SETTINGS.marqueeHeading),
    marqueeSubheading: String(row.marquee_subheading ?? DEFAULT_CMS_SETTINGS.marqueeSubheading),
    organiserHeading: String(row.organiser_heading ?? DEFAULT_CMS_SETTINGS.organiserHeading),
    organiserDescription: String(row.organiser_description ?? DEFAULT_CMS_SETTINGS.organiserDescription),
    aboutHeading: String(row.about_heading ?? DEFAULT_CMS_SETTINGS.aboutHeading),
    aboutDescription: String(row.about_description ?? DEFAULT_CMS_SETTINGS.aboutDescription),
    pricingCommissionLabel: String(row.pricing_commission_label ?? DEFAULT_CMS_SETTINGS.pricingCommissionLabel),
    supportEmail: String(row.support_email ?? DEFAULT_CMS_SETTINGS.supportEmail),
    supportAddress: String(row.support_address ?? DEFAULT_CMS_SETTINGS.supportAddress),
    footerTagline: String(row.footer_tagline ?? DEFAULT_CMS_SETTINGS.footerTagline),
    footerCopyright: String(row.footer_copyright ?? DEFAULT_CMS_SETTINGS.footerCopyright),
  };
}

export async function getPlatformCmsSettings(): Promise<PlatformCmsSettings> {
  await connection();
  try {
    const db = anonClient();
    const { data } = await db
      .from("platform_cms_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return mapCmsRow(data as Record<string, unknown> | null);
  } catch {
    return DEFAULT_CMS_SETTINGS;
  }
}
