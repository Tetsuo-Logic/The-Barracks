"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as trials from "@/lib/data/commands/trials";
import type { Penalty, Verdict } from "@/lib/domain";

// Thin Server Action wrappers around @/lib/data/commands/trials.

export async function createTrial(input: {
  defendantId: string;
  charge: string;
  competitionId?: string;
}) {
  const res = await trials.createTrial(await createClient(), input);
  if (res.ok) revalidatePath("/trial");
  return res;
}

export async function submitDefence(trialId: string, defence: string) {
  const res = await trials.submitDefence(await createClient(), trialId, defence);
  if (res.ok) revalidatePath(`/trial/${trialId}`);
  return res;
}

export async function openJury(trialId: string) {
  const res = await trials.openJury(await createClient(), trialId);
  if (res.ok) revalidatePath(`/trial/${trialId}`);
  return res;
}

export async function castVote(trialId: string, vote: Verdict, comment?: string) {
  const res = await trials.castVote(await createClient(), trialId, vote, comment);
  if (res.ok) revalidatePath(`/trial/${trialId}`);
  return res;
}

export async function rulePresident(
  trialId: string,
  input: { verdict: Verdict; penalty?: Penalty; note?: string },
) {
  const res = await trials.rulePresident(await createClient(), trialId, input);
  if (res.ok) {
    revalidatePath(`/trial/${trialId}`);
    revalidatePath("/trial");
    revalidatePath("/standings");
  }
  return res;
}
