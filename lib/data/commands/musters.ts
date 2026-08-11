import type { Db, Result } from "./types";
import type { Muster } from "@/lib/domain";
import { sendToPlayers } from "@/lib/push";
import { gameById } from "@/lib/games";
import { shortDate } from "@/lib/dates";

// Muster commands — the Captain's pre-week arrangement. Writes are gated by RLS
// (Captain of the squad or the CO); responses are self-only. The President
// approves a proposed muster, which deploys a real Operation.

async function squadMemberIds(db: Db, squadId: string, exclude?: string): Promise<string[]> {
  const { data } = await db.from("squad_members").select("user_id").eq("squad_id", squadId);
  return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id !== exclude);
}

// Push a muster event. The persistent, clickable record lives in the derived
// Activity feed (getActivityFeed reads the muster/night tables directly), so we
// only need the on-screen push here.
async function pushAndStore(
  db: Db,
  userIds: string[],
  p: { title: string; body: string; url: string; tag: string },
): Promise<void> {
  void db;
  await sendToPlayers(userIds, "new_comp", p);
}

// Captain calls a muster: candidate nights + a kick-off window for the week ahead.
export async function openMuster(
  db: Db,
  input: { squadId: string; dates: string[]; windowFrom?: string; windowTo?: string; note?: string },
): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!input.dates.length) return { ok: false, error: "Pick at least one night." };

  const { data: sq } = await db.from("squads").select("group_id, game, name").eq("id", input.squadId).maybeSingle();
  if (!sq) return { ok: false, error: "Squad not found." };
  const squad = sq as { group_id: string; game: string; name: string | null };

  // One active muster per squad.
  const { data: existing } = await db
    .from("musters")
    .select("id")
    .eq("squad_id", input.squadId)
    .in("status", ["open", "proposed"])
    .limit(1);
  if (existing && existing.length) return { ok: false, error: "There's already a muster running for this squad." };

  const { error } = await db.from("musters").insert({
    squad_id: input.squadId,
    group_id: squad.group_id,
    game: squad.game,
    created_by: user.id,
    dates: input.dates,
    window_from: input.windowFrom || null,
    window_to: input.windowTo || null,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn't call the muster. Are you the Captain?" };

  // Calling a muster answers any outstanding "request a night" nudges — clear them.
  await db.from("squad_night_requests").delete().eq("squad_id", input.squadId);

  const label = squad.name || gameById(squad.game).name;
  await pushAndStore(db, await squadMemberIds(db, input.squadId, user.id), {
    title: `📆 ${label}: muster called`,
    body: "Mark the nights you can play this week.",
    url: "/squads",
    tag: `muster-${input.squadId}`,
  });
  return { ok: true };
}

// A squad member marks the nights they can do + their window each night (upsert).
// availableDates, fromTimes, toTimes are index-aligned.
export async function respondMuster(
  db: Db,
  musterId: string,
  availableDates: string[],
  fromTimes: string[],
  toTimes: string[],
): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await db.from("muster_responses").upsert(
    {
      muster_id: musterId,
      user_id: user.id,
      available_dates: availableDates,
      from_times: fromTimes,
      to_times: toTimes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "muster_id,user_id" },
  );
  if (error) return { ok: false, error: "Couldn't save your nights." };
  return { ok: true };
}

// Captain reads the tally, picks the night, sends it up to the President.
export async function proposeMuster(
  db: Db,
  musterId: string,
  chosenDate: string,
  chosenTime?: string,
): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!chosenDate) return { ok: false, error: "Pick the night." };

  const { data: mu } = await db.from("musters").select("game").eq("id", musterId).maybeSingle();
  if (!mu) return { ok: false, error: "Muster not found." };

  const { error } = await db
    .from("musters")
    .update({ status: "proposed", chosen_date: chosenDate, chosen_time: chosenTime || null })
    .eq("id", musterId);
  if (error) return { ok: false, error: "Couldn't send it up. Are you the Captain?" };

  const label = gameById((mu as { game: string }).game).name;
  const { data: admins } = await db.from("profiles").select("id").eq("is_admin", true).neq("id", user.id);
  await pushAndStore(db, ((admins ?? []) as { id: string }[]).map((a) => a.id), {
    title: `⚑ ${label}: night proposed`,
    body: `The Captain proposes ${shortDate(chosenDate)}${chosenTime ? ` · ${chosenTime}` : ""}. Approve to deploy.`,
    url: "/squads",
    tag: `muster-${musterId}`,
  });
  return { ok: true };
}

// President approves → deploys a real Operation (competition) for the squad and
// tells the squad. The date/time can be nudged at approval.
export async function approveMuster(db: Db, musterId: string, date: string, time?: string): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!date) return { ok: false, error: "A date is needed." };

  const { data: mu } = await db.from("musters").select("*").eq("id", musterId).maybeSingle();
  if (!mu) return { ok: false, error: "Muster not found." };
  const m = mu as Muster;

  const { data: comp, error: cErr } = await db
    .from("competitions")
    .insert({
      game: m.game,
      squad_id: m.squad_id,
      course: null,
      title: null,
      date,
      tee_time: time || null,
      holes: 9,
      format: "skins",
      par: Array(9).fill(4),
      stroke_index: null,
      notes: m.note,
      for_cup: false,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (cErr || !comp) return { ok: false, error: "Couldn't deploy the game. Are you the CO?" };
  const compId = (comp as { id: string }).id;

  await db
    .from("musters")
    .update({ status: "approved", chosen_date: date, chosen_time: time || null, competition_id: compId })
    .eq("id", musterId);

  const label = gameById(m.game).name;
  await sendToPlayers(await squadMemberIds(db, m.squad_id, user.id), "new_comp", {
    title: `🎮 ${label}: game on`,
    body: `${shortDate(date)}${time ? ` · ${time}` : ""}. Roll call — you in?`,
    url: `/comp/${compId}`,
    tag: `comp-${compId}`,
  });
  return { ok: true };
}

// President sends a proposal back to the Captain for another look.
export async function sendBackMuster(db: Db, musterId: string): Promise<Result> {
  const { data: mu } = await db.from("musters").select("game, created_by").eq("id", musterId).maybeSingle();
  const { error } = await db
    .from("musters")
    .update({ status: "open", chosen_date: null, chosen_time: null })
    .eq("id", musterId);
  if (error) return { ok: false, error: "Couldn't send it back." };

  const m = mu as { game: string; created_by: string | null } | null;
  if (m?.created_by) {
    await pushAndStore(db, [m.created_by], {
      title: `↩ ${gameById(m.game).name}: sent back`,
      body: "The President wants another look — pick the night again.",
      url: "/squads",
      tag: `muster-${musterId}`,
    });
  }
  return { ok: true };
}

// Captain (or CO) scraps a muster entirely.
export async function cancelMuster(db: Db, musterId: string): Promise<Result> {
  const { error } = await db.from("musters").delete().eq("id", musterId);
  if (error) return { ok: false, error: "Couldn't cancel the muster." };
  return { ok: true };
}
