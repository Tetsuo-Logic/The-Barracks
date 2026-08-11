import type { Db, Result } from "./types";

// Operation Room commands. Start/close update the event directly (competitions
// update is CO-only via RLS). The games counter + roll call go through the
// SECURITY DEFINER functions so a plain participant can advance the count and
// the CO can mark others present.

export async function startOperation(db: Db, eventId: string): Promise<Result> {
  const { error } = await db
    .from("competitions")
    .update({ started_at: new Date().toISOString() })
    .eq("id", eventId)
    .is("started_at", null);
  if (error) return { ok: false, error: "Couldn't start the operation." };
  return { ok: true };
}

// Close & archive. The CO can correct the final games count here (in case
// people forgot to tap "new game" during the night).
export async function closeOperation(db: Db, eventId: string, gamesCount: number): Promise<Result> {
  const { error } = await db
    .from("competitions")
    .update({
      finished_at: new Date().toISOString(),
      games_count: Math.max(0, Math.round(gamesCount)),
      status: "played",
    })
    .eq("id", eventId);
  if (error) return { ok: false, error: "Couldn't close the operation." };
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
