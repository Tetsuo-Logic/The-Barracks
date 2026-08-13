"use client";

import { useEffect, useState } from "react";

// The command-link handshake, as a terminal session: the window opens, a
// command is typed into it, and only then does the system start reporting.
// Plays once per browser session (sessionStorage), so it's a moment of theatre
// on arrival rather than a toll booth on every navigation. Any key or click
// skips it.
//
// All phosphor green on purpose — this is the one screen that isn't the HQ
// interface, it's the machine underneath it booting.

const PROMPT = "C:\\BARRACKS\\HQ>";
const COMMAND = " barracks --boot --operative";

const LINES = [
  "BARRACKS COMMAND SYSTEM v2.4",
  "AUTHENTICATING OPERATIVE...",
  "OPERATIVE VERIFIED",
  "ESTABLISHING COMMAND LINK...",
  "COMMAND LINK ESTABLISHED",
  "LOADING BARRACKS REGISTRY...",
  "SQUADS SYNCHRONISED",
  "TELEMETRY ONLINE",
  "DECRYPTING COMMAND KEY...",
];

// The lock giving. Scrambles for a beat, then resolves — the moment the system
// decides you're allowed in.
const GRANTED = "ACCESS GRANTED";
// ASCII only: box-drawing glyphs aren't a single cell wide in this font, so a
// scrambling line jitters as characters resolve.
const SCRAMBLE = "#@%&$*/\|<>=+-~^?!";

const KEY = "hq-booted";

const GREEN = "var(--color-moss)";
const GREEN_DIM = "color-mix(in srgb, var(--color-moss) 55%, transparent)";
const GREEN_FAINT = "color-mix(in srgb, var(--color-moss) 32%, transparent)";
const EDGE = "color-mix(in srgb, var(--color-moss) 38%, transparent)";

export function Boot({ callsign }: { callsign: string }) {
  const [done, setDone] = useState(true);
  // Phase one: the command types itself. Phase two: the system answers.
  // Phase three: the key cracks.
  const [typed, setTyped] = useState(0);
  const [n, setN] = useState(0);
  const [crack, setCrack] = useState(-1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(KEY)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(KEY, "1");
      return;
    }
    setDone(false);
  }, []);

  // Type the command in, after a beat for the window to land.
  useEffect(() => {
    if (done || typed >= COMMAND.length) return;
    const t = setTimeout(() => setTyped((v) => v + 1), typed === 0 ? 320 : 26);
    return () => clearTimeout(t);
  }, [typed, done]);

  // Then run the boot.
  useEffect(() => {
    if (done || typed < COMMAND.length) return;
    if (n >= LINES.length) {
      if (crack < 0) setCrack(0);
      return;
    }
    const t = setTimeout(() => setN((v) => v + 1), n === 0 ? 260 : 125);
    return () => clearTimeout(t);
  }, [n, typed, done, crack]);

  // Crack the key: each character settles left to right, then the lock gives.
  useEffect(() => {
    if (done || crack < 0) return;
    if (crack > GRANTED.length) {
      const t = setTimeout(finish, 620);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCrack((v) => v + 1), crack === 0 ? 220 : 62);
    return () => clearTimeout(t);
  }, [crack, done]);

  function finish() {
    sessionStorage.setItem(KEY, "1");
    setDone(true);
    // Tell the page it can start its own arrival flair. Without this the
    // status strip types itself out behind this overlay and you never see it.
    window.dispatchEvent(new Event("hq:booted"));
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

  const typing = typed < COMMAND.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#040705] px-4">
      <div
        className="w-[min(720px,94vw)] overflow-hidden rounded-[5px] border"
        style={{
          borderColor: EDGE,
          background: "#050b08",
          boxShadow: "0 0 0 1px rgba(61,220,132,0.06), 0 40px 90px -40px rgba(0,0,0,0.95)",
          animation: "hq-term-open 300ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        {/* ── Window chrome ──────────────────────────────────────────── */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderBottom: `1px solid ${EDGE}`, background: "rgba(61,220,132,0.05)" }}
        >
          <span className="flex shrink-0 gap-1.5" aria-hidden>
            {[0.5, 0.35, 0.25].map((o, i) => (
              <span
                key={i}
                className="block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: GREEN, opacity: o }}
              />
            ))}
          </span>
          <span
            className="hq-mono min-w-0 flex-1 truncate text-center text-[10px] uppercase tracking-[0.16em]"
            style={{ color: GREEN_DIM }}
          >
            barracks command system — secure shell
          </span>
          <span className="hq-mono shrink-0 text-[10px] tracking-[0.2em]" style={{ color: GREEN_FAINT }} aria-hidden>
            ▁ ▢ ✕
          </span>
        </div>

        {/* ── Session ────────────────────────────────────────────────── */}
        <div className="hq-mono px-4 py-4 text-[12px] leading-relaxed" style={{ minHeight: 330 }}>
          <p style={{ color: GREEN }}>
            <span style={{ color: GREEN_DIM }}>{PROMPT}</span>
            {COMMAND.slice(0, typed)}
            {typing && <span className="hq-caret" />}
          </p>

          {!typing && (
            <div className="mt-3 space-y-1">
              {LINES.slice(0, n).map((l, i) => (
                <p key={l} style={{ color: i === n - 1 ? GREEN : GREEN_DIM }}>
                  <span style={{ color: GREEN_FAINT }}>{">"} </span>
                  {l}
                  {i === n - 1 && <span className="hq-caret" />}
                </p>
              ))}
            </div>
          )}

          {crack >= 0 && (
            <p className="mt-4 text-[17px] font-bold tracking-[0.2em]" style={{ color: GREEN }}>
              {GRANTED.split("").map((ch, i) =>
                i < crack ? ch : SCRAMBLE[(i * 7 + crack * 3) % SCRAMBLE.length],
              ).join("")}
            </p>
          )}

          {n >= 3 && (
            <p
              className="mt-4 text-[11px] uppercase tracking-[0.18em]"
              style={{ color: GREEN_DIM }}
            >
              Welcome back, {callsign}
            </p>
          )}
        </div>

        {/* ── Status line ────────────────────────────────────────────── */}
        <div
          className="hq-mono flex items-center justify-between px-4 py-2 text-[9px] uppercase tracking-[0.18em]"
          style={{ borderTop: `1px solid ${EDGE}`, color: GREEN_FAINT, background: "rgba(61,220,132,0.04)" }}
        >
          <span>
            {typing
              ? "Awaiting command"
              : crack > GRANTED.length
                ? "Granted"
                : crack >= 0
                  ? "Cracking key…"
                  : "Working…"}
          </span>
          <span>Press any key to skip</span>
        </div>
      </div>
    </div>
  );
}
