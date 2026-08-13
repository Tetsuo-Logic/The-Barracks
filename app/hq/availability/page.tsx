import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { getPlanning, type PlanningRequest, type Stage } from "@/lib/hq/planning";
import { Panel, PageHead, Proto } from "@/components/hq/Kit";
import { Lifecycle } from "@/components/hq/availability/Lifecycle";
import { RequestDetail } from "@/components/hq/availability/RequestDetail";
import { RequestQueue, type QueueGroup } from "@/components/hq/availability/RequestQueue";

export const metadata = { title: "Command planning · Barracks HQ" };

const PAGE_WIDTH = 1500;

// ── COMMAND PLANNING ───────────────────────────────────────────────────────
// Where completed squad requests arrive for the President to deploy.
//
// Master/detail, like the inbox on Headquarters: everything waiting is listed
// on the right, and picking one opens it beside rather than navigating away.
// Selection lives in ?req= so a view is linkable and the HQ inbox can deep-link
// straight to a request.
//
// Answer first, evidence second — the recommendation leads, and the reasoning
// and alternatives sit under it in plain sight rather than behind toggles.
//
// Requests never wait for each other: each is scored against the calendar as it
// stands right now, so deploying one immediately changes what the next
// recommends. There is no weekly batch.

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; req?: string; demo?: string }>;
}) {
  const [profile, sp] = await Promise.all([requireProfile(), searchParams]);
  const real = await realRoleOf(profile);
  const view = resolveViewRole(sp.as, real);

  // Members have no business here — planning happens in their squad, by their
  // Captain. This is a render filter; RLS is what actually stops them.
  if (view === "member") {
    return (
      <div className="mx-auto w-full" style={{ maxWidth: PAGE_WIDTH }}>
        <PageHead eyebrow="Command" title="Command planning">
          Restricted to Command and Squad Captains
        </PageHead>
        <Panel tier="quiet" label="Not your post">
          <div className="px-1 py-6 text-center">
            <p className="text-[15px]">Nights are arranged inside your squad.</p>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Your Captain calls the muster and sends the request up to Command.
            </p>
            <Link
              href="/hq/squads"
              className="hq-label mt-4 inline-block rounded-[3px] px-4 py-2.5 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              Go to your squad →
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

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

  const by = (s: Stage) => mine.filter((r) => r.stage === s);
  const counts: Partial<Record<Stage, number>> = {
    requested: by("requested").length,
    open: by("open").length,
    ready: by("ready").length,
    submitted: by("submitted").length,
    deployed: by("deployed").length,
  };

  const submitted = by("submitted");
  const gathering = [...by("ready"), ...by("open"), ...by("requested")];
  const deployed = by("deployed");

  // The President's queue is SUBMITTED; the Captain's is everything before it.
  const queue = isPresident ? submitted : gathering;
  const rest = isPresident ? gathering : submitted;

  // Selection: the URL wins, then the first thing actually waiting on this role.
  const selected =
    mine.find((r) => r.id === sp.req) ?? queue[0] ?? rest[0] ?? deployed[0] ?? null;

  const href = (id: string) => {
    const q = new URLSearchParams();
    if (sp.as) q.set("as", sp.as);
    if (sp.demo) q.set("demo", sp.demo);
    q.set("req", id);
    return `/hq/availability?${q.toString()}`;
  };
  const evidenceHref = (id: string) =>
    `/hq/availability/${encodeURIComponent(id)}${sp.as ? `?as=${sp.as}` : ""}`;

  const toItems = (rs: PlanningRequest[]) =>
    rs.map((r) => ({ r, href: href(r.id), active: selected?.id === r.id }));

  const groups: QueueGroup[] = [
    {
      label: isPresident ? "Awaiting deployment" : "In your squads",
      tone: "alert",
      items: toItems(queue),
    },
    {
      label: isPresident ? "In the squads" : "With command",
      tone: "warn",
      items: toItems(rest),
    },
    { label: "Recently deployed", tone: "live", items: toItems(deployed) },
  ];

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
              <Link
                href={sp.demo === "0" ? "/hq/availability" : "/hq/availability?demo=0"}
                title="Toggle the prototype scenarios"
              >
                <Proto>{sp.demo === "0" ? "demo off" : `${planning.demoCount} demo`}</Proto>
              </Link>
            )}
          </>
        }
      >
        {queue.length > 0 ? (
          <>
            <span className="text-ink">{queue.length}</span> operation
            {queue.length === 1 ? "" : "s"} {isPresident ? "awaiting deployment" : "being arranged"}
          </>
        ) : (
          <>Nothing {isPresident ? "awaiting deployment" : "being arranged"}</>
        )}
      </PageHead>

      <Lifecycle
        counts={counts}
        active={selected?.stage}
        owns={isPresident ? ["submitted", "deployed"] : ["requested", "open", "ready"]}
      />

      {/* Detail left, inbox right — the same shape as Headquarters. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(330px,1fr)]">
        {selected ? (
          <RequestDetail
            request={selected}
            canDeploy={isPresident && selected.stage === "submitted"}
            evidenceHref={evidenceHref(selected.id)}
          />
        ) : (
          <Panel tier="quiet">
            <div className="flex min-h-[280px] flex-col items-center justify-center px-5 text-center">
              <span className="text-[26px]" aria-hidden>
                ✓
              </span>
              <p
                className="hq-readout mt-2 text-[19px] font-bold uppercase tracking-[0.08em]"
                style={{ color: "var(--color-moss)" }}
              >
                All clear
              </p>
              <p className="hq-label mt-1.5 opacity-70">
                {isPresident
                  ? "No operations awaiting deployment"
                  : "No requests or musters running in your squads"}
              </p>
            </div>
          </Panel>
        )}

        <RequestQueue groups={groups} />
      </div>
    </div>
  );
}
