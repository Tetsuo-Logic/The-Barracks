"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Hover an Operation and the system tells you what it is — as a one-line
// terminal readout that types itself, rather than an OS tooltip in the wrong
// font. The board shows the game; this is where the full name lives.
//
// Deliberately quiet about it: a short delay before it opens so passing the
// mouse across a list doesn't fire a dozen of them, and it types fast enough
// to finish before you've decided to read it.

const OPEN_DELAY = 220;
const PER_CHAR = 15;

export function TerminalHint({
  children,
  text,
  /** Hang the box from the right edge when the anchor sits near the far side. */
  align = "left",
  className = "",
}: {
  children: ReactNode;
  text: string;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open || n >= text.length) return;
    const t = window.setTimeout(() => setN((v) => v + 1), PER_CHAR);
    return () => window.clearTimeout(t);
  }, [open, n, text.length]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  function show() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setN(0);
      setOpen(true);
    }, OPEN_DELAY);
  }

  function hide() {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
    setN(0);
  }

  return (
    <span
      className={`relative min-w-0 ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {open && (
        <span
          role="tooltip"
          className="hq-mono absolute top-full z-30 mt-2 whitespace-nowrap rounded-[4px] border px-3 py-2 text-[12px]"
          style={{
            [align === "right" ? "right" : "left"]: 0,
            borderColor: "color-mix(in srgb, var(--color-moss) 40%, transparent)",
            background: "#050b08",
            color: "var(--color-moss)",
            boxShadow: "0 0 0 1px rgba(61,220,132,0.06), 0 18px 40px -20px rgba(0,0,0,0.95)",
            animation: "hq-term-open 160ms cubic-bezier(0.22, 1, 0.36, 1) both",
          }}
        >
          <span style={{ color: "color-mix(in srgb, var(--color-moss) 45%, transparent)" }}>
            {"> "}
          </span>
          {text.slice(0, n)}
          {n < text.length && <span className="hq-caret" />}
        </span>
      )}
    </span>
  );
}
