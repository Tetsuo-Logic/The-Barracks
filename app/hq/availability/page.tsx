import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { getPlanning, type PlanningRequest, type Stage } from "@/lib/hq/planning";
import { Panel, PageHead, Nil, Proto, Tag } from "@/components/hq/Kit";
import { Lifecycle } from "@/components/hq/availability/Lifecycle";
import { RequestCard } from "@/components/hq/availability/RequestCard";

export const metadata = { title: "Command planning · Barracks HQ" };

const PAGE_WIDTH = 1180;

// ── COMMAND PLANNING ───────────────────────────────────────────────────────
// Where completed squad requests arrive for the President to deploy.
//
// Answer first, evidence second. The matrix that used to be the front door is
// still here — one level down, behind the request it belongs to, where it's
// evidence for a decision rather than a decision to be worked out.
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
  const mine = isPresident
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
  const highlight = sp.req ?? null;

  // The President's queue is SUBMITTED; the Captain's is everything before it.
  const queue = isPresident ? submitted : gathering;
  const queueLabel = isPresident ? "Awaiting deployment" : "In your squads";
  const rest = isPresident ? gathering : submitted;
  const restLabel = isPresident ? "In the squads" : "With Command";

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
            {queue.length === 1 ? "" : "s"}{" "}
            {isPresident ? "awaiting deployment" : "being arranged"}
          </>
        ) : (
          <>Nothing {isPresident ? "awaiting deployment" : "being arranged"}</>
        )}
      </PageHead>

      <Lifecycle
        counts={counts}
        owns={isPresident ? ["submitted", "deployed"] : ["requested", "open", "ready"]}
      />

      {/* ── THE QUEUE ────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <h2 className="hq-label mb-3" style={{ color: "var(--color-sand)" }}>
          {queueLabel}
        </h2>

        {queue.length === 0 ? (
          <Panel tier="quiet">
            <div className="flex min-h-[180px] flex-col items-center justify-center px-5 text-center">
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
        ) : (
          <div className="flex flex-col gap-5">
            {queue.map((r, i) => (
              <RequestCard
                key={r.id}
                request={r as PlanningRequest}
                canDeploy={isPresident}
                open={highlight === r.id}
                highlight={highlight === r.id}
                i={i}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── THE REST OF THE PIPELINE ─────────────────────────────────────── */}
      {rest.length > 0 && (
        <section className="mb-6">
          <h2 className="hq-label mb-3" style={{ color: "var(--color-sand)" }}>
            {restLabel}
          </h2>
          <div className="flex flex-col gap-5">
            {rest.map((r, i) => (
              <RequestCard key={r.id} request={r as PlanningRequest} canDeploy={false} i={i} />
            ))}
          </div>
        </section>
      )}

      {/* ── DEPLOYED ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="hq-label mb-3" style={{ color: "var(--color-sand)" }}>
          Recently deployed
        </h2>
        <Panel tier="quiet">
          {deployed.length === 0 ? (
            <Nil>Nothing deployed from a muster yet</Nil>
          ) : (
            <div className="flex flex-col">
              {deployed.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-rule/60 py-2.5 last:border-0"
                >
                  <span className="w-6 shrink-0 text-center">{r.emoji}</span>
                  <span className="hq-readout min-w-0 flex-1 truncate text-[15px] font-bold uppercase tracking-[0.02em]">
                    {r.title}
                  </span>
                  <span className="hq-mono shrink-0 text-[12px] uppercase tracking-[0.08em] text-ink-soft">
                    {r.deployed?.iso}
                    {r.deployed?.time ? ` · ${r.deployed.time.slice(0, 5)}` : ""}
                  </span>
                  <Tag tone="live">Deployed</Tag>
                  {r.deployed?.compId && (
                    <Link href={`/hq/operations/${r.deployed.compId}`} className="hq-label hover:text-ink">
                      Open →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}
