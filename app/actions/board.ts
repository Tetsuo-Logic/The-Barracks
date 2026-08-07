"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import type { Profile } from "@/lib/types";

// Any player files a complaint to the board.
export async function fileComplaint(input: {
  reason: string;
  action?: string;
  comment?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "What's the complaint?" };

  const { error } = await supabase.from("complaints").insert({
    filed_by: user.id,
    reason,
    action: input.action?.trim() || null,
    comment: input.comment?.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn't file it." };

  // Nudge the president (and admin) that there's something to rule on.
  const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  const { data: rulers } = await supabase
    .from("profiles")
    .select("id")
    .or("is_president.eq.true,is_admin.eq.true")
    .neq("id", user.id);
  await sendToPlayers(
    ((rulers ?? []) as Pick<Profile, "id">[]).map((p) => p.id),
    "new_comp",
    {
      title: "A complaint has been filed",
      body: `${(me as { name?: string })?.name ?? "Someone"}: ${reason}`,
      url: "/board",
      tag: "board",
    },
  );

  revalidatePath("/board");
  return { ok: true };
}

// The President (or admin) rules on a complaint.
export async function ruleOnComplaint(
  complaintId: string,
  ruling: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("complaints")
    .update({
      status: "addressed",
      ruling: ruling.trim() || null,
      addressed_by: user.id,
      addressed_at: new Date().toISOString(),
    })
    .eq("id", complaintId);
  if (error) return { ok: false, error: "Couldn't rule on it. Are you the president?" };

  revalidatePath("/board");
  return { ok: true };
}

// The admin names the President (one at a time). Admin keeps all powers.
export async function setPresident(
  playerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return { ok: false, error: "Only the owner can name the president." };

  // Clear the title, then grant it.
  await supabase.from("profiles").update({ is_president: false }).neq("id", playerId);
  const { error } = await supabase.from("profiles").update({ is_president: true }).eq("id", playerId);
  if (error) return { ok: false, error: "Couldn't set the president." };

  revalidatePath("/admin");
  revalidatePath("/board");
  return { ok: true };
}
