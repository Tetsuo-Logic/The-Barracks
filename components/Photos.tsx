"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { recordPhoto } from "@/app/actions/photos";
import { Avatar } from "@/components/Avatar";
import type { Photo, Profile } from "@/lib/types";

export type PhotoWithUrl = Photo & { url: string };

// Grid + camera + full-screen viewer (§7).
export function Photos({
  competitionId,
  photos,
  profiles,
}: {
  competitionId: string;
  photos: PhotoWithUrl[];
  profiles: Profile[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();

    try {
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading ${i + 1} of ${files.length}`);
        const { blob, width, height } = await compressImage(files[i]);
        const path = `${competitionId}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const res = await recordPhoto({
          competitionId,
          storagePath: path,
          width,
          height,
        });
        if (!res.ok) throw new Error(res.error);
      }
      router.refresh();
    } catch {
      setError("Couldn't upload. Try again.");
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        className="hidden"
      />

      {photos.length === 0 ? (
        <p className="py-10 text-center text-ink-soft">
          No photos yet. Someone bring a camera.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setViewing(i)}
              className="relative aspect-square overflow-hidden rounded-[2px] bg-card"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? ""}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-flag">{error}</p>}

      {/* camera button pinned bottom-right of the tab content */}
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-5 z-10 rounded-full bg-ink px-5 py-3 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper shadow-[var(--shadow-card)] disabled:opacity-60"
      >
        {busy ? (progress ?? "Working") : "+ Photo"}
      </button>

      {viewing != null && (
        <Viewer
          photos={photos}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          profileById={profileById}
        />
      )}
    </div>
  );
}

function Viewer({
  photos,
  index,
  onIndex,
  onClose,
  profileById,
}: {
  photos: PhotoWithUrl[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  profileById: Map<string, Profile>;
}) {
  const p = photos[index];
  const uploader = p.uploader_id ? profileById.get(p.uploader_id) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <button onClick={onClose} className="p-4 text-right font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper">
        Close
      </button>
      <div className="flex flex-1 items-center justify-center px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={p.caption ?? ""} className="max-h-full max-w-full object-contain" />
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3">
        <button
          onClick={() => onIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          className="font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-30"
        >
          Prev
        </button>
        <div className="flex items-center gap-2 text-paper">
          {uploader && (
            <Avatar name={uploader.name} avatarUrl={uploader.avatar_url} colour={uploader.colour} size={22} />
          )}
          <span className="text-sm">{p.caption ?? uploader?.name ?? ""}</span>
        </div>
        <button
          onClick={() => onIndex(Math.min(photos.length - 1, index + 1))}
          disabled={index === photos.length - 1}
          className="font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}
