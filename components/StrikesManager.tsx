"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addStrike, removeStrike } from "@/app/actions/strikes";
import { addWarning, removeWarning } from "@/app/actions/warnings";
import { Avatar } from "@/components/Avatar";
import { shortDate } from "@/lib/dates";
import type { Profile, Strike, Warning } from "@/lib/types";

const WARNINGS_PER_STRIKE = 3;

// A plausible-looking case reference, stable per record: TB-STR-2026-0A3F.
function recordNo(kind: "STR" | "WRN", id: string, createdAt: string): string {
  const year = createdAt.slice(0, 4);
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(0, 4).toUpperCase() || "0000";
  return `TB-${kind}-${year}-${hex}`;
}

type Row = {
  id: string;
  kind: "strike" | "warning";
  reason: string | null;
  created_at: string;
};

// Organiser-only. The disciplinary record: strikes and warnings per player,
// each with a case number and what it was for. Add or rescind either.
export function StrikesManager({
  profiles,
  strikes,
  warnings,
}: {
  profiles: Profile[];
  strikes: Strike[];
  warnings: Warning[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<{ playerId: string; kind: "strike" | "warning" } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const rowsByPlayer = new Map<string, Row[]>();
  const push = (playerId: string, row: Row) => {
    (rowsByPlayer.get(playerId) ?? rowsByPlayer.set(playerId, []).get(playerId)!).push(row);
  };
  for (const s of strikes) push(s.player_id, { id: s.id, kind: "strike", reason: s.reason, created_at: s.created_at });
  for (const w of warnings) push(w.player_id, { id: w.id, kind: "warning", reason: w.reason, created_at: w.created_at });

  async function give(playerId: string, kind: "strike" | "warning") {
    setBusy(true);
    if (kind === "strike") await addStrike(playerId, reason);
    else await addWarning(playerId, reason);
    setBusy(false);
    setReason("");
    setAdding(null);
    router.refresh();
  }

  async function rescind(row: Row) {
    setBusy(true);
    if (row.kind === "strike") await removeStrike(row.id);
    else await removeWarning(row.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">{WARNINGS_PER_STRIKE} warnings roll into a strike.</p>
      {profiles.map((p) => {
        const rows = (rowsByPlayer.get(p.id) ?? []).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        const strikeN = rows.filter((r) => r.kind === "strike").length;
        const warnN = rows.filter((r) => r.kind === "warning").length;
        return (
          <div key={p.id} className="rounded-[3px] border border-rule bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={28} />
                <span className="text-ink">{p.name}</span>
              </div>
              <span className="flex items-center gap-2">
                {strikeN === 0 && warnN === 0 && <span className="text-sm text-ink-soft">clean</span>}
                {strikeN > 0 && (
                  <span className="font-narrow text-[18px] font-bold leading-none text-flag" title={`${strikeN} strikes`}>
                    {"✕".repeat(strikeN)}
                  </span>
                )}
                {warnN > 0 && (
                  <span className="font-narrow text-[18px] font-bold leading-none text-sand" title={`${warnN} warnings`}>
                    {"!".repeat(warnN)}
                  </span>
                )}
              </span>
            </div>

            {/* the record */}
            {rows.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2 border-t border-rule pt-3">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2">
                        <span
                          className="font-narrow text-[11px] font-semibold uppercase tracking-[0.06em]"
                          style={{ color: r.kind === "strike" ? "var(--color-flag)" : "var(--color-sand)" }}
                        >
                          {r.kind}
                        </span>
                        <span className="font-narrow text-[11px] tracking-[0.04em] text-ink-soft">
                          {recordNo(r.kind === "strike" ? "STR" : "WRN", r.id, r.created_at)}
                        </span>
                        <span className="text-xs text-ink-soft">{shortDate(r.created_at.slice(0, 10))}</span>
                      </p>
                      <p className="text-ink">{r.reason || "No reason recorded."}</p>
                    </div>
                    <button
                      onClick={() => rescind(r)}
                      disabled={busy}
                      className="shrink-0 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft hover:text-flag"
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* add a strike or warning */}
            {adding?.playerId === p.id ? (
              <div className="mt-3">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="What was the offence?"
                  className="mb-2 w-full rounded-[3px] border border-rule bg-paper px-3 py-2 text-ink outline-none focus:border-ink"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => give(p.id, adding.kind)}
                    disabled={busy}
                    className="rounded-[3px] px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
                    style={{ backgroundColor: adding.kind === "strike" ? "var(--color-flag)" : "var(--color-sand)" }}
                  >
                    {adding.kind === "strike" ? "Add strike" : "Add warning"}
                  </button>
                  <button onClick={() => setAdding(null)} disabled={busy} className="text-sm text-ink-soft">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setAdding({ playerId: p.id, kind: "warning" });
                    setReason("");
                  }}
                  className="rounded-[3px] border border-rule px-3 py-1.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
                >
                  + Warning
                </button>
                <button
                  onClick={() => {
                    setAdding({ playerId: p.id, kind: "strike" });
                    setReason("");
                  }}
                  className="rounded-[3px] border border-rule px-3 py-1.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
                >
                  + Strike
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
