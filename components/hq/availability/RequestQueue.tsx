import Link from "next/link";
import { Dot, Tag, type Tone } from "@/components/hq/Kit";
import type { PlanningRequest } from "@/lib/hq/planning";

// The planning inbox. Same job as Action Required on Headquarters: a scannable
// list of what's waiting, where picking one loads it beside rather than
// navigating away. The detail pane is the page; this is how you choose.

export type QueueItem = { r: PlanningRequest; href: string; active: boolean };
export type QueueGroup = { label: string; tone: Tone; items: QueueItem[] };

function line(r: PlanningRequest): string {
  if (r.stage === "deployed" && r.deployed) {
    return `${r.deployed.iso}${r.deployed.time ? ` · ${r.deployed.time.slice(0, 5)}` : ""}`;
  }
  if (r.top) return `${r.top.dow} ${r.top.day} ${r.top.mon} · ${r.top.from} · ${r.top.count}/${r.top.total}`;
  if (r.stage === "requested") return "Awaiting a muster";
  return `${r.reported}/${r.total} reported`;
}

export function RequestQueue({ groups }: { groups: QueueGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups
        .filter((g) => g.items.length > 0)
        .map((g, gi) => (
          <section key={g.label} className="hq-panel hq-rise" style={{ ["--i" as string]: gi }}>
            <header className="hq-panel-head">
              <div className="flex min-w-0 items-center gap-2">
                <Dot tone={g.tone} pulse={g.tone === "alert"} />
                <h2 className="hq-label truncate">{g.label}</h2>
              </div>
              <span
                className="hq-readout shrink-0 text-[15px] font-bold"
                style={{ color: g.tone === "alert" ? "var(--color-flag)" : "var(--color-ink)" }}
              >
                {g.items.length}
              </span>
            </header>

            <ul className="flex flex-col divide-y divide-rule/60">
              {g.items.map(({ r, href, active }) => (
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
                      <span
                        className="hq-mono block text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: "var(--color-sand)" }}
                      >
                        {r.squadName}
                      </span>
                      <span className="hq-readout mt-0.5 block truncate text-[15px] font-bold uppercase tracking-[0.02em]">
                        {r.title}
                      </span>
                      <span className="hq-mono mt-1 block truncate text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                        {line(r)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      {r.demo && (
                        <span
                          className="hq-mono rounded-[3px] border border-dashed px-1 py-0.5 text-[8px] uppercase tracking-[0.14em]"
                          style={{ borderColor: "#4b5a52", color: "#6d8076" }}
                        >
                          demo
                        </span>
                      )}
                      {r.top && !r.top.meets && <Tag tone="warn">Short</Tag>}
                      {r.top && r.top.conflicted > 0 && <Tag tone="alert">Clash</Tag>}
                      <span
                        className="hq-label transition-opacity"
                        style={{ opacity: active ? 1 : 0.45, color: active ? "var(--color-sand)" : undefined }}
                      >
                        {active ? "Open" : "→"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
