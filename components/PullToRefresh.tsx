"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 64;

// Pull down at the top of the page to soft-refresh (re-fetch server data). Touch
// only — does nothing on desktop, honoured on phones/PWA.
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const active = useRef(false);
  const pullRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (busyRef.current) return;
      active.current = window.scrollY <= 0;
      startY.current = e.touches[0].clientY;
    }
    function onMove(e: TouchEvent) {
      if (!active.current || busyRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        const p = Math.min(dy * 0.45, 90);
        pullRef.current = p;
        setPull(p);
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    }
    function onEnd() {
      if (!active.current) return;
      active.current = false;
      if (pullRef.current >= THRESHOLD) {
        busyRef.current = true;
        setRefreshing(true);
        setPull(44);
        router.refresh();
        window.setTimeout(() => {
          busyRef.current = false;
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        }, 850);
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return (
    <>
      <div
        className="pointer-events-none flex items-end justify-center overflow-hidden"
        style={{ height: pull, transition: active.current ? "none" : "height 0.2s ease" }}
        aria-hidden
      >
        <span className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-sand">
          {refreshing
            ? "↻ Refreshing…"
            : pull >= THRESHOLD
              ? "Release to refresh"
              : pull > 0
                ? "Pull to refresh"
                : ""}
        </span>
      </div>
      {children}
    </>
  );
}
