"use client";

import Link from "next/link";
import { useState } from "react";
import {
  shortTime,
  FORMAT_COLOUR,
  parseDate,
  todayISO,
} from "@/lib/dates";
import { gameById, compHeading, compMetaChip } from "@/lib/games";
import type { Competition } from "@/lib/types";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type RadarRelease = { id: string; title: string; date: string };

// Month grid, Monday-first (§5). Dots in the format colour; today gets a flag
// ring; radar releases get an amber 🛰️ marker. Tap a day → its fixtures below.
export function CalendarView({
  competitions,
  releases = [],
  initialYear,
  initialMonth,
}: {
  competitions: Competition[];
  releases?: RadarRelease[];
  initialYear: number;
  initialMonth: number; // 0-based
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayISO();

  const byDate = new Map<string, Competition[]>();
  for (const c of competitions) {
    if (c.status === "cancelled") continue;
    (byDate.get(c.date) ?? byDate.set(c.date, []).get(c.date)!).push(c);
  }

  const releasesByDate = new Map<string, RadarRelease[]>();
  for (const r of releases) {
    const list = releasesByDate.get(r.date) ?? [];
    list.push(r);
    releasesByDate.set(r.date, list);
  }

  // grid cells (Monday-first)
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  function step(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
    setSelected(null);
  }

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthFixtures = competitions.filter(
    (c) => c.status !== "cancelled" && c.date.startsWith(monthPrefix),
  );
  const monthReleases = releases.filter((r) => r.date.startsWith(monthPrefix));

  // Combined, date-sorted month list: fixtures + radar releases.
  type Item = { date: string; comp?: Competition; release?: RadarRelease };
  const monthItems: Item[] = [
    ...monthFixtures.map((c) => ({ date: c.date, comp: c })),
    ...monthReleases.map((r) => ({ date: r.date, release: r })),
  ].sort((a, z) => (a.date < z.date ? -1 : 1));

  const listForDay = selected ? (byDate.get(selected) ?? []) : null;
  const dayReleases = selected ? releasesByDate.get(selected) ?? [] : [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => step(-1)} className="label px-2 text-ink-soft">‹ Prev</button>
        <h2 className="font-narrow text-[15px] font-bold uppercase tracking-[0.08em] text-ink">
          {MONTHS[month]} {year}
        </h2>
        <button onClick={() => step(1)} className="label px-2 text-ink-soft">Next ›</button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {DOW.map((d, i) => (
          <div key={i} className="pb-1 text-center font-narrow text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />;
          const day = parseDate(iso).getDate();
          const comps = byDate.get(iso);
          const isToday = iso === today;
          const isSel = iso === selected;
          return (
            <button
              key={i}
              onClick={() => setSelected(isSel ? null : iso)}
              className="flex aspect-square flex-col items-center justify-center rounded-[3px]"
              style={{
                backgroundColor: isSel ? "rgba(22,36,27,0.06)" : undefined,
                border: isToday ? "1px solid var(--color-flag)" : "1px solid transparent",
              }}
            >
              <span className="font-narrow text-sm tabular-nums text-ink">{day}</span>
              <span className="mt-0.5 flex h-2 items-center gap-0.5">
                {comps?.slice(0, 3).map((c) => (
                  <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: gameById(c.game).hasScorecard ? FORMAT_COLOUR[c.format] : gameById(c.game).colour }} />
                ))}
                {releasesByDate.has(iso) && (
                  <span className="text-[9px] leading-none">🛰️</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* selected day fixtures + releases */}
      {selected && ((listForDay && listForDay.length > 0) || dayReleases.length > 0) && (
        <div className="mt-5">
          <p className="label mb-1">On this day</p>
          <hr className="rule" />
          {listForDay?.map((c) => (
            <DayRow key={c.id} comp={c} />
          ))}
          {dayReleases.map((r) => (
            <ReleaseRow key={r.id} release={r} />
          ))}
        </div>
      )}

      {/* month list */}
      <div className="mt-6">
        <p className="label mb-1">{MONTHS[month]}</p>
        <hr className="rule" />
        {monthItems.length === 0 ? (
          <p className="py-6 text-center text-ink-soft">Nothing this month.</p>
        ) : (
          monthItems.map((it) =>
            it.comp ? (
              <DayRow key={it.comp.id} comp={it.comp} />
            ) : (
              <ReleaseRow key={it.release!.id} release={it.release!} />
            ),
          )
        )}
      </div>
    </div>
  );
}

function ReleaseRow({ release }: { release: RadarRelease }) {
  return (
    <Link href="/radar" className="flex items-center gap-3 border-b border-rule py-3">
      <span className="shrink-0 text-sm leading-none">🛰️</span>
      <span className="w-10 shrink-0 font-narrow text-sm font-semibold tabular-nums text-ink">
        {parseDate(release.date).getDate()}
      </span>
      <span className="flex-1 truncate text-ink">{release.title}</span>
      <span
        className="shrink-0 font-narrow text-xs font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--color-sand)" }}
      >
        Release
      </span>
    </Link>
  );
}

function DayRow({ comp }: { comp: Competition }) {
  const tee = shortTime(comp.tee_time);
  const game = gameById(comp.game);
  const dotColour = game.hasScorecard ? FORMAT_COLOUR[comp.format] : game.colour;
  return (
    <Link href={`/comp/${comp.id}`} className="flex items-center gap-3 border-b border-rule py-3">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColour }} />
      <span className="w-10 shrink-0 font-narrow text-sm font-semibold tabular-nums text-ink">
        {parseDate(comp.date).getDate()}
      </span>
      <span className="flex-1 truncate text-ink">{compHeading(comp)}</span>
      <span className="shrink-0 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
        {compMetaChip(comp)}
        {tee && ` · ${tee}`}
      </span>
    </Link>
  );
}
