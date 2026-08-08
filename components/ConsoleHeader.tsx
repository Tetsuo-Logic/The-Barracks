import type { ReactNode } from "react";

// The shared console section header — a compact HUD strip that makes every page
// read as part of the same system: scanlines, a sweeping recon beam, a pulsing
// status dot, a mono "sector" tag and the angular display title.
export function ConsoleHeader({
  title,
  tag = "Sector",
  right,
  className = "mb-5",
}: {
  title: string;
  tag?: string;
  right?: ReactNode;
  className?: string;
}) {
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
            <div className="display truncate text-[19px] font-semibold uppercase leading-none tracking-[0.02em] text-ink">
              {title}
            </div>
          </div>
        </div>
        {right && <div className="shrink-0 text-right">{right}</div>}
      </div>
    </div>
  );
}
