import type { Competition } from "@/lib/types";

// The RSVP lock: from 24h before a competition, backing out after saying "in"
// has consequences (a warning to the player, a ping to the organiser).

const LOCK_HOURS = 24;

/** The moment the lock window opens: 24h before the tee (or midday if no tee). */
export function lockAt(comp: Competition): Date {
  const [y, m, d] = comp.date.split("-").map(Number);
  const [hh, mm] = (comp.tee_time ?? "12:00:00").slice(0, 5).split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  return new Date(start.getTime() - LOCK_HOURS * 3600 * 1000);
}

/** Are we inside the lock window for an upcoming competition? */
export function isLocked(comp: Competition, now: number = Date.now()): boolean {
  if (comp.status !== "upcoming") return false;
  return now >= lockAt(comp).getTime();
}

/** A punishable back-out: was in, now isn't, inside the lock window. */
export function isFlake(
  comp: Competition,
  prevStatus: string | null | undefined,
  nextStatus: string,
): boolean {
  return prevStatus === "in" && nextStatus !== "in" && isLocked(comp);
}
