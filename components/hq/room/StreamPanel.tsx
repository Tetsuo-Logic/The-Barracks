"use client";

import { useState } from "react";
import { LINK } from "@/lib/hq/future/systems";

// PROTOTYPE — the spectator concept. A room that's live can be watched by the
// rest of the Barracks: whoever's streaming, whoever's on the couch. Nothing is
// piped anywhere yet; the surface is here so the idea can be judged.
export function StreamPanel({ live, host }: { live: boolean; host: string }) {
  const [watching, setWatching] = useState(false);
  const viewers = live ? 3 + (watching ? 1 : 0) : 0;

  return (
    <div>
      <div
        className="relative flex h-[132px] items-center justify-center overflow-hidden rounded-[3px] border border-rule"
        style={{
          background:
            "linear-gradient(140deg, rgba(61,220,132,0.10), rgba(11,16,14,0.9) 55%, rgba(245,182,61,0.08))",
        }}
      >
        <div className="text-center">
          <p
            className="hq-readout text-[20px] font-bold uppercase tracking-[0.08em]"
            style={{ color: live ? "var(--color-moss)" : "var(--color-ink-soft)" }}
          >
            {live ? (watching ? "◉ Watching" : "Room live") : "Off air"}
          </p>
          <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            {live ? `Source · ${host}` : "No feed — the room is closed"}
          </p>
        </div>
        {live && (
          <span
            className="hq-mono absolute right-2 top-2 rounded-[2px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
            style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
          >
            ● Live
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          {viewers} spectator{viewers === 1 ? "" : "s"}
        </span>
        <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          Capture · {LINK.obs ? "OBS bridge" : "manual"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => setWatching((w) => !w)}
          disabled={!live}
          className="hq-mono rounded-[3px] border py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-30"
          style={{
            borderColor: watching ? "var(--color-moss)" : "var(--color-rule)",
            color: watching ? "var(--color-moss)" : "var(--color-ink-soft)",
            backgroundColor: watching ? "color-mix(in srgb, var(--color-moss) 14%, transparent)" : "transparent",
          }}
        >
          {watching ? "Stop watching" : "Watch"}
        </button>
        <button
          disabled
          className="hq-mono rounded-[3px] border border-rule py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft opacity-40"
          title="Streaming is not yet wired"
        >
          Stream
        </button>
      </div>
    </div>
  );
}
