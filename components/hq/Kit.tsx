import type { ReactNode } from "react";

// ── Headquarters component kit ─────────────────────────────────────────────
// Every HQ screen is built from these so the whole interface stays one system.
// Server components by default — anything interactive lives in its own client
// file. Keep additions here rather than inventing per-page styles.

export function Panel({
  label,
  status,
  right,
  children,
  className = "",
  sweep = false,
  i = 0,
  pad = true,
  tier = "default",
}: {
  label?: string;
  status?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
  sweep?: boolean;
  i?: number;
  pad?: boolean;
  /** Rank on the page. Exactly one `primary` per screen; `quiet` for reference
   *  data that should recede; `live` for something actually happening now.
   *  Amber (`primary`) means significance/action, green (`live`) means running —
   *  they must not be used interchangeably. Without a rank everything shouts
   *  equally and the eye has nothing to land on. */
  tier?: "primary" | "default" | "quiet" | "live";
}) {
  return (
    <section
      className={`hq-panel hq-panel-${tier} hq-rise ${className}`}
      style={{ ["--i" as string]: i }}
    >
      {(label || right) && (
        <header className={`hq-panel-head ${sweep ? "hq-sweep" : ""}`}>
          <div className="flex min-w-0 items-center gap-2">
            {status}
            {label && <h2 className="hq-label truncate">{label}</h2>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

const TONE: Record<string, string> = {
  live: "var(--color-moss)",
  warn: "var(--color-sand)",
  alert: "var(--color-flag)",
  idle: "var(--color-rule)",
  info: "var(--color-ink-soft)",
};

export type Tone = keyof typeof TONE;

export function Dot({ tone = "idle", pulse = false }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      className={`hq-dot ${pulse ? "hq-dot-live" : ""}`}
      style={{ backgroundColor: TONE[tone] ?? TONE.idle }}
      aria-hidden
    />
  );
}

/** A hard-edged status chip — the system's way of stating a fact. */
export function Tag({
  children,
  tone = "info",
  solid = false,
}: {
  children: ReactNode;
  tone?: Tone;
  solid?: boolean;
}) {
  const c = TONE[tone] ?? TONE.info;
  return (
    <span
      className="hq-mono shrink-0 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{
        borderColor: solid ? c : `color-mix(in srgb, ${c} 45%, transparent)`,
        backgroundColor: solid ? c : `color-mix(in srgb, ${c} 11%, transparent)`,
        color: solid ? "#0b100e" : c,
      }}
    >
      {children}
    </span>
  );
}

/** Big readout. The number is the point; the label explains it. */
export function Stat({
  value,
  label,
  sub,
  tone,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div>
      <div
        className="hq-readout text-[30px] font-bold leading-none"
        style={{ color: tone ? TONE[tone] : "var(--color-ink)" }}
      >
        {value}
      </div>
      <div className="hq-label mt-1.5">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}

/** Key/value line — the workhorse of every dossier and detail panel. */
export function Row({
  k,
  v,
  tone,
}: {
  k: ReactNode;
  v: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule/60 py-1.5 last:border-0">
      <span className="hq-label shrink-0">{k}</span>
      <span
        className="hq-mono truncate text-right text-[13px]"
        style={{ color: tone ? TONE[tone] : "var(--color-ink)" }}
      >
        {v}
      </span>
    </div>
  );
}

export function Meter({ pct, tone = "live" }: { pct: number; tone?: Tone }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="hq-meter">
      <span style={{ width: `${clamped}%`, backgroundColor: TONE[tone] }} />
    </div>
  );
}

/** Page title block — every HQ screen opens with one. */
export function PageHead({
  eyebrow,
  title,
  right,
  children,
}: {
  /** String for a plain kicker, or markup for a richer identity line. */
  eyebrow?: ReactNode;
  title: string;
  right?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {typeof eyebrow === "string" ? (
          <p className="hq-label mb-1" style={{ color: "var(--color-sand)" }}>{eyebrow}</p>
        ) : (
          eyebrow
        )}
        <h1 className="hq-readout text-[26px] font-bold uppercase leading-none tracking-[0.02em]">
          {title}
        </h1>
        {children && <div className="mt-1.5 text-sm text-ink-soft">{children}</div>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

/** Nothing here yet — but say so in the system's voice, not an empty box. */
export function Nil({ children }: { children: ReactNode }) {
  return (
    <p className="hq-mono py-8 text-center text-xs uppercase tracking-[0.14em] text-ink-soft">
      {children}
    </p>
  );
}

/** Marks a panel as future/mocked so the boundary is obvious in the UI too. */
export function Proto({ children = "Prototype" }: { children?: ReactNode }) {
  return (
    <span
      className="hq-mono shrink-0 rounded-[3px] border border-dashed px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
      style={{ borderColor: "#4b5a52", color: "#6d8076" }}
      title="Interface prototype — not yet wired to live data"
    >
      {children}
    </span>
  );
}

export function Grid({ cols = 3, children }: { cols?: number; children: ReactNode }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}
