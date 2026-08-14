import type { Db, Result } from "./types";
import type { SquadRequest } from "@/lib/domain";
import { sendToPlayers } from "@/lib/push";
import { gameById } from "@/lib/games";

// Squad commands. Membership writes are self-service (RLS enforces self-join /
// captain-or-CO removal); creating squads + moving the captaincy is CO-only.

async function currentGroup(db: Db): Promise<string | null> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("memberships").select("group_id").eq("user_id", user.id).limit(1).maybeSingle();
  return (data as { group_id?: string } | null)?.group_id ?? null;
}

export async function createSquad(db: Db, game: string, name?: string, clanTag?: string): Promise<Result> {
  const groupId = await currentGroup(db);
  if (!groupId) return { ok: false, error: "No Barracks found." };
  if (!game) return { ok: false, error: "Pick a game." };
  if (!name?.trim()) return { ok: false, error: "Name the squad." };
  const { error } = await db.from("squads").insert({
    group_id: groupId,
    game,
    name: name?.trim() || null,
    clan_tag: clanTag?.trim() || null,
  });
  if (error) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? "There's already a squad for that game."
        : "Couldn't create the squad. Are you the CO?",
    };
  }
  return { ok: true };
}

export async function deleteSquad(db: Db, squadId: string): Promise<Result> {
  const { error } = await db.from("squads").delete().eq("id", squadId);
  if (error) return { ok: false, error: "Couldn't delete the squad." };
  return { ok: true };
}

export async function joinSquad(db: Db, squadId: string): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await db
    .from("squad_members")
    .upsert({ squad_id: squadId, user_id: user.id }, { onConflict: "squad_id,user_id" });
  if (error) return { ok: false, error: "Couldn't join the squad." };
  return { ok: true };
}

export async function leaveSquad(db: Db, squadId: string): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // A Captain walking out leaves the squad with nobody able to call a muster,
  // approve a night or answer a request — the squad is still there but nothing
  // can happen in it. Hand the captaincy over first. Last one out is fine:
  // there's nobody to hand it to.
  const { data: rows } = await db
    .from("squad_members")
    .select("user_id, is_captain")
    .eq("squad_id", squadId);
  const members = (rows ?? []) as { user_id: string; is_captain: boolean }[];
  const me = members.find((m) => m.user_id === user.id);
  if (me?.is_captain && members.length > 1) {
    return {
      ok: false,
      error: "You're the Captain — hand the captaincy to someone else before you leave.",
    };
  }

  const { error } = await db.from("squad_members").delete().eq("squad_id", squadId).eq("user_id", user.id);
  if (error) return { ok: false, error: "Couldn't leave." };
  return { ok: true };
}

// Captain or CO removes a member (RLS enforces who may).
export async function removeMember(db: Db, squadId: string, userId: string): Promise<Result> {
  const { error } = await db.from("squad_members").delete().eq("squad_id", squadId).eq("user_id", userId);
  if (error) return { ok: false, error: "Couldn't remove them." };
  return { ok: true };
}

// CO moves the captaincy: demote the current Captain, promote the chosen member.
export async function setCaptain(db: Db, squadId: string, userId: string): Promise<Result> {
  const { error: e1 } = await db
    .from("squad_members")
    .update({ is_captain: false })
    .eq("squad_id", squadId)
    .eq("is_captain", true);
  if (e1) return { ok: false, error: "Couldn't set the captain." };
  const { error: e2 } = await db
    .from("squad_members")
    .update({ is_captain: true })
    .eq("squad_id", squadId)
    .eq("user_id", userId);
  if (e2) return { ok: false, error: "Couldn't set the captain." };
  return { ok: true };
}

// A member proposes a squad — it goes to the President to approve.
export async function requestSquad(
  db: Db,
  input: { game: string; name?: string; clanTag?: string; captainId?: string },
): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!input.game) return { ok: false, error: "Pick a game." };
  if (!input.name?.trim()) return { ok: false, error: "Name the squad." };
  const groupId = await currentGroup(db);
  if (!groupId) return { ok: false, error: "No Barracks found." };

  const { error } = await db.from("squad_requests").insert({
    group_id: groupId,
    game: input.game,
    name: input.name?.trim() || null,
    clan_tag: input.clanTag?.trim() || null,
    captain_id: input.captainId || null,
    requested_by: user.id,
  });
  if (error) return { ok: false, error: "Couldn't send the request." };

  // The President is the one who can act on it, so tell them.
  const { data: me } = await db.from("profiles").select("name").eq("id", user.id).single();
  const who = (me as { name?: string })?.name ?? "Someone";
  const { data: admins } = await db.from("profiles").select("id").eq("is_admin", true).neq("id", user.id);
  await sendToPlayers(((admins ?? []) as { id: string }[]).map((a) => a.id), "new_comp", {
    title: "⚑ Squad requested",
    body: `${who} wants ${input.name?.trim() || gameById(input.game).name}. Approve to form it.`,
    url: "/hq/squads",
    tag: `squadreq-${user.id}`,
  });
  return { ok: true };
}

/**
 * The President forming a squad outright.
 *
 * Deliberately the same path as a request that gets approved: write the
 * request, approve it immediately. That reuses approve_squad_request, which is
 * the only thing able to seat a Captain — squad_members is self-insert only, so
 * a plain `insert into squads` can form a squad but can't give anybody control
 * of it. One route for "a squad comes into existence", and it leaves the
 * approval on record.
 */
export async function formSquad(
  db: Db,
  input: { game: string; name?: string; clanTag?: string; captainId?: string },
): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!input.game) return { ok: false, error: "Pick a game." };
  if (!input.name?.trim()) return { ok: false, error: "Name the squad." };
  const groupId = await currentGroup(db);
  if (!groupId) return { ok: false, error: "No Barracks found." };

  const { data: req, error: rErr } = await db
    .from("squad_requests")
    .insert({
      group_id: groupId,
      game: input.game,
      name: input.name.trim(),
      clan_tag: input.clanTag?.trim() || null,
      captain_id: input.captainId || null,
      requested_by: user.id,
    })
    .select("id")
    .single();
  if (rErr || !req) return { ok: false, error: "Couldn't form the squad." };

  const { error } = await db.rpc("approve_squad_request", {
    p_request: (req as { id: string }).id,
  });
  if (error) {
    // Leave no half-formed request behind if the approval was refused.
    await db.from("squad_requests").delete().eq("id", (req as { id: string }).id);
    return {
      ok: false,
      error: /permitted/i.test(error.message)
        ? "Only the President can form a squad."
        : "Couldn't form the squad.",
    };
  }
  return { ok: true };
}

// President approves a squad request → forms the squad.
export async function approveRequest(db: Db, requestId: string): Promise<Result> {
  const { data: req } = await db.from("squad_requests").select("*").eq("id", requestId).single();
  if (!req) return { ok: false, error: "Request not found." };
  const r = req as SquadRequest;

  // Forms the squad AND seats the proposed Captain. squad_members is
  // self-insert only, so seating somebody else has to happen in the definer
  // function — see 0046_squad_request_captain.
  const { error } = await db.rpc("approve_squad_request", { p_request: requestId });
  if (error) {
    return {
      ok: false,
      error: /permitted/i.test(error.message)
        ? "Only the President can form a squad."
        : "Couldn't form the squad.",
    };
  }

  // Tell the requester it's formed, and the new Captain that it's theirs.
  const label = r.name || gameById(r.game).name;
  if (r.captain_id) {
    await sendToPlayers([r.captain_id], "new_comp", {
      title: `🎖 ${label}: you have the captaincy`,
      body: "The President approved the squad. Call a muster when you're ready.",
      url: "/hq/squads",
      tag: `squad-${requestId}`,
    });
  }
  if (r.requested_by && r.requested_by !== r.captain_id) {
    await sendToPlayers([r.requested_by], "new_comp", {
      title: `✅ ${label} formed`,
      body: "Your squad request was approved.",
      url: "/hq/squads",
      tag: `squad-${requestId}`,
    });
  }
  return { ok: true };
}

export async function declineRequest(db: Db, requestId: string): Promise<Result> {
  const { error } = await db.from("squad_requests").update({ status: "declined" }).eq("id", requestId);
  if (error) return { ok: false, error: "Couldn't decline the request." };
  return { ok: true };
}

// Captain or CO sets/edits the clan tag.
export async function setClanTag(db: Db, squadId: string, tag: string): Promise<Result> {
  const { error } = await db.rpc("set_clan_tag", { p_squad: squadId, p_tag: tag });
  if (error) return { ok: false, error: "Couldn't set the clan tag." };
  return { ok: true };
}

// A squad member nudges their Captain to sort a night. Persisted + pings the
// Captain (or the CO if the squad has no Captain yet).
export async function requestNight(db: Db, squadId: string, note?: string): Promise<Result> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: sq } = await db.from("squads").select("group_id, game, name").eq("id", squadId).maybeSingle();
  if (!sq) return { ok: false, error: "Squad not found." };
  const squad = sq as { group_id: string; game: string; name: string | null };

  const { error } = await db.from("squad_night_requests").insert({
    squad_id: squadId,
    group_id: squad.group_id,
    requested_by: user.id,
    note: note?.trim() || null,
  });
  if (error) return { ok: false, error: "Couldn't send the request. Are you in the squad?" };

  const { data: me } = await db.from("profiles").select("name").eq("id", user.id).single();
  const who = (me as { name?: string })?.name ?? "Someone";
  const { data: caps } = await db
    .from("squad_members")
    .select("user_id")
    .eq("squad_id", squadId)
    .eq("is_captain", true);
  let targets = ((caps ?? []) as { user_id: string }[]).map((c) => c.user_id).filter((id) => id !== user.id);
  if (targets.length === 0) {
    // No Captain yet — let the CO(s) know instead.
    const { data: admins } = await db.from("profiles").select("id").eq("is_admin", true).neq("id", user.id);
    targets = ((admins ?? []) as { id: string }[]).map((a) => a.id);
  }
  const trimmed = note?.trim();
  const label = squad.name || gameById(squad.game).name;
  // The persistent, clickable record lives in the Activity feed (derived from
  // squad_night_requests); here we just fire the on-screen push.
  await sendToPlayers(targets, "new_comp", {
    title: `📣 ${label}: night wanted`,
    body: `${who} wants a game${trimmed ? ` — “${trimmed}”` : ""}. Muster the squad?`,
    url: "/squads",
    tag: `night-${squadId}`,
  });
  return { ok: true };
}

// The filer, the Captain, or the CO clears a night nudge.
export async function clearNightRequest(db: Db, id: string): Promise<Result> {
  const { error } = await db.from("squad_night_requests").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't clear it." };
  return { ok: true };
}
