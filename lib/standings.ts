// Season standings — all derived from played competitions + strokes (§5, §9).
import {
  computeSkins,
  holeMark,
  playerScores,
  resultSummary,
  splits,
  toPar,
} from "@/lib/scoring";
import type { Competition, Profile, Score } from "@/lib/types";

export type StandingRow = {
  player: Profile;
  played: number;
  wins: number;
  skins: number;
  avgPerHole: number | null; // normalises 9 vs 18
  bestToPar: number | null; // lowest round vs par
};

export type DerivedStat = { label: string; value: string; player?: Profile };

export type Standings = {
  rows: StandingRow[];
  stats: DerivedStat[];
};

export function computeStandings(
  competitions: Competition[],
  profiles: Profile[],
  scores: Score[],
): Standings {
  const played = competitions.filter((c) => c.status === "played");
  const scoresByComp = new Map<string, Score[]>();
  for (const s of scores) {
    (scoresByComp.get(s.competition_id) ?? scoresByComp.set(s.competition_id, []).get(s.competition_id)!).push(s);
  }

  const rows: StandingRow[] = profiles.map((p) => ({
    player: p,
    played: 0,
    wins: 0,
    skins: 0,
    avgPerHole: null,
    bestToPar: null,
  }));
  const rowById = new Map(rows.map((r) => [r.player.id, r]));

  let mostBirdies = { player: null as Profile | null, count: 0 };
  const birdieCount = new Map<string, number>();
  const strokeSum = new Map<string, { strokes: number; holes: number }>();

  for (const comp of played) {
    const compScores = scoresByComp.get(comp.id) ?? [];
    const ps = playerScores(comp, profiles, compScores);
    if (ps.length === 0) continue;
    const par = comp.par ?? Array(comp.holes).fill(4);

    // win
    const winner = resultSummary(comp, ps);
    if (winner) rowById.get(winner.player.id)!.wins += 1;

    // skins
    if (comp.format === "skins") {
      const { byPlayer } = computeSkins(ps, comp.holes);
      for (const [id, n] of Object.entries(byPlayer)) {
        const r = rowById.get(id);
        if (r) r.skins += n;
      }
    }

    for (const p of ps) {
      const r = rowById.get(p.player.id);
      if (!r) continue;
      r.played += 1;

      // best to-par
      const tp = toPar(p.strokes, par);
      const playedHoles = p.strokes.filter((s) => s != null).length;
      if (playedHoles === comp.holes) {
        r.bestToPar = r.bestToPar == null ? tp : Math.min(r.bestToPar, tp);
      }

      // strokes for average
      const agg = strokeSum.get(p.player.id) ?? { strokes: 0, holes: 0 };
      agg.strokes += splits(p.strokes).tot;
      agg.holes += playedHoles;
      strokeSum.set(p.player.id, agg);

      // birdies
      let bc = birdieCount.get(p.player.id) ?? 0;
      p.strokes.forEach((s, i) => {
        const m = holeMark(s, par[i]);
        if (m === "birdie" || m === "eagle") bc += 1;
      });
      birdieCount.set(p.player.id, bc);
    }
  }

  for (const r of rows) {
    const agg = strokeSum.get(r.player.id);
    r.avgPerHole = agg && agg.holes > 0 ? agg.strokes / agg.holes : null;
  }

  for (const [id, count] of birdieCount) {
    if (count > mostBirdies.count) {
      mostBirdies = { player: rowById.get(id)?.player ?? null, count };
    }
  }

  // rank: wins, then skins, then avg
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.skins !== a.skins) return b.skins - a.skins;
    return (a.avgPerHole ?? 99) - (b.avgPerHole ?? 99);
  });

  const bestRound = rows
    .filter((r) => r.bestToPar != null)
    .sort((a, b) => (a.bestToPar! - b.bestToPar!))[0];

  const stats: DerivedStat[] = [];
  if (mostBirdies.player) {
    stats.push({ label: "Most birdies", value: `${mostBirdies.count}`, player: mostBirdies.player });
  }
  if (bestRound) {
    stats.push({
      label: "Best round",
      value: bestRound.bestToPar === 0 ? "level par" : formatSigned(bestRound.bestToPar!),
      player: bestRound.player,
    });
  }
  const leader = rows.find((r) => r.played > 0);
  if (leader && leader.wins > 0) {
    stats.push({ label: "Top of the table", value: `${leader.wins} win${leader.wins === 1 ? "" : "s"}`, player: leader.player });
  }

  return { rows, stats: stats.slice(0, 3) };
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
