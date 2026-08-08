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
