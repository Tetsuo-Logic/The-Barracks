import { STAGES, type Stage } from "@/lib/hq/planning";

// The planning lifecycle, drawn once so both roles read the same pipeline.
// A Captain works the left of it, Command works the right, and neither is left
// guessing where a request has got to.

export function Lifecycle({
  counts,
  active,
  /** Which stages this role owns — the rest are drawn, but recede. */
  owns,
}: {
  counts?: Partial<Record<Stage, number>>;
  active?: Stage;
  owns?: Stage[];
}) {
  return (
    <div className="hq-strip hq-rise mb-5 flex flex-wrap items-center gap-x-1.5 gap-y-2 py-2.5">
      {STAGES.map((s, i) => {
        const n = counts?.[s.key];
        const isActive = active === s.key;
        const mine = !owns || owns.includes(s.key);
        const lit = isActive || (n != null && n > 0 && mine);

        return (
          <span key={s.key} className="flex items-center gap-1.5">
            {i > 0 && <span className="hq-label mr-1.5 opacity-30">→</span>}
            <span
              className="hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: lit
                  ? "color-mix(in srgb, var(--color-sand) 55%, transparent)"
                  : "var(--color-rule)",
                backgroundColor: isActive ? "var(--color-sand)" : lit ? "rgba(245,182,61,0.08)" : "transparent",
                color: isActive ? "#0b100e" : lit ? "var(--color-sand)" : "#7f9187",
              }}
            >
              {s.label}
              {n != null && n > 0 && <span className="ml-1.5 opacity-80">{n}</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}
