"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import { confirmState } from "@/lib/rsvp";
import { compHeading } from "@/lib/games";
import { shortDate } from "@/lib/dates";
import type { Competition, Rsvp } from "@/lib/types";

// The two things a Captain or the President can do about the confirmation
// window: let somebody back on after it closed, and chase the ones still
// sitting on it.
//
// Both are deliberately human actions. The deadline is enforced by the system,
// but who gets a second chance and who gets a nudge is a judgement call — see
// the President's Action Required row rather than any automatic consequence.

type Result = { ok: true } | { ok: false; error: string };

/**
 * Put an operative back on the roster after they missed the window.
 *
 * Permission lives in the database (approve_late_rsvp is SECURITY DEFINER and
 * checks Captain-of-this-squad or Barracks command), so this wrapper stays
 * thin and can't be the thing that's wrong.
 */
export async function approveLate(competitionId: string, playerId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.rpc("approve_late_rsvp", {
    p_comp: competitionId,
    p_player: playerId,
  });
  if (error) {
    return {
      ok: false,
      error: /permitted/i.test(error.message)
        ? "Only the Captain or Command can approve a late join."
        : "Couldn't approve them back on.",
    };
  }
  if (data === false) return { ok: false, error: "That operation no longer exists." };

  const [{ data: comp }, { data: them }] = await Promise.all([
    supabase.from("competitions").select("title, course, game, date").eq("id", competitionId).single(),
    supabase.from("profiles").select("name").eq("id", playerId).single(),
  ]);
  const c = comp as Pick<Competition, "title" | "course" | "game" | "date"> | null;
  if (c) {
    await sendToPlayers([playerId], "rsvp_changes", {
      title: "You're back on the roster",
      body: `${compHeading(c)} · ${shortDate(c.date)} — approved late by command.`,
      url: `/comp/${competitionId}`,
      tag: `late-${competitionId}-${playerId}`,
    });
  }
  void them;

  revalidatePath(`/hq/operations/${competitionId}`);
  revalidatePath(`/comp/${competitionId}`);
  revalidatePath("/hq");
  return { ok: true };
}

/**
 * Chase everyone whose answer was carried over from the muster and who hasn't
 * confirmed yet. Only reaches people still inside the window — nudging someone
 * who has already lapsed is just nagging about something they can no longer fix
 * themselves.
 */
export async function nudgeUnconfirmed(competitionId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const [{ data: comp }, { data: rows }] = await Promise.all([
    supabase
      .from("competitions")
      .select("title, course, game, date, tee_time, confirm_by")
      .eq("id", competitionId)
      .single(),
    supabase
      .from("rsvps")
      .select("player_id, confirmed_at, approved_late")
      .eq("competition_id", competitionId),
  ]);
  if (!comp) return { ok: false, error: "Operation not found." };

  const c = comp as Pick<Competition, "title" | "course" | "game" | "date" | "tee_time" | "confirm_by">;
  const pending = ((rows ?? []) as Pick<Rsvp, "player_id" | "confirmed_at" | "approved_late">[])
    .filter((r) => confirmState(r, c) === "pending")
    .map((r) => r.player_id)
    .filter((id) => id !== user.id);

  if (pending.length === 0) return { ok: false, error: "Nobody left to chase." };

  const by = c.confirm_by
    ? new Date(c.confirm_by).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  await sendToPlayers(pending, "chase_undecided", {
    title: `Confirm ${compHeading(c)}`,
    body: `${shortDate(c.date)}${c.tee_time ? ` · ${c.tee_time.slice(0, 5)}` : ""}. You're down from the muster${by ? ` — confirm by ${by}` : ""}.`,
    url: `/comp/${competitionId}`,
    tag: `chase-${competitionId}`,
  });

  revalidatePath(`/hq/operations/${competitionId}`);
  return { ok: true };
}
