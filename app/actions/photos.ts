"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function recordPhoto(input: {
  competitionId: string;
  storagePath: string;
  width: number;
  height: number;
  caption?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("photos").insert({
    competition_id: input.competitionId,
    uploader_id: user.id,
    storage_path: input.storagePath,
    width: input.width,
    height: input.height,
    caption: input.caption?.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn't save the photo." };

  revalidatePath(`/comp/${input.competitionId}`);
  return { ok: true };
}
