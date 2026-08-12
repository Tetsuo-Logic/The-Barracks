import { STAGES, stageIndex, type ChallengeStage } from "@/lib/hq/future/network";

// The battle lifecycle, drawn as a pipeline. Ten stages, always all ten — the
// point is that you can see where a battle sits and what is still ahead of it.
// Pure presentational: renders identically in a server page or a client console.

function tone(done: boolean, now: boolean): string {
  if (now) return "var(--color-flag)";
  if (done) return "var(--color-moss)";
  return "var(--color-rule)";
}

export function Stepper({
  stage,
  compact = false,
}: {
  stage: ChallengeStage;
  compact?: boolean;
}) {
  const idx = stageIndex(stage);

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex flex-1 items-center gap-[2px]">
          {STAGES.map((s, i) => (
            <span
              key={s.key}
              title={s.label}
              className="h-[3px] flex-1 rounded-[1px]"
              style={{
                backgroundColor: tone(i < idx, i === idx),
                opacity: i === idx ? 1 : i < idx ? 0.85 : 0.55,
              }}
            />
          ))}
        </div>
        <span
          className="hq-mono shrink-0 text-[10px] uppercase tracking-[0.14em]"
          style={{ color: stage === "archived" ? "var(--color-ink-soft)" : "var(--color-flag)" }}
        >
          {STAGES[idx]?.label}
        </span>
      </div>
    );
  }

  return (
    <ol className="flex items-stretch gap-[3px]">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const now = i === idx;
        const c = tone(done, now);
        return (
          <li key={s.key} className="min-w-0 flex-1">
            <div
              className="h-[4px] rounded-[1px]"
              style={{ backgroundColor: c, opacity: now ? 1 : done ? 0.9 : 0.6 }}
            />
            <div className="mt-1.5 flex items-start gap-1">
              {now && (
                <span
                  className="hq-dot hq-dot-live mt-[3px]"
                  style={{ backgroundColor: "var(--color-flag)", boxShadow: "none" }}
                />
              )}
              <span
                className="hq-mono text-[8.5px] font-semibold uppercase leading-[1.25] tracking-[0.1em]"
                style={{
                  color: now
                    ? "var(--color-flag)"
                    : done
                      ? "var(--color-ink)"
                      : "var(--color-ink-soft)",
                  opacity: now || done ? 1 : 0.55,
                }}
              >
                {s.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
