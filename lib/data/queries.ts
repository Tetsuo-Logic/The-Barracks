import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import type {
  Broadcast,
  BroadcastResponse,
  Comment,
  Competition,
  GameRequest,
  Photo,
  Profile,
  RadarGame,
  RadarInterest,
  Result,
  Rsvp,
  Score,
  Squad,
  SquadMember,
  SquadRequest,
  Trial,
} from "@/lib/types";
import { GAMES, type Game } from "@/lib/games";
import { computeRankings, type RankRow } from "@/lib/rankings";
import { computeService, type Service } from "@/lib/service";
import type { PhotoWithUrl } from "@/components/Photos";

export type RsvpWithPlayer = Rsvp & { player: Profile | null };

export type FixturesData = {
  profiles: Profile[];
  next: Competition | null;
  upcoming: Competition[];
  recent: Competition[];
  rsvpsByComp: Record<string, RsvpWithPlayer[]>;
};

/**
 * Everything the Fixtures home needs, in a handful of tiny queries. With three
 * players and a season of dates the data is small — fetch it all, shape in JS.
 */
export async function getFixturesData(): Promise<FixturesData> {
  const supabase = await createClient();

  const [{ data: comps }, { data: profiles }, { data: rsvps }] =
    await Promise.all([
      supabase.from("competitions").select("*").order("date", { ascending: true }),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("rsvps").select("*"),
    ]);

  const allComps = (comps ?? []) as Competition[];
  const allProfiles = (profiles ?? []) as Profile[];
  const allRsvps = (rsvps ?? []) as Rsvp[];

  const profileById = new Map(allProfiles.map((p) => [p.id, p]));

  const rsvpsByComp: Record<string, RsvpWithPlayer[]> = {};
  for (const r of allRsvps) {
    (rsvpsByComp[r.competition_id] ??= []).push({
      ...r,
      player: profileById.get(r.player_id) ?? null,
    });
  }

  const today = todayISO();
  const live = allComps.filter((c) => c.status === "upcoming");

  // Next up = soonest upcoming that hasn't passed. Fall back to the soonest
  // upcoming at all (a date left in the past but not marked played).
  const futureOrToday = live.filter((c) => c.date >= today);
  const next = futureOrToday[0] ?? live[0] ?? null;

  const upcoming = live.filter((c) => c.id !== next?.id);

  const recent = allComps
    .filter((c) => c.status === "played" || c.status === "cancelled")
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  return { profiles: allProfiles, next, upcoming, recent, rsvpsByComp };
}

/** The CO-editable games list (stored on app_settings). Falls back to the seed
 *  list if unset. Seed colours are merged back in for list dots. */
export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("games")
    .eq("id", 1)
    .maybeSingle();
  const raw = (data as { games?: unknown } | null)?.games;
  if (!Array.isArray(raw) || raw.length === 0) return GAMES;
  const seedById = new Map(GAMES.map((g) => [g.id, g]));
  return raw.map((g) => {
    const item = g as { id: string; name: string; emoji?: string; hasScorecard?: boolean };
    return {
      id: item.id,
      name: item.name,
      emoji: item.emoji ?? "🎮",
      colour: seedById.get(item.id)?.colour ?? "#7c8b83",
      hasScorecard: Boolean(item.hasScorecard),
    };
  });
}

export type RadarItem = RadarGame & {
  adderName: string;
  yes: number; // interested count
  no: number; // not-interested count
  mine: boolean | null; // this player's stance
};

/** The radar wishlist, soonest release first, with interest tallies. */
export async function getRadar(playerId: string): Promise<{
  items: RadarItem[];
  totalPlayers: number;
}> {
  const supabase = await createClient();
  const [{ data: gamesRows }, { data: interest }, { data: profiles }] = await Promise.all([
    supabase.from("radar_games").select("*").order("created_at", { ascending: false }),
    supabase.from("radar_interest").select("*"),
    supabase.from("profiles").select("id, name"),
  ]);

  const nameById = new Map(((profiles ?? []) as Pick<Profile, "id" | "name">[]).map((p) => [p.id, p.name]));
  const byRadar = new Map<string, RadarInterest[]>();
  for (const r of (interest ?? []) as RadarInterest[]) {
    const list = byRadar.get(r.radar_id) ?? [];
    list.push(r);
    byRadar.set(r.radar_id, list);
  }

  const items: RadarItem[] = ((gamesRows ?? []) as RadarGame[]).map((g) => {
    const votes = byRadar.get(g.id) ?? [];
    const mine = votes.find((v) => v.player_id === playerId);
    return {
      ...g,
      adderName: (g.added_by && nameById.get(g.added_by)) || "Someone",
      yes: votes.filter((v) => v.interested).length,
      no: votes.filter((v) => !v.interested).length,
      mine: mine ? mine.interested : null,
    };
  });

  // Soonest known release date first, then undated.
  items.sort((a, z) => {
    if (a.release_date && z.release_date) return a.release_date < z.release_date ? -1 : 1;
    if (a.release_date) return -1;
    if (z.release_date) return 1;
    return a.created_at < z.created_at ? 1 : -1;
  });

  return { items, totalPlayers: (profiles ?? []).length };
}

export type GameRequestWithPlayer = GameRequest & { requester: Profile | null };

/** Open game requests (newest first), each with the player who floated it. */
export async function getOpenGameRequests(): Promise<GameRequestWithPlayer[]> {
  const supabase = await createClient();
  const [{ data: reqs }, { data: profiles }] = await Promise.all([
    supabase
      .from("game_requests")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);
  const byId = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));
  return ((reqs ?? []) as GameRequest[]).map((r) => ({
    ...r,
    requester: r.requested_by ? byId.get(r.requested_by) ?? null : null,
  }));
}

export type NewComment = { comment: Comment; comp: Competition };
export type NewAnswer = { broadcast: Broadcast; count: number };

export type Inbox = {
  asks: Broadcast[]; // questions put to you that you haven't answered
  rsvpNeeded: Competition[]; // upcoming rounds you haven't said in/out/maybe to
  newComments: NewComment[]; // comments by others since you last opened the inbox
  newAnswers: NewAnswer[]; // replies to your own polls since you last looked
  total: number; // badge count
};

/**
 * Everything waiting for a player: unanswered questions, rounds that still need
 * an RSVP, and new comments since they last looked. Drives the header bell
 * badge and the home "inbox" strip, so a missed push never means a missed thing.
 */
export async function getInbox(player: Profile): Promise<Inbox> {
  const supabase = await createClient();
  const today = todayISO();
  const seenAt = player.inbox_seen_at;

  const [
    { data: bx },
    { data: myResp },
    { data: comps },
    { data: myRsvps },
    { data: comments },
    { data: myBroadcasts },
    { data: respToMine },
  ] = await Promise.all([
    supabase
      .from("broadcasts")
      .select("*")
      .in("kind", ["yesno", "ask", "dates"])
      .neq("created_by", player.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("broadcast_responses")
      .select("broadcast_id")
      .eq("player_id", player.id),
    supabase
      .from("competitions")
      .select("*")
      .order("date", { ascending: true }),
    supabase.from("rsvps").select("competition_id").eq("player_id", player.id),
    supabase
      .from("comments")
      .select("*")
      .neq("author_id", player.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("broadcasts")
      .select("*")
      .eq("created_by", player.id)
      .in("kind", ["yesno", "ask", "dates"]),
    supabase
      .from("broadcast_responses")
      .select("broadcast_id, player_id, created_at")
      .neq("player_id", player.id),
  ]);

  const answered = new Set((myResp ?? []).map((r) => r.broadcast_id));
  const asks = ((bx ?? []) as Broadcast[]).filter((b) => !answered.has(b.id));

  const allComps = (comps ?? []) as Competition[];
  const compById = new Map(allComps.map((c) => [c.id, c]));
  const rsvped = new Set((myRsvps ?? []).map((r) => r.competition_id));
  const rsvpNeeded = allComps.filter(
    (c) => c.status === "upcoming" && c.date >= today && !rsvped.has(c.id),
  );

  // New comments = posted since the player last opened the inbox. Compare as
  // epoch millis, not strings — the two ISO values can differ in format.
  const seenMs = seenAt ? new Date(seenAt).getTime() : Infinity;
  const newComments: NewComment[] = ((comments ?? []) as Comment[])
    .filter((c) => new Date(c.created_at).getTime() > seenMs)
    .map((c) => ({ comment: c, comp: compById.get(c.competition_id)! }))
    .filter((x) => Boolean(x.comp));

  // Replies to your own polls since you last looked — so answers reach you too.
  const mine = new Map(((myBroadcasts ?? []) as Broadcast[]).map((b) => [b.id, b]));
  const answerCounts = new Map<string, number>();
  for (const r of (respToMine ?? []) as Pick<BroadcastResponse, "broadcast_id" | "created_at">[]) {
    if (!mine.has(r.broadcast_id)) continue;
    if (new Date(r.created_at).getTime() <= seenMs) continue;
    answerCounts.set(r.broadcast_id, (answerCounts.get(r.broadcast_id) ?? 0) + 1);
  }
  const newAnswers: NewAnswer[] = [...answerCounts.entries()].map(([id, count]) => ({
    broadcast: mine.get(id)!,
    count,
  }));

  return {
    asks,
    rsvpNeeded,
    newComments,
    newAnswers,
    total: asks.length + rsvpNeeded.length + newComments.length + newAnswers.length,
  };
}

// One entry in the shared activity timeline. A discriminated union so the feed
// component can render each kind with the right row.
export type ActivityItem =
  | {
      kind: "broadcast";
      at: string;
      broadcast: Broadcast;
      responses: BroadcastResponse[];
      answered: boolean;
    }
  | { kind: "trial"; at: string; trial: Trial }
  | { kind: "round"; at: string; comp: Competition }
  | { kind: "result"; at: string; comp: Competition }
  | { kind: "comment"; at: string; comment: Comment; comp: Competition; authorName: string };

export type Activity = {
  items: ActivityItem[];
  profiles: Profile[];
  totalPlayers: number;
  clearedBefore: string | null; // history cutoff, if the organiser set one
};

/**
 * The whole group's activity, newest first: questions and notices sent, rounds
 * added, results posted, comments, and courtroom trials. Read-only history that
 * everyone can browse, so a missed push is never lost for good.
 */
export async function getActivityFeed(playerId: string): Promise<Activity> {
  const supabase = await createClient();

  const [
    { data: broadcasts },
    { data: responses },
    { data: trials },
    { data: comps },
    { data: comments },
    { data: scores },
    { data: profiles },
    { data: settings },
  ] = await Promise.all([
    supabase.from("broadcasts").select("*").order("created_at", { ascending: false }),
    supabase.from("broadcast_responses").select("*"),
    supabase.from("trials").select("*"),
    supabase.from("competitions").select("*"),
    supabase.from("comments").select("*").order("created_at", { ascending: false }).limit(60),
    supabase.from("scores").select("competition_id, updated_at"),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("app_settings").select("activity_cleared_before").eq("id", 1).maybeSingle(),
  ]);

  const clearedBefore =
    (settings as { activity_cleared_before: string | null } | null)?.activity_cleared_before ??
    null;
  const clearedMs = clearedBefore ? new Date(clearedBefore).getTime() : 0;

  const allProfiles = (profiles ?? []) as Profile[];
  const nameById = new Map(allProfiles.map((p) => [p.id, p.name]));
  const compById = new Map(((comps ?? []) as Competition[]).map((c) => [c.id, c]));

  const respByBroadcast = new Map<string, BroadcastResponse[]>();
  for (const r of (responses ?? []) as BroadcastResponse[]) {
    const list = respByBroadcast.get(r.broadcast_id) ?? [];
    list.push(r);
    respByBroadcast.set(r.broadcast_id, list);
  }

  // Latest score edit per competition — the moment a result went up.
  const resultAt = new Map<string, string>();
  for (const s of (scores ?? []) as Pick<Score, "competition_id" | "updated_at">[]) {
    const prev = resultAt.get(s.competition_id);
    if (!prev || s.updated_at > prev) resultAt.set(s.competition_id, s.updated_at);
  }

  const items: ActivityItem[] = [];

  for (const b of (broadcasts ?? []) as Broadcast[]) {
    const rs = respByBroadcast.get(b.id) ?? [];
    items.push({
      kind: "broadcast",
      at: b.created_at,
      broadcast: b,
      responses: rs,
      answered: rs.some((r) => r.player_id === playerId),
    });
  }

  for (const t of (trials ?? []) as Trial[]) {
    items.push({ kind: "trial", at: t.created_at, trial: t });
  }

  for (const c of (comps ?? []) as Competition[]) {
    items.push({ kind: "round", at: c.created_at, comp: c });
    const at = resultAt.get(c.id);
    if (c.status === "played" && at) {
      items.push({ kind: "result", at, comp: c });
    }
  }

  for (const c of (comments ?? []) as Comment[]) {
    const comp = compById.get(c.competition_id);
    if (!comp) continue;
    items.push({
      kind: "comment",
      at: c.created_at,
      comment: c,
      comp,
      authorName: (c.author_id && nameById.get(c.author_id)) || "Someone",
    });
  }

  const visible = clearedMs
    ? items.filter((i) => new Date(i.at).getTime() > clearedMs)
    : items;
  visible.sort((a, z) => (a.at < z.at ? 1 : -1));

  return {
    items: visible,
    profiles: allProfiles,
    totalPlayers: allProfiles.length,
    clearedBefore,
  };
}

export async function getCompetition(id: string): Promise<Competition | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", id)
    .single();
  return (data as Competition) ?? null;
}

export async function getProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as Profile[];
}

export type LastRound = {
  compId: string;
  course: string;
  date: string;
  toPar: number | null;
};

export type PlayerRecord = {
  profile: Profile;
  played: number; // non-cancelled games this player committed to
  warnings: number;
  strikes: number;
  notes: { id: string; note: string; created_at: string }[];
  serviceRecord: Service;
  lastRounds: LastRound[];
  photos: PhotoWithUrl[];
};

export async function getPlayerRecord(id: string): Promise<PlayerRecord | null> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (!profile) return null;

  const [
    { data: comps },
    { data: scores },
    { data: photoRows },
    { data: myRsvps },
    { data: myWarnings },
    { data: myStrikes },
    { data: myNotes },
  ] = await Promise.all([
    supabase.from("competitions").select("*"),
    supabase.from("scores").select("*"),
    supabase.from("photos").select("*").eq("uploader_id", id).order("created_at", { ascending: false }),
    supabase.from("rsvps").select("competition_id, status, attended").eq("player_id", id),
    supabase.from("warnings").select("id").eq("player_id", id),
    supabase.from("strikes").select("id").eq("player_id", id),
    supabase
      .from("player_notes")
      .select("id, note, created_at")
      .eq("player_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const { toPar } = await import("@/lib/scoring");
  const compById = new Map(((comps ?? []) as Competition[]).map((c) => [c.id, c]));

  // Played = games in the calendar that weren't cancelled and this player
  // committed to (roll call: in).
  const myRsvpRows = (myRsvps ?? []) as { competition_id: string; status: string; attended: boolean | null }[];
  const played = myRsvpRows.filter((r) => {
    const c = compById.get(r.competition_id);
    return c && c.status !== "cancelled" && r.status === "in";
  }).length;
  const serviceRecord = computeService(myRsvpRows, (comps ?? []) as Competition[]);
  const warnings = (myWarnings ?? []).length;
  const strikes = (myStrikes ?? []).length;
  const notes = (myNotes ?? []) as { id: string; note: string; created_at: string }[];
  const lastRounds: LastRound[] = [];
  for (const s of (scores ?? []) as Score[]) {
    if (s.player_id !== id) continue;
    const c = compById.get(s.competition_id);
    if (!c || c.status !== "played") continue;
    const par = c.par ?? Array(c.holes).fill(4);
    lastRounds.push({
      compId: c.id,
      course: c.course ?? "",
      date: c.date,
      toPar: toPar(s.strokes, par),
    });
  }
  lastRounds.sort((a, b) => (a.date < b.date ? 1 : -1));
  lastRounds.splice(5);

  const rows = (photoRows ?? []) as Photo[];
  let photos: PhotoWithUrl[] = [];
  if (rows.length > 0) {
    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrls(rows.map((p) => p.storage_path), 60 * 60);
    photos = rows.map((p, i) => ({ ...p, url: signed?.[i]?.signedUrl ?? "" }));
  }

  return {
    profile: profile as Profile,
    played,
    warnings,
    strikes,
    notes,
    serviceRecord,
    lastRounds,
    photos,
  };
}

/** Service-record roster — each member's participation (Operations · games ·
 *  hours). Participation, not a ranking. */
export async function getServiceRoster(): Promise<{ profile: Profile; service: Service }[]> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: comps }, { data: rsvps }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("competitions").select("*"),
    supabase.from("rsvps").select("competition_id, player_id, attended"),
  ]);
  const allComps = (comps ?? []) as Competition[];
  const byPlayer = new Map<string, { competition_id: string; attended: boolean | null }[]>();
  for (const r of (rsvps ?? []) as { competition_id: string; player_id: string; attended: boolean | null }[]) {
    const arr = byPlayer.get(r.player_id) ?? [];
    arr.push(r);
    byPlayer.set(r.player_id, arr);
  }
  return ((profiles ?? []) as Profile[]).map((p) => ({
    profile: p,
    service: computeService(byPlayer.get(p.id) ?? [], allComps),
  }));
}

export type SquadView = {
  squad: Squad;
  members: { profile: Profile; is_captain: boolean }[];
  captainId: string | null;
  mine: boolean;
};

/** Every squad in the caller's Barracks, with members + captain. */
export async function getSquads(currentUserId: string): Promise<SquadView[]> {
  const supabase = await createClient();
  const [{ data: squads }, { data: members }, { data: profiles }] = await Promise.all([
    supabase.from("squads").select("*").order("created_at", { ascending: true }),
    supabase.from("squad_members").select("*"),
    supabase.from("profiles").select("*"),
  ]);
  const profById = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));
  const bySquad = new Map<string, SquadMember[]>();
  for (const m of (members ?? []) as SquadMember[]) {
    const arr = bySquad.get(m.squad_id) ?? [];
    arr.push(m);
    bySquad.set(m.squad_id, arr);
  }
  return ((squads ?? []) as Squad[]).map((sq) => {
    const mems = bySquad.get(sq.id) ?? [];
    const captain = mems.find((m) => m.is_captain);
    return {
      squad: sq,
      members: mems
        .map((m) => ({ profile: profById.get(m.user_id), is_captain: m.is_captain }))
        .filter((x): x is { profile: Profile; is_captain: boolean } => x.profile != null),
      captainId: captain?.user_id ?? null,
      mine: mems.some((m) => m.user_id === currentUserId),
    };
  });
}

export type SquadRequestView = SquadRequest & { requester: Profile | null };

/** Open squad requests awaiting the President's approval. */
export async function getSquadRequests(): Promise<SquadRequestView[]> {
  const supabase = await createClient();
  const [{ data: reqs }, { data: profiles }] = await Promise.all([
    supabase.from("squad_requests").select("*").eq("status", "open").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
  ]);
  const byId = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));
  return ((reqs ?? []) as SquadRequest[]).map((r) => ({
    ...r,
    requester: r.requested_by ? byId.get(r.requested_by) ?? null : null,
  }));
}

export type CompetitionDetail = {
  comp: Competition;
  profiles: Profile[];
  rsvps: RsvpWithPlayer[];
  scores: Score[];
  results: Result[];
  comments: Comment[];
  photos: PhotoWithUrl[];
};

export async function getCompetitionDetail(
  id: string,
): Promise<CompetitionDetail | null> {
  const supabase = await createClient();

  const { data: comp } = await supabase
    .from("competitions")
    .select("*")
    .eq("id", id)
    .single();
  if (!comp) return null;

  const [
    { data: profiles },
    { data: rsvps },
    { data: scores },
    { data: resultRows },
    { data: comments },
    { data: photos },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("rsvps").select("*").eq("competition_id", id),
    supabase.from("scores").select("*").eq("competition_id", id),
    supabase.from("results").select("*").eq("competition_id", id),
    supabase.from("comments").select("*").eq("competition_id", id).order("created_at", { ascending: true }),
    supabase.from("photos").select("*").eq("competition_id", id).order("created_at", { ascending: false }),
  ]);

  const allProfiles = (profiles ?? []) as Profile[];
  const profileById = new Map(allProfiles.map((p) => [p.id, p]));

  // Sign the photo URLs (private bucket, §3).
  const photoRows = (photos ?? []) as Photo[];
  let photosWithUrl: PhotoWithUrl[] = [];
  if (photoRows.length > 0) {
    const { data: signed } = await supabase.storage
      .from("photos")
      .createSignedUrls(
        photoRows.map((p) => p.storage_path),
        60 * 60,
      );
    photosWithUrl = photoRows.map((p, i) => ({
      ...p,
      url: signed?.[i]?.signedUrl ?? "",
    }));
  }

  return {
    comp: comp as Competition,
    profiles: allProfiles,
    rsvps: ((rsvps ?? []) as Rsvp[]).map((r) => ({
      ...r,
      player: profileById.get(r.player_id) ?? null,
    })),
    scores: (scores ?? []) as Score[],
    results: (resultRows ?? []) as Result[],
    comments: (comments ?? []) as Comment[],
    photos: photosWithUrl,
  };
}

/** The Barracks leaderboard — computed from results across all fixtures the
 *  caller can see (RLS scopes it to their group). */
export async function getRankings(): Promise<RankRow[]> {
  const supabase = await createClient();
  const [{ data: resultRows }, { data: comps }, { data: profiles }] = await Promise.all([
    supabase.from("results").select("*"),
    supabase.from("competitions").select("*"),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
  ]);
  return computeRankings(
    (resultRows ?? []) as Result[],
    (comps ?? []) as Competition[],
    (profiles ?? []) as Profile[],
  );
}
