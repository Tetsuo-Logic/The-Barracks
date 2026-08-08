"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DeletableKind = "broadcast" | "comment" | "trial" | "competition";

const TABLE: Record<DeletableKind, string> = {
  broadcast: "broadcasts",
  comment: "comments",
  trial: "trials",
  competition: "competitions",
};

// Permanently delete selected activity items. Organiser only. Deleting a round
// (competition) cascades its RSVPs, scores, comments and photos; a broadcast
// cascades its answers; a trial cascades its votes. RLS also enforces admin on
// each table, so a non-organiser is rejected by the database regardless.
export async function deleteActivity(
  items: { kind: DeletableKind; id: string }[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) return { ok: false, error: "Only the organiser can do that." };

  // Group ids per table and dedupe (a round shows as two feed rows).
  const byKind = new Map<DeletableKind, Set<string>>();
  for (const it of items) {
    if (!TABLE[it.kind]) continue;
    const set = byKind.get(it.kind) ?? new Set<string>();
    set.add(it.id);
    byKind.set(it.kind, set);
  }

  for (const [kind, ids] of byKind) {
    const { error } = await supabase.from(TABLE[kind]).delete().in("id", [...ids]);
    if (error) return { ok: false, error: "Couldn't delete some of those." };
  }

  revalidatePath("/activity");
  revalidatePath("/broadcast");
  revalidatePath("/", "layout");
  return { ok: true };
}
