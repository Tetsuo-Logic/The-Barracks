"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendToPlayers } from "@/lib/push";
import type { Profile, Verdict } from "@/lib/types";

type Result = { ok: true; id: string } | { ok: false; error: string };

// Organiser convenes a trial against a flake.
export async function createTrial(input: {
  defendantId: string;
  charge: string;
  competitionId?: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) return { ok: false, error: "Only the organiser can do that." };

  const charge = input.charge.trim();
  if (!charge) return { ok: false, error: "Name the charge." };

  const { data, error } = await supabase
    .from("trials")
    .insert({
      defendant_id: input.defendantId,
      competition_id: input.competitionId ?? null,
      charge,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Couldn't convene it." };

  // Summon the accused and the jury.
  const { data: everyone } = await supabase.from("profiles").select("id");
  const defendant = input.defendantId;
  const jurors = ((everyone ?? []) as Pick<Profile, "id">[])
    .map((p) => p.id)
    .filter((id) => id !== defendant);

  await sendToPlayers([defendant], "new_comp", {
    title: "You've been summoned",
    body: `Charge: ${charge}. Enter your defence.`,
    url: `/trial/${data.id}`,
    tag: `trial-${data.id}`,
  });
  await sendToPlayers(jurors, "new_comp", {
    title: "The Courtroom is in session",
    body: `${charge}. Your verdict is needed.`,
    url: `/trial/${data.id}`,
    tag: `trial-${data.id}`,
  });

  revalidatePath("/trial");
  return { ok: true, id: data.id as string };
}

// The accused states their case.
export async function submitDefence(
  trialId: string,
  defence: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("trials")
    .update({ defence: defence.trim() || null })
    .eq("id", trialId)
    .eq("defendant_id", user.id);
  if (error) return { ok: false, error: "Couldn't file your defence." };

  revalidatePath(`/trial/${trialId}`);
  return { ok: true };
}

// A juror votes; when the last juror votes, the verdict lands (and a strike if
// unanimous guilty), handled by the finalize_trial function.
export async function castVote(
  trialId: string,
  vote: Verdict,
  comment?: string,
): Promise<{ ok: true; verdict: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("trial_votes").upsert(
    {
      trial_id: trialId,
      juror_id: user.id,
      vote,
      comment: comment?.trim() || null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "trial_id,juror_id" },
  );
  if (error) return { ok: false, error: "Couldn't cast your vote." };

  const { data: verdict } = await supabase.rpc("finalize_trial", { p_trial: trialId });

  if (verdict === "guilty" || verdict === "not_guilty") {
    const { data: trial } = await supabase
      .from("trials")
      .select("defendant_id, charge")
      .eq("id", trialId)
      .single();
    const { data: everyone } = await supabase.from("profiles").select("id, name");
    const people = (everyone ?? []) as (Pick<Profile, "id"> & { name: string })[];
    const defendant = people.find((p) => p.id === (trial as { defendant_id?: string })?.defendant_id);
    await sendToPlayers(
      people.map((p) => p.id),
      "results",
      {
        title: verdict === "guilty" ? "Verdict: guilty" : "Verdict: not guilty",
        body:
          verdict === "guilty"
            ? `${defendant?.name ?? "The accused"} takes a strike.`
            : `${defendant?.name ?? "The accused"} walks free.`,
        url: `/trial/${trialId}`,
        tag: `trial-${trialId}`,
      },
    );
  }

  revalidatePath(`/trial/${trialId}`);
  revalidatePath("/standings");
  return { ok: true, verdict: (verdict as string) ?? null };
}
