import { useState } from "react";
import { X, Upload, Loader2, Trash2, User } from "lucide-react";

export interface ModalEventOption {
  id: string;
  organizationId: string;
  name: string;
  code: string;
}

export interface ModalCategoryOption {
  id: string;
  eventId: string;
  name: string;
}

export interface EditableContestantProfile {
  contestantId: string;
  organizationId: string;
  eventId: string;
  categoryId: string;
  eventName: string;
  categoryName: string;
  code: string;
  displayName: string;
  gender: string;
  bio: string;
  photoUrl: string;
  status: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
}

interface ContestantProfileModalProps {
  events: ModalEventOption[];
  categories: ModalCategoryOption[];
  defaultEventId?: string;
  editing?: EditableContestantProfile | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function ContestantProfileModal({
  events,
  categories,
  defaultEventId,
  editing,
  onClose,
  onSaved,
}: ContestantProfileModalProps) {
  const isEdit = Boolean(editing);

  const initialEventId = editing?.eventId || defaultEventId || events[0]?.id || "";
  const initialCatId =
    editing?.categoryId ||
    categories.find((c) => c.eventId === initialEventId)?.id ||
    categories[0]?.id ||
    "";

  const [eventId, setEventId] = useState(initialEventId);
  const [categoryId, setCategoryId] = useState(initialCatId);
  const [displayName, setDisplayName] = useState(editing?.displayName ?? "");
  const [publicCode, setPublicCode] = useState(editing?.code ?? "");
  const [gender, setGender] = useState(editing?.gender ?? "");
  const [bio, setBio] = useState(editing?.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(editing?.photoUrl ?? "");
  const [status, setStatus] = useState<"active" | "suspended">(
    editing?.status === "withdrawn" || editing?.status === "suspended" ? "suspended" : "active"
  );
  const [instagramUrl, setInstagramUrl] = useState(editing?.instagramUrl ?? "");
  const [tiktokUrl, setTiktokUrl] = useState(editing?.tiktokUrl ?? "");
  const [facebookUrl, setFacebookUrl] = useState(editing?.facebookUrl ?? "");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const selectedEvent = events.find((e) => e.id === eventId);
  const organizationId = editing?.organizationId ?? selectedEvent?.organizationId ?? "";
  const eventCategories = categories.filter((c) => c.eventId === (isEdit ? editing?.eventId || eventId : eventId));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;
    setErrorMsg("");
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "contestant-media");
      form.append("organizationId", organizationId);

      const res = await fetch("/api/v1/media/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.publicUrl) {
        setErrorMsg(data?.message || "Photo upload failed.");
        return;
      }
      setPhotoUrl(data.publicUrl as string);
    } catch {
      setErrorMsg("Network error uploading photo.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) {
      setErrorMsg("Select an event first.");
      return;
    }

    setErrorMsg("");
    setSaving(true);

    try {
      if (isEdit && editing) {
        const res = await fetch(`/api/v1/org/contestants/${editing.contestantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            categoryId: categoryId || undefined,
            displayName: displayName.trim(),
            publicCode: publicCode.trim(),
            gender: gender.trim(),
            bio: bio.trim(),
            photoUrl: photoUrl.trim(),
            status,
            instagramUrl: instagramUrl.trim(),
            tiktokUrl: tiktokUrl.trim(),
            facebookUrl: facebookUrl.trim(),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setErrorMsg(data?.message || "Failed to update contestant profile.");
          return;
        }
        onSaved(`Updated profile for "${displayName.trim()}".`);
        return;
      }

      const res = await fetch("/api/v1/org/contestants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          eventId,
          categoryId,
          displayName: displayName.trim(),
          publicCode: publicCode.trim(),
          gender: gender.trim(),
          bio: bio.trim(),
          photoUrl: photoUrl.trim(),
          instagramUrl: instagramUrl.trim(),
          tiktokUrl: tiktokUrl.trim(),
          facebookUrl: facebookUrl.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorMsg(data?.message || "Failed to add contestant profile.");
        return;
      }
      onSaved(`Added contestant "${data.contestant.display_name}" (${data.entry.public_code}).`);
    } catch {
      setErrorMsg("Network error saving contestant profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 border border-[#D9DBEA] shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#D9DBEA] pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4B35E0]">
              {isEdit ? `Edit Nominee / Contestant · ${editing?.code}` : "New Contestant Profile"}
            </span>
            <h3 className="font-heading font-extrabold text-xl text-[#0E1030]">
              {isEdit ? editing?.displayName : "Add Contestant Profile"}
            </h3>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMsg ? (
            <div className="p-3 rounded-xl bg-[#D13A3A]/10 border border-[#D13A3A]/20 text-[#D13A3A] font-semibold">
              {errorMsg}
            </div>
          ) : null}

          {/* Portrait Upload */}
          <div className="p-4 rounded-2xl bg-[#F6F7FC] border border-[#D9DBEA] flex items-center gap-4">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={displayName || "Contestant portrait"}
                className="w-16 h-16 rounded-2xl object-cover border border-white shadow-xs shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#0E1030] text-white flex items-center justify-center shrink-0">
                <User className="w-7 h-7 text-white/70" />
              </div>
            )}

            <div className="flex-1 space-y-1.5">
              <span className="block font-bold text-[#0E1030]">Profile Portrait (JPEG / PNG / WebP, max 4 MB)</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#4B35E0] text-white font-bold hover:bg-[#3B28B8] cursor-pointer">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>{uploading ? "Uploading..." : photoUrl ? "Replace Photo" : "Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading || !organizationId}
                    onChange={handlePhotoUpload}
                    className="sr-only"
                  />
                </label>
                {photoUrl ? (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl("")}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#D9DBEA] bg-white text-[#D13A3A] font-semibold hover:bg-[#D13A3A]/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {isEdit && editing ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Event</label>
                <div className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-bold text-[#0E1030]">
                  {editing.eventName}
                </div>
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Category *</label>
                {eventCategories.length > 0 ? (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                  >
                    {eventCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-bold text-[#0E1030]">
                    {editing.categoryName}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Event *</label>
                <select
                  value={eventId}
                  onChange={(e) => {
                    const nextEvId = e.target.value;
                    setEventId(nextEvId);
                    const firstCat = categories.find((c) => c.eventId === nextEvId);
                    if (firstCat) setCategoryId(firstCat.id);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} ({ev.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
                >
                  {eventCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Full / Stage Name *</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Efua Mensah"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Short Code *</label>
              <input
                type="text"
                required
                value={publicCode}
                onChange={(e) => setPublicCode(e.target.value.toUpperCase())}
                placeholder="e.g. FOS-EM26"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-mono text-[#0E1030]"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Gender (Optional)</label>
              <input
                type="text"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                placeholder="e.g. Female"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
              />
            </div>

            {isEdit ? (
              <div>
                <label className="block font-bold text-[#5B5F85] uppercase mb-1">Participation Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "suspended")}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm font-semibold text-[#0E1030]"
                >
                  <option value="active">Active (Visible &amp; Votable)</option>
                  <option value="suspended">Withdrawn / Suspended</option>
                </select>
              </div>
            ) : null}
          </div>

          <div>
            <label className="block font-bold text-[#5B5F85] uppercase mb-1">Profile Bio / Tagline</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short introduction shown on the public voting card..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-sm text-[#0E1030]"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Instagram URL</label>
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/..."
                className="w-full px-3 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">TikTok URL</label>
              <input
                type="url"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://tiktok.com/@..."
                className="w-full px-3 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030]"
              />
            </div>
            <div>
              <label className="block font-bold text-[#5B5F85] uppercase mb-1">Facebook URL</label>
              <input
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/..."
                className="w-full px-3 py-2 rounded-xl bg-[#F6F7FC] border border-[#D9DBEA] text-xs text-[#0E1030]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D9DBEA]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#D9DBEA] text-xs font-bold text-[#5B5F85] hover:bg-[#F6F7FC] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2.5 rounded-xl bg-[#4B35E0] text-white font-bold text-sm hover:bg-[#3B28B8] disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : isEdit ? "Save Profile" : "Add to Competition"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
