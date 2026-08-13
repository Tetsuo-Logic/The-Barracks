import type { Competition, Rsvp } from "@/lib/types";

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

/**
 * Closed for good — the operation has been started, finished/archived, or
 * scrubbed. Once the CO opens or closes the room, RSVP is locked: no more
 * flip-flopping your answer after the fact.
 */
export function isClosed(comp: Pick<Competition, "status" | "started_at">): boolean {
  return comp.status !== "upcoming" || comp.started_at != null;
}

/** A punishable back-out: was in, now isn't, inside the lock window. */
export function isFlake(
  comp: Competition,
  prevStatus: string | null | undefined,
  nextStatus: string,
): boolean {
  return prevStatus === "in" && nextStatus !== "in" && isLocked(comp);
}


// ── The confirmation window ────────────────────────────────────────────────
// Offering a night at muster is not the same as turning up. When the President
// deploys, everyone carried across from that muster gets 24 hours to confirm.
// Miss it and you come off the roster; a Captain or the President can put you
// back on.
//
// Lapsing is derived, never stored: it's a comparison between confirm_by and
// confirmed_at, so there's no scheduled job and no window where the database
// disagrees with the clock.

/** Hours from deployment to confirm. Clamped to kick-off — a night deployed
 *  three hours before it starts can't offer a day to answer. */
export const CONFIRM_HOURS = 24;

export function confirmDeadline(comp: Competition, deployedAt: Date = new Date()): Date {
  const [y, m, d] = comp.date.split("-").map(Number);
  const [hh, mm] = (comp.tee_time ?? "20:00:00").slice(0, 5).split(":").map(Number);
  const kickoff = new Date(y, m - 1, d, hh, mm);
  const full = new Date(deployedAt.getTime() + CONFIRM_HOURS * 3600 * 1000);
  return full < kickoff ? full : kickoff;
}

export type ConfirmState =
  /** They answered themselves, or command let them back on. */
  | "confirmed"
  /** Carried from the muster, clock still running. */
  | "pending"
  /** Carried from the muster, deadline gone. Off the roster. */
  | "lapsed";

export function confirmState(
  rsvp: Pick<Rsvp, "confirmed_at" | "approved_late">,
  comp: Pick<Competition, "confirm_by">,
  now: number = Date.now(),
): ConfirmState {
  if (rsvp.confirmed_at != null || rsvp.approved_late) return "confirmed";
  if (!comp.confirm_by) return "confirmed"; // deployed before the window existed
  return now >= new Date(comp.confirm_by).getTime() ? "lapsed" : "pending";
}

/** Does this answer still count toward the roster? A lapsed one doesn't —
 *  that's the whole point of the deadline. */
export function countsToward(
  rsvp: Pick<Rsvp, "confirmed_at" | "approved_late">,
  comp: Pick<Competition, "confirm_by">,
  now: number = Date.now(),
): boolean {
  return confirmState(rsvp, comp, now) !== "lapsed";
}
