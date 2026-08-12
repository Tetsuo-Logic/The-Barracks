// Availability intelligence — pure functions over the real muster model.
//
// A muster stores: candidate nights (`dates`), a kick-off window
// (`window_from`/`window_to`), and per-member responses that carry their own
// per-night hours (`from_times` / `to_times`, index-aligned with
// `available_dates`). Everything the Availability screen shows is derived here
// so the page stays a layout and the client matrix stays a renderer.
//
// Where a squad has no muster running we still build the same shape from the
// real roster so the screen is never empty — those squads come back with
// `live: false` and the UI marks them as prototype.

import { heroDate, parseDate } from "@/lib/dates";
import { gameById } from "@/lib/games";
import type { SquadView } from "@/lib/queries";
import type { MusterStatus } from "@/lib/types";

// ── Time helpers (wall-clock 'HH:MM', never through UTC) ───────────────────
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function toHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, min));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** Hourly ticks across a window, inclusive of both ends. */
export function hourSlots(from: string, to: string): string[] {
  const a = toMin(from);
  const b = toMin(to);
  if (b <= a) return [from];
  const out: string[] = [];
  for (let t = a; t <= b; t += 60) out.push(toHHMM(t));
  return out;
}

/** n nights from an ISO date, as bare 'YYYY-MM-DD' (no timezone drift). */
export function nextNights(fromISO: string, n: number): string[] {
  const base = parseDate(fromISO);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
}

/** Stable hash so prototype availability never flickers between renders. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// ── Shapes ────────────────────────────────────────────────────────────────
export type CellState = "on" | "off" | "silent";

export type Cell = {
  state: CellState;
  from: string | null; // their hours that night
  to: string | null;
  full: boolean; // covers the whole kick-off window
};

export type Slot = { slot: string; count: number };

export type Night = {
  iso: string;
  dow: string;
  day: string;
  mon: string;
  count: number; // operatives who marked the night
  slots: Slot[]; // headcount at each start-hour of the window
  peakCount: number;
  peakFrom: string | null; // the best overlapping window that night
  peakTo: string | null;
};

export type MemberIntel = {
  id: string;
  name: string;
  short: string;
  captain: boolean;
  responded: boolean;
  nights: number; // nights they offered
};

export type SquadIntel = {
  id: string;
  name: string;
  game: string;
  emoji: string;
  colour: string;
  tag: string | null;
  live: boolean; // a real muster is running
  mine: boolean;
  status: MusterStatus | null;
  note: string | null;
  windowFrom: string;
  windowTo: string;
  required: number; // prototype — the schema has no minimum yet
  members: MemberIntel[];
  nights: Night[];
  cells: Record<string, Record<string, Cell>>; // memberId → iso → cell
  responded: number;
  total: number;
  chosenDate: string | null;
  chosenTime: string | null;
};

const FALLBACK_WINDOW = { from: "18:00", to: "23:00" };

/** No minimum-strength column exists yet — derive one and mark it prototype. */
export function requiredFor(memberCount: number): number {
  if (memberCount <= 1) return 1;
  return Math.max(2, Math.min(memberCount, Math.ceil(memberCount * 0.7)));
}

/** One squad's availability picture, live muster or prototyped roster. */
export function buildSquadIntel(sq: SquadView, todayISO: string): SquadIntel {
  const g = gameById(sq.squad.game);
  const mu = sq.muster?.muster ?? null;
  const live = mu != null;

  const dates = mu && mu.dates.length ? [...mu.dates].sort() : nextNights(todayISO, 7);
  const windowFrom = mu?.window_from ?? FALLBACK_WINDOW.from;
  const windowTo =
    mu?.window_to && toMin(mu.window_to) > toMin(mu.window_from ?? FALLBACK_WINDOW.from)
      ? mu.window_to
      : FALLBACK_WINDOW.to;

  const responses = sq.muster?.responses ?? [];
  const respByUser = new Map(responses.map((r) => [r.user_id, r]));

  const members: MemberIntel[] = sq.members.map((m) => ({
    id: m.profile.id,
    name: m.profile.name,
    short: (m.profile.nickname || m.profile.name).slice(0, 8),
    captain: m.is_captain,
    responded: live ? respByUser.has(m.profile.id) : true,
    nights: 0,
  }));

  const cells: Record<string, Record<string, Cell>> = {};

  for (const m of members) {
    const row: Record<string, Cell> = {};
    const r = live ? respByUser.get(m.id) : undefined;

    for (const iso of dates) {
      if (live && !r) {
        row[iso] = { state: "silent", from: null, to: null, full: false };
        continue;
      }

      let on: boolean;
      let from: string;
      let to: string;

      if (live && r) {
        const idx = r.available_dates.indexOf(iso);
        on = idx >= 0;
        from = (on && r.from_times[idx]) || windowFrom;
        to = (on && r.to_times[idx]) || windowTo;
      } else {
        // Prototype — deterministic from the operative + the night.
        const h = hash(`${m.id}|${iso}|${sq.squad.id}`);
        on = h % 10 > 2;
        const lateStart = h % 3 === 0;
        const earlyEnd = h % 5 === 0;
        from = lateStart ? toHHMM(Math.min(toMin(windowTo) - 60, toMin(windowFrom) + 60)) : windowFrom;
        to = earlyEnd ? toHHMM(Math.max(toMin(from) + 60, toMin(windowTo) - 60)) : windowTo;
      }

      if (!on) {
        row[iso] = { state: "off", from: null, to: null, full: false };
        continue;
      }
      if (toMin(to) <= toMin(from)) to = toHHMM(toMin(from) + 60);
      m.nights++;
      row[iso] = {
        state: "on",
        from,
        to,
        full: toMin(from) <= toMin(windowFrom) && toMin(to) >= toMin(windowTo),
      };
    }
    cells[m.id] = row;
  }

  const starts = hourSlots(windowFrom, windowTo).slice(0, -1);

  const nights: Night[] = dates.map((iso) => {
    const hd = heroDate(iso);
    let count = 0;
    for (const m of members) if (cells[m.id][iso].state === "on") count++;

    const slots: Slot[] = starts.map((s) => {
      const sMin = toMin(s);
      let n = 0;
      for (const m of members) {
        const c = cells[m.id][iso];
        if (c.state !== "on" || !c.from || !c.to) continue;
        if (toMin(c.from) <= sMin && toMin(c.to) > sMin) n++;
      }
      return { slot: s, count: n };
    });

    // Peak = the longest unbroken run of hours at the highest headcount. That
    // run *is* the best overlapping window for the night.
    const peakCount = slots.reduce((mx, s) => Math.max(mx, s.count), 0);
    let peakFrom: string | null = null;
    let peakTo: string | null = null;
    if (peakCount > 0) {
      let bestLen = 0;
      let runStart = -1;
      for (let i = 0; i <= slots.length; i++) {
        const at = i < slots.length && slots[i].count === peakCount;
        if (at && runStart < 0) runStart = i;
        if (!at && runStart >= 0) {
          const len = i - runStart;
          if (len > bestLen) {
            bestLen = len;
            peakFrom = slots[runStart].slot;
            peakTo = toHHMM(toMin(slots[i - 1].slot) + 60);
          }
          runStart = -1;
        }
      }
    }

    return { iso, dow: hd.dow, day: hd.day, mon: hd.mon, count, slots, peakCount, peakFrom, peakTo };
  });

  return {
    id: sq.squad.id,
    name: sq.squad.name || g.name,
    game: sq.squad.game,
    emoji: g.emoji,
    colour: g.colour,
    tag: sq.squad.clan_tag,
    live,
    mine: sq.mine,
    status: mu?.status ?? null,
    note: mu?.note ?? null,
    windowFrom,
    windowTo,
    required: requiredFor(members.length),
    members,
    nights,
    cells,
    responded: live ? members.filter((m) => m.responded).length : members.length,
    total: members.length,
    chosenDate: mu?.chosen_date ?? null,
    chosenTime: mu?.chosen_time ?? null,
  };
}

// ── Recommended deployment plan ───────────────────────────────────────────
export type PlanRow = {
  key: string;
  squadId: string;
  squadName: string;
  emoji: string;
  iso: string;
  dow: string;
  day: string;
  mon: string;
  time: string; // best kick-off
  window: string; // the overlapping window, "20:30–23:00"
  count: number;
  required: number;
  total: number;
  coverage: number; // 0..100 against the squad's strength
  meets: boolean;
  live: boolean;
  reason: string;
};

/** Rank every squad's nights: strength first, then how comfortably the peak
 *  clears the requirement, then soonest. The reasoning line is prototype; the
 *  numbers underneath it are the muster's own. */
export function deploymentPlan(intel: SquadIntel[], limit = 6): PlanRow[] {
  const rows: PlanRow[] = [];

  for (const s of intel) {
    for (const n of s.nights) {
      if (n.peakCount === 0) continue;
      const coverage = s.total ? Math.round((n.peakCount / s.total) * 100) : 0;
      const meets = n.peakCount >= s.required;
      const time = n.peakFrom ?? s.windowFrom;
      rows.push({
        key: `${s.id}-${n.iso}`,
        squadId: s.id,
        squadName: s.name,
        emoji: s.emoji,
        iso: n.iso,
        dow: n.dow,
        day: n.day,
        mon: n.mon,
        time,
        window: n.peakFrom && n.peakTo ? `${n.peakFrom}–${n.peakTo}` : `${s.windowFrom}–${s.windowTo}`,
        count: n.peakCount,
        required: s.required,
        total: s.total,
        coverage,
        meets,
        live: s.live,
        reason: meets
          ? `Peak overlap holds ${n.peakCount} of ${s.total} — clears the required ${s.required}`
          : `Best available: ${n.peakCount} of ${s.total} — ${s.required - n.peakCount} short of strength`,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.meets !== b.meets) return a.meets ? -1 : 1;
    if (a.live !== b.live) return a.live ? -1 : 1;
    if (b.count !== a.count) return b.count - a.count;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    return a.iso < b.iso ? -1 : 1;
  });

  // One recommendation per squad per night is enough — keep the best two nights
  // for any one squad so the plan isn't a single squad's whole week.
  const perSquad = new Map<string, number>();
  const out: PlanRow[] = [];
  for (const r of rows) {
    const n = perSquad.get(r.squadId) ?? 0;
    if (n >= 2) continue;
    perSquad.set(r.squadId, n + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// ── Conflicts ─────────────────────────────────────────────────────────────
export type Conflict = {
  key: string;
  iso: string;
  dow: string;
  day: string;
  name: string;
  live: boolean;
  overlap: boolean; // their hours actually collide, not just the night
  squads: { name: string; emoji: string; from: string; to: string }[];
};

/** Operatives who've offered the same night to more than one squad. */
export function findConflicts(intel: SquadIntel[]): Conflict[] {
  const byNightMember = new Map<string, Conflict>();

  for (const s of intel) {
    for (const m of s.members) {
      for (const n of s.nights) {
        const c = s.cells[m.id]?.[n.iso];
        if (!c || c.state !== "on" || !c.from || !c.to) continue;
        const key = `${n.iso}|${m.id}`;
        const existing = byNightMember.get(key);
        const entry = { name: s.name, emoji: s.emoji, from: c.from, to: c.to };
        if (existing) {
          existing.squads.push(entry);
          existing.live = existing.live && s.live;
        } else {
          byNightMember.set(key, {
            key,
            iso: n.iso,
            dow: n.dow,
            day: n.day,
            name: m.name,
            live: s.live,
            overlap: false,
            squads: [entry],
          });
        }
      }
    }
  }

  const out: Conflict[] = [];
  for (const c of byNightMember.values()) {
    if (c.squads.length < 2) continue;
    // Hours collide if any pair intersects.
    outer: for (let i = 0; i < c.squads.length; i++) {
      for (let j = i + 1; j < c.squads.length; j++) {
        const a = c.squads[i];
        const b = c.squads[j];
        if (toMin(a.from) < toMin(b.to) && toMin(b.from) < toMin(a.to)) {
          c.overlap = true;
          break outer;
        }
      }
    }
    out.push(c);
  }

  out.sort((a, b) => {
    if (a.overlap !== b.overlap) return a.overlap ? -1 : 1;
    if (a.live !== b.live) return a.live ? -1 : 1;
    return a.iso < b.iso ? -1 : 1;
  });
  return out;
}
