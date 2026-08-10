import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeStandings } from "@/lib/standings";
import { gameHasScorecard } from "@/lib/games";
import { StandingsTabs } from "@/components/StandingsTabs";
import { ConsoleHeader } from "@/components/ConsoleHeader";
import type { Competition, Profile, Score, Strike } from "@/lib/types";

export default async function StandingsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [{ data: comps }, { data: profiles }, { data: scores }, { data: strikeRows }] =
    await Promise.all([
      supabase.from("competitions").select("*"),
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("scores").select("*"),
      supabase.from("strikes").select("*"),
    ]);

  // Standings are golf-only — non-golf ops keep no scorecard.
  const golfComps = ((comps ?? []) as Competition[]).filter((c) =>
    gameHasScorecard(c.game),
  );
  const allProfiles = (profiles ?? []) as Profile[];
  const allScores = (scores ?? []) as Score[];

  const cup = computeStandings(
    golfComps.filter((c) => c.for_cup),
    allProfiles,
    allScores,
  );
  const casual = computeStandings(
    golfComps.filter((c) => !c.for_cup),
    allProfiles,
    allScores,
  );

  const strikeCount: Record<string, number> = {};
  for (const s of (strikeRows ?? []) as Strike[]) {
    strikeCount[s.player_id] = (strikeCount[s.player_id] ?? 0) + 1;
  }

  return (
    <div>
      <ConsoleHeader
        title="Ranks"
        tag="Leaderboard"
        right={<Link href="/trial" className="label text-ink-soft">Courtroom →</Link>}
      />

      <StandingsTabs cup={cup} casual={casual} strikeCount={strikeCount} />
    </div>
  );
}
