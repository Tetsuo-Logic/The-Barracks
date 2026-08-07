"use server";

import { createClient } from "@/lib/supabase/server";
import type { NotificationPrefs } from "@/lib/types";

export async function getPrefs(): Promise<NotificationPrefs | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("notification_prefs")
    .select("*")
    .eq("player_id", user.id)
    .single();
  return (data as NotificationPrefs) ?? null;
}

export async function updatePref(
  key: keyof Omit<NotificationPrefs, "player_id">,
  value: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("notification_prefs")
    .upsert(
      { player_id: user.id, [key]: value },
      { onConflict: "player_id" },
    );
  if (error) return { ok: false, error: "Couldn't save that." };
  return { ok: true };
}
