"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import { heroDate, shortTime } from "@/lib/dates";
import { gameById, gameHasScorecard, compHeading, DEFAULT_GAME } from "@/lib/games";
import type { Competition, CompetitionFormat, Profile } from "@/lib/types";

export type CompetitionInput = {
  id?: string;
  game?: string; // a game id from lib/games.ts; defaults to golf
  course?: string;
  title?: string;
  image_url?: string | null;
  date: string; // 'YYYY-MM-DD'
  tee_time?: string; // 'HH:MM'
  holes: 9 | 18;
  format: CompetitionFormat;
  stake?: string;
  notes?: string;
  par?: number[];
  stroke_index?: number[];
  for_cup?: boolean;
  squad_id?: string | null; // Sq-3: scope the op to a squad (null = whole Barracks)
};

type Result = { ok: true; id: string } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return { supabase, user, isAdmin: Boolean(data?.is_admin) };
}

export async function saveCompetition(
  input: CompetitionInput,
): Promise<Result> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!isAdmin) return { ok: false, error: "Only the CO can do that." };

  // Sq-3: a squad op inherits the squad's game (a squad *is* one game).
  const squadId = input.squad_id?.trim() || null;
  let squadGame: string | null = null;
  if (squadId) {
    const { data: sq } = await supabase
      .from("squads")
      .select("game")
      .eq("id", squadId)
      .maybeSingle();
    if (!sq) return { ok: false, error: "That squad doesn't exist." };
    squadGame = (sq as { game: string }).game;
  }

  const game = squadGame ?? gameById(input.game).id ?? DEFAULT_GAME;
  const isGolf = gameHasScorecard(game);

  const course = input.course?.trim() || null;
  if (!input.date) return { ok: false, error: "A date is needed." };

  // Par defaults to all 4s — nobody enters 18 numbers before playing (§5).
  const par =
    input.par && input.par.length === input.holes
      ? input.par
      : Array<number>(input.holes).fill(4);

  const row = {
    game,
    // Non-golf ops have no course; a custom title/name stands in for it.
    course: isGolf ? course : null,
    title: input.title?.trim() || null,
    image_url: input.image_url?.trim() || null,
    date: input.date,
    tee_time: input.tee_time || null,
    holes: input.holes,
    format: input.format,
    stake: input.stake?.trim() || null,
    notes: input.notes?.trim() || null,
    par,
    stroke_index:
      isGolf && input.stroke_index && input.stroke_index.length === input.holes
        ? input.stroke_index
        : null,
    // Only golf ops can count for the cup.
    for_cup: isGolf ? (input.for_cup ?? true) : false,
    squad_id: squadId,
  };

  if (input.id) {
    const { error } = await supabase
      .from("competitions")
      .update(row)
      .eq("id", input.id);
    if (error) return { ok: false, error: "Couldn't save the changes." };
    revalidatePath("/");
    revalidatePath("/calendar");
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("competitions")
    .insert({ ...row, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't add the date." };

  // Tell the roster but the creator (§6.4). A squad op only pings its squad;
  // a whole-Barracks op pings everyone.
  let recipients: string[];
  if (squadId) {
    const { data: members } = await supabase
      .from("squad_members")
      .select("user_id")
      .eq("squad_id", squadId);
    recipients = ((members ?? []) as { user_id: string }[])
      .map((m) => m.user_id)
      .filter((id) => id !== user.id);
  } else {
    const { data: others } = await supabase
      .from("profiles")
      .select("id")
      .neq("id", user.id);
    recipients = ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id);
  }
  const { day, mon } = heroDate(row.date);
  const g = gameById(game);
  const tee = shortTime(row.tee_time);
  const body = isGolf
    ? `${course}, ${row.holes} holes${tee ? ` · ${tee}` : ""}. Roll call?`
    : `${row.title || g.name} · ${day} ${mon}${tee ? ` · ${tee}` : ""}. Roll call?`;
  await sendToPlayers(
    recipients,
    "new_comp",
    {
      title: `${g.emoji} New game: ${g.name}`,
      body,
      url: `/comp/${data.id}`,
      tag: `comp-${data.id}`,
    },
  );

  revalidatePath("/");
  revalidatePath("/calendar");
  return { ok: true, id: data.id as string };
}

// Call a fixture off (keep the record). Stores the reason and tells the squad.
export async function cancelCompetition(id: string, reason: string): Promise<Result> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!isAdmin) return { ok: false, error: "Only the CO can do that." };

  const { data: comp } = await supabase.from("competitions").select("*").eq("id", id).single();
  const trimmed = reason.trim();
  const { error } = await supabase
    .from("competitions")
    .update({ status: "cancelled", cancel_reason: trimmed || null })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't cancel it." };

  const c = comp as Competition | null;
  const { data: others } = await supabase.from("profiles").select("id").neq("id", user.id);
  await sendToPlayers(
    ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "new_comp",
    {
      title: `❌ Cancelled: ${c ? compHeading(c) : "a game"}`,
      body: trimmed ? `"${trimmed}"` : "Called off.",
      url: `/comp/${id}`,
      tag: `cancel-${id}`,
    },
  );

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/comp/${id}`);
  return { ok: true, id };
}

export async function deleteCompetition(id: string): Promise<Result> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!isAdmin) return { ok: false, error: "Only the CO can do that." };

  // Hard delete — the row and its RSVPs/scores/comments/photos (on delete
  // cascade) go with it.
  const { error } = await supabase.from("competitions").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it." };

  revalidatePath("/");
  revalidatePath("/calendar");
  return { ok: true, id };
}
