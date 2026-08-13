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
  /** Poll choices. Requires migration 0043_comms_polls. */
  options?: string[];
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
      options: input.kind === "poll" && input.options?.length ? input.options : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    // The poll columns arrive with migration 0043; say so rather than blaming
    // the message, which is what a bare "couldn't send it" implies.
    const missing = /column .*options/i.test(error?.message ?? "");
    return {
      ok: false,
      error: missing ? "Polls need migration 0043_comms_polls running first." : "Couldn't send it.",
    };
  }

  // Push to everyone but the sender.
  const { data: others } = await supabase
    .from("profiles")
    .select("id")
    .neq("id", user.id);
  const prompt =
    input.kind === "yesno"
      ? "Tap to answer"
      : input.kind === "ask"
        ? "Tap to reply"
        : input.kind === "poll"
          ? "Tap to vote"
          : "";
  await sendToPlayers(
    ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "new_comp",
    {
      title: input.title?.trim() || (me as { name?: string }).name || "The Barracks",
      body: prompt ? `${body} — ${prompt}` : body,
      url: `/broadcast/${data.id}`,
      tag: `broadcast-${data.id}`,
    },
  );

  revalidatePath("/broadcast");
  revalidatePath("/hq/comms");
  return { ok: true, id: data.id as string };
}

// Add a message to a ping's reply thread (append-only). Pings the others.
export async function postBroadcastMessage(
  broadcastId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const text = body.trim();
  if (!text) return { ok: false, error: "Say something first." };

  const { error } = await supabase
    .from("broadcast_messages")
    .insert({ broadcast_id: broadcastId, author_id: user.id, body: text });
  if (error) return { ok: false, error: "Couldn't send it." };

  // Tell everyone but the sender.
  const [{ data: me }, { data: b }, { data: others }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).single(),
    supabase.from("broadcasts").select("title, body").eq("id", broadcastId).single(),
    supabase.from("profiles").select("id").neq("id", user.id),
  ]);
  const who = (me as { name?: string })?.name ?? "Someone";
  const bx = b as { title: string | null; body: string } | null;
  await sendToPlayers(
    ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "comments",
    {
      title: `${who} replied`,
      body: `“${bx?.title || bx?.body || "a message"}” — ${text}`,
      url: `/broadcast/${broadcastId}`,
      tag: `bmsg-${broadcastId}`,
    },
  );

  revalidatePath(`/broadcast/${broadcastId}`);
  revalidatePath("/hq/comms");
  return { ok: true };
}

export async function respondBroadcast(
  broadcastId: string,
  answer: "yes" | "no" | null,
  comment?: string,
  availableDates?: string[],
  dateTimes?: string[],
  choice?: string | null,
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
      date_times: dateTimes ?? null,
      choice: choice ?? null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "broadcast_id,player_id" },
  );
  if (error) return { ok: false, error: "Couldn't save your answer." };

  // Ping whoever asked (the organiser) that an answer came in.
  const { data: b } = await supabase
    .from("broadcasts")
    .select("created_by, title, body, kind")
    .eq("id", broadcastId)
    .single();
  const bx = b as { created_by: string | null; title: string | null; body: string; kind: string } | null;
  if (bx?.created_by && bx.created_by !== user.id) {
    const { data: me } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();
    const who = (me as { name?: string })?.name ?? "Someone";
    const verb = answer
      ? `said ${answer}`
      : bx.kind === "dates"
        ? "picked their dates"
        : bx.kind === "poll"
          ? "voted"
          : "replied";
    await sendToPlayers([bx.created_by], "rsvp_changes", {
      title: `${who} ${verb}`,
      body: `“${bx.title || bx.body}”`,
      url: `/broadcast/${broadcastId}`,
      tag: `answer-${broadcastId}-${user.id}`,
    });
  }

  revalidatePath(`/broadcast/${broadcastId}`);
  revalidatePath("/broadcast");
  revalidatePath("/hq/comms");
  return { ok: true };
}
