import { Avatar } from "@/components/Avatar";
import type { StandingRow, DerivedStat } from "@/lib/standings";

// Presentational season table + derived stats. Strikes (public shame) are only
// shown on the cup table.
export function StandingsTable({
  rows,
  stats,
  strikeCount = {},
  showStrikes = false,
  emptyText,
}: {
  rows: StandingRow[];
  stats: DerivedStat[];
  strikeCount?: Record<string, number>;
  showStrikes?: boolean;
  emptyText: string;
}) {
  const anyPlayed = rows.some((r) => r.played > 0);
  if (!anyPlayed) {
    return <p className="py-12 text-center text-ink-soft">{emptyText}</p>;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-[3px] border border-rule">
        <div className="grid grid-cols-[1.6fr_repeat(4,1fr)] bg-[rgba(22,36,27,0.03)] px-3 py-2">
          <span className="label">Player</span>
          <span className="label text-right">Pld</span>
          <span className="label text-right">Won</span>
          <span className="label text-right">Skins</span>
          <span className="label text-right">Avg</span>
        </div>
        {rows.map((r, i) => {
          const leader = i === 0 && r.wins > 0;
          const strikes = strikeCount[r.player.id] ?? 0;
          return (
            <div
              key={r.player.id}
              className="grid grid-cols-[1.6fr_repeat(4,1fr)] items-center border-t border-rule px-3 py-2.5"
              style={{ borderLeft: leader ? "3px solid var(--color-sand)" : "3px solid transparent" }}
            >
              <span className="flex items-center gap-2">
                <Avatar name={r.player.name} avatarUrl={r.player.avatar_url} colour={r.player.colour} size={22} />
                <span className="truncate text-ink">{r.player.name}</span>
                {leader && <span title="Leader">🏆</span>}
                {showStrikes && strikes > 0 && (
                  <span className="font-narrow text-xs font-bold text-flag" title={`${strikes} strikes`}>
                    {"✕".repeat(Math.min(3, strikes))}
                    {strikes > 3 ? strikes : ""}
                  </span>
                )}
              </span>
              <span className="text-right font-narrow tabular-nums text-ink">{r.played}</span>
              <span className="text-right font-narrow tabular-nums text-ink">{r.wins}</span>
              <span className="text-right font-narrow tabular-nums text-ink">{r.skins}</span>
              <span className="text-right font-narrow tabular-nums text-ink-soft">
                {r.avgPerHole ? r.avgPerHole.toFixed(1) : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {stats.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between border-b border-rule py-2">
              <span className="label">{s.label}</span>
              <span className="flex items-center gap-2">
                {s.player && (
                  <span className="font-narrow text-sm font-semibold uppercase tracking-[0.06em] text-ink">
                    {(s.player.nickname ?? s.player.name).toUpperCase()}
                  </span>
                )}
                <span className="font-narrow font-bold tabular-nums text-ink">{s.value}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
