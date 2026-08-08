"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import type { Profile } from "@/lib/types";

export async function postComment(
  competitionId: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = body.trim();
  if (!text) return { ok: false, error: "Say something first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("comments").insert({
    competition_id: competitionId,
    author_id: user.id,
    body: text,
  });
  if (error) return { ok: false, error: "Couldn't post that." };

  // Notify everyone but the author (§6.4). Name is the author's for the title.
  const { data: me } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();
  const { data: others } = await supabase
    .from("profiles")
    .select("id")
    .neq("id", user.id);
  await sendToPlayers(
    ((others ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "comments",
    {
      title: (me as { name?: string })?.name ?? "The Threeball",
      body: text.length > 80 ? text.slice(0, 79) + "…" : text,
      url: `/comp/${competitionId}`,
      tag: `chat-${competitionId}`,
    },
  );

  return { ok: true };
}

// Remove a comment. RLS allows the author or the organiser; anyone else is
// rejected by the database.
export async function deleteComment(
  commentId: string,
  competitionId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { ok: false, error: "Couldn't delete that." };

  if (competitionId) revalidatePath(`/comp/${competitionId}`);
  return { ok: true };
}
