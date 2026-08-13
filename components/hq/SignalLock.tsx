"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The Barracks name finding its signal: out of focus and split, then locked.
//
// This replaces a second scanner. Not every box needs a green line running down
// it — one screen, one moment. Plays once per browser session, waits for the
// boot terminal to clear, and doesn't run at all under reduced motion.

export function SignalLock({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [lock, setLock] = useState(false);
  // Strict Mode runs effects twice in dev; without this the second pass sees
  // the flag the first just wrote and the effect never plays.
  const decided = useRef(false);

  useEffect(() => {
    if (decided.current) return;
    decided.current = true;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("hq-locked") === "1") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = () => {
      sessionStorage.setItem("hq-locked", "1");
      setLock(true);
      window.setTimeout(() => setLock(false), 900);
    };

    if (sessionStorage.getItem("hq-booted") === "1") {
      start();
      return;
    }
    window.addEventListener("hq:booted", start, { once: true });
    return () => window.removeEventListener("hq:booted", start);
  }, []);

  return (
    <span className={`${lock ? "hq-lock " : ""}${className}`} style={style}>
      {children}
    </span>
  );
}
