// FUTURE / PROTOTYPE — see ./README.md. No database access in this file.
//
// A sample Action Required inbox, for designing the panel against all three
// roles while the real Barracks is quiet. These are NEVER shown in production
// (see hqSampleActions) and the panel labels itself when they're present, so a
// demo row can't be mistaken for real work.
//
// Deleted outright once there's enough genuine activity to design against.

import type { HqAction } from "@/lib/hq/overview";

const SAMPLES: HqAction[] = [
  // ── Anyone ──────────────────────────────────────────────────────────────
  {
    source: "COD SQUAD",
    label: "Muster — select your available nights",
    href: "/hq/squads",
    cta: "Respond",
    tone: "warn",
    scope: "member",
  },
  {
    source: "FIFA SQUAD",
    label: "Operation roll call outstanding",
    href: "/hq/operations",
    cta: "Respond",
    tone: "alert",
    scope: "member",
  },
  {
    source: "COMMS",
    label: "Rosco asked: anyone up for a late one Friday?",
    href: "/hq/comms",
    cta: "Answer",
    tone: "warn",
    scope: "member",
  },
  {
    source: "THE COURT",
    label: "You've been named in a complaint — respond",
    href: "/hq/court",
    cta: "Defend",
    tone: "alert",
    scope: "member",
  },

  // ── Captain ─────────────────────────────────────────────────────────────
  {
    source: "COD SQUAD",
    label: "3 operatives want a night on",
    href: "/hq/squads",
    cta: "Review",
    tone: "info",
    scope: "captain",
  },
  {
    source: "SHOWDOWN SQUAD",
    label: "Muster running — 3/6 answered, closes tomorrow",
    href: "/hq/availability?req=demo:showdown",
    cta: "Review",
    tone: "info",
    scope: "captain",
  },
  {
    source: "FIFA SQUAD",
    label: "Acting captain needed — you're marked out Thursday",
    href: "/hq/squads",
    cta: "Assign",
    tone: "warn",
    scope: "captain",
  },
  {
    source: "BATTLE",
    label: "The Shed proposed Friday 20:30 — confirm the night",
    href: "/hq/battles",
    cta: "Confirm",
    tone: "warn",
    scope: "captain",
  },

  // ── President ───────────────────────────────────────────────────────────
  {
    source: "COD SQUAD",
    label: "Operation ready to plan",
    href: "/hq/availability?req=demo:cod",
    cta: "Review",
    tone: "alert",
    scope: "president",
  },
  {
    source: "THE BARRACKS",
    label: "New squad requested — F1 Squad, by Steve",
    href: "/hq/squads",
    cta: "Rule",
    tone: "warn",
    scope: "president",
  },
  {
    source: "THE COURT",
    label: "Case #004 awaiting your ruling",
    href: "/hq/court",
    cta: "Rule",
    tone: "alert",
    scope: "president",
  },
  {
    source: "BATTLE",
    label: "Captain confirmation required — Barracks 3–1 The Shed",
    href: "/hq/battles",
    cta: "Review",
    tone: "alert",
    scope: "president",
  },
];

/**
 * Sample rows for the HQ inbox. Empty in production — this is a design aid, so
 * it must never reach a real Barracks.
 */
export function hqSampleActions(): HqAction[] {
  if (process.env.NODE_ENV === "production") return [];
  return SAMPLES;
}

// ── This week ──────────────────────────────────────────────────────────────
// Filler so the upcoming list can be judged with more than one row. These are
// deliberately NOT linkable — the operations don't exist, and a row that leads
// to a broken page is worse than a row that plainly doesn't lead anywhere.

export type SampleWeekRow = {
  dow: string;
  day: string;
  emoji: string;
  title: string;
  time: string;
};

const WEEK: { inDays: number; emoji: string; game: string; title: string; time: string }[] = [
  { inDays: 1, emoji: "⚽", game: "fifa", title: "FIFA — Friday league night", time: "21:00" },
  { inDays: 2, emoji: "🏎️", game: "gta", title: "F1 — Silverstone GP", time: "19:30" },
  { inDays: 3, emoji: "🎮", game: "cod", title: "COD — Sunday session", time: "20:30" },
  { inDays: 4, emoji: "🎮", game: "cod", title: "COD — ranked push", time: "20:00" },
  { inDays: 5, emoji: "⛳", game: "threeball", title: "Threeball — midweek 9", time: "18:45" },
  { inDays: 6, emoji: "⚽", game: "fifa", title: "FIFA — cup replay vs The Shed", time: "21:15" },
  { inDays: 7, emoji: "🏎️", game: "gta", title: "F1 — Monza qualifying", time: "19:00" },
];

/** The soonest filler night, shaped for the HQ hero. Lets the "up next" layout
 *  be judged while every real Operation on the board is already running. Empty
 *  in production, and the hero tags it DEMO. */
export function hqSampleNextOp(): {
  iso: string;
  time: string;
  game: string;
  title: string;
  roster: { in: number; maybe: number; out: number; undecided: number; total: number };
  confirmBy: string | null;
  lapsed: number;
  pending: number;
} | null {
  if (process.env.NODE_ENV === "production") return null;
  const w = WEEK[0];
  const d = new Date();
  d.setDate(d.getDate() + w.inDays);
  const p = (v: number) => String(v).padStart(2, "0");
  return {
    iso: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: w.time,
    game: w.game,
    title: w.title,
    roster: { in: 4, maybe: 1, out: 1, undecided: 0, total: 6 },
    // Shows the confirmation window in every state at once: some still to
    // answer, one who let the deadline go.
    confirmBy: new Date(Date.now() + 9 * 3600 * 1000).toISOString(),
    lapsed: 1,
    pending: 2,
  };
}

// ── Operations register ────────────────────────────────────────────────────
// Filler for the Operations page so the Upcoming and History tables can be
// judged at length. Not linkable — these operations don't exist.

export type SampleOp = {
  date: string; // display only
  game: string; // drives the insignia
  title: string;
  squad: string | null;
  time: string;
  roster: number;
  present: number;
  duration: string;
  games: number;
  scrubbed?: boolean;
};

const UPCOMING: Omit<SampleOp, "duration" | "present">[] = [
  { date: "Fri 14 Aug", game: "fifa", title: "FIFA — Friday league night", squad: "FIFA Squad", time: "21:00", roster: 6, games: 0 },
  { date: "Sat 15 Aug", game: "f1", title: "F1 — Silverstone GP", squad: "F1 Squad", time: "19:30", roster: 8, games: 0 },
  { date: "Sun 16 Aug", game: "cod", title: "COD — Sunday session", squad: "COD Squad", time: "20:30", roster: 5, games: 0 },
  { date: "Tue 18 Aug", game: "threeball", title: "Threeball — midweek 9", squad: null, time: "18:45", roster: 3, games: 0 },
  { date: "Thu 20 Aug", game: "cod", title: "COD — ranked push", squad: "COD Squad", time: "20:00", roster: 4, games: 0 },
];

const HISTORY: SampleOp[] = [
  { date: "Sun 10 Aug", game: "cod", title: "COD — Sunday session", squad: "COD Squad", time: "20:30", roster: 6, present: 6, duration: "3h 12m", games: 9 },
  { date: "Fri 08 Aug", game: "fifa", title: "FIFA — league night", squad: "FIFA Squad", time: "21:00", roster: 6, present: 5, duration: "2h 04m", games: 7 },
  { date: "Wed 06 Aug", game: "f1", title: "F1 — Spa", squad: "F1 Squad", time: "19:30", roster: 8, present: 7, duration: "1h 48m", games: 3 },
  { date: "Sun 03 Aug", game: "cod", title: "COD — Sunday session", squad: "COD Squad", time: "20:30", roster: 6, present: 4, duration: "2h 41m", games: 8 },
  { date: "Sat 02 Aug", game: "threeball", title: "Threeball — the annual", squad: null, time: "09:00", roster: 4, present: 4, duration: "4h 20m", games: 1 },
  { date: "Thu 31 Jul", game: "fifa", title: "FIFA — cup night", squad: "FIFA Squad", time: "21:00", roster: 5, present: 2, duration: "0h 46m", games: 2 },
  { date: "Tue 29 Jul", game: "cod", title: "COD — midweek", squad: "COD Squad", time: "20:00", roster: 5, present: 0, duration: "—", games: 0, scrubbed: true },
  { date: "Sun 27 Jul", game: "cod", title: "COD — Sunday session", squad: "COD Squad", time: "20:30", roster: 7, present: 6, duration: "3h 35m", games: 11 },
];

export function hqSampleUpcoming(): SampleOp[] {
  if (process.env.NODE_ENV === "production") return [];
  return UPCOMING.map((u) => ({ ...u, present: 0, duration: "—" }));
}

export function hqSampleHistory(): SampleOp[] {
  if (process.env.NODE_ENV === "production") return [];
  return HISTORY;
}

export function hqSampleWeek(): SampleWeekRow[] {
  if (process.env.NODE_ENV === "production") return [];
  const base = new Date();
  return WEEK.map((w) => {
    const d = new Date(base);
    d.setDate(base.getDate() + w.inDays);
    return {
      dow: d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(),
      day: String(d.getDate()),
      emoji: w.emoji,
      title: w.title,
      time: w.time,
    };
  });
}
