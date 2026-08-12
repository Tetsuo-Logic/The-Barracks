"use client";

import { useEffect, useState } from "react";

// The command-link handshake. Plays once per browser session (sessionStorage),
// so it's a moment of theatre on arrival rather than a toll booth on every
// navigation. Skippable with any key or click.

const LINES = [
  "BARRACKS COMMAND SYSTEM v2.4",
  "AUTHENTICATING OPERATIVE...",
  "OPERATIVE VERIFIED",
  "ESTABLISHING COMMAND LINK...",
  "COMMAND LINK ESTABLISHED",
  "LOADING BARRACKS REGISTRY...",
  "SQUADS SYNCHRONISED",
  "TELEMETRY ONLINE",
  "HEADQUARTERS ONLINE",
];

const KEY = "hq-booted";

export function Boot({ callsign }: { callsign: string }) {
  const [done, setDone] = useState(true);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(KEY)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(KEY, "1");
      return;
    }
    setDone(false);
  }, []);

  useEffect(() => {
    if (done) return;
    if (n >= LINES.length) {
      const t = setTimeout(finish, 420);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v + 1), n === 0 ? 220 : 130);
    return () => clearTimeout(t);
  }, [n, done]);

  function finish() {
    sessionStorage.setItem(KEY, "1");
    setDone(true);
  }

  useEffect(() => {
    if (done) return;
    const skip = () => finish();
    window.addEventListener("keydown", skip);
    window.addEventListener("click", skip);
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("click", skip);
    };
  }, [done]);

  if (done) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#080c0a]"
      style={{ animation: "hq-rise 200ms ease both" }}
    >
      <div className="w-[min(560px,90vw)]">
        <p
          className="hq-readout mb-6 text-[38px] font-bold uppercase leading-none tracking-[0.06em]"
          style={{ color: "var(--color-sand)" }}
        >
          The Barracks
        </p>
        <div className="hq-mono space-y-1 text-[12px] leading-relaxed">
          {LINES.slice(0, n).map((l, i) => (
            <p key={l} style={{ color: i === n - 1 ? "var(--color-moss)" : "var(--color-ink-soft)" }}>
              <span style={{ color: "#3f4f46" }}>{">"} </span>
              {l}
              {i === n - 1 && <span className="hq-caret" />}
            </p>
          ))}
        </div>
        {n >= 3 && (
          <p className="hq-label mt-6" style={{ color: "var(--color-ink-soft)" }}>
            Welcome back, {callsign}
          </p>
        )}
        <p className="hq-label mt-8 opacity-40">Press any key to skip</p>
      </div>
    </div>
  );
}
