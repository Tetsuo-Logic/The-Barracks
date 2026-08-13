import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { getPlanning, type PlanningRequest, type Stage } from "@/lib/hq/planning";
import { PageHead, Proto } from "@/components/hq/Kit";
import { Lifecycle } from "@/components/hq/availability/Lifecycle";
import { RequestDetail } from "@/components/hq/availability/RequestDetail";
import { RequestQueue } from "@/components/hq/availability/RequestQueue";

export const metadata = { title: "Command planning · Barracks HQ" };

const PAGE_WIDTH = 1500;

// ── PLANNING ───────────────────────────────────────────────────────────────
// A working area for whoever owns the decision, not a dashboard of everything
// happening across the Barracks. The hierarchy is deliberately flat:
//
//   small queue  → what needs me
//   workspace    → the one thing I'm organising
//   collapsed    → explain or challenge the recommendation
//
// Captain owns REQUEST → MUSTER → REVIEW → SUBMIT. President owns REVIEW →
// DEPLOY. A member owns none of it — nights are arranged in their squad — so
// they get no page at all rather than a locked door.
//
// The default queue holds only the caller's own stage. Everything else stays
// reachable through the lifecycle strip, which doubles as the filter, so
// nothing is hidden but nothing surplus is on screen either.
//
// Requests never wait for each other: each is scored against the calendar as it
// stands right now, so deploying one immediately changes what the next
// recommends. There is no weekly batch.

/** The stages each role actively works. Anything else is filter-only. */
const OWNED: Record<"president" | "captain", Stage[]> = {
  president: ["submitted"],
  captain: ["requested", "open", "ready"],
};

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; req?: string; demo?: string; stage?: string }>;
}) {
  const [profile, sp] = await Promise.all([requireProfile(), searchParams]);
  const real = await realRoleOf(profile);
  const view = resolveViewRole(sp.as, real);

  // No planning surface for members at all — the rail doesn't offer it, and
  // reaching it by hand shouldn't produce a page explaining the refusal.
  if (view === "member") notFound();

  const planning = await getPlanning(profile);
  const isPresident = view === "president";

  // ?demo=0 strips the prototype scenarios — the only way to see the genuine
  // ALL CLEAR state while the Barracks is quiet and the samples are loud.
  const all = sp.demo === "0" ? planning.requests.filter((r) => !r.demo) : planning.requests;

  // A Captain sees their own squads only, and sees them without the Barracks
  // calendar folded in — that weighting is Command's job, not theirs.
  const mine: PlanningRequest[] = isPresident
    ? all
    : all
        .filter((r) => planning.captainOf.includes(r.squadId) || r.demo)
        .map((r) => ({ ...r, options: r.squadOptions, top: r.squadOptions[0] ?? null, bumped: null }));

  const counts: Partial<Record<Stage, number>> = {};
  for (const s of ["requested", "open", "ready", "submitted", "deployed"] as Stage[]) {
    counts[s] = mine.filter((r) => r.stage === s).length;
  }

  const owned = OWNED[isPresident ? "president" : "captain"];
  const filter = (["requested", "open", "ready", "submitted", "deployed"] as Stage[]).includes(
    sp.stage as Stage,
  )
    ? (sp.stage as Stage)
    : null;

  // Default: only the stages this role actually acts on. A filter overrides it.
  const queue = filter
    ? mine.filter((r) => r.stage === filter)
    : mine.filter((r) => owned.includes(r.stage));

  const selected = queue.find((r) => r.id === sp.req) ?? mine.find((r) => r.id === sp.req) ?? queue[0] ?? null;

  const url = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | undefined> = { as: sp.as, demo: sp.demo, stage: sp.stage, req: sp.req };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/hq/availability?${s}` : "/hq/availability";
  };

  const queueLabel = filter
    ? `${filter === "submitted" ? "Submitted to command" : filter === "open" ? "Muster open" : filter[0].toUpperCase() + filter.slice(1)}`
    : isPresident
      ? "Awaiting deployment"
      : "Needs organising";

  return (
    <div className="mx-auto w-full" style={{ maxWidth: PAGE_WIDTH }}>
      <PageHead
        eyebrow={isPresident ? "Command" : "Squad"}
        title={isPresident ? "Command planning" : "Squad planning"}
        right={
          <>
            <Link
              href="/squads"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              + Call a muster
            </Link>
            {planning.demoCount > 0 && (
              <Link href={url({ demo: sp.demo === "0" ? null : "0", req: null })} title="Toggle the prototype scenarios">
                <Proto>{sp.demo === "0" ? "demo off" : `${planning.demoCount} demo`}</Proto>
              </Link>
            )}
          </>
        }
      >
        {queue.length > 0 ? (
          <>
            <span className="text-ink">{queue.length}</span> operation
            {queue.length === 1 ? "" : "s"}{" "}
            {filter ? "at this stage" : isPresident ? "awaiting deployment" : "need organising"}
          </>
        ) : (
          <>Nothing {filter ? "at this stage" : isPresident ? "awaiting deployment" : "to organise"}</>
        )}
      </PageHead>

      {/* The lifecycle is also the filter — the way to look at another stage
          without every stage being permanently on screen. */}
      <Lifecycle
        counts={counts}
        active={filter}
        owns={owned}
        hidden={isPresident ? [] : ["deployed"]}
        hrefFor={(s) => url({ stage: s, req: null })}
      />

      {/* Workspace leads, queue beside it — same shape as the HQ inbox. When
          there's nothing to organise the left column stays empty on purpose:
          blank space beats a box invented to fill it. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(330px,1fr)]">
        {selected ? (
          <RequestDetail
            request={selected}
            canDeploy={isPresident && selected.stage === "submitted"}
            evidenceHref={`/hq/availability/${encodeURIComponent(selected.id)}${sp.as ? `?as=${sp.as}` : ""}`}
          />
        ) : (
          <div />
        )}

        <RequestQueue
          label={queueLabel}
          items={queue.map((r) => ({ r, href: url({ req: r.id }), active: selected?.id === r.id }))}
          isPresident={isPresident}
          empty={
            filter
              ? "Nothing at this stage"
              : isPresident
                ? "No operations awaiting deployment"
                : "Nothing needs organising"
          }
        />
      </div>
    </div>
  );
}
