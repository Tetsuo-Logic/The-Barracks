import { Avatar } from "@/components/Avatar";
import type { RankRow } from "@/lib/rankings";

// The Barracks leaderboard: Played · Wins · Win% · Streak. Ranked by wins,
// tie-broken on win% — a win is a win.
export function RankingsTable({ rows }: { rows: RankRow[] }) {
  const ranked = rows.filter((r) => r.played > 0);
  if (ranked.length === 0) {
    return (
      <p className="py-12 text-center text-ink-soft">
        No results logged yet. Play something and record the result. 🎮
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[3px] border border-rule">
      <div className="grid grid-cols-[1.8fr_repeat(4,1fr)] bg-[rgba(22,36,27,0.03)] px-3 py-2">
        <span className="label">Player</span>
        <span className="label text-right">Pld</span>
        <span className="label text-right">Won</span>
        <span className="label text-right">Win%</span>
        <span className="label text-right">Streak</span>
      </div>
      {ranked.map((r) => (
        <div
          key={r.player.id}
          className="grid grid-cols-[1.8fr_repeat(4,1fr)] items-center border-t border-rule px-3 py-2.5"
          style={{ borderLeft: r.isChampion ? "3px solid var(--color-sand)" : "3px solid transparent" }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={r.player.name} avatarUrl={r.player.avatar_url} colour={r.player.colour} size={22} />
            <span className="truncate text-ink">{r.player.name}</span>
            {r.isChampion && <span title="Current champion">🏆</span>}
          </span>
          <span className="text-right font-narrow tabular-nums text-ink">{r.played}</span>
          <span className="text-right font-narrow tabular-nums text-ink">{r.wins}</span>
          <span className="text-right font-narrow tabular-nums text-ink">{r.winPct}%</span>
          <span
            className="text-right font-narrow font-semibold tabular-nums"
            style={{
              color: r.streak.startsWith("W")
                ? "var(--color-moss)"
                : r.streak.startsWith("L")
                  ? "var(--color-flag)"
                  : "var(--color-ink-soft)",
            }}
          >
            {r.streak}
          </span>
        </div>
      ))}
    </div>
  );
}
