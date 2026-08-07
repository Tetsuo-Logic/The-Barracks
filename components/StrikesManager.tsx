"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addStrike, removeStrike } from "@/app/actions/strikes";
import { Avatar } from "@/components/Avatar";
import { shortDate } from "@/lib/dates";
import type { Profile, Strike } from "@/lib/types";

// Organiser-only. Add a strike (with an optional reason) to whoever no-showed,
// and rescind one if you were feeling generous.
export function StrikesManager({
  profiles,
  strikes,
}: {
  profiles: Profile[];
  strikes: Strike[];
}) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const byPlayer = new Map<string, Strike[]>();
  for (const s of strikes) {
    (byPlayer.get(s.player_id) ?? byPlayer.set(s.player_id, []).get(s.player_id)!).push(s);
  }

  async function give(playerId: string) {
    setBusy(true);
    await addStrike(playerId, reason);
    setBusy(false);
    setReason("");
    setOpenFor(null);
    router.refresh();
  }

  async function rescind(id: string) {
    setBusy(true);
    await removeStrike(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {profiles.map((p) => {
        const list = (byPlayer.get(p.id) ?? []).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return (
          <div key={p.id} className="rounded-[3px] border border-rule bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={28} />
                <span className="text-ink">{p.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* strike marks */}
                <span className="flex gap-1">
                  {list.length === 0 ? (
                    <span className="text-sm text-ink-soft">clean</span>
                  ) : (
                    Array.from({ length: list.length }).map((_, i) => (
                      <span key={i} className="font-narrow text-[18px] font-bold leading-none text-flag">
                        ✕
                      </span>
                    ))
                  )}
                </span>
              </div>
            </div>

            {/* history */}
            {list.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 border-t border-rule pt-3">
                {list.map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-soft">
                      {shortDate(s.created_at.slice(0, 10))}
                      {s.reason ? ` · ${s.reason}` : ""}
                    </span>
                    <button
                      onClick={() => rescind(s.id)}
                      disabled={busy}
                      className="font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft hover:text-flag"
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* add */}
            {openFor === p.id ? (
              <div className="mt-3 flex gap-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="No-showed at Piltdown (optional)"
                  className="flex-1 rounded-[3px] border border-rule bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
                />
                <button
                  onClick={() => give(p.id)}
                  disabled={busy}
                  className="rounded-[3px] bg-flag px-4 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
                >
                  Strike
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setOpenFor(p.id);
                  setReason("");
                }}
                className="mt-3 rounded-[3px] border border-rule px-3 py-1.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
              >
                + Strike
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
