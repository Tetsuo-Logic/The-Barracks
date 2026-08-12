import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Proto } from "@/components/hq/Kit";
import { LINK, ADAPTERS, CAPTURE_MODES } from "@/lib/hq/future/systems";

export const metadata = { title: "Barracks Link · Barracks HQ" };

// ── Barracks Link ───────────────────────────────────────────────────────────
// The desktop companion that would watch the machine so nobody has to type the
// score in: process detection, OBS, evidence capture. Entirely prototype — the
// adapter is lib/hq/future/systems.ts (LINK / ADAPTERS / CAPTURE_MODES).

const STATE_TONE = {
  Supported: "live",
  Beta: "warn",
  Fallback: "idle",
} as const;

export default async function LinkPage() {
  const profile = await requireProfile();

  const lights = [
    { label: "Barracks Link", value: LINK.online ? "SYSTEM ONLINE" : "OFFLINE", on: LINK.online },
    { label: "Game detection", value: `${LINK.detected.toUpperCase()} DETECTED`, on: Boolean(LINK.detected) },
    { label: "Capture", value: LINK.obs ? "OBS READY" : "NO CAPTURE", on: LINK.obs },
    { label: "Battle link", value: LINK.battleLinked ? "BATTLE LINKED" : "NOT LINKED", on: LINK.battleLinked },
  ];

  return (
    <div>
      <PageHead
        eyebrow="System"
        title="Barracks Link"
        right={
          <>
            <button
              type="button"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              Download companion
            </button>
            <Proto />
          </>
        }
      >
        A small desktop companion for the machine you actually play on. It watches for the game,
        talks to OBS, and files the evidence — so a result lands in the Operation Room without
        anyone typing it.
      </PageHead>

      {/* ── Status lights ────────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {lights.map((l, i) => (
          <Panel key={l.label} i={i}>
            <div className="flex items-center gap-2">
              <Dot tone={l.on ? "live" : "idle"} pulse={l.on} />
              <span className="hq-label">{l.label}</span>
            </div>
            <p
              className="hq-readout mt-2 text-[19px] font-bold leading-none tracking-[0.02em]"
              style={{ color: l.on ? "var(--color-moss)" : "var(--color-ink-soft)" }}
            >
              {l.value}
            </p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* ── Event log ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel
            i={4}
            sweep
            label="Link event log"
            status={<Dot tone="live" pulse />}
            right={
              <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                {LINK.host} · session live
              </span>
            }
          >
            <div className="rounded-[3px] border border-rule bg-[rgba(0,0,0,0.3)] p-3">
              <ul className="flex flex-col gap-1">
                {LINK.log.map((l, i) => (
                  <li
                    key={`${l.t}-${i}`}
                    className="hq-rise hq-mono flex items-baseline gap-3 text-[11.5px] tracking-[0.06em]"
                    style={{ ["--i" as string]: i }}
                  >
                    <span className="shrink-0 text-ink-soft">{l.t}</span>
                    <span
                      className="min-w-0"
                      style={{
                        color:
                          l.tone === "live"
                            ? "var(--color-moss)"
                            : l.tone === "warn"
                              ? "var(--color-sand)"
                              : "var(--color-ink)",
                      }}
                    >
                      {l.m}
                    </span>
                  </li>
                ))}
                <li className="hq-mono flex items-baseline gap-3 text-[11.5px] tracking-[0.06em] text-ink-soft">
                  <span className="shrink-0">&nbsp;</span>
                  <span className="hq-caret">LISTENING</span>
                </li>
              </ul>
            </div>
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              The log is what the companion would report back to Headquarters — process matches,
              capture state, and every piece of evidence it files against an operation.
            </p>
          </Panel>

          {/* ── Game adapters ────────────────────────────────────────────── */}
          <Panel
            i={5}
            label="Game adapters"
            right={
              <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                {ADAPTERS.filter((a) => a.state === "Supported").length} supported ·{" "}
                {ADAPTERS.filter((a) => a.state === "Beta").length} beta
              </span>
            }
          >
            <div className="mb-2 grid grid-cols-[1.1fr_1.6fr_auto] gap-3 border-b border-rule pb-2">
              <span className="hq-label">Game</span>
              <span className="hq-label">Detection</span>
              <span className="hq-label text-right">State</span>
            </div>
            <ul className="flex flex-col">
              {ADAPTERS.map((a, i) => (
                <li
                  key={a.game}
                  className="hq-rise grid grid-cols-[1.1fr_1.6fr_auto] items-center gap-3 border-b border-rule/50 py-2.5 last:border-0"
                  style={{ ["--i" as string]: i }}
                >
                  <span className="hq-readout truncate text-[14px] font-bold uppercase tracking-[0.04em]">
                    {a.game}
                  </span>
                  <span className="hq-mono truncate text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                    {a.detect}
                  </span>
                  <span className="text-right">
                    <Tag tone={STATE_TONE[a.state]} solid={a.state === "Supported"}>
                      {a.state}
                    </Tag>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* ── Right column ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={6} label="Companion">
            <Row k="Version" v={LINK.version} tone="warn" />
            <Row k="Host" v={LINK.host} />
            <Row k="Operative" v={profile.nickname || profile.name} />
            <Row k="OBS websocket" v={LINK.obs ? "Connected" : "Not found"} tone={LINK.obs ? "live" : "idle"} />
            <Row k="Game capture" v={LINK.captureActive ? "Active" : "Idle"} tone={LINK.captureActive ? "live" : "idle"} />
            <Row k="Detected process" v={LINK.detected} tone="live" />
            <Row k="Battle" v={LINK.battleLinked ? "Linked · Battle 118" : "Not linked"} tone={LINK.battleLinked ? "live" : "idle"} />
            <div className="mt-3">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="hq-label">Capture confidence</span>
                <span className="hq-mono text-[11px]" style={{ color: "var(--color-moss)" }}>
                  94%
                </span>
              </div>
              <Meter pct={94} tone="live" />
            </div>
          </Panel>

          <Panel i={7} label="Capture modes" right={<Proto />}>
            <ul className="flex flex-col">
              {CAPTURE_MODES.map((m) => {
                const active = m === "Barracks Link";
                const fallback = m === "Manual";
                return (
                  <li
                    key={m}
                    className="flex items-center gap-3 border-b border-rule/60 py-2 last:border-0"
                  >
                    <span
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[8px]"
                      style={{
                        borderColor: active ? "var(--color-moss)" : "var(--color-rule)",
                        backgroundColor: active ? "var(--color-moss)" : "transparent",
                        color: "#0b100e",
                      }}
                    >
                      {active ? "✓" : ""}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-[13px]"
                      style={{ color: active ? "var(--color-ink)" : "var(--color-ink-soft)" }}
                    >
                      {m}
                    </span>
                    {active && <Tag tone="live">Selected</Tag>}
                    {fallback && <Tag tone="idle">Always available</Tag>}
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel i={8} label="Manual is the fallback" status={<Dot tone="warn" />}>
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Every automatic route falls back to a human. If the companion isn&apos;t installed, the
              game isn&apos;t recognised, or the capture is wrong, someone in the Operation Room types
              the result and the Barracks moves on. Detection is a convenience —{" "}
              <span className="text-ink">never a dependency</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tag tone="live">Manual entry</Tag>
              <Tag tone="live">Photo evidence</Tag>
              <Tag tone="warn">Captain override</Tag>
              <Tag tone="idle">Auto capture · beta</Tag>
            </div>
            <Link
              href="/hq/modules"
              className="hq-label mt-4 inline-block rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-sand hover:text-ink"
            >
              Modules →
            </Link>
          </Panel>

          <Panel i={9}>
            <Stat value={CAPTURE_MODES.length} label="Capture routes" sub="one of them is a person" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
