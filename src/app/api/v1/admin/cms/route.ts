import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { mapCmsRow } from "@/lib/cms";

const CmsPatchSchema = z.object({
  announcementEnabled: z.boolean().optional(),
  announcementText: z.string().trim().max(300).optional(),
  announcementLink: z.string().trim().max(500).optional(),
  heroTitle: z.string().trim().min(2).max(200).optional(),
  heroHighlight: z.string().trim().min(1).max(80).optional(),
  heroSubtitle: z.string().trim().min(10).max(600).optional(),
  heroImageUrl: z.string().trim().min(1).max(1000).optional(),
  heroPrimaryCta: z.string().trim().min(2).max(60).optional(),
  heroSecondaryCta: z.string().trim().min(2).max(60).optional(),
  marqueeEnabled: z.boolean().optional(),
  marqueeHeading: z.string().trim().min(2).max(160).optional(),
  marqueeSubheading: z.string().trim().max(240).optional(),
  organiserHeading: z.string().trim().min(2).max(240).optional(),
  organiserDescription: z.string().trim().min(10).max(800).optional(),
  aboutHeading: z.string().trim().min(2).max(240).optional(),
  aboutDescription: z.string().trim().min(10).max(800).optional(),
  pricingCommissionLabel: z.string().trim().min(2).max(100).optional(),
  supportEmail: z.string().trim().email("Enter a valid support email").max(160).optional(),
  supportAddress: z.string().trim().min(2).max(240).optional(),
  footerTagline: z.string().trim().min(2).max(300).optional(),
  footerCopyright: z.string().trim().min(2).max(200).optional(),
});

export async function GET() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_cms_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({ settings: mapCmsRow(data as Record<string, unknown> | null) });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = CmsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message || "Invalid CMS settings." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = { updated_by: auth.user.id };

  if (d.announcementEnabled !== undefined) updates.announcement_enabled = d.announcementEnabled;
  if (d.announcementText !== undefined) updates.announcement_text = d.announcementText;
  if (d.announcementLink !== undefined) updates.announcement_link = d.announcementLink;
  if (d.heroTitle !== undefined) updates.hero_title = d.heroTitle;
  if (d.heroHighlight !== undefined) updates.hero_highlight = d.heroHighlight;
  if (d.heroSubtitle !== undefined) updates.hero_subtitle = d.heroSubtitle;
  if (d.heroImageUrl !== undefined) updates.hero_image_url = d.heroImageUrl;
  if (d.heroPrimaryCta !== undefined) updates.hero_primary_cta = d.heroPrimaryCta;
  if (d.heroSecondaryCta !== undefined) updates.hero_secondary_cta = d.heroSecondaryCta;
  if (d.marqueeEnabled !== undefined) updates.marquee_enabled = d.marqueeEnabled;
  if (d.marqueeHeading !== undefined) updates.marquee_heading = d.marqueeHeading;
  if (d.marqueeSubheading !== undefined) updates.marquee_subheading = d.marqueeSubheading;
  if (d.organiserHeading !== undefined) updates.organiser_heading = d.organiserHeading;
  if (d.organiserDescription !== undefined) updates.organiser_description = d.organiserDescription;
  if (d.aboutHeading !== undefined) updates.about_heading = d.aboutHeading;
  if (d.aboutDescription !== undefined) updates.about_description = d.aboutDescription;
  if (d.pricingCommissionLabel !== undefined) updates.pricing_commission_label = d.pricingCommissionLabel;
  if (d.supportEmail !== undefined) updates.support_email = d.supportEmail;
  if (d.supportAddress !== undefined) updates.support_address = d.supportAddress;
  if (d.footerTagline !== undefined) updates.footer_tagline = d.footerTagline;
  if (d.footerCopyright !== undefined) updates.footer_copyright = d.footerCopyright;

  const admin = createAdminClient();
  const { data: saved, error } = await admin
    .from("platform_cms_settings")
    .upsert({ id: 1, ...updates }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "CMS_UPDATE_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: mapCmsRow(saved as Record<string, unknown>) });
}
