"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAttendance } from "@/app/actions/operations";
import { approveLate, nudgeUnconfirmed } from "@/app/actions/roster";
import { Avatar } from "@/components/Avatar";
import { Tag, Meter } from "@/components/hq/Kit";

export type RosterEntry = {
  id: string;
  name: string;
  avatar_url: string | null;
  colour: string;
  rsvp: "in" | "out" | "maybe" | null;
  attended: boolean | null;
  captain: boolean;
  acting: boolean;
  /** Where they stand against the confirmation window — see lib/rsvp. */
  confirm: "confirmed" | "pending" | "lapsed" | null;
};

// Roll call. Expected (said in) vs present vs no-show, and — for the CO — the
// two buttons that settle it. Real `setAttendance`, same RPC as the phone.
export function RollCall({
  compId,
  roster,
  isCO,
  me,
  locked,
  confirmBy,
}: {
  compId: string;
  roster: RosterEntry[];
  isCO: boolean;
  me: string;
  locked: boolean;
  /** The confirmation deadline, if this Operation came from a muster. */
  confirmBy?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lapsed answers don't count as expected — that's what the deadline is for.
  const expected = roster.filter((r) => r.rsvp === "in" && r.confirm !== "lapsed").length;
  const present = roster.filter((r) => r.attended === true).length;
  const noShow = roster.filter((r) => r.attended === false).length;
  const unrolled = roster.filter((r) => r.attended == null).length;
  const pct = expected ? Math.round((present / expected) * 100) : 0;

  const pendingCount = roster.filter((r) => r.confirm === "pending").length;
  const lapsedCount = roster.filter((r) => r.confirm === "lapsed").length;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, id: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function mark(playerId: string, isPresent: boolean) {
    setBusyId(playerId);
    setError(null);
    startTransition(async () => {
      const res = await setAttendance(compId, playerId, isPresent);
      setBusyId(null);
      if (!res.ok) {
        setError(res.error ?? "Roll call refused.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-4 gap-3 border-b border-rule pb-3">
        <Count v={expected} l="Expected" />
        <Count v={present} l="Present" tone="var(--color-moss)" />
        <Count v={noShow} l="No-show" tone="var(--color-flag)" />
        <Count v={unrolled} l="Unrolled" tone="var(--color-sand)" />
      </div>
      <Meter pct={pct} tone={pct >= 60 ? "live" : "warn"} />

      {/* The confirmation window, stated where the roster is read. Answers
          carried over from the muster aren't commitments until someone says so
          themselves — this is where a Captain can see who still owes one. */}
      {(pendingCount > 0 || lapsedCount > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule pt-3">
          <span className="hq-mono text-[11px] uppercase tracking-[0.1em]">
            {pendingCount > 0 && (
              <span style={{ color: "var(--color-sand)" }}>{pendingCount} to confirm</span>
            )}
            {pendingCount > 0 && lapsedCount > 0 && <span className="text-ink-soft"> · </span>}
            {lapsedCount > 0 && (
              <span style={{ color: "var(--color-flag)" }}>{lapsedCount} missed the window</span>
            )}
            {confirmBy && (
              <span className="text-ink-soft">
                {" "}
                · by {new Date(confirmBy).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </span>
          {isCO && pendingCount > 0 && (
            <button
              disabled={pending && busyId === "nudge"}
              onClick={() => run(() => nudgeUnconfirmed(compId), "nudge")}
              className="hq-label ml-auto shrink-0 rounded-[3px] border border-rule px-2.5 py-1.5 transition-colors hover:border-sand hover:text-ink disabled:opacity-50"
            >
              Chase the {pendingCount}
            </button>
          )}
        </div>
      )}

      <ul className="mt-3 flex flex-col">
        {roster.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 border-b border-rule/50 py-1.5 last:border-0">
            <Avatar name={p.name} avatarUrl={p.avatar_url} colour={p.colour} size={24} />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {p.id === me ? "You" : p.name}
            </span>
            {p.acting && <Tag tone="warn">Acting</Tag>}
            {p.captain && !p.acting && <Tag tone="warn">Captain</Tag>}
            <span
              className="hq-mono w-12 shrink-0 text-right text-[10px] uppercase tracking-[0.1em]"
              style={{
                color:
                  p.rsvp === "in"
                    ? "var(--color-moss)"
                    : p.rsvp === "out"
                      ? "var(--color-flag)"
                      : "var(--color-ink-soft)",
              }}
            >
              {p.rsvp ?? "silent"}
            </span>
            <span className="w-[112px] shrink-0 text-right">
              {p.confirm === "pending" ? (
                <span
                  className="hq-mono text-[10px] uppercase tracking-[0.1em]"
                  style={{ color: "var(--color-sand)" }}
                >
                  Unconfirmed
                </span>
              ) : p.confirm === "lapsed" ? (
                isCO ? (
                  <button
                    disabled={pending && busyId === p.id}
                    onClick={() => run(() => approveLate(compId, p.id), p.id)}
                    className="hq-mono rounded-[3px] border px-2 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors disabled:opacity-50"
                    style={{ borderColor: "var(--color-flag)", color: "var(--color-flag)" }}
                    title="They missed the confirmation window — put them back on"
                  >
                    Approve late
                  </button>
                ) : (
                  <span
                    className="hq-mono text-[10px] uppercase tracking-[0.1em]"
                    style={{ color: "var(--color-flag)" }}
                  >
                    Missed window
                  </span>
                )
              ) : null}
            </span>
            {isCO && !locked ? (
              <span className="flex shrink-0 gap-1">
                <RollBtn
                  active={p.attended === true}
                  tone="var(--color-moss)"
                  disabled={pending && busyId === p.id}
                  onClick={() => mark(p.id, true)}
                >
                  Present
                </RollBtn>
                <RollBtn
                  active={p.attended === false}
                  tone="var(--color-flag)"
                  disabled={pending && busyId === p.id}
                  onClick={() => mark(p.id, false)}
                >
                  No-show
                </RollBtn>
              </span>
            ) : (
              <span
                className="hq-mono w-[132px] shrink-0 text-right text-[10px] uppercase tracking-[0.12em]"
                style={{
                  color:
                    p.attended === true
                      ? "var(--color-moss)"
                      : p.attended === false
                        ? "var(--color-flag)"
                        : "var(--color-rule)",
                }}
              >
                {p.attended === true ? "Present" : p.attended === false ? "No-show" : "—"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--color-flag)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function Count({ v, l, tone }: { v: number; l: string; tone?: string }) {
  return (
    <div>
      <div className="hq-readout text-[22px] font-bold leading-none" style={{ color: tone }}>
        {v}
      </div>
      <div className="hq-label mt-1">{l}</div>
    </div>
  );
}

function RollBtn({
  children,
  active,
  tone,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  tone: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-40"
      style={{
        borderColor: active ? tone : "var(--color-rule)",
        backgroundColor: active ? tone : "transparent",
        color: active ? "#0b100e" : "var(--color-ink-soft)",
      }}
    >
      {children}
    </button>
  );
}
