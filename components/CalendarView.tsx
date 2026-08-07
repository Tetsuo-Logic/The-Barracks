"use client";

import Link from "next/link";
import { useState } from "react";
import {
  shortTime,
  formatLabel,
  FORMAT_COLOUR,
  parseDate,
  todayISO,
} from "@/lib/dates";
import type { Competition } from "@/lib/types";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Month grid, Monday-first (§5). Dots in the format colour; today gets a flag
// ring. Tap a day → its fixtures below. Prev/next between months.
export function CalendarView({
  competitions,
  initialYear,
  initialMonth,
}: {
  competitions: Competition[];
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

  const monthFixtures = competitions
    .filter((c) => c.status !== "cancelled" && c.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const listForDay = selected ? (byDate.get(selected) ?? []) : null;

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
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {comps?.slice(0, 3).map((c) => (
                  <span key={c.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: FORMAT_COLOUR[c.format] }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* selected day fixtures */}
      {listForDay && listForDay.length > 0 && (
        <div className="mt-5">
          <p className="label mb-1">On this day</p>
          <hr className="rule" />
          {listForDay.map((c) => (
            <DayRow key={c.id} comp={c} />
          ))}
        </div>
      )}

      {/* month list */}
      <div className="mt-6">
        <p className="label mb-1">{MONTHS[month]}</p>
        <hr className="rule" />
        {monthFixtures.length === 0 ? (
          <p className="py-6 text-center text-ink-soft">Nothing this month.</p>
        ) : (
          monthFixtures.map((c) => <DayRow key={c.id} comp={c} />)
        )}
      </div>
    </div>
  );
}

function DayRow({ comp }: { comp: Competition }) {
  const tee = shortTime(comp.tee_time);
  return (
    <Link href={`/comp/${comp.id}`} className="flex items-center gap-3 border-b border-rule py-3">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: FORMAT_COLOUR[comp.format] }} />
      <span className="w-10 shrink-0 font-narrow text-sm font-semibold tabular-nums text-ink">
        {parseDate(comp.date).getDate()}
      </span>
      <span className="flex-1 truncate text-ink">{comp.course}</span>
      <span className="shrink-0 font-narrow text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
        {comp.holes} · {formatLabel(comp.format)}
        {tee && ` · ${tee}`}
      </span>
    </Link>
  );
}
