"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Panel, Dot, Tag, Nil, Proto } from "@/components/hq/Kit";
import { Stepper } from "@/components/hq/battle/Stepper";
import {
  STAGE_BLURB,
  stageIndex,
  type Battle,
  type ChallengeStage,
} from "@/lib/hq/future/network";
import { CAPTURE_MODES, LINK } from "@/lib/hq/future/systems";

// ── The battle console ─────────────────────────────────────────────────────
// Scoreboard, lifecycle, the games table and — the part that actually matters —
// the result evidence workflow. Both Barracks upload evidence, the system
// compares the two scorecards and offers a verdict, and the two Captains sign
// the series off. The system is an assistant here, never the authority: every
// automatic step has a manual route around it, and that is stated in the UI.
//
// All state is client-side (prototype). Anything marked SIM stands in for the
// other Barracks acting on their own screen.

type Result = "WIN" | "LOSS" | null;
type Verdict = "pending" | "comparing" | "verified" | "review";

type GameState = {
  n: number;
  map?: string;
  ourClaim: Result;
  theirClaim: Result;
  ourEvidence: boolean;
  theirEvidence: boolean;
  verdict: Verdict;
  ruled: boolean; // settled by a Captain rather than by a match
  auto: boolean; // evidence arrived from Barracks Link / OBS
  us: Result;
  them: Result;
};

type LogLine = { t: string; m: string; tone: "live" | "warn" | "alert" | "info" };

function initGames(b: Battle): GameState[] {
  return b.games.map((g) => ({
    n: g.n,
    map: g.map,
    ourClaim: g.ourEvidence ? g.us : null,
    theirClaim: g.theirEvidence ? g.us : null,
    ourEvidence: g.ourEvidence,
    theirEvidence: g.theirEvidence,
    verdict: g.verdict === "verified" ? "verified" : g.verdict === "review" ? "review" : "pending",
    ruled: false,
    auto: false,
    us: g.verdict === "verified" ? g.us : null,
    them: g.verdict === "verified" ? g.them : null,
  }));
}

function initLog(b: Battle): LogLine[] {
  const out: LogLine[] = [];
  for (const g of b.games) {
    if (g.ourEvidence) out.push({ t: "—", m: `EVIDENCE RECEIVED — BARRACKS / GAME ${g.n}`, tone: "info" });
    if (g.theirEvidence) out.push({ t: "—", m: `EVIDENCE RECEIVED — OPPONENT / GAME ${g.n}`, tone: "info" });
    if (g.verdict === "verified") out.push({ t: "—", m: `SCORECARDS MATCH — GAME ${g.n} VERIFIED`, tone: "live" });
  }
  return out.reverse();
}

function clock(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds(),
  ).padStart(2, "0")}`;
}

const btn =
  "hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors";

export function BattleConsole({
  battle,
  us,
  them,
}: {
  battle: Battle;
  us: { name: string; tag: string };
  them: { name: string; tag: string };
}) {
  const [games, setGames] = useState<GameState[]>(() => initGames(battle));
  const [log, setLog] = useState<LogLine[]>(() => initLog(battle));
  const [ourConfirmed, setOurConfirmed] = useState(battle.ourConfirmed);
  const [theirConfirmed, setTheirConfirmed] = useState(battle.theirConfirmed);
  const [mode, setMode] = useState<string>(LINK.online ? CAPTURE_MODES[1] : CAPTURE_MODES[0]);
  const [picking, setPicking] = useState<number | null>(null);
  const [focus, setFocus] = useState<number>(() => {
    const open = battle.games.find((g) => g.verdict !== "verified");
    return open?.n ?? battle.games[0]?.n ?? 1;
  });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gamesRef = useRef(games);
  gamesRef.current = games;

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  const baseIdx = stageIndex(battle.stage);
  const roomLive = baseIdx >= stageIndex("live");
  const readOnly = battle.stage === "archived";
  const interactive = roomLive && !readOnly;
  const need = Math.ceil(battle.bestOf / 2);
  const auto = mode !== "Manual" && LINK.online;

  const score = useMemo(
    () => ({
      us: games.filter((g) => g.us === "WIN").length,
      them: games.filter((g) => g.them === "WIN").length,
    }),
    [games],
  );

  // Verified score is the score. A claimed-but-unverified game shows separately
  // as provisional — visible, but never counted until both cards agree.
  const provisional = useMemo(
    () => ({
      us: games.filter((g) => (g.us === "WIN" ? true : g.us === null && g.ourClaim === "WIN")).length,
      them: games.filter((g) => (g.them === "WIN" ? true : g.us === null && g.ourClaim === "LOSS")).length,
      open: games.filter((g) => g.ourClaim !== null && g.verdict !== "verified").length,
    }),
    [games],
  );

  const decided = score.us >= need || score.them >= need;
  const unsettled = games.some((g) => (g.ourEvidence || g.theirEvidence) && g.verdict !== "verified");

  const stage: ChallengeStage = !interactive
    ? battle.stage
    : ourConfirmed && theirConfirmed
      ? "archived"
      : decided && !unsettled
        ? "captain_confirmation"
        : decided
          ? "result_pending"
          : "live";

  const official = ourConfirmed && theirConfirmed;
  const winner = score.us > score.them ? us : score.them > score.us ? them : null;

  function say(m: string, tone: LogLine["tone"] = "info") {
    setLog((l) => [{ t: clock(), m, tone }, ...l].slice(0, 40));
  }

  /** Both scorecards in → the system compares them and offers a verdict. */
  function compare(n: number, ourClaim: Result, theirClaim: Result) {
    setGames((gs) => gs.map((g) => (g.n === n ? { ...g, verdict: "comparing" } : g)));
    say(`COMPARING SCORECARDS — GAME ${n}`, "warn");
    const match = ourClaim !== null && ourClaim === theirClaim;
    const t = setTimeout(() => {
      setGames((gs) =>
        gs.map((g) =>
          g.n === n
            ? match
              ? { ...g, verdict: "verified" as Verdict, us: ourClaim, them: ourClaim === "WIN" ? ("LOSS" as Result) : ("WIN" as Result) }
              : { ...g, verdict: "review" as Verdict }
            : g,
        ),
      );
      if (match) say(`SCORECARDS MATCH — GAME ${n} VERIFIED`, "live");
      else say(`SCORECARD MISMATCH — GAME ${n} REQUIRES REVIEW`, "alert");
    }, 1500);
    timers.current.push(t);
  }

  function ourUpload(n: number, claim: Result, viaLink = false) {
    setPicking(null);
    setFocus(n);
    setGames((gs) =>
      gs.map((g) => (g.n === n ? { ...g, ourClaim: claim, ourEvidence: true, auto: viaLink } : g)),
    );
    say(
      viaLink
        ? `BARRACKS LINK — EVIDENCE CAPTURED / GAME ${n} (${claim})`
        : `EVIDENCE RECEIVED — BARRACKS / GAME ${n} (${claim})`,
      "live",
    );
    const g = gamesRef.current.find((x) => x.n === n);
    if (g?.theirEvidence) compare(n, claim, g.theirClaim);
  }

  function theirUpload(n: number, agree: boolean) {
    const g = gamesRef.current.find((x) => x.n === n);
    if (!g) return;
    const claim: Result = agree ? g.ourClaim : g.ourClaim === "WIN" ? "LOSS" : "WIN";
    setFocus(n);
    setGames((gs) => gs.map((x) => (x.n === n ? { ...x, theirClaim: claim, theirEvidence: true } : x)));
    say(`EVIDENCE RECEIVED — ${them.name.toUpperCase()} / GAME ${n}`, "live");
    if (g.ourEvidence) compare(n, g.ourClaim, claim);
  }

  /** Captains rule. The system's verdict is advisory — this is the authority. */
  function rule(n: number, winnerSide: "us" | "them") {
    setGames((gs) =>
      gs.map((g) =>
        g.n === n
          ? {
              ...g,
              verdict: "verified",
              ruled: true,
              us: winnerSide === "us" ? "WIN" : "LOSS",
              them: winnerSide === "us" ? "LOSS" : "WIN",
            }
          : g,
      ),
    );
    say(`CAPTAIN RULING — GAME ${n} AWARDED TO ${(winnerSide === "us" ? us.name : them.name).toUpperCase()}`, "warn");
  }

  function replay(n: number) {
    setGames((gs) =>
      gs.map((g) =>
        g.n === n
          ? { ...g, ourClaim: null, theirClaim: null, ourEvidence: false, theirEvidence: false, verdict: "pending", ruled: false, auto: false, us: null, them: null }
          : g,
      ),
    );
    say(`GAME ${n} VOIDED — REPLAY ORDERED BY CAPTAINS`, "alert");
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setGames(initGames(battle));
    setLog(initLog(battle));
    setOurConfirmed(battle.ourConfirmed);
    setTheirConfirmed(battle.theirConfirmed);
    setPicking(null);
  }

  const focused = games.find((g) => g.n === focus) ?? games[0];

  return (
    <div className="mb-4 flex flex-col gap-4">
      {/* ── Scoreboard + lifecycle ───────────────────────────────────────── */}
      <Panel
        i={0}
        sweep={stage === "live"}
        label={`Battle ${battle.id.replace("btl-", "")}`}
        status={<Dot tone={stage === "live" ? "live" : stage === "archived" ? "idle" : "warn"} pulse={stage === "live"} />}
        right={
          <>
            <Tag tone={stage === "live" ? "live" : stage === "archived" ? "info" : "warn"} solid={stage === "live"}>
              {stage === "live" ? "LIVE" : stage.replace(/_/g, " ")}
            </Tag>
            <Proto />
          </>
        }
      >
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="min-w-0 text-right">
            <p className="hq-label" style={{ color: "var(--color-moss)" }}>{us.tag} · Home</p>
            <p className="hq-readout truncate text-[30px] font-bold uppercase leading-none">{us.name}</p>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-5">
              <span
                className="hq-readout text-[64px] font-bold leading-[0.8]"
                style={{ color: score.us >= score.them ? "var(--color-moss)" : "var(--color-ink)" }}
              >
                {score.us}
              </span>
              <span className="hq-readout text-[30px] leading-none text-ink-soft">—</span>
              <span
                className="hq-readout text-[64px] font-bold leading-[0.8]"
                style={{ color: score.them > score.us ? "var(--color-flag)" : "var(--color-ink)" }}
              >
                {score.them}
              </span>
            </div>
            <p className="hq-label mt-2">Series · verified</p>
            {provisional.open > 0 && (
              <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--color-sand)" }}>
                Provisional {provisional.us} — {provisional.them} · {provisional.open} game
                {provisional.open > 1 ? "s" : ""} unverified
              </p>
            )}
          </div>

          <div className="min-w-0">
            <p className="hq-label" style={{ color: "var(--color-flag)" }}>{them.tag} · Away</p>
            <p className="hq-readout truncate text-[30px] font-bold uppercase leading-none">{them.name}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-rule/60 pt-3">
          <span className="hq-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {battle.format} · first to {need} · {battle.scheduled}
          </span>
          <span className="text-ink-soft">·</span>
          <div className="flex gap-1">
            {games.map((g) => {
              const settled = g.verdict === "verified";
              const c = settled
                ? g.us === "WIN"
                  ? "var(--color-moss)"
                  : "var(--color-flag)"
                : g.ourClaim
                  ? "var(--color-sand)"
                  : "var(--color-rule)";
              return (
                <span
                  key={g.n}
                  title={`Game ${g.n}${g.map ? ` · ${g.map}` : ""}`}
                  className="hq-mono flex h-5 w-6 items-center justify-center rounded-[2px] border text-[9px] font-bold"
                  style={{ borderColor: c, color: settled || g.ourClaim ? c : "var(--color-ink-soft)" }}
                >
                  {settled ? (g.us === "WIN" ? "W" : "L") : g.ourClaim ? `${g.ourClaim === "WIN" ? "W" : "L"}?` : g.n}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <Stepper stage={stage} />
          <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[11px] tracking-[0.06em] text-ink-soft">
            {STAGE_BLURB[stage]}
          </p>
        </div>
      </Panel>

      {/* ── Games table + verification ───────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Panel
          i={1}
          label="Games"
          status={<Dot tone={interactive ? "live" : "idle"} pulse={stage === "live"} />}
          right={
            <>
              <span className="hq-mono text-[11px] text-ink-soft">
                SERIES {score.us}–{score.them}
              </span>
              {interactive && (
                <button onClick={reset} className={`${btn} border-rule text-ink-soft hover:border-ink-soft hover:text-ink`}>
                  Reset drill
                </button>
              )}
            </>
          }
          pad={false}
        >
          {/* Capture mode — sits with the evidence flow because it decides how
              evidence arrives. Diagnostics live in the Capture sources panel. */}
          <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-2.5">
            <span className="hq-label">Capture mode</span>
            {CAPTURE_MODES.map((m) => {
              const on = m === mode;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`${btn}`}
                  style={{
                    borderColor: on ? "var(--color-sand)" : "var(--color-rule)",
                    color: on ? "#0b100e" : "var(--color-ink-soft)",
                    backgroundColor: on ? "var(--color-sand)" : "transparent",
                  }}
                >
                  {m}
                </button>
              );
            })}
            <span className="hq-mono ml-auto text-[10px] uppercase tracking-[0.12em]" style={{ color: auto ? "var(--color-moss)" : "var(--color-ink-soft)" }}>
              {auto ? `LINK ${LINK.version} · ARMED` : "MANUAL ENTRY"}
            </span>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule">
                {["Game", "Map", us.name, them.name, "Evidence", "Verification", ""].map((h, i) => (
                  <th
                    key={i}
                    className="hq-label px-3 py-2 text-left"
                    style={{ width: i === 6 ? "26%" : undefined }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const isFocus = g.n === focus;
                const bothIn = g.ourEvidence && g.theirEvidence;
                return (
                  <tr
                    key={g.n}
                    onClick={() => setFocus(g.n)}
                    className="cursor-pointer border-b border-rule/50 align-middle transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.02)]"
                    style={{ backgroundColor: isFocus ? "rgba(245,182,61,0.045)" : undefined }}
                  >
                    <td className="hq-mono px-3 py-2 text-[12px] font-bold">{g.n}</td>
                    <td className="hq-mono px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                      {g.map ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <ResultCell r={g.us} claim={g.ourClaim} settled={g.verdict === "verified"} tone="moss" />
                    </td>
                    <td className="px-3 py-2">
                      <ResultCell r={g.them} claim={g.theirClaim === null ? null : g.theirClaim === "WIN" ? "LOSS" : "WIN"} settled={g.verdict === "verified"} tone="flag" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="hq-mono rounded-[2px] border px-1 py-0.5 text-[9px] font-semibold tracking-[0.1em]"
                          style={{
                            borderColor: g.ourEvidence ? "var(--color-moss)" : "var(--color-rule)",
                            color: g.ourEvidence ? "var(--color-moss)" : "var(--color-ink-soft)",
                          }}
                        >
                          {us.tag}
                        </span>
                        <span
                          className="hq-mono rounded-[2px] border px-1 py-0.5 text-[9px] font-semibold tracking-[0.1em]"
                          style={{
                            borderColor: g.theirEvidence ? "var(--color-moss)" : "var(--color-rule)",
                            color: g.theirEvidence ? "var(--color-moss)" : "var(--color-ink-soft)",
                          }}
                        >
                          {them.tag}
                        </span>
                        {g.auto && <span className="hq-mono text-[9px] text-ink-soft">LINK</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <VerdictCell g={g} bothIn={bothIn} />
                    </td>
                    <td className="px-3 py-2">
                      {!interactive ? (
                        <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
                          {readOnly ? "Archived" : "Opens when live"}
                        </span>
                      ) : g.verdict === "review" ? (
                        <div className="flex flex-wrap gap-1">
                          <button onClick={() => rule(g.n, "us")} className={`${btn} border-moss text-moss hover:bg-[rgba(61,220,132,0.12)]`}>
                            Award {us.tag}
                          </button>
                          <button onClick={() => rule(g.n, "them")} className={`${btn} border-flag text-flag hover:bg-[rgba(255,91,59,0.12)]`}>
                            Award {them.tag}
                          </button>
                          <button onClick={() => replay(g.n)} className={`${btn} border-rule text-ink-soft hover:text-ink`}>
                            Replay
                          </button>
                        </div>
                      ) : g.verdict === "verified" ? (
                        <span className="hq-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-moss)" }}>
                          {g.ruled ? "Captain ruling" : "Verified"}
                        </span>
                      ) : g.verdict === "comparing" ? (
                        <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">Working…</span>
                      ) : !g.ourEvidence ? (
                        picking === g.n ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="hq-label">Who took it?</span>
                            <button onClick={() => ourUpload(g.n, "WIN")} className={`${btn} border-moss text-moss hover:bg-[rgba(61,220,132,0.12)]`}>
                              {us.tag}
                            </button>
                            <button onClick={() => ourUpload(g.n, "LOSS")} className={`${btn} border-flag text-flag hover:bg-[rgba(255,91,59,0.12)]`}>
                              {them.tag}
                            </button>
                            <button onClick={() => setPicking(null)} className={`${btn} border-rule text-ink-soft`}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => (auto ? ourUpload(g.n, g.n % 2 === 1 ? "WIN" : "LOSS", true) : setPicking(g.n))}
                              className={`${btn} border-sand text-sand hover:bg-[rgba(245,182,61,0.12)]`}
                            >
                              {auto ? "Pull from link" : "Capture result"}
                            </button>
                            {auto && (
                              <button onClick={() => setPicking(g.n)} className={`${btn} border-rule text-ink-soft hover:text-ink`}>
                                Manual
                              </button>
                            )}
                          </div>
                        )
                      ) : !g.theirEvidence ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="hq-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--color-sand)" }}>
                            Awaiting {them.tag}
                          </span>
                          <button onClick={() => theirUpload(g.n, true)} className={`${btn} border-rule text-ink-soft hover:border-moss hover:text-moss`}>
                            Sim · agrees
                          </button>
                          <button onClick={() => theirUpload(g.n, false)} className={`${btn} border-rule text-ink-soft hover:border-flag hover:text-flag`}>
                            Sim · disputes
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="hq-mono border-t border-rule px-4 py-2 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
            Buttons marked SIM stand in for {them.name} acting on their own screen.
          </p>
        </Panel>

        {/* ── Verification state machine ─────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel
            i={2}
            label={`Verification · Game ${focused?.n ?? "—"}`}
            status={<Dot tone={focused?.verdict === "review" ? "alert" : focused?.verdict === "verified" ? "live" : "warn"} pulse={focused?.verdict === "comparing"} />}
            right={<Proto>AI assist</Proto>}
          >
            {!focused ? (
              <Nil>No games on the sheet</Nil>
            ) : (
              <>
                <ol className="flex flex-col">
                  <Node
                    label={`Evidence — ${us.name}`}
                    state={focused.ourEvidence ? "done" : "wait"}
                    detail={focused.ourEvidence ? (focused.auto ? "Captured by Barracks Link" : "Uploaded by Captain") : "Not received"}
                  />
                  <Node
                    label={`Evidence — ${them.name}`}
                    state={focused.theirEvidence ? "done" : "wait"}
                    detail={focused.theirEvidence ? "Scorecard received" : `Awaiting ${them.name}`}
                  />
                  <Node
                    label="Comparing scorecards"
                    state={
                      focused.verdict === "comparing"
                        ? "active"
                        : focused.ourEvidence && focused.theirEvidence
                          ? "done"
                          : "wait"
                    }
                    detail={
                      focused.verdict === "comparing"
                        ? "Reading both cards…"
                        : focused.ourEvidence && focused.theirEvidence
                          ? "Both cards read"
                          : "Needs two scorecards"
                    }
                  />
                  <Node
                    label={
                      focused.verdict === "verified"
                        ? focused.ruled
                          ? "Captain ruling — settled"
                          : `Scorecards match — Game ${focused.n} verified`
                        : focused.verdict === "review"
                          ? "Result requires review"
                          : "Verdict"
                    }
                    state={focused.verdict === "verified" ? "done" : focused.verdict === "review" ? "alert" : "wait"}
                    detail={
                      focused.verdict === "verified"
                        ? focused.ruled
                          ? "Recorded on the Captains' authority"
                          : "Recorded automatically"
                        : focused.verdict === "review"
                          ? "The two cards disagree. Captains settle it."
                          : "Pending"
                    }
                    last
                  />
                </ol>

                {focused.verdict === "review" && (
                  <div
                    className="mt-3 rounded-[3px] border p-3"
                    style={{ borderColor: "color-mix(in srgb, var(--color-flag) 45%, transparent)", backgroundColor: "rgba(255,91,59,0.07)" }}
                  >
                    <p className="hq-mono text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-flag)" }}>
                      Result requires review
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {us.name} claim {focused.ourClaim}. {them.name} claim the opposite. Nothing is recorded
                      until a Captain rules — use the buttons on the game row.
                    </p>
                  </div>
                )}

                <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[10px] leading-[1.6] uppercase tracking-[0.08em] text-ink-soft">
                  Verification assists the Captains. It never rules. Every game can be entered,
                  corrected or voided by hand — manual entry is always available.
                </p>
              </>
            )}
          </Panel>

          <Panel i={3} label="Evidence log" right={<Proto />} pad={false}>
            {log.length === 0 ? (
              <Nil>No evidence yet</Nil>
            ) : (
              <ul className="max-h-[240px] overflow-y-auto p-3">
                {log.map((l, i) => (
                  <li key={`${l.m}-${i}`} className="flex items-center gap-2 py-[3px]">
                    <Dot tone={l.tone} />
                    <span className="hq-mono min-w-0 flex-1 truncate text-[10px] tracking-[0.06em]">{l.m}</span>
                    <span className="hq-mono shrink-0 text-[9px] text-ink-soft">{l.t}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* ── Final confirmation ───────────────────────────────────────────── */}
      {(decided || !interactive) && (
        <Panel
          i={4}
          label="Final confirmation"
          status={<Dot tone={official ? "live" : "warn"} pulse={!official && decided} />}
          right={
            <Tag tone={official ? "live" : "warn"} solid={official}>
              {official ? "Official" : "Unofficial until both sign"}
            </Tag>
          }
        >
          <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr]">
            <div className="shrink-0">
              <p className="hq-label" style={{ color: official ? "var(--color-moss)" : "var(--color-sand)" }}>
                {official ? "Final · entered into history" : "Final · pending signature"}
              </p>
              <p className="hq-readout mt-1 text-[26px] font-bold uppercase leading-none">
                {us.name} <span style={{ color: "var(--color-moss)" }}>{score.us}</span>
                <span className="text-ink-soft"> — </span>
                <span style={{ color: "var(--color-flag)" }}>{score.them}</span> {them.name}
              </p>
              <p className="hq-mono mt-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                {winner ? `${winner.name} take the series` : "Series level"} · {battle.format}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SignBlock
                who={`${us.name} Captain`}
                done={ourConfirmed}
                cta={interactive && !ourConfirmed && decided ? "Confirm as Captain" : null}
                onClick={() => {
                  setOurConfirmed(true);
                  say("RESULT CONFIRMED — BARRACKS CAPTAIN", "live");
                }}
              />
              <SignBlock
                who={`${them.name} Captain`}
                done={theirConfirmed}
                sim
                cta={interactive && !theirConfirmed && decided ? "Sim · their Captain signs" : null}
                onClick={() => {
                  setTheirConfirmed(true);
                  say(`RESULT CONFIRMED — ${them.name.toUpperCase()} CAPTAIN`, "live");
                }}
              />
            </div>
          </div>

          <p className="hq-mono mt-4 border-t border-rule/60 pt-2 text-[10px] uppercase tracking-[0.08em] text-ink-soft">
            {official
              ? "Signed by both Captains. Counted in the rivalry, the league table and the archives."
              : "A result becomes official only when both Captains sign it. Until then it is a claim, not history."}
          </p>
        </Panel>
      )}
    </div>
  );
}

// ── Bits ───────────────────────────────────────────────────────────────────

function ResultCell({
  r,
  claim,
  settled,
  tone,
}: {
  r: Result;
  claim: Result;
  settled: boolean;
  tone: "moss" | "flag";
}) {
  if (settled && r) {
    return (
      <span
        className="hq-mono text-[12px] font-bold uppercase tracking-[0.1em]"
        style={{ color: r === "WIN" ? `var(--color-${tone})` : "var(--color-ink-soft)" }}
      >
        {r}
      </span>
    );
  }
  if (claim) {
    return (
      <span className="hq-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft" title="Claimed, not yet verified">
        {claim.toLowerCase()} <span style={{ color: "var(--color-sand)" }}>?</span>
      </span>
    );
  }
  return <span className="hq-mono text-[12px] text-ink-soft">—</span>;
}

function VerdictCell({ g, bothIn }: { g: GameState; bothIn: boolean }) {
  if (g.verdict === "comparing") {
    return (
      <span className="hq-mono hq-caret text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--color-sand)" }}>
        Comparing scorecards
      </span>
    );
  }
  if (g.verdict === "verified") {
    return (
      <span className="hq-mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--color-moss)" }}>
        <span className="hq-dot" style={{ backgroundColor: "var(--color-moss)" }} />
        {g.ruled ? "Settled by Captains" : "Scorecards match"}
      </span>
    );
  }
  if (g.verdict === "review") {
    return (
      <span className="hq-mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--color-flag)" }}>
        <span className="hq-dot hq-dot-live" style={{ backgroundColor: "var(--color-flag)" }} />
        Requires review
      </span>
    );
  }
  if (g.ourEvidence && !bothIn) {
    return (
      <span className="hq-mono text-[10px] uppercase leading-[1.4] tracking-[0.1em]" style={{ color: "var(--color-sand)" }}>
        Evidence received
        <br />
        <span className="text-ink-soft">awaiting opponent</span>
      </span>
    );
  }
  return <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">No evidence</span>;
}

function Node({
  label,
  detail,
  state,
  last = false,
}: {
  label: string;
  detail: string;
  state: "done" | "active" | "wait" | "alert";
  last?: boolean;
}) {
  const c =
    state === "done"
      ? "var(--color-moss)"
      : state === "active"
        ? "var(--color-sand)"
        : state === "alert"
          ? "var(--color-flag)"
          : "var(--color-rule)";
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={state === "active" ? "hq-dot hq-dot-live" : "hq-dot"}
          style={{ backgroundColor: c, marginTop: 5 }}
        />
        {!last && <span className="w-px flex-1" style={{ backgroundColor: "var(--color-rule)" }} />}
      </div>
      <div className={`min-w-0 ${last ? "" : "pb-3"}`}>
        <p
          className="hq-mono text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: state === "wait" ? "var(--color-ink-soft)" : c }}
        >
          {label}
        </p>
        <p className="text-[11px] text-ink-soft">{detail}</p>
      </div>
    </li>
  );
}

function SignBlock({
  who,
  done,
  cta,
  onClick,
  sim = false,
}: {
  who: string;
  done: boolean;
  cta: string | null;
  onClick: () => void;
  sim?: boolean;
}) {
  return (
    <div
      className="rounded-[3px] border p-3"
      style={{
        borderColor: done ? "color-mix(in srgb, var(--color-moss) 45%, transparent)" : "var(--color-rule)",
        backgroundColor: done ? "rgba(61,220,132,0.06)" : "transparent",
      }}
    >
      <div className="flex items-center gap-2">
        <Dot tone={done ? "live" : "warn"} pulse={!done} />
        <span className="hq-label truncate">{who}</span>
      </div>
      <p
        className="hq-readout mt-1 text-[17px] font-bold uppercase leading-none"
        style={{ color: done ? "var(--color-moss)" : "var(--color-sand)" }}
      >
        {done ? "Confirmed" : "Awaiting"}
      </p>
      {cta && (
        <button
          onClick={onClick}
          className={`${btn} mt-2 w-full ${sim ? "border-rule text-ink-soft hover:border-ink-soft hover:text-ink" : "border-sand"}`}
          style={sim ? undefined : { backgroundColor: "var(--color-sand)", color: "#0b100e" }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}
