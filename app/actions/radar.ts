"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import type { Profile } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

// Anyone puts a game on the radar. Pings the squad to weigh in.
export async function addRadarGame(input: {
  title: string;
  releaseDate?: string;
  note?: string;
  youtubeUrl?: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Name the game." };

  const { error } = await supabase.from("radar_games").insert({
    title,
    note: input.note?.trim() || null,
    release_date: input.releaseDate || null,
    youtube_url: input.youtubeUrl?.trim() || null,
    added_by: user.id,
  });
  if (error) return { ok: false, error: "Couldn't add it to the radar." };

  const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  const who = (me as { name?: string })?.name ?? "Someone";
  const { data: others } = await supabase.from("profiles").select("id").neq("id", user.id);
  await sendToPlayers(
    ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "new_comp",
    {
      title: "🛰️ New on the radar",
      body: `${who} added ${title}. Interested?`,
      url: "/radar",
      tag: "radar",
    },
  );

  revalidatePath("/radar");
  return { ok: true };
}

// Mark yourself interested / not on a radar game.
export async function setRadarInterest(radarId: string, interested: boolean): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("radar_interest").upsert(
    {
      radar_id: radarId,
      player_id: user.id,
      interested,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "radar_id,player_id" },
  );
  if (error) return { ok: false, error: "Couldn't save that." };

  revalidatePath("/radar");
  return { ok: true };
}

// The adder (or CO) clears a game off the radar.
export async function deleteRadarGame(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("radar_games").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't remove it." };
  revalidatePath("/radar");
  return { ok: true };
}
