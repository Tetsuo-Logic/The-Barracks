"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  startOperation,
  closeOperation,
  advanceGames,
  setAttendance,
} from "@/app/actions/operations";
import { Avatar } from "@/components/Avatar";
import { useAnnounce } from "@/components/Announce";
import type { Competition, Profile } from "@/lib/domain";
import type { RsvpWithPlayer } from "@/lib/queries";

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function durationText(startIso: string, endIso: string) {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// The Operation Room — a scheduled event goes live: roll call, a lightweight
// realtime games count any participant can advance, then close & archive.
// Participation, not competition.
export function OperationRoom({
  comp,
  rsvps,
  profiles,
  currentUserId,
  isCO,
}: {
  comp: Competition;
  rsvps: RsvpWithPlayer[];
  profiles: Profile[];
  currentUserId: string;
  isCO: boolean;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [gamesEdit, setGamesEdit] = useState("");

  // Live: refresh whenever the room row or its roll call changes (RLS-scoped).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`op-${comp.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competitions", filter: `id=eq.${comp.id}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rsvps", filter: `competition_id=eq.${comp.id}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [comp.id, router]);

  const rsvpByPlayer = new Map(rsvps.map((r) => [r.player_id, r]));
  const started = comp.started_at != null;
  const finished = comp.finished_at != null;

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      announce(res.error ?? "Something went wrong.");
      return;
    }
    if (ok) announce(ok);
    router.refresh();
  }

  if (comp.status === "cancelled") {
    return <p className="py-8 text-center text-ink-soft">This operation was cancelled.</p>;
  }

  // ── Standing by (not started) ──────────────────────────────────────────────
  if (!started) {
    const expected = profiles.filter((p) => rsvpByPlayer.get(p.id)?.status === "in");
    return (
      <div>
        <div className="rounded-[3px] border border-rule bg-card p-5 text-center">
          <p className="font-narrow text-sm font-semibold uppercase tracking-[0.1em] text-ink-soft">Standing by</p>
          <p className="mt-1 text-[17px] text-ink">{expected.length} expected to deploy</p>
        </div>
        {isCO ? (
          <button
            onClick={() => run(() => startOperation(comp.id), "Operation live 🟢")}
            disabled={busy}
            className="mt-4 w-full rounded-[3px] bg-moss py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
          >
            ▶ Start Operation
          </button>
        ) : (
          <p className="mt-4 text-center text-sm text-ink-soft">The CO opens the room when the night kicks off.</p>
        )}
      </div>
    );
  }

  // ── Completed ──────────────────────────────────────────────────────────────
  if (finished) {
    const deployed = rsvps.filter((r) => r.attended === true).length;
    return (
      <div>
        <div className="rounded-[3px] border border-rule bg-card p-4">
          <p className="label mb-3" style={{ color: "var(--color-sand)" }}>Operation complete</p>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-ink-soft">Started</span>
            <span className="text-right font-narrow tabular-nums text-ink">{hhmm(comp.started_at!)}</span>
            <span className="text-ink-soft">Finished</span>
            <span className="text-right font-narrow tabular-nums text-ink">{hhmm(comp.finished_at!)}</span>
            <span className="text-ink-soft">Duration</span>
            <span className="text-right font-narrow tabular-nums text-ink">{durationText(comp.started_at!, comp.finished_at!)}</span>
            <span className="text-ink-soft">Games</span>
            <span className="text-right font-narrow tabular-nums text-ink">{comp.games_count}</span>
            <span className="text-ink-soft">Deployed</span>
            <span className="text-right font-narrow tabular-nums text-ink">{deployed}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Live ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="pulse h-2 w-2 rounded-full bg-moss" aria-hidden />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-moss">Live</span>
        </span>
        <span className="font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
          Since {hhmm(comp.started_at!)}
        </span>
      </div>

      {/* Games count — any participant can advance it */}
      <div className="rounded-[3px] border border-rule bg-card p-5 text-center">
        <p className="label">Games played</p>
        <p className="my-1 font-narrow text-[44px] font-bold leading-none tabular-nums text-ink">{comp.games_count}</p>
        <button
          onClick={() => run(() => advanceGames(comp.id, comp.games_count))}
          disabled={busy}
          className="mt-2 w-full rounded-[3px] bg-ink py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
        >
          + New game
        </button>
        <p className="mt-2 text-xs text-ink-soft">Tap when you start another one — no pressure, the CO can fix the total at the end.</p>
      </div>

      {/* Roll call */}
      <div className="mt-6">
        <p className="label mb-2">Roll call ✋</p>
        <ul className="flex flex-col gap-2">
          {profiles.map((p) => {
            const att = rsvpByPlayer.get(p.id)?.attended;
            return (
              <li key={p.id} className="flex items-center gap-2">
                <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={24} />
                <span className="flex-1 truncate text-ink">{p.id === currentUserId ? "You" : p.name}</span>
                {isCO ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => run(() => setAttendance(comp.id, p.id, true))}
                      disabled={busy}
                      className="rounded-[3px] border px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em]"
                      style={{
                        backgroundColor: att === true ? "var(--color-moss)" : "transparent",
                        borderColor: att === true ? "var(--color-moss)" : "var(--color-rule)",
                        color: att === true ? "var(--color-paper)" : "var(--color-ink-soft)",
                      }}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => run(() => setAttendance(comp.id, p.id, false))}
                      disabled={busy}
                      className="rounded-[3px] border px-3 py-1 font-narrow text-xs font-semibold uppercase tracking-[0.06em]"
                      style={{
                        backgroundColor: att === false ? "var(--color-flag)" : "transparent",
                        borderColor: att === false ? "var(--color-flag)" : "var(--color-rule)",
                        color: att === false ? "var(--color-paper)" : "var(--color-ink-soft)",
                      }}
                    >
                      No-show
                    </button>
                  </div>
                ) : (
                  <span
                    className="font-narrow text-xs font-semibold uppercase tracking-[0.08em]"
                    style={{ color: att === true ? "var(--color-moss)" : att === false ? "var(--color-flag)" : "var(--color-rule)" }}
                  >
                    {att === true ? "Present" : att === false ? "No-show" : "—"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {isCO && !closing && (
        <button
          onClick={() => {
            setGamesEdit(String(comp.games_count));
            setClosing(true);
          }}
          disabled={busy}
          className="mt-6 w-full rounded-[3px] border border-ink-soft/60 py-2.5 font-mono text-sm font-semibold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-ink-soft hover:text-ink disabled:opacity-50"
        >
          ■ End Operation
        </button>
      )}

      {isCO && closing && (
        <div className="mt-6 rounded-[3px] border border-rule bg-card p-4">
          <p className="label mb-3">Close operation</p>
          <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 text-sm">
            <span className="text-ink-soft">Started</span>
            <span className="text-right font-narrow tabular-nums text-ink">{hhmm(comp.started_at!)}</span>
            <span className="text-ink-soft">Deployed</span>
            <span className="text-right font-narrow tabular-nums text-ink">
              {rsvps.filter((r) => r.attended === true).length}
            </span>
            <span className="text-ink-soft">Games</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={gamesEdit}
              onChange={(e) => setGamesEdit(e.target.value)}
              className="w-full rounded-[3px] border border-rule bg-paper px-3 py-2 text-right font-narrow tabular-nums text-ink outline-none focus:border-ink"
            />
          </div>
          <p className="mt-2 text-xs text-ink-soft">Fix the games total if anyone forgot to tap during the night.</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => setClosing(false)}
              className="rounded-[3px] border border-rule px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink-soft"
            >
              Back
            </button>
            <button
              onClick={() => run(() => closeOperation(comp.id, Number(gamesEdit) || 0), "Operation closed · archived")}
              disabled={busy}
              className="flex-1 rounded-[3px] bg-ink px-4 py-2 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              Confirm &amp; archive
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
