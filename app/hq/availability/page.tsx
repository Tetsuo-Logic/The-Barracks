import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getSquads } from "@/lib/queries";
import { todayISO, shortDate } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { AvailabilityMatrix } from "@/components/hq/availability/AvailabilityMatrix";
import { buildSquadIntel, deploymentPlan, findConflicts } from "@/components/hq/availability/model";

export const metadata = { title: "Availability · Barracks HQ" };

// Intelligent scheduling. The phone asks one squad "which nights can you do?";
// this screen reads every answer at once — who, which night, and their hours —
// and works out where the Barracks can actually field a squad.
export default async function AvailabilityPage() {
  const profile = await requireProfile();
  const squads = await getSquads(profile.id);
  const today = todayISO();

  const intel = squads.map((s) => buildSquadIntel(s, today));
  // Live musters first, then the squads we're prototyping from the roster.
  intel.sort((a, b) => (a.live === b.live ? 0 : a.live ? -1 : 1));

  const live = intel.filter((s) => s.live);
  const plan = deploymentPlan(intel);
  const conflicts = findConflicts(intel);

  const nightsOnOffer = new Set(live.flatMap((s) => s.nights.map((n) => n.iso))).size;
  const reported = live.reduce((n, s) => n + s.responded, 0);
  const expected = live.reduce((n, s) => n + s.total, 0);
  const bestOverall = plan[0] ?? null;
  const awaiting = live.filter((s) => s.mine && s.status === "open" && !s.members.find((m) => m.id === profile.id)?.responded);

  return (
    <div>
      <PageHead
        eyebrow="Command"
        title="Availability"
        right={
          <>
            <Link
              href="/squads"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              + Call a muster
            </Link>
            <Link
              href="/hq/comms"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Poll the Barracks
            </Link>
          </>
        }
      >
        {live.length > 0 ? (
          <>
            {live.length} muster{live.length === 1 ? "" : "s"} running ·{" "}
            <span className="text-ink">{reported}</span> of {expected} operatives reported
          </>
        ) : (
          <>No muster running — the matrix below is prototyped from the real roster</>
        )}
      </PageHead>

      {squads.length === 0 ? (
        <Panel label="Squads">
          <Nil>No squads formed — availability is gathered per squad</Nil>
          <div className="text-center">
            <Link href="/squads" className="hq-label hover:text-ink">
              Form a squad →
            </Link>
          </div>
        </Panel>
      ) : (
        <>
          {/* ── Status strip ────────────────────────────────────────────── */}
          <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
            <Panel i={0}>
              <Stat
                value={live.length}
                label="Musters live"
                sub={`${intel.length} squads on strength`}
                tone={live.length > 0 ? "live" : undefined}
              />
            </Panel>
            <Panel i={1}>
              <Stat value={nightsOnOffer || "—"} label="Nights on offer" />
            </Panel>
            <Panel i={2}>
              <Stat
                value={expected ? `${reported}/${expected}` : "—"}
                label="Reported"
                tone={expected && reported === expected ? "live" : expected ? "warn" : undefined}
              />
            </Panel>
            <Panel i={3}>
              <Stat
                value={bestOverall ? `${bestOverall.count}` : "—"}
                label="Peak strength"
                sub={bestOverall ? `${bestOverall.dow} ${bestOverall.time} · ${bestOverall.squadName}` : "No overlap found"}
                tone={bestOverall?.meets ? "live" : "warn"}
              />
            </Panel>
            <Panel i={4}>
              <Stat
                value={bestOverall ? `${bestOverall.coverage}%` : "—"}
                label="Best coverage"
              />
            </Panel>
            <Panel i={5}>
              <Stat
                value={conflicts.length}
                label="Conflicts"
                sub={conflicts.length ? "Double-booked operatives" : "Clear"}
                tone={conflicts.length > 0 ? "alert" : undefined}
              />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
            {/* ── Left: the matrix + requirements ─────────────────────── */}
            <div className="flex flex-col gap-4">
              <AvailabilityMatrix squads={intel} />

              <Panel
                i={7}
                label="Squad requirements"
                right={<Proto>Minimum strength</Proto>}
              >
                <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                  {intel.map((s) => {
                    const top = [...s.nights].sort((a, b) => b.peakCount - a.peakCount).slice(0, 3);
                    const bestNight = top[0];
                    const ready = (bestNight?.peakCount ?? 0) >= s.required;
                    return (
                      <div key={s.id}>
                        <div className="mb-1.5 flex items-center gap-2">
                          <Dot tone={ready ? "live" : s.live ? "warn" : "idle"} pulse={ready && s.live} />
                          <span className="hq-readout text-[14px] font-bold uppercase tracking-[0.04em]">
                            {s.emoji} {s.name} squad
                          </span>
                          {s.tag && <Tag>{s.tag}</Tag>}
                          {!s.live && <Proto />}
                          <span className="hq-label ml-auto shrink-0">
                            Required: <span className="hq-mono text-ink">{s.required}</span>
                          </span>
                        </div>
                        <div className="hq-mono flex flex-col text-[12px]">
                          {top.length === 0 || (bestNight && bestNight.peakCount === 0) ? (
                            <span className="py-1 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
                              No night carries a squad yet
                            </span>
                          ) : (
                            top.map((n) => {
                              const ok = n.peakCount >= s.required;
                              return (
                                <div
                                  key={n.iso}
                                  className="flex items-center gap-2 border-b border-rule/50 py-1 last:border-0"
                                >
                                  <span className="w-[86px] shrink-0 uppercase tracking-[0.06em]">
                                    {n.dow} {n.peakFrom ?? s.windowFrom}
                                  </span>
                                  <span
                                    className="w-[74px] shrink-0"
                                    style={{ color: ok ? "var(--color-moss)" : "var(--color-sand)" }}
                                  >
                                    {n.peakCount}/{s.total} on
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <Meter
                                      pct={s.total ? (n.peakCount / s.total) * 100 : 0}
                                      tone={ok ? "live" : "warn"}
                                    />
                                  </span>
                                  <span className="w-[62px] shrink-0 text-right text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                                    {ok ? "Deployable" : `−${s.required - n.peakCount}`}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </div>

            {/* ── Right: plan, conflicts, control ─────────────────────── */}
            <div className="flex flex-col gap-4">
              <Panel
                i={8}
                sweep
                label="Recommended deployment plan"
                status={<Dot tone={plan.some((p) => p.meets) ? "live" : "warn"} pulse />}
                right={<Proto>Reasoning</Proto>}
              >
                {plan.length === 0 ? (
                  <Nil>Nothing overlaps yet — chase the silent operatives</Nil>
                ) : (
                  <ol className="flex flex-col gap-2.5">
                    {plan.map((p, i) => (
                      <li
                        key={p.key}
                        className="hq-rise rounded-[3px] border px-3 py-2.5"
                        style={{
                          ["--i" as string]: i,
                          borderColor: i === 0 ? "color-mix(in srgb, var(--color-sand) 45%, transparent)" : "var(--color-rule)",
                          backgroundColor: i === 0 ? "rgba(245,182,61,0.05)" : "transparent",
                        }}
                      >
                        <div className="flex items-baseline gap-2.5">
                          <span
                            className="hq-readout w-5 shrink-0 text-[16px] font-bold leading-none"
                            style={{ color: i === 0 ? "var(--color-sand)" : "var(--color-ink-soft)" }}
                          >
                            {i + 1}
                          </span>
                          <span className="hq-readout min-w-0 flex-1 truncate text-[15px] font-bold uppercase tracking-[0.03em]">
                            {p.dow} {p.day} {p.mon} · {p.time}
                          </span>
                          <Tag tone={p.meets ? "live" : "warn"} solid={i === 0}>
                            {p.count}/{p.total}
                          </Tag>
                        </div>
                        <p className="hq-mono mt-1 pl-[30px] text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                          {p.emoji} {p.squadName} · window {p.window} · required {p.required}
                          {!p.live && " · prototype"}
                        </p>
                        <div className="mt-2 pl-[30px]">
                          <Meter pct={p.coverage} tone={p.meets ? "live" : "warn"} />
                          <p className="mt-1.5 text-[11px] text-ink-soft">{p.reason}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>

              <Panel
                i={9}
                label="Conflicts"
                status={<Dot tone={conflicts.length ? "alert" : "idle"} pulse={conflicts.length > 0} />}
                right={
                  <span
                    className="hq-mono text-xs"
                    style={{ color: conflicts.length ? "var(--color-flag)" : "var(--color-ink-soft)" }}
                  >
                    {conflicts.length}
                  </span>
                }
              >
                {conflicts.length === 0 ? (
                  <Nil>No operative is double-booked</Nil>
                ) : (
                  <ul className="flex flex-col">
                    {conflicts.slice(0, 8).map((c) => (
                      <li
                        key={c.key}
                        className="flex items-start gap-2.5 border-b border-rule/60 py-2 last:border-0"
                      >
                        <Dot tone={c.overlap ? "alert" : "warn"} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] text-ink">
                            {c.name} · {c.dow} {c.day}
                          </span>
                          <span className="hq-mono block truncate text-[11px] text-ink-soft">
                            {c.squads.map((s) => `${s.name} ${s.from}–${s.to}`).join("  ·  ")}
                          </span>
                        </span>
                        <Tag tone={c.overlap ? "alert" : "warn"}>{c.overlap ? "Clash" : "Same night"}</Tag>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel i={10} label="Muster control">
                {awaiting.length > 0 && (
                  <div
                    className="mb-3 rounded-[3px] border px-3 py-2.5"
                    style={{
                      borderColor: "color-mix(in srgb, var(--color-flag) 45%, transparent)",
                      backgroundColor: "rgba(255,91,59,0.06)",
                    }}
                  >
                    <p className="hq-label" style={{ color: "var(--color-flag)" }}>
                      Action required
                    </p>
                    <p className="mt-0.5 text-[13px]">
                      {awaiting.length} muster{awaiting.length === 1 ? "" : "s"} awaiting your nights.
                    </p>
                    <Link href="/squads" className="hq-label mt-1.5 inline-block hover:text-ink">
                      Send your times →
                    </Link>
                  </div>
                )}

                {intel.map((s) => (
                  <Row
                    key={s.id}
                    k={s.name}
                    v={
                      s.live
                        ? s.status === "proposed"
                          ? `Proposed ${s.chosenDate ? shortDate(s.chosenDate) : ""} ${s.chosenTime?.slice(0, 5) ?? ""}`.trim()
                          : `Open · ${s.responded}/${s.total} in`
                        : "No muster"
                    }
                    tone={s.live ? (s.status === "proposed" ? "warn" : "live") : "idle"}
                  />
                ))}

                {intel.some((s) => !s.live) && (
                  <div className="mt-3 rounded-[3px] border border-dashed border-rule px-3 py-3 text-center">
                    <p className="hq-readout text-[15px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--color-sand)" }}>
                      Call a muster
                    </p>
                    <p className="mt-1 text-[12px] text-ink-soft">
                      {intel.filter((s) => !s.live).length} squad
                      {intel.filter((s) => !s.live).length === 1 ? " has" : "s have"} no night being arranged.
                      Set the nights and a kick-off window; the squad reports their hours.
                    </p>
                    <Link
                      href="/squads"
                      className="hq-label mt-2.5 inline-block rounded-[3px] px-3 py-2 font-semibold"
                      style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                    >
                      Open the muster flow →
                    </Link>
                  </div>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
