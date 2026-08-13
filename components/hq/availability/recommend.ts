// Deployment recommendation — pure functions over a squad's availability and
// the Barracks calendar as it stands *right now*.
//
// The whole point of Command Planning is that requests never wait for each
// other. Each one is scored against the calendar at the moment the President
// looks at it, so an Operation deployed at 09:00 is already accounted for when
// the next request is reviewed at 13:00. That's why the calendar arrives as an
// argument rather than being captured anywhere: same request, later calendar,
// different answer — correctly.
//
// Nothing here writes, fetches or renders. Availability comes from ./model,
// the calendar from lib/hq/planning.

import { toMin, toHHMM, type SquadIntel } from "./model";

/** Something already on the calendar that could collide with a candidate slot. */
export type CalendarEntry = {
  id: string;
  title: string;
  emoji: string;
  iso: string;
  from: string; // 'HH:MM'
  to: string; // 'HH:MM'
  squadId: string | null;
  /** Operatives expected there — RSVP'd in, or the squad it belongs to. */
  committed: string[];
};

/** One line of the WHY THIS TIME evidence. Every check states a fact we can
 *  actually stand behind; there are no decorative ticks. */
export type Check = { ok: boolean; label: string; detail?: string };

export type Clash = {
  title: string;
  emoji: string;
  time: string;
  /** Names of this squad's operatives already committed to it. */
  people: string[];
};

export type Option = {
  key: string;
  iso: string;
  dow: string;
  day: string;
  mon: string;
  from: string; // kick-off
  to: string; // end of the sustained window
  count: number; // operatives free for the *whole* window
  total: number;
  required: number;
  meets: boolean;
  coverage: number; // 0..100 of squad strength
  clashes: Clash[];
  conflicted: number; // distinct operatives double-booked
  score: number;
  headline: string;
  checks: Check[];
};

const overlaps = (aFrom: string, aTo: string, bFrom: string, bTo: string) =>
  toMin(aFrom) < toMin(bTo) && toMin(bFrom) < toMin(aTo);

/**
 * Rank every deployable slot across the squad's candidate nights.
 *
 * Candidates are the maximal runs of hours at a given headcount — the windows
 * where the squad can actually play together, not every hour tick. Each is
 * scored on strength first, then on what it costs the rest of the Barracks.
 */
export function rankOptions(intel: SquadIntel, calendar: CalendarEntry[], limit = 6): Option[] {
  const options: Option[] = [];
  const nameById = new Map(intel.members.map((m) => [m.id, m.short || m.name]));

  intel.nights.forEach((night, dayIdx) => {
    const slots = night.slots;

    for (let i = 0; i < slots.length; i++) {
      const level = slots[i].count;
      if (level === 0) continue;
      // Only start a candidate where this headcount actually becomes available;
      // otherwise every hour of a long run spawns a near-identical option.
      if (i > 0 && slots[i - 1].count >= level) continue;

      let j = i;
      while (j + 1 < slots.length && slots[j + 1].count >= level) j++;
      const from = slots[i].slot;
      const to = toHHMM(toMin(slots[j].slot) + 60);

      // Who can hold the *whole* window — the honest number to deploy against,
      // rather than the headcount at the opening hour.
      const present = intel.members
        .filter((m) => {
          const c = intel.cells[m.id]?.[night.iso];
          return (
            c?.state === "on" &&
            c.from != null &&
            c.to != null &&
            toMin(c.from) <= toMin(from) &&
            toMin(c.to) >= toMin(to)
          );
        })
        .map((m) => m.id);

      const count = present.length;
      if (count === 0) continue;

      const clashes: Clash[] = [];
      const conflictedIds = new Set<string>();
      for (const e of calendar) {
        if (e.iso !== night.iso) continue;
        if (!overlaps(e.from, e.to, from, to)) continue;
        const people = present.filter((id) => e.committed.includes(id));
        people.forEach((id) => conflictedIds.add(id));
        clashes.push({
          title: e.title,
          emoji: e.emoji,
          time: `${e.from}–${e.to}`,
          people: people.map((id) => nameById.get(id) ?? "Operative"),
        });
      }

      const meets = count >= intel.required;
      const coverage = intel.total ? Math.round((count / intel.total) * 100) : 0;
      const conflicted = conflictedIds.size;

      // Strength is worth more than anything else; taking operatives off an
      // Operation that already exists is the most expensive thing we can do.
      const score =
        count * 1000 +
        (meets ? 600 : 0) -
        conflicted * 450 -
        (clashes.length ? 200 : 0) -
        dayIdx * 8 -
        i;

      const headline = !meets
        ? "Best available — short of strength"
        : conflicted > 0
          ? "Strength met, but it costs another Operation"
          : clashes.length > 0
            ? "Strength met — shares the night, no shared people"
            : "Clear run — best coverage";

      const checks: Check[] = [
        {
          ok: count > 0,
          label: `${count} of ${intel.total} available`,
          detail: `for the whole ${from}–${to} window`,
        },
        {
          ok: meets,
          label: meets
            ? "Required squad strength achieved"
            : `${intel.required - count} short of required strength`,
          detail: `${intel.required} needed`,
        },
        {
          ok: conflicted === 0,
          label: conflicted === 0 ? "No personnel conflicts" : `${conflicted} operative${conflicted === 1 ? "" : "s"} double-booked`,
          detail:
            conflicted === 0
              ? undefined
              : clashes
                  .filter((c) => c.people.length)
                  .map((c) => `${c.people.join(", ")} → ${c.title}`)
                  .join(" · "),
        },
        {
          ok: clashes.length === 0,
          label: clashes.length === 0 ? "No conflicting operation" : `${clashes.length} operation${clashes.length === 1 ? "" : "s"} the same night`,
          detail: clashes.length === 0 ? undefined : clashes.map((c) => `${c.title} ${c.time}`).join(" · "),
        },
        {
          ok: true,
          label: `${coverage}% coverage inside the requested window`,
          detail: `squad asked for ${intel.windowFrom}–${intel.windowTo}`,
        },
      ];

      options.push({
        key: `${night.iso}-${from}`,
        iso: night.iso,
        dow: night.dow,
        day: night.day,
        mon: night.mon,
        from,
        to,
        count,
        total: intel.total,
        required: intel.required,
        meets,
        coverage,
        clashes,
        conflicted,
        score,
        headline,
        checks,
      });
    }
  });

  options.sort((a, b) => b.score - a.score || (a.iso < b.iso ? -1 : 1));

  // Two windows from any one night is plenty — beyond that the alternatives
  // stop being alternatives and start being the same night sliced thinner.
  const perNight = new Map<string, number>();
  const out: Option[] = [];
  for (const o of options) {
    const n = perNight.get(o.iso) ?? 0;
    if (n >= 2) continue;
    perNight.set(o.iso, n + 1);
    out.push(o);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Did the calendar move the answer? Returns the slot that would have won on
 * raw headcount alone, when the calendar pushed something else above it.
 *
 * This is the difference between "Barracks picked Thursday" and "Barracks
 * picked Thursday *because* Friday would have cost you two people" — the
 * second is the one worth showing the President.
 */
export function bumpedBy(options: Option[]): { was: Option; now: Option; why: string } | null {
  if (options.length < 2) return null;
  const now = options[0];
  const strongest = [...options].sort(
    (a, b) => b.count - a.count || (a.iso < b.iso ? -1 : 1),
  )[0];
  if (strongest.key === now.key) return null;
  if (strongest.count <= now.count) return null;
  if (strongest.conflicted === 0 && strongest.clashes.length === 0) return null;

  const why = strongest.conflicted
    ? `${strongest.conflicted} operative${strongest.conflicted === 1 ? " is" : "s are"} already committed to ${strongest.clashes.map((c) => c.title).join(", ")}`
    : `${strongest.clashes.map((c) => c.title).join(", ")} already holds that window`;

  return { was: strongest, now, why };
}
