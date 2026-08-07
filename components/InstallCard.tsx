"use client";

import { useEffect, useState } from "react";

// Platform-aware install help, shown only when not already running as an
// installed app (§6.5).
type BIPEvent = Event & { prompt: () => Promise<void> };

export function InstallCard() {
  const [standalone, setStandalone] = useState(true); // assume installed until known
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(isStandalone);

    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setPlatform("ios");
    else if (/android/i.test(ua)) setPlatform("android");

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (standalone) return null;

  return (
    <div className="rounded-[3px] border border-rule bg-card p-4">
      <p className="label mb-1">Install it</p>
      {platform === "ios" ? (
        <p className="text-ink">
          Tap the Share button, then <span className="font-semibold">Add to
          Home Screen</span>. Notifications only work once it&apos;s installed.
        </p>
      ) : platform === "android" && deferred ? (
        <button
          onClick={() => deferred.prompt()}
          className="mt-1 rounded-[3px] bg-ink px-5 py-2.5 font-narrow font-semibold uppercase tracking-[0.08em] text-paper"
        >
          Install
        </button>
      ) : (
        <p className="text-ink">
          Add this to your Home Screen from your browser menu to install it.
        </p>
      )}
    </div>
  );
}
