"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAttendance } from "@/app/actions/operations";
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
};

// Roll call. Expected (said in) vs present vs no-show, and — for the CO — the
// two buttons that settle it. Real `setAttendance`, same RPC as the phone.
export function RollCall({
  compId,
  roster,
  isCO,
  me,
  locked,
}: {
  compId: string;
  roster: RosterEntry[];
  isCO: boolean;
  me: string;
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expected = roster.filter((r) => r.rsvp === "in").length;
  const present = roster.filter((r) => r.attended === true).length;
  const noShow = roster.filter((r) => r.attended === false).length;
  const unrolled = roster.filter((r) => r.attended == null).length;
  const pct = expected ? Math.round((present / expected) * 100) : 0;

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
