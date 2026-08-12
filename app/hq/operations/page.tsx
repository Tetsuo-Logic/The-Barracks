import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSquads } from "@/lib/data";
import { gameById, compHeading } from "@/lib/games";
import { todayISO, shortTime, heroDate } from "@/lib/dates";
import { Panel, Stat, Dot, Tag, PageHead, Nil } from "@/components/hq/Kit";
import type { Competition, Rsvp } from "@/lib/types";

export const metadata = { title: "Operations · Barracks HQ" };

function durationText(startIso: string, endIso: string) {
  const mins = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

type Row = {
  comp: Competition;
  squadName: string | null;
  roster: number;
  present: number;
};

// The operations register: everything the Barracks has ever put on the board,
// split by where it is in its life — standing by, live, or archived.
export default async function OperationsPage() {
  const profile = await requireProfile();
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
    return {
      comp: c,
      squadName: sq ? sq.squad.name || gameById(sq.squad.game).name : null,
      roster: counts.roster,
      present: counts.present,
    };
  });

  const live = rows.filter((r) => r.comp.started_at != null && r.comp.finished_at == null && r.comp.status !== "cancelled");
  const upcoming = rows
    .filter((r) => r.comp.status === "upcoming" && r.comp.started_at == null)
    .sort((a, b) => (a.comp.date < b.comp.date ? -1 : 1));
  const archived = rows.filter(
    (r) => r.comp.finished_at != null || r.comp.status === "played" || r.comp.status === "cancelled",
  );

  const today = todayISO();
  const tonight = upcoming.filter((r) => r.comp.date === today).length;
  const totalGames = archived.reduce((n, r) => n + (r.comp.games_count ?? 0), 0);

  return (
    <div>
      <PageHead
        eyebrow="Command"
        title="Operations"
        right={
          <Link
            href="/hq/operations/new"
            className="hq-label rounded-[3px] px-3 py-2 font-semibold"
            style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
          >
            + Deploy operation
          </Link>
        }
      >
        Every night the Barracks has put on the board — rooms open, live and archived.
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Panel i={0}>
          <Stat value={live.length} label="Rooms live" tone={live.length ? "live" : undefined} />
        </Panel>
        <Panel i={1}>
          <Stat value={tonight} label="Tonight" tone={tonight ? "warn" : undefined} />
        </Panel>
        <Panel i={2}>
          <Stat value={upcoming.length} label="Standing by" />
        </Panel>
        <Panel i={3}>
          <Stat value={archived.length} label="Archived" />
        </Panel>
        <Panel i={4}>
          <Stat value={totalGames} label="Games logged" sub="across every closed room" />
        </Panel>
      </div>

      <div className="flex flex-col gap-4">
        <Section
          i={5}
          label="Live"
          tone="live"
          rows={live}
          empty="No room is live right now"
          today={today}
        />
        <Section
          i={6}
          label="Upcoming"
          tone="warn"
          rows={upcoming}
          empty="Nothing on the board — deploy an operation"
          today={today}
        />
        <Section
          i={7}
          label="Archived"
          tone="idle"
          rows={archived}
          empty="No operations closed yet"
          today={today}
          archive
        />
      </div>
    </div>
  );
}

function Section({
  i,
  label,
  tone,
  rows,
  empty,
  today,
  archive = false,
}: {
  i: number;
  label: string;
  tone: "live" | "warn" | "idle";
  rows: Row[];
  empty: string;
  today: string;
  archive?: boolean;
}) {
  return (
    <Panel
      i={i}
      pad={false}
      label={label}
      sweep={tone === "live" && rows.length > 0}
      status={<Dot tone={tone} pulse={tone === "live" && rows.length > 0} />}
      right={<span className="hq-mono text-xs text-ink-soft">{rows.length}</span>}
    >
      {rows.length === 0 ? (
        <Nil>{empty}</Nil>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-rule">
              <Th className="w-[92px]">Date</Th>
              <Th className="w-[58px]">Time</Th>
              <Th className="w-[46px]">Game</Th>
              <Th>Operation</Th>
              <Th className="w-[170px]">Squad</Th>
              <Th className="w-[110px] text-right">Roster</Th>
              <Th className="w-[130px]">Room</Th>
              <Th className="w-[150px] text-right">
                {archive ? "Duration · games" : "Kick-off"}
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, n) => {
              const c = r.comp;
              const g = gameById(c.game);
              const hd = heroDate(c.date);
              const roomTone =
                c.status === "cancelled"
                  ? "alert"
                  : c.finished_at
                    ? "idle"
                    : c.started_at
                      ? "live"
                      : "warn";
              const roomLabel =
                c.status === "cancelled"
                  ? "Scrubbed"
                  : c.finished_at
                    ? "Archived"
                    : c.started_at
                      ? "Live"
                      : "Standing by";
              return (
                <tr
                  key={c.id}
                  className="hq-rise border-b border-rule/50 transition-colors last:border-0 hover:bg-[rgba(255,255,255,0.025)]"
                  style={{ ["--i" as string]: Math.min(n, 12) }}
                >
                  <Td>
                    <Link href={`/hq/operations/${c.id}`} className="block">
                      <span
                        className="hq-mono text-[12px]"
                        style={{ color: c.date === today ? "var(--color-sand)" : undefined }}
                      >
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
                    <Link href={`/hq/operations/${c.id}`} className="block text-center" title={g.name}>
                      {g.emoji}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/hq/operations/${c.id}`} className="block min-w-0">
                      <span className="block truncate text-[13px]">{compHeading(c)}</span>
                      <span className="hq-mono block truncate text-[10px] uppercase tracking-[0.1em] text-ink-soft">
                        {g.name}
                        {c.for_cup ? " · counts for the cup" : ""}
                        {c.stake ? ` · ${c.stake}` : ""}
                      </span>
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
                      {archive || c.started_at ? (
                        <>
                          <span style={{ color: "var(--color-moss)" }}>{r.present}</span>
                          <span className="text-ink-soft"> / {r.roster}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: r.roster ? "var(--color-moss)" : "var(--color-ink-soft)" }}>
                            {r.roster}
                          </span>
                          <span className="text-ink-soft"> in</span>
                        </>
                      )}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/hq/operations/${c.id}`} className="block">
                      <Tag tone={roomTone}>{roomLabel}</Tag>
                    </Link>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/hq/operations/${c.id}`} className="hq-mono block text-[12px] text-ink-soft">
                      {c.started_at && c.finished_at
                        ? `${durationText(c.started_at, c.finished_at)} · ${c.games_count} games`
                        : c.started_at
                          ? `${c.games_count} games so far`
                          : c.status === "cancelled"
                            ? c.cancel_reason || "Called off"
                            : shortTime(c.tee_time)
                              ? `${shortTime(c.tee_time)} kick-off`
                              : "Time TBC"}
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`hq-label px-3 py-2 text-left font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-1.5 align-middle ${className}`}>{children}</td>;
}
