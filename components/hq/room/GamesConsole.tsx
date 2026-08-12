"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startOperation, advanceGames } from "@/app/actions/operations";

// The live games count. Any participant can advance it (compare-and-set on the
// server, so simultaneous taps collapse to one). The CO opens the room.
export function GamesConsole({
  compId,
  gamesCount,
  started,
  finished,
  isCO,
  expected,
}: {
  compId: string;
  gamesCount: number;
  started: boolean;
  finished: boolean;
  isCO: boolean;
  expected: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "The system refused that.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="text-center">
      <div
        className="hq-readout font-bold leading-[0.85]"
        style={{
          fontSize: 92,
          color: finished ? "var(--color-ink)" : started ? "var(--color-moss)" : "var(--color-rule)",
          textShadow: started && !finished ? "0 0 34px rgba(61,220,132,0.28)" : undefined,
        }}
      >
        {String(gamesCount).padStart(2, "0")}
      </div>
      <p className="hq-label mt-2">{finished ? "Games played · final" : "Games played"}</p>

      {!started && (
        <>
          <p className="hq-mono mt-4 text-[12px] uppercase tracking-[0.1em] text-ink-soft">
            {expected} expected to deploy
          </p>
          {isCO ? (
            <button
              onClick={() => run(() => startOperation(compId))}
              disabled={pending}
              className="hq-mono mt-3 w-full rounded-[3px] py-3 text-[13px] font-bold uppercase tracking-[0.14em] transition-shadow hover:[box-shadow:0_0_24px_-6px_var(--color-moss)] disabled:opacity-50"
              style={{ backgroundColor: "var(--color-moss)", color: "#0b100e" }}
            >
              ▶ Open the room
            </button>
          ) : (
            <p className="hq-mono mt-3 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
              The CO opens the room at kick-off
            </p>
          )}
        </>
      )}

      {started && !finished && (
        <>
          <button
            onClick={() => run(() => advanceGames(compId, gamesCount))}
            disabled={pending}
            className="hq-mono mt-4 w-full rounded-[3px] border py-3 text-[13px] font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-50"
            style={{
              borderColor: "var(--color-moss)",
              backgroundColor: "color-mix(in srgb, var(--color-moss) 12%, transparent)",
              color: "var(--color-moss)",
            }}
          >
            + New game
          </button>
          <p className="hq-mono mt-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
            Log it when the next one starts — the CO can fix the total on close
          </p>
        </>
      )}

      {error && (
        <p className="hq-mono mt-3 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--color-flag)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
