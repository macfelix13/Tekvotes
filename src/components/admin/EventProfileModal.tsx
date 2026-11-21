"use client";

import { useEffect, useState } from "react";
import { X, Upload, Loader2, Trash2, Images } from "lucide-react";

export interface EditableEventProfile {
  eventId: string;
  organizationId: string;
  name: string;
  code: string;
  eventType: string;
  description: string;
  venue: string;
  bannerUrl: string;
}

interface GalleryItem {
  id: string;
  image_url: string;
  caption: string;
}

interface EventProfileModalProps {
  event: EditableEventProfile;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function EventProfileModal({ event, onClose, onSaved }: EventProfileModalProps) {
  const [name, setName] = useState(event.name);
  const [publicCode, setPublicCode] = useState(event.code);
  const [eventType, setEventType] = useState(event.eventType || "beauty_pageant");
  const [venue, setVenue] = useState(event.venue || "");
  const [description, setDescription] = useState(event.description || "");
  const [bannerUrl, setBannerUrl] = useState(event.bannerUrl || "");

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [newGalleryCaption, setNewGalleryCaption] = useState("");
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`/api/v1/org/events/${event.eventId}/gallery`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.items)) setGalleryItems(d.items as GalleryItem[]);
      })
      .catch(() => {});
  }, [event.eventId]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "event-media");
      form.append("organizationId", event.organizationId);

      const res = await fetch("/api/v1/media/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.publicUrl) {
        setErrorMsg(data?.message || "Banner upload failed.");
        return;
      }
      setBannerUrl(data.publicUrl as string);
    } catch {
      setErrorMsg("Network error uploading banner.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg("");
    setUploadingGallery(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "event-media");
      form.append("organizationId", event.organizationId);

      const uploadRes = await fetch("/api/v1/media/upload", { method: "POST", body: form });
      const uploadData = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadData?.publicUrl) {
        setErrorMsg(uploadData?.message || "Gallery photo upload failed.");
        return;
      }

      const saveRes = await fetch(`/api/v1/org/events/${event.eventId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: event.organizationId,
          imageUrl: uploadData.publicUrl,
          caption: newGalleryCaption.trim() || event.name,
        }),
      });
      const saveData = await saveRes.json().catch(() => null);
      if (!saveRes.ok || !saveData?.item) {
        setErrorMsg(saveData?.message || "Could not save gallery photo.");
        return;
      }

      setGalleryItems((prev) => [saveData.item as GalleryItem, ...prev]);
      setNewGalleryCaption("");
    } catch {
      setErrorMsg("Network error uploading gallery photo.");
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  };

  const handleDeleteGalleryPhoto = async (mediaId: string) => {
    try {
      const res = await fetch(`/api/v1/org/events/${event.eventId}/gallery?mediaId=${mediaId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setGalleryItems((prev) => prev.filter((item) => item.id !== mediaId));
      }
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/org/events/${event.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          publicCode: publicCode.trim(),
          eventType,
          venue: venue.trim(),
          description: description.trim(),
          bannerUrl: bannerUrl.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(data?.message || "Failed to update event profile.");
        return;
      }
      onSaved(`Updated event profile & gallery for "${name.trim()}".`);
    } catch {
      setErrorMsg("Network error saving event profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 border border-[#D9DBEA] shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#D9DBEA] pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B35E0]">
              Edit Event Profile &amp; Gallery · {event.code}
            </span>
            <h3 className="font-heading font-extrabold text-xl text-[#0E1030]">{event.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-full hover:bg-[#F6F7FC] cursor-pointer"
          >
            <X className="w-5 h-5 text-[#5B5F85]" />
          </button>
        </div>

        {errorMsg ? (
          <div className="p-3 rounded-xl bg-[#D13A3A]/10 border border-[#D13A3A]/30 text-xs font-semibold text-[#D13A3A]">
            {errorMsg}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[#5B5F85] uppercase mb-1.5">Event Cover Banner</label>
            <div className="space-y-2">
              {bannerUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-[#D9DBEA] aspect-[16/8] bg-[#0E1030]">
                  <img src={bannerUrl} alt={name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setBannerUrl("")}
                    className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/70 text-white text-[11px] font-bold hover:bg-[#D13A3A] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              ) : null}
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#E8E5FD] text-[#4B35E0] font-bold hover:bg-[#DBD5FC] cursor-pointer">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{uploading ? "Uploading..." : bannerUrl ? "Replace Cover Banner" : "Upload Cover Banner"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={handleBannerUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Event Gallery Photos Section */}
          <div className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0E1030] inline-flex items-center gap-1.5">
                <Images className="w-4 h-4 text-[#4B35E0]" /> Event Photo Gallery ({galleryItems.length})
              </span>
              <span className="text-[11px] text-[#5B5F85]">Shown in the Event &quot;Gallery&quot; tab</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newGalleryCaption}
                onChange={(e) => setNewGalleryCaption(e.target.value)}
                placeholder="Optional photo caption before uploading..."
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#D9DBEA] text-xs text-[#0E1030]"
              />
              <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] cursor-pointer shrink-0">
                {uploadingGallery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>{uploadingGallery ? "Uploading..." : "Add Gallery Photo"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploadingGallery}
                  onChange={handleGalleryUpload}
                  className="sr-only"
                />
              </label>
            </div>

            {galleryItems.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {galleryItems.map((g) => (
                  <div
                    key={g.id}
                    className="relative group rounded-xl overflow-hidden border border-[#D9DBEA] aspect-square bg-[#0E1030]"
                  >
                    <img src={g.image_url} alt={g.caption} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => void handleDeleteGalleryPhoto(g.id)}
                      title="Remove gallery photo"
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/75 text-white hover:bg-[#D13A3A] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#5B5F85]">
                No custom event gallery photos added yet. Contestant portraits and the event cover banner are automatically included in the public Gallery tab.
              </p>
            )}
          </div>

          <div>
            <label className="block font-bold text-[#5B5F85] uppercase mb-1">Event Title *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Short Code *</label>
              <input
                type="text"
                required
                maxLength={16}
                value={publicCode}
                onChange={(e) => setPublicCode(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] font-mono text-sm text-[#0E1030]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Competition Type</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              >
                <option value="beauty_pageant">Beauty Pageant</option>
                <option value="award_show">Award Show</option>
                <option value="talent_show">Talent Show</option>
                <option value="campus_contest">Campus Contest</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#5B5F85] uppercase mb-1">Venue / Location</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="e.g. National Theatre, Accra"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#5B5F85] uppercase mb-1">Event Description / Overview</label>
            <textarea
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the competition, rules, or schedule..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D9DBEA]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#5B5F85] hover:text-[#0E1030] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading || uploadingGallery}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white text-xs font-bold hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>{saving ? "Saving..." : "Save Event Profile"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
