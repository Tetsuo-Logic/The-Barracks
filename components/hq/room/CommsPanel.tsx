"use client";

import { useEffect, useRef, useState } from "react";
import { Dot } from "@/components/hq/Kit";

// PROTOTYPE — the room's live comms channel. Contextual chat scoped to one
// operation, with system messages the platform emits as the night moves. There
// is no messages table yet; nothing here is written or read from the database.
// Shaped like the real thing so the boundary is only the transport.

type Msg = {
  id: number;
  kind: "system" | "member";
  who: string;
  at: string;
  body: string;
};

const SEED = (names: string[], game: string): Msg[] => {
  const n = (i: number) => names[i % Math.max(1, names.length)] ?? "Operative";
  return [
    { id: 1, kind: "system", who: "SYSTEM", at: "19:58", body: `ROOM OPENED — ${game.toUpperCase()}` },
    { id: 2, kind: "system", who: "SYSTEM", at: "19:58", body: "BRIEFING PINNED BY COMMAND" },
    { id: 3, kind: "member", who: n(0), at: "20:01", body: "on in 5, sorting a controller" },
    { id: 4, kind: "system", who: "SYSTEM", at: "20:03", body: `${n(1).toUpperCase()} MARKED PRESENT` },
    { id: 5, kind: "member", who: n(1), at: "20:04", body: "party's up, invites out" },
    { id: 6, kind: "system", who: "SYSTEM", at: "20:12", body: "GAME 1 LOGGED" },
    { id: 7, kind: "member", who: n(2), at: "20:41", body: "that last one was criminal" },
    { id: 8, kind: "system", who: "SYSTEM", at: "20:44", body: "EVIDENCE CAPTURED — BARRACKS LINK" },
  ];
};

export function CommsPanel({
  names,
  game,
  pinned,
}: {
  names: string[];
  game: string;
  pinned: string;
}) {
  const [msgs, setMsgs] = useState<Msg[]>(() => SEED(names, game));
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    const now = new Date();
    setMsgs((m) => [
      ...m,
      {
        id: m.length + 1,
        kind: "member",
        who: "You",
        at: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        body,
      },
    ]);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Pinned briefing */}
      <div
        className="mb-2 rounded-[3px] border border-dashed px-2.5 py-2"
        style={{ borderColor: "color-mix(in srgb, var(--color-sand) 40%, transparent)" }}
      >
        <p className="hq-label mb-0.5" style={{ color: "var(--color-sand)" }}>
          📌 Pinned briefing
        </p>
        <p className="text-[12px] leading-snug text-ink-soft">{pinned}</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: 320 }}>
        <ul className="flex flex-col gap-1">
          {msgs.map((m) =>
            m.kind === "system" ? (
              <li key={m.id} className="flex items-center gap-2 py-0.5">
                <Dot tone="info" />
                <span className="hq-mono min-w-0 flex-1 truncate text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                  {m.body}
                </span>
                <span className="hq-mono shrink-0 text-[10px] text-ink-soft">{m.at}</span>
              </li>
            ) : (
              <li key={m.id} className="py-0.5">
                <div className="flex items-baseline gap-2">
                  <span
                    className="hq-mono shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: m.who === "You" ? "var(--color-sand)" : "var(--color-moss)" }}
                  >
                    {m.who}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug">{m.body}</span>
                  <span className="hq-mono shrink-0 text-[10px] text-ink-soft">{m.at}</span>
                </div>
              </li>
            ),
          )}
        </ul>
        <div ref={endRef} />
      </div>

      <div className="mt-2 flex gap-2 border-t border-rule pt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Message the room…"
          className="hq-mono min-w-0 flex-1 rounded-[3px] border border-rule bg-[rgba(0,0,0,0.35)] px-2.5 py-2 text-[12px] text-ink outline-none focus:border-sand"
        />
        <button
          onClick={send}
          className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-sand hover:text-ink"
        >
          Send
        </button>
      </div>
      <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        Prototype channel — messages stay in this browser
      </p>
    </div>
  );
}
