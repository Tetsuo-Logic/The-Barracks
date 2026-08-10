"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GAMES, gameIdFromName } from "@/lib/games";

type Result = { ok: true } | { ok: false; error: string };

type StoredGame = { id: string; name: string; emoji: string; hasScorecard: boolean };

async function loadGames(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<StoredGame[]> {
  const { data } = await supabase
    .from("app_settings")
    .select("games")
    .eq("id", 1)
    .maybeSingle();
  const raw = (data as { games?: unknown } | null)?.games;
  if (Array.isArray(raw) && raw.length > 0) return raw as StoredGame[];
  // Seed from the static list if the column is empty.
  return GAMES.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    hasScorecard: g.hasScorecard,
  }));
}

async function saveGames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  games: StoredGame[],
): Promise<boolean> {
  const { error } = await supabase.from("app_settings").update({ games }).eq("id", 1);
  return !error;
}

// The CO adds a game to the list. Name is trimmed; id is slugged from it.
export async function addGame(name: string, emoji?: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return { ok: false, error: "Only the CO can do that." };

  const clean = name.trim();
  if (!clean) return { ok: false, error: "Name the game." };
  const id = gameIdFromName(clean);
  if (!id) return { ok: false, error: "That name won't work — try letters and numbers." };

  const games = await loadGames(supabase);
  if (games.some((g) => g.id === id)) return { ok: false, error: "That game's already in the list." };

  games.push({ id, name: clean, emoji: emoji?.trim() || "🎮", hasScorecard: false });
  if (!(await saveGames(supabase, games))) return { ok: false, error: "Couldn't add it." };

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

// The CO removes a game from the list. Existing games already played keep their
// label (rendered from the id), this just takes it out of the pickers.
export async function deleteGame(id: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return { ok: false, error: "Only the CO can do that." };

  const games = (await loadGames(supabase)).filter((g) => g.id !== id);
  if (!(await saveGames(supabase, games))) return { ok: false, error: "Couldn't remove it." };

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}
