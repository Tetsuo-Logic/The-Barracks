"use client";

import { useEffect, useState } from "react";
import { updatePref } from "@/app/actions/prefs";
import type { NotificationPrefs } from "@/lib/types";

// Combines the master "turn on" switch with the per-type toggles, sharing one
// permission state — so the toggles are clearly disabled until notifications
// are actually on for this device (the thing that confused everyone).

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Perm = "unsupported" | "default" | "granted" | "denied" | "working";

type Key = keyof Omit<NotificationPrefs, "player_id">;
const ROWS: { key: Key; label: string }[] = [
  { key: "new_comp", label: "New dates" },
  { key: "rsvp_changes", label: "RSVPs & answers" },
  { key: "comments", label: "Comments" },
  { key: "results", label: "Results" },
  { key: "day_of", label: "Day-of reminder" },
  { key: "chase_undecided", label: "Chase me if undecided" },
  { key: "board", label: "The board" },
];

export function NotificationSettings({ prefs }: { prefs: NotificationPrefs | null }) {
  const [perm, setPerm] = useState<Perm>("default");
  const [state, setState] = useState<Record<string, boolean>>(() => ({
    new_comp: prefs?.new_comp ?? true,
    rsvp_changes: prefs?.rsvp_changes ?? true,
    comments: prefs?.comments ?? true,
    results: prefs?.results ?? true,
    day_of: prefs?.day_of ?? true,
    chase_undecided: prefs?.chase_undecided ?? true,
  }));
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      setPerm("unsupported");
      return;
    }
    setPerm(Notification.permission as Perm);
    if (Notification.permission === "granted") void subscribe(true);
  }, []);

  async function subscribe(silent = false) {
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
    } catch {
      if (!silent) setTestMsg("Couldn't finish turning on notifications.");
    }
  }

  async function enable() {
    setPerm("working");
    const p = await Notification.requestPermission();
    if (p === "granted") {
      await subscribe();
      setPerm("granted");
    } else {
      setPerm(p as Perm);
    }
  }

  async function toggle(key: Key) {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    const res = await updatePref(key, next);
    if (!res.ok) setState((s) => ({ ...s, [key]: !next }));
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

  const on = perm === "granted";

  return (
    <div>
      {/* master switch */}
      {perm === "granted" ? (
        <p className="mb-4 text-sm text-moss">
          Notifications are on for this device.
        </p>
      ) : perm === "unsupported" ? (
        <p className="mb-4 text-sm text-ink-soft">
          This device can&apos;t do notifications. On iPhone, add the app to your
          Home Screen first (Share → Add to Home Screen), then open it from there.
        </p>
      ) : perm === "denied" ? (
        <p className="mb-4 text-sm text-ink-soft">
          Notifications are blocked. Turn them back on in your phone&apos;s
          settings for this app, then reopen it.
        </p>
      ) : (
        <div className="mb-5 rounded-[3px] border border-ink bg-card p-4">
          <p className="mb-1 font-semibold text-ink">
            Turn this on first
          </p>
          <p className="mb-3 text-sm text-ink-soft">
            This is the switch that actually turns notifications on for this
            phone. The list below just picks which ones you get.
          </p>
          <button
            onClick={enable}
            disabled={perm === "working"}
            className="w-full rounded-[3px] bg-ink px-5 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
          >
            {perm === "working" ? "Turning on" : "Turn on notifications"}
          </button>
        </div>
      )}

      {/* per-type toggles — disabled until notifications are on */}
      <div
        className="rounded-[3px] border border-rule"
        style={{ opacity: on ? 1 : 0.45 }}
      >
        {ROWS.map((r, i) => (
          <label
            key={r.key}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: i > 0 ? "1px solid var(--color-rule)" : undefined }}
          >
            <span className="text-ink">{r.label}</span>
            <Switch on={state[r.key]} disabled={!on} onClick={() => on && toggle(r.key)} />
          </label>
        ))}
      </div>
      {!on && (
        <p className="mt-2 text-xs text-ink-soft">
          These switch on once notifications are turned on above.
        </p>
      )}

      {on && (
        <>
          <button
            onClick={sendTest}
            disabled={testing}
            className="mt-4 rounded-[3px] border border-rule px-4 py-2.5 font-narrow text-sm font-semibold uppercase tracking-[0.08em] text-ink disabled:opacity-60"
          >
            {testing ? "Sending" : "Send me a test notification"}
          </button>
          {testMsg && <p className="mt-2 text-sm text-ink-soft">{testMsg}</p>}
        </>
      )}
    </div>
  );
}

function Switch({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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
