import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeService } from "@/lib/service";
import { gameById, compHeading } from "@/lib/games";
import { shortDate } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, Row, Meter, PageHead, Nil } from "@/components/hq/Kit";
import type { Competition, Photo, Profile, Rsvp, Squad, SquadMember } from "@/lib/types";

export const metadata = { title: "Records · Barracks HQ" };

// ── Records ─────────────────────────────────────────────────────────────────
// The Barracks' own record — totals, squads, participation, streaks. Everything
// here is real, computed from competitions / rsvps / squads.
//
// There is deliberately NO player ranking on this screen. The Barracks records
// service, not skill: who turned out, how often, for how long. That's the whole
// point of a service record.

const DAY = 86_400_000;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Epoch day number from a bare 'YYYY-MM-DD' — timezone-proof. */
function dayNum(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
}

function hoursOf(c: Competition): number {
  if (!c.started_at || !c.finished_at) return 0;
  return Math.max(0, (new Date(c.finished_at).getTime() - new Date(c.started_at).getTime()) / 3_600_000);
}

export default async function RecordsPage() {
  await requireProfile();
  const supabase = await createClient();

  const [
    { data: profileRows },
    { data: compRows },
    { data: rsvpRows },
    { data: squadRows },
    { data: memberRows },
    { data: photoRows },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("competitions").select("*"),
    supabase.from("rsvps").select("*"),
    supabase.from("squads").select("*").order("created_at", { ascending: true }),
    supabase.from("squad_members").select("*"),
    supabase.from("photos").select("id, competition_id"),
  ]);

  const profiles = (profileRows ?? []) as Profile[];
  const comps = (compRows ?? []) as Competition[];
  const rsvps = (rsvpRows ?? []) as Rsvp[];
  const squads = (squadRows ?? []) as Squad[];
  const members = (memberRows ?? []) as SquadMember[];
  const photos = (photoRows ?? []) as Pick<Photo, "id" | "competition_id">[];

  const played = comps
    .filter((c) => c.status === "played")
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const cancelled = comps.filter((c) => c.status === "cancelled");

  // ── Barracks totals ───────────────────────────────────────────────────────
  const service = computeService(rsvps, comps);
  const gamesPlayed = played.reduce((n, c) => n + (c.games_count ?? 0), 0);
  const totalHours = played.reduce((n, c) => n + hoursOf(c), 0);
  const attended = rsvps.filter((r) => r.attended === true).length;
  const noShows = rsvps.filter((r) => r.attended === false).length;
  const rollCalled = attended + noShows;
  const turnoutPct = rollCalled ? Math.round((attended / rollCalled) * 100) : 0;
  const firstOp = played[0]?.date ?? null;

  // ── Per-squad records ─────────────────────────────────────────────────────
  const memberCount = new Map<string, number>();
  const captainOf = new Map<string, string>();
  for (const m of members) {
    memberCount.set(m.squad_id, (memberCount.get(m.squad_id) ?? 0) + 1);
    if (m.is_captain) captainOf.set(m.squad_id, m.user_id);
  }
  const nameById = new Map(profiles.map((p) => [p.id, p.name]));

  const squadRecords = squads
    .map((sq) => {
      const ops = played.filter((c) => c.squad_id === sq.id);
      const upcoming = comps.filter((c) => c.squad_id === sq.id && c.status === "upcoming").length;
      return {
        squad: sq,
        label: sq.name || gameById(sq.game).name,
        game: gameById(sq.game),
        ops: ops.length,
        upcoming,
        games: ops.reduce((n, c) => n + (c.games_count ?? 0), 0),
        hours: ops.reduce((n, c) => n + hoursOf(c), 0),
        members: memberCount.get(sq.id) ?? 0,
        captain: captainOf.get(sq.id) ? nameById.get(captainOf.get(sq.id)!) ?? null : null,
        first: ops[0]?.date ?? null,
        last: ops[ops.length - 1]?.date ?? null,
      };
    })
    .sort((a, b) => b.ops - a.ops);
  const squadTop = Math.max(1, ...squadRecords.map((s) => s.ops));

  // ── Participation per operative (service, never a ranking) ────────────────
  const rsvpsByPlayer = new Map<string, Rsvp[]>();
  for (const r of rsvps) {
    const arr = rsvpsByPlayer.get(r.player_id) ?? [];
    arr.push(r);
    rsvpsByPlayer.set(r.player_id, arr);
  }
  const attendedByPlayer = new Map<string, Set<string>>();
  for (const r of rsvps) {
    if (r.attended !== true) continue;
    const s = attendedByPlayer.get(r.player_id) ?? new Set<string>();
    s.add(r.competition_id);
    attendedByPlayer.set(r.player_id, s);
  }

  /** Longest run of consecutive completed Operations a member turned out for. */
  function streakOf(playerId: string): { best: number; current: number } {
    const set = attendedByPlayer.get(playerId) ?? new Set<string>();
    let best = 0;
    let run = 0;
    for (const c of played) {
      if (set.has(c.id)) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
    return { best, current: run };
  }

  const roster = profiles
    .map((p) => {
      const mine = rsvpsByPlayer.get(p.id) ?? [];
      const svc = computeService(mine, comps);
      const called = mine.filter((r) => r.attended !== null).length;
      return {
        profile: p,
        service: svc,
        called,
        rate: called ? Math.round((svc.operations / called) * 100) : 0,
        streak: streakOf(p.id),
        squads: members.filter((m) => m.user_id === p.id).length,
      };
    })
    .sort((a, b) => b.service.operations - a.service.operations);
  const rosterTop = Math.max(1, ...roster.map((r) => r.service.operations));

  // ── Most-played games ─────────────────────────────────────────────────────
  const byGame = new Map<string, { ops: number; games: number; hours: number; last: string }>();
  for (const c of played) {
    const cur = byGame.get(c.game) ?? { ops: 0, games: 0, hours: 0, last: c.date };
    cur.ops++;
    cur.games += c.games_count ?? 0;
    cur.hours += hoursOf(c);
    if (c.date > cur.last) cur.last = c.date;
    byGame.set(c.game, cur);
  }
  const gameRecords = [...byGame.entries()]
    .map(([id, v]) => ({ game: gameById(id), ...v }))
    .sort((a, b) => b.ops - a.ops);
  const gameTop = Math.max(1, ...gameRecords.map((g) => g.ops));

  // ── Deployment streak — consecutive weeks with an Operation ───────────────
  const weeks = [...new Set(played.map((c) => Math.floor((dayNum(c.date) + 3) / 7)))].sort(
    (a, b) => a - b,
  );
  let bestWeeks = weeks.length ? 1 : 0;
  let runWeeks = weeks.length ? 1 : 0;
  for (let i = 1; i < weeks.length; i++) {
    runWeeks = weeks[i] === weeks[i - 1] + 1 ? runWeeks + 1 : 1;
    bestWeeks = Math.max(bestWeeks, runWeeks);
  }
  const nowWeek = Math.floor((Math.floor(Date.now() / DAY) + 3) / 7);
  const liveWeeks = weeks.length && nowWeek - weeks[weeks.length - 1] <= 1 ? runWeeks : 0;

  // ── Busiest month + notable operations ────────────────────────────────────
  const byMonth = new Map<string, number>();
  for (const c of played) byMonth.set(c.date.slice(0, 7), (byMonth.get(c.date.slice(0, 7)) ?? 0) + 1);
  const busiest = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const turnoutByComp = new Map<string, number>();
  for (const r of rsvps) {
    if (r.attended === true)
      turnoutByComp.set(r.competition_id, (turnoutByComp.get(r.competition_id) ?? 0) + 1);
  }
  const biggest = played
    .map((c) => ({ comp: c, n: turnoutByComp.get(c.id) ?? 0 }))
    .sort((a, b) => b.n - a.n)[0];
  const longest = played
    .map((c) => ({ comp: c, h: hoursOf(c) }))
    .sort((a, b) => b.h - a.h)[0];
  const mostGames = played
    .map((c) => ({ comp: c, g: c.games_count ?? 0 }))
    .sort((a, b) => b.g - a.g)[0];

  return (
    <div>
      <PageHead
        eyebrow="Intelligence"
        title="Records"
        right={
          <>
            <Link href="/hq/archives" className="hq-label rounded-[3px] border border-rule px-3 py-2 transition-colors hover:border-ink-soft hover:text-ink">
              Archives →
            </Link>
          </>
        }
      >
        The Barracks&apos; service record{firstOp ? ` since ${shortDate(firstOp)}` : ""}. Squad and
        team records only — participation, hours and turnout. The Barracks does not rank its
        members against each other.
      </PageHead>

      {/* ── Barracks totals ──────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-6">
        <Panel i={0}>
          <Stat value={played.length} label="Operations run" sub={`${cancelled.length} scrubbed`} />
        </Panel>
        <Panel i={1}>
          <Stat value={Math.round(totalHours)} label="Hours deployed" sub={`${service.hours}h logged by members`} tone="warn" />
        </Panel>
        <Panel i={2}>
          <Stat value={gamesPlayed} label="Games played" />
        </Panel>
        <Panel i={3}>
          <Stat value={profiles.length} label="Operatives" sub={`${squads.length} squads`} />
        </Panel>
        <Panel i={4}>
          <Stat value={`${turnoutPct}%`} label="Turnout" sub={`${noShows} no-shows`} tone={turnoutPct >= 80 ? "live" : "warn"} />
        </Panel>
        <Panel i={5}>
          <Stat value={photos.length} label="Evidence filed" sub="photos in the record" />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* ── Squad records ──────────────────────────────────────────── */}
          <Panel
            i={6}
            label="Squad records"
            status={<Dot tone={squadRecords.length ? "live" : "idle"} />}
            right={<Link href="/hq/squads" className="hq-label hover:text-ink">Squads →</Link>}
          >
            {squadRecords.length === 0 ? (
              <Nil>No squads formed</Nil>
            ) : (
              <div className="flex flex-col">
                {squadRecords.map((s) => (
                  <div key={s.squad.id} className="border-b border-rule/60 py-3 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-6 shrink-0 text-center">{s.game.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ink">
                          {s.label}
                          {s.squad.clan_tag && (
                            <span className="hq-mono ml-2 text-[11px] text-ink-soft">
                              [{s.squad.clan_tag}]
                            </span>
                          )}
                        </p>
                        <p className="hq-mono mt-0.5 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          {s.captain ? `Capt. ${s.captain}` : "No captain"} · {s.members} members
                          {s.first ? ` · since ${shortDate(s.first)}` : ""}
                        </p>
                      </div>
                      <div className="hidden shrink-0 gap-6 md:flex">
                        <div className="text-right">
                          <div className="hq-readout text-[18px] font-bold leading-none">{s.ops}</div>
                          <div className="hq-label mt-1">Ops</div>
                        </div>
                        <div className="text-right">
                          <div className="hq-readout text-[18px] font-bold leading-none">{s.games}</div>
                          <div className="hq-label mt-1">Games</div>
                        </div>
                        <div className="text-right">
                          <div
                            className="hq-readout text-[18px] font-bold leading-none"
                            style={{ color: "var(--color-sand)" }}
                          >
                            {Math.round(s.hours)}
                          </div>
                          <div className="hq-label mt-1">Hours</div>
                        </div>
                      </div>
                      {s.upcoming > 0 && <Tag tone="live">{s.upcoming} on the board</Tag>}
                    </div>
                    <div className="mt-2">
                      <Meter pct={(s.ops / squadTop) * 100} tone="live" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* ── Participation ──────────────────────────────────────────── */}
          <Panel
            i={7}
            label="Participation record"
            right={
              <span className="hq-mono text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                Service · not a ranking
              </span>
            }
          >
            <div className="mb-2 grid grid-cols-[1.6fr_repeat(5,minmax(0,0.6fr))] gap-3 border-b border-rule pb-2">
              <span className="hq-label">Operative</span>
              <span className="hq-label text-right">Ops</span>
              <span className="hq-label text-right">Games</span>
              <span className="hq-label text-right">Hours</span>
              <span className="hq-label text-right">Streak</span>
              <span className="hq-label text-right">Turnout</span>
            </div>
            {roster.length === 0 ? (
              <Nil>No operatives on strength</Nil>
            ) : (
              <ul className="flex flex-col">
                {roster.map((r, i) => (
                  <li
                    key={r.profile.id}
                    className="hq-rise grid grid-cols-[1.6fr_repeat(5,minmax(0,0.6fr))] items-center gap-3 border-b border-rule/50 py-2 last:border-0"
                    style={{ ["--i" as string]: i }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: r.profile.colour || "var(--color-rule)" }}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px]">{r.profile.name}</span>
                        <span className="hq-mono block text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                          {r.profile.is_president
                            ? "President"
                            : r.squads > 0
                              ? `${r.squads} squad${r.squads > 1 ? "s" : ""}`
                              : "Unassigned"}
                          {r.service.noShows > 0 ? ` · ${r.service.noShows} no-show` : ""}
                        </span>
                      </span>
                    </div>
                    <span className="hq-mono text-right text-[13px]">{r.service.operations}</span>
                    <span className="hq-mono text-right text-[13px] text-ink-soft">{r.service.games}</span>
                    <span className="hq-mono text-right text-[13px]" style={{ color: "var(--color-sand)" }}>
                      {r.service.hours}
                    </span>
                    <span className="hq-mono text-right text-[13px] text-ink-soft">
                      {r.streak.best > 0 ? `×${r.streak.best}` : "—"}
                    </span>
                    <span className="text-right">
                      <span
                        className="hq-mono text-[13px]"
                        style={{
                          color:
                            r.rate >= 80
                              ? "var(--color-moss)"
                              : r.rate >= 50
                                ? "var(--color-sand)"
                                : "var(--color-ink-soft)",
                        }}
                      >
                        {r.called ? `${r.rate}%` : "—"}
                      </span>
                    </span>
                    <div className="col-span-6">
                      <Meter
                        pct={(r.service.operations / rosterTop) * 100}
                        tone={r.service.operations === rosterTop ? "warn" : "live"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="hq-mono mt-3 text-[10px] uppercase leading-relaxed tracking-[0.1em] text-ink-soft">
              Turnout = Operations attended ÷ Operations roll-called. The Barracks keeps no skill
              ladder — showing up is the record.
            </p>
          </Panel>
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Panel i={8} label="Most-played games" sweep>
            {gameRecords.length === 0 ? (
              <Nil>No completed operations</Nil>
            ) : (
              <div className="flex flex-col gap-3">
                {gameRecords.map((g) => (
                  <div key={g.game.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13px]">
                        {g.game.emoji} {g.game.name}
                      </span>
                      <span className="hq-mono shrink-0 text-[12px]">
                        {g.ops}
                        <span className="text-ink-soft"> ops · {g.games} games</span>
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Meter pct={(g.ops / gameTop) * 100} tone={g.ops === gameTop ? "warn" : "live"} />
                    </div>
                    <p className="hq-mono mt-1 text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                      {Math.round(g.hours)}h deployed · last {shortDate(g.last)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel i={9} label="Streaks">
            <div className="grid grid-cols-2 gap-4">
              <Stat
                value={bestWeeks}
                label="Longest run"
                sub="consecutive weeks with an operation"
                tone="warn"
              />
              <Stat
                value={liveWeeks}
                label="Current run"
                sub={liveWeeks > 0 ? "still deploying" : "run broken"}
                tone={liveWeeks > 0 ? "live" : "idle"}
              />
            </div>
            <div className="mt-4 border-t border-rule pt-3">
              <p className="hq-label mb-2">Longest attendance streaks</p>
              {roster.filter((r) => r.streak.best > 0).length === 0 ? (
                <Nil>No roll calls recorded</Nil>
              ) : (
                [...roster]
                  .sort((a, b) => b.streak.best - a.streak.best)
                  .slice(0, 5)
                  .map((r) => (
                    <Row
                      key={r.profile.id}
                      k={r.profile.name}
                      v={`${r.streak.best} in a row${r.streak.current === r.streak.best && r.streak.current > 0 ? " · live" : ""}`}
                      tone={r.streak.current === r.streak.best && r.streak.current > 0 ? "live" : undefined}
                    />
                  ))
              )}
            </div>
          </Panel>

          <Panel i={10} label="Notable">
            {played.length === 0 ? (
              <Nil>Nothing on the record yet</Nil>
            ) : (
              <>
                {busiest && (
                  <Row
                    k="Busiest month"
                    v={`${MONTHS[Number(busiest[0].slice(5, 7)) - 1]} ${busiest[0].slice(0, 4)} · ${busiest[1]} ops`}
                    tone="warn"
                  />
                )}
                {biggest && biggest.n > 0 && (
                  <Row
                    k="Biggest turnout"
                    v={`${compHeading(biggest.comp)} · ${biggest.n} present`}
                  />
                )}
                {longest && longest.h > 0 && (
                  <Row
                    k="Longest operation"
                    v={`${compHeading(longest.comp)} · ${longest.h.toFixed(1)}h`}
                  />
                )}
                {mostGames && mostGames.g > 0 && (
                  <Row
                    k="Most games in a night"
                    v={`${compHeading(mostGames.comp)} · ${mostGames.g}`}
                  />
                )}
                <Row k="First operation" v={firstOp ? shortDate(firstOp) : "—"} />
                <Row
                  k="Latest operation"
                  v={played.length ? shortDate(played[played.length - 1].date) : "—"}
                />
                <Row k="Operations scrubbed" v={cancelled.length} tone={cancelled.length ? "alert" : "idle"} />
              </>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
