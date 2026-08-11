import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getRankings } from "@/lib/data/queries";
import { RankingsTable } from "@/components/RankingsTable";
import { ConsoleHeader } from "@/components/ConsoleHeader";

// The Barracks leaderboard — every game, ranked by wins (tie-break win%).
// Reads from `results`, so only recognised fixtures count. Game/squad/season
// filters come later.
export default async function StandingsPage() {
  await requireProfile();
  const rows = await getRankings();

  return (
    <div>
      <ConsoleHeader
        title="Ranks"
        tag="Leaderboard"
        sub="A win is a win"
        right={<Link href="/trial" className="label text-ink-soft">Courtroom →</Link>}
      />

      <RankingsTable rows={rows} />
    </div>
  );
}
