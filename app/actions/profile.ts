"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileInput = {
  name: string;
  nickname: string;
  handicap?: string;
  home_course?: string;
};

export async function saveProfile(
  input: ProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const name = input.name.trim();
  const nickname = input.nickname.trim().toUpperCase().slice(0, 4);
  if (!name) return { ok: false, error: "A name is needed." };
  if (!nickname) return { ok: false, error: "A nickname is needed." };

  const handicap =
    input.handicap && input.handicap.trim() !== ""
      ? Number(input.handicap)
      : null;
  if (handicap != null && Number.isNaN(handicap)) {
    return { ok: false, error: "Handicap must be a number." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name,
      nickname,
      handicap,
      home_course: input.home_course?.trim() || null,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Couldn't save. Try again." };

  revalidatePath("/", "layout");
  return { ok: true };
}
