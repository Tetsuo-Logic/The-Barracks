"use client";

import { useEffect, useState } from "react";

// Permission flow (§6.2). Never prompt on load — the request must come from a
// tap. On iOS a denial is close to unrecoverable, so we explain first.

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "unsupported" | "default" | "granted" | "denied" | "working";

export function NotificationSetup() {
  const [state, setState] = useState<State>("default");

  useEffect(() => {
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as State);
    // Re-subscribe on launch if already granted — idempotent (§6.3).
    if (Notification.permission === "granted") void subscribe(true);
  }, []);

  async function subscribe(silent = false) {
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        if (!silent) alert("Push isn't configured on the server yet.");
        return;
      }
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
      // ignore — surfaced via state elsewhere
    }
  }

  async function enable() {
    setState("working");
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      await subscribe();
      setState("granted");
    } else {
      setState(perm as State);
    }
  }

  if (state === "unsupported") {
    return (
      <p className="text-sm text-ink-soft">
        This device can&apos;t do notifications. On iPhone, add the app to your
        Home Screen first (Share → Add to Home Screen).
      </p>
    );
  }

  if (state === "granted") {
    return (
      <p className="text-sm text-moss">Notifications are on for this device.</p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-sm text-ink-soft">
        Notifications are blocked. Turn them back on in your phone&apos;s
        settings for this app, then reopen it.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-ink">
        Get told when a date goes in the diary.
      </p>
      <button
        onClick={enable}
        disabled={state === "working"}
        className="rounded-[3px] bg-ink px-5 py-2.5 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
      >
        {state === "working" ? "Turning on" : "Turn on notifications"}
      </button>
    </div>
  );
}
