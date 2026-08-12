import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getHqOverview, getCourtData } from "@/lib/hq/overview";
import { getRadar, getRankings } from "@/lib/queries";
import { gameById, compHeading } from "@/lib/games";
import { heroDate, shortDate, shortTime, parseDate, todayISO } from "@/lib/dates";
import { TvDeck, type TvData } from "@/components/hq/tv/TvDeck";
import type { Competition, Profile, Result, Rsvp } from "@/lib/types";

export const metadata = { title: "Barracks TV" };

// BARRACKS TV — the second-screen display. Same domain layer as everything
// else; the only job here is to reduce it to the handful of facts that read
// across a room, and hand them to the deck.
export default async function TvPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [o, radar, court, table, { data: liveRows }, { data: resultRows }, { data: rsvpRows }] =
    await Promise.all([
      getHqOverview(profile),
      getRadar(profile.id),
      getCourtData(),
      getRankings(),
      supabase
        .from("competitions")
        .select("*")
        .not("started_at", "is", null)
        .is("finished_at", null)
        .order("started_at", { ascending: false })
        .limit(1),
      supabase.from("results").select("*"),
      supabase.from("rsvps").select("*"),
    ]);

  const nameById = new Map(o.profiles.map((p: Profile) => [p.id, p.nickname || p.name]));
  const today = todayISO();
  const daysFrom = (iso: string) =>
    Math.round((parseDate(iso).getTime() - parseDate(today).getTime()) / 86_400_000);

  // ── Next operation ──────────────────────────────────────────────────────
  const n = o.next;
  const nextGame = n ? gameById(n.game) : null;
  const nextSquad = n?.squad_id ? o.squads.find((s) => s.squad.id === n.squad_id) ?? null : null;
  const next: TvData["next"] = n
    ? {
        iso: `${n.date}T${(n.tee_time ?? "20:00:00").slice(0, 8)}`,
        ...heroDate(n.date),
        title: compHeading(n),
        game: nextGame!.name,
        emoji: nextGame!.emoji,
        time: shortTime(n.tee_time),
        stake: n.stake,
        forCup: n.for_cup,
        squad: nextSquad ? nextSquad.squad.name || gameById(nextSquad.squad.game).name : null,
        in: o.nextRsvps.in,
        maybe: o.nextRsvps.maybe,
        out: o.nextRsvps.out,
        silent: o.nextRsvps.undecided,
        total: o.profiles.length,
      }
    : null;

  // ── Live operation ──────────────────────────────────────────────────────
  const liveComp = ((liveRows ?? []) as Competition[])[0] ?? null;
  const allRsvps = (rsvpRows ?? []) as Rsvp[];
  const live: TvData["live"] = liveComp
    ? {
        title: compHeading(liveComp),
        emoji: gameById(liveComp.game).emoji,
        startedAt: liveComp.started_at!,
        games: liveComp.games_count,
        roster: allRsvps
          .filter((r) => r.competition_id === liveComp.id && r.status === "in")
          .map((r) => nameById.get(r.player_id) ?? "Operative"),
      }
    : null;

  // ── Squads ──────────────────────────────────────────────────────────────
  const squads: TvData["squads"] = o.squads.map((s) => {
    const g = gameById(s.squad.game);
    const status = s.muster?.muster.status ?? null;
    const state =
      status === "open"
        ? "Muster open"
        : status === "proposed"
          ? "Night proposed"
          : s.nightRequests.length > 0
            ? "Night wanted"
            : "Standing by";
    return {
      name: s.squad.name || g.name,
      emoji: g.emoji,
      tag: s.squad.clan_tag,
      captain: s.members.find((m) => m.is_captain)?.profile.name ?? null,
      members: s.members.length,
      state,
      tone: (status === "open" ? "live" : status === "proposed" ? "warn" : s.nightRequests.length > 0 ? "alert" : "idle") as
        | "live"
        | "warn"
        | "idle"
        | "alert",
    };
  });

  // ── Radar ───────────────────────────────────────────────────────────────
  const dated = radar.items.filter((r) => r.release_date);
  const head = dated[0] ?? radar.items[0] ?? null;
  const headDays = head?.release_date ? daysFrom(head.release_date) : null;
  const radarCard: TvData["radar"] = head
    ? {
        title: head.title,
        platform: head.platform,
        release: head.release_date ? shortDate(head.release_date) : null,
        releaseLabel:
          headDays == null
            ? "No date set"
            : headDays < 0
              ? "Already out"
              : headDays === 0
                ? "Releases today"
                : `Releases in ${headDays} day${headDays === 1 ? "" : "s"}`,
        days: headDays,
        yes: head.yes,
        total: radar.totalPlayers,
        queue: radar.items
          .filter((r) => r.id !== head.id)
          .slice(0, 3)
          .map((r) => {
            const dd = r.release_date ? daysFrom(r.release_date) : null;
            return {
              title: r.title,
              label: dd == null ? "TBD" : dd < 0 ? "Out" : `${dd}d`,
            };
          }),
      }
    : null;

  // ── Latest result ───────────────────────────────────────────────────────
  const results = (resultRows ?? []) as Result[];
  const played = o.recent.filter((c) => c.status === "played");
  const withResults = played.find((c) => results.some((r) => r.competition_id === c.id)) ?? played[0] ?? null;
  const resultCard: TvData["result"] = withResults
    ? (() => {
        const mine = results
          .filter((r) => r.competition_id === withResults.id)
          .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99));
        return {
          title: compHeading(withResults),
          emoji: gameById(withResults.game).emoji,
          ...heroDate(withResults.date),
          winner: mine.find((r) => r.placement === 1)
            ? nameById.get(mine.find((r) => r.placement === 1)!.player_id) ?? null
            : null,
          places: mine.map((r) => ({
            name: nameById.get(r.player_id) ?? "Operative",
            place: r.placement,
            score: r.score,
          })),
        };
      })()
    : null;

  // ── Court ───────────────────────────────────────────────────────────────
  const openComplaints = court.complaints.filter((c) => c.status === "open");
  const openTrials = court.trials.filter((t) => t.status === "open");
  const liveMutinies = court.mutinies.filter((m) => m.status === "voting");
  const openTotal = openComplaints.length + openTrials.length + liveMutinies.length;
  const courtName = (id: string | null) => (id ? nameById.get(id) ?? "Operative" : "Unknown");

  const courtLines: TvData["court"]["lines"] = [
    ...liveMutinies.map((m) => ({
      text: `Motion against the President — raised by ${courtName(m.raised_by)}`,
      tone: "alert" as const,
    })),
    ...openTrials.map((t) => ({
      text: `Trial — ${courtName(t.defendant_id)} · ${t.charge}`,
      tone: "alert" as const,
    })),
    ...openComplaints.map((c) => ({
      text: `Complaint — ${courtName(c.filed_by)} v ${courtName(c.against_id)} · ${c.reason}`,
      tone: "warn" as const,
    })),
  ];

  if (courtLines.length === 0) {
    const lastTrial = court.trials[0];
    if (lastTrial) {
      courtLines.push({
        text: `Last verdict — ${courtName(lastTrial.defendant_id)} · ${(lastTrial.verdict ?? "unrecorded").replace("_", " ")}`,
        tone: "info",
      });
    }
  }

  const courtCard: TvData["court"] = {
    headline: openTotal > 0 ? `${openTotal} case${openTotal === 1 ? "" : "s"} open` : "No cases pending",
    sub: openTotal > 0 ? "The Court is in session" : "A peaceful reign",
    open: openTotal,
    lines: courtLines,
  };

  // ── Leadership ──────────────────────────────────────────────────────────
  const leadership: TvData["leadership"] = {
    president: o.president?.name ?? null,
    captains: o.captains.map((c) => ({ squad: c.squad, name: c.captain?.name ?? null })),
    table: table
      .filter((r) => r.played > 0)
      .slice(0, 5)
      .map((r) => ({
        name: r.player.name,
        wins: r.wins,
        played: r.played,
        winPct: r.winPct,
        streak: r.streak,
        champion: r.isChampion,
      })),
  };

  const data: TvData = {
    barracks: "The Barracks",
    operatives: o.status.operatives,
    online: o.status.online,
    operationsRun: o.status.operationsRun,
    hoursDeployed: o.status.hoursDeployed,
    tonight: o.status.operationsTonight,
    next,
    live,
    squads,
    radar: radarCard,
    result: resultCard,
    court: courtCard,
    leadership,
    ticker: o.feed.length
      ? o.feed.map((f) => f.text)
      : ["BARRACKS ONLINE", "NO RECENT ACTIVITY", "SYSTEM NOMINAL"],
  };

  return <TvDeck data={data} />;
}
