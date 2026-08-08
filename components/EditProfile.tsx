"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/app/actions/profile";
import { AvatarUpload } from "@/components/AvatarUpload";
import type { Profile } from "@/lib/types";

// In-place editing of your own profile (§5).
export function EditProfile({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.name);
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [platform, setPlatform] = useState(profile.home_course ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
      >
        Edit profile
      </button>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveProfile({ name, nickname, home_course: platform });
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-[3px] border border-rule bg-card p-4">
      <div className="mb-4">
        <AvatarUpload name={profile.name} colour={profile.colour} avatarUrl={profile.avatar_url} />
      </div>

      <label className="label mb-1 block">Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink" />

      <label className="label mb-1 block">Nickname</label>
      <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 font-narrow uppercase tracking-[0.08em] text-ink outline-none focus:border-ink" />

      <label className="label mb-1 block">Platform</label>
      <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="PS5, Xbox, PC…" className="mb-3 w-full rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink" />

      {error && <p className="mb-2 text-sm text-flag">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => setOpen(false)} className="rounded-[3px] border border-rule px-4 py-2 text-sm text-ink-soft">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-1 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60">
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}
