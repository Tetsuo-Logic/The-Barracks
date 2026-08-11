"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as requests from "@/lib/data/commands/requests";
import type { GameRequestStatus } from "@/lib/domain";

// Thin Server Action wrappers around @/lib/data/commands/requests.

export async function requestGame(input: {
  game: string;
  note?: string;
  customName?: string;
  availableFrom?: string;
  availableTo?: string;
  minPlayers?: number;
  maxPlayers?: number;
}) {
  const res = await requests.requestGame(await createClient(), input);
  if (res.ok) {
    revalidatePath("/");
    revalidatePath("/admin");
  }
  return res;
}

export async function setGameRequestStatus(id: string, status: GameRequestStatus) {
  const res = await requests.setGameRequestStatus(await createClient(), id, status);
  if (res.ok) revalidatePath("/");
  return res;
}

export async function deleteGameRequest(id: string) {
  const res = await requests.deleteGameRequest(await createClient(), id);
  if (res.ok) revalidatePath("/");
  return res;
}
