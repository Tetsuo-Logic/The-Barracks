import Link from "next/link";
import { Panel, Row, Tag, Dot, Meter, Proto } from "@/components/hq/Kit";
import { Terminal } from "@/components/hq/squad/Terminal";
import {
  callsign,
  championship,
  circuitFor,
  formatLap,
  hash,
  RACE_CONTROL_LOG,
  timingTower,
  TYRE_LABEL,
  type TimingRow,
} from "@/components/hq/squad/proto";
import { compHeading } from "@/lib/games";
import { heroDate, shortTime } from "@/lib/dates";
import type { Competition, Profile } from "@/lib/types";

// RACE CONTROL — the motorsport squad's surface. The drivers and the race
// nights are real; the timing, the tyres and the championship are a prototype
// until a session feed exists.
//
// Fastest-lap purple is a motorsport convention with no Barracks token — it is
// the one colour on this screen that isn't a variable, and it earns its place.
const PURPLE = "#b57cff";

type Member = { profile: Profile; is_captain: boolean };

const SECTOR_COLOUR: Record<TimingRow["sectors"][number], string> = {
  purple: PURPLE,
  green: "var(--color-moss)",
  yellow: "var(--color-sand)",
};

const TYRE_COLOUR: Record<TimingRow["tyre"], string> = {
  S: "var(--color-flag)",
  M: "var(--color-sand)",
  H: "var(--color-ink)",
  I: "var(--color-moss)",
};

export function RacePanel({
  squadId,
  members,
  fixtures,
}: {
  squadId: string;
  members: Member[];
  fixtures: Competition[];
}) {
  const drivers = members.map((m) => callsign(m.profile.name, m.profile.nickname));
  const circuit = circuitFor(squadId);
  const rows = timingTower(squadId, drivers);
  const standings = championship(squadId, drivers);
  const maxPts = Math.max(1, ...standings.map((s) => s.pts));
  const lap = 1 + (hash(`lap:${squadId}`) % Math.max(1, circuit.laps - 3));
  const fastest = rows.find((r) => r.fastest) ?? null;
  const next = fixtures[0] ?? null;

  return (
    <Panel
      i={14}
      sweep
      label="Race control"
      status={<Dot tone="live" pulse />}
      right={
        <>
          <Tag tone="live" solid>
            Green flag
          </Tag>
          <span className="hq-mono text-[11px] text-ink-soft">
            LAP <span className="text-ink">{lap}</span>/{circuit.laps}
          </span>
          <Proto />
        </>
      }
    >
      <Terminal
        lines={[
          { t: "»", m: "RACE CONTROL ONLINE", tone: "live" },
          { t: "»", m: `SESSION // RACE — ${circuit.name.toUpperCase()} (${circuit.country})`, tone: "info" },
          { t: "»", m: "TIMING FEED SYNCHRONISED · DRS ENABLED", tone: "live" },
        ]}
      />

      {/* ── Session strip ─────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-2 gap-px border border-rule bg-rule md:grid-cols-6">
        {[
          { k: "Session", v: "Race", tone: undefined },
          { k: "Circuit", v: circuit.name, tone: undefined },
          { k: "Lap", v: `${lap} / ${circuit.laps}`, tone: undefined },
          { k: "Flag", v: "GREEN", tone: "var(--color-moss)" },
          { k: "Fastest lap", v: fastest ? fastest.best : "—", tone: PURPLE },
          { k: "Leader", v: rows[0]?.driver ?? "—", tone: "var(--color-sand)" },
        ].map((c) => (
          <div key={c.k} className="bg-[rgba(11,16,14,0.75)] px-3 py-2">
            <p className="hq-label">{c.k}</p>
            <p
              className="hq-readout mt-0.5 truncate text-[15px] font-bold"
              style={{ color: c.tone ?? "var(--color-ink)" }}
            >
              {c.v}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* ── The timing tower ────────────────────────────────────────── */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="hq-label" style={{ color: "var(--color-sand)" }}>
              Timing tower
            </p>
            <p className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              Live classification
            </p>
          </div>

          <div className="overflow-x-auto rounded-[3px] border border-rule">
            <table className="hq-mono w-full min-w-[620px] text-[12px]">
              <thead>
                <tr className="border-b border-rule text-left">
                  {["Pos", "Driver", "Gap", "Int", "Last", "Best", "Sectors", "Tyre", "Pit"].map(
                    (h) => (
                      <th
                        key={h}
                        className="hq-label px-2 py-1.5 font-semibold"
                        style={{ textAlign: h === "Pos" ? "center" : "left" }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.driver + r.pos}
                    className="border-b border-rule/50 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.03)]"
                  >
                    <td className="px-2 py-1.5">
                      <span
                        className="mx-auto flex h-6 w-6 items-center justify-center rounded-[2px] text-[11px] font-bold"
                        style={{
                          backgroundColor:
                            r.pos === 1
                              ? "var(--color-sand)"
                              : "color-mix(in srgb, var(--color-ink) 8%, transparent)",
                          color: r.pos === 1 ? "#0b100e" : "var(--color-ink)",
                        }}
                      >
                        {String(r.pos).padStart(2, "0")}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3.5 w-[3px] rounded-[1px]"
                          style={{
                            backgroundColor:
                              r.pos === 1 ? "var(--color-sand)" : "var(--color-moss)",
                            opacity: r.pos === 1 ? 1 : 0.55,
                          }}
                        />
                        <span className="font-semibold tracking-[0.08em]">{r.driver}</span>
                        {r.drs && (
                          <span
                            className="rounded-[2px] px-1 text-[9px] font-bold tracking-[0.1em]"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--color-moss) 20%, transparent)",
                              color: "var(--color-moss)",
                            }}
                          >
                            DRS
                          </span>
                        )}
                      </span>
                    </td>
                    <td
                      className="px-2 py-1.5"
                      style={{ color: r.pos === 1 ? "var(--color-sand)" : "var(--color-ink)" }}
                    >
                      {r.gap}
                    </td>
                    <td className="px-2 py-1.5 text-ink-soft">{r.interval}</td>
                    <td className="px-2 py-1.5">{r.last}</td>
                    <td
                      className="px-2 py-1.5 font-semibold"
                      style={{ color: r.fastest ? PURPLE : "var(--color-ink)" }}
                    >
                      {r.best}
                      {r.fastest && (
                        <span
                          className="ml-1.5 rounded-[2px] px-1 text-[9px] font-bold tracking-[0.1em]"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${PURPLE} 22%, transparent)`,
                            color: PURPLE,
                          }}
                        >
                          FL
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="flex gap-[3px]">
                        {r.sectors.map((s, i) => (
                          <span
                            key={i}
                            className="inline-block h-2 w-4 rounded-[1px]"
                            style={{ backgroundColor: SECTOR_COLOUR[s], opacity: 0.85 }}
                            title={`Sector ${i + 1} — ${s}`}
                          />
                        ))}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="flex h-4.5 w-4.5 items-center justify-center rounded-full text-[9px] font-bold"
                          style={{
                            border: `1px solid ${TYRE_COLOUR[r.tyre]}`,
                            color: TYRE_COLOUR[r.tyre],
                            width: 18,
                            height: 18,
                          }}
                          title={TYRE_LABEL[r.tyre]}
                        >
                          {r.tyre}
                        </span>
                        <span className="text-[10px] text-ink-soft">{r.age}L</span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-ink-soft">{r.stops}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="hq-label px-2 py-6 text-center">
                      No drivers on strength
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Race control messages */}
          <p className="hq-label mb-2 mt-4" style={{ color: "var(--color-sand)" }}>
            Race control messages
          </p>
          <ul className="flex flex-col rounded-[3px] border border-rule">
            {RACE_CONTROL_LOG.map((m, i) => (
              <li
                key={m.t}
                className="hq-rise flex items-center gap-3 border-b border-rule/50 px-3 py-1.5 last:border-0"
                style={{ ["--i" as string]: i }}
              >
                <Dot tone={m.tone} />
                <span className="hq-mono shrink-0 text-[10px] text-ink-soft">{m.t}</span>
                <span className="hq-mono min-w-0 flex-1 truncate text-[11px] tracking-[0.06em]">
                  {m.m}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── Circuit, grid, championship ─────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
              Circuit · {circuit.name}
            </p>
            <div className="rounded-[3px] border border-rule p-3">
              <svg viewBox="0 0 200 120" className="h-auto w-full" role="img" aria-label={`${circuit.name} circuit layout`}>
                <path
                  d={circuit.path}
                  fill="none"
                  stroke="var(--color-rule)"
                  strokeWidth={9}
                  strokeLinejoin="round"
                />
                <path
                  d={circuit.path}
                  fill="none"
                  stroke="var(--color-moss)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={0.85}
                />
                <line
                  x1={circuit.line[0]}
                  y1={circuit.line[1]}
                  x2={circuit.line[2]}
                  y2={circuit.line[3]}
                  stroke="var(--color-sand)"
                  strokeWidth={3}
                />
                {circuit.markers.map((m) => (
                  <text
                    key={m.s}
                    x={m.x}
                    y={m.y}
                    fill="var(--color-ink-soft)"
                    fontSize={8}
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {m.s}
                  </text>
                ))}
              </svg>
              <div className="mt-2">
                <Row k="Length" v={`${circuit.lengthKm.toFixed(3)} km`} />
                <Row k="Corners" v={circuit.corners} />
                <Row k="DRS zones" v={circuit.drs} />
                <Row k="Lap record" v={circuit.record} tone="warn" />
              </div>
            </div>
          </div>

          <div>
            <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
              Next race
            </p>
            {next ? (
              <Link
                href={`/hq/operations/${next.id}`}
                className="flex items-center gap-3 rounded-[3px] border border-rule px-3 py-2.5 transition-colors hover:border-sand"
              >
                <span className="text-center">
                  <span className="hq-label block">{heroDate(next.date).dow}</span>
                  <span
                    className="hq-readout block text-[24px] font-bold leading-none"
                    style={{ color: "var(--color-flag)" }}
                  >
                    {heroDate(next.date).day}
                  </span>
                  <span className="hq-label block">{heroDate(next.date).mon}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{compHeading(next)}</span>
                  <span className="hq-mono block text-[11px] text-ink-soft">
                    {circuit.name} · {shortTime(next.tee_time) || "time TBC"}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                No race on the board
              </p>
            )}
          </div>

          <div>
            <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
              Qualifying · Q3 grid
            </p>
            <ul className="flex flex-col">
              {rows.map((r, i) => (
                <li
                  key={`grid-${r.driver}`}
                  className="flex items-center gap-2.5 border-b border-rule/60 py-1 last:border-0"
                >
                  <span className="hq-mono w-6 shrink-0 text-[11px] text-ink-soft">
                    P{String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="hq-mono min-w-0 flex-1 truncate text-[12px] tracking-[0.08em]">
                    {r.driver}
                  </span>
                  <span
                    className="hq-mono shrink-0 text-[12px]"
                    style={{ color: i === 0 ? PURPLE : "var(--color-ink)" }}
                  >
                    {formatLap(r.bestMs - 400 + i * 130)}
                  </span>
                </li>
              ))}
              {rows.length === 0 && (
                <li className="hq-label py-3 text-center">No grid set</li>
              )}
            </ul>
          </div>

          <div>
            <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
              Championship
            </p>
            <ul className="flex flex-col gap-2">
              {standings.map((s, i) => (
                <li key={s.driver}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="hq-mono truncate text-[12px] tracking-[0.08em]">
                      <span className="mr-2 text-ink-soft">{i + 1}</span>
                      {s.driver}
                    </span>
                    <span
                      className="hq-mono shrink-0 text-[12px] font-semibold"
                      style={{ color: i === 0 ? "var(--color-sand)" : "var(--color-ink)" }}
                    >
                      {s.pts} pts
                    </span>
                  </div>
                  <div className="mt-1">
                    <Meter pct={(s.pts / maxPts) * 100} tone={i === 0 ? "warn" : "live"} />
                  </div>
                  <p className="hq-mono mt-0.5 text-[10px] text-ink-soft">
                    {s.wins} wins · {s.podiums} podiums
                  </p>
                </li>
              ))}
              {standings.length === 0 && (
                <li className="hq-label py-3 text-center">No championship entries</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}
