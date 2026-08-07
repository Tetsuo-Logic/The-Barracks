"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPresident } from "@/app/actions/board";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/types";

// Owner-only: hand the President title to any player. You keep all admin powers.
export function PresidentPicker({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function name(id: string) {
    setBusy(id);
    await setPresident(id);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => name(p.id)}
          disabled={busy !== null || p.is_president}
          className="flex items-center justify-between rounded-[3px] border px-4 py-3 disabled:opacity-100"
          style={{
            borderColor: p.is_president ? "var(--color-sand)" : "var(--color-rule)",
            backgroundColor: p.is_president ? "rgba(201,162,39,0.08)" : "transparent",
          }}
        >
          <span className="flex items-center gap-2">
            <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={26} />
            <span className="text-ink">{p.name}</span>
          </span>
          <span className="font-narrow text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: p.is_president ? "var(--color-sand)" : "var(--color-ink-soft)" }}>
            {p.is_president ? "President" : busy === p.id ? "Naming…" : "Make president"}
          </span>
        </button>
      ))}
    </div>
  );
}
