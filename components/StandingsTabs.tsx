"use client";

import { useState } from "react";
import { StandingsTable } from "@/components/StandingsTable";
import type { Standings } from "@/lib/standings";

// Two views: the ranked Threeball Cup, and casual (non-competition) rounds.
export function StandingsTabs({
  cup,
  casual,
  strikeCount,
}: {
  cup: Standings;
  casual: Standings;
  strikeCount: Record<string, number>;
}) {
  const [tab, setTab] = useState<"cup" | "casual">("cup");

  return (
    <div>
      <div className="mb-5 flex border-b border-rule">
        {([
          { key: "cup", label: "The Threeball Cup" },
          { key: "casual", label: "Casual rounds" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 border-b-2 pb-2 pt-1 font-narrow text-sm font-semibold uppercase tracking-[0.06em]"
            style={{
              borderColor: tab === t.key ? "var(--color-ink)" : "transparent",
              color: tab === t.key ? "var(--color-ink)" : "var(--color-ink-soft)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cup" ? (
        <StandingsTable
          rows={cup.rows}
          stats={cup.stats}
          strikeCount={strikeCount}
          showStrikes
          emptyText="No cup rounds played yet. The trophy awaits."
        />
      ) : (
        <StandingsTable
          rows={casual.rows}
          stats={casual.stats}
          emptyText="No casual rounds yet."
        />
      )}
    </div>
  );
}
