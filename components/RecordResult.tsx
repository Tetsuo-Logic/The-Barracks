"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordResults } from "@/app/actions/results";
import { Avatar } from "@/components/Avatar";
import { useAnnounce } from "@/components/Announce";
import type { Profile, Result } from "@/lib/domain";

// Record a game's result by tapping players into finishing order (winner first).
// Universal across games — the finishing order is enough for the wins-based
// Barracks table; richer per-game metrics come later.
export function RecordResult({
  competitionId,
  profiles,
  results,
  canEdit,
}: {
  competitionId: string;
  profiles: Profile[];
  results: Result[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const recorded = results
    .filter((r) => r.placement != null)
    .slice()
    .sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0));

  const [editing, setEditing] = useState(recorded.length === 0);
  const [order, setOrder] = useState<string[]>(recorded.map((r) => r.player_id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = profiles.filter((p) => !order.includes(p.id));

  async function save() {
    if (!order.length) {
      setError("Tap who played, in order.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await recordResults({ competitionId, order });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    announce(`Result logged · ${byId.get(order[0])?.name ?? "winner"} takes it 🏆`);
    setEditing(false);
    router.refresh();
  }

  // ── Recorded view ─────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div>
        <p className="label mb-2">Result</p>
        <ol className="flex flex-col gap-2">
          {recorded.map((r, i) => {
            const p = byId.get(r.player_id);
            return (
              <li
                key={r.player_id}
                className="flex items-center gap-3 rounded-[3px] border border-rule bg-card px-3 py-2.5"
                style={{ borderLeft: i === 0 ? "3px solid var(--color-sand)" : "3px solid var(--color-rule)" }}
              >
                <span className="w-5 font-narrow text-lg font-bold tabular-nums text-ink-soft">{i + 1}</span>
                <Avatar name={p?.name ?? "?"} avatarUrl={p?.avatar_url} colour={p?.colour} size={26} />
                <span className="flex-1 truncate text-ink">{p?.name ?? "—"}</span>
                {i === 0 && <span title="Winner">🏆</span>}
              </li>
            );
          })}
        </ol>
        {canEdit && (
          <button
            onClick={() => {
              setOrder(recorded.map((r) => r.player_id));
              setEditing(true);
            }}
            className="mt-4 w-full rounded-[3px] border border-rule py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft transition-colors hover:text-ink"
          >
            Re-record result
          </button>
        )}
      </div>
    );
  }

  // ── Entry view — tap in finishing order ───────────────────────────────────
  return (
    <div>
      <p className="label mb-2">Finishing order</p>
      {order.length === 0 ? (
        <p className="mb-3 rounded-[3px] border border-dashed border-rule px-3 py-4 text-center text-sm text-ink-soft">
          Tap players below in the order they finished — first tap = winner. 🏆
        </p>
      ) : (
        <ol className="mb-3 flex flex-col gap-2">
          {order.map((id, i) => {
            const p = byId.get(id);
            return (
              <li
                key={id}
                className="flex items-center gap-3 rounded-[3px] border border-rule bg-card px-3 py-2"
                style={{ borderLeft: i === 0 ? "3px solid var(--color-sand)" : "3px solid var(--color-rule)" }}
              >
                <span className="w-5 font-narrow text-lg font-bold tabular-nums text-ink-soft">{i + 1}</span>
                <Avatar name={p?.name ?? "?"} avatarUrl={p?.avatar_url} colour={p?.colour} size={24} />
                <span className="flex-1 truncate text-ink">{p?.name ?? "—"}</span>
                <button
                  onClick={() => setOrder(order.filter((x) => x !== id))}
                  className="font-mono text-xs uppercase tracking-[0.06em] text-ink-soft hover:text-flag"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {pool.length > 0 && (
        <>
          <p className="label mb-2">Tap who played</p>
          <div className="flex flex-wrap gap-2">
            {pool.map((p) => (
              <button
                key={p.id}
                onClick={() => setOrder([...order, p.id])}
                className="flex items-center gap-2 rounded-full border border-rule py-1 pl-1 pr-3 transition-colors hover:border-ink"
              >
                <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={22} />
                <span className="text-sm text-ink">{p.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p className="mt-3 text-sm text-flag">{error}</p>}

      <div className="mt-4 flex gap-3">
        {recorded.length > 0 && (
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
          >
            Cancel
          </button>
        )}
        <button
          onClick={save}
          disabled={busy || !order.length}
          className="flex-1 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
        >
          {busy ? "Saving" : "Save result 🏆"}
        </button>
      </div>
    </div>
  );
}
