"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as results from "@/lib/data/commands/results";

// Thin Server Action wrapper around @/lib/data/commands/results.
export async function recordResults(input: { competitionId: string; order: string[] }) {
  const res = await results.recordResults(await createClient(), input);
  if (res.ok) {
    revalidatePath(`/comp/${input.competitionId}`);
    revalidatePath("/standings");
  }
  return res;
}
