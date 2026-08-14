import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getHqOverview } from "@/lib/hq/overview";
import { resolveViewRole, canSee } from "@/lib/hq/role";
import { gameById, compHeading } from "@/lib/games";
import { heroDate, shortTime } from "@/lib/dates";
import { Panel, Dot, Tag, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { StatusStrip } from "@/components/hq/StatusStrip";
import { SignalLock } from "@/components/hq/SignalLock";
import { Countdown } from "@/components/hq/Countdown";
import { TerminalHint } from "@/components/hq/TerminalHint";
import { hqSampleActions, hqSampleWeek, hqSampleNextOp } from "@/lib/hq/future/actions";

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

  // The big treatment belongs to what's COMING. An Operation under way is a
  // row — the roster bar answers "will we have enough?", which stops being a
  // question the moment the night starts, and a running night doesn't need the
  // whole panel to say so.
  const realNext = o.next && !o.live.some((l) => l.id === o.next!.id) ? o.next : null;
  // Dev-only: lets the up-next layout be judged while every real Operation on
  // the board is already running. Tagged DEMO, and null in production.
  const demoNext = realNext ? null : hqSampleNextOp();

  const hero = realNext
    ? {
        id: realNext.id,
        iso: realNext.date,
        time: (realNext.tee_time ?? "20:00").slice(0, 5),
        game: realNext.game,
        title: compHeading(realNext),
        stake: realNext.stake,
        squad: Boolean(realNext.squad_id),
        roster: { ...o.nextRsvps, total: o.profiles.length },
        confirmBy: o.nextRsvps.confirmBy,
        lapsed: o.nextRsvps.lapsed,
        pending: o.nextRsvps.pending,
        demo: false,
      }
    : demoNext
      ? {
          id: null,
          iso: demoNext.iso,
          time: demoNext.time,
          game: demoNext.game,
          title: demoNext.title,
          stake: null,
          squad: false,
          roster: demoNext.roster,
          confirmBy: demoNext.confirmBy,
          lapsed: demoNext.lapsed,
          pending: demoNext.pending,
          demo: true,
        }
      : null;

  const heroGame = hero ? gameById(hero.game) : null;
  // The headline is the GAME, not the Operation's name. "FIFA" reads at a
  // glance; "FIFA - Friday league night" wrapped to four lines and looked like
  // a layout fault. The full name goes on the line beneath and in the tooltip.
  const heroLabel = heroGame?.name ?? hero?.title ?? "";
  const heroTitleSize =
    heroLabel.length <= 16 ? "clamp(38px, 3.2vw, 52px)" : "clamp(28px, 2.4vw, 40px)";
  const heroIso = hero ? `${hero.iso}T${hero.time}:00` : null;
  const rosterPct =
    hero && hero.roster.total ? Math.round((hero.roster.in / hero.roster.total) * 100) : 0;

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
            <SignalLock
              className="hq-readout text-[19px] font-bold uppercase leading-none tracking-[0.2em]"
              style={{ color: "var(--color-sand)" }}
            >
              {o.barracks.name}
            </SignalLock>
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

      {/* Standing figures — see .hq-strip. StatusStrip adds the arrival
          handshake: the first reading types out in green, then settles. */}
      <StatusStrip
        speed={44}
        items={[
          { text: "System online", dot: "live", pulse: true },
          { text: `${o.status.operatives} operatives` },
          { text: `${o.status.squadsActive} squads` },
          {
            text: `${o.status.operationsRun} operations run · ${o.status.hoursDeployed}h deployed`,
          },
        ]}
        right={
          o.status.operationsTonight > 0 ? (
            <span
              className="hq-mono rounded-[3px] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ backgroundColor: "var(--color-moss)", color: "#0b100e" }}
            >
              {o.status.operationsTonight} operation tonight
            </span>
          ) : undefined
        }
      />

      {/* LEFT wider: the night, then the week. RIGHT narrower: the inbox. */}
      {/* items-stretch, not items-start: the inbox is told to fill its cell so
          it bottoms out level with This Week rather than stopping short. */}
      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,1fr)]">
        <div className="flex flex-col gap-5">
          {/* ── TONIGHT / NEXT ─────────────────────────────────────────── */}
          <Panel
            i={0}
            scan="dash"
            sweep={o.live.length > 0 || hero != null}
            tier={o.live.length > 0 || hero ? "primary" : "quiet"}
            label={o.status.operationsTonight > 0 ? "Tonight" : "Next deployment"}
            status={
              <Dot
                tone={o.live.length > 0 || o.status.operationsTonight > 0 ? "live" : "idle"}
                pulse={o.live.length > 0 || o.status.operationsTonight > 0}
              />
            }
            right={
              hero?.id && (
                <Link href={`/hq/operations/${hero.id}`} className="hq-label hover:text-ink">
                  Open operation →
                </Link>
              )
            }
          >
            {o.live.length > 0 || (hero && heroIso) ? (
              <div className="flex flex-col gap-3 py-4">
                {/* ── UP NEXT ──────────────────────────────────────────────
                    The big departure-board treatment, kept for the Operation
                    that hasn't happened yet: identity left, clock dominating
                    the right, roster full width beneath both. */}
                {hero && heroIso && (
                  <div>
                    <div
                      className="flex flex-col justify-center gap-6"
                      style={{ minHeight: 250 }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-6">
                        <div className="flex min-w-0 flex-1 items-center gap-7">
                          {/* Date plate — deliberately built, deliberately
                              secondary. Hairline rules and a framed tile give it
                              structure so it reads as issued stock rather than
                              three loose words. */}
                          <div
                            className="shrink-0 text-center"
                            style={{
                              border: "1px solid var(--color-rule)",
                              borderRadius: 3,
                              background: "rgba(255,255,255,0.015)",
                              minWidth: 116,
                              /* The countdown carries a caption beneath it, so
                                 centring the two blocks leaves the day numeral
                                 ~12px below the clock's. Lift the plate by
                                 exactly that, as a transform rather than a
                                 margin so the row's height doesn't change: the
                                 two big numerals are what the eye pairs. */
                              transform: "translateY(-12px)",
                            }}
                          >
                            <div
                              className="hq-mono py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-soft"
                              style={{ borderBottom: "1px solid var(--color-rule)" }}
                            >
                              {heroDate(hero.iso).dow}
                            </div>
                            <div
                              className="hq-readout py-4 font-bold leading-[0.9]"
                              style={{ fontSize: "clamp(62px, 4.9vw, 84px)", color: "var(--color-flag)" }}
                            >
                              {heroDate(hero.iso).day}
                            </div>
                            <div
                              className="hq-mono py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-soft"
                              style={{ borderTop: "1px solid var(--color-rule)" }}
                            >
                              {heroDate(hero.iso).mon}
                            </div>
                          </div>

                          <div className="flex min-w-0 items-center gap-4">
                            <div className="min-w-0">
                              <TerminalHint text={hero.title} className="inline-block">
                                <p
                                  className="hq-readout font-bold leading-[1.02]"
                                  style={{ fontSize: heroTitleSize }}
                                >
                                  {heroLabel}
                                </p>
                              </TerminalHint>
                              {/* The kick-off is the second fact of the block, so
                                  it's sized like one. Both lines hang off the
                                  same left edge and scale together, which keeps
                                  the pairing intact whatever the game is
                                  called — COD and THE THREEBALL CUP have very
                                  different widths. */}
                              <p
                                className="hq-readout mt-1.5 font-bold leading-none tracking-[0.04em]"
                                style={{
                                  fontSize: `calc(${heroTitleSize} * 0.58)`,
                                  color: "var(--color-ink)",
                                }}
                              >
                                {hero.time}
                                {hero.stake ? (
                                  <span className="hq-mono ml-3 text-[15px] uppercase tracking-[0.12em] text-ink-soft">
                                    {hero.stake}
                                  </span>
                                ) : null}
                              </p>
                              <div className="mt-3.5 flex flex-wrap gap-1.5">
                                <Tag tone="idle">Standing by</Tag>
                                {hero.squad && <Tag tone="warn">Squad operation</Tag>}
                                {hero.demo && <Proto>Demo</Proto>}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <Countdown
                            iso={heroIso}
                            size="clamp(44px, 4.3vw, 80px)"
                            labelAlign="right"
                            colour="var(--color-moss)"
                          />
                        </div>
                      </div>

                      {/* Roster is a pre-start question, so it belongs to this
                          block and nowhere else — the one Operation that hasn't
                          happened yet. */}
                      <div className="border-t border-rule pt-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="hq-label">Roster</span>
                            <span className="hq-mono text-[14px]">
                              <span className="font-bold" style={{ color: "var(--color-moss)" }}>
                                {hero.roster.in} in
                              </span>
                              <span className="text-ink-soft">
                                {" "}
                                · {hero.roster.maybe} maybe · {hero.roster.out} out ·{" "}
                                {hero.roster.undecided} silent
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

                          {/* The confirmation window. Stated plainly, because
                              the deadline only works if people can see it. */}
                          {(hero.confirmBy || hero.pending > 0 || hero.lapsed > 0) && (
                            <p className="hq-mono mt-2.5 text-[11px] uppercase tracking-[0.1em]">
                              {hero.pending > 0 && (
                                <span style={{ color: "var(--color-sand)" }}>
                                  {hero.pending} to confirm
                                </span>
                              )}
                              {hero.pending > 0 && hero.lapsed > 0 && (
                                <span className="text-ink-soft"> · </span>
                              )}
                              {hero.lapsed > 0 && (
                                <span style={{ color: "var(--color-flag)" }}>
                                  {hero.lapsed} never confirmed — off the roster
                                </span>
                              )}
                              {hero.confirmBy && (hero.pending > 0 || hero.lapsed > 0) && (
                                <span className="text-ink-soft"> · </span>
                              )}
                              {hero.confirmBy && (
                                <span className="text-ink-soft">
                                  confirm by {shortTime(new Date(hero.confirmBy).toTimeString().slice(0, 8))}
                                </span>
                              )}
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Under way, beneath what's coming. A running night needs to
                    be visibly on, not to take the whole panel. */}
                {o.live.length > 0 && (
                  <p
                    className={`hq-label ${hero ? "mt-2 border-t border-rule pt-4" : ""}`}
                    style={{ color: "var(--color-moss)" }}
                  >
                    Running now
                  </p>
                )}
                {o.live.map((c) => (
                  <Link
                    key={c.id}
                    href={`/hq/operations/${c.id}`}
                    /* No box. These are departure-board lines like the hero,
                       just at a smaller scale — a bordered card made them read
                       as a separate widget rather than the same board. */
                    className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-rule/60 px-1 py-3 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <span className="shrink-0">
                      <Dot tone="live" pulse />
                    </span>
                    <span className="hq-mono shrink-0 text-[15px] uppercase tracking-[0.08em] text-ink-soft">
                      {heroDate(c.date).dow} {heroDate(c.date).day}
                      {c.tee_time ? ` · ${shortTime(c.tee_time)}` : ""}
                    </span>
                    <TerminalHint text={compHeading(c)} className="flex-1">
                      <span className="hq-readout block truncate text-[27px] font-bold uppercase leading-none tracking-[0.02em]">
                        {gameById(c.game).name}
                      </span>
                    </TerminalHint>
                    <Countdown
                      iso={`${c.date}T${(c.tee_time ?? "20:00:00").slice(0, 8)}`}
                      size="27px"
                      caption={false}
                    />
                    <span className="hq-label shrink-0 opacity-70">Open →</span>
                  </Link>
                ))}

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
                  .map((c) => {
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
                        {o.live.some((l) => l.id === comp.id) ? (
                          <Tag tone="live" solid>
                            Live
                          </Tag>
                        ) : comp.id === (o.live.length ? o.upNext?.id : o.next?.id) ? (
                          <Tag tone="live">Next</Tag>
                        ) : null}
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
              className="flex min-h-0 flex-1 basis-0 flex-col divide-y divide-rule/60 overflow-y-auto"
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
