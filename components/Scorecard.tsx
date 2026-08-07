// The signature element (§4.4). A presentational scorecard grid drawn to look
// printed: hairline rules, condensed numerals, real score conventions, skin
// dots and carry rings. 18 holes render as two stacked grids + a total row.
import {
  computeSkins,
  holeMark,
  splits,
  total,
  type HoleMark,
  type PlayerScore,
  type SkinsResult,
} from "@/lib/scoring";
import type { Competition } from "@/lib/types";

export function Scorecard({
  comp,
  players,
}: {
  comp: Competition;
  players: PlayerScore[];
}) {
  const par = comp.par ?? Array(comp.holes).fill(4);
  const skins = comp.format === "skins" ? computeSkins(players, comp.holes) : null;

  return (
    <div className="overflow-hidden rounded-[3px] border border-ink bg-card">
      <Grid players={players} par={par} start={0} end={9} label="OUT" skins={skins} />
      {comp.holes === 18 && (
        <>
          <Grid players={players} par={par} start={9} end={18} label="IN" skins={skins} topBorder />
          <TotalRow players={players} />
        </>
      )}
      {skins && <CarryNote skins={skins} />}
    </div>
  );
}

function Grid({
  players,
  par,
  start,
  end,
  label,
  skins,
  topBorder,
}: {
  players: PlayerScore[];
  par: number[];
  start: number;
  end: number;
  label: string;
  skins: SkinsResult | null;
  topBorder?: boolean;
}) {
  const holes = Array.from({ length: end - start }, (_, i) => start + i);
  // label col + N holes + total col
  const cols = `2.6rem repeat(${holes.length}, 1fr) 2.4rem`;

  return (
    <div className={topBorder ? "border-t-2 border-ink" : ""}>
      {/* HOLE header — carried holes get a single hollow red ring here */}
      <Row cols={cols} header>
        <Cell label>Hole</Cell>
        {holes.map((h) => (
          <Cell key={h} header carryRing={skins?.holes[h]?.carried ?? false}>
            {h + 1}
          </Cell>
        ))}
        <Cell fold header>
          {label}
        </Cell>
      </Row>

      {/* PAR */}
      <Row cols={cols}>
        <Cell label>Par</Cell>
        {holes.map((h) => (
          <Cell key={h}>{par[h]}</Cell>
        ))}
        <Cell fold>{total(par.slice(start, end))}</Cell>
      </Row>

      {/* Players */}
      {players.map((p) => {
        const seg = p.strokes.slice(start, end);
        return (
          <Row key={p.player.id} cols={cols} player>
            <Cell label player>
              {(p.player.nickname ?? p.player.name.slice(0, 4)).toUpperCase()}
            </Cell>
            {holes.map((h) => {
              const stroke = p.strokes[h];
              const skinWon = skins?.holes[h]?.winnerId === p.player.id;
              return (
                <Cell key={h} skinDot={skinWon}>
                  <ScoreMark stroke={stroke} mark={holeMark(stroke, par[h])} />
                </Cell>
              );
            })}
            <Cell fold player>
              {total(seg) || ""}
            </Cell>
          </Row>
        );
      })}
    </div>
  );
}

function TotalRow({ players }: { players: PlayerScore[] }) {
  const cols = `2.6rem 1fr 2.4rem`;
  return (
    <div className="border-t-2 border-ink">
      <Row cols={cols} header>
        <Cell label header>
          Tot
        </Cell>
        <Cell header>&nbsp;</Cell>
        <Cell fold header>
          &nbsp;
        </Cell>
      </Row>
      {players.map((p) => (
        <Row key={p.player.id} cols={cols} player>
          <Cell label player>
            {(p.player.nickname ?? p.player.name.slice(0, 4)).toUpperCase()}
          </Cell>
          <Cell player>&nbsp;</Cell>
          <Cell fold player>
            {splits(p.strokes).tot || ""}
          </Cell>
        </Row>
      ))}
    </div>
  );
}

function CarryNote({ skins }: { skins: SkinsResult }) {
  if (skins.carry <= 0) return null;
  return (
    <div className="flex items-center gap-2 border-t border-rule px-3 py-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full border border-flag" aria-hidden />
      <span className="font-narrow text-xs font-semibold uppercase tracking-[0.08em] text-flag">
        {skins.carry} carrying
      </span>
    </div>
  );
}

// ── grid primitives ──────────────────────────────────────────────────────────

function Row({
  cols,
  children,
  header,
  player,
}: {
  cols: string;
  children: React.ReactNode;
  header?: boolean;
  player?: boolean;
}) {
  return (
    <div
      className="grid border-b border-rule last:border-b-0"
      style={{
        gridTemplateColumns: cols,
        backgroundColor: header ? "rgba(22,36,27,0.03)" : undefined,
      }}
      data-player={player}
    >
      {children}
    </div>
  );
}

function Cell({
  children,
  label,
  header,
  fold,
  player,
  skinDot,
  carryRing,
}: {
  children: React.ReactNode;
  label?: boolean;
  header?: boolean;
  fold?: boolean;
  player?: boolean;
  skinDot?: boolean;
  carryRing?: boolean;
}) {
  return (
    <div
      className="relative flex items-center justify-center border-r border-rule py-1.5 last:border-r-0"
      style={{
        borderLeft: fold ? "2px solid var(--color-ink)" : undefined,
        justifyContent: label ? "flex-start" : "center",
        paddingLeft: label ? "0.5rem" : undefined,
      }}
    >
      <span
        className={`font-narrow tabular-nums${label ? " block max-w-full truncate" : ""}`}
        style={{
          fontSize: label ? 11 : header ? 12 : 14,
          fontWeight: header || label ? 600 : player ? 600 : 500,
          letterSpacing: label || header ? "0.06em" : undefined,
          textTransform: label ? "uppercase" : undefined,
          color: label || header ? "var(--color-ink-soft)" : "var(--color-ink)",
        }}
      >
        {children}
      </span>
      {skinDot && (
        <span
          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-flag"
          aria-hidden
        />
      )}
      {carryRing && (
        <span
          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full border border-flag"
          aria-hidden
        />
      )}
    </div>
  );
}

// The number with its birdie/bogey overlay (§4.4). Drawn in ink, 1px, unfilled.
function ScoreMark({ stroke, mark }: { stroke: number | null; mark: HoleMark }) {
  if (stroke == null) return <span className="text-rule">·</span>;

  const round = mark === "birdie" || mark === "eagle";
  const square = mark === "bogey" || mark === "double";
  const doubled = mark === "eagle" || mark === "double";

  return (
    <span className="relative inline-flex h-6 w-6 items-center justify-center">
      {(round || square) && (
        <span
          className="absolute inset-[3px] border border-ink"
          style={{ borderRadius: round ? "9999px" : "1px" }}
          aria-hidden
        />
      )}
      {doubled && (
        <span
          className="absolute inset-0 border border-ink"
          style={{ borderRadius: round ? "9999px" : "1px" }}
          aria-hidden
        />
      )}
      <span className="relative">{stroke}</span>
    </span>
  );
}
