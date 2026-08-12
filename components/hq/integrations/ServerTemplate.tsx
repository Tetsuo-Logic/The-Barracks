"use client";

import { useMemo, useState } from "react";
import { Tag, Proto } from "@/components/hq/Kit";
import type { DiscordCategory } from "@/lib/hq/future/systems";

// USE BARRACKS TEMPLATE — the generated server structure, seeded from the
// Barracks' real squads. Pick what to create, then hand it to the bot. The
// picker is real; the creation is a dry run until the Discord adapter lands.

const KEY = (c: number, ch: number) => `${c}:${ch}`;

export function ServerTemplate({
  categories,
  guild,
  squadCount,
}: {
  categories: DiscordCategory[];
  guild: string;
  squadCount: number;
}) {
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      categories.flatMap((cat, c) => cat.channels.map((ch, i) => [KEY(c, i), ch.create])),
    ),
  );
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [run, setRun] = useState<null | { at: string; text: string }[]>(null);

  const stats = useMemo(() => {
    let text = 0;
    let voice = 0;
    const cats = new Set<number>();
    categories.forEach((cat, c) =>
      cat.channels.forEach((ch, i) => {
        if (!picked[KEY(c, i)]) return;
        cats.add(c);
        if (ch.kind === "voice") voice++;
        else text++;
      }),
    );
    return { text, voice, cats: cats.size, total: text + voice };
  }, [picked, categories]);

  const toggleCategory = (c: number) => {
    const all = categories[c].channels.every((_, i) => picked[KEY(c, i)]);
    setPicked((p) => {
      const next = { ...p };
      categories[c].channels.forEach((_, i) => (next[KEY(c, i)] = !all));
      return next;
    });
  };

  const create = () => {
    const stamp = () =>
      new Date().toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const log: { at: string; text: string }[] = [
      { at: stamp(), text: `DRY RUN — TARGET GUILD ${guild.toUpperCase()}` },
      { at: stamp(), text: `${stats.cats} CATEGORIES QUEUED` },
      { at: stamp(), text: `${stats.text} TEXT CHANNELS QUEUED` },
      { at: stamp(), text: `${stats.voice} VOICE CHANNELS QUEUED` },
      { at: stamp(), text: "PERMISSION OVERWRITES MAPPED FROM BARRACKS ROLES" },
      { at: stamp(), text: "NOTHING WAS CREATED — DISCORD ADAPTER NOT CONNECTED" },
    ];
    setRun(log);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
      {/* ── Channel tree ─────────────────────────────────────────────────── */}
      <div className="rounded-[3px] border border-rule bg-[rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-rule px-3 py-2">
          <span className="hq-readout text-[13px] font-bold uppercase tracking-[0.06em]">
            {guild}
          </span>
          <span className="hq-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            Preview
          </span>
        </div>

        <div className="max-h-[520px] overflow-y-auto px-2 py-2">
          {categories.map((cat, c) => {
            const all = cat.channels.every((_, i) => picked[KEY(c, i)]);
            const some = cat.channels.some((_, i) => picked[KEY(c, i)]);
            const isCollapsed = collapsed[c];
            return (
              <div key={cat.name} className="mb-2 last:mb-0">
                <div className="flex items-center gap-2 px-1 py-1">
                  <button
                    type="button"
                    onClick={() => setCollapsed((s) => ({ ...s, [c]: !s[c] }))}
                    className="hq-mono w-3 shrink-0 text-[9px] text-ink-soft"
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                  >
                    {isCollapsed ? "▸" : "▾"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className="hq-label min-w-0 flex-1 truncate text-left transition-colors hover:text-ink"
                    style={{ color: some ? "var(--color-sand)" : undefined }}
                  >
                    {cat.name}
                  </button>
                  <span className="hq-mono shrink-0 text-[9px] uppercase tracking-[0.12em] text-ink-soft">
                    {all ? "all" : some ? "some" : "none"}
                  </span>
                </div>

                {!isCollapsed &&
                  cat.channels.map((ch, i) => {
                    const on = Boolean(picked[KEY(c, i)]);
                    return (
                      <label
                        key={ch.name}
                        className="flex cursor-pointer items-center gap-2 rounded-[2px] py-[3px] pl-6 pr-2 transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setPicked((p) => ({ ...p, [KEY(c, i)]: !p[KEY(c, i)] }))}
                          className="sr-only"
                        />
                        <span
                          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border text-[9px] leading-none"
                          style={{
                            borderColor: on ? "var(--color-moss)" : "var(--color-rule)",
                            backgroundColor: on ? "var(--color-moss)" : "transparent",
                            color: "#0b100e",
                          }}
                        >
                          {on ? "✓" : ""}
                        </span>
                        <span
                          className="hq-mono w-3.5 shrink-0 text-center text-[12px]"
                          style={{ color: "var(--color-ink-soft)" }}
                        >
                          {ch.kind === "voice" ? "🔊" : "#"}
                        </span>
                        <span
                          className="min-w-0 flex-1 truncate text-[13px]"
                          style={{ color: on ? "var(--color-ink)" : "var(--color-ink-soft)" }}
                        >
                          {ch.name}
                        </span>
                        {ch.kind === "voice" && (
                          <span className="hq-mono shrink-0 text-[9px] uppercase tracking-[0.12em] text-ink-soft">
                            voice
                          </span>
                        )}
                      </label>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Manifest ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: stats.cats, l: "Categories" },
            { v: stats.text, l: "Text channels" },
            { v: stats.voice, l: "Voice channels" },
          ].map((s) => (
            <div key={s.l} className="rounded-[3px] border border-rule px-3 py-2.5">
              <div className="hq-readout text-[24px] font-bold leading-none" style={{ color: "var(--color-sand)" }}>
                {s.v}
              </div>
              <div className="hq-label mt-1.5">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="rounded-[3px] border border-rule px-3 py-3">
          <p className="hq-label mb-2">What the template does</p>
          <ul className="flex flex-col gap-1.5 text-[12.5px] leading-relaxed text-ink-soft">
            <li>
              Builds a <span className="text-ink">COMMAND</span> category for announcements, radar,
              calendar and the weekly Dispatch.
            </li>
            <li>
              Generates one category per squad — {squadCount === 0 ? "none formed yet" : `${squadCount} found`}{" "}
              — with the channels that game actually needs.
            </li>
            <li>
              Adds <span className="text-ink">COURT</span> for summons and verdicts, kept separate
              from squad chatter.
            </li>
            <li>Maps Barracks roles onto Discord roles so permissions match rank on creation.</li>
          </ul>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={create}
            disabled={stats.total === 0}
            className="hq-label flex-1 rounded-[3px] px-3 py-2.5 font-semibold disabled:opacity-40"
            style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
          >
            Create structure · {stats.total} channels
          </button>
          <button
            type="button"
            onClick={() => setPicked({})}
            className="hq-label rounded-[3px] border border-rule px-3 py-2.5 transition-colors hover:border-ink-soft hover:text-ink"
          >
            Clear
          </button>
          <Proto />
        </div>

        <div className="min-h-[132px] rounded-[3px] border border-rule bg-[rgba(0,0,0,0.28)] p-3">
          {run ? (
            <ul className="flex flex-col gap-1">
              {run.map((l, i) => (
                <li
                  key={i}
                  className="hq-rise hq-mono flex gap-2 text-[11px] tracking-[0.06em]"
                  style={{ ["--i" as string]: i }}
                >
                  <span className="shrink-0 text-ink-soft">{l.at}</span>
                  <span
                    style={{
                      color: l.text.startsWith("NOTHING")
                        ? "var(--color-flag)"
                        : "var(--color-moss)",
                    }}
                  >
                    {l.text}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full flex-col items-start gap-2">
              <Tag tone="idle">Awaiting order</Tag>
              <p className="hq-mono text-[11px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
                Creation is a dry run until Discord OAuth and a bot with guild-management scopes are
                connected. Nothing will be written to your server.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
