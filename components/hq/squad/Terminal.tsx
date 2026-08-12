"use client";

import { useEffect, useState } from "react";

// The system talking to itself. Each game panel opens with a short boot log so
// the specialised surface announces what it is before you read it. Starts empty
// on both server and client (no hydration mismatch), reserves its own height so
// nothing below it jumps, then types itself out — instantly for anyone who has
// asked for reduced motion.

export type TermLine = { t?: string; m: string; tone?: "live" | "warn" | "alert" | "info" };

const COLOUR: Record<NonNullable<TermLine["tone"]>, string> = {
  live: "var(--color-moss)",
  warn: "var(--color-sand)",
  alert: "var(--color-flag)",
  info: "var(--color-ink-soft)",
};

const LINE_H = 17;

export function Terminal({ lines, speed = 320 }: { lines: TermLine[]; speed?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(lines.length);
      return;
    }
    let n = 0;
    setShown(0);
    const t = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= lines.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [lines, speed]);

  const done = shown >= lines.length;

  return (
    <div
      className="hq-mono flex flex-col gap-0.5 text-[11px] leading-[1.55] tracking-[0.06em]"
      style={{ minHeight: (lines.length + 1) * LINE_H }}
    >
      {lines.slice(0, shown).map((l, i) => (
        <p key={`${l.m}-${i}`} className="flex items-baseline gap-2">
          <span className="shrink-0 text-ink-soft opacity-60">{l.t ?? ">"}</span>
          <span
            className={i === shown - 1 && !done ? "hq-caret" : ""}
            style={{ color: COLOUR[l.tone ?? "info"] }}
          >
            {l.m}
          </span>
        </p>
      ))}
      {done && (
        <p className="flex items-baseline gap-2">
          <span className="shrink-0 text-ink-soft opacity-60">&gt;</span>
          <span className="hq-caret" />
        </p>
      )}
    </div>
  );
}
