import type { Db, Result } from "./types";

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

export async function createSquad(db: Db, game: string, name?: string): Promise<Result> {
  const groupId = await currentGroup(db);
  if (!groupId) return { ok: false, error: "No Barracks found." };
  if (!game) return { ok: false, error: "Pick a game." };
  const { error } = await db.from("squads").insert({ group_id: groupId, game, name: name?.trim() || null });
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
