"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressToSquare } from "@/lib/image";
import { Avatar } from "@/components/Avatar";

// Take or pick a photo, centre-crop to a circle, upload, and set it as your
// profile picture (shows everywhere). Self-contained — knows the current user.
export function AvatarUpload({
  name,
  colour,
  avatarUrl,
}: {
  name: string;
  colour: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");

      const blob = await compressToSquare(file, 512);
      const path = `${user.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // cache-bust so the new photo shows immediately (same path each time)
      const url = `${pub.publicUrl}?v=${Date.now().toString(36)}`;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (updErr) throw updErr;

      router.refresh();
    } catch {
      setError("Couldn't upload that. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} avatarUrl={avatarUrl} colour={colour} size={64} />
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink disabled:opacity-60"
        >
          {busy ? "Uploading" : avatarUrl ? "Change photo" : "Add a photo"}
        </button>
        {error && <p className="mt-1 text-sm text-flag">{error}</p>}
      </div>
    </div>
  );
}
