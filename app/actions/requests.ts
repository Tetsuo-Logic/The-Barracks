"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToPlayers } from "@/lib/push";
import { gameById, gameIdFromName } from "@/lib/games";
import type { GameRequestStatus, Profile } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

// Add a game to the CO-editable list (service role, bypasses CO-only RLS) so a
// player can request a game that isn't in the list yet.
async function ensureGameInList(id: string, name: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data } = await admin.from("app_settings").select("games").eq("id", 1).maybeSingle();
  const raw = (data as { games?: unknown } | null)?.games;
  const games = Array.isArray(raw)
    ? (raw as { id: string; name: string; emoji: string; hasScorecard: boolean }[])
    : [];
  if (games.some((g) => g.id === id)) return;
  games.push({ id, name, emoji: "🎮", hasScorecard: false });
  await admin.from("app_settings").update({ games }).eq("id", 1);
}

// Any player floats a game they fancy. A custom name (not in the list yet) is
// auto-formatted and added to the games list. It pings the CO to organise it.
export async function requestGame(input: {
  game: string;
  note?: string;
  customName?: string;
  availableFrom?: string;
  availableTo?: string;
  minPlayers?: number;
  maxPlayers?: number;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let gameId = input.game;
  let name: string;
  const custom = input.customName?.trim();
  if (custom) {
    gameId = gameIdFromName(custom);
    if (!gameId) return { ok: false, error: "That name won't work — try letters and numbers." };
    name = custom;
    await ensureGameInList(gameId, name);
  } else {
    if (!gameId) return { ok: false, error: "Pick a game first." };
    name = gameById(gameId).name;
  }

  const note = input.note?.trim();
  const { error } = await supabase.from("game_requests").insert({
    requested_by: user.id,
    game: gameId,
    note: note || null,
    available_from: input.availableFrom || null,
    available_to: input.availableTo || null,
    min_players: input.minPlayers ?? null,
    max_players: input.maxPlayers ?? null,
  });
  if (error) return { ok: false, error: "Couldn't send the request." };

  // Ping the CO(s) — anyone with admin — that a request came in.
  const { data: me } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();
  const who = (me as { name?: string })?.name ?? "Someone";

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .neq("id", user.id);
  await sendToPlayers(
    ((admins ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "new_comp",
    {
      title: `🎮 Game request${custom ? " (new game)" : ""}`,
      body: `${who} wants ${name}${note ? ` — “${note}”` : ""}. Rally the squad?`,
      url: custom ? "/admin" : "/",
      tag: "game-request",
    },
  );

  revalidatePath("/");
  revalidatePath("/admin");
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
