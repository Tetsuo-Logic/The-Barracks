import { sendToPlayers } from "@/lib/push";
import type { Penalty, Profile, Verdict } from "@/lib/domain";
import type { Db, Result } from "./types";

// Courtroom commands — the pure write logic behind app/actions/trials.ts.

type Created = { ok: true; id: string } | { ok: false; error: string };

// Organiser convenes a trial against a flake. The accused enters a defence;
// then it's presented to the President to rule on.
export async function createTrial(
  db: Db,
  input: { defendantId: string; charge: string; competitionId?: string },
): Promise<Created> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: me } = await db
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) return { ok: false, error: "Only the organiser can do that." };

  const charge = input.charge.trim();
  if (!charge) return { ok: false, error: "Name the charge." };

  const { data, error } = await db
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

  // Summon the accused; put everyone else on notice that a case is in session.
  const { data: everyone } = await db.from("profiles").select("id");
  const defendant = input.defendantId;
  const others = ((everyone ?? []) as Pick<Profile, "id">[])
    .map((p) => p.id)
    .filter((id) => id !== defendant);

  await sendToPlayers([defendant], "new_comp", {
    title: "You've been summoned",
    body: `Charge: ${charge}. Enter your defence.`,
    url: `/trial/${data.id}`,
    tag: `trial-${data.id}`,
  });
  await sendToPlayers(others, "new_comp", {
    title: "The Courtroom is in session",
    body: `${charge}. The President will hear it.`,
    url: `/trial/${data.id}`,
    tag: `trial-${data.id}`,
  });

  return { ok: true, id: data.id as string };
}

// The accused states their case.
export async function submitDefence(db: Db, trialId: string, defence: string): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await db
    .from("trials")
    .update({ defence: defence.trim() || null })
    .eq("id", trialId)
    .eq("defendant_id", user.id);
  if (error) return { ok: false, error: "Couldn't file your defence." };

  return { ok: true };
}

// The President opens the floor to the jury — everyone gives a guilty /
// not-guilty steer. It's advisory: the President still rules.
export async function openJury(db: Db, trialId: string): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: trial, error } = await db
    .from("trials")
    .update({ jury_opened: true })
    .eq("id", trialId)
    .eq("status", "open")
    .select("defendant_id, charge")
    .single();
  if (error || !trial) return { ok: false, error: "Couldn't open the floor. Are you the President?" };

  const tx = trial as { defendant_id: string; charge: string };
  const { data: everyone } = await db.from("profiles").select("id");
  const jurors = ((everyone ?? []) as Pick<Profile, "id">[])
    .map((p) => p.id)
    .filter((id) => id !== tx.defendant_id);

  await sendToPlayers(jurors, "new_comp", {
    title: "The jury is called",
    body: `${tx.charge}. Guilty or not — the President wants your steer.`,
    url: `/trial/${trialId}`,
    tag: `trial-${trialId}`,
  });

  return { ok: true };
}

// A juror gives their advisory steer: guilty or not guilty. No penalty — that's
// the President's call. Never auto-closes the case.
export async function castVote(
  db: Db,
  trialId: string,
  vote: Verdict,
  comment?: string,
): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await db.from("trial_votes").upsert(
    {
      trial_id: trialId,
      juror_id: user.id,
      vote,
      penalty: null,
      comment: comment?.trim() || null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "trial_id,juror_id" },
  );
  if (error) return { ok: false, error: "Couldn't record your steer." };

  return { ok: true };
}

// The President rules — the final call. Guilty (warning or strike), or not
// guilty (case dismissed, or the behaviour noted on the player's record).
export async function rulePresident(
  db: Db,
  trialId: string,
  input: { verdict: Verdict; penalty?: Penalty; note?: string },
): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: verdict, error } = await db.rpc("president_rule", {
    p_trial: trialId,
    p_verdict: input.verdict,
    p_penalty: input.verdict === "guilty" ? input.penalty ?? "warning" : null,
    p_note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn't record the ruling. Are you the President?" };

  // Announce the outcome to the whole squad.
  const { data: trial } = await db
    .from("trials")
    .select("defendant_id, penalty, note")
    .eq("id", trialId)
    .single();
  const tx = trial as { defendant_id?: string; penalty?: Penalty | null; note?: string | null } | null;
  const { data: everyone } = await db.from("profiles").select("id, name");
  const people = (everyone ?? []) as (Pick<Profile, "id"> & { name: string })[];
  const name = people.find((p) => p.id === tx?.defendant_id)?.name ?? "The accused";

  let title: string;
  let body: string;
  if (verdict === "guilty") {
    title = "Verdict: guilty";
    body = tx?.penalty === "strike" ? `${name} takes a strike.` : `${name} gets a warning.`;
  } else if (tx?.note) {
    title = "Verdict: not guilty";
    body = `${name} walks — but it's noted.`;
  } else {
    title = "⚖️ Case dismissed";
    body = `${name} walks free.`;
  }
  await sendToPlayers(
    people.map((p) => p.id),
    "results",
    { title, body, url: `/trial/${trialId}`, tag: `trial-${trialId}` },
  );

  return { ok: true };
}
