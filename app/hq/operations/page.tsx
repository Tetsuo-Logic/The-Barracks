import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSquads } from "@/lib/data";
import { gameById, compHeading } from "@/lib/games";
import { todayISO, shortTime, heroDate } from "@/lib/dates";
import { Panel, Dot, Tag, PageHead, Nil } from "@/components/hq/Kit";
import { StatusStrip } from "@/components/hq/StatusStrip";
import { GameInsignia } from "@/components/hq/GameInsignia";
import { FilterSelect } from "@/components/hq/FilterSelect";
import { resolveViewRole, realRoleOf } from "@/lib/hq/role";
import { hqSampleUpcoming, hqSampleHistory, type SampleOp } from "@/lib/hq/future/actions";
import type { Competition, Rsvp } from "@/lib/types";

export const metadata = { title: "Operations · Barracks HQ" };

// The operations register. The records ARE the page — live first, then what's
// coming, then everything the Barracks has actually done. History is the part
// that gets more valuable the longer the group exists, so it's built as a table
// from the start rather than a list that will need replacing.

// The calendar owns the full future — this page shows just enough of it to know
// what's next. History is the part that grows, so it gets the room.
const UPCOMING_SHOWN = 3;
const HISTORY_SHOWN = 25;
/** Six-column tables stop being readable much past this. */
const PAGE_WIDTH = 1180;

function durationText(startIso: string, endIso: string) {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

type Row = {
  comp: Competition;
  squadName: string | null;
  squadId: string | null;
  roster: number;
  present: number;
  minutes: number;
};

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ squad?: string; all?: string; as?: string; q?: string; game?: string }>;
}) {
  const [profile, sp] = await Promise.all([requireProfile(), searchParams]);
  const supabase = await createClient();

  const [{ data: compRows }, { data: rsvpRows }, squads] = await Promise.all([
    supabase.from("competitions").select("*").order("date", { ascending: false }),
    supabase.from("rsvps").select("*"),
    getSquads(profile.id),
  ]);

  const comps = (compRows ?? []) as Competition[];
  const rsvps = (rsvpRows ?? []) as Rsvp[];
  const squadById = new Map(squads.map((s) => [s.squad.id, s]));

  const rosterBy = new Map<string, { roster: number; present: number }>();
  for (const r of rsvps) {
    const cur = rosterBy.get(r.competition_id) ?? { roster: 0, present: 0 };
    if (r.status === "in") cur.roster++;
    if (r.attended === true) cur.present++;
    rosterBy.set(r.competition_id, cur);
  }

  const rows: Row[] = comps.map((c) => {
    const sq = c.squad_id ? squadById.get(c.squad_id) : null;
    const counts = rosterBy.get(c.id) ?? { roster: 0, present: 0 };
    const minutes =
      c.started_at && c.finished_at
        ? Math.max(0, Math.round((new Date(c.finished_at).getTime() - new Date(c.started_at).getTime()) / 60000))
        : 0;
    return {
      comp: c,
      squadName: sq ? sq.squad.name || gameById(sq.squad.game).name : null,
      squadId: c.squad_id ?? null,
      roster: counts.roster,
      present: counts.present,
      minutes,
    };
  });

  const live = rows.filter(
    (r) => r.comp.started_at != null && r.comp.finished_at == null && r.comp.status !== "cancelled",
  );
  const upcoming = rows
    .filter((r) => r.comp.status === "upcoming" && r.comp.started_at == null)
    .sort((a, b) => (a.comp.date < b.comp.date ? -1 : 1));
  const historyAll = rows.filter(
    (r) => r.comp.finished_at != null || r.comp.status === "played" || r.comp.status === "cancelled",
  );

  // Filters run over history only — that's the set that grows without bound.
  const squadFilter = sp.squad ?? "all";
  const gameFilter = sp.game ?? "all";
  const query = (sp.q ?? "").trim().toLowerCase();

  const gamesInHistory = Array.from(new Set(historyAll.map((r) => r.comp.game)));

  const history = historyAll.filter((r) => {
    if (squadFilter === "barracks" && r.squadId) return false;
    if (squadFilter !== "all" && squadFilter !== "barracks" && r.squadId !== squadFilter) return false;
    if (gameFilter !== "all" && r.comp.game !== gameFilter) return false;
    if (query) {
      const hay = `${compHeading(r.comp)} ${gameById(r.comp.game).name} ${r.squadName ?? ""} ${r.comp.date}`;
      if (!hay.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  const filtered = squadFilter !== "all" || gameFilter !== "all" || query.length > 0;

  const showAllHistory = sp.all === "1";
  const historyShown = showAllHistory ? history : history.slice(0, HISTORY_SHOWN);

  const today = todayISO();
  const totalGames = historyAll.reduce((n, r) => n + (r.comp.games_count ?? 0), 0);
  const totalHours = Math.round(historyAll.reduce((n, r) => n + r.minutes, 0) / 60);

  // Dev role preview — only the President deploys operations. Render filter
  // only; saveCompetition still checks the real role server-side.
  const view = resolveViewRole(sp.as, await realRoleOf(profile));
  const isAdmin = view === "president";

  // Dev-only filler so the tables can be judged at length. Empty in production.
  // Upcoming tops up to the cap rather than adding to it, so the demo rows
  // can't quietly break the "only the next three" rule.
  const upcomingShown = upcoming.slice(0, UPCOMING_SHOWN);
  const sampleUpcoming = hqSampleUpcoming().slice(
    0,
    Math.max(0, UPCOMING_SHOWN - upcomingShown.length),
  );
  const sampleHistory = hqSampleHistory();

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: PAGE_WIDTH }}>
      <PageHead
        eyebrow="Command"
        title="Operations"
        right={
          isAdmin && (
            <Link
              href="/hq/operations/new"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              + Deploy operation
            </Link>
          )
        }
      >
        Every night this Barracks has put on the board.
      </PageHead>

      {/* Status strip — the numbers, without five cards demanding attention. */}
      <StatusStrip
        separator="·"
        speed={32}
        items={[
          { text: `${live.length} live`, dot: live.length ? "live" : "idle", pulse: live.length > 0 },
          { text: `${upcoming.length} upcoming` },
          { text: `${historyAll.length} completed` },
          { text: `${totalGames} games` },
          ...(totalHours > 0 ? [{ text: `${totalHours}h deployed` }] : []),
        ]}
      />

      <div className="flex flex-col gap-5">
        {/* ── LIVE NOW ──────────────────────────────────────────────────── */}
        {live.length > 0 && (
          <Panel
            i={0}
            tier="live"
            scan="sweep"
            sweep
            label="Live now"
            status={<Dot tone="live" pulse />}
            right={<span className="hq-mono text-xs" style={{ color: "var(--color-moss)" }}>{live.length}</span>}
          >
            <div className="flex flex-col gap-3">
              {live.map((r) => {
                const c = r.comp;
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-[3px] border px-5 py-4"
                    style={{
                      borderColor: "color-mix(in srgb, var(--color-moss) 30%, var(--color-rule))",
                      background: "rgba(61,220,132,0.03)",
                    }}
                  >
                    <GameInsignia game={c.game} size={48} tone="var(--color-moss)" />
                    <div className="min-w-0 flex-1">
                      <p className="hq-readout text-[26px] font-bold leading-tight">
                        {compHeading(c)}
                        {r.squadName && (
                          <span className="text-ink-soft"> — {r.squadName}</span>
                        )}
                      </p>
                      <p className="hq-mono mt-1.5 text-[13px] uppercase tracking-[0.1em] text-ink-soft">
                        Started {shortTime(c.started_at ? c.started_at.slice(11, 19) : null) || "—"}
                        {" · "}
                        <span style={{ color: "var(--color-moss)" }}>
                          {r.present}/{r.roster || r.present} present
                        </span>
                        {" · "}
                        {c.games_count} game{c.games_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Link
                      href={`/hq/operations/${c.id}`}
                      className="hq-label shrink-0 rounded-[3px] px-4 py-2.5 font-semibold"
                      style={{ backgroundColor: "var(--color-moss)", color: "#0b100e" }}
                    >
                      Open operation room →
                    </Link>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* ── UPCOMING ──────────────────────────────────────────────────── */}
        <Panel
          i={1}
          pad={false}
          label="Upcoming"
          status={<Dot tone="warn" />}
          right={
            upcoming.length > UPCOMING_SHOWN ? (
              <Link href="/hq/calendar" className="hq-label hover:text-ink">
                View all {upcoming.length} →
              </Link>
            ) : (
              <span className="hq-mono text-xs text-ink-soft">{upcoming.length}</span>
            )
          }
        >
          {upcoming.length === 0 && sampleUpcoming.length === 0 ? (
            <Nil>Nothing on the board</Nil>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-rule">
                  <Th className="w-[130px]">Date</Th>
                  <Th className="w-[64px]">Time</Th>
                  <Th>Operation</Th>
                  <Th className="w-[180px]">Squad</Th>
                  <Th className="w-[110px] text-right">Roster</Th>
                  <Th className="w-[130px]">Status</Th>
                </tr>
              </thead>
              <tbody>
                {upcomingShown.map((r, n) => {
                  const c = r.comp;
                  const hd = heroDate(c.date);
                  return (
                    <tr
                      key={c.id}
                      className="hq-rise border-b border-rule/50 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.03)]"
                      style={{ ["--i" as string]: Math.min(n, 10) }}
                    >
                      <Td>
                        <Link href={`/hq/operations/${c.id}`} className="hq-mono block text-[12px]">
                          <span style={{ color: c.date === today ? "var(--color-sand)" : undefined }}>
                            {hd.dow} {hd.day} {hd.mon}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/hq/operations/${c.id}`} className="hq-mono block text-[12px] text-ink-soft">
                          {shortTime(c.tee_time) || "—"}
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/hq/operations/${c.id}`} className="flex min-w-0 items-center gap-2.5">
                          <GameInsignia game={c.game} size={22} tone="var(--color-ink-soft)" />
                          <span className="truncate text-[13px]">{compHeading(c)}</span>
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/hq/operations/${c.id}`} className="block">
                          {r.squadName ? (
                            <Tag tone="warn">{r.squadName}</Tag>
                          ) : (
                            <span className="hq-mono text-[11px] text-ink-soft">Whole Barracks</span>
                          )}
                        </Link>
                      </Td>
                      <Td className="text-right">
                        <Link href={`/hq/operations/${c.id}`} className="hq-mono block text-[12px]">
                          <span style={{ color: r.roster ? "var(--color-moss)" : "var(--color-ink-soft)" }}>
                            {r.roster}
                          </span>
                          <span className="text-ink-soft"> in</span>
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/hq/operations/${c.id}`} className="block">
                          <Tag tone={c.date === today ? "warn" : "idle"}>
                            {c.date === today ? "Tonight" : "Standing by"}
                          </Tag>
                        </Link>
                      </Td>
                    </tr>
                  );
                })}
                {sampleUpcoming.map((s) => (
                  <SampleRow key={`u-${s.date}-${s.title}`} op={s} kind="upcoming" />
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* ── HISTORY ───────────────────────────────────────────────────── */}
        <Panel
          i={2}
          pad={false}
          tier="quiet"
          label="Operation history"
          status={<Dot tone="alert" />}
          right={
            <span className="hq-mono text-xs text-ink-soft">
              {historyAll.length} operations · {totalGames} games
              {totalHours > 0 ? ` · ${totalHours}h` : ""}
            </span>
          }
        >
          {/* Filters. Plain GET form + links, so every view is server-rendered
              and linkable — no client state, and a filtered archive can be
              bookmarked or shared. */}
          <div className="flex flex-col gap-2.5 border-b border-rule px-3 py-3">
            <form method="GET" action="/hq/operations" className="flex items-center gap-2">
              {squadFilter !== "all" && <input type="hidden" name="squad" value={squadFilter} />}
              {gameFilter !== "all" && <input type="hidden" name="game" value={gameFilter} />}
              <input
                type="search"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Search operations, squads, dates…"
                className="hq-mono min-w-0 flex-1 rounded-[3px] border border-rule bg-card px-3 py-1.5 text-[12px] text-ink outline-none focus:border-ink-soft"
              />
              <button
                type="submit"
                className="hq-label shrink-0 rounded-[3px] border border-rule px-3 py-1.5 transition-colors hover:border-ink-soft hover:text-ink"
              >
                Search
              </button>
              {filtered && (
                <Link
                  href="/hq/operations"
                  className="hq-label shrink-0 rounded-[3px] px-2.5 py-1.5 transition-colors hover:text-ink"
                  style={{ color: "var(--color-flag)" }}
                >
                  Clear
                </Link>
              )}
            </form>

            {/* 'All' stays a tab because it's the default you return to; the
                open-ended lists are dropdowns so twenty squads don't wrap into
                a wall of chips. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip
                href={qs({ q: sp.q, game: gameFilter })}
                label="All"
                active={squadFilter === "all"}
              />
              <FilterSelect
                param="squad"
                value={squadFilter}
                allLabel="Choose squad"
                options={[
                  { value: "barracks", label: "Whole Barracks" },
                  ...squads.map((s) => ({
                    value: s.squad.id,
                    label: s.squad.name || gameById(s.squad.game).name,
                  })),
                ]}
              />

              {gamesInHistory.length > 1 && (
                <>
                  <span className="hq-label ml-3 mr-1 opacity-50">Game</span>
                  <FilterChip
                    href={qs({ q: sp.q, squad: squadFilter })}
                    label="All"
                    active={gameFilter === "all"}
                  />
                  <FilterSelect
                    param="game"
                    value={gameFilter}
                    allLabel="Choose game"
                    options={gamesInHistory.map((g) => ({ value: g, label: gameById(g).name }))}
                  />
                </>
              )}
            </div>
          </div>

          {historyShown.length === 0 && (filtered || sampleHistory.length === 0) ? (
            <Nil>{filtered ? "Nothing matches that" : "No operations closed yet"}</Nil>
          ) : (
            <>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-rule">
                    <Th className="w-[130px]">Date</Th>
                    <Th>Operation</Th>
                    <Th className="w-[180px]">Squad</Th>
                    <Th className="w-[120px] text-right">Attendance</Th>
                    <Th className="w-[110px] text-right">Duration</Th>
                    <Th className="w-[90px] text-right">Games</Th>
                  </tr>
                </thead>
                <tbody>
                  {historyShown.map((r, n) => {
                    const c = r.comp;
                    const hd = heroDate(c.date);
                    const scrubbed = c.status === "cancelled";
                    return (
                      <tr
                        key={c.id}
                        className="hq-rise border-b border-rule/40 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.03)]"
                        style={{ ["--i" as string]: Math.min(n, 12) }}
                      >
                        <Td>
                          <Link href={`/hq/operations/${c.id}`} className="hq-mono block text-[12px] text-ink-soft">
                            {hd.dow} {hd.day} {hd.mon}
                          </Link>
                        </Td>
                        <Td>
                          <Link href={`/hq/operations/${c.id}`} className="flex min-w-0 items-center gap-2.5">
                            <GameInsignia game={c.game} size={20} tone="var(--color-ink-soft)" />
                            <span className="truncate text-[13px]">{compHeading(c)}</span>
                            {scrubbed && <Tag tone="alert">Scrubbed</Tag>}
                          </Link>
                        </Td>
                        <Td>
                          <Link href={`/hq/operations/${c.id}`} className="block">
                            {r.squadName ? (
                              <span className="hq-mono text-[11px] text-ink-soft">{r.squadName}</span>
                            ) : (
                              <span className="hq-mono text-[11px] text-ink-soft opacity-60">Whole Barracks</span>
                            )}
                          </Link>
                        </Td>
                        <Td className="text-right">
                          <Link href={`/hq/operations/${c.id}`} className="hq-mono block text-[12px]">
                            <span style={{ color: r.present ? "var(--color-moss)" : "var(--color-ink-soft)" }}>
                              {r.present}
                            </span>
                            <span className="text-ink-soft"> / {r.roster || r.present}</span>
                          </Link>
                        </Td>
                        <Td className="text-right">
                          <Link href={`/hq/operations/${c.id}`} className="hq-mono block text-[12px] text-ink-soft">
                            {c.started_at && c.finished_at ? durationText(c.started_at, c.finished_at) : "—"}
                          </Link>
                        </Td>
                        <Td className="text-right">
                          <Link href={`/hq/operations/${c.id}`} className="hq-mono block text-[12px] text-ink-soft">
                            {c.games_count || "—"}
                          </Link>
                        </Td>
                      </tr>
                    );
                  })}
                  {/* Samples sit out whenever a filter is applied — a demo row
                      surviving a search would misrepresent the result. */}
                  {!filtered &&
                    sampleHistory.map((s) => (
                      <SampleRow key={`h-${s.date}-${s.title}`} op={s} kind="history" />
                    ))}
                </tbody>
              </table>

              {!showAllHistory && history.length > HISTORY_SHOWN && (
                <div className="border-t border-rule px-3 py-2.5 text-center">
                  <Link
                    href={qs({ q: sp.q, squad: squadFilter, game: gameFilter, all: "1" })}
                    className="hq-label hover:text-ink"
                  >
                    View all {history.length} operations →
                  </Link>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** A dev-only filler row. Deliberately not a link — the operation doesn't
 *  exist, and a row that leads to a broken page is worse than one that
 *  plainly leads nowhere. Marked so it can't pass as real history. */
function SampleRow({ op, kind }: { op: SampleOp; kind: "upcoming" | "history" }) {
  return (
    // Not dimmed. These rows have to read exactly like real ones or they can't
    // be used to judge the design — the DEMO tag carries the boundary instead.
    <tr className="border-b border-rule/40 last:border-0">
      <Td>
        <span className="hq-mono text-[12px] text-ink-soft">{op.date}</span>
      </Td>
      {kind === "upcoming" && (
        <Td>
          <span className="hq-mono text-[12px] text-ink-soft">{op.time}</span>
        </Td>
      )}
      <Td>
        <span className="flex min-w-0 items-center gap-2.5">
          <GameInsignia game={op.game} size={kind === "upcoming" ? 22 : 20} tone="var(--color-ink-soft)" />
          <span className="truncate text-[13px]">{op.title}</span>
          {op.scrubbed && <Tag tone="alert">Scrubbed</Tag>}
          {kind === "history" && (
            <span
              className="hq-mono shrink-0 rounded-[3px] border border-dashed px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]"
              style={{ borderColor: "#4b5a52", color: "#6d8076" }}
            >
              demo
            </span>
          )}
        </span>
      </Td>
      <Td>
        <span className="hq-mono text-[11px] text-ink-soft">{op.squad ?? "Whole Barracks"}</span>
      </Td>
      <Td className="text-right">
        <span className="hq-mono text-[12px] text-ink-soft">
          {kind === "upcoming" ? `${op.roster} in` : `${op.present} / ${op.roster}`}
        </span>
      </Td>
      {kind === "upcoming" ? (
        <Td>
          <span
            className="hq-mono rounded-[3px] border border-dashed px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em]"
            style={{ borderColor: "#4b5a52", color: "#6d8076" }}
          >
            demo
          </span>
        </Td>
      ) : (
        <>
          <Td className="text-right">
            <span className="hq-mono text-[12px] text-ink-soft">{op.duration}</span>
          </Td>
          <Td className="text-right">
            <span className="hq-mono text-[12px] text-ink-soft">{op.games || "—"}</span>
          </Td>
        </>
      )}
    </tr>
  );
}

/** Build an /hq/operations URL, dropping empty or "all" values. */
function qs(parts: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(parts)) {
    if (v && v !== "all") p.set(k, v);
  }
  const s = p.toString();
  return s ? `/hq/operations?${s}` : "/hq/operations";
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="hq-mono rounded-[3px] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors"
      style={{
        borderColor: active ? "var(--color-sand)" : "var(--color-rule)",
        backgroundColor: active ? "color-mix(in srgb, var(--color-sand) 14%, transparent)" : "transparent",
        color: active ? "var(--color-sand)" : "var(--color-ink-soft)",
      }}
    >
      {label}
    </Link>
  );
}

// Row rhythm matched to the Action Required panel — that list reads well
// because rows have room, not just because the surface is lifted.
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`hq-label px-4 py-2.5 text-left font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-middle ${className}`}>{children}</td>;
}
