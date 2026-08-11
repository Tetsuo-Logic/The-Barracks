"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as ops from "@/lib/data/commands/operations";

// Thin Server Action wrappers around @/lib/data/commands/operations.
// Realtime handles live updates for other participants; revalidate refreshes
// the caller.

export async function startOperation(eventId: string) {
  const res = await ops.startOperation(await createClient(), eventId);
  if (res.ok) revalidatePath(`/comp/${eventId}`);
  return res;
}

export async function endOperation(eventId: string) {
  const res = await ops.endOperation(await createClient(), eventId);
  if (res.ok) {
    revalidatePath(`/comp/${eventId}`);
    revalidatePath("/");
  }
  return res;
}

export async function advanceGames(eventId: string, expected: number) {
  const res = await ops.advanceGames(await createClient(), eventId, expected);
  if (res.ok) revalidatePath(`/comp/${eventId}`);
  return res;
}

export async function setAttendance(eventId: string, playerId: string, present: boolean) {
  const res = await ops.setAttendance(await createClient(), eventId, playerId, present);
  if (res.ok) revalidatePath(`/comp/${eventId}`);
  return res;
}
