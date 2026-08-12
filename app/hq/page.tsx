import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getHqOverview } from "@/lib/hq/overview";
import { gameById, compHeading } from "@/lib/games";
import { heroDate, shortTime, relativeTime } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { Countdown } from "@/components/hq/Countdown";
import { presenceFor, PRESENCE_TONE } from "@/lib/hq/future/systems";

export const metadata = { title: "Command · Barracks HQ" };

// The command overview. Answers one question on sight: what is happening in my
// Barracks? Everything on this screen is real except presence (adapter).
export default async function CommandPage() {
  const profile = await requireProfile();
  const o = await getHqOverview(profile);

  const nextGame = o.next ? gameById(o.next.game) : null;
  const nextIso = o.next
    ? `${o.next.date}T${(o.next.tee_time ?? "20:00:00").slice(0, 8)}`
    : null;

  const rosterPct = o.profiles.length
    ? Math.round((o.nextRsvps.in / o.profiles.length) * 100)
    : 0;

  return (
    <div>
      <PageHead
        eyebrow="Command"
        title="Headquarters"
        right={
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

      {/* ── Status strip ─────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Panel i={0}>
          <div className="flex items-center gap-2">
            <Dot tone="live" pulse />
            <span className="hq-label">System</span>
          </div>
          <p className="hq-readout mt-2 text-[20px] font-bold" style={{ color: "var(--color-moss)" }}>
            ONLINE
          </p>
        </Panel>
        <Panel i={1}>
          <Stat value={o.status.operatives} label="Operatives" sub={`${o.status.online} online now`} />
        </Panel>
        <Panel i={2}>
          <Stat value={o.status.squadsActive} label="Squads active" />
        </Panel>
        <Panel i={3}>
          <Stat
            value={o.status.operationsTonight}
            label="Operations tonight"
            tone={o.status.operationsTonight > 0 ? "live" : undefined}
          />
        </Panel>
        <Panel i={4}>
          <Stat
            value={o.status.actionsRequired}
            label="Actions required"
            tone={o.status.actionsRequired > 0 ? "alert" : undefined}
          />
        </Panel>
        <Panel i={5}>
          <Stat value={o.status.operationsRun} label="Operations run" sub={`${o.status.hoursDeployed}h deployed`} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* ── Left column ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Tonight / next up */}
          <Panel
            i={6}
            sweep
            label={o.status.operationsTonight > 0 ? "Tonight" : "Next up"}
            status={<Dot tone={o.status.operationsTonight > 0 ? "live" : "idle"} pulse={o.status.operationsTonight > 0} />}
            right={
              o.next && (
                <Link href={`/hq/operations/${o.next.id}`} className="hq-label hover:text-ink">
                  Open room →
                </Link>
              )
            }
          >
            {o.next && nextIso ? (
              <div className="grid gap-6 md:grid-cols-[auto_1fr_auto]">
                <div className="text-center">
                  <div className="hq-label">{heroDate(o.next.date).dow}</div>
                  <div
                    className="hq-readout text-[54px] font-bold leading-[0.85]"
                    style={{ color: "var(--color-flag)" }}
                  >
                    {heroDate(o.next.date).day}
                  </div>
                  <div className="hq-label">{heroDate(o.next.date).mon}</div>
                </div>

                <div className="min-w-0">
                  <p className="hq-readout text-[22px] font-bold leading-tight">
                    {nextGame?.emoji} {compHeading(o.next)}
                  </p>
                  <p className="hq-mono mt-1 text-xs uppercase tracking-[0.1em] text-ink-soft">
                    {nextGame?.name}
                    {o.next.tee_time ? ` · ${shortTime(o.next.tee_time)}` : ""}
                    {o.next.stake ? ` · ${o.next.stake}` : ""}
                  </p>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="hq-label">Roster</span>
                      <span className="hq-mono text-xs">
                        <span style={{ color: "var(--color-moss)" }}>{o.nextRsvps.in} in</span>
                        <span className="text-ink-soft"> · {o.nextRsvps.maybe} maybe · {o.nextRsvps.out} out · {o.nextRsvps.undecided} silent</span>
                      </span>
                    </div>
                    <Meter pct={rosterPct} tone={rosterPct >= 60 ? "live" : "warn"} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Tag tone={o.next.started_at ? "live" : "idle"}>
                      {o.next.finished_at ? "Archived" : o.next.started_at ? "Room live" : "Standing by"}
                    </Tag>
                    {o.next.squad_id && <Tag tone="warn">Squad operation</Tag>}
                    {o.next.for_cup && <Tag tone="warn">Counts for the cup</Tag>}
                  </div>
                </div>

                <div className="shrink-0 border-l border-rule pl-6">
                  <Countdown iso={nextIso} />
                </div>
              </div>
            ) : (
              <Nil>No operation on the board — deploy one</Nil>
            )}
          </Panel>

          {/* This week */}
          <Panel
            i={7}
            label="This week"
            right={<Link href="/hq/calendar" className="hq-label hover:text-ink">Calendar →</Link>}
          >
            {o.upcoming.length === 0 && !o.next ? (
              <Nil>Nothing scheduled</Nil>
            ) : (
              <div className="flex flex-col">
                {[o.next, ...o.upcoming].filter(Boolean).slice(0, 6).map((c, idx) => {
                  const comp = c!;
                  const g = gameById(comp.game);
                  const hd = heroDate(comp.date);
                  return (
                    <Link
                      key={comp.id}
                      href={`/hq/operations/${comp.id}`}
                      className="flex items-center gap-4 border-b border-rule/60 py-2.5 last:border-0 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                    >
                      <span className="hq-mono w-14 shrink-0 text-xs uppercase tracking-[0.08em] text-ink-soft">
                        {hd.dow} {hd.day}
                      </span>
                      <span className="w-6 shrink-0 text-center">{g.emoji}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">{compHeading(comp)}</span>
                      <span className="hq-mono shrink-0 text-xs text-ink-soft">
                        {shortTime(comp.tee_time) || "—"}
                      </span>
                      {idx === 0 && <Tag tone="live">Next</Tag>}
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Live activity */}
          <Panel
            i={8}
            label="Live activity"
            status={<Dot tone="live" pulse />}
            right={<Link href="/hq/archives" className="hq-label hover:text-ink">Archives →</Link>}
          >
            {o.feed.length === 0 ? (
              <Nil>No system activity</Nil>
            ) : (
              <ul className="flex flex-col">
                {o.feed.map((f, i) => (
                  <li
                    key={`${f.at}-${i}`}
                    className="hq-rise flex items-center gap-3 border-b border-rule/50 py-1.5 last:border-0"
                    style={{ ["--i" as string]: i }}
                  >
                    <Dot tone={f.tone} />
                    <span className="hq-mono min-w-0 flex-1 truncate text-[11px] tracking-[0.06em]">
                      {f.text}
                    </span>
                    <span className="hq-mono shrink-0 text-[10px] text-ink-soft">
                      {relativeTime(f.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Action required */}
          <Panel
            i={9}
            label="Action required"
            status={<Dot tone={o.actions.length ? "alert" : "idle"} pulse={o.actions.length > 0} />}
            right={
              <span className="hq-mono text-xs" style={{ color: o.actions.length ? "var(--color-flag)" : "var(--color-ink-soft)" }}>
                {o.actions.length}
              </span>
            }
          >
            {o.actions.length === 0 ? (
              <Nil>Nothing outstanding</Nil>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {o.actions.slice(0, 7).map((a, i) => (
                  <li key={i}>
                    <Link
                      href={a.href}
                      className="flex items-start gap-2.5 rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft"
                    >
                      <Dot tone={a.tone} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-ink">{a.label}</span>
                        <span className="hq-mono block truncate text-[11px] text-ink-soft">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Command status */}
          <Panel i={10} label="Command status">
            <Row k="President" v={o.president?.name ?? "Vacant"} tone={o.president ? "warn" : "idle"} />
            {o.captains.length === 0 ? (
              <Row k="Captains" v="No squads formed" tone="info" />
            ) : (
              o.captains.map((c) => (
                <Row
                  key={c.squad}
                  k={c.squad}
                  v={c.captain ? `${c.captain.name} · ${c.members}` : `No captain · ${c.members}`}
                  tone={c.captain ? "live" : "idle"}
                />
              ))
            )}
            <Link href="/hq/leadership" className="hq-label mt-3 block hover:text-ink">
              Leadership →
            </Link>
          </Panel>

          {/* Presence */}
          <Panel
            i={11}
            label="Presence"
            right={<Proto />}
          >
            <ul className="flex flex-col gap-1">
              {o.profiles.slice(0, 8).map((p, i) => {
                const state = presenceFor(p.id, i);
                return (
                  <li key={p.id} className="flex items-center gap-2.5 py-1">
                    <Dot tone={PRESENCE_TONE[state]} pulse={state === "deployed"} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {p.id === profile.id ? "You" : p.name}
                    </span>
                    <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                      {state}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Quick actions */}
          <Panel i={12} label="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/hq/operations/new", label: "Deploy operation" },
                { href: "/hq/comms", label: "Send comms" },
                { href: "/hq/radar", label: "Add radar contact" },
                { href: "/hq/court", label: "Open the court" },
                { href: "/hq/find-opponent", label: "Find opponent" },
                { href: "/hq/availability", label: "Call a muster" },
              ].map((a) => (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  className="hq-label rounded-[3px] border border-rule px-3 py-2.5 text-center transition-colors hover:border-sand hover:text-ink"
                >
                  {a.label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
