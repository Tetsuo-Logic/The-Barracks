"use client";

import { useState } from "react";
import { updatePref } from "@/app/actions/prefs";
import type { NotificationPrefs } from "@/lib/types";

type Key = keyof Omit<NotificationPrefs, "player_id">;

const ROWS: { key: Key; label: string }[] = [
  { key: "new_comp", label: "New dates" },
  { key: "rsvp_changes", label: "RSVP changes" },
  { key: "comments", label: "Comments" },
  { key: "results", label: "Results" },
  { key: "day_of", label: "Day-of reminder" },
  { key: "chase_undecided", label: "Chase me if undecided" },
];

export function NotificationPrefs({ prefs }: { prefs: NotificationPrefs | null }) {
  const [state, setState] = useState<Record<string, boolean>>(() => ({
    new_comp: prefs?.new_comp ?? true,
    rsvp_changes: prefs?.rsvp_changes ?? false,
    comments: prefs?.comments ?? true,
    results: prefs?.results ?? true,
    day_of: prefs?.day_of ?? true,
    chase_undecided: prefs?.chase_undecided ?? true,
  }));
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function toggle(key: Key) {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    const res = await updatePref(key, next);
    if (!res.ok) setState((s) => ({ ...s, [key]: !next })); // revert
  }

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      setTestMsg(res.ok ? "Sent — check your notifications." : "Couldn't send it.");
    } catch {
      setTestMsg("Couldn't send it.");
    }
    setTesting(false);
  }

  return (
    <div>
      <div className="rounded-[3px] border border-rule">
        {ROWS.map((r, i) => (
          <label
            key={r.key}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: i > 0 ? "1px solid var(--color-rule)" : undefined }}
          >
            <span className="text-ink">{r.label}</span>
            <Switch on={state[r.key]} onClick={() => toggle(r.key)} />
          </label>
        ))}
      </div>

      <button
        onClick={sendTest}
        disabled={testing}
        className="mt-4 rounded-[3px] border border-rule px-4 py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink disabled:opacity-60"
      >
        {testing ? "Sending" : "Send me a test notification"}
      </button>
      {testMsg && <p className="mt-2 text-sm text-ink-soft">{testMsg}</p>}
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="relative h-6 w-10 rounded-full transition-colors"
      style={{ backgroundColor: on ? "var(--color-moss)" : "var(--color-rule)" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-paper transition-all"
        style={{ left: on ? 18 : 2 }}
      />
    </button>
  );
}
