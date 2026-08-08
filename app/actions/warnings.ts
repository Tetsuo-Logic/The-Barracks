"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  return { supabase, user, isAdmin: Boolean(data?.is_admin) };
}

export async function addWarning(
  playerId: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, error: "Only the organiser can do that." };

  const { error } = await supabase.from("warnings").insert({
    player_id: playerId,
    reason: reason?.trim() || null,
    created_by: user.id,
  });
  if (error) return { ok: false, error: "Couldn't add the warning." };

  revalidatePath("/admin");
  return { ok: true };
}

export async function removeWarning(
  warningId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user || !isAdmin) return { ok: false, error: "Only the organiser can do that." };

  const { error } = await supabase.from("warnings").delete().eq("id", warningId);
  if (error) return { ok: false, error: "Couldn't remove it." };

  revalidatePath("/admin");
  return { ok: true };
}
