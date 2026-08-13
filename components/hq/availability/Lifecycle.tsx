import Link from "next/link";
import { STAGES, type Stage } from "@/lib/hq/planning";

// The planning lifecycle, drawn once so both roles read the same pipeline —
// and doubling as the filter for it. The default view shows only what the role
// actually owns; clicking a stage is how you go and look at the rest, rather
// than having every stage permanently on screen.

export function Lifecycle({
  counts,
  /** The stage currently being filtered to, if any. */
  active,
  /** Stages this role owns — lit even when nothing is filtered. */
  owns,
  /** Builds the href for a stage; null clears the filter. */
  hrefFor,
  /** Stages beyond this role's remit — drawn, but never the default. */
  hidden = [],
}: {
  counts?: Partial<Record<Stage, number>>;
  active?: Stage | null;
  owns?: Stage[];
  hrefFor: (s: Stage | null) => string;
  hidden?: Stage[];
}) {
  return (
    <div className="hq-strip hq-rise mb-5 flex flex-wrap items-center gap-x-1.5 gap-y-2 py-2.5">
      {STAGES.filter((s) => !hidden.includes(s.key)).map((s, i) => {
        const n = counts?.[s.key];
        const isActive = active === s.key;
        const mine = !owns || owns.includes(s.key);
        const lit = isActive || (n != null && n > 0 && mine);

        return (
          <span key={s.key} className="flex items-center gap-1.5">
            {i > 0 && <span className="hq-label mr-1.5 opacity-30">→</span>}
            <Link
              href={hrefFor(isActive ? null : s.key)}
              scroll={false}
              className="hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
              style={{
                borderColor: lit
                  ? "color-mix(in srgb, var(--color-sand) 55%, transparent)"
                  : "var(--color-rule)",
                backgroundColor: isActive
                  ? "var(--color-sand)"
                  : lit
                    ? "rgba(245,182,61,0.08)"
                    : "transparent",
                color: isActive ? "#0b100e" : lit ? "var(--color-sand)" : "#7f9187",
              }}
            >
              {s.label}
              {n != null && n > 0 && <span className="ml-1.5 opacity-80">{n}</span>}
            </Link>
          </span>
        );
      })}

      {active && (
        <Link href={hrefFor(null)} scroll={false} className="hq-label ml-auto hover:text-ink">
          Clear filter ✕
        </Link>
      )}
    </div>
  );
}
