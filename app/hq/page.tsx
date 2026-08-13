import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getHqOverview } from "@/lib/hq/overview";
import { resolveViewRole, canSee } from "@/lib/hq/role";
import { gameById, compHeading } from "@/lib/games";
import { heroDate, shortTime } from "@/lib/dates";
import { Panel, Dot, Tag, PageHead, Nil } from "@/components/hq/Kit";
import { Countdown } from "@/components/hq/Countdown";
import { GameInsignia } from "@/components/hq/GameInsignia";
import { hqSampleActions, hqSampleWeek } from "@/lib/hq/future/actions";

export const metadata = { title: "Command · Barracks HQ" };

// ── HEADQUARTERS ───────────────────────────────────────────────────────────
// Three things, deliberately. The page answers, in order:
//   WHAT'S NEXT?  →  WHAT DO I NEED TO DO?  →  WHAT ELSE IS COMING?
// Empty space below is intentional — this is not a widget board.

export default async function CommandPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const [profile, sp] = await Promise.all([requireProfile(), searchParams]);
  const o = await getHqOverview(profile);

  // Dev role preview, resolved through the shared helper (lib/hq/role) — the
  // switch itself lives in the shell. A view filter only.
  const view = resolveViewRole(sp.as, o.realRole);
  const isPresident = view === "president";

  // Real work first, then dev-only samples so the panel can be designed against
  // all three roles while the Barracks is quiet. Empty in production.
  const samples = hqSampleActions();
  const actions = [...o.actions, ...samples].filter((a) => canSee(view, a.scope));
  const sampleCount = samples.filter((a) => canSee(view, a.scope)).length;

  const nextGame = o.next ? gameById(o.next.game) : null;
  const nextIso = o.next ? `${o.next.date}T${(o.next.tee_time ?? "20:00:00").slice(0, 8)}` : null;
  const rosterPct = o.profiles.length
    ? Math.round((o.nextRsvps.in / o.profiles.length) * 100)
    : 0;

  return (
    <div>
      <PageHead
        /* Barracks identity, sitting above the page title rather than becoming
           a second one. The flex row is the point: a crest slots in before the
           name and a clan tag after it, without the header changing shape or
           growing a row. Neither is built yet. */
        eyebrow={
          <div className="mb-1 flex items-center gap-2.5">
            {/* Crest slot — user-uploaded or generated, later. */}
            <span
              className="hq-readout text-[15px] font-bold uppercase leading-none tracking-[0.2em]"
              style={{ color: "var(--color-sand)" }}
            >
              {o.barracks.name}
            </span>
            {/* Clan tag slot — e.g. [BRKS] — later. */}
            <span
              aria-hidden
              className="h-px min-w-[28px] flex-1"
              style={{
                background:
                  "linear-gradient(90deg, color-mix(in srgb, var(--color-sand) 45%, transparent), transparent)",
                maxWidth: 220,
              }}
            />
          </div>
        }
        title="Headquarters"
        right={
          <>
            {isPresident && (
              <>
                <Link
                  href="/hq/operations/new"
                  className="hq-label rounded-[3px] px-3 py-2 font-semibold"
                  style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                >
                  + Deploy operation
                </Link>
                <Link
                  href="/hq/comms"
                  className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
                >
                  Send comms
                </Link>
              </>
            )}
          </>
        }
      >
        {o.president ? (
          <>
            Commanded by <span className="text-ink">{o.president.name}</span> ·{" "}
            {o.status.operatives} operatives on strength
          </>
        ) : (
          <>{o.status.operatives} operatives on strength · no President appointed</>
        )}
      </PageHead>

      {/* Standing figures — one quiet line, never competing with the page. */}
      <div className="hq-rise mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-rule py-2.5">
        <span className="hq-label flex items-center gap-1.5" style={{ color: "var(--color-moss)" }}>
          <Dot tone="live" pulse />
          System online
        </span>
        <span className="hq-label opacity-30">/</span>
        <span className="hq-label">{o.status.operatives} operatives</span>
        <span className="hq-label opacity-30">/</span>
        <span className="hq-label">{o.status.squadsActive} squads</span>
        <span className="hq-label opacity-30">/</span>
        <span className="hq-label">
          {o.status.operationsRun} operations run · {o.status.hoursDeployed}h deployed
        </span>
        {o.status.operationsTonight > 0 && (
          <span
            className="hq-mono ml-auto rounded-[3px] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ backgroundColor: "var(--color-moss)", color: "#0b100e" }}
          >
            {o.status.operationsTonight} operation tonight
          </span>
        )}
      </div>

      {/* LEFT wider: the night, then the week. RIGHT narrower: the inbox. */}
      {/* items-stretch, not items-start: the inbox is told to fill its cell so
          it bottoms out level with This Week rather than stopping short. */}
      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,1fr)]">
        <div className="flex flex-col gap-5">
          {/* ── TONIGHT / NEXT ─────────────────────────────────────────── */}
          <Panel
            i={0}
            sweep={Boolean(o.next)}
            tier={o.next ? "primary" : "quiet"}
            label={o.status.operationsTonight > 0 ? "Tonight" : "Next deployment"}
            status={
              <Dot
                tone={o.status.operationsTonight > 0 ? "live" : "idle"}
                pulse={o.status.operationsTonight > 0}
              />
            }
            right={
              o.next && (
                <Link href={`/hq/operations/${o.next.id}`} className="hq-label hover:text-ink">
                  Open room →
                </Link>
              )
            }
          >
            {o.next && nextIso ? (
              /* Departure board: identity on the left, the clock dominating the
                 right, and the roster reading full width beneath both. */
              <div className="flex flex-col justify-center gap-6 py-5" style={{ minHeight: 290 }}>
                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-6">
                  <div className="flex min-w-0 flex-1 items-center gap-7">
                    {/* Date plate — deliberately built, deliberately secondary.
                        Hairline rules and a framed tile give it structure so it
                        reads as issued stock rather than three loose words. */}
                    <div
                      className="shrink-0 text-center"
                      style={{
                        border: "1px solid var(--color-rule)",
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.015)",
                        minWidth: 92,
                      }}
                    >
                      <div
                        className="hq-mono py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-soft"
                        style={{ borderBottom: "1px solid var(--color-rule)" }}
                      >
                        {heroDate(o.next.date).dow}
                      </div>
                      <div
                        className="hq-readout font-bold leading-[0.95] py-1.5"
                        style={{ fontSize: "clamp(46px, 3.6vw, 62px)", color: "var(--color-flag)" }}
                      >
                        {heroDate(o.next.date).day}
                      </div>
                      <div
                        className="hq-mono py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-soft"
                        style={{ borderTop: "1px solid var(--color-rule)" }}
                      >
                        {heroDate(o.next.date).mon}
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-4">
                      <GameInsignia game={o.next.game} size={60} />
                      <div className="min-w-0">
                      <p
                        className="hq-readout font-bold leading-[1.02]"
                        style={{ fontSize: "clamp(38px, 3.2vw, 52px)" }}
                      >
                        {compHeading(o.next)}
                      </p>
                      <p className="hq-mono mt-2 text-[17px] uppercase tracking-[0.12em] text-ink-soft">
                        {nextGame?.name}
                        {o.next.tee_time ? ` · ${shortTime(o.next.tee_time)}` : ""}
                        {o.next.stake ? ` · ${o.next.stake}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Tag tone={o.next.started_at ? "live" : "idle"}>
                          {o.next.finished_at
                            ? "Archived"
                            : o.next.started_at
                              ? "Room live"
                              : "Standing by"}
                        </Tag>
                        {o.next.squad_id && <Tag tone="warn">Squad operation</Tag>}
                      </div>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Countdown
                      iso={nextIso}
                      size="clamp(44px, 4.3vw, 80px)"
                      labelAlign="right"
                    />
                  </div>
                </div>

                <div className="border-t border-rule pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="hq-label">Roster</span>
                    <span className="hq-mono text-[14px]">
                      <span className="font-bold" style={{ color: "var(--color-moss)" }}>
                        {o.nextRsvps.in} in
                      </span>
                      <span className="text-ink-soft">
                        {" "}
                        · {o.nextRsvps.maybe} maybe · {o.nextRsvps.out} out ·{" "}
                        {o.nextRsvps.undecided} silent
                      </span>
                    </span>
                  </div>
                  <div className="hq-meter" style={{ height: 7 }}>
                    <span
                      style={{
                        width: `${rosterPct}%`,
                        backgroundColor:
                          rosterPct >= 60 ? "var(--color-moss)" : "var(--color-sand)",
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="hq-readout text-[20px] font-bold uppercase tracking-[0.04em] text-ink-soft">
                  No operation on the board
                </p>
                {isPresident && (
                  <Link
                    href="/hq/operations/new"
                    className="hq-label mt-4 inline-block rounded-[3px] px-4 py-2.5 font-semibold"
                    style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                  >
                    + Deploy operation
                  </Link>
                )}
              </div>
            )}
          </Panel>

          {/* ── THIS WEEK ──────────────────────────────────────────────── */}
          <Panel
            i={1}
            label="This week"
            right={
              <Link href="/hq/calendar" className="hq-label hover:text-ink">
                Calendar →
              </Link>
            }
          >
            {o.upcoming.length === 0 && !o.next ? (
              <Nil>Nothing scheduled</Nil>
            ) : (
              <div className="flex flex-col">
                {[o.next, ...o.upcoming]
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((c, idx) => {
                    const comp = c!;
                    const g = gameById(comp.game);
                    const hd = heroDate(comp.date);
                    return (
                      <Link
                        key={comp.id}
                        href={`/hq/operations/${comp.id}`}
                        className="flex items-center gap-4 border-b border-rule/60 py-2.5 last:border-0 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                      >
                        <span className="hq-mono w-16 shrink-0 text-[13px] uppercase tracking-[0.08em] text-ink-soft">
                          {hd.dow} {hd.day}
                        </span>
                        <span className="w-6 shrink-0 text-center">{g.emoji}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          {compHeading(comp)}
                        </span>
                        <span className="hq-mono shrink-0 text-[13px] text-ink-soft">
                          {shortTime(comp.tee_time) || "—"}
                        </span>
                        {idx === 0 && <Tag tone="live">Next</Tag>}
                      </Link>
                    );
                  })}

                {/* Dev-only filler so the list can be judged at length. Not
                    links — these operations don't exist. */}
                {hqSampleWeek().map((w) => (
                  <div
                    key={`${w.dow}-${w.title}`}
                    className="flex items-center gap-4 border-b border-rule/60 py-2.5 last:border-0"
                  >
                    <span className="hq-mono w-16 shrink-0 text-[13px] uppercase tracking-[0.08em] text-ink-soft">
                      {w.dow} {w.day}
                    </span>
                    <span className="w-6 shrink-0 text-center">{w.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{w.title}</span>
                    <span className="hq-mono shrink-0 text-[13px] text-ink-soft">{w.time}</span>
                    <span
                      className="hq-mono shrink-0 rounded-[3px] border border-dashed px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]"
                      style={{ borderColor: "#4b5a52", color: "#6d8076" }}
                    >
                      demo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ── ACTION REQUIRED ──────────────────────────────────────────────
            A real inbox, not a status box. Never collapses to nothing: with
            one item it still holds its ground, with none it says ALL CLEAR. */}
        <Panel
          i={2}
          tier={actions.length > 0 ? "primary" : "default"}
          label="Action required"
          status={<Dot tone={actions.length ? "alert" : "live"} pulse={actions.length > 0} />}
          right={
            <>
              {sampleCount > 0 && (
                <span
                  className="hq-mono rounded-[3px] border border-dashed px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]"
                  style={{ borderColor: "#4b5a52", color: "#6d8076" }}
                  title={`${sampleCount} demo rows for design — dev only, never shown in production`}
                >
                  {sampleCount} demo
                </span>
              )}
              <span
                className="hq-readout text-[15px] font-bold"
                style={{ color: actions.length ? "var(--color-flag)" : "var(--color-moss)" }}
              >
                {actions.length}
              </span>
            </>
          }
          pad={false}
          fill
        >
          {actions.length === 0 ? (
            <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center px-5 text-center">
              <span className="text-[26px]" aria-hidden>
                ✓
              </span>
              <p
                className="hq-readout mt-2 text-[17px] font-bold uppercase tracking-[0.08em]"
                style={{ color: "var(--color-moss)" }}
              >
                All clear
              </p>
              <p className="hq-label mt-1.5 opacity-70">Nothing needs you right now</p>
            </div>
          ) : (
            /* Runs to the bottom of the left column and scrolls past that, and
               it keeps its footprint with only one row — this is a primary
               component, not a status chip. */
            <ul
              className="flex min-h-0 flex-1 flex-col divide-y divide-rule/60 overflow-y-auto"
              style={{ minHeight: 280 }}
            >
              {actions.map((a, i) => (
                <li key={`${a.href}-${i}`}>
                  <Link
                    href={a.href}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <Dot tone={a.tone} />
                    <span className="min-w-0 flex-1">
                      <span
                        className="hq-mono block text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: "var(--color-sand)" }}
                      >
                        {a.source}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-ink">{a.label}</span>
                    </span>
                    <span className="hq-label shrink-0 opacity-60 transition-opacity group-hover:opacity-100">
                      {a.cta} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
