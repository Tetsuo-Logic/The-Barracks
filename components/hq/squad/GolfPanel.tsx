import { Panel, Row, Tag, Dot, Proto } from "@/components/hq/Kit";
import { Terminal } from "@/components/hq/squad/Terminal";
import { callsign, protoPar, protoStrokeIndex, protoStrokes } from "@/components/hq/squad/proto";
import { formatToPar, holeMark, splits, stablefordPoints, toPar, type HoleMark } from "@/lib/scoring";
import { formatLabel, shortDate } from "@/lib/dates";
import type { Competition, Profile, Score } from "@/lib/types";

// CLUBHOUSE // SCORECARD — the golf squad's surface. If the squad has a real
// played round with scores in it, that card is the one on the board; otherwise
// a prototype card shows the instrument working.

type Member = { profile: Profile; is_captain: boolean };

const MARK_COLOUR: Record<HoleMark, string> = {
  eagle: "var(--color-moss)",
  birdie: "var(--color-moss)",
  par: "var(--color-ink)",
  bogey: "var(--color-sand)",
  double: "var(--color-flag)",
  none: "var(--color-ink-soft)",
};

export function GolfPanel({
  squadId,
  members,
  comps,
  scores,
}: {
  squadId: string;
  members: Member[];
  comps: Competition[];
  scores: Score[];
}) {
  // The card on the board: the squad's most recent round that actually has
  // strokes against it.
  const played = [...comps].sort((a, b) => (a.date < b.date ? 1 : -1));
  const scoresByComp = new Map<string, Score[]>();
  for (const s of scores) {
    const arr = scoresByComp.get(s.competition_id) ?? [];
    arr.push(s);
    scoresByComp.set(s.competition_id, arr);
  }
  const realComp = played.find((c) => (scoresByComp.get(c.id) ?? []).length > 0) ?? null;
  const isReal = realComp != null;

  const holes: 9 | 18 = realComp?.holes ?? 18;
  const par = (realComp?.par && realComp.par.length >= holes ? realComp.par : protoPar(holes)).slice(0, holes);
  const si = (
    realComp?.stroke_index && realComp.stroke_index.length >= holes
      ? realComp.stroke_index
      : protoStrokeIndex(holes)
  ).slice(0, holes);
  const format = realComp?.format ?? "stableford";

  const profileById = new Map(members.map((m) => [m.profile.id, m.profile]));
  const cardRows = isReal
    ? (scoresByComp.get(realComp.id) ?? [])
        .map((s) => ({ profile: profileById.get(s.player_id) ?? null, strokes: s.strokes.slice(0, holes) }))
        .filter((r): r is { profile: Profile; strokes: (number | null)[] } => r.profile != null)
    : members.map((m) => ({
        profile: m.profile,
        strokes: protoStrokes(`${squadId}:${m.profile.id}`, par),
      }));

  const scored = cardRows.map((r) => {
    const sp = splits(r.strokes);
    const pts = stablefordPoints(r.strokes, par, r.profile.handicap ?? 0, si, holes).total;
    return { ...r, out: sp.out, in: sp.in, tot: sp.tot, pts, diff: toPar(r.strokes, par) };
  });
  const leaderboard = [...scored].sort((a, b) =>
    format === "stableford" ? b.pts - a.pts : a.tot - b.tot,
  );

  const parOut = par.slice(0, 9).reduce((s, v) => s + v, 0);
  const parIn = par.slice(9, 18).reduce((s, v) => s + v, 0);
  const front = Array.from({ length: Math.min(9, holes) }, (_, i) => i);
  const back = holes === 18 ? Array.from({ length: 9 }, (_, i) => i + 9) : [];

  const cellStyle = "px-1.5 py-1 text-center text-[12px]";

  return (
    <Panel
      i={14}
      sweep
      label="Clubhouse // Scorecard"
      status={<Dot tone={isReal ? "live" : "idle"} pulse={isReal} />}
      right={
        <>
          <Tag tone="warn">{formatLabel(format)}</Tag>
          <Tag tone="idle">{holes} holes</Tag>
          {!isReal && <Proto />}
        </>
      }
    >
      <Terminal
        lines={[
          { t: "»", m: "RETRIEVING CARD...", tone: "info" },
          isReal
            ? {
                t: "»",
                m: `CARD FOUND // ${(realComp.course || "COURSE").toUpperCase()} · ${shortDate(realComp.date)}`,
                tone: "live" as const,
              }
            : { t: "»", m: "NO ROUND ON RECORD — PROTOTYPE CARD LOADED", tone: "warn" as const },
          { t: "»", m: `${cardRows.length} CARDS SIGNED · PAR ${parOut + parIn}`, tone: "info" },
        ]}
      />

      <div className="mt-4 overflow-x-auto rounded-[3px] border border-rule">
        <table className="hq-mono w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-rule">
              <th className="hq-label px-2 py-1.5 text-left">Hole</th>
              {front.map((i) => (
                <th key={i} className={`hq-label ${cellStyle}`}>
                  {i + 1}
                </th>
              ))}
              <th className={`hq-label ${cellStyle}`} style={{ color: "var(--color-sand)" }}>
                Out
              </th>
              {back.map((i) => (
                <th key={i} className={`hq-label ${cellStyle}`}>
                  {i + 1}
                </th>
              ))}
              {holes === 18 && (
                <th className={`hq-label ${cellStyle}`} style={{ color: "var(--color-sand)" }}>
                  In
                </th>
              )}
              <th className={`hq-label ${cellStyle}`} style={{ color: "var(--color-sand)" }}>
                Tot
              </th>
              <th className={`hq-label ${cellStyle}`} style={{ color: "var(--color-moss)" }}>
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Par + stroke index */}
            <tr className="border-b border-rule bg-[rgba(255,255,255,0.02)]">
              <td className="hq-label px-2 py-1.5 text-left">Par</td>
              {front.map((i) => (
                <td key={i} className={`${cellStyle} text-ink-soft`}>
                  {par[i]}
                </td>
              ))}
              <td className={`${cellStyle} text-ink-soft`}>{parOut}</td>
              {back.map((i) => (
                <td key={i} className={`${cellStyle} text-ink-soft`}>
                  {par[i]}
                </td>
              ))}
              {holes === 18 && <td className={`${cellStyle} text-ink-soft`}>{parIn}</td>}
              <td className={`${cellStyle} text-ink-soft`}>{parOut + parIn}</td>
              <td className={`${cellStyle} text-ink-soft`}>—</td>
            </tr>
            <tr className="border-b border-rule">
              <td className="hq-label px-2 py-1.5 text-left">SI</td>
              {front.map((i) => (
                <td key={i} className={`${cellStyle} text-[10px] text-ink-soft opacity-70`}>
                  {si[i]}
                </td>
              ))}
              <td className={cellStyle} />
              {back.map((i) => (
                <td key={i} className={`${cellStyle} text-[10px] text-ink-soft opacity-70`}>
                  {si[i]}
                </td>
              ))}
              {holes === 18 && <td className={cellStyle} />}
              <td className={cellStyle} />
              <td className={cellStyle} />
            </tr>

            {/* One row per card */}
            {scored.map((p) => (
              <tr
                key={p.profile.id}
                className="border-b border-rule/50 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.03)]"
              >
                <td className="px-2 py-1.5 text-left">
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-[3px] rounded-[1px]"
                      style={{ backgroundColor: p.profile.colour }}
                    />
                    <span className="text-[12px] font-semibold tracking-[0.06em]">
                      {callsign(p.profile.name, p.profile.nickname)}
                    </span>
                  </span>
                </td>
                {front.map((i) => (
                  <td
                    key={i}
                    className={cellStyle}
                    style={{ color: MARK_COLOUR[holeMark(p.strokes[i] ?? null, par[i])] }}
                  >
                    {p.strokes[i] ?? "·"}
                  </td>
                ))}
                <td className={`${cellStyle} font-semibold`} style={{ color: "var(--color-sand)" }}>
                  {p.out || "—"}
                </td>
                {back.map((i) => (
                  <td
                    key={i}
                    className={cellStyle}
                    style={{ color: MARK_COLOUR[holeMark(p.strokes[i] ?? null, par[i])] }}
                  >
                    {p.strokes[i] ?? "·"}
                  </td>
                ))}
                {holes === 18 && (
                  <td className={`${cellStyle} font-semibold`} style={{ color: "var(--color-sand)" }}>
                    {p.in || "—"}
                  </td>
                )}
                <td className={`${cellStyle} font-bold`}>{p.tot || "—"}</td>
                <td className={`${cellStyle} font-bold`} style={{ color: "var(--color-moss)" }}>
                  {p.pts}
                </td>
              </tr>
            ))}
            {scored.length === 0 && (
              <tr>
                <td colSpan={holes === 18 ? 23 : 13} className="hq-label px-2 py-6 text-center">
                  No cards signed
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
            Standing
          </p>
          <ul className="flex flex-col">
            {leaderboard.map((p, i) => (
              <li
                key={p.profile.id}
                className="flex items-center gap-2.5 border-b border-rule/60 py-1.5 last:border-0"
              >
                <span className="hq-mono w-4 shrink-0 text-[11px] text-ink-soft">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{p.profile.name}</span>
                <span
                  className="hq-mono shrink-0 text-[12px]"
                  style={{ color: i === 0 ? "var(--color-sand)" : "var(--color-ink)" }}
                >
                  {formatToPar(p.diff)} · {p.pts} pts
                </span>
              </li>
            ))}
            {leaderboard.length === 0 && <li className="hq-label py-3 text-center">No cards</li>}
          </ul>
        </div>

        <div>
          <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
            The card
          </p>
          <Row k="Course" v={realComp?.course || "Prototype links"} />
          <Row k="Date" v={realComp ? shortDate(realComp.date) : "—"} />
          <Row k="Format" v={formatLabel(format)} />
          <Row k="Par" v={parOut + parIn} />
          <Row k="Source" v={isReal ? "Live scorecard" : "Prototype"} tone={isReal ? "live" : "idle"} />
        </div>

        <div>
          <p className="hq-label mb-2" style={{ color: "var(--color-sand)" }}>
            Key
          </p>
          <ul className="flex flex-col gap-1.5">
            {(
              [
                ["Eagle or better", "eagle"],
                ["Birdie", "birdie"],
                ["Par", "par"],
                ["Bogey", "bogey"],
                ["Double or worse", "double"],
              ] as [string, HoleMark][]
            ).map(([label, mark]) => (
              <li key={mark} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-[1px]"
                  style={{ backgroundColor: MARK_COLOUR[mark] }}
                />
                <span className="hq-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
