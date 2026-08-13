"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tag, Meter, Proto } from "@/components/hq/Kit";
import { GameInsignia } from "@/components/hq/GameInsignia";
import { approveMuster } from "@/app/actions/musters";
import type { PlanningRequest, Stage } from "@/lib/hq/planning";
import type { Option } from "./recommend";

// The detail pane: one request, opened beside the queue.
//
// Answer first, evidence second — but the evidence is laid out rather than
// hidden behind toggles. On a widescreen there's room for it, and a President
// deciding whether to deploy shouldn't have to click twice to see why.

const STAGE_STYLE: Record<Stage, { label: string; tone: "live" | "warn" | "alert" | "info" }> = {
  requested: { label: "Requested", tone: "info" },
  open: { label: "Muster open", tone: "info" },
  ready: { label: "Ready", tone: "warn" },
  submitted: { label: "Awaiting deployment", tone: "alert" },
  deployed: { label: "Deployed", tone: "live" },
};

function Tick({ ok }: { ok: boolean }) {
  return (
    <span
      className="hq-mono mt-[1px] w-3.5 shrink-0 text-[13px] font-bold leading-none"
      style={{ color: ok ? "var(--color-moss)" : "var(--color-flag)" }}
      aria-hidden
    >
      {ok ? "✓" : "✕"}
    </span>
  );
}

/** The date/time plate — the same issued-stock treatment as the HQ hero. */
function Plate({ o }: { o: Option }) {
  return (
    <div
      className="shrink-0 text-center"
      style={{
        border: "1px solid color-mix(in srgb, var(--color-sand) 45%, transparent)",
        borderRadius: 3,
        background: "rgba(245,182,61,0.06)",
        minWidth: 132,
      }}
    >
      <div
        className="hq-mono py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em]"
        style={{
          borderBottom: "1px solid color-mix(in srgb, var(--color-sand) 30%, transparent)",
          color: "var(--color-sand)",
        }}
      >
        {o.dow}
      </div>
      <div className="hq-readout py-2.5 text-[44px] font-bold leading-none">{o.day}</div>
      <div className="hq-mono pb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-ink-soft">
        {o.mon}
      </div>
      <div
        className="hq-readout py-2 text-[27px] font-bold"
        style={{
          borderTop: "1px solid color-mix(in srgb, var(--color-sand) 30%, transparent)",
          color: "var(--color-sand)",
        }}
      >
        {o.from}
      </div>
    </div>
  );
}

/** A titled box. The evidence sits in these rather than behind a disclosure. */
function Box({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="hq-panel">
      <header className="hq-panel-head">
        <h3 className="hq-label truncate">{label}</h3>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function RequestDetail({
  request: r,
  canDeploy,
  evidenceHref,
}: {
  request: PlanningRequest;
  /** President only — Captains read the same pane but can't deploy from it. */
  canDeploy: boolean;
  evidenceHref: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const stage = STAGE_STYLE[r.stage];
  const top = r.top;
  const reportedAll = r.total > 0 && r.reported >= r.total;

  function deploy(o: Option) {
    setError(null);
    if (!r.musterId) {
      setError("Prototype request — there's no muster behind it to deploy.");
      return;
    }
    start(async () => {
      const res = await approveMuster(r.musterId!, o.iso, o.from);
      if (!res.ok) setError(res.error ?? "Couldn't deploy the operation.");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Identity + the answer ──────────────────────────────────────── */}
      <section className="hq-panel hq-panel-primary hq-rise">
        <header className="flex flex-wrap items-start gap-x-5 gap-y-3 px-5 py-4">
          <GameInsignia game={r.game} size={46} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="hq-readout text-[30px] font-bold uppercase leading-none tracking-[0.01em]">
                {r.title}
              </h2>
              {r.tag && <Tag>{r.tag}</Tag>}
              {r.demo && <Proto>Demo</Proto>}
            </div>
            <p
              className="hq-mono mt-2 text-[11px] uppercase tracking-[0.14em]"
              style={{ color: "var(--color-sand)" }}
            >
              {r.squadName}
              {r.submittedBy && <span className="text-ink-soft"> · submitted by {r.submittedBy}</span>}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <Tag tone={stage.tone} solid={r.stage === "submitted"}>
              {stage.label}
            </Tag>
            {r.total > 0 && r.stage !== "deployed" && (
              <div className="mt-2">
                <span
                  className="hq-readout text-[19px] font-bold leading-none"
                  style={{ color: reportedAll ? "var(--color-moss)" : "var(--color-sand)" }}
                >
                  {r.reported}/{r.total}
                </span>
                <span className="hq-label ml-1.5">reported</span>
                <div className="mt-1.5 w-[124px]">
                  <Meter pct={r.total ? (r.reported / r.total) * 100 : 0} tone={reportedAll ? "live" : "warn"} />
                </div>
              </div>
            )}
          </div>
        </header>

        {top ? (
          <div
            className="px-5 py-5"
            style={{ borderTop: "1px solid color-mix(in srgb, var(--color-sand) 26%, transparent)" }}
          >
            <p className="hq-label mb-3.5" style={{ color: "var(--color-sand)" }}>
              Barracks recommends
            </p>

            <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
              <Plate o={top} />

              <div className="min-w-0 flex-1">
                <ul className="flex flex-col gap-1.5">
                  <li className="hq-readout text-[23px] font-bold uppercase leading-none tracking-[0.02em]">
                    {top.count}/{top.total} available
                  </li>
                  <li
                    className="hq-mono text-[12px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: top.clashes.length === 0 ? "var(--color-moss)" : "var(--color-flag)" }}
                  >
                    {top.clashes.length === 0
                      ? "No calendar conflicts"
                      : `${top.conflicted || top.clashes.length} calendar conflict${(top.conflicted || top.clashes.length) === 1 ? "" : "s"}`}
                  </li>
                  <li
                    className="hq-mono text-[12px] font-semibold uppercase tracking-[0.14em]"
                    style={{ color: top.meets ? "var(--color-moss)" : "var(--color-flag)" }}
                  >
                    {top.meets
                      ? `Strength met · ${top.required} required`
                      : `${top.required - top.count} short of strength`}
                  </li>
                  <li className="hq-mono text-[12px] uppercase tracking-[0.14em] text-ink-soft">
                    {top.from}–{top.to} · {top.coverage}% coverage
                  </li>
                </ul>

                {r.bumped && (
                  <p
                    className="mt-3 rounded-[3px] border px-3 py-2 text-[13px]"
                    style={{
                      borderColor: "color-mix(in srgb, var(--color-flag) 40%, transparent)",
                      backgroundColor: "rgba(255,91,59,0.06)",
                    }}
                  >
                    <span className="hq-label" style={{ color: "var(--color-flag)" }}>
                      Moved off {r.bumped.was.dow} {r.bumped.was.from}
                    </span>
                    <span className="mt-0.5 block">{r.bumped.why}.</span>
                  </p>
                )}

                {r.captainPick && (
                  <p className="hq-mono mt-2.5 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                    Captain proposed {r.captainPick.label}
                  </p>
                )}
              </div>

              {canDeploy && (
                <div className="shrink-0">
                  <button
                    onClick={() => deploy(top)}
                    disabled={pending}
                    className="hq-readout rounded-[3px] px-6 py-4 text-[15px] font-bold uppercase tracking-[0.1em] transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                  >
                    {pending ? "Deploying…" : "Deploy operation"}
                  </button>
                  <p className="hq-label mt-2 text-center opacity-70">
                    {top.dow} {top.day} {top.mon} · {top.from}
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className="hq-mono mt-3 text-[12px]" style={{ color: "var(--color-flag)" }}>
                {error}
              </p>
            )}
          </div>
        ) : (
          <div
            className="px-5 py-5"
            style={{ borderTop: "1px solid color-mix(in srgb, var(--color-sand) 26%, transparent)" }}
          >
            {r.stage === "deployed" && r.deployed ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-[15px]">
                  Deployed for{" "}
                  <span className="hq-readout text-[17px] font-bold" style={{ color: "var(--color-moss)" }}>
                    {r.deployed.iso}
                    {r.deployed.time ? ` · ${r.deployed.time.slice(0, 5)}` : ""}
                  </span>
                </p>
                {r.deployed.compId && (
                  <Link href={`/hq/operations/${r.deployed.compId}`} className="hq-label hover:text-ink">
                    Open operation →
                  </Link>
                )}
              </div>
            ) : r.stage === "requested" ? (
              <>
                <p className="text-[15px]">
                  {r.submittedBy ?? "An operative"} has asked {r.captainName} for a night.
                </p>
                {r.note && <p className="mt-1.5 text-[13px] text-ink-soft">“{r.note}”</p>}
                <p className="hq-mono mt-3 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                  Nothing to plan until the Captain calls a muster.
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px]">
                  Nothing overlaps yet — {r.outstanding.length} operative
                  {r.outstanding.length === 1 ? " hasn't" : "s haven't"} reported.
                </p>
                {r.outstanding.length > 0 && (
                  <p className="hq-mono mt-2 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                    Waiting on: {r.outstanding.join(" · ")}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* ── The evidence, laid out ─────────────────────────────────────── */}
      {top && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Box label={`Why ${top.dow} ${top.day} ${top.mon} · ${top.from}`}>
            <ul className="flex flex-col gap-2">
              {top.checks.map((c, n) => (
                <li key={n} className="flex items-start gap-2.5">
                  <Tick ok={c.ok} />
                  <span className="min-w-0 flex-1 text-[13px]">
                    {c.label}
                    {c.detail && <span className="text-ink-soft"> — {c.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {r.outstanding.length > 0 && (
              <p className="hq-mono mt-3 border-t border-rule pt-3 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                Not reported: {r.outstanding.join(" · ")}
              </p>
            )}
            {r.note && <p className="mt-3 text-[13px] text-ink-soft">“{r.note}”</p>}
          </Box>

          <Box
            label="Other options"
            right={
              <Link href={evidenceHref} className="hq-label hover:text-ink">
                Full availability →
              </Link>
            }
          >
            <ol className="flex flex-col gap-2">
              {r.options.map((o, n) => (
                <li
                  key={o.key}
                  className="rounded-[3px] border px-3 py-2.5"
                  style={{
                    borderColor:
                      n === 0 ? "color-mix(in srgb, var(--color-sand) 45%, transparent)" : "var(--color-rule)",
                    backgroundColor: n === 0 ? "rgba(245,182,61,0.05)" : "transparent",
                  }}
                >
                  <div className="flex items-baseline gap-2.5">
                    <span
                      className="hq-readout w-4 shrink-0 text-[15px] font-bold leading-none"
                      style={{ color: n === 0 ? "var(--color-sand)" : "var(--color-ink-soft)" }}
                    >
                      {n + 1}
                    </span>
                    <span className="hq-readout min-w-0 flex-1 truncate text-[15px] font-bold uppercase tracking-[0.03em]">
                      {o.dow} {o.day} {o.mon} · {o.from}
                    </span>
                    {n === 0 ? (
                      <Tag tone={o.meets ? "live" : "warn"} solid>
                        {o.count}/{o.total}
                      </Tag>
                    ) : (
                      <Tag tone={o.meets ? "live" : "warn"}>
                        {o.count}/{o.total}
                      </Tag>
                    )}
                  </div>
                  <div className="mt-2 pl-[26px]">
                    <Meter pct={o.coverage} tone={o.meets ? "live" : "warn"} />
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[12px] text-ink-soft">{o.headline}</span>
                      {n > 0 && canDeploy && (
                        <button
                          onClick={() => deploy(o)}
                          disabled={pending}
                          className="hq-label shrink-0 rounded-[3px] border px-2.5 py-1 transition-colors hover:text-ink disabled:opacity-50"
                          style={{ borderColor: "var(--color-rule)" }}
                        >
                          Deploy this
                        </button>
                      )}
                    </div>
                    {o.clashes.length > 0 && (
                      <p
                        className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.08em]"
                        style={{ color: "var(--color-flag)" }}
                      >
                        {o.clashes.map((c) => `${c.emoji} ${c.title} ${c.time}`).join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Box>
        </div>
      )}
    </div>
  );
}
