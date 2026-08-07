"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import { playerScores, resultSummary } from "@/lib/scoring";
import { shortDate } from "@/lib/dates";
import type { Competition, Profile, Score } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

/** Upsert one player's strokes array. Any player may keep the card (§3). */
export async function saveScore(
  competitionId: string,
  playerId: string,
  strokes: (number | null)[],
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("scores").upsert(
    {
      competition_id: competitionId,
      player_id: playerId,
      strokes,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "competition_id,player_id" },
  );
  if (error) return { ok: false, error: "Couldn't save the scores." };

  revalidatePath(`/comp/${competitionId}`);
  revalidatePath("/");
  revalidatePath("/standings");
  return { ok: true };
}

/** Save every player's card at once, then mark the competition played. */
export async function finishCompetition(
  competitionId: string,
  cards: { playerId: string; strokes: (number | null)[] }[],
  par?: number[],
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const rows = cards.map((c) => ({
    competition_id: competitionId,
    player_id: c.playerId,
    strokes: c.strokes,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error: sErr } = await supabase
    .from("scores")
    .upsert(rows, { onConflict: "competition_id,player_id" });
  if (sErr) return { ok: false, error: "Couldn't save the scores." };

  const compUpdate: { status: string; par?: number[] } = { status: "played" };
  if (par && par.length > 0) compUpdate.par = par;
  const { error: cErr } = await supabase
    .from("competitions")
    .update(compUpdate)
    .eq("id", competitionId);
  if (cErr) return { ok: false, error: "Saved scores, but couldn't close the round." };

  // Result push to everyone in the comp (§6.4).
  const { data: comp } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", competitionId)
    .single();
  const { data: profiles } = await supabase.from("profiles").select("*");
  if (comp) {
    const c = comp as Competition;
    const scoreRows: Score[] = cards.map((card) => ({
      competition_id: competitionId,
      player_id: card.playerId,
      strokes: card.strokes,
      updated_by: user.id,
      updated_at: "",
    }));
    const summary = resultSummary(c, playerScores(c, (profiles ?? []) as Profile[], scoreRows));
    if (summary) {
      await sendToPlayers(
        cards.map((card) => card.playerId),
        "results",
        {
          title: `${summary.player.name} takes it — ${summary.detail}`,
          body: `${c.course}, ${shortDate(c.date)}`,
          url: `/comp/${competitionId}`,
          tag: `result-${competitionId}`,
        },
      );
    }
  }

  revalidatePath(`/comp/${competitionId}`);
  revalidatePath("/");
  revalidatePath("/standings");
  return { ok: true };
}
