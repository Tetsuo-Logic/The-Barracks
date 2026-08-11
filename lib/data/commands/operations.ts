import type { Db, Result } from "./types";

// Operation Room commands. Start/close/roll-call go through SECURITY DEFINER
// functions gated on can_command (CO, the squad's Captain, or the event's acting
// Captain) — competitions update is group-admin-only via RLS, so a Captain would
// otherwise be denied. The games counter is open to any participant.

export async function startOperation(db: Db, eventId: string): Promise<Result> {
  const { error } = await db.rpc("start_operation", { p_event: eventId });
  if (error) return { ok: false, error: "Couldn't start the operation. Are you the CO or Captain?" };
  return { ok: true };
}

// Close & archive. The CO/Captain can correct the final games count here (in
// case people forgot to tap "new game" during the night).
export async function closeOperation(db: Db, eventId: string, gamesCount: number): Promise<Result> {
  const { error } = await db.rpc("close_operation", {
    p_event: eventId,
    p_games: Math.max(0, Math.round(gamesCount)),
  });
  if (error) return { ok: false, error: "Couldn't close the operation. Are you the CO or Captain?" };
  return { ok: true };
}

// The real Captain / CO names (or clears) a stand-in Captain for this one event.
export async function setActingCaptain(
  db: Db,
  eventId: string,
  playerId: string | null,
): Promise<Result> {
  const { error } = await db.rpc("set_acting_captain", { p_event: eventId, p_player: playerId });
  if (error) return { ok: false, error: "Couldn't name the acting Captain." };
  return { ok: true };
}

// Advance the live games count — compare-and-set on the expected value, so
// simultaneous taps collapse to one increment.
export async function advanceGames(
  db: Db,
  eventId: string,
  expected: number,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { data, error } = await db.rpc("advance_games", { p_event: eventId, p_expected: expected });
  if (error) return { ok: false, error: "Couldn't log the game." };
  return { ok: true, count: (data as number) ?? expected };
}

// CO marks a player present / no-show (roll call).
export async function setAttendance(
  db: Db,
  eventId: string,
  playerId: string,
  present: boolean,
): Promise<Result> {
  const { error } = await db.rpc("set_attendance", {
    p_event: eventId,
    p_player: playerId,
    p_present: present,
  });
  if (error) return { ok: false, error: "Couldn't update roll call. Are you the CO?" };
  return { ok: true };
}
