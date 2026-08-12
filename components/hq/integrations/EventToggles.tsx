"use client";

import { useState } from "react";
import { Tag } from "@/components/hq/Kit";

// Per-event notification routing. Interface prototype: the switches are real
// state, the delivery isn't — a Discord bot with guild scopes replaces this.

export type EventRow = { key: string; label: string; channel: string; on: boolean };

export function EventToggles({ events }: { events: EventRow[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(events.map((e) => [e.key, e.on])),
  );
  const on = events.filter((e) => state[e.key]).length;

  return (
    <div>
      <ul className="flex flex-col">
        {events.map((e) => {
          const active = state[e.key];
          return (
            <li
              key={e.key}
              className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0"
            >
              <button
                type="button"
                role="switch"
                aria-checked={active}
                aria-label={`${e.label} → ${e.channel}`}
                onClick={() => setState((s) => ({ ...s, [e.key]: !s[e.key] }))}
                className="relative h-[18px] w-[34px] shrink-0 rounded-full border transition-colors"
                style={{
                  borderColor: active ? "var(--color-moss)" : "var(--color-rule)",
                  backgroundColor: active
                    ? "color-mix(in srgb, var(--color-moss) 28%, transparent)"
                    : "transparent",
                }}
              >
                <span
                  className="absolute top-[2px] h-[12px] w-[12px] rounded-full transition-all"
                  style={{
                    left: active ? 18 : 2,
                    backgroundColor: active ? "var(--color-moss)" : "var(--color-ink-soft)",
                  }}
                />
              </button>
              <span className="min-w-0 flex-1 truncate text-[13px]">{e.label}</span>
              <span
                className="hq-mono shrink-0 text-[11px]"
                style={{ color: active ? "var(--color-sand)" : "var(--color-ink-soft)" }}
              >
                {e.channel}
              </span>
              <span className="w-[62px] shrink-0 text-right">
                {active ? <Tag tone="live">Routing</Tag> : <Tag tone="idle">Muted</Tag>}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="hq-mono mt-3 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        {on} of {events.length} events routed · changes are not persisted in this prototype
      </p>
    </div>
  );
}
