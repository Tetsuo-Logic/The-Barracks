"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import type { BroadcastKind, Profile } from "@/lib/types";

type Result = { ok: true; id: string } | { ok: false; error: string };

// Organiser fires an ad-hoc message to the group, optionally a yes/no or an
// open question. Pushes to everyone but the sender.
export async function createBroadcast(input: {
  kind: BroadcastKind;
  title?: string;
  body: string;
  optionDates?: string[];
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin, name")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) return { ok: false, error: "Only the organiser can do that." };

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write a message first." };

  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      created_by: user.id,
      kind: input.kind,
      title: input.title?.trim() || null,
      body,
      option_dates:
        input.kind === "dates" && input.optionDates?.length
          ? input.optionDates
          : null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't send it." };

  // Push to everyone but the sender.
  const { data: others } = await supabase
    .from("profiles")
    .select("id")
    .neq("id", user.id);
  const prompt =
    input.kind === "yesno" ? "Tap to answer" : input.kind === "ask" ? "Tap to reply" : "";
  await sendToPlayers(
    ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "new_comp",
    {
      title: input.title?.trim() || (me as { name?: string }).name || "The Threeball",
      body: prompt ? `${body} — ${prompt}` : body,
      url: `/broadcast/${data.id}`,
      tag: `broadcast-${data.id}`,
    },
  );

  revalidatePath("/broadcast");
  return { ok: true, id: data.id as string };
}

export async function respondBroadcast(
  broadcastId: string,
  answer: "yes" | "no" | null,
  comment?: string,
  availableDates?: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("broadcast_responses").upsert(
    {
      broadcast_id: broadcastId,
      player_id: user.id,
      answer,
      comment: comment?.trim() || null,
      available_dates: availableDates ?? null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "broadcast_id,player_id" },
  );
  if (error) return { ok: false, error: "Couldn't save your answer." };

  revalidatePath(`/broadcast/${broadcastId}`);
  revalidatePath("/broadcast");
  return { ok: true };
}
