"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { finishCompetition } from "@/app/actions/scores";
import {
  computeSkins,
  resultSummary,
  splits,
  total,
  type PlayerScore,
} from "@/lib/scoring";
import { formatLabel } from "@/lib/dates";
import type { Competition, Profile } from "@/lib/types";

// Fill the card directly: holes across the top, the players down the side, a
// stroke box in every cell. Totals and the live result update as you type. On
// post it saves, marks the round played, and the standings recompute.
export function EditableScorecard({
  comp,
  players,
  onDone,
}: {
  comp: Competition;
  players: { player: Profile; strokes: (number | null)[] }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [par, setPar] = useState<number[]>(() =>
    comp.par && comp.par.length === comp.holes ? [...comp.par] : Array(comp.holes).fill(4),
  );
  const [cards, setCards] = useState<Record<string, (number | null)[]>>(() =>
    Object.fromEntries(
      players.map((p) => [
        p.player.id,
        p.strokes.length === comp.holes ? [...p.strokes] : Array(comp.holes).fill(null),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCell(playerId: string, hole: number, value: string) {
    const n = value === "" ? null : Math.max(1, Math.min(20, Number(value)));
    setCards((c) => {
      const next = [...c[playerId]];
      next[hole] = n === null || Number.isNaN(n) ? null : n;
      return { ...c, [playerId]: next };
    });
  }

  function setParCell(hole: number, value: string) {
    const n = value === "" ? 0 : Math.max(1, Math.min(7, Number(value)));
    setPar((p) => {
      const next = [...p];
      next[hole] = Number.isNaN(n) ? 0 : n;
      return next;
    });
  }

  const scored: PlayerScore[] = useMemo(
    () => players.map((p) => ({ player: p.player, strokes: cards[p.player.id] })),
    [players, cards],
  );
  const skins = comp.format === "skins" ? computeSkins(scored, comp.holes) : null;
  const result = useMemo(() => resultSummary(comp, scored), [comp, scored]);

  async function post() {
    setSaving(true);
    setError(null);
    const res = await finishCompetition(
      comp.id,
      players.map((p) => ({ playerId: p.player.id, strokes: cards[p.player.id] })),
      par,
    );
    if (!res.ok) {
      setError(res.error);
      setSaving(false);
      return;
    }
    onDone();
    router.refresh();
  }

  const ranges =
    comp.holes === 18
      ? [
          { start: 0, end: 9, label: "OUT" },
          { start: 9, end: 18, label: "IN" },
        ]
      : [{ start: 0, end: 9, label: "OUT" }];

  return (
    <div>
      <div className="overflow-hidden rounded-[3px] border border-ink bg-card">
        {ranges.map((r, ri) => (
          <EditGrid
            key={r.label}
            players={players}
            cards={cards}
            par={par}
            start={r.start}
            end={r.end}
            label={r.label}
            skins={skins}
            onCell={setCell}
            onPar={setParCell}
            topBorder={ri > 0}
          />
        ))}
        {comp.holes === 18 && (
          <div className="grid border-t-2 border-ink" style={{ gridTemplateColumns: "2.6rem 1fr 2.6rem" }}>
            <Cell label>Tot</Cell>
            <Cell> </Cell>
            <Cell fold> </Cell>
            {players.map((p) => (
              <TotalStrip key={p.player.id} nickname={nick(p.player)} tot={splits(cards[p.player.id]).tot} />
            ))}
          </div>
        )}
      </div>

      {/* live result */}
      <div className="mt-4 rounded-[3px] border border-rule bg-card px-4 py-3">
        <p className="label mb-1">As it stands · {formatLabel(comp.format)}</p>
        {comp.format === "skins" && skins ? (
          <p className="text-ink">
            {players
              .map((p) => `${nick(p.player)} ${skins.byPlayer[p.player.id] ?? 0}`)
              .join(" · ")}
            {skins.carry > 0 && (
              <span className="text-flag"> · {skins.carry} carrying</span>
            )}
          </p>
        ) : result ? (
          <p className="text-ink">
            Leading: <span className="font-semibold">{result.player.name}</span> ({result.detail})
          </p>
        ) : (
          <p className="text-ink-soft">Enter some scores…</p>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-flag">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button
          onClick={onDone}
          className="rounded-[3px] border border-rule px-5 py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-ink-soft"
        >
          Cancel
        </button>
        <button
          onClick={post}
          disabled={saving}
          className="flex-1 rounded-[3px] bg-ink py-3 font-narrow font-semibold uppercase tracking-[0.08em] text-paper disabled:opacity-60"
        >
          {saving ? "Posting" : "Post scores"}
        </button>
      </div>
    </div>
  );
}

function nick(p: Profile) {
  return (p.nickname ?? p.name.slice(0, 4)).toUpperCase();
}

function EditGrid({
  players,
  cards,
  par,
  start,
  end,
  label,
  skins,
  onCell,
  onPar,
  topBorder,
}: {
  players: { player: Profile; strokes: (number | null)[] }[];
  cards: Record<string, (number | null)[]>;
  par: number[];
  start: number;
  end: number;
  label: string;
  skins: ReturnType<typeof computeSkins> | null;
  onCell: (playerId: string, hole: number, value: string) => void;
  onPar: (hole: number, value: string) => void;
  topBorder?: boolean;
}) {
  const holes = Array.from({ length: end - start }, (_, i) => start + i);
  const cols = `2.6rem repeat(${holes.length}, 1fr) 2.6rem`;

  return (
    <div className={topBorder ? "border-t-2 border-ink" : ""}>
      <div className="grid" style={{ gridTemplateColumns: cols, backgroundColor: "rgba(22,36,27,0.03)" }}>
        <Cell label>Hole</Cell>
        {holes.map((h) => (
          <Cell key={h} header carry={skins?.holes[h]?.carried}>
            {h + 1}
          </Cell>
        ))}
        <Cell fold header>{label}</Cell>
      </div>
      <div className="grid border-t border-rule" style={{ gridTemplateColumns: cols }}>
        <Cell label>Par</Cell>
        {holes.map((h) => (
          <div key={h} className="border-r border-rule">
            <input
              inputMode="numeric"
              maxLength={1}
              value={par[h] || ""}
              onChange={(e) => onPar(h, e.target.value)}
              className="h-9 w-full bg-transparent text-center font-narrow text-[14px] font-semibold tabular-nums text-ink-soft outline-none focus:bg-moss/10"
            />
          </div>
        ))}
        <Cell fold>{total(par.slice(start, end))}</Cell>
      </div>
      {players.map((p) => (
        <div key={p.player.id} className="grid border-t border-rule" style={{ gridTemplateColumns: cols }}>
          <Cell label player>{nick(p.player)}</Cell>
          {holes.map((h) => (
            <div key={h} className="border-r border-rule">
              <input
                inputMode="numeric"
                maxLength={2}
                value={cards[p.player.id][h] ?? ""}
                onChange={(e) => onCell(p.player.id, h, e.target.value)}
                className="h-9 w-full bg-transparent text-center font-narrow text-[15px] font-semibold tabular-nums text-ink outline-none focus:bg-moss/10"
              />
            </div>
          ))}
          <div className="flex items-center justify-center border-l-2 border-ink">
            <span className="font-narrow text-[15px] font-semibold tabular-nums text-ink">
              {total(cards[p.player.id].slice(start, end)) || ""}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TotalStrip({ nickname, tot }: { nickname: string; tot: number }) {
  return (
    <div className="col-span-3 grid border-t border-rule" style={{ gridTemplateColumns: "2.6rem 1fr 2.6rem" }}>
      <Cell label player>{nickname}</Cell>
      <Cell> </Cell>
      <Cell fold player>{tot || ""}</Cell>
    </div>
  );
}

function Cell({
  children,
  label,
  header,
  fold,
  player,
  carry,
}: {
  children: React.ReactNode;
  label?: boolean;
  header?: boolean;
  fold?: boolean;
  player?: boolean;
  carry?: boolean;
}) {
  return (
    <div
      className="relative flex h-9 items-center border-r border-rule last:border-r-0"
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
          fontWeight: header || label || player ? 600 : 500,
          letterSpacing: label || header ? "0.06em" : undefined,
          textTransform: label ? "uppercase" : undefined,
          color: label || header ? "var(--color-ink-soft)" : "var(--color-ink)",
        }}
      >
        {children}
      </span>
      {carry && (
        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full border border-flag" aria-hidden />
      )}
    </div>
  );
}
