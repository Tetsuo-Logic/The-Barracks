"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as musters from "@/lib/data/commands/musters";

// Thin Server Action wrappers around @/lib/data/commands/musters.
const rev = () => revalidatePath("/squads");

export async function openMuster(input: {
  squadId: string;
  dates: string[];
  windowFrom?: string;
  windowTo?: string;
  note?: string;
}) {
  const res = await musters.openMuster(await createClient(), input);
  if (res.ok) rev();
  return res;
}

export async function respondMuster(
  musterId: string,
  availableDates: string[],
  fromTimes: string[],
  toTimes: string[],
) {
  const res = await musters.respondMuster(await createClient(), musterId, availableDates, fromTimes, toTimes);
  if (res.ok) rev();
  return res;
}

export async function proposeMuster(musterId: string, chosenDate: string, chosenTime?: string) {
  const res = await musters.proposeMuster(await createClient(), musterId, chosenDate, chosenTime);
  if (res.ok) rev();
  return res;
}

export async function approveMuster(musterId: string, date: string, time?: string) {
  const res = await musters.approveMuster(await createClient(), musterId, date, time);
  if (res.ok) {
    rev();
    revalidatePath("/");
  }
  return res;
}

export async function sendBackMuster(musterId: string) {
  const res = await musters.sendBackMuster(await createClient(), musterId);
  if (res.ok) rev();
  return res;
}

export async function cancelMuster(musterId: string) {
  const res = await musters.cancelMuster(await createClient(), musterId);
  if (res.ok) rev();
  return res;
}
