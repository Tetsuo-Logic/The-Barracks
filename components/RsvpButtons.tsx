"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRsvp, backOut } from "@/app/actions/rsvps";
import type { RsvpStatus } from "@/lib/types";

const OPTIONS: { value: RsvpStatus; label: string; fill: string }[] = [
  { value: "in", label: "In", fill: "var(--color-moss)" },
  { value: "out", label: "Out", fill: "var(--color-flag)" },
];

// Once you say "in" you're committed: the choices collapse to a "Back out"
// button. Inside the 24h lock, backing out opens a strike hearing where you
// enter your reasons (§ back-out flow).
export function RsvpButtons({
  competitionId,
  current,
  locked = false,
}: {
  competitionId: string;
  current: RsvpStatus | null;
  locked?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<RsvpStatus | null>(current);
  const [error, setError] = useState<string | null>(null);
  const [backingOut, setBackingOut] = useState(false);
  const [reasons, setReasons] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function pick(next: RsvpStatus) {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const res = await setRsvp(competitionId, next);
      if (!res.ok) {
        setStatus(previous);
        setError("Couldn't save your answer. Tap to try again.");
      }
    });
  }

  async function confirmBackOut() {
    setBusy(true);
    setError(null);
    const res = await backOut(competitionId, reasons);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    setStatus("out");
    setBackingOut(false);
    setBusy(false);
    if (res.court && res.trialId) {
      router.push(`/trial/${res.trialId}`);
    } else {
      router.refresh();
    }
  }

  // Committed — show the back-out control instead of the choices.
  if (status === "in") {
    if (backingOut) {
      return (
        <div className="rounded-[3px] border border-flag/60 bg-card p-4">
          {locked ? (
            <>
              <p className="label mb-1" style={{ color: "var(--color-flag)" }}>
                Strike hearing
              </p>
              <p className="mb-3 text-sm text-ink">
                You said you were in. Backing out now goes straight to the
                Tribunal for a strike hearing. Put your reasons down — they
                become your defence.
              </p>
              <textarea
                value={reasons}
                onChange={(e) => setReasons(e.target.value)}
                rows={3}
                placeholder="Why you're pulling out…"
                className="mb-3 w-full resize-none rounded-[3px] border border-rule bg-paper px-3 py-2.5 text-ink outline-none focus:border-ink"
              />
            </>
          ) : (
            <p className="mb-3 text-sm text-ink">
              Back out? It&apos;s more than a day away, so no hearing — you&apos;re
              free to change your mind.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setBackingOut(false)}
              disabled={busy}
              className="flex-1 rounded-[3px] border border-rule py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
            >
              Keep me in
            </button>
            <button
              onClick={confirmBackOut}
              disabled={busy || (locked && !reasons.trim())}
              className="flex-1 rounded-[3px] bg-flag py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-50"
            >
              {busy ? "…" : locked ? "Back out & face court" : "Back out"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-flag">{error}</p>}
        </div>
      );
    }

    return (
      <div className="rounded-[3px] border border-moss/50 bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="font-narrow font-semibold uppercase tracking-[0.08em] text-moss">
            You&apos;re in
          </p>
          <button
            onClick={() => {
              setReasons("");
              setBackingOut(true);
            }}
            className="rounded-[3px] border border-rule px-4 py-1.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink"
          >
            Back out
          </button>
        </div>
        {locked && (
          <p className="mt-2 text-sm text-ink-soft">
            Locked in — backing out now means a strike hearing.
          </p>
        )}
      </div>
    );
  }

  // Not yet in — show the choices.
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const active = status === o.value;
          return (
            <button
              key={o.value}
              onClick={() => pick(o.value)}
              aria-pressed={active}
              className="rounded-[3px] border py-3 font-narrow text-[15px] font-semibold uppercase tracking-[0.08em] transition-colors"
              style={{
                backgroundColor: active ? o.fill : "transparent",
                borderColor: active ? o.fill : "var(--color-rule)",
                color: active ? "var(--color-paper)" : "var(--color-ink)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-flag">{error}</p>
      ) : status === "out" ? (
        <p className="mt-2 text-sm text-ink-soft">You&apos;re out. Saved.</p>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">
          Say you&apos;re in and you&apos;re committed.
        </p>
      )}
    </div>
  );
}
