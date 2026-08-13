"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Tone } from "@/components/hq/Kit";

// The standing-figures strip, reporting itself on arrival: the whole line types
// out in phosphor green, reading after reading, and stays green — this line is
// the machine talking, not a page heading, so it keeps the terminal's colour.
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

/** Between readings — long enough to read as a separate line of output. */
const BETWEEN = 170;

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
  /** Milliseconds per character. Varied per screen on purpose — the pages
   *  shouldn't all report at identical cadence. */
  speed = 40,
}: {
  items: StripItem[];
  separator?: string;
  right?: ReactNode;
  speed?: number;
}) {
  const pathname = usePathname();
  // -1 = not decided yet (server render + first paint), so nothing flickers.
  const [item, setItem] = useState(-1);
  const [chars, setChars] = useState(0);
  // Strict Mode runs effects twice in dev. Without this the second pass reads
  // the "already played" flag the first pass just wrote and skips its own
  // animation — so the strip only ever animated in production.
  const decided = useRef<string | null>(null);

  // Items are rebuilt every render, so key the effects off their content.
  const sig = items.map((i) => i.text).join("|");

  useEffect(() => {
    const key = `hq-strip:${pathname}`;
    if (decided.current === key) return;
    decided.current = key;

    const skip =
      typeof window === "undefined" ||
      sessionStorage.getItem(key) === "1" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (skip) {
      setItem(items.length);
      return;
    }

    const start = () => {
      sessionStorage.setItem(key, "1");
      setItem(0);
      setChars(0);
    };

    // On a cold arrival the boot terminal is covering the page — wait for it,
    // or this plays out of sight and the strip is just there when you look.
    if (sessionStorage.getItem("hq-booted") === "1") {
      start();
      return;
    }
    window.addEventListener("hq:booted", start, { once: true });
    return () => window.removeEventListener("hq:booted", start);
  }, [pathname, items.length]);

  // Type the current reading, then move to the next.
  useEffect(() => {
    if (item < 0 || item >= items.length) return;
    const text = items[item].text;

    if (chars >= text.length) {
      const t = setTimeout(() => {
        setItem((v) => v + 1);
        setChars(0);
      }, BETWEEN);
      return () => clearTimeout(t);
    }

    // Tiny hesitations: a beat at word breaks and a shorter one every so often,
    // so it reads as something typing rather than a progress bar.
    const ch = text[chars];
    const pause = ch === " " ? 80 : chars > 0 && chars % 6 === 0 ? 40 : 0;
    const first = item === 0 && chars === 0;

    const t = setTimeout(() => setChars((v) => v + 1), (first ? 160 : speed) + pause);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, chars, speed, sig]);

  const running = item >= 0 && item < items.length;

  return (
    <div className="hq-strip hq-rise mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 py-2.5">
      {items.map((it, i) => {
        const settled = item < 0 || i < item;
        const active = i === item;
        const text = settled ? it.text : active ? it.text.slice(0, chars) : it.text;
        return (
          <span
            key={it.text}
            className="flex items-center gap-5"
            // Space is held for readings that haven't been typed yet, so the
            // line doesn't shuffle sideways as each one lands.
            style={{ visibility: settled || active ? "visible" : "hidden" }}
          >
            {i > 0 && (
              <span className="hq-label opacity-30" aria-hidden>
                {separator}
              </span>
            )}
            <span
              className="hq-label flex items-center gap-1.5"
              style={{ color: "var(--color-moss)" }}
            >
              {it.dot && (
                <span
                  className={`hq-dot ${it.pulse ? "hq-dot-live" : ""}`}
                  style={{ backgroundColor: TONE[it.dot] ?? TONE.idle }}
                  aria-hidden
                />
              )}
              {text}
              {active && <span className="hq-caret" />}
            </span>
          </span>
        );
      })}

      {right && (
        <span
          className="ml-auto shrink-0"
          style={{
            opacity: running ? 0 : 1,
            transition: "opacity 300ms ease",
          }}
        >
          {right}
        </span>
      )}
    </div>
  );
}
