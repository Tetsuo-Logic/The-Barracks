"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import { gameById, GAMES } from "@/lib/games";
import type { GameRequestStatus, Profile } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

// Any player floats a game they fancy. It pings the CO to organise it.
export async function requestGame(game: string, note?: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!GAMES.some((g) => g.id === game)) {
    return { ok: false, error: "Pick a game first." };
  }

  const { error } = await supabase.from("game_requests").insert({
    requested_by: user.id,
    game,
    note: note?.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn't send the request." };

  // Ping the CO(s) — anyone with admin — that a request came in.
  const { data: me } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();
  const who = (me as { name?: string })?.name ?? "Someone";
  const g = gameById(game);

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .neq("id", user.id);
  await sendToPlayers(
    ((admins ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "new_comp",
    {
      title: `${g.emoji} Game request`,
      body: `${who} wants ${g.name}${note?.trim() ? ` — “${note.trim()}”` : ""}. Rally the squad?`,
      url: "/",
      tag: "game-request",
    },
  );

  revalidatePath("/");
  return { ok: true };
}

// CO moves a request along: planning (opened a poll), done, or declined.
export async function setGameRequestStatus(
  id: string,
  status: GameRequestStatus,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_requests")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't update the request." };
  revalidatePath("/");
  return { ok: true };
}

// The filer withdraws their own request; the CO can clear any.
export async function deleteGameRequest(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("game_requests").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't remove the request." };
  revalidatePath("/");
  return { ok: true };
}
