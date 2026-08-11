"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Stamp "you've looked" so new comments stop counting toward the bell badge.
// Task items (unanswered questions, missing RSVPs) don't use this — they clear
// only when you actually do them.
export async function markInboxSeen(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase
    .from("profiles")
    .update({ inbox_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

// Mark the stored notification feed read once it's been shown, so those items
// stop counting toward the bell badge (mirrors markInboxSeen for the feed).
export async function markNotificationsSeen(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  revalidatePath("/", "layout");
  return { ok: true };
}

// Organiser sets (or clears) the activity-history cutoff. `before` is an ISO
// timestamp — the feed hides anything older, for everyone; null shows it all
// again. Non-destructive: nothing is deleted, just filtered from the feed.
export async function clearHistory(
  before: string | null,
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

  const { error } = await supabase
    .from("app_settings")
    .update({ activity_cleared_before: before })
    .eq("id", 1);
  if (error) return { ok: false, error: "Couldn't update that." };

  revalidatePath("/activity");
  revalidatePath("/broadcast");
  revalidatePath("/", "layout");
  return { ok: true };
}
