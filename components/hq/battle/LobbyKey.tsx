"use client";

import { useState } from "react";

// The lobby key is the one field in the room that isn't public. Participants on
// the roster can reveal it; everyone else sees the mask and the reason.
export function LobbyKey({ value, authorised = true }: { value: string; authorised?: boolean }) {
  const [shown, setShown] = useState(false);

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule/60 py-1.5">
      <span className="hq-label shrink-0">Lobby key</span>
      <span className="flex items-center gap-2">
        <span
          className="hq-mono text-[13px] tracking-[0.3em]"
          style={{ color: shown ? "var(--color-sand)" : "var(--color-ink-soft)" }}
        >
          {shown && authorised ? value : "••••"}
        </span>
        {authorised ? (
          <button
            onClick={() => setShown((s) => !s)}
            className="hq-mono rounded-[3px] border border-rule px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-sand hover:text-ink"
          >
            {shown ? "Hide" : "Reveal"}
          </button>
        ) : (
          <span className="hq-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">Restricted</span>
        )}
      </span>
    </div>
  );
}
