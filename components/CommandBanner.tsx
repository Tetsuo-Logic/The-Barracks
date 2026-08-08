// The home-screen command banner — the app's "boot screen" identity. A console
// panel: system-online readout, a signal meter, the big angular wordmark
// (powers on with a flicker + recurring signal glitch), a live sitrep line with
// a blinking cursor, and a scrolling telemetry ticker. Pure CSS motion, all of
// it killed under prefers-reduced-motion.
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

        <h1
          className="display poweron mt-3 text-[40px] font-bold uppercase leading-[0.92] tracking-[0.01em] text-ink"
          aria-label="The Barracks"
        >
          <span className="signal inline-block">The Barracks</span>
        </h1>

        <p className="mt-2 flex items-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
          <span className="text-sand">{"//"}</span>
          <span className="ml-1.5">
            games-night ops · squad {squad}
            {callsign ? ` · ${callsign}` : " · no appeals"}
          </span>
          <span
            className="cursor ml-1 inline-block h-[12px] w-[7px] translate-y-[1px] bg-sand"
            aria-hidden
          />
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
