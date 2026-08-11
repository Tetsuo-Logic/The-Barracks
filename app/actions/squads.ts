"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as squads from "@/lib/data/commands/squads";

// Thin Server Action wrappers around @/lib/data/commands/squads.
const rev = () => revalidatePath("/squads");

export async function createSquad(game: string, name?: string) {
  const res = await squads.createSquad(await createClient(), game, name);
  if (res.ok) rev();
  return res;
}

export async function deleteSquad(squadId: string) {
  const res = await squads.deleteSquad(await createClient(), squadId);
  if (res.ok) rev();
  return res;
}

export async function joinSquad(squadId: string) {
  const res = await squads.joinSquad(await createClient(), squadId);
  if (res.ok) rev();
  return res;
}

export async function leaveSquad(squadId: string) {
  const res = await squads.leaveSquad(await createClient(), squadId);
  if (res.ok) rev();
  return res;
}

export async function removeMember(squadId: string, userId: string) {
  const res = await squads.removeMember(await createClient(), squadId, userId);
  if (res.ok) rev();
  return res;
}

export async function setCaptain(squadId: string, userId: string) {
  const res = await squads.setCaptain(await createClient(), squadId, userId);
  if (res.ok) rev();
  return res;
}
