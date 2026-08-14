"use client";

import { useEffect, useState } from "react";

// A line the system types out, in phosphor green with a prompt in front of it.
// The same voice as the boot terminal and the status strip: when the machine
// is telling you what's happening, it types.
//
// Used for dialog titles, where it does the job a heading would and announces
// that something has opened at the same time.

export function TypeLine({
  text,
  size = "19px",
  /** Milliseconds per character. */
  speed = 26,
}: {
  text: string;
  size?: string;
  speed?: number;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      return;
    }
    setN(0);
  }, [text]);

  useEffect(() => {
    if (n >= text.length) return;
    const t = window.setTimeout(() => setN((v) => v + 1), n === 0 ? 120 : speed);
    return () => window.clearTimeout(t);
  }, [n, text.length, speed]);

  return (
    <span
      className="hq-readout font-bold uppercase leading-none tracking-[0.06em]"
      style={{ fontSize: size, color: "var(--color-moss)" }}
    >
      <span style={{ color: "color-mix(in srgb, var(--color-moss) 45%, transparent)" }}>
        {"> "}
      </span>
      {text.slice(0, n)}
      {n < text.length && <span className="hq-caret" />}
    </span>
  );
}
