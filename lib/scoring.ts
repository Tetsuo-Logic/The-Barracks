// Scoring — computed client-side from the `strokes` arrays, never stored (§9).
// Change the rules here without a migration.

import type { Competition, Profile, Score } from "@/lib/types";

export type PlayerScore = { player: Profile; strokes: (number | null)[] };

// ── Totals ──────────────────────────────────────────────────────────────────

/** Sum of played holes (nulls skipped). */
export function total(strokes: (number | null)[]): number {
  return strokes.reduce<number>((s, v) => s + (v ?? 0), 0);
}

/** OUT (1–9), IN (10–18), TOT for a strokes array. */
export function splits(strokes: (number | null)[]) {
  const out = total(strokes.slice(0, 9));
  const inn = total(strokes.slice(9, 18));
  return { out, in: inn, tot: out + inn };
}

export function parTotal(par: number[] | null, holes: number): number {
  if (par && par.length >= holes) return total(par.slice(0, holes));
  return holes * 4;
}

/** Signed over/under par across played holes only. */
export function toPar(strokes: (number | null)[], par: number[]): number {
  let diff = 0;
  strokes.forEach((s, i) => {
    if (s != null && par[i] != null) diff += s - par[i];
  });
  return diff;
}

export function formatToPar(diff: number): string {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// ── Score-to-par label per hole (for the grid conventions §4.4) ───────────────

export type HoleMark = "eagle" | "birdie" | "par" | "bogey" | "double" | "none";

export function holeMark(stroke: number | null, par: number | null): HoleMark {
  if (stroke == null || par == null) return "none";
  const d = stroke - par;
  if (d <= -2) return "eagle";
  if (d === -1) return "birdie";
  if (d === 0) return "par";
  if (d === 1) return "bogey";
  return "double"; // +2 or worse
}

// ── Skins with carries (§9) ───────────────────────────────────────────────────

export type SkinHole = {
  hole: number; // 1-based
  winnerId: string | null; // null = tied/carried, or not all scored
  pot: number; // skins at stake on this hole (1 + carry)
  carried: boolean; // tied → rolled forward
  voided: boolean; // final hole tied → carried skins lost
};

export type SkinsResult = {
  holes: SkinHole[];
  byPlayer: Record<string, number>; // playerId → skins won
  carry: number; // skins currently carrying (live, mid-round)
};

export function computeSkins(
  players: PlayerScore[],
  holes: number,
): SkinsResult {
  const byPlayer: Record<string, number> = {};
  players.forEach((p) => (byPlayer[p.player.id] = 0));
  const result: SkinHole[] = [];
  let carry = 0;

  for (let h = 0; h < holes; h++) {
    const scored = players
      .map((p) => ({ id: p.player.id, s: p.strokes[h] }))
      .filter((x): x is { id: string; s: number } => x.s != null);

    // Not everyone has posted this hole yet — leave it open.
    if (scored.length < players.length) {
      result.push({ hole: h + 1, winnerId: null, pot: 1 + carry, carried: false, voided: false });
      continue;
    }

    const min = Math.min(...scored.map((x) => x.s));
    const winners = scored.filter((x) => x.s === min);
    const pot = 1 + carry;

    if (winners.length === 1) {
      byPlayer[winners[0].id] += pot;
      carry = 0;
      result.push({ hole: h + 1, winnerId: winners[0].id, pot, carried: false, voided: false });
    } else {
      // Tie — carries, unless it's the final hole (then those skins void).
      const isLast = h === holes - 1;
      carry = isLast ? 0 : pot;
      result.push({
        hole: h + 1,
        winnerId: null,
        pot,
        carried: !isLast,
        voided: isLast,
      });
    }
  }

  return { holes: result, byPlayer, carry };
}

// ── Stableford (§9) ───────────────────────────────────────────────────────────

/** Strokes a player receives on each hole from playing handicap + stroke index. */
export function strokesReceived(
  handicap: number,
  strokeIndex: number[],
  holes: number,
): number[] {
  const hc = Math.round(handicap);
  const received = Array<number>(holes).fill(0);
  if (!strokeIndex || strokeIndex.length < holes) return received;
  for (let i = 0; i < holes; i++) {
    const si = strokeIndex[i];
    if (!si) continue;
    let strokes = 0;
    if (si <= hc) strokes += 1;
    if (si <= hc - 18) strokes += 1; // second pass for high handicaps
    received[i] = strokes;
  }
  return received;
}

export function stablefordPoints(
  strokes: (number | null)[],
  par: number[],
  handicap: number,
  strokeIndex: number[],
  holes: number,
): { perHole: number[]; total: number } {
  const recv = strokesReceived(handicap, strokeIndex, holes);
  const perHole: number[] = [];
  let sum = 0;
  for (let i = 0; i < holes; i++) {
    const s = strokes[i];
    if (s == null || par[i] == null) {
      perHole.push(0);
      continue;
    }
    const net = s - recv[i];
    const pts = Math.max(0, 2 + (par[i] - net));
    perHole.push(pts);
    sum += pts;
  }
  return { perHole, total: sum };
}

// ── Assemble the played players for a competition ─────────────────────────────

export function playerScores(
  comp: Competition,
  profiles: Profile[],
  scores: Score[],
): PlayerScore[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return scores
    .map((sc) => {
      const player = byId.get(sc.player_id);
      if (!player) return null;
      return { player, strokes: sc.strokes };
    })
    .filter((x): x is PlayerScore => x !== null);
}

export type WinnerLine = { player: Profile; detail: string };

/** One-line result for the Recent list / result push, per format. */
export function resultSummary(
  comp: Competition,
  players: PlayerScore[],
): WinnerLine | null {
  if (players.length === 0) return null;
  const par = comp.par ?? Array(comp.holes).fill(4);

  if (comp.format === "skins") {
    const { byPlayer } = computeSkins(players, comp.holes);
    const ranked = players
      .map((p) => ({ p, skins: byPlayer[p.player.id] ?? 0 }))
      .sort((a, b) => b.skins - a.skins);
    if (ranked[0].skins === 0) return null;
    return {
      player: ranked[0].p.player,
      detail: `${ranked[0].skins} skin${ranked[0].skins === 1 ? "" : "s"}`,
    };
  }

  if (comp.format === "stableford") {
    const si = comp.stroke_index ?? [];
    const ranked = players
      .map((p) => ({
        p,
        pts: stablefordPoints(p.strokes, par, p.player.handicap ?? 0, si, comp.holes).total,
      }))
      .sort((a, b) => b.pts - a.pts);
    return { player: ranked[0].p.player, detail: `${ranked[0].pts} pts` };
  }

  // stroke — lowest gross wins
  const ranked = players
    .map((p) => ({ p, tot: splits(p.strokes).tot }))
    .sort((a, b) => a.tot - b.tot);
  return { player: ranked[0].p.player, detail: `${ranked[0].tot}` };
}
