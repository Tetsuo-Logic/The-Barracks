import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { getPlanningRequest } from "@/lib/hq/planning";
import { Panel, Dot, Tag, Meter, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { GameInsignia } from "@/components/hq/GameInsignia";
import { AvailabilityMatrix } from "@/components/hq/availability/AvailabilityMatrix";
import { findConflicts } from "@/components/hq/availability/model";

export const metadata = { title: "Full availability · Barracks HQ" };

const PAGE_WIDTH = 1400;

// ── FULL AVAILABILITY ──────────────────────────────────────────────────────
// The evidence behind one recommendation: the matrix, the per-hour headcount,
// the requirement, the ranking and the conflicts.
//
// This is the screen Availability used to open on. It isn't wrong — it was one
// level too high. Here it answers "show me your working" for a specific
// request, which is the only question it was ever really answering.

export default async function EvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const [profile, p, sp] = await Promise.all([requireProfile(), params, searchParams]);
  const real = await realRoleOf(profile);
  const view = resolveViewRole(sp.as, real);
  if (view === "member") notFound();

  const found = await getPlanningRequest(profile, decodeURIComponent(p.id));
  if (!found) notFound();
  const r = found.request;
  const intel = r.intel;

  const back = `/hq/availability${sp.as ? `?as=${sp.as}` : ""}`;

  if (!intel) {
    return (
      <div className="mx-auto w-full" style={{ maxWidth: PAGE_WIDTH }}>
        <PageHead eyebrow="Command planning" title={r.title}>
          Nothing to inspect — no muster has been called for this request yet.
        </PageHead>
        <Link href={back} className="hq-label hover:text-ink">
          ← Back to planning
        </Link>
      </div>
    );
  }

  const conflicts = findConflicts([intel]);
  const top = r.top;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: PAGE_WIDTH }}>
      <PageHead
        eyebrow={
          <Link href={back} className="hq-label mb-1 inline-block hover:text-ink" style={{ color: "var(--color-sand)" }}>
            ← Command planning
          </Link>
        }
        title={r.title}
        right={
          <>
            {r.demo && <Proto>Demo</Proto>}
            <Tag tone={r.stage === "submitted" ? "alert" : "info"}>{r.squadName}</Tag>
          </>
        }
      >
        {r.reported}/{r.total} reported · {r.nightsOffered} night
        {r.nightsOffered === 1 ? "" : "s"} offered · window {r.windowLabel} · required{" "}
        <span className="text-ink">{r.required}</span>
      </PageHead>

      {/* ── The answer this evidence supports ──────────────────────────── */}
      {top && (
        <Panel
          i={0}
          tier="primary"
          sweep
          label="Barracks recommends"
          status={<Dot tone={top.meets ? "live" : "warn"} pulse />}
          right={
            <Link
              href={`${back}${back.includes("?") ? "&" : "?"}req=${encodeURIComponent(r.id)}`}
              className="hq-label hover:text-ink"
            >
              Deploy from planning →
            </Link>
          }
        >
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <GameInsignia game={r.game} size={44} />
            <span className="hq-readout text-[30px] font-bold uppercase leading-none tracking-[0.01em]">
              {top.dow} {top.day} {top.mon} · {top.from}
            </span>
            <span className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <span
                className="hq-readout text-[19px] font-bold"
                style={{ color: top.meets ? "var(--color-moss)" : "var(--color-sand)" }}
              >
                {top.count}/{top.total}
              </span>
              <span className="hq-mono text-[12px] uppercase tracking-[0.12em] text-ink-soft">
                {top.from}–{top.to} · {top.coverage}% coverage
              </span>
            </span>
            <span className="hq-mono ml-auto text-[12px] uppercase tracking-[0.12em]" style={{ color: "var(--color-sand)" }}>
              {top.headline}
            </span>
          </div>
        </Panel>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* ── Left: the matrix and the requirement ─────────────────────── */}
        <div className="flex flex-col gap-4">
          <AvailabilityMatrix squads={[intel]} />

          <Panel i={7} label="Squad requirement" right={<Proto>Minimum strength</Proto>}>
            <div className="mb-2 flex items-center gap-2">
              <Dot tone={(intel.nights[0]?.peakCount ?? 0) >= intel.required ? "live" : "warn"} />
              <span className="hq-readout text-[15px] font-bold uppercase tracking-[0.04em]">
                {intel.emoji} {intel.name}
              </span>
              {intel.tag && <Tag>{intel.tag}</Tag>}
              <span className="hq-label ml-auto shrink-0">
                Required: <span className="hq-mono text-ink">{intel.required}</span> of {intel.total}
              </span>
            </div>
            <div className="hq-mono flex flex-col text-[12px]">
              {[...intel.nights]
                .sort((a, b) => b.peakCount - a.peakCount)
                .slice(0, 5)
                .map((n) => {
                  const ok = n.peakCount >= intel.required;
                  return (
                    <div
                      key={n.iso}
                      className="flex items-center gap-2 border-b border-rule/50 py-1.5 last:border-0"
                    >
                      <span className="w-[92px] shrink-0 uppercase tracking-[0.06em]">
                        {n.dow} {n.peakFrom ?? intel.windowFrom}
                      </span>
                      <span
                        className="w-[74px] shrink-0"
                        style={{ color: ok ? "var(--color-moss)" : "var(--color-sand)" }}
                      >
                        {n.peakCount}/{intel.total} on
                      </span>
                      <span className="min-w-0 flex-1">
                        <Meter
                          pct={intel.total ? (n.peakCount / intel.total) * 100 : 0}
                          tone={ok ? "live" : "warn"}
                        />
                      </span>
                      <span className="w-[70px] shrink-0 text-right text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        {ok ? "Deployable" : `−${intel.required - n.peakCount}`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </Panel>
        </div>

        {/* ── Right: ranking, reasoning, conflicts ─────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={8} label="Ranked deployment options" right={<span className="hq-label">{r.options.length}</span>}>
            {r.options.length === 0 ? (
              <Nil>Nothing overlaps yet — chase the silent operatives</Nil>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {r.options.map((o, i) => (
                  <li
                    key={o.key}
                    className="hq-rise rounded-[3px] border px-3 py-2.5"
                    style={{
                      ["--i" as string]: i,
                      borderColor:
                        i === 0 ? "color-mix(in srgb, var(--color-sand) 45%, transparent)" : "var(--color-rule)",
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
                        {o.dow} {o.day} {o.mon} · {o.from}
                      </span>
                      <Tag tone={o.meets ? "live" : "warn"} solid={i === 0}>
                        {o.count}/{o.total}
                      </Tag>
                    </div>
                    <div className="mt-2 pl-[30px]">
                      <Meter pct={o.coverage} tone={o.meets ? "live" : "warn"} />
                      <p className="mt-1.5 text-[12px]">{o.headline}</p>
                      {o.clashes.length > 0 && (
                        <p className="hq-mono mt-1 text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--color-flag)" }}>
                          {o.clashes.map((c) => `${c.emoji} ${c.title} ${c.time}`).join(" · ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {top && (
            <Panel i={9} label="Reasoning">
              <ul className="flex flex-col gap-2">
                {top.checks.map((c, n) => (
                  <li key={n} className="flex items-start gap-2.5">
                    <span
                      className="hq-mono mt-[1px] w-3.5 shrink-0 text-[13px] font-bold leading-none"
                      style={{ color: c.ok ? "var(--color-moss)" : "var(--color-flag)" }}
                      aria-hidden
                    >
                      {c.ok ? "✓" : "✕"}
                    </span>
                    <span className="min-w-0 flex-1 text-[13px]">
                      {c.label}
                      {c.detail && <span className="text-ink-soft"> — {c.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {r.bumped && (
                <p className="mt-3 border-t border-rule pt-3 text-[13px]">
                  <span className="hq-label" style={{ color: "var(--color-flag)" }}>
                    Calendar moved this
                  </span>
                  <span className="mt-0.5 block">
                    {r.bumped.was.dow} {r.bumped.was.from} held {r.bumped.was.count}, but {r.bumped.why}.
                  </span>
                </p>
              )}
            </Panel>
          )}

          <Panel
            i={10}
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
                  <li key={c.key} className="flex items-start gap-2.5 border-b border-rule/60 py-2 last:border-0">
                    <Dot tone={c.overlap ? "alert" : "warn"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px]">
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
        </div>
      </div>
    </div>
  );
}
