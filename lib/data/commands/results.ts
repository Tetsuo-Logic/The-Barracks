import type { Db, Result } from "./types";

// Record the finishing order for an event → results rows (placement 1..N).
// Results only ever attach to a real competition, so official rankings can only
// come from recognised Barracks fixtures. Replaces any existing result for the
// event so re-recording is clean.
export async function recordResults(
  db: Db,
  input: { competitionId: string; order: string[] }, // playerIds, winner first
): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!input.order.length) return { ok: false, error: "Tap who played, in order." };

  const { error: delErr } = await db
    .from("results")
    .delete()
    .eq("competition_id", input.competitionId);
  if (delErr) return { ok: false, error: "Couldn't save the result." };

  const now = new Date().toISOString();
  const rows = input.order.map((playerId, i) => ({
    competition_id: input.competitionId,
    player_id: playerId,
    placement: i + 1,
    confirmed: true,
    recorded_by: user.id,
    updated_at: now,
  }));
  const { error } = await db.from("results").insert(rows);
  if (error) return { ok: false, error: "Couldn't save the result." };

  // A logged result means it was played — best-effort mark it (RLS lets the
  // admin through; a plain member's update simply affects no rows, no error).
  await db
    .from("competitions")
    .update({ status: "played" })
    .eq("id", input.competitionId)
    .eq("status", "upcoming");

  return { ok: true };
}
