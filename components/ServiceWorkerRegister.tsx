"use client";

import { useEffect } from "react";

// Registers the hand-written service worker on mount (§6.1).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // registration failing shouldn't break the app
    });
  }, []);
  return null;
}
