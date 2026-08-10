"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

// The shared console section header — a compact HUD strip that makes every page
// read as part of the same system. The title TYPES OUT on load, matching the
// command banner: scanlines, a sweeping recon beam, a pulsing dot, a mono
// "sector" tag and the angular display title.
export function ConsoleHeader({
  title,
  tag = "Sector",
  sub,
  right,
  className = "mb-5",
}: {
  title: string;
  tag?: string;
  sub?: string; // optional green typed line under the title
  right?: ReactNode;
  className?: string;
}) {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const [subTyped, setSubTyped] = useState("");
  useEffect(() => {
    setTyped("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(title.slice(0, i));
      if (i >= title.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 55);
    return () => clearInterval(id);
  }, [title]);

  // Type the green sub-line once the title finishes.
  useEffect(() => {
    if (!done || !sub) return;
    setSubTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setSubTyped(sub.slice(0, i));
      if (i >= sub.length) clearInterval(id);
    }, 34);
    return () => clearInterval(id);
  }, [done, sub]);

  return (
    <div className={`hud relative overflow-hidden px-4 py-3 ${className}`}>
      <div className="scanlines pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div
        className="scanbeam pointer-events-none absolute inset-x-0 top-0 h-px bg-sand/50 [box-shadow:0_0_8px_1px_var(--color-sand)]"
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="pulse h-1.5 w-1.5 shrink-0 rounded-full bg-moss" aria-hidden />
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-ink-soft">
              {tag}
            </div>
            <div
              className="display truncate text-[19px] font-semibold uppercase leading-none tracking-[0.02em] text-ink"
              aria-label={title}
            >
              <span aria-hidden>{typed || " "}</span>
              {!done && (
                <span
                  className="cursor ml-0.5 inline-block h-[15px] w-[7px] translate-y-[2px] bg-sand"
                  aria-hidden
                />
              )}
            </div>
            {sub && (
              <div
                className="mt-1 flex items-center font-mono text-[10px] uppercase tracking-[0.14em] text-moss"
                aria-label={sub}
              >
                <span className="text-sand">{"//"}</span>
                <span className="ml-1.5">{subTyped}</span>
                {done && (
                  <span
                    className="cursor ml-1 inline-block h-[9px] w-[5px] translate-y-[1px] bg-moss"
                    aria-hidden
                  />
                )}
              </div>
            )}
          </div>
        </div>
        {right && <div className="shrink-0 text-right">{right}</div>}
      </div>
    </div>
  );
}
