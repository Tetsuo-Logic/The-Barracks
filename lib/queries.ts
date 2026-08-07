import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/dates";
import type {
  Comment,
  Competition,
  Photo,
  Profile,
  Rsvp,
  Score,
} from "@/lib/types";
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
  played: number;
  wins: number;
  skins: number;
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

  const [{ data: comps }, { data: profiles }, { data: scores }, { data: photoRows }] =
    await Promise.all([
      supabase.from("competitions").select("*"),
      supabase.from("profiles").select("*"),
      supabase.from("scores").select("*"),
      supabase.from("photos").select("*").eq("uploader_id", id).order("created_at", { ascending: false }),
    ]);

  // Reuse standings maths for the record.
  const { computeStandings } = await import("@/lib/standings");
  const { toPar } = await import("@/lib/scoring");
  const standings = computeStandings(
    (comps ?? []) as Competition[],
    (profiles ?? []) as Profile[],
    (scores ?? []) as Score[],
  );
  const row = standings.rows.find((r) => r.player.id === id);

  const compById = new Map(((comps ?? []) as Competition[]).map((c) => [c.id, c]));
  const lastRounds: LastRound[] = [];
  for (const s of (scores ?? []) as Score[]) {
    if (s.player_id !== id) continue;
    const c = compById.get(s.competition_id);
    if (!c || c.status !== "played") continue;
    const par = c.par ?? Array(c.holes).fill(4);
    lastRounds.push({
      compId: c.id,
      course: c.course,
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
    played: row?.played ?? 0,
    wins: row?.wins ?? 0,
    skins: row?.skins ?? 0,
    lastRounds,
    photos,
  };
}

export type CompetitionDetail = {
  comp: Competition;
  profiles: Profile[];
  rsvps: RsvpWithPlayer[];
  scores: Score[];
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
    { data: comments },
    { data: photos },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("rsvps").select("*").eq("competition_id", id),
    supabase.from("scores").select("*").eq("competition_id", id),
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
    comments: (comments ?? []) as Comment[],
    photos: photosWithUrl,
  };
}
