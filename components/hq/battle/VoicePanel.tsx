"use client";

import { useState } from "react";
import { Panel, Dot, Tag, Proto } from "@/components/hq/Kit";
import { VOICE } from "@/lib/hq/future/systems";

// Voice inside the battle room. The adapter supplies the channel and who's on
// it; joining, muting and deafening are local state until there's a real SFU.
export function VoicePanel({ i = 0 }: { i?: number }) {
  const [joined, setJoined] = useState(true);
  const [muted, setMuted] = useState(false);

  return (
    <Panel
      i={i}
      label="Voice"
      status={<Dot tone={joined ? "live" : "idle"} pulse={joined} />}
      right={<Proto />}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="hq-mono truncate text-[12px] uppercase tracking-[0.12em]" style={{ color: "var(--color-moss)" }}>
            {VOICE.channel}
          </p>
          <p className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
            {VOICE.members.length} on channel
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            onClick={() => setMuted((m) => !m)}
            disabled={!joined}
            className="hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-40"
            style={{
              borderColor: muted ? "var(--color-flag)" : "var(--color-rule)",
              color: muted ? "var(--color-flag)" : "var(--color-ink-soft)",
            }}
          >
            {muted ? "Muted" : "Mic on"}
          </button>
          <button
            onClick={() => setJoined((j) => !j)}
            className="hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
            style={
              joined
                ? { borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }
                : { borderColor: "var(--color-moss)", backgroundColor: "var(--color-moss)", color: "#0b100e" }
            }
          >
            {joined ? "Leave" : "Join"}
          </button>
        </div>
      </div>

      <ul className="flex flex-col">
        {VOICE.members.map((m) => (
          <li key={m.name} className="flex items-center gap-2.5 border-b border-rule/50 py-1.5 last:border-0">
            <Dot tone={m.speaking ? "live" : m.deafened ? "alert" : "idle"} pulse={m.speaking} />
            <span className="min-w-0 flex-1 truncate text-[13px]">{m.name}</span>
            {m.speaking && <Tag tone="live">Speaking</Tag>}
            {m.muted && <Tag tone="idle">Muted</Tag>}
            {m.deafened && <Tag tone="alert">Deafened</Tag>}
          </li>
        ))}
        <li className="flex items-center gap-2.5 py-1.5">
          <Dot tone={joined ? (muted ? "idle" : "live") : "idle"} pulse={joined && !muted} />
          <span className="min-w-0 flex-1 truncate text-[13px]">You</span>
          <Tag tone={joined ? (muted ? "idle" : "live") : "info"}>
            {joined ? (muted ? "Muted" : "On channel") : "Off channel"}
          </Tag>
        </li>
      </ul>
    </Panel>
  );
}
