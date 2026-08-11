"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as radar from "@/lib/data/commands/radar";

// Thin Server Action wrappers: create the request-scoped client, run the shared
// command, then revalidate. All logic lives in @/lib/data/commands/radar.

export async function addRadarGame(input: {
  title: string;
  releaseDate?: string;
  note?: string;
  youtubeUrl?: string;
  platform?: string;
}) {
  const res = await radar.addRadarGame(await createClient(), input);
  if (res.ok) revalidatePath("/radar");
  return res;
}

export async function setRadarInterest(radarId: string, interested: boolean) {
  const res = await radar.setRadarInterest(await createClient(), radarId, interested);
  if (res.ok) revalidatePath("/radar");
  return res;
}

export async function deleteRadarGame(id: string) {
  const res = await radar.deleteRadarGame(await createClient(), id);
  if (res.ok) revalidatePath("/radar");
  return res;
}
