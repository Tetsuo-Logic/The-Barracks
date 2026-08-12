"use client";

import { useState } from "react";
import { Panel, Dot, Proto, Nil } from "@/components/hq/Kit";
import { BATTLE_CHAT, type BattleMessage } from "@/lib/hq/future/network";

// Cross-Barracks chat. Both Captains and both rosters share one thread, and the
// system posts into it too — so the argument and the record sit in one place.
export function BattleChat({
  i = 0,
  callsign,
  them,
}: {
  i?: number;
  callsign: string;
  them: string;
}) {
  const [messages, setMessages] = useState<BattleMessage[]>(BATTLE_CHAT);
  const [draft, setDraft] = useState("");

  function send() {
    const text = draft.trim();
    if (!text) return;
    const d = new Date();
    setMessages((m) => [
      ...m,
      {
        at: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        from: callsign,
        side: "us",
        text,
      },
    ]);
    setDraft("");
  }

  return (
    <Panel
      i={i}
      label="Battle comms"
      status={<Dot tone="live" pulse />}
      right={<Proto />}
      pad={false}
    >
      {messages.length === 0 ? (
        <Nil>No traffic</Nil>
      ) : (
        <ul className="flex max-h-[320px] flex-col overflow-y-auto p-3">
          {messages.map((m, idx) => {
            const colour =
              m.side === "us"
                ? "var(--color-moss)"
                : m.side === "them"
                  ? "var(--color-flag)"
                  : "var(--color-ink-soft)";
            return (
              <li key={`${m.at}-${idx}`} className="border-b border-rule/40 py-1.5 last:border-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className="hq-mono shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: colour }}
                  >
                    {m.from}
                  </span>
                  <span className="hq-mono shrink-0 text-[9px] text-ink-soft">{m.at}</span>
                </div>
                <p
                  className={
                    m.side === "system"
                      ? "hq-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft"
                      : "text-[13px]"
                  }
                >
                  {m.text}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 border-t border-rule p-2.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder={`Message ${them}…`}
          className="hq-mono min-w-0 flex-1 rounded-[3px] border border-rule bg-[rgba(0,0,0,0.25)] px-2.5 py-1.5 text-[12px] outline-none placeholder:text-ink-soft focus:border-sand"
        />
        <button
          onClick={send}
          className="hq-mono shrink-0 rounded-[3px] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
        >
          Send
        </button>
      </div>
    </Panel>
  );
}
