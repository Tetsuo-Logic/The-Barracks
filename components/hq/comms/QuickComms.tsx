"use client";

import { useState } from "react";
import Link from "next/link";
import { Portal } from "@/components/hq/Portal";
import { relativeTime } from "@/lib/dates";
import { KIND_LABEL } from "./kinds";
import type { QuickTransmission } from "@/lib/hq/comms";

// The radio. Comms from anywhere in HQ, as a right-hand drawer — recent
// traffic and whatever still wants an answer from you.
//
// Not a notification centre. Action Required on Headquarters is what tells you
// there's work; this is a quick way to hear the PA without leaving the page
// you're on.

export function QuickComms({ items, awaiting }: { items: QuickTransmission[]; awaiting: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={awaiting > 0 ? `${awaiting} transmission(s) awaiting your reply` : "Comms"}
        aria-label="Open comms"
        className="hq-label relative rounded-[3px] border px-2.5 py-1.5 transition-colors"
        style={{
          borderColor:
            awaiting > 0 ? "var(--color-flag)" : "color-mix(in srgb, var(--color-sand) 40%, transparent)",
          color: awaiting > 0 ? "var(--color-flag)" : "var(--color-sand)",
        }}
      >
        📻 Comms
        {awaiting > 0 && (
          <span
            className="hq-mono absolute -right-1.5 -top-1.5 rounded-full px-1.5 text-[9px] font-bold"
            style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
          >
            {awaiting}
          </span>
        )}
      </button>

      {open && (
        <Portal>
          <button
            className="fixed inset-0 z-[70] cursor-default"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setOpen(false)}
            aria-label="Close comms"
          />
          <aside
            /* No hq-rise here: it lifts on entry, which reads as a panel
               settling rather than a drawer arriving from the edge. */
            className="fixed right-0 top-0 z-[71] flex h-full w-[380px] max-w-[92vw] flex-col border-l border-rule"
            style={{ background: "#0b100e" }}
          >
            <header className="hq-panel-head shrink-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="hq-dot hq-dot-live" style={{ backgroundColor: "var(--color-moss)" }} />
                <h2 className="hq-label truncate">
                  {awaiting > 0 ? "Incoming transmission" : "Comms"}
                </h2>
              </div>
              <button onClick={() => setOpen(false)} className="hq-label hover:text-ink" aria-label="Close">
                ✕
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="hq-mono px-4 py-10 text-center text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Quiet on the net
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-rule/60">
                  {items.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/hq/comms?b=${t.id}`}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="hq-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: "var(--color-sand)" }}
                          >
                            {KIND_LABEL[t.kind] ?? t.kind}
                          </span>
                          {t.needsMe && (
                            <span
                              className="hq-mono rounded-[3px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                              style={{ backgroundColor: "var(--color-flag)", color: "#0b100e" }}
                            >
                              Reply
                            </span>
                          )}
                          <span className="hq-mono ml-auto shrink-0 text-[10px] text-ink-soft">
                            {relativeTime(t.at)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[14px]">{t.title}</p>
                        {t.preview && (
                          <p className="mt-0.5 truncate text-[12px] text-ink-soft">{t.preview}</p>
                        )}
                        <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          From {t.from}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="shrink-0 border-t border-rule px-4 py-3">
              <Link href="/hq/comms" onClick={() => setOpen(false)} className="hq-label hover:text-ink">
                Open full comms →
              </Link>
            </footer>
          </aside>
        </Portal>
      )}
    </>
  );
}
