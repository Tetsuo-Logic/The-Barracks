"use client";

import { useMemo, useState } from "react";
import { Panel, Dot, Tag, Meter, Nil, Proto } from "@/components/hq/Kit";
import {
  NIGHTS,
  PLATFORMS,
  REGIONS,
  SIZE_BANDS,
  TEMPERS,
  TIMEZONES,
  type Org,
} from "@/lib/hq/future/network";

// ── Find opponent ──────────────────────────────────────────────────────────
// A directory of organisations, not a list of people. You filter for a Barracks
// that plays your game, at your size, on your nights — then you issue a
// challenge to the outfit, and their Captain answers for them.

type Sent = { format: string; nights: string[]; time: string };

const btn =
  "hq-mono rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors";

const FORMATS = ["Best of 3", "Best of 5", "Best of 7", "One night"];
const TIMES = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={btn}
      style={{
        borderColor: on ? "var(--color-sand)" : "var(--color-rule)",
        backgroundColor: on ? "var(--color-sand)" : "transparent",
        color: on ? "#0b100e" : "var(--color-ink-soft)",
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-rule/60 py-2.5 last:border-0">
      <p className="hq-label mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  anyLabel = "Any",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  anyLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="hq-mono w-full rounded-[3px] border border-rule bg-[rgba(0,0,0,0.3)] px-2 py-1.5 text-[11px] uppercase tracking-[0.1em] outline-none focus:border-sand"
    >
      <option value="all">{anyLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export function OpponentFinder({
  orgs,
  gameNames,
}: {
  orgs: Org[];
  gameNames: Record<string, string>;
}) {
  const [game, setGame] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [region, setRegion] = useState("all");
  const [timezone, setTimezone] = useState("all");
  const [temper, setTemper] = useState("all");
  const [size, setSize] = useState("all");
  const [nights, setNights] = useState<string[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [q, setQ] = useState("");

  const [composing, setComposing] = useState<Org | null>(null);
  const [sent, setSent] = useState<Record<string, Sent>>({});

  const games = useMemo(() => Array.from(new Set(orgs.map((o) => o.game))), [orgs]);

  const results = useMemo(() => {
    return orgs.filter((o) => {
      if (game !== "all" && o.game !== game) return false;
      if (platform !== "all" && o.platform !== platform) return false;
      if (region !== "all" && o.region !== region) return false;
      if (timezone !== "all" && o.timezone !== timezone) return false;
      if (temper !== "all" && o.temper !== temper) return false;
      if (size !== "all") {
        const band = SIZE_BANDS.find((b) => b.key === size);
        if (band && (o.operatives < band.min || o.operatives > band.max)) return false;
      }
      if (nights.length && !nights.some((n) => o.nights.includes(n))) return false;
      if (openOnly && !o.openToChallenges) return false;
      if (q.trim() && !`${o.name} ${o.tag} ${o.motto}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [orgs, game, platform, region, timezone, temper, size, nights, openOnly, q]);

  function reset() {
    setGame("all");
    setPlatform("all");
    setRegion("all");
    setTimezone("all");
    setTemper("all");
    setSize("all");
    setNights([]);
    setOpenOnly(true);
    setQ("");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[290px_1fr]">
      {/* ── Filter rail ───────────────────────────────────────────────── */}
      <div className="xl:sticky xl:top-[68px] xl:self-start">
        <Panel
          i={0}
          label="Filters"
          right={
            <button onClick={reset} className="hq-label transition-colors hover:text-ink">
              Reset
            </button>
          }
        >
          <Field label="Search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, tag, motto…"
              className="hq-mono w-full rounded-[3px] border border-rule bg-[rgba(0,0,0,0.3)] px-2 py-1.5 text-[11px] outline-none placeholder:text-ink-soft focus:border-sand"
            />
          </Field>

          <Field label="Game">
            <Select value={game} onChange={setGame} options={games} anyLabel="Any game" />
          </Field>

          <Field label="Platform">
            <Select value={platform} onChange={setPlatform} options={PLATFORMS} anyLabel="Any platform" />
          </Field>

          <Field label="Region">
            <Select value={region} onChange={setRegion} options={REGIONS} anyLabel="Anywhere" />
          </Field>

          <Field label="Timezone">
            <Select value={timezone} onChange={setTimezone} options={TIMEZONES} anyLabel="Any timezone" />
          </Field>

          <Field label="Squad size">
            <div className="flex flex-wrap gap-1.5">
              <Chip on={size === "all"} onClick={() => setSize("all")}>Any</Chip>
              {SIZE_BANDS.map((b) => (
                <Chip key={b.key} on={size === b.key} onClick={() => setSize(b.key)}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Temperament">
            <div className="flex flex-wrap gap-1.5">
              <Chip on={temper === "all"} onClick={() => setTemper("all")}>Any</Chip>
              {TEMPERS.map((t) => (
                <Chip key={t} on={temper === t} onClick={() => setTemper(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Preferred nights">
            <div className="flex flex-wrap gap-1.5">
              {NIGHTS.map((n) => (
                <Chip
                  key={n}
                  on={nights.includes(n)}
                  onClick={() => setNights((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Availability">
            <button
              onClick={() => setOpenOnly((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-[3px] border border-rule px-2 py-1.5 transition-colors hover:border-ink-soft"
            >
              <span className="hq-mono text-[11px] uppercase tracking-[0.1em]">Open to challenges</span>
              <span
                className="hq-mono rounded-[2px] px-1.5 py-0.5 text-[9px] font-bold"
                style={{
                  backgroundColor: openOnly ? "var(--color-moss)" : "var(--color-rule)",
                  color: openOnly ? "#0b100e" : "var(--color-ink-soft)",
                }}
              >
                {openOnly ? "ONLY" : "ALL"}
              </span>
            </button>
          </Field>

          <p className="hq-mono mt-3 border-t border-rule/60 pt-2 text-[10px] uppercase leading-[1.6] tracking-[0.08em] text-ink-soft">
            {results.length} of {orgs.length} Barracks match
          </p>
        </Panel>
      </div>

      {/* ── Results ───────────────────────────────────────────────────── */}
      <div>
        {results.length === 0 ? (
          <Panel i={1}>
            <Nil>No Barracks match those orders — widen the filters</Nil>
          </Panel>
        ) : (
          <div className="grid gap-4 2xl:grid-cols-2">
            {results.map((o, i) => {
              const rate = o.record.p ? Math.round((o.record.w / o.record.p) * 100) : 0;
              const s = sent[o.id];
              return (
                <Panel
                  key={o.id}
                  i={i + 1}
                  label={o.name}
                  status={<Dot tone={o.lastActive === "Online now" ? "live" : "idle"} pulse={o.lastActive === "Online now"} />}
                  right={
                    o.openToChallenges ? (
                      <Tag tone="live">Open to challenges</Tag>
                    ) : (
                      <Tag tone="idle">Closed</Tag>
                    )
                  }
                >
                  <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
                    {o.tag} · {(gameNames[o.game] ?? o.game).toUpperCase()} SQUAD · {o.operatives} OPERATIVES ·{" "}
                    {o.region} · {o.nights.map((n) => n.toUpperCase()).join("–")}
                  </p>
                  <p className="mt-2 text-[13px] italic text-ink-soft">“{o.motto}”</p>

                  <div className="mt-3 grid grid-cols-[auto_1fr] items-end gap-4">
                    <div>
                      <div className="hq-readout text-[24px] font-bold leading-none">
                        <span style={{ color: "var(--color-moss)" }}>{o.record.w}</span>
                        <span className="text-ink-soft">–</span>
                        <span style={{ color: "var(--color-flag)" }}>{o.record.l}</span>
                      </div>
                      <p className="hq-label mt-1">Record · {o.record.p} battles</p>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="hq-label">Form</span>
                        <span className="flex gap-1">
                          {o.form.map((f, idx) => (
                            <span
                              key={idx}
                              className="hq-mono flex h-4 w-4 items-center justify-center rounded-[2px] text-[9px] font-bold"
                              style={{
                                backgroundColor: f === "W" ? "var(--color-moss)" : "var(--color-flag)",
                                color: "#0b100e",
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </span>
                      </div>
                      <Meter pct={rate} tone={rate >= 55 ? "live" : rate >= 40 ? "warn" : "alert"} />
                      <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        {rate}% win rate · {o.temper} · {o.platform} · {o.timezone}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-rule/60 pt-3">
                    {s ? (
                      <span className="hq-mono flex items-center gap-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--color-sand)" }}>
                        <span className="hq-dot hq-dot-live" style={{ backgroundColor: "var(--color-sand)" }} />
                        Challenge sent · {s.format} · {s.nights.join("/") || "any night"} {s.time} · awaiting answer
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => setComposing(o)}
                          disabled={!o.openToChallenges}
                          className={`${btn} disabled:opacity-40`}
                          style={
                            o.openToChallenges
                              ? { borderColor: "var(--color-sand)", backgroundColor: "var(--color-sand)", color: "#0b100e" }
                              : { borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }
                          }
                        >
                          Issue challenge
                        </button>
                        <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          Captain {o.captain} · est. {o.founded} · {o.lastActive.toLowerCase()}
                        </span>
                      </>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>

      {composing && (
        <ChallengeComposer
          org={composing}
          gameName={gameNames[composing.game] ?? composing.game}
          onClose={() => setComposing(null)}
          onSend={(payload) => {
            setSent((s) => ({ ...s, [composing.id]: payload }));
            setComposing(null);
          }}
        />
      )}
    </div>
  );
}

// ── Challenge composer ─────────────────────────────────────────────────────
// The formal act: one Barracks challenging another. Addressed to the outfit and
// answered by their Captain — never sent to an individual.
function ChallengeComposer({
  org,
  gameName,
  onClose,
  onSend,
}: {
  org: Org;
  gameName: string;
  onClose: () => void;
  onSend: (p: Sent) => void;
}) {
  const [format, setFormat] = useState("Best of 5");
  const [nights, setNights] = useState<string[]>(org.nights);
  const [time, setTime] = useState("20:30");
  const [note, setNote] = useState(
    `The Barracks challenge ${org.name} at ${gameName}. Our nights are on the table — mark what suits and we'll take the overlap.`,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(4,7,6,0.78)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-[560px]" onClick={(e) => e.stopPropagation()}>
        <Panel
          label={`Challenge · ${org.name}`}
          status={<Dot tone="alert" pulse />}
          right={
            <>
              <Proto />
              <button onClick={onClose} className="hq-label transition-colors hover:text-ink">✕</button>
            </>
          }
        >
          <p className="hq-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
            To: {org.tag} · {org.name} · Captain {org.captain} · {org.region} / {org.timezone}
          </p>

          <div className="mt-3">
            <p className="hq-label mb-1.5">Format</p>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <Chip key={f} on={format === f} onClick={() => setFormat(f)}>{f}</Chip>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <p className="hq-label mb-1.5">Nights we can make</p>
            <div className="flex flex-wrap gap-1.5">
              {NIGHTS.map((n) => (
                <Chip
                  key={n}
                  on={nights.includes(n)}
                  onClick={() => setNights((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))}
                >
                  {n}
                </Chip>
              ))}
            </div>
            <p className="hq-mono mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              They usually play {org.nights.join(", ")}
            </p>
          </div>

          <div className="mt-3">
            <p className="hq-label mb-1.5">Kick-off</p>
            <div className="flex flex-wrap gap-1.5">
              {TIMES.map((t) => (
                <Chip key={t} on={time === t} onClick={() => setTime(t)}>{t}</Chip>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <p className="hq-label mb-1.5">Message</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-[3px] border border-rule bg-[rgba(0,0,0,0.3)] px-2.5 py-2 text-[13px] outline-none focus:border-sand"
            />
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-rule/60 pt-3">
            <button
              onClick={() => onSend({ format, nights, time })}
              disabled={nights.length === 0}
              className={`${btn} disabled:opacity-40`}
              style={{ borderColor: "var(--color-sand)", backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              Send challenge
            </button>
            <button onClick={onClose} className={`${btn} border-rule text-ink-soft hover:text-ink`}>
              Stand down
            </button>
            <span className="hq-mono ml-auto text-[10px] uppercase tracking-[0.1em] text-ink-soft">
              Their Captain answers for the outfit
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
