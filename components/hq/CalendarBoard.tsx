"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Panel, Tag, Dot, Nil, Proto } from "@/components/hq/Kit";
import { parseDate } from "@/lib/dates";

// ── The one calendar ────────────────────────────────────────────────────────
// Month / Week / Agenda over the same event set. Operations and Releases are
// real rows; Battles are a marked prototype. The board also runs a conflict
// sweep — two operations overlapping on the same night, with the operatives
// who'd have to be in two places at once.

export type CalKind = "operation" | "battle" | "release";

export type CalEvent = {
  id: string;
  kind: CalKind;
  date: string; // 'YYYY-MM-DD'
  start: string | null; // 'HH:MM'
  end: string | null; // 'HH:MM' — real when the room recorded it, else assumed
  assumed: boolean; // end time is a 2h assumption, not a recorded fact
  title: string;
  game: string;
  emoji: string;
  colour: string;
  squadId: string | null;
  squadName: string | null;
  mine: boolean;
  rosterIds: string[];
  rosterCount: number;
  state: "standing" | "live" | "archived" | "scrubbed" | "marker";
  href: string | null;
  proto: boolean;
  note: string | null;
};

type View = "month" | "week" | "agenda";
type Scope = "mine" | "all";

const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const KIND_LABEL: Record<CalKind, string> = {
  operation: "Operations",
  battle: "Battles",
  release: "Releases",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

const fmtMin = (n: number) => {
  const v = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};

/** Monday-based start of the week containing `d`. */
function weekStart(d: Date): Date {
  const out = new Date(d);
  const dow = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - dow);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Minute span of an event, treating a wrap past midnight as +24h. */
function span(e: CalEvent): { from: number; to: number } | null {
  if (!e.start) return null;
  const from = toMin(e.start);
  const to = e.end ? toMin(e.end) : from + 120;
  return { from, to: to <= from ? to + 1440 : to };
}

export function CalendarBoard({
  events,
  squads,
  people,
  today,
}: {
  events: CalEvent[];
  squads: { id: string; label: string }[];
  people: Record<string, string>;
  today: string;
}) {
  const [view, setView] = useState<View>("month");
  const [scope, setScope] = useState<Scope>("all");
  const [squad, setSquad] = useState<string>("");
  const [kinds, setKinds] = useState<Record<CalKind, boolean>>({
    operation: true,
    battle: true,
    release: true,
  });
  const [anchor, setAnchor] = useState<Date>(() => parseDate(today));
  const [showPast, setShowPast] = useState(false);

  const shown = useMemo(
    () =>
      events.filter((e) => {
        if (!kinds[e.kind]) return false;
        if (scope === "mine" && !e.mine) return false;
        if (squad && e.squadId !== squad) return false;
        return true;
      }),
    [events, kinds, scope, squad],
  );

  // ── Conflict sweep — always across every operation, never the filtered set.
  const conflicts = useMemo(() => {
    const ops = events.filter((e) => e.kind === "operation" && e.state !== "scrubbed" && e.start);
    const byDate = new Map<string, CalEvent[]>();
    for (const e of ops) (byDate.get(e.date) ?? byDate.set(e.date, []).get(e.date)!).push(e);

    const out: {
      key: string;
      date: string;
      a: CalEvent;
      b: CalEvent;
      from: number;
      to: number;
      clash: string[];
    }[] = [];

    for (const [date, list] of byDate) {
      const sorted = [...list].sort((x, y) => (x.start! < y.start! ? -1 : 1));
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const sa = span(sorted[i]);
          const sb = span(sorted[j]);
          if (!sa || !sb) continue;
          if (sa.from >= sb.to || sb.from >= sa.to) continue;
          const setB = new Set(sorted[j].rosterIds);
          const clash = sorted[i].rosterIds.filter((id) => setB.has(id));
          out.push({
            key: `${sorted[i].id}-${sorted[j].id}`,
            date,
            a: sorted[i],
            b: sorted[j],
            from: Math.max(sa.from, sb.from),
            to: Math.min(sa.to, sb.to),
            clash: clash.map((id) => people[id] ?? "Unknown"),
          });
        }
      }
    }
    return out.sort((x, y) => (x.date < y.date ? -1 : 1));
  }, [events, people]);

  const period =
    view === "week"
      ? (() => {
          const s = weekStart(anchor);
          const e = addDays(s, 6);
          return `${s.getDate()} ${MON[s.getMonth()]} — ${e.getDate()} ${MON[e.getMonth()]} ${e.getFullYear()}`;
        })()
      : view === "month"
        ? `${MON[anchor.getMonth()]} ${anchor.getFullYear()}`
        : "ROLLING";

  function step(dir: -1 | 1) {
    setAnchor((a) => {
      const next = new Date(a);
      if (view === "week") next.setDate(next.getDate() + dir * 7);
      else next.setMonth(next.getMonth() + dir);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Control strip ──────────────────────────────────────────────── */}
      <Panel i={0} pad={false}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-3">
          <Switcher
            options={[
              { v: "month", l: "Month" },
              { v: "week", l: "Week" },
              { v: "agenda", l: "Agenda" },
            ]}
            value={view}
            onChange={(v) => setView(v as View)}
          />

          <div className="flex items-center gap-2">
            <NavBtn onClick={() => step(-1)} disabled={view === "agenda"}>
              ◀
            </NavBtn>
            <span className="hq-readout min-w-[210px] text-center text-[15px] font-bold uppercase tracking-[0.04em]">
              {period}
            </span>
            <NavBtn onClick={() => step(1)} disabled={view === "agenda"}>
              ▶
            </NavBtn>
            <button
              onClick={() => setAnchor(parseDate(today))}
              className="hq-label rounded-[3px] border border-rule px-2.5 py-1.5 transition-colors hover:border-sand hover:text-ink"
            >
              Today
            </button>
          </div>

          <div className="h-6 w-px bg-rule" />

          <Switcher
            options={[
              { v: "mine", l: "Mine" },
              { v: "all", l: "All" },
            ]}
            value={scope}
            onChange={(v) => setScope(v as Scope)}
          />

          <div className="relative">
            <select
              value={squad}
              onChange={(e) => setSquad(e.target.value)}
              className="hq-label appearance-none rounded-[3px] border border-rule bg-transparent py-1.5 pl-2.5 pr-7 text-ink outline-none focus:border-sand"
            >
              <option value="">All squads</option>
              {squads.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-ink-soft">
              ▼
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {(Object.keys(KIND_LABEL) as CalKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKinds((s) => ({ ...s, [k]: !s[k] }))}
                className="hq-label flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1.5 transition-colors"
                style={{
                  borderColor: kinds[k] ? "var(--color-sand)" : "var(--color-rule)",
                  color: kinds[k] ? "var(--color-ink)" : "var(--color-ink-soft)",
                  backgroundColor: kinds[k] ? "rgba(245,182,61,0.07)" : "transparent",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    color:
                      k === "release"
                        ? "var(--color-sand)"
                        : k === "battle"
                          ? "var(--color-flag)"
                          : "var(--color-moss)",
                  }}
                >
                  {k === "release" ? "◆" : k === "battle" ? "⚔" : "▮"}
                </span>
                {KIND_LABEL[k]}
                {k === "battle" && <Proto>proto</Proto>}
              </button>
            ))}
          </div>

          <span className="hq-mono ml-auto text-[11px] text-ink-soft">
            {shown.length} PLOTTED / {events.length} TRACKED
          </span>
        </div>
      </Panel>

      {/* ── Scheduling conflicts ───────────────────────────────────────── */}
      <Panel
        i={1}
        label="Scheduling conflict"
        status={<Dot tone={conflicts.length ? "alert" : "idle"} pulse={conflicts.length > 0} />}
        sweep={conflicts.length > 0}
        right={
          <span
            className="hq-mono text-xs"
            style={{ color: conflicts.length ? "var(--color-flag)" : "var(--color-ink-soft)" }}
          >
            {conflicts.length} DETECTED
          </span>
        }
      >
        {conflicts.length === 0 ? (
          <p className="hq-mono py-2 text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            No overlapping operations on the board — the schedule is clean.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conflicts.map((c) => (
              <li
                key={c.key}
                className="rounded-[3px] border px-3 py-2.5"
                style={{
                  borderColor: "color-mix(in srgb, var(--color-flag) 40%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--color-flag) 7%, transparent)",
                }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Tag tone="alert" solid>
                    Conflict
                  </Tag>
                  <span className="hq-label">
                    {DOW[(parseDate(c.date).getDay() + 6) % 7]} {parseDate(c.date).getDate()}{" "}
                    {MON[parseDate(c.date).getMonth()]}
                  </span>
                  <span className="hq-mono text-[11px] text-ink-soft">
                    OVERLAP {fmtMin(c.from)}–{fmtMin(c.to)}
                  </span>
                </div>
                <p className="hq-mono text-[12px] uppercase tracking-[0.06em]">
                  <span style={{ color: c.a.colour }}>{c.a.title}</span>
                  <span className="text-ink-soft">
                    {" "}
                    — {c.a.start}–{c.a.end}
                  </span>
                  <span className="text-ink-soft"> / </span>
                  <span style={{ color: c.b.colour }}>{c.b.title}</span>
                  <span className="text-ink-soft">
                    {" "}
                    — {c.b.start}–{c.b.end}
                  </span>
                  <span className="text-ink-soft"> / </span>
                  <span style={{ color: c.clash.length ? "var(--color-flag)" : "var(--color-sand)" }}>
                    {c.clash.length} OPERATIVE{c.clash.length === 1 ? "" : "S"} DOUBLE-BOOKED
                  </span>
                </p>
                {c.clash.length > 0 && (
                  <p className="hq-mono mt-1 text-[11px] text-ink-soft">{c.clash.join(" · ")}</p>
                )}
                {(c.a.assumed || c.b.assumed) && (
                  <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                    Durations assumed at 2h where the room hasn&apos;t recorded one
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ── The board ──────────────────────────────────────────────────── */}
      {view === "month" && <MonthGrid anchor={anchor} events={shown} today={today} />}
      {view === "week" && <WeekGrid anchor={anchor} events={shown} today={today} />}
      {view === "agenda" && (
        <AgendaList events={shown} today={today} showPast={showPast} onTogglePast={() => setShowPast((s) => !s)} />
      )}
    </div>
  );
}

// ── Month ───────────────────────────────────────────────────────────────────

function MonthGrid({ anchor, events, today }: { anchor: Date; events: CalEvent[]; today: string }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = weekStart(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) (byDate.get(e.date) ?? byDate.set(e.date, []).get(e.date)!).push(e);

  return (
    <Panel i={2} pad={false} label="Month board" right={<span className="hq-mono text-[11px] text-ink-soft">MON — SUN</span>}>
      <div className="grid grid-cols-7 border-b border-rule">
        {DOW.map((d) => (
          <div key={d} className="hq-label border-r border-rule px-2 py-1.5 last:border-r-0">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const key = iso(d);
          const list = (byDate.get(key) ?? []).sort((a, b) => (a.start ?? "99") < (b.start ?? "99") ? -1 : 1);
          const outside = d.getMonth() !== anchor.getMonth();
          const isToday = key === today;
          return (
            <div
              key={key}
              className="min-h-[122px] border-b border-r border-rule/70 p-1.5 [&:nth-child(7n)]:border-r-0"
              style={{
                opacity: outside ? 0.4 : 1,
                backgroundColor: isToday ? "rgba(245,182,61,0.05)" : undefined,
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className="hq-mono text-[11px] font-semibold"
                  style={{ color: isToday ? "var(--color-sand)" : "var(--color-ink-soft)" }}
                >
                  {String(d.getDate()).padStart(2, "0")}
                </span>
                {isToday && <span className="hq-label" style={{ color: "var(--color-sand)" }}>Today</span>}
                {!isToday && list.length > 3 && (
                  <span className="hq-mono text-[10px] text-ink-soft">+{list.length - 3}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {list.slice(0, 3).map((e, n) => (
                  <MonthChip key={e.id} e={e} i={i + n} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function MonthChip({ e, i }: { e: CalEvent; i: number }) {
  const inner = (
    <div
      className="hq-rise flex items-center gap-1.5 rounded-[2px] border-l-2 px-1.5 py-1 transition-colors"
      style={{
        ["--i" as string]: i % 12,
        borderLeftColor: e.colour,
        backgroundColor: "rgba(255,255,255,0.03)",
        opacity: e.state === "scrubbed" ? 0.45 : 1,
      }}
    >
      <span className="shrink-0 text-[11px] leading-none" aria-hidden>
        {e.kind === "release" ? "◆" : e.emoji}
      </span>
      <span className="hq-mono min-w-0 flex-1 truncate text-[10.5px] uppercase tracking-[0.04em]">
        {e.title}
      </span>
      {e.state === "live" && <span className="hq-dot hq-dot-live shrink-0" aria-hidden />}
      {e.start && (
        <span className="hq-mono shrink-0 text-[10px] text-ink-soft">{e.start}</span>
      )}
    </div>
  );
  return e.href ? (
    <Link href={e.href} className="block hover:brightness-125">
      {inner}
    </Link>
  ) : (
    <div title={e.note ?? undefined}>{inner}</div>
  );
}

// ── Week ────────────────────────────────────────────────────────────────────

const ROW_H = 46; // px per hour

function WeekGrid({ anchor, events, today }: { anchor: Date; events: CalEvent[]; today: string }) {
  const start = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const keys = days.map(iso);
  const inWeek = events.filter((e) => keys.includes(e.date));

  const timed = inWeek.filter((e) => e.start);
  const allDay = inWeek.filter((e) => !e.start);

  let lo = 17 * 60;
  let hi = 24 * 60;
  for (const e of timed) {
    const s = span(e);
    if (!s) continue;
    lo = Math.min(lo, Math.floor(s.from / 60) * 60);
    hi = Math.max(hi, Math.ceil(s.to / 60) * 60);
  }
  const hours = Array.from({ length: Math.max(1, (hi - lo) / 60) }, (_, i) => lo + i * 60);

  return (
    <Panel
      i={2}
      pad={false}
      label="Week board"
      right={<span className="hq-mono text-[11px] text-ink-soft">DEPLOYMENT WINDOW {fmtMin(lo)}–{fmtMin(hi)}</span>}
    >
      {/* Day heads */}
      <div className="grid border-b border-rule" style={{ gridTemplateColumns: "56px repeat(7, minmax(0,1fr))" }}>
        <div className="border-r border-rule" />
        {days.map((d) => {
          const k = iso(d);
          return (
            <div
              key={k}
              className="border-r border-rule px-2 py-1.5 last:border-r-0"
              style={{ backgroundColor: k === today ? "rgba(245,182,61,0.05)" : undefined }}
            >
              <span className="hq-label" style={{ color: k === today ? "var(--color-sand)" : undefined }}>
                {DOW[(d.getDay() + 6) % 7]} {String(d.getDate()).padStart(2, "0")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Undated markers (releases) sit above the time grid */}
      {allDay.length > 0 && (
        <div className="grid border-b border-rule" style={{ gridTemplateColumns: "56px repeat(7, minmax(0,1fr))" }}>
          <div className="hq-label border-r border-rule px-2 py-1.5">Mark</div>
          {keys.map((k) => (
            <div key={k} className="flex flex-col gap-1 border-r border-rule p-1 last:border-r-0">
              {allDay
                .filter((e) => e.date === k)
                .map((e) => (
                  <div
                    key={e.id}
                    className="hq-mono truncate rounded-[2px] border-l-2 px-1.5 py-1 text-[10.5px] uppercase"
                    style={{ borderLeftColor: e.colour, backgroundColor: "rgba(255,255,255,0.03)" }}
                  >
                    ◆ {e.title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, minmax(0,1fr))" }}>
        <div className="border-r border-rule">
          {hours.map((h) => (
            <div key={h} className="hq-mono border-b border-rule/50 px-2 text-[10px] text-ink-soft" style={{ height: ROW_H }}>
              {fmtMin(h)}
            </div>
          ))}
        </div>
        {keys.map((k) => {
          const list = timed.filter((e) => e.date === k);
          return (
            <div
              key={k}
              className="relative border-r border-rule last:border-r-0"
              style={{
                height: hours.length * ROW_H,
                backgroundColor: k === today ? "rgba(245,182,61,0.035)" : undefined,
              }}
            >
              {hours.map((h) => (
                <div key={h} className="border-b border-rule/40" style={{ height: ROW_H }} />
              ))}
              {list.map((e, n) => {
                const s = span(e)!;
                const top = ((s.from - lo) / 60) * ROW_H;
                const height = Math.max(22, ((s.to - s.from) / 60) * ROW_H - 3);
                const overlap = list.filter((o) => {
                  const so = span(o)!;
                  return so.from < s.to && s.from < so.to;
                });
                const idx = overlap.findIndex((o) => o.id === e.id);
                const w = 100 / Math.max(1, overlap.length);
                const block = (
                  <div
                    className="absolute overflow-hidden rounded-[2px] border-l-2 px-1.5 py-1"
                    style={{
                      top,
                      height,
                      left: `calc(${idx * w}% + 2px)`,
                      width: `calc(${w}% - 4px)`,
                      borderLeftColor: e.colour,
                      backgroundColor: "rgba(20,28,25,0.96)",
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${e.colour} 32%, transparent)`,
                      opacity: e.state === "scrubbed" ? 0.45 : 1,
                    }}
                  >
                    <p className="hq-mono truncate text-[10.5px] uppercase tracking-[0.04em]">
                      {e.emoji} {e.title}
                    </p>
                    <p className="hq-mono truncate text-[10px] text-ink-soft">
                      {e.start}–{e.end}
                      {e.assumed ? " ~" : ""}
                      {e.rosterCount ? ` · ${e.rosterCount} on` : ""}
                    </p>
                  </div>
                );
                return e.href ? (
                  <Link key={e.id + n} href={e.href} className="hover:brightness-125">
                    {block}
                  </Link>
                ) : (
                  <div key={e.id + n}>{block}</div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="hq-mono border-t border-rule px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        ~ marks an assumed 2h duration — the room records the real one on close
      </p>
    </Panel>
  );
}

// ── Agenda ──────────────────────────────────────────────────────────────────

function AgendaList({
  events,
  today,
  showPast,
  onTogglePast,
}: {
  events: CalEvent[];
  today: string;
  showPast: boolean;
  onTogglePast: () => void;
}) {
  const sorted = [...events].sort((a, b) =>
    a.date === b.date ? ((a.start ?? "99") < (b.start ?? "99") ? -1 : 1) : a.date < b.date ? -1 : 1,
  );
  const past = sorted.filter((e) => e.date < today);
  const live = sorted.filter((e) => e.date >= today);
  const list = showPast ? sorted : live;

  const groups: { date: string; items: CalEvent[] }[] = [];
  for (const e of list) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  return (
    <Panel
      i={2}
      pad={false}
      label="Agenda"
      right={
        <button onClick={onTogglePast} className="hq-label transition-colors hover:text-ink">
          {showPast ? "Hide" : "Show"} {past.length} past
        </button>
      }
    >
      {groups.length === 0 ? (
        <Nil>Nothing on the board</Nil>
      ) : (
        <div className="flex flex-col">
          {groups.map((g, gi) => {
            const d = parseDate(g.date);
            return (
              <div key={g.date} className="hq-rise flex gap-4 border-b border-rule/60 px-4 py-3 last:border-0" style={{ ["--i" as string]: Math.min(gi, 10) }}>
                <div className="w-24 shrink-0">
                  <p
                    className="hq-label"
                    style={{ color: g.date === today ? "var(--color-sand)" : undefined }}
                  >
                    {DOW[(d.getDay() + 6) % 7]}
                  </p>
                  <p className="hq-readout text-[22px] font-bold leading-none">
                    {String(d.getDate()).padStart(2, "0")}
                  </p>
                  <p className="hq-label">{MON[d.getMonth()]}</p>
                </div>
                <ul className="min-w-0 flex-1 flex-col">
                  {g.items.map((e) => {
                    const row = (
                      <div className="flex items-center gap-3 border-b border-rule/40 py-1.5 last:border-0">
                        <span className="hq-mono w-24 shrink-0 text-[11px] text-ink-soft">
                          {e.start ? `${e.start}${e.end ? `–${e.end}` : ""}` : "—"}
                        </span>
                        <span className="w-5 shrink-0 text-center">{e.kind === "release" ? "◆" : e.emoji}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">{e.title}</span>
                        {e.squadName && <Tag tone="warn">{e.squadName}</Tag>}
                        {e.proto && <Proto />}
                        {e.state === "live" && <Tag tone="live" solid>Live</Tag>}
                        {e.state === "archived" && <Tag tone="idle">Archived</Tag>}
                        {e.state === "scrubbed" && <Tag tone="alert">Scrubbed</Tag>}
                        {e.kind === "operation" && e.state === "standing" && (
                          <span className="hq-mono shrink-0 text-[11px] text-ink-soft">{e.rosterCount} on</span>
                        )}
                      </div>
                    );
                    return (
                      <li key={e.id}>
                        {e.href ? (
                          <Link href={e.href} className="block transition-colors hover:bg-[rgba(255,255,255,0.025)]">
                            {row}
                          </Link>
                        ) : (
                          row
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ── Bits ────────────────────────────────────────────────────────────────────

function Switcher({
  options,
  value,
  onChange,
}: {
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-[3px] border border-rule">
      {options.map((o, i) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className="hq-label px-3 py-1.5 transition-colors"
            style={{
              backgroundColor: active ? "var(--color-sand)" : "transparent",
              color: active ? "#0b100e" : "var(--color-ink-soft)",
              borderLeft: i > 0 ? "1px solid var(--color-rule)" : "none",
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function NavBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="hq-mono rounded-[3px] border border-rule px-2.5 py-1.5 text-[11px] text-ink-soft transition-colors hover:border-sand hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
