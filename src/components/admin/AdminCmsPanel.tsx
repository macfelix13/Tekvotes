"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlatformCmsSettings, PlatformMarqueeItemRow } from "@/lib/cms";
import {
  Save,
  Upload,
  Plus,
  Trash2,
  Loader2,
  Megaphone,
  LayoutTemplate,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
} from "lucide-react";

interface AdminCmsPanelProps {
  initialSettings: PlatformCmsSettings;
  initialMarqueeItems: PlatformMarqueeItemRow[];
  onNotice: (notice: { kind: "ok" | "err"; text: string }) => void;
}

export function AdminCmsPanel({
  initialSettings,
  initialMarqueeItems,
  onNotice,
}: AdminCmsPanelProps) {
  const router = useRouter();
  const [form, setForm] = useState<PlatformCmsSettings>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  // Marquee new/edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemSubtitle, setItemSubtitle] = useState("");
  const [itemBadge, setItemBadge] = useState<"Event" | "Sponsor" | "Partner">("Partner");
  const [itemLogoUrl, setItemLogoUrl] = useState("");
  const [itemWebsiteUrl, setItemWebsiteUrl] = useState("");
  const [itemSortOrder, setItemSortOrder] = useState("50");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [busyMarqueeId, setBusyMarqueeId] = useState<string | null>(null);

  const updateField = <K extends keyof PlatformCmsSettings>(
    key: K,
    value: PlatformCmsSettings[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleUploadImage = async (
    file: File,
    onDone: (publicUrl: string) => void,
    setBusy: (b: boolean) => void
  ) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "event-media");
      fd.append("organizationId", "platform");

      const res = await fetch("/api/v1/media/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.publicUrl) {
        onNotice({ kind: "err", text: data?.message || "Image upload failed." });
        return;
      }
      onDone(data.publicUrl as string);
      onNotice({ kind: "ok", text: "Image uploaded to Supabase Storage." });
    } catch {
      onNotice({ kind: "err", text: "Network error uploading image." });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/v1/admin/cms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        onNotice({ kind: "err", text: data?.message || "Failed to save CMS settings." });
        return;
      }
      onNotice({
        kind: "ok",
        text: "Platform CMS settings saved! Homepage, Pricing, and Contact pages updated live.",
      });
      router.refresh();
    } catch {
      onNotice({ kind: "err", text: "Network error saving CMS settings." });
    } finally {
      setSavingSettings(false);
    }
  };

  const resetMarqueeForm = () => {
    setEditingItemId(null);
    setItemName("");
    setItemSubtitle("");
    setItemBadge("Partner");
    setItemLogoUrl("");
    setItemWebsiteUrl("");
    setItemSortOrder("50");
  };

  const startEditItem = (item: PlatformMarqueeItemRow) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemSubtitle(item.subtitle);
    setItemBadge(item.badge);
    setItemLogoUrl(item.logoUrl);
    setItemWebsiteUrl(item.websiteUrl);
    setItemSortOrder(String(item.sortOrder));
  };

  const handleSaveMarqueeItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    setBusyMarqueeId("save-item");
    try {
      const payload = {
        name: itemName.trim(),
        subtitle: itemSubtitle.trim(),
        badge: itemBadge,
        logoUrl: itemLogoUrl.trim(),
        websiteUrl: itemWebsiteUrl.trim(),
        sortOrder: Number(itemSortOrder) || 50,
      };
      const url = editingItemId
        ? `/api/v1/admin/cms/marquee/${editingItemId}`
        : "/api/v1/admin/cms/marquee";
      const method = editingItemId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        onNotice({ kind: "err", text: data?.message || "Could not save marquee logo." });
        return;
      }
      onNotice({
        kind: "ok",
        text: editingItemId
          ? `Updated marquee item "${itemName.trim()}".`
          : `Added "${itemName.trim()}" to homepage marquee.`,
      });
      resetMarqueeForm();
      router.refresh();
    } catch {
      onNotice({ kind: "err", text: "Network error saving marquee item." });
    } finally {
      setBusyMarqueeId(null);
    }
  };

  const handleToggleMarqueeActive = async (item: PlatformMarqueeItemRow) => {
    setBusyMarqueeId(item.id);
    try {
      const res = await fetch(`/api/v1/admin/cms/marquee/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      if (!res.ok) {
        onNotice({ kind: "err", text: "Could not toggle item status." });
        return;
      }
      onNotice({
        kind: "ok",
        text: `${item.name} is now ${!item.active ? "visible" : "hidden"} on the homepage marquee.`,
      });
      router.refresh();
    } catch {
      onNotice({ kind: "err", text: "Network error toggling item." });
    } finally {
      setBusyMarqueeId(null);
    }
  };

  const handleDeleteMarqueeItem = async (item: PlatformMarqueeItemRow) => {
    setBusyMarqueeId(item.id);
    try {
      const res = await fetch(`/api/v1/admin/cms/marquee/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        onNotice({ kind: "err", text: "Could not delete marquee item." });
        return;
      }
      onNotice({ kind: "ok", text: `Removed "${item.name}" from marquee.` });
      if (editingItemId === item.id) resetMarqueeForm();
      router.refresh();
    } catch {
      onNotice({ kind: "err", text: "Network error deleting item." });
    } finally {
      setBusyMarqueeId(null);
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Global Announcement Banner */}
        <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9DBEA] pb-3">
            <div>
              <span className="text-xs font-bold uppercase text-[#4B35E0] flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5" /> Top Announcement Bar
              </span>
              <h2 className="font-heading font-bold text-lg text-[#0E1030]">
                Site-Wide Flash Announcement Banner
              </h2>
            </div>
            <button
              type="button"
              onClick={() => updateField("announcementEnabled", !form.announcementEnabled)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
                form.announcementEnabled
                  ? "bg-[#E6F8F0] text-[#0F9D6B] border-[#0F9D6B]/40"
                  : "bg-[#F6F7FC] text-[#5B5F85] border-[#D9DBEA]"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {form.announcementEnabled ? "Banner Active" : "Banner Disabled"}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Announcement Text</label>
              <input
                type="text"
                value={form.announcementText}
                onChange={(e) => updateField("announcementText", e.target.value)}
                placeholder="e.g. Grand Finale voting for Face of Super Proud Queens closes Sunday at 11:59 PM!"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Optional Action Link</label>
              <input
                type="text"
                value={form.announcementLink}
                onChange={(e) => updateField("announcementLink", e.target.value)}
                placeholder="e.g. /competitions"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
          </div>
        </div>

        {/* Hero Section & Visual CMS */}
        <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 shadow-xs space-y-5">
          <div className="border-b border-[#D9DBEA] pb-3">
            <span className="text-xs font-bold uppercase text-[#4B35E0] flex items-center gap-1.5">
              <LayoutTemplate className="w-3.5 h-3.5" /> Homepage Hero Section
            </span>
            <h2 className="font-heading font-bold text-lg text-[#0E1030]">
              Hero Headline, Call-to-Actions &amp; Featured Visual
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Main Hero Title *</label>
              <input
                type="text"
                required
                value={form.heroTitle}
                onChange={(e) => updateField("heroTitle", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Gold Highlight Word *</label>
              <input
                type="text"
                required
                value={form.heroHighlight}
                onChange={(e) => updateField("heroHighlight", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-bold text-[#C77700]"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-[#5B5F85] uppercase mb-1">Hero Subtitle / Description *</label>
            <textarea
              rows={2}
              required
              value={form.heroSubtitle}
              onChange={(e) => updateField("heroSubtitle", e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4 text-xs items-end">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Primary Button Label *</label>
              <input
                type="text"
                required
                value={form.heroPrimaryCta}
                onChange={(e) => updateField("heroPrimaryCta", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Secondary Button Label *</label>
              <input
                type="text"
                required
                value={form.heroSecondaryCta}
                onChange={(e) => updateField("heroSecondaryCta", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
            <div className="p-3 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={form.heroImageUrl || "/images/hero-voter.jpg"}
                  alt="Hero preview"
                  className="w-12 h-10 rounded-lg object-cover border border-[#D9DBEA] shrink-0"
                />
                <div className="min-w-0">
                  <span className="block font-bold text-[#0E1030] truncate">Hero Image</span>
                  <span className="text-[10px] text-[#5B5F85] truncate block">{form.heroImageUrl}</span>
                </div>
              </div>
              <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] cursor-pointer shrink-0">
                {uploadingHero ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{uploadingHero ? "..." : "Upload"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingHero}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadImage(f, (url) => updateField("heroImageUrl", url), setUploadingHero);
                    e.target.value = "";
                  }}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Marquee Section & About / Pricing / Contact / Footer Settings */}
        <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9DBEA] pb-3">
            <div>
              <span className="text-xs font-bold uppercase text-[#4B35E0]">Site Copy &amp; Contact Information</span>
              <h2 className="font-heading font-bold text-lg text-[#0E1030]">
                Marquee Header, Organiser Section, Pricing &amp; Support Info
              </h2>
            </div>
            <button
              type="button"
              onClick={() => updateField("marqueeEnabled", !form.marqueeEnabled)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 cursor-pointer ${
                form.marqueeEnabled
                  ? "bg-[#E6F8F0] text-[#0F9D6B] border-[#0F9D6B]/40"
                  : "bg-[#F6F7FC] text-[#5B5F85] border-[#D9DBEA]"
              }`}
            >
              {form.marqueeEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {form.marqueeEnabled ? "Homepage Marquee Visible" : "Homepage Marquee Hidden"}
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Marquee Heading</label>
              <input
                type="text"
                value={form.marqueeHeading}
                onChange={(e) => updateField("marqueeHeading", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Marquee Subheading</label>
              <input
                type="text"
                value={form.marqueeSubheading}
                onChange={(e) => updateField("marqueeSubheading", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Organiser Callout Heading</label>
                <input
                  type="text"
                  value={form.organiserHeading}
                  onChange={(e) => updateField("organiserHeading", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Organiser Callout Description</label>
                <textarea
                  rows={3}
                  value={form.organiserDescription}
                  onChange={(e) => updateField("organiserDescription", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">About TekVotes Card Heading</label>
                <input
                  type="text"
                  value={form.aboutHeading}
                  onChange={(e) => updateField("aboutHeading", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">About TekVotes Card Description</label>
                <textarea
                  rows={3}
                  value={form.aboutDescription}
                  onChange={(e) => updateField("aboutDescription", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                />
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Pricing Page Commission Headline</label>
              <input
                type="text"
                value={form.pricingCommissionLabel}
                onChange={(e) => updateField("pricingCommissionLabel", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-bold text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Public Support Email</label>
              <input
                type="email"
                value={form.supportEmail}
                onChange={(e) => updateField("supportEmail", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Headquarters Address</label>
              <input
                type="text"
                value={form.supportAddress}
                onChange={(e) => updateField("supportAddress", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Footer Brand Tagline</label>
              <input
                type="text"
                value={form.footerTagline}
                onChange={(e) => updateField("footerTagline", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Footer Copyright Text</label>
              <input
                type="text"
                value={form.footerCopyright}
                onChange={(e) => updateField("footerCopyright", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#D9DBEA]">
            <button
              type="submit"
              disabled={savingSettings || uploadingHero}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#4B35E0] text-white font-bold text-xs hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{savingSettings ? "Publishing Changes..." : "Save & Publish All Site CMS Changes"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Marquee Sponsors, Partners & Featured Logos Manager */}
      <div className="bg-white rounded-2xl border border-[#D9DBEA] p-6 shadow-xs space-y-6">
        <div className="border-b border-[#D9DBEA] pb-3">
          <span className="text-xs font-bold uppercase text-[#4B35E0] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Homepage Logo Marquee Manager
          </span>
          <h2 className="font-heading font-bold text-lg text-[#0E1030]">
            Manage Sponsors, Partners &amp; Featured Event Logos ({initialMarqueeItems.length})
          </h2>
          <p className="text-xs text-[#5B5F85] mt-0.5">
            Active published competitions automatically appear in the marquee alongside the custom Sponsor, Partner, and Event logos you add below.
          </p>
        </div>

        <form onSubmit={handleSaveMarqueeItem} className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <strong className="text-sm text-[#0E1030]">
              {editingItemId ? "Edit Marquee Logo / Partner" : "Add New Sponsor, Partner or Event Logo to Marquee"}
            </strong>
            {editingItemId ? (
              <button
                type="button"
                onClick={resetMarqueeForm}
                className="text-xs font-bold text-[#5B5F85] hover:text-[#0E1030] cursor-pointer"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Name *</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="e.g. MTN Ghana"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Subtitle / Role</label>
              <input
                type="text"
                value={itemSubtitle}
                onChange={(e) => setItemSubtitle(e.target.value)}
                placeholder="e.g. Gold Sponsor / Payment Partner"
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Badge Type</label>
              <select
                value={itemBadge}
                onChange={(e) => setItemBadge(e.target.value as "Event" | "Sponsor" | "Partner")}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-[#0E1030] font-semibold"
              >
                <option value="Partner">Partner</option>
                <option value="Sponsor">Sponsor</option>
                <option value="Event">Event</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Display Order</label>
              <input
                type="number"
                value={itemSortOrder}
                onChange={(e) => setItemSortOrder(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] font-mono text-[#0E1030]"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Logo Image URL (or Upload)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={itemLogoUrl}
                  onChange={(e) => setItemLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-[#0E1030]"
                />
                <label className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#E8E5FD] text-[#4B35E0] font-bold hover:bg-[#DBD5FC] cursor-pointer shrink-0">
                  {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>Upload</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadImage(f, (url) => setItemLogoUrl(url), setUploadingLogo);
                      e.target.value = "";
                    }}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Click Link URL (Optional)</label>
              <input
                type="text"
                value={itemWebsiteUrl}
                onChange={(e) => setItemWebsiteUrl(e.target.value)}
                placeholder="https://... or /competitions/..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-[#0E1030]"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={busyMarqueeId === "save-item" || uploadingLogo}
                className="w-full py-2.5 px-4 rounded-xl bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{editingItemId ? "Save Item Changes" : "Add to Marquee"}</span>
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#D9DBEA] text-[#5B5F85] uppercase">
                <th className="py-3 px-3">Logo / Item</th>
                <th className="py-3 px-3">Badge</th>
                <th className="py-3 px-3">Link</th>
                <th className="py-3 px-3">Order</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DBEA]">
              {initialMarqueeItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#F6F7FC]">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      {item.logoUrl ? (
                        <img
                          src={item.logoUrl}
                          alt={item.name}
                          className="w-9 h-9 rounded-lg object-cover border border-[#D9DBEA]"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#0E1030] text-[#F2A900] font-heading font-bold flex items-center justify-center">
                          {item.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-[#0E1030]">{item.name}</div>
                        <div className="text-[11px] text-[#5B5F85]">{item.subtitle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-[#E8E5FD] text-[#4B35E0] font-bold">
                      {item.badge}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#5B5F85] max-w-[180px] truncate">
                    {item.websiteUrl || "—"}
                  </td>
                  <td className="py-3 px-3 font-mono">{item.sortOrder}</td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      disabled={busyMarqueeId === item.id}
                      onClick={() => void handleToggleMarqueeActive(item)}
                      className={`px-2.5 py-1 rounded-full font-bold cursor-pointer ${
                        item.active
                          ? "bg-[#E6F8F0] text-[#0F9D6B]"
                          : "bg-[#D9DBEA] text-[#5B5F85]"
                      }`}
                    >
                      {item.active ? "Visible" : "Hidden"}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right space-x-1.5">
                    <button
                      type="button"
                      onClick={() => startEditItem(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D9DBEA] bg-white text-[#0E1030] font-semibold hover:border-[#4B35E0] cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={busyMarqueeId === item.id}
                      onClick={() => void handleDeleteMarqueeItem(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#D13A3A]/30 bg-white text-[#D13A3A] font-semibold hover:bg-[#D13A3A]/10 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
