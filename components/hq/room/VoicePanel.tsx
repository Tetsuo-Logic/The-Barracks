"use client";

import { useState } from "react";
import { VOICE } from "@/lib/hq/future/systems";

// PROTOTYPE — native voice inside the Operation Room. Reads the shaped adapter
// in lib/hq/future/systems (VOICE); replaced by WebRTC/SFU or a Discord bridge.
export function VoicePanel({ channel }: { channel?: string }) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);

  const members = VOICE.members;
  const connected = members.length + (joined ? 1 : 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <p
            className="hq-readout text-[26px] font-bold leading-none"
            style={{ color: connected ? "var(--color-moss)" : "var(--color-rule)" }}
          >
            {connected} CONNECTED
          </p>
          <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            {channel || VOICE.channel}
          </p>
        </div>
        <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
          {joined ? "You are in" : "Not connected"}
        </span>
      </div>

      <ul className="flex flex-col">
        {members.map((m) => (
          <li key={m.name} className="flex items-center gap-2.5 border-b border-rule/50 py-1.5 last:border-0">
            <span
              className="inline-block h-6 w-1 shrink-0 rounded-[2px]"
              style={{
                backgroundColor: m.speaking
                  ? "var(--color-moss)"
                  : m.muted || m.deafened
                    ? "var(--color-flag)"
                    : "var(--color-rule)",
                boxShadow: m.speaking ? "0 0 10px 0 rgba(61,220,132,0.55)" : undefined,
              }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[13px]">{m.name}</span>
            <span
              className="hq-mono shrink-0 text-[10px] uppercase tracking-[0.12em]"
              style={{
                color: m.speaking
                  ? "var(--color-moss)"
                  : m.deafened || m.muted
                    ? "var(--color-flag)"
                    : "var(--color-ink-soft)",
              }}
            >
              {m.deafened ? "Deafened" : m.muted ? "Muted" : m.speaking ? "Speaking" : "Idle"}
            </span>
          </li>
        ))}
        {joined && (
          <li className="flex items-center gap-2.5 border-t border-rule py-1.5">
            <span
              className="inline-block h-6 w-1 shrink-0 rounded-[2px]"
              style={{ backgroundColor: muted || deafened ? "var(--color-flag)" : "var(--color-sand)" }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: "var(--color-sand)" }}>
              You
            </span>
            <span className="hq-mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              {deafened ? "Deafened" : muted ? "Muted" : "Live"}
            </span>
          </li>
        )}
      </ul>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <VoiceBtn
          active={joined}
          tone="var(--color-moss)"
          onClick={() => {
            setJoined((j) => !j);
            setMuted(false);
            setDeafened(false);
          }}
        >
          {joined ? "Leave" : "Join voice"}
        </VoiceBtn>
        <VoiceBtn active={muted} tone="var(--color-sand)" disabled={!joined} onClick={() => setMuted((m) => !m)}>
          Mute
        </VoiceBtn>
        <VoiceBtn
          active={deafened}
          tone="var(--color-flag)"
          disabled={!joined}
          onClick={() => {
            setDeafened((d) => !d);
            setMuted((m) => (deafened ? m : true));
          }}
        >
          Deafen
        </VoiceBtn>
      </div>
    </div>
  );
}

function VoiceBtn({
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
      className="hq-mono rounded-[3px] border py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors disabled:opacity-30"
      style={{
        borderColor: active ? tone : "var(--color-rule)",
        backgroundColor: active ? `color-mix(in srgb, ${tone} 16%, transparent)` : "transparent",
        color: active ? tone : "var(--color-ink-soft)",
      }}
    >
      {children}
    </button>
  );
}
