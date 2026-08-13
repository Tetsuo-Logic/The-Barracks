"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Tone } from "@/components/hq/Kit";

// The standing-figures strip, with a short handshake on arrival: the first
// reading types itself out in phosphor green — the machine reporting — then
// settles to amber as the rest of the line falls in behind it.
//
// It plays ONCE per screen per browser session. Flair that replays every time
// you navigate stops being flair and starts being a toll booth, which is the
// same reason the boot sequence is skippable and remembers it ran.
//
// Under prefers-reduced-motion it doesn't run at all.

const TONE: Record<string, string> = {
  live: "var(--color-moss)",
  warn: "var(--color-sand)",
  alert: "var(--color-flag)",
  idle: "var(--color-rule)",
  info: "var(--color-ink-soft)",
};

export type StripItem = {
  text: string;
  /** Draws a status light before the text. */
  dot?: Tone;
  pulse?: boolean;
};

export function StatusStrip({
  items,
  separator = "/",
  right,
}: {
  items: StripItem[];
  separator?: string;
  right?: ReactNode;
}) {
  const pathname = usePathname();
  // -1 = not decided yet (server render + first paint), so nothing flickers.
  const [typed, setTyped] = useState(-1);
  const [shown, setShown] = useState(-1);
  // Strict Mode runs effects twice in dev. Without this the second pass reads
  // the "already played" flag the first pass just wrote and skips its own
  // animation — so the strip only ever animated in production.
  const decided = useRef<string | null>(null);

  const head = items[0];
  const rest = items.slice(1);

  useEffect(() => {
    const key = `hq-strip:${pathname}`;
    if (decided.current === key) return;
    decided.current = key;

    const skip =
      typeof window === "undefined" ||
      sessionStorage.getItem(key) === "1" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (skip) {
      setTyped(head?.text.length ?? 0);
      setShown(rest.length);
      return;
    }

    const start = () => {
      sessionStorage.setItem(key, "1");
      setTyped(0);
      setShown(0);
    };

    // On a cold arrival the boot terminal is covering the page — wait for it,
    // or this plays out of sight and the strip is just there when you look.
    if (sessionStorage.getItem("hq-booted") === "1") {
      start();
      return;
    }
    window.addEventListener("hq:booted", start, { once: true });
    return () => window.removeEventListener("hq:booted", start);
  }, [pathname, head?.text.length, rest.length]);

  // Type the first reading.
  useEffect(() => {
    if (typed < 0 || !head || typed >= head.text.length) return;
    const t = setTimeout(() => setTyped((v) => v + 1), typed === 0 ? 140 : 22);
    return () => clearTimeout(t);
  }, [typed, head]);

  const typing = typed >= 0 && head != null && typed < head.text.length;

  // Then bring the rest in, one at a time.
  useEffect(() => {
    if (typing || shown < 0 || shown >= rest.length) return;
    const t = setTimeout(() => setShown((v) => v + 1), 70);
    return () => clearTimeout(t);
  }, [shown, typing, rest.length]);

  return (
    <div className="hq-strip hq-rise mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 py-2.5">
      {head && (
        <span className="hq-label flex items-center gap-1.5">
          {head.dot && (
            <span
              className={`hq-dot ${head.pulse ? "hq-dot-live" : ""}`}
              style={{ backgroundColor: TONE[head.dot] ?? TONE.idle }}
              aria-hidden
            />
          )}
          {/* Green while it's still reporting, amber once it's a fact. The
              transition is only on the way out — easing *into* green means the
              first characters arrive amber, which reads as a fade, not a
              readout coming through. */}
          <span
            style={{
              color: typing ? "var(--color-moss)" : undefined,
              transition: typing ? "none" : "color 500ms ease",
            }}
          >
            {typed < 0 ? head.text : head.text.slice(0, typed)}
            {typing && <span className="hq-caret" />}
          </span>
        </span>
      )}

      {rest.map((it, i) => {
        const on = shown < 0 || i < shown;
        return (
          <span
            key={it.text}
            className="flex items-center gap-5"
            style={{
              opacity: on ? 1 : 0,
              transform: on ? "none" : "translateY(3px)",
              transition: "opacity 260ms ease, transform 260ms ease",
            }}
          >
            <span className="hq-label opacity-30" aria-hidden>
              {separator}
            </span>
            <span className="hq-label flex items-center gap-1.5">
              {it.dot && (
                <span
                  className={`hq-dot ${it.pulse ? "hq-dot-live" : ""}`}
                  style={{ backgroundColor: TONE[it.dot] ?? TONE.idle }}
                  aria-hidden
                />
              )}
              {it.text}
            </span>
          </span>
        );
      })}

      {right && <span className="ml-auto shrink-0">{right}</span>}
    </div>
  );
}
