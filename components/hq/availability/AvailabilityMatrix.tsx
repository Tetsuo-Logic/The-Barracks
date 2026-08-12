"use client";

import { useMemo, useState } from "react";
import { Dot, Tag, Meter, Proto } from "@/components/hq/Kit";
import type { SquadIntel } from "./model";

// The centrepiece: operatives down the side, nights across the top, every cell
// carrying that operative's own hours for that night. Selecting a night drops
// the per-hour headcount underneath it, which is where the "best window" comes
// from — a muster doesn't need a strict overlap, it needs a peak.

type Filter = "all" | "responded" | "silent";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "responded", label: "Reported" },
  { key: "silent", label: "Silent" },
];

export function AvailabilityMatrix({ squads }: { squads: SquadIntel[] }) {
  const [squadIdx, setSquadIdx] = useState(0);
  const squad = squads[Math.min(squadIdx, squads.length - 1)];
  const [nightISO, setNightISO] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const best = useMemo(() => {
    if (!squad) return null;
    return squad.nights.reduce<typeof squad.nights[number] | null>(
      (b, n) => (!b || n.peakCount > b.peakCount ? n : b),
      null,
    );
  }, [squad]);

  if (!squad) return null;

  const selected =
    squad.nights.find((n) => n.iso === nightISO) ?? best ?? squad.nights[0] ?? null;

  const members = squad.members.filter((m) =>
    filter === "all" ? true : filter === "responded" ? m.responded : !m.responded,
  );

  const cols = `168px repeat(${squad.nights.length}, minmax(64px, 1fr))`;
  const maxSlot = selected ? Math.max(1, ...selected.slots.map((s) => s.count)) : 1;

  return (
    <section className="hq-panel hq-rise" style={{ ["--i" as string]: 6 }}>
      {/* ── Squad selector ─────────────────────────────────────────────── */}
      <header className="hq-panel-head flex-wrap">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h2 className="hq-label mr-1.5">Availability matrix</h2>
          {squads.map((s, i) => {
            const on = s.id === squad.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setSquadIdx(i);
                  setNightISO(null);
                }}
                className="hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
                style={{
                  borderColor: on ? "var(--color-sand)" : "var(--color-rule)",
                  backgroundColor: on ? "rgba(245,182,61,0.1)" : "transparent",
                  color: on ? "var(--color-sand)" : "var(--color-ink-soft)",
                }}
              >
                {s.emoji} {s.name}
                {!s.live && <span className="ml-1 opacity-50">·proto</span>}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="hq-label rounded-[3px] px-2 py-1 transition-colors"
              style={{
                color: filter === f.key ? "var(--color-ink)" : "var(--color-ink-soft)",
                backgroundColor: filter === f.key ? "rgba(255,255,255,0.05)" : "transparent",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Squad readout strip ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-rule px-4 py-2.5">
        <span className="flex items-center gap-2">
          <Dot tone={squad.live ? (squad.status === "proposed" ? "warn" : "live") : "idle"} pulse={squad.live} />
          <span className="hq-mono text-[11px] uppercase tracking-[0.14em]">
            {squad.live
              ? squad.status === "proposed"
                ? "Muster proposed · with the President"
                : "Muster open · collecting"
              : "No muster running"}
          </span>
        </span>
        <span className="hq-label">
          Window <span className="hq-mono text-ink">{squad.windowFrom}–{squad.windowTo}</span>
        </span>
        <span className="hq-label">
          Required <span className="hq-mono text-ink">{squad.required}</span> of {squad.total}
        </span>
        <span className="hq-label">
          Reported{" "}
          <span className="hq-mono" style={{ color: squad.responded === squad.total ? "var(--color-moss)" : "var(--color-sand)" }}>
            {squad.responded}/{squad.total}
          </span>
        </span>
        {squad.note && <span className="truncate text-xs text-ink-soft">“{squad.note}”</span>}
        {!squad.live && <Proto>Prototyped from roster</Proto>}
      </div>

      {/* ── Matrix ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto p-4">
        <div className="min-w-[720px]">
          {/* Night headers */}
          <div className="grid gap-px" style={{ gridTemplateColumns: cols }}>
            <div className="hq-label flex items-end pb-2">Operative</div>
            {squad.nights.map((n) => {
              const on = selected?.iso === n.iso;
              const strong = n.peakCount >= squad.required;
              return (
                <button
                  key={n.iso}
                  onClick={() => setNightISO(n.iso)}
                  className="border-b px-1 pb-2 pt-1 text-center transition-colors"
                  style={{
                    borderColor: on ? "var(--color-sand)" : "var(--color-rule)",
                    backgroundColor: on ? "rgba(245,182,61,0.06)" : "transparent",
                  }}
                >
                  <span className="hq-label block" style={{ color: on ? "var(--color-sand)" : undefined }}>
                    {n.dow}
                  </span>
                  <span className="hq-readout block text-[17px] font-bold leading-none">{n.day}</span>
                  <span
                    className="hq-mono mt-1 block text-[10px] tracking-[0.06em]"
                    style={{ color: strong ? "var(--color-moss)" : n.count > 0 ? "var(--color-sand)" : "var(--color-ink-soft)" }}
                  >
                    {n.count}/{squad.total}
                  </span>
                  <span className="hq-mono block text-[9px] tracking-[0.04em] text-ink-soft">
                    {n.peakFrom ? `${n.peakFrom} · ${n.peakCount}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Member rows */}
          <div className="mt-1 flex flex-col gap-px">
            {members.length === 0 ? (
              <p className="hq-mono py-6 text-center text-xs uppercase tracking-[0.14em] text-ink-soft">
                No operatives match that filter
              </p>
            ) : (
              members.map((m, i) => (
                <div
                  key={m.id}
                  className="hq-rise grid items-stretch gap-px"
                  style={{ gridTemplateColumns: cols, ["--i" as string]: i }}
                >
                  <div className="flex min-w-0 items-center gap-2 border-r border-rule/60 py-1 pr-2">
                    <Dot tone={m.responded ? (m.nights > 0 ? "live" : "idle") : "alert"} />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{m.name}</span>
                    {m.captain && <Tag tone="warn">C</Tag>}
                    <span className="hq-mono w-6 shrink-0 text-right text-[10px] text-ink-soft">
                      {m.responded ? m.nights : "—"}
                    </span>
                  </div>

                  {squad.nights.map((n) => {
                    const c = squad.cells[m.id]?.[n.iso];
                    const on = selected?.iso === n.iso;
                    const state = c?.state ?? "silent";
                    const tone =
                      state === "on"
                        ? c!.full
                          ? "var(--color-moss)"
                          : "var(--color-sand)"
                        : state === "off"
                          ? "var(--color-flag)"
                          : "var(--color-rule)";
                    return (
                      <div
                        key={n.iso}
                        title={
                          state === "on"
                            ? `${m.name} · ${n.dow} ${n.day} · ${c!.from}–${c!.to}${c!.full ? " (full window)" : " (partial)"}`
                            : state === "off"
                              ? `${m.name} · ${n.dow} ${n.day} · unavailable`
                              : `${m.name} · no response`
                        }
                        className="flex flex-col items-center justify-center px-0.5 py-1"
                        style={{
                          backgroundColor:
                            state === "silent"
                              ? on
                                ? "rgba(255,255,255,0.02)"
                                : "transparent"
                              : `color-mix(in srgb, ${tone} ${state === "on" ? (c!.full ? 16 : 13) : 7}%, transparent)`,
                          borderTop: `1px solid color-mix(in srgb, ${tone} ${state === "silent" ? 60 : 45}%, transparent)`,
                          outline: on ? "1px solid rgba(245,182,61,0.18)" : "none",
                        }}
                      >
                        {state === "on" ? (
                          <>
                            <span className="hq-mono text-[10px] leading-tight" style={{ color: tone }}>
                              {c!.from}
                            </span>
                            <span className="hq-mono text-[10px] leading-tight text-ink-soft">{c!.to}</span>
                          </>
                        ) : (
                          <span
                            className="hq-mono text-[11px] leading-none"
                            style={{ color: state === "off" ? "color-mix(in srgb, var(--color-flag) 70%, transparent)" : "#3a463f" }}
                          >
                            {state === "off" ? "✕" : "·"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-rule/60 pt-2.5">
            {[
              { c: "var(--color-moss)", t: "Full window" },
              { c: "var(--color-sand)", t: "Partial hours" },
              { c: "var(--color-flag)", t: "Unavailable" },
              { c: "var(--color-rule)", t: "No response" },
            ].map((l) => (
              <span key={l.t} className="hq-label flex items-center gap-1.5">
                <span className="h-2 w-4 rounded-[1px]" style={{ backgroundColor: l.c, opacity: 0.55 }} />
                {l.t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Per-hour headcount for the selected night ──────────────────── */}
      {selected && (
        <div className="border-t border-rule px-4 py-3">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="hq-label">Per-hour headcount</span>
              <span className="hq-readout text-[15px] font-bold uppercase">
                {selected.dow} {selected.day} {selected.mon}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="hq-label">Best window</span>
              <span
                className="hq-readout text-[18px] font-bold leading-none"
                style={{ color: selected.peakCount >= squad.required ? "var(--color-moss)" : "var(--color-sand)" }}
              >
                {selected.peakFrom ? `${selected.peakFrom}–${selected.peakTo}` : "NO OVERLAP"}
              </span>
              <span className="hq-mono text-[12px] text-ink-soft">
                {selected.peakCount} on · required {squad.required}
              </span>
            </div>
          </div>

          <div
            className="grid items-end gap-1"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, selected.slots.length)}, minmax(0, 1fr))` }}
          >
            {selected.slots.map((s) => {
              const meets = s.count >= squad.required;
              const peak = s.count === selected.peakCount && s.count > 0;
              return (
                <div key={s.slot} className="flex flex-col items-center gap-1">
                  <span
                    className="hq-mono text-[11px] font-bold leading-none"
                    style={{ color: meets ? "var(--color-moss)" : s.count > 0 ? "var(--color-sand)" : "#3a463f" }}
                  >
                    {s.count}
                  </span>
                  <div
                    className="w-full rounded-[1px] transition-[height] duration-500"
                    style={{
                      height: `${Math.max(3, (s.count / maxSlot) * 46)}px`,
                      backgroundColor: meets ? "var(--color-moss)" : "var(--color-sand)",
                      opacity: s.count === 0 ? 0.12 : peak ? 0.95 : 0.42,
                    }}
                  />
                  <span className="hq-mono text-[9px] tracking-[0.02em] text-ink-soft">{s.slot}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="hq-label shrink-0">Coverage</span>
            <div className="min-w-0 flex-1">
              <Meter
                pct={squad.total ? (selected.peakCount / squad.total) * 100 : 0}
                tone={selected.peakCount >= squad.required ? "live" : "warn"}
              />
            </div>
            <span className="hq-mono shrink-0 text-[11px] text-ink-soft">
              {selected.peakCount}/{squad.total}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
