import type { Competition, Profile, Result } from "@/lib/domain";

// The Barracks table: rank by WINS, tie-break on Win% — never reward whoever
// simply played more. A win = finishing 1st (placement 1). Results only exist
// against real competitions, so rankings only ever come from Barracks fixtures.
export type RankRow = {
  player: Profile;
  played: number;
  wins: number;
  winPct: number; // 0..100
  streak: string; // "W5" / "L2" / "—"
  isChampion: boolean; // current table leader (≥1 win)
};

export function computeRankings(
  results: Result[],
  comps: Competition[],
  profiles: Profile[],
): RankRow[] {
  const compById = new Map(comps.map((c) => [c.id, c]));

  // Ranked results on live (non-cancelled) fixtures only.
  const live = results.filter((r) => {
    if (r.placement == null) return false;
    const c = compById.get(r.competition_id);
    return c != null && c.status !== "cancelled";
  });

  const byPlayer = new Map<string, Result[]>();
  for (const r of live) {
    const arr = byPlayer.get(r.player_id) ?? [];
    arr.push(r);
    byPlayer.set(r.player_id, arr);
  }
  const dateOf = (r: Result) => compById.get(r.competition_id)?.date ?? "";

  const rows: RankRow[] = profiles.map((player) => {
    // Newest fixture first, for the streak read.
    const mine = (byPlayer.get(player.id) ?? [])
      .slice()
      .sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));
    const played = mine.length;
    const wins = mine.filter((r) => r.placement === 1).length;
    const winPct = played ? Math.round((wins / played) * 100) : 0;

    // Current run of the same outcome from the latest fixture.
    let streak = "—";
    if (mine.length) {
      const won = mine[0].placement === 1;
      let n = 0;
      for (const r of mine) {
        if ((r.placement === 1) === won) n++;
        else break;
      }
      streak = `${won ? "W" : "L"}${n}`;
    }

    return { player, played, wins, winPct, streak, isChampion: false };
  });

  // Wins desc → Win% desc → fewer played first (never reward more games).
  rows.sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || a.played - b.played);
  if (rows.length && rows[0].wins > 0) rows[0].isChampion = true;
  return rows;
}
