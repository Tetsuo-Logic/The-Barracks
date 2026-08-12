"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCompetition, type CompetitionInput } from "@/app/actions/competitions";
import { todayISO, heroDate } from "@/lib/dates";
import { gameHasScorecard, DEFAULT_GAME, type Game } from "@/lib/games";
import { Panel, Row, Tag, Dot } from "@/components/hq/Kit";
import type { CompetitionFormat } from "@/lib/types";
import type { SquadOption } from "@/lib/data";

const FORMATS: { value: CompetitionFormat; label: string }[] = [
  { value: "stroke", label: "Stroke" },
  { value: "skins", label: "Skins" },
  { value: "stableford", label: "Stableford" },
];

type Kind = "cup" | "casual" | "oneoff";

// The deploy sheet, widescreen. Left column sets the target, right column sets
// the parameters and holds the readout that confirms what's about to go out.
// Wired to the real `saveCompetition` — which also pings the roster.
export function DeployForm({
  games,
  squads,
  isAdmin,
}: {
  games: Game[];
  squads: SquadOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [squadId, setSquadId] = useState("");
  const [game, setGame] = useState(games[0]?.id ?? DEFAULT_GAME);
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [teeTime, setTeeTime] = useState("20:00");
  const [holes, setHoles] = useState<9 | 18>(9);
  const [format, setFormat] = useState<CompetitionFormat>("skins");
  const [kind, setKind] = useState<Kind>("cup");
  const [stake, setStake] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isGolf = gameHasScorecard(game);
  const gameDef = useMemo(() => games.find((g) => g.id === game), [games, game]);
  const squadDef = squads.find((s) => s.id === squadId) ?? null;
  const hd = heroDate(date);

  const heading =
    title.trim() || (isGolf ? course.trim() || gameDef?.name || "Operation" : gameDef?.name || "Operation");

  const recipients = squadId ? "the squad" : "every operative";

  function deploy() {
    setError(null);
    const oneoff = kind === "oneoff";
    const input: CompetitionInput = isGolf
      ? {
          game,
          squad_id: squadId || null,
          course,
          title: oneoff ? title : "",
          date,
          tee_time: teeTime || undefined,
          holes,
          format,
          for_cup: kind === "cup",
          stake: stake || undefined,
          notes: notes || undefined,
        }
      : {
          game,
          squad_id: squadId || null,
          title: title || undefined,
          date,
          tee_time: teeTime || undefined,
          holes,
          format,
          notes: notes || undefined,
        };

    startTransition(async () => {
      const res = await saveCompetition(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/hq/operations/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.8fr]">
      {/* ── Target ──────────────────────────────────────────────────────── */}
      <Panel i={0} label="Target" status={<Dot tone="warn" />}>
        <Field label="Squad">
          <Select
            value={squadId}
            onChange={(v) => {
              setSquadId(v);
              const sq = squads.find((s) => s.id === v);
              if (sq) setGame(sq.game);
            }}
          >
            <option value="">Whole Barracks</option>
            {squads.map((s) => {
              const gd = games.find((x) => x.id === s.game);
              return (
                <option key={s.id} value={s.id}>
                  {[s.clan_tag, s.name || gd?.name || s.game].filter(Boolean).join(" ")}
                </option>
              );
            })}
          </Select>
          <Hint>
            {squadId
              ? "Only this squad is on the roster and gets pinged."
              : "Everyone on strength is expected and notified."}
          </Hint>
        </Field>

        <Field label="Game">
          <Select value={game} onChange={setGame} disabled={squadId !== ""}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.emoji} {g.name}
              </option>
            ))}
          </Select>
          {squadId && <Hint>Locked — a squad is one game.</Hint>}
        </Field>

        {isGolf ? (
          <Field label="Course">
            <Input value={course} onChange={setCourse} placeholder="Course name" />
          </Field>
        ) : (
          <Field label="Operation name">
            <Input value={title} onChange={setTitle} placeholder="General play, tournament, grand final…" />
            <Hint>Optional — defaults to the game name.</Hint>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input value={date} onChange={setDate} type="date" />
          </Field>
          <Field label={isGolf ? "Tee time" : "Kick-off"}>
            <Input value={teeTime} onChange={setTeeTime} type="time" />
          </Field>
        </div>
      </Panel>

      {/* ── Parameters ──────────────────────────────────────────────────── */}
      <Panel i={1} label="Parameters">
        {isGolf ? (
          <>
            <Field label="Type">
              <Segmented
                options={[
                  { value: "cup", label: "Threeball" },
                  { value: "casual", label: "Casual" },
                  { value: "oneoff", label: "One-off" },
                ]}
                value={kind}
                onChange={(v) => setKind(v)}
              />
              <Hint>Only cup rounds count toward the Threeball standings.</Hint>
            </Field>

            {kind === "oneoff" && (
              <Field label="Event name">
                <Input value={title} onChange={setTitle} placeholder="Grand final, charity night…" />
              </Field>
            )}

            <Field label="Holes">
              <Segmented
                options={[
                  { value: 9, label: "9" },
                  { value: 18, label: "18" },
                ]}
                value={holes}
                onChange={(v) => setHoles(v)}
              />
            </Field>

            <Field label="Format">
              <Segmented options={FORMATS} value={format} onChange={(v) => setFormat(v)} />
            </Field>

            <Field label="Stake">
              <Input value={stake} onChange={setStake} placeholder="Optional" />
            </Field>
          </>
        ) : (
          <p className="hq-mono mb-4 text-[11px] uppercase tracking-[0.1em] text-ink-soft">
            {gameDef?.name ?? "This game"} needs no scorecard — a night, a roll call and a room.
          </p>
        )}

        <Field label="Briefing / orders">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={isGolf ? 3 : 8}
            placeholder="What the night is, who's needed, anything the squad should know…"
            className="w-full resize-none rounded-[3px] border border-rule bg-[rgba(0,0,0,0.35)] px-2.5 py-2 text-[13px] text-ink outline-none focus:border-sand"
          />
          <Hint>Pinned at the top of the Operation Room.</Hint>
        </Field>
      </Panel>

      {/* ── Readout + launch ────────────────────────────────────────────── */}
      <Panel i={2} label="Deployment order" sweep status={<Dot tone="live" pulse />}>
        <div className="mb-3 text-center">
          <div className="hq-label">{hd.dow}</div>
          <div className="hq-readout text-[46px] font-bold leading-[0.85]" style={{ color: "var(--color-flag)" }}>
            {hd.day}
          </div>
          <div className="hq-label">{hd.mon}</div>
        </div>

        <p className="hq-readout mb-3 text-center text-[17px] font-bold leading-tight">
          {gameDef?.emoji} {heading}
        </p>

        <Row k="Game" v={gameDef?.name ?? game} />
        <Row k="Kick-off" v={teeTime || "TBC"} tone="warn" />
        <Row k="Scope" v={squadDef ? squadDef.name || squadDef.game : "Whole Barracks"} />
        {isGolf && <Row k="Round" v={`${holes} holes · ${format.toUpperCase()}`} />}
        {isGolf && <Row k="Counts for cup" v={kind === "cup" ? "Yes" : "No"} tone={kind === "cup" ? "live" : "idle"} />}
        {stake && <Row k="Stake" v={stake} />}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag tone="warn">Roll call opens on deploy</Tag>
          <Tag tone="info">Pings {recipients}</Tag>
        </div>

        {error && (
          <p
            className="hq-mono mt-3 text-[11px] uppercase tracking-[0.1em]"
            style={{ color: "var(--color-flag)" }}
          >
            {error}
          </p>
        )}

        <button
          onClick={deploy}
          disabled={pending || !isAdmin || !date}
          className="hq-mono mt-4 w-full rounded-[3px] py-3 text-[13px] font-bold uppercase tracking-[0.14em] transition-shadow hover:[box-shadow:0_0_24px_-6px_var(--color-sand)] disabled:opacity-40"
          style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
        >
          {pending ? "Deploying…" : "▶ Deploy operation"}
        </button>
        {!isAdmin && (
          <p className="hq-mono mt-2 text-center text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            Only the CO can put a night on the board
          </p>
        )}
      </Panel>
    </div>
  );
}

// ── form bits ───────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="hq-label mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">{children}</p>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="hq-mono w-full rounded-[3px] border border-rule bg-[rgba(0,0,0,0.35)] px-2.5 py-2 text-[13px] text-ink outline-none focus:border-sand"
    />
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="hq-mono w-full appearance-none rounded-[3px] border border-rule bg-[rgba(0,0,0,0.35)] py-2 pl-2.5 pr-7 text-[13px] text-ink outline-none focus:border-sand disabled:opacity-50"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-ink-soft">
        ▼
      </span>
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-[3px] border border-rule">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className="hq-label px-3.5 py-2 transition-colors"
            style={{
              backgroundColor: active ? "var(--color-sand)" : "transparent",
              color: active ? "#0b100e" : "var(--color-ink-soft)",
              borderLeft: i > 0 ? "1px solid var(--color-rule)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
