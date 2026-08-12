import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = { title: "Barracks TV" };

// ── BARRACKS TV ────────────────────────────────────────────────────────────
// Display mode. Everything the command surface gives you — rail, top bar,
// padding, page chrome — is wrong on a TV across a room, so this route paints
// its own full-viewport shell above it and owns the whole screen. It never
// touches app/hq/layout.tsx; it simply covers it.
//
// The animations live here as a scoped stylesheet rather than in hq.css: they
// only make sense at display scale (a 9-second beam is theatre on a TV and an
// irritation on a dashboard).

const TV_CSS = `
.hq-tv {
  position: fixed;
  inset: 0;
  z-index: 80;
  overflow: hidden;
  color: var(--color-ink);
  font-family: var(--font-sans);
  background-color: #050806;
  background-image:
    radial-gradient(1500px 900px at 50% -25%, rgba(245, 182, 61, 0.11), transparent 62%),
    radial-gradient(1200px 900px at 105% 115%, rgba(61, 220, 132, 0.075), transparent 60%),
    linear-gradient(rgba(232, 239, 233, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(232, 239, 233, 0.02) 1px, transparent 1px);
  background-size: auto, auto, 64px 64px, 64px 64px;
}
/* CRT scanlines + a soft vignette, so it reads as a screen from ten feet away */
.hq-tv::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  background:
    radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.5) 100%),
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0) 0px,
      rgba(0, 0, 0, 0) 2px,
      rgba(0, 0, 0, 0.2) 3px,
      rgba(0, 0, 0, 0) 4px
    );
  opacity: 0.55;
}

/* A slow radar beam across the whole display */
.tv-beam { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; }
.tv-beam::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 34%;
  background: linear-gradient(90deg, transparent, rgba(61, 220, 132, 0.055), transparent);
  transform: translateX(-120%);
  animation: tv-beam 11s linear infinite;
}
@keyframes tv-beam { to { transform: translateX(330%); } }

/* Cards arrive; their contents follow, staggered by --i */
.tv-card { animation: tv-in 620ms cubic-bezier(0.22, 1, 0.36, 1) both; }
.tv-stagger > * { animation: tv-in 560ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--i, 0) * 70ms); }
@keyframes tv-in {
  from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
  to { opacity: 1; transform: none; filter: none; }
}

.tv-glow { text-shadow: 0 0 34px currentColor; }
.tv-pulse { animation: tv-pulse 1.9s ease-in-out infinite; }
@keyframes tv-pulse { 50% { opacity: 0.55; } }

.tv-tick {
  display: inline-block;
  animation: tv-tick 18s linear infinite;
  white-space: nowrap;
}
@keyframes tv-tick { from { transform: translateX(0); } to { transform: translateX(-50%); } }

.tv-exit {
  position: absolute;
  right: 14px;
  bottom: 12px;
  z-index: 50;
  opacity: 0.16;
  transition: opacity 160ms ease;
}
.tv-exit:hover { opacity: 0.9; }

@media (prefers-reduced-motion: reduce) {
  .tv-card, .tv-stagger > *, .tv-beam::after, .tv-pulse, .tv-tick { animation: none; }
  .tv-card, .tv-stagger > * { opacity: 1; transform: none; filter: none; }
}
`;

export default function TvLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hq-tv">
      <style dangerouslySetInnerHTML={{ __html: TV_CSS }} />
      <div className="tv-beam" aria-hidden />
      {children}
      <Link
        href="/hq"
        className="hq-mono tv-exit rounded-[3px] border border-rule px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-ink-soft"
      >
        ⎋ Exit display
      </Link>
    </div>
  );
}
