import Link from "next/link";
import { gameById } from "@/lib/games";
import { Panel, Stat, Dot, Tag, PageHead, Nil, Proto } from "@/components/hq/Kit";
import { Stepper } from "@/components/hq/battle/Stepper";
import { ChallengeBoard } from "@/components/hq/battle/ChallengeBoard";
import {
  BATTLES,
  CHALLENGES,
  NETWORK_FEED,
  ORGS,
  STAGES,
  STAGE_BLURB,
  orgById,
  series,
  stageIndex,
  type Battle,
} from "@/lib/hq/future/network";

export const metadata = { title: "Battles · Barracks HQ" };

// ── Battles ────────────────────────────────────────────────────────────────
// The whole cross-Barracks pipeline on one board. A challenge and a battle are
// the same object at different stages, so the lifecycle — all ten stages of it —
// is drawn on every card. You should be able to tell what a battle is waiting
// on without opening it.

const LIVE_IDX = stageIndex("live");

function BattleCard({ b, i }: { b: Battle; i: number }) {
  const org = orgById(b.org);
  const g = gameById(b.game);
  const s = series(b);
  const idx = stageIndex(b.stage);
  const roomOpen = idx >= stageIndex("room_open");
  const done = b.stage === "archived";
  const won = s.us > s.them;

  return (
    <article
      className="hq-rise rounded-[3px] border border-rule p-3.5"
      style={{
        ["--i" as string]: i,
        borderColor: b.stage === "live" ? "color-mix(in srgb, var(--color-moss) 45%, transparent)" : undefined,
        backgroundColor: b.stage === "live" ? "rgba(61,220,132,0.04)" : undefined,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Dot tone={b.stage === "live" ? "live" : done ? "idle" : "warn"} pulse={b.stage === "live"} />
            <span className="hq-readout text-[19px] font-bold uppercase leading-none">
              The Barracks <span className="text-ink-soft">vs</span> {org?.name}
            </span>
            {b.stage === "live" && <Tag tone="live" solid>Live</Tag>}
            {b.stage === "captain_confirmation" && <Tag tone="warn">Signature due</Tag>}
            {done && (
              <Tag tone={won ? "live" : "alert"}>
                {won ? "Won" : "Lost"} {s.us}–{s.them}
              </Tag>
            )}
          </div>
          <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
            {g.emoji} {g.name} · {b.format} · {b.scheduled} · {b.id.toUpperCase()}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {(idx >= LIVE_IDX || done) && (
            <div className="text-right">
              <div className="hq-readout text-[26px] font-bold leading-none">
                <span style={{ color: s.us >= s.them ? "var(--color-moss)" : "var(--color-ink)" }}>{s.us}</span>
                <span className="text-ink-soft"> — </span>
                <span style={{ color: s.them > s.us ? "var(--color-flag)" : "var(--color-ink)" }}>{s.them}</span>
              </div>
              <p className="hq-label mt-1">Series</p>
            </div>
          )}
          <Link
            href={`/hq/battles/${b.id}`}
            className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-sand hover:text-ink"
          >
            {roomOpen ? "Open room →" : "Details →"}
          </Link>
        </div>
      </div>

      <div className="mt-3.5">
        <Stepper stage={b.stage} />
      </div>

      <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[11px] tracking-[0.06em] text-ink-soft">
        <span style={{ color: b.stage === "live" ? "var(--color-moss)" : "var(--color-sand)" }}>
          {STAGES[idx]?.label.toUpperCase()}
        </span>{" "}
        — {b.note ?? STAGE_BLURB[b.stage]}
      </p>
    </article>
  );
}

export default function BattlesPage() {
  const active = BATTLES.filter((b) => b.stage !== "archived");
  const archived = BATTLES.filter((b) => b.stage === "archived");
  const live = active.filter((b) => b.stage === "live");
  const awaiting = CHALLENGES.filter((c) => c.stage === "challenge");
  const scheduling = CHALLENGES.filter((c) => c.stage === "scheduling" || c.stage === "accepted");
  const signature = active.filter((b) => b.stage === "captain_confirmation");

  const record = archived.reduce(
    (acc, b) => {
      const s = series(b);
      if (s.us > s.them) acc.w++;
      else acc.l++;
      return acc;
    },
    { w: 0, l: 0 },
  );

  const orgs = Object.fromEntries(
    ORGS.map((o) => [o.id, { name: o.name, tag: o.tag, region: o.region, timezone: o.timezone }]),
  );
  const gameNames = Object.fromEntries(
    [...ORGS.map((o) => o.game), ...CHALLENGES.map((c) => c.game)].map((id) => [id, gameById(id).name]),
  );

  // How many engagements sit at each stage — the pipeline as a count, not a
  // list. Challenges only count before "confirmed"; after that they're battles.
  const perStage = STAGES.map((s) => ({
    ...s,
    n:
      BATTLES.filter((b) => b.stage === s.key).length +
      (stageIndex(s.key) < stageIndex("confirmed")
        ? CHALLENGES.filter((c) => c.stage === s.key).length
        : 0),
  }));

  return (
    <div>
      <PageHead
        eyebrow="Network"
        title="Battles"
        right={
          <>
            <Proto />
            <Link
              href="/hq/find-opponent"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              + Issue challenge
            </Link>
            <Link
              href="/hq/rivals"
              className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink"
            >
              Rivals
            </Link>
          </>
        }
      >
        Clan versus clan. Every engagement runs the same ten-stage lifecycle, from the
        challenge landing to both Captains signing the result.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Panel i={0}>
          <Stat value={live.length} label="Live now" tone={live.length ? "live" : undefined} sub={live.length ? "Rooms in progress" : "Nothing in progress"} />
        </Panel>
        <Panel i={1}>
          <Stat value={awaiting.length} label="Awaiting our answer" tone={awaiting.length ? "alert" : undefined} />
        </Panel>
        <Panel i={2}>
          <Stat value={scheduling.length} label="In scheduling" tone={scheduling.length ? "warn" : undefined} />
        </Panel>
        <Panel i={3}>
          <Stat value={active.filter((b) => b.stage === "confirmed" || b.stage === "room_open" || b.stage === "roll_call").length} label="Confirmed ahead" />
        </Panel>
        <Panel i={4}>
          <Stat value={signature.length} label="Awaiting signature" tone={signature.length ? "warn" : undefined} />
        </Panel>
        <Panel i={5}>
          <Stat value={`${record.w}–${record.l}`} label="Network record" sub={`${archived.length} battles archived`} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          <Panel
            i={6}
            label="Challenge traffic"
            status={<Dot tone={awaiting.length ? "alert" : "idle"} pulse={awaiting.length > 0} />}
            right={<Proto />}
          >
            <ChallengeBoard
              challenges={CHALLENGES.filter((c) => stageIndex(c.stage) < stageIndex("confirmed"))}
              orgs={orgs}
              gameNames={gameNames}
            />
          </Panel>

          <Panel
            i={7}
            label="Battle board"
            status={<Dot tone={live.length ? "live" : "warn"} pulse={live.length > 0} />}
            right={<span className="hq-mono text-[11px] text-ink-soft">{active.length} active</span>}
          >
            {active.length === 0 ? (
              <Nil>No battles on the board</Nil>
            ) : (
              <div className="flex flex-col gap-3">
                {active
                  .slice()
                  .sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage))
                  .map((b, i) => (
                    <BattleCard key={b.id} b={b} i={i} />
                  ))}
              </div>
            )}
          </Panel>

          <Panel i={8} label="Archived" right={<Link href="/hq/rivals" className="hq-label hover:text-ink">Rivalries →</Link>}>
            {archived.length === 0 ? (
              <Nil>Nothing archived yet</Nil>
            ) : (
              <div className="flex flex-col">
                {archived.map((b) => {
                  const org = orgById(b.org);
                  const s = series(b);
                  const won = s.us > s.them;
                  return (
                    <Link
                      key={b.id}
                      href={`/hq/battles/${b.id}`}
                      className="flex items-center gap-4 border-b border-rule/60 py-2.5 last:border-0 transition-colors hover:bg-[rgba(255,255,255,0.025)]"
                    >
                      <span className="hq-mono w-20 shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                        {b.id.toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {org?.name}
                        <span className="hq-mono ml-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          {b.format} · {b.scheduled}
                        </span>
                      </span>
                      <span className="hq-mono w-24 shrink-0 text-right text-[13px] font-bold" style={{ color: won ? "var(--color-moss)" : "var(--color-flag)" }}>
                        {won ? "WON" : "LOST"} {s.us}–{s.them}
                      </span>
                      <Tag tone="info">Signed off</Tag>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={9} label="Lifecycle" right={<Proto />}>
            <p className="mb-3 text-[13px] text-ink-soft">
              Every battle walks the same road. Nothing skips a stage, and nothing counts
              until the last one.
            </p>
            <ol className="flex flex-col">
              {perStage.map((s, i) => (
                <li key={s.key} className="flex items-start gap-2.5 border-b border-rule/50 py-1.5 last:border-0">
                  <span className="hq-mono w-5 shrink-0 text-[10px] text-ink-soft">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="hq-mono block text-[11px] font-semibold uppercase tracking-[0.12em]">
                      {s.label}
                    </span>
                    <span className="block text-[11px] text-ink-soft">{STAGE_BLURB[s.key]}</span>
                  </span>
                  {s.n > 0 && (
                    <span
                      className="hq-mono shrink-0 rounded-[3px] px-1.5 text-[10px] font-bold"
                      style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
                    >
                      {s.n}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel i={10} label="Network activity" status={<Dot tone="live" pulse />} right={<Proto />}>
            <ul className="flex flex-col">
              {NETWORK_FEED.map((f, i) => (
                <li
                  key={`${f.at}-${i}`}
                  className="hq-rise flex items-center gap-3 border-b border-rule/50 py-1.5 last:border-0"
                  style={{ ["--i" as string]: i }}
                >
                  <Dot tone={f.tone} />
                  <span className="hq-mono min-w-0 flex-1 truncate text-[11px] tracking-[0.06em]">{f.text}</span>
                  <span className="hq-mono shrink-0 text-[10px] text-ink-soft">{f.at}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel i={11} label="Rules of engagement">
            <ul className="flex flex-col gap-2">
              {[
                "A battle is between two Barracks — never two individuals.",
                "Both Captains must sign a result before it enters history.",
                "Evidence is required from both sides for every game.",
                "The system compares scorecards. The Captains decide.",
              ].map((r) => (
                <li key={r} className="flex gap-2 text-[13px] text-ink-soft">
                  <span style={{ color: "var(--color-sand)" }}>·</span>
                  <span className="min-w-0">{r}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
