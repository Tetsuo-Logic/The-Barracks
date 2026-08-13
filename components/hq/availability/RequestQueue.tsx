import Link from "next/link";
import { Dot, Tag } from "@/components/hq/Kit";
import type { PlanningRequest } from "@/lib/hq/planning";

// The work queue: only what the role currently has something to do about.
// Deliberately small. Anything at another stage is reachable through the
// lifecycle filter above it, not by listing the whole Barracks here.

export type QueueItem = { r: PlanningRequest; href: string; active: boolean };

/** What this role is being asked to do about it. */
function cta(r: PlanningRequest, isPresident: boolean): string {
  if (isPresident) {
    if (r.stage === "submitted") {
      const ready = r.top?.meets && r.total > 0 && r.reported >= r.total;
      return ready ? "Ready" : "Review";
    }
    if (r.stage === "deployed") return "Deployed";
    return "Review";
  }
  switch (r.stage) {
    case "requested":
      return "Call muster";
    case "open":
      return "Review";
    case "ready":
      return "Submit to command";
    case "submitted":
      return "With command";
    default:
      return "Deployed";
  }
}

/** One line of plain fact under the title. */
function line(r: PlanningRequest, isPresident: boolean): string {
  if (r.stage === "deployed" && r.deployed) {
    return `Deployed ${r.deployed.iso}${r.deployed.time ? ` · ${r.deployed.time.slice(0, 5)}` : ""}`;
  }
  if (isPresident) {
    const when = r.top ? `${r.top.dow} ${r.top.day} ${r.top.mon} · ${r.top.from}` : "No overlap yet";
    return `${r.squadName} · ${r.reported}/${r.total} · ${when}`;
  }
  switch (r.stage) {
    case "requested":
      return "Request received";
    case "open":
      return `Muster ${r.reported}/${r.total} reported`;
    case "ready":
      return "Muster complete";
    case "submitted":
      return "Awaiting the President";
    default:
      return `${r.reported}/${r.total} reported`;
  }
}

export function RequestQueue({
  label,
  items,
  isPresident,
  empty,
}: {
  label: string;
  items: QueueItem[];
  isPresident: boolean;
  empty: string;
}) {
  return (
    <section className="hq-panel hq-rise">
      <header className="hq-panel-head">
        <div className="flex min-w-0 items-center gap-2">
          <Dot tone={items.length ? "alert" : "live"} pulse={items.length > 0} />
          <h2 className="hq-label truncate">{label}</h2>
        </div>
        <span
          className="hq-readout shrink-0 text-[15px] font-bold"
          style={{ color: items.length ? "var(--color-flag)" : "var(--color-moss)" }}
        >
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <div className="flex min-h-[120px] flex-col items-center justify-center px-5 text-center">
          <span className="text-[22px]" aria-hidden>
            ✓
          </span>
          <p
            className="hq-readout mt-1.5 text-[15px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--color-moss)" }}
          >
            All clear
          </p>
          <p className="hq-label mt-1 opacity-70">{empty}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-rule/60">
          {items.map(({ r, href, active }) => (
            <li key={r.id}>
              <Link
                href={href}
                scroll={false}
                className="group flex items-start gap-3 px-4 py-3 transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: "rgba(245,182,61,0.09)",
                        boxShadow: "inset 2px 0 0 var(--color-sand)",
                      }
                    : undefined
                }
              >
                <span className="mt-[3px] w-5 shrink-0 text-center text-[14px]" aria-hidden>
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="hq-readout block truncate text-[15px] font-bold uppercase tracking-[0.02em]">
                    {r.title}
                  </span>
                  <span className="hq-mono mt-1 block truncate text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                    {line(r, isPresident)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className="hq-label transition-opacity"
                    style={{
                      opacity: active ? 1 : 0.75,
                      color: active ? "var(--color-sand)" : undefined,
                    }}
                  >
                    {cta(r, isPresident)} →
                  </span>
                  {r.top && !r.top.meets && <Tag tone="warn">Short</Tag>}
                  {r.top && r.top.conflicted > 0 && <Tag tone="alert">Clash</Tag>}
                  {r.demo && (
                    <span
                      className="hq-mono rounded-[3px] border border-dashed px-1 py-0.5 text-[8px] uppercase tracking-[0.14em]"
                      style={{ borderColor: "#4b5a52", color: "#6d8076" }}
                    >
                      demo
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
