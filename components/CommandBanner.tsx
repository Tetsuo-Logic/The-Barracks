"use client";

import { useEffect, useState } from "react";

// The home-screen command banner — the app's "boot screen" identity. The
// wordmark TYPES OUT on every load (sci-fi terminal style), then keeps the
// recon beam, signal meter, scanlines and telemetry ticker running. All motion
// is pure CSS except the type-on, and all of it is honoured by reduced-motion.
const WORDMARK = "THE BARRACKS";

export function CommandBanner({
  operators,
  callsign,
}: {
  operators: number;
  callsign?: string | null;
}) {
  const squad = String(operators).padStart(2, "0");
  const ticker = [
    `SQUAD ${squad}`,
    "COMMS SECURE",
    "UPLINK NOMINAL",
    "MORALE HIGH",
    "AWAITING ORDERS",
    "NO APPEALS",
  ].join("  ·  ");

  // The sitrep line — types out in green, under the wordmark.
  const sitrep = `games-night ops · squad ${squad}${callsign ? ` · ${callsign}` : " · no appeals"}`;

  // Phase 1: type the wordmark. Phase 2 (after): type the sitrep in green.
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const [subTyped, setSubTyped] = useState("");

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(WORDMARK.slice(0, i));
      if (i >= WORDMARK.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 85);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!done) return;
    setSubTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setSubTyped(sitrep.slice(0, i));
      if (i >= sitrep.length) {
        clearInterval(id);
      }
    }, 32);
    return () => clearInterval(id);
  }, [done, sitrep]);

  return (
    <section className="hud relative mb-6 overflow-hidden px-5 pb-9 pt-6">
      {/* CRT scanlines + a sweeping recon beam */}
      <div className="scanlines pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div
        className="scanbeam pointer-events-none absolute inset-x-0 top-0 h-px bg-sand/60 [box-shadow:0_0_10px_1px_var(--color-sand)]"
        aria-hidden
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="pulse h-2 w-2 rounded-full bg-moss" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-moss">
              System online
            </span>
          </div>
          {/* signal meter */}
          <div className="flex items-center gap-2">
            <div className="flex h-3 items-end gap-[2px]" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="bar w-[2px] bg-sand/80"
                  style={{ height: "100%", animationDelay: `${i * 0.13}s` }}
                />
              ))}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
              secure
            </span>
          </div>
        </div>

        {/* wordmark, typed out */}
        <h1
          className={`display mt-3 text-[clamp(2.9rem,13.5vw,3.6rem)] font-bold uppercase leading-[0.9] tracking-[-0.01em] text-ink [text-shadow:0_0_22px_rgba(245,182,61,0.22)] ${done ? "signal" : ""}`}
          aria-label="The Barracks"
        >
          <span aria-hidden>{typed || " "}</span>
          {!done && (
            <span
              className="cursor ml-1 inline-block h-[42px] w-[11px] translate-y-[5px] bg-sand align-baseline"
              aria-hidden
            />
          )}
        </h1>

        <p className="mt-2 flex min-h-[1.3em] items-center font-mono text-[11px] uppercase tracking-[0.18em] text-moss">
          <span className="text-sand">{"//"}</span>
          <span className="ml-1.5" aria-label={sitrep}>
            {subTyped}
          </span>
          {done && (
            <span
              className="cursor ml-1 inline-block h-[12px] w-[7px] translate-y-[1px] bg-moss"
              aria-hidden
            />
          )}
        </p>
      </div>

      {/* Telemetry ticker along the bottom edge */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-rule bg-paper/40 py-1.5">
        <div className="marquee flex w-max whitespace-nowrap will-change-transform" aria-hidden>
          <span className="px-4 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-soft/80">
            {ticker}  ·  {ticker}
          </span>
          <span className="px-4 font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-soft/80">
            {ticker}  ·  {ticker}
          </span>
        </div>
      </div>
    </section>
  );
}
