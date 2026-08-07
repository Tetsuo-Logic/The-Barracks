"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import { heroDate, formatLabel } from "@/lib/dates";
import type { CompetitionFormat, Profile } from "@/lib/types";

export type CompetitionInput = {
  id?: string;
  course: string;
  title?: string;
  date: string; // 'YYYY-MM-DD'
  tee_time?: string; // 'HH:MM'
  holes: 9 | 18;
  format: CompetitionFormat;
  stake?: string;
  notes?: string;
  par?: number[];
  stroke_index?: number[];
  for_cup?: boolean;
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
  if (!isAdmin) return { ok: false, error: "Only the organiser can do that." };

  const course = input.course.trim();
  if (!course) return { ok: false, error: "A course is needed." };
  if (!input.date) return { ok: false, error: "A date is needed." };

  // Par defaults to all 4s — nobody enters 18 numbers before playing (§5).
  const par =
    input.par && input.par.length === input.holes
      ? input.par
      : Array<number>(input.holes).fill(4);

  const row = {
    course,
    title: input.title?.trim() || null,
    date: input.date,
    tee_time: input.tee_time || null,
    holes: input.holes,
    format: input.format,
    stake: input.stake?.trim() || null,
    notes: input.notes?.trim() || null,
    par,
    stroke_index:
      input.stroke_index && input.stroke_index.length === input.holes
        ? input.stroke_index
        : null,
    for_cup: input.for_cup ?? true,
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

  // Tell everyone but the creator (§6.4).
  const { data: others } = await supabase
    .from("profiles")
    .select("id")
    .neq("id", user.id);
  const { day, mon } = heroDate(row.date);
  await sendToPlayers(
    ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "new_comp",
    {
      title: `New date: ${day} ${mon}`,
      body: `${course}, ${row.holes} holes, ${formatLabel(row.format).toLowerCase()}. Are you in?`,
      url: `/comp/${data.id}`,
      tag: `comp-${data.id}`,
    },
  );

  revalidatePath("/");
  revalidatePath("/calendar");
  return { ok: true, id: data.id as string };
}

export async function cancelCompetition(id: string): Promise<Result> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!isAdmin) return { ok: false, error: "Only the organiser can do that." };

  const { error } = await supabase
    .from("competitions")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't cancel it." };

  revalidatePath("/");
  revalidatePath("/calendar");
  return { ok: true, id };
}
