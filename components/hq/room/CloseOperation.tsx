"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeOperation } from "@/app/actions/operations";
import { Row } from "@/components/hq/Kit";

// Stand the room down. The CO can correct the games total on the way out —
// people forget to log them mid-night. Real `closeOperation`.
export function CloseOperation({
  compId,
  gamesCount,
  present,
  startedAt,
}: {
  compId: string;
  gamesCount: number;
  present: number;
  startedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [arming, setArming] = useState(false);
  const [games, setGames] = useState(String(gamesCount));
  const [error, setError] = useState<string | null>(null);

  const since = new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await closeOperation(compId, Number(games) || 0);
      if (!res.ok) {
        setError(res.error ?? "Couldn't close the room.");
        return;
      }
      setArming(false);
      router.refresh();
    });
  }

  if (!arming) {
    return (
      <button
        onClick={() => {
          setGames(String(gamesCount));
          setArming(true);
        }}
        className="hq-mono w-full rounded-[3px] border border-rule py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:border-flag hover:text-ink"
      >
        ■ Close operation
      </button>
    );
  }

  return (
    <div
      className="rounded-[3px] border p-3"
      style={{
        borderColor: "color-mix(in srgb, var(--color-flag) 40%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--color-flag) 6%, transparent)",
      }}
    >
      <p className="hq-label mb-2" style={{ color: "var(--color-flag)" }}>
        Confirm stand-down
      </p>
      <Row k="Opened" v={since} />
      <Row k="Present" v={present} tone="live" />
      <div className="flex items-baseline justify-between gap-4 border-b border-rule/60 py-1.5">
        <span className="hq-label shrink-0">Games</span>
        <input
          type="number"
          min={0}
          value={games}
          onChange={(e) => setGames(e.target.value)}
          className="hq-mono w-24 rounded-[3px] border border-rule bg-[rgba(0,0,0,0.35)] px-2 py-1 text-right text-[13px] text-ink outline-none focus:border-sand"
        />
      </div>
      <p className="hq-mono mt-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
        Correct the total if anyone forgot to log one
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setArming(false)}
          className="hq-mono rounded-[3px] border border-rule px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-ink-soft"
        >
          Abort
        </button>
        <button
          onClick={confirm}
          disabled={pending}
          className="hq-mono flex-1 rounded-[3px] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] disabled:opacity-50"
          style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
        >
          {pending ? "Closing…" : "Confirm & archive"}
        </button>
      </div>
      {error && (
        <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--color-flag)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
