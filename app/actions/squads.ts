"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as squads from "@/lib/data/commands/squads";

// Thin Server Action wrappers around @/lib/data/commands/squads.
const rev = () => revalidatePath("/squads");

export async function createSquad(game: string, name?: string, clanTag?: string) {
  const res = await squads.createSquad(await createClient(), game, name, clanTag);
  if (res.ok) rev();
  return res;
}

export async function formSquad(input: {
  game: string;
  name?: string;
  clanTag?: string;
  captainId?: string;
}) {
  const res = await squads.formSquad(await createClient(), input);
  if (res.ok) rev();
  return res;
}

export async function requestSquad(input: { game: string; name?: string; clanTag?: string; captainId?: string }) {
  const res = await squads.requestSquad(await createClient(), input);
  if (res.ok) rev();
  return res;
}

export async function approveRequest(requestId: string) {
  const res = await squads.approveRequest(await createClient(), requestId);
  if (res.ok) rev();
  return res;
}

export async function declineRequest(requestId: string) {
  const res = await squads.declineRequest(await createClient(), requestId);
  if (res.ok) rev();
  return res;
}

export async function setClanTag(squadId: string, tag: string) {
  const res = await squads.setClanTag(await createClient(), squadId, tag);
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

export async function requestNight(squadId: string, note?: string) {
  const res = await squads.requestNight(await createClient(), squadId, note);
  if (res.ok) rev();
  return res;
}

export async function clearNightRequest(id: string) {
  const res = await squads.clearNightRequest(await createClient(), id);
  if (res.ok) rev();
  return res;
}
