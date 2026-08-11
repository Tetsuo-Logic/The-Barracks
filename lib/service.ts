import type { Competition, Rsvp } from "@/lib/domain";

// A member's Service Record — participation history, NOT a ranking. Built from
// attended Operations only. "A win is a win" was retired; this is "did you show
// up and put the hours in".
export type Service = {
  operations: number; // Operations actually attended
  games: number; // games/rounds across those Operations
  hours: number; // hours deployed (1 dp)
  noShows: number; // said in, didn't turn up
};

export function computeService(
  rsvps: Pick<Rsvp, "competition_id" | "attended">[],
  comps: Competition[],
): Service {
  const byId = new Map(comps.map((c) => [c.id, c]));
  let operations = 0;
  let games = 0;
  let mins = 0;
  let noShows = 0;

  for (const r of rsvps) {
    const c = byId.get(r.competition_id);
    if (!c || c.status === "cancelled") continue;
    if (r.attended === true) {
      operations++;
      games += c.games_count ?? 0;
      if (c.started_at && c.finished_at) {
        mins += Math.max(0, (new Date(c.finished_at).getTime() - new Date(c.started_at).getTime()) / 60000);
      }
    } else if (r.attended === false) {
      noShows++;
    }
  }

  return { operations, games, hours: Math.round((mins / 60) * 10) / 10, noShows };
}
