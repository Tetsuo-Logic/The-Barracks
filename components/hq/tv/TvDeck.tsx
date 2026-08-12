"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// The deck. One card at a time, eight seconds each, cycling forever. Everything
// on screen has to survive being read from a sofa: nothing under ~13px, the one
// number that matters is the biggest thing on the card, and the chrome (clock,
// progress, ticker) never moves so the eye can rest.

export type TvNext = {
  iso: string; // 'YYYY-MM-DDTHH:MM:SS' — kick-off, wall clock
  dow: string;
  day: string;
  mon: string;
  title: string;
  game: string;
  emoji: string;
  time: string;
  stake: string | null;
  forCup: boolean;
  squad: string | null;
  in: number;
  maybe: number;
  out: number;
  silent: number;
  total: number;
};

export type TvLive = {
  title: string;
  emoji: string;
  startedAt: string;
  games: number;
  roster: string[];
};

export type TvSquad = {
  name: string;
  emoji: string;
  tag: string | null;
  captain: string | null;
  members: number;
  state: string;
  tone: "live" | "warn" | "idle" | "alert";
};

export type TvRadar = {
  title: string;
  platform: string | null;
  release: string | null;
  releaseLabel: string;
  days: number | null;
  yes: number;
  total: number;
  queue: { title: string; label: string }[];
};

export type TvResult = {
  title: string;
  emoji: string;
  dow: string;
  day: string;
  mon: string;
  winner: string | null;
  places: { name: string; place: number | null; score: number | null }[];
};

export type TvCourt = {
  headline: string;
  sub: string;
  open: number;
  lines: { text: string; tone: "alert" | "warn" | "info" | "live" }[];
};

export type TvLeadership = {
  president: string | null;
  captains: { squad: string; name: string | null }[];
  table: { name: string; wins: number; played: number; winPct: number; streak: string; champion: boolean }[];
};

export type TvData = {
  barracks: string;
  operatives: number;
  online: number;
  operationsRun: number;
  hoursDeployed: number;
  tonight: number;
  next: TvNext | null;
  live: TvLive | null;
  squads: TvSquad[];
  radar: TvRadar | null;
  result: TvResult | null;
  court: TvCourt;
  leadership: TvLeadership;
  ticker: string[];
};

const TONE: Record<string, string> = {
  live: "var(--color-moss)",
  warn: "var(--color-sand)",
  alert: "var(--color-flag)",
  idle: "var(--color-rule)",
  info: "var(--color-ink-soft)",
};

const DURATION = 8000;

type CardKey = "next" | "live" | "squads" | "radar" | "result" | "court" | "leadership";

const CARD_TITLE: Record<CardKey, string> = {
  next: "Next operation",
  live: "Live operation",
  squads: "Squad status",
  radar: "Radar · release countdown",
  result: "Latest result",
  court: "Court notice",
  leadership: "Leadership status",
};

// ── Small display primitives ──────────────────────────────────────────────
function Label({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <p
      className="hq-mono font-semibold uppercase"
      style={{ fontSize: "clamp(11px, 0.85vw, 15px)", letterSpacing: "0.28em", color: tone ?? "var(--color-ink-soft)" }}
    >
      {children}
    </p>
  );
}

function Huge({
  children,
  tone = "var(--color-ink)",
  size = "clamp(44px, 6vw, 112px)",
  glow = false,
}: {
  children: React.ReactNode;
  tone?: string;
  size?: string;
  glow?: boolean;
}) {
  return (
    <p
      className={`hq-readout font-bold uppercase leading-[0.86] ${glow ? "tv-glow" : ""}`}
      style={{ fontSize: size, color: tone, letterSpacing: "-0.015em" }}
    >
      {children}
    </p>
  );
}

function Bar({ pct, tone = "var(--color-moss)", h = 10 }: { pct: number; tone?: string; h?: number }) {
  return (
    <div style={{ height: h, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: tone,
          borderRadius: 99,
          transition: "width 900ms cubic-bezier(0.22,1,0.36,1)",
          boxShadow: `0 0 22px ${tone}`,
        }}
      />
    </div>
  );
}

/** Big kick-off countdown. Placeholder first, ticks after mount. */
function TvCountdown({ iso }: { iso: string }) {
  const [parts, setParts] = useState<{ k: string; v: string }[]>([
    { k: "Days", v: "--" },
    { k: "Hrs", v: "--" },
    { k: "Min", v: "--" },
    { k: "Sec", v: "--" },
  ]);
  const [past, setPast] = useState(false);

  useEffect(() => {
    const target = new Date(iso).getTime();
    const tick = () => {
      const ms = target - Date.now();
      setPast(ms <= 0);
      const s = Math.floor(Math.abs(ms) / 1000);
      setParts([
        { k: "Days", v: String(Math.floor(s / 86400)).padStart(2, "0") },
        { k: "Hrs", v: String(Math.floor((s % 86400) / 3600)).padStart(2, "0") },
        { k: "Min", v: String(Math.floor((s % 3600) / 60)).padStart(2, "0") },
        { k: "Sec", v: String(s % 60).padStart(2, "0") },
      ]);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);

  return (
    <div>
      <Label tone={past ? "var(--color-moss)" : "var(--color-sand)"}>
        {past ? "Elapsed since kick-off" : "Until deployment"}
      </Label>
      <div className="mt-3 flex items-start gap-[clamp(10px,1.4vw,26px)]">
        {parts.map((p) => (
          <div key={p.k} className="text-center">
            <span
              className="hq-readout tv-glow block font-bold leading-none"
              style={{
                fontSize: "clamp(38px, 4.6vw, 88px)",
                color: past ? "var(--color-moss)" : "var(--color-sand)",
              }}
            >
              {p.v}
            </span>
            <span
              className="hq-mono mt-1.5 block uppercase"
              style={{ fontSize: "clamp(9px, 0.6vw, 12px)", letterSpacing: "0.26em", color: "var(--color-ink-soft)" }}
            >
              {p.k}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TvElapsed({ since }: { since: string }) {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const start = new Date(since).getTime();
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setT(
        `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);
  return (
    <span className="hq-readout tv-glow font-bold leading-none" style={{ fontSize: "clamp(44px, 6vw, 108px)", color: "var(--color-moss)" }}>
      {t}
    </span>
  );
}

// ── The deck ──────────────────────────────────────────────────────────────
export function TvDeck({ data }: { data: TvData }) {
  const cards = useMemo<CardKey[]>(() => {
    const out: CardKey[] = ["next", "live"];
    if (data.squads.length) out.push("squads");
    if (data.radar) out.push("radar");
    if (data.result) out.push("result");
    out.push("court", "leadership");
    return out;
  }, [data]);

  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [today, setToday] = useState("");

  const go = useCallback(
    (d: number) => {
      setProgress(0);
      setIdx((v) => (v + d + cards.length) % cards.length);
    },
    [cards.length],
  );

  // Live clock — placeholder on the server, ticking after mount.
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      setToday(
        d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }).toUpperCase(),
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // The carousel.
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const t = setInterval(() => {
      const p = (Date.now() - started) / DURATION;
      if (p >= 1) {
        setProgress(0);
        setIdx((v) => (v + 1) % cards.length);
      } else {
        setProgress(p);
      }
    }, 60);
    return () => clearInterval(t);
  }, [idx, paused, cards.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const key = cards[Math.min(idx, cards.length - 1)];

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* ── Chrome: identity, clock, deck position ─────────────────────── */}
      <header className="flex shrink-0 items-center gap-6 border-b border-rule px-[clamp(20px,2.4vw,48px)] py-[clamp(12px,1.4vw,22px)]">
        <div className="flex items-center gap-3">
          <span className="hq-dot hq-dot-live" style={{ backgroundColor: "var(--color-moss)", width: 10, height: 10 }} />
          <span
            className="hq-readout font-bold uppercase"
            style={{ fontSize: "clamp(15px, 1.3vw, 24px)", letterSpacing: "0.1em", color: "var(--color-sand)" }}
          >
            {data.barracks}
          </span>
          <span className="hq-mono uppercase" style={{ fontSize: "clamp(10px,0.75vw,13px)", letterSpacing: "0.24em", color: "#48594f" }}>
            Barracks TV
          </span>
        </div>

        <div className="ml-auto flex items-center gap-[clamp(14px,1.8vw,34px)]">
          <span className="hq-mono uppercase" style={{ fontSize: "clamp(10px,0.75vw,13px)", letterSpacing: "0.2em", color: "var(--color-ink-soft)" }}>
            {data.operatives} operatives · {data.online} online · {data.operationsRun} ops run
          </span>
          <span className="hq-mono uppercase" style={{ fontSize: "clamp(10px,0.75vw,13px)", letterSpacing: "0.2em", color: "var(--color-ink-soft)" }}>
            {today || " "}
          </span>
          <span
            className="hq-readout font-bold tabular-nums"
            style={{ fontSize: "clamp(20px, 1.9vw, 38px)", letterSpacing: "0.06em" }}
          >
            {clock}
          </span>
        </div>
      </header>

      {/* ── Card ───────────────────────────────────────────────────────── */}
      <main className="relative min-h-0 flex-1">
        <div
          key={key}
          className="tv-card absolute inset-0 flex flex-col px-[clamp(20px,3vw,64px)] py-[clamp(16px,2.2vw,44px)]"
        >
          <div className="mb-[clamp(10px,1.4vw,26px)] flex shrink-0 items-center gap-3">
            <span
              className="hq-mono font-bold uppercase"
              style={{ fontSize: "clamp(12px, 1vw, 18px)", letterSpacing: "0.34em", color: "var(--color-flag)" }}
            >
              {CARD_TITLE[key]}
            </span>
            <span className="h-px flex-1" style={{ background: "var(--color-rule)" }} />
            <span className="hq-mono" style={{ fontSize: "clamp(10px,0.7vw,13px)", letterSpacing: "0.2em", color: "#48594f" }}>
              {String(idx + 1).padStart(2, "0")} / {String(cards.length).padStart(2, "0")}
            </span>
          </div>

          <div className="tv-stagger min-h-0 flex-1">{renderCard(key, data)}</div>
        </div>
      </main>

      {/* ── Ticker + progress ──────────────────────────────────────────── */}
      <footer className="shrink-0 border-t border-rule">
        <div className="flex items-center gap-4 overflow-hidden px-[clamp(20px,2.4vw,48px)] py-[clamp(8px,0.9vw,14px)]">
          <span
            className="hq-mono shrink-0 font-bold uppercase"
            style={{ fontSize: "clamp(9px,0.65vw,12px)", letterSpacing: "0.24em", color: "var(--color-flag)" }}
          >
            ◂ Traffic
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <span
              className="tv-tick hq-mono uppercase"
              style={{ fontSize: "clamp(10px,0.75vw,13px)", letterSpacing: "0.16em", color: "var(--color-ink-soft)" }}
            >
              {[...data.ticker, ...data.ticker].map((t, i) => (
                <span key={i} className="mr-10">
                  <span style={{ color: "#3f5148" }}>▸ </span>
                  {t}
                </span>
              ))}
            </span>
          </div>
          {paused && (
            <span className="hq-mono shrink-0 uppercase" style={{ fontSize: "clamp(9px,0.65vw,12px)", letterSpacing: "0.2em", color: "var(--color-sand)" }}>
              ‖ Paused
            </span>
          )}
        </div>
        <div style={{ height: 3, background: "rgba(255,255,255,0.05)" }}>
          <span
            style={{
              display: "block",
              height: "100%",
              width: `${progress * 100}%`,
              background: "var(--color-sand)",
              boxShadow: "0 0 16px var(--color-sand)",
            }}
          />
        </div>
      </footer>
    </div>
  );
}

// ── Cards ─────────────────────────────────────────────────────────────────
function renderCard(key: CardKey, d: TvData) {
  switch (key) {
    case "next":
      return <NextCard d={d} />;
    case "live":
      return <LiveCard d={d} />;
    case "squads":
      return <SquadsCard d={d} />;
    case "radar":
      return <RadarCard d={d} />;
    case "result":
      return <ResultCard d={d} />;
    case "court":
      return <CourtCard d={d} />;
    case "leadership":
      return <LeadershipCard d={d} />;
  }
}

function NextCard({ d }: { d: TvData }) {
  const n = d.next;
  if (!n) {
    return (
      <div className="flex h-full flex-col justify-center" style={{ ["--i" as string]: 0 }}>
        <Huge tone="var(--color-ink-soft)">No operation on the board</Huge>
        <p className="hq-mono mt-4 uppercase" style={{ fontSize: "clamp(12px,1vw,18px)", letterSpacing: "0.24em", color: "#48594f" }}>
          Deploy one from Headquarters
        </p>
      </div>
    );
  }
  const pct = n.total ? (n.in / n.total) * 100 : 0;
  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <div className="flex min-h-0 flex-1 items-center gap-[clamp(20px,3.2vw,72px)]" style={{ ["--i" as string]: 0 }}>
        {/* Date stack */}
        <div className="shrink-0 text-center">
          <span className="hq-mono block uppercase" style={{ fontSize: "clamp(12px,1vw,18px)", letterSpacing: "0.3em", color: "var(--color-ink-soft)" }}>
            {n.dow}
          </span>
          <span
            className="hq-readout tv-glow block font-bold leading-[0.8]"
            style={{ fontSize: "clamp(78px, 10vw, 190px)", color: "var(--color-flag)" }}
          >
            {n.day}
          </span>
          <span className="hq-mono block uppercase" style={{ fontSize: "clamp(12px,1vw,18px)", letterSpacing: "0.3em", color: "var(--color-ink-soft)" }}>
            {n.mon}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <Huge size="clamp(34px, 4.4vw, 84px)">
            {n.emoji} {n.title}
          </Huge>
          <p
            className="hq-mono mt-3 uppercase"
            style={{ fontSize: "clamp(12px, 1.05vw, 20px)", letterSpacing: "0.2em", color: "var(--color-sand)" }}
          >
            {n.game}
            {n.time ? ` · ${n.time}` : ""}
            {n.stake ? ` · ${n.stake}` : ""}
            {n.squad ? ` · ${n.squad} squad` : ""}
            {n.forCup ? " · counts for the cup" : ""}
          </p>
        </div>

        <div className="shrink-0 border-l border-rule pl-[clamp(18px,2.4vw,52px)]">
          <TvCountdown iso={n.iso} />
        </div>
      </div>

      {/* Roster */}
      <div style={{ ["--i" as string]: 1 }}>
        <div className="mb-2 flex items-baseline justify-between">
          <Label>Roster</Label>
          <span className="hq-mono uppercase" style={{ fontSize: "clamp(12px,1vw,18px)", letterSpacing: "0.16em" }}>
            <span style={{ color: "var(--color-moss)" }}>{n.in} IN</span>
            <span style={{ color: "var(--color-ink-soft)" }}>
              {" "}
              · {n.maybe} MAYBE · {n.out} OUT · {n.silent} SILENT
            </span>
          </span>
        </div>
        <Bar pct={pct} tone={pct >= 60 ? "var(--color-moss)" : "var(--color-sand)"} h={12} />
      </div>
    </div>
  );
}

function LiveCard({ d }: { d: TvData }) {
  if (!d.live) {
    return (
      <div className="flex h-full flex-col justify-center gap-5">
        <div style={{ ["--i" as string]: 0 }}>
          <Label>Operation room</Label>
          <Huge tone="var(--color-ink-soft)" size="clamp(42px, 6vw, 118px)">
            No live operation
          </Huge>
        </div>
        <p
          className="hq-mono uppercase"
          style={{ ["--i" as string]: 1, fontSize: "clamp(13px,1.15vw,22px)", letterSpacing: "0.22em", color: "var(--color-sand)" }}
        >
          {d.tonight > 0
            ? `${d.tonight} operation${d.tonight === 1 ? "" : "s"} scheduled tonight — standing by`
            : "Standing by · the Barracks is quiet"}
        </p>
        <div className="flex gap-[clamp(24px,3vw,64px)]" style={{ ["--i" as string]: 2 }}>
          {[
            { v: d.operatives, k: "Operatives" },
            { v: d.online, k: "Online now" },
            { v: d.operationsRun, k: "Operations run" },
            { v: `${d.hoursDeployed}h`, k: "Deployed" },
          ].map((s) => (
            <div key={s.k}>
              <Huge size="clamp(30px, 3.4vw, 62px)">{s.v}</Huge>
              <div className="mt-2">
                <Label>{s.k}</Label>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const l = d.live;
  return (
    <div className="flex h-full flex-col justify-center gap-[clamp(14px,1.8vw,34px)]">
      <div className="flex items-center gap-4" style={{ ["--i" as string]: 0 }}>
        <span className="hq-dot hq-dot-live tv-pulse" style={{ backgroundColor: "var(--color-moss)", width: 14, height: 14 }} />
        <span
          className="hq-mono font-bold uppercase"
          style={{ fontSize: "clamp(13px,1.2vw,22px)", letterSpacing: "0.34em", color: "var(--color-moss)" }}
        >
          Operation live
        </span>
      </div>
      <Huge size="clamp(40px, 5.4vw, 104px)">
        {l.emoji} {l.title}
      </Huge>
      <div className="flex flex-wrap items-end gap-[clamp(26px,3.4vw,74px)]" style={{ ["--i" as string]: 1 }}>
        <div>
          <Label tone="var(--color-moss)">Elapsed</Label>
          <div className="mt-2">
            <TvElapsed since={l.startedAt} />
          </div>
        </div>
        <div>
          <Label>Games played</Label>
          <Huge size="clamp(38px, 4.4vw, 88px)" tone="var(--color-sand)">
            {l.games}
          </Huge>
        </div>
        <div className="min-w-0 flex-1">
          <Label>On the roster</Label>
          <p
            className="hq-readout mt-2 font-bold uppercase leading-tight"
            style={{ fontSize: "clamp(18px, 1.9vw, 38px)" }}
          >
            {l.roster.length ? l.roster.join(" · ") : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function SquadsCard({ d }: { d: TvData }) {
  const cols = Math.min(3, Math.max(1, d.squads.length));
  return (
    <div className="grid h-full items-stretch gap-[clamp(10px,1.2vw,22px)]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {d.squads.slice(0, 6).map((s, i) => (
        <div
          key={s.name + i}
          className="flex flex-col justify-between rounded-[4px] border p-[clamp(12px,1.4vw,26px)]"
          style={{
            ["--i" as string]: i,
            borderColor: "var(--color-rule)",
            background: "linear-gradient(180deg, rgba(20,28,25,0.9), rgba(11,16,14,0.9))",
          }}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <span className="hq-dot" style={{ backgroundColor: TONE[s.tone], width: 9, height: 9 }} />
              <Label tone={TONE[s.tone]}>{s.state}</Label>
            </div>
            <p
              className="hq-readout mt-3 font-bold uppercase leading-[0.95]"
              style={{ fontSize: "clamp(24px, 2.6vw, 52px)" }}
            >
              {s.emoji} {s.name}
            </p>
            {s.tag && (
              <p className="hq-mono mt-1.5 uppercase" style={{ fontSize: "clamp(11px,0.85vw,15px)", letterSpacing: "0.24em", color: "var(--color-sand)" }}>
                [{s.tag}]
              </p>
            )}
          </div>
          <div className="mt-5">
            <div className="flex items-baseline gap-2.5">
              <span className="hq-readout font-bold leading-none" style={{ fontSize: "clamp(28px, 3vw, 60px)", color: "var(--color-moss)" }}>
                {s.members}
              </span>
              <Label>Operatives</Label>
            </div>
            <p className="hq-mono mt-2 uppercase" style={{ fontSize: "clamp(11px,0.85vw,15px)", letterSpacing: "0.18em", color: "var(--color-ink-soft)" }}>
              Captain · {s.captain ?? "Vacant"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RadarCard({ d }: { d: TvData }) {
  const r = d.radar!;
  const pct = r.total ? (r.yes / r.total) * 100 : 0;
  return (
    <div className="flex h-full items-center gap-[clamp(20px,3vw,70px)]">
      <div className="min-w-0 flex-1" style={{ ["--i" as string]: 0 }}>
        <Label tone="var(--color-sand)">Incoming contact</Label>
        <Huge size="clamp(34px, 4.6vw, 92px)">{r.title}</Huge>
        <p
          className="hq-mono mt-3 uppercase"
          style={{ fontSize: "clamp(12px,1.05vw,20px)", letterSpacing: "0.2em", color: "var(--color-ink-soft)" }}
        >
          {r.platform ?? "Platform unknown"} · {r.releaseLabel}
        </p>

        <div className="mt-[clamp(14px,1.6vw,30px)] max-w-[640px]">
          <div className="mb-2 flex items-baseline justify-between">
            <Label>Interest</Label>
            <span className="hq-mono" style={{ fontSize: "clamp(12px,1vw,18px)", color: "var(--color-moss)" }}>
              {r.yes}/{r.total} IN
            </span>
          </div>
          <Bar pct={pct} tone={pct >= 50 ? "var(--color-moss)" : "var(--color-sand)"} h={12} />
        </div>

        {r.queue.length > 0 && (
          <div className="mt-[clamp(14px,1.6vw,30px)]" style={{ ["--i" as string]: 1 }}>
            <Label>Also tracked</Label>
            <ul className="mt-2 flex flex-col gap-1">
              {r.queue.map((q) => (
                <li
                  key={q.title}
                  className="hq-mono flex items-baseline justify-between gap-6 border-b border-rule/60 py-1 uppercase"
                  style={{ fontSize: "clamp(12px,1vw,18px)", letterSpacing: "0.1em" }}
                >
                  <span className="truncate">{q.title}</span>
                  <span className="shrink-0 text-ink-soft">{q.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="shrink-0 border-l border-rule pl-[clamp(20px,2.6vw,60px)] text-center" style={{ ["--i" as string]: 2 }}>
        <Label tone="var(--color-flag)">{r.days != null && r.days >= 0 ? "Days to release" : "Status"}</Label>
        <p
          className="hq-readout tv-glow font-bold leading-[0.82]"
          style={{ fontSize: "clamp(80px, 11vw, 220px)", color: r.days != null && r.days <= 14 ? "var(--color-flag)" : "var(--color-sand)" }}
        >
          {r.days == null ? "—" : r.days < 0 ? "OUT" : r.days}
        </p>
        <p className="hq-mono mt-2 uppercase" style={{ fontSize: "clamp(11px,0.85vw,15px)", letterSpacing: "0.26em", color: "var(--color-ink-soft)" }}>
          {r.release ?? "No date set"}
        </p>
      </div>
    </div>
  );
}

function ResultCard({ d }: { d: TvData }) {
  const r = d.result!;
  return (
    <div className="flex h-full items-center gap-[clamp(20px,3vw,70px)]">
      <div className="shrink-0 text-center" style={{ ["--i" as string]: 0 }}>
        <span className="hq-mono block uppercase" style={{ fontSize: "clamp(11px,0.9vw,16px)", letterSpacing: "0.3em", color: "var(--color-ink-soft)" }}>
          {r.dow}
        </span>
        <span className="hq-readout block font-bold leading-[0.8]" style={{ fontSize: "clamp(64px, 8vw, 150px)", color: "var(--color-ink-soft)" }}>
          {r.day}
        </span>
        <span className="hq-mono block uppercase" style={{ fontSize: "clamp(11px,0.9vw,16px)", letterSpacing: "0.3em", color: "var(--color-ink-soft)" }}>
          {r.mon}
        </span>
      </div>

      <div className="min-w-0 flex-1" style={{ ["--i" as string]: 1 }}>
        <Label>{r.emoji} {r.title}</Label>
        <Label tone="var(--color-sand)">Victor</Label>
        <Huge size="clamp(46px, 6.4vw, 132px)" tone="var(--color-sand)" glow>
          {r.winner ?? "Unrecorded"}
        </Huge>

        {r.places.length > 0 && (
          <ul className="mt-[clamp(12px,1.6vw,30px)] flex flex-col gap-1">
            {r.places.slice(0, 6).map((p, i) => (
              <li
                key={p.name + i}
                className="hq-mono flex items-baseline gap-4 border-b border-rule/60 py-1.5 uppercase"
                style={{ fontSize: "clamp(13px,1.15vw,22px)", letterSpacing: "0.1em" }}
              >
                <span className="w-8 shrink-0" style={{ color: p.place === 1 ? "var(--color-sand)" : "var(--color-ink-soft)" }}>
                  {p.place ?? "—"}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-ink-soft">{p.score ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CourtCard({ d }: { d: TvData }) {
  const c = d.court;
  return (
    <div className="flex h-full flex-col justify-center gap-[clamp(12px,1.6vw,30px)]">
      <div style={{ ["--i" as string]: 0 }}>
        <Label tone={c.open > 0 ? "var(--color-flag)" : "var(--color-moss)"}>The Court</Label>
        <Huge size="clamp(40px, 5.6vw, 112px)" tone={c.open > 0 ? "var(--color-flag)" : "var(--color-moss)"} glow>
          {c.headline}
        </Huge>
        <p
          className="hq-mono mt-3 uppercase"
          style={{ fontSize: "clamp(13px,1.1vw,22px)", letterSpacing: "0.22em", color: "var(--color-ink-soft)" }}
        >
          {c.sub}
        </p>
      </div>

      {c.lines.length > 0 && (
        <ul className="flex flex-col gap-2" style={{ ["--i" as string]: 1 }}>
          {c.lines.slice(0, 5).map((l, i) => (
            <li key={i} className="flex items-center gap-3.5 border-b border-rule/60 py-1.5">
              <span className="hq-dot" style={{ backgroundColor: TONE[l.tone], width: 9, height: 9 }} />
              <span
                className="hq-mono min-w-0 flex-1 truncate uppercase"
                style={{ fontSize: "clamp(13px,1.15vw,24px)", letterSpacing: "0.12em" }}
              >
                {l.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadershipCard({ d }: { d: TvData }) {
  const l = d.leadership;
  return (
    <div className="flex h-full items-center gap-[clamp(20px,3vw,70px)]">
      <div className="min-w-0 flex-1" style={{ ["--i" as string]: 0 }}>
        <Label tone="var(--color-sand)">President</Label>
        <Huge size="clamp(46px, 6.2vw, 128px)" tone="var(--color-sand)" glow>
          {l.president ?? "Vacant"}
        </Huge>

        <div className="mt-[clamp(14px,1.8vw,34px)]">
          <Label>Squad captains</Label>
          <ul className="mt-2 flex flex-col gap-1">
            {l.captains.length === 0 ? (
              <li className="hq-mono uppercase" style={{ fontSize: "clamp(13px,1.1vw,22px)", color: "var(--color-ink-soft)" }}>
                No squads formed
              </li>
            ) : (
              l.captains.map((c) => (
                <li
                  key={c.squad}
                  className="hq-mono flex items-baseline justify-between gap-6 border-b border-rule/60 py-1.5 uppercase"
                  style={{ fontSize: "clamp(13px,1.15vw,24px)", letterSpacing: "0.12em" }}
                >
                  <span className="truncate text-ink-soft">{c.squad}</span>
                  <span className="shrink-0" style={{ color: c.name ? "var(--color-ink)" : "var(--color-flag)" }}>
                    {c.name ?? "Vacant"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="min-w-0 flex-1 border-l border-rule pl-[clamp(20px,2.6vw,60px)]" style={{ ["--i" as string]: 1 }}>
        <Label>The table</Label>
        <ul className="mt-3 flex flex-col gap-1.5">
          {l.table.length === 0 ? (
            <li className="hq-mono uppercase" style={{ fontSize: "clamp(13px,1.1vw,22px)", color: "var(--color-ink-soft)" }}>
              No results recorded
            </li>
          ) : (
            l.table.slice(0, 5).map((r, i) => (
              <li
                key={r.name}
                className="hq-mono flex items-baseline gap-4 border-b border-rule/60 py-1.5 uppercase"
                style={{ fontSize: "clamp(14px,1.25vw,26px)", letterSpacing: "0.1em" }}
              >
                <span className="w-8 shrink-0" style={{ color: i === 0 ? "var(--color-sand)" : "#48594f" }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate" style={{ color: r.champion ? "var(--color-sand)" : "var(--color-ink)" }}>
                  {r.name}
                </span>
                <span className="shrink-0" style={{ color: "var(--color-moss)" }}>
                  {r.wins}W
                </span>
                <span className="w-16 shrink-0 text-right text-ink-soft">{r.winPct}%</span>
                <span className="w-10 shrink-0 text-right text-ink-soft">{r.streak}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
