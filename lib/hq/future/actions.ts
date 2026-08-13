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
    href: "/hq/availability",
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
    source: "COD SQUAD",
    label: "Muster running — 4/7 answered, closes tomorrow",
    href: "/hq/availability",
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
    label: "Night proposed — approve to deploy",
    href: "/hq/operations",
    cta: "Approve",
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

const WEEK: { inDays: number; emoji: string; title: string; time: string }[] = [
  { inDays: 1, emoji: "⚽", title: "FIFA — Friday league night", time: "21:00" },
  { inDays: 2, emoji: "🏎️", title: "F1 — Silverstone GP", time: "19:30" },
  { inDays: 3, emoji: "🎮", title: "COD — Sunday session", time: "20:30" },
  { inDays: 5, emoji: "⛳", title: "Threeball — midweek 9", time: "18:45" },
];

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
