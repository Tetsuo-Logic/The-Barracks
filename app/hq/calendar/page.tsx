import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRadar, getSquads } from "@/lib/data";
import { gameById, compHeading } from "@/lib/games";
import { todayISO, shortTime } from "@/lib/dates";
import { PageHead, Proto } from "@/components/hq/Kit";
import { CalendarBoard, type CalEvent } from "@/components/hq/CalendarBoard";
import type { Competition, Profile, Rsvp } from "@/lib/types";

export const metadata = { title: "Calendar · Barracks HQ" };

const DEFAULT_START = "20:00";

/** '+2h' from a bare HH:MM, wrapping past midnight. */
function plusTwo(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const t = (h * 60 + (m || 0) + 120) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const hhmm = (isoTs: string) => {
  const d = new Date(isoTs);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// One calendar, many views. Operations and radar releases are real rows; the
// Battles layer is a marked prototype until the network module lands.
export default async function CalendarPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: compRows }, { data: rsvpRows }, { data: profileRows }, squads, radar] =
    await Promise.all([
      supabase.from("competitions").select("*").order("date", { ascending: true }),
      supabase.from("rsvps").select("*"),
      supabase.from("profiles").select("id, name"),
      getSquads(profile.id),
      getRadar(profile.id),
    ]);

  const comps = (compRows ?? []) as Competition[];
  const rsvps = (rsvpRows ?? []) as Rsvp[];
  const people: Record<string, string> = {};
  for (const p of (profileRows ?? []) as Pick<Profile, "id" | "name">[]) people[p.id] = p.name;

  // Who's expected on each operation — roll call "in", the real roster.
  const inByComp = new Map<string, string[]>();
  for (const r of rsvps) {
    if (r.status !== "in") continue;
    const list = inByComp.get(r.competition_id) ?? [];
    list.push(r.player_id);
    inByComp.set(r.competition_id, list);
  }

  const squadById = new Map(squads.map((s) => [s.squad.id, s]));
  const mySquadIds = new Set(squads.filter((s) => s.mine).map((s) => s.squad.id));

  // ── Operations ─────────────────────────────────────────────────────────────
  const operations: CalEvent[] = comps.map((c) => {
    const g = gameById(c.game);
    const sq = c.squad_id ? squadById.get(c.squad_id) : null;
    const roster = inByComp.get(c.id) ?? [];
    const start = shortTime(c.tee_time) || (c.started_at ? hhmm(c.started_at) : DEFAULT_START);
    const realEnd = c.finished_at ? hhmm(c.finished_at) : null;
    return {
      id: c.id,
      kind: "operation",
      date: c.date,
      start,
      end: realEnd ?? plusTwo(start),
      assumed: realEnd == null,
      title: compHeading(c),
      game: c.game,
      emoji: g.emoji,
      colour: g.colour,
      squadId: c.squad_id,
      squadName: sq ? sq.squad.name || gameById(sq.squad.game).name : null,
      mine: roster.includes(profile.id) || (c.squad_id ? mySquadIds.has(c.squad_id) : true),
      rosterIds: roster,
      rosterCount: roster.length,
      state:
        c.status === "cancelled"
          ? "scrubbed"
          : c.finished_at
            ? "archived"
            : c.started_at
              ? "live"
              : "standing",
      href: `/hq/operations/${c.id}`,
      proto: false,
      note: c.notes,
    };
  });

  // ── Releases — real radar contacts with a known release date ───────────────
  const releases: CalEvent[] = radar.items
    .filter((r) => r.release_date)
    .map((r) => ({
      id: `radar-${r.id}`,
      kind: "release" as const,
      date: r.release_date!,
      start: null,
      end: null,
      assumed: false,
      title: r.title,
      game: "radar",
      emoji: "◆",
      colour: "var(--color-sand)",
      squadId: null,
      squadName: null,
      mine: r.mine === true,
      rosterIds: [],
      rosterCount: r.yes,
      state: "marker" as const,
      href: "/hq/radar",
      proto: false,
      note: r.note,
    }));

  // ── Battles — PROTOTYPE. The network module isn't built; these are shaped
  // like the real thing (a squad, an opponent, a night) so the layer can be
  // seen on the board. Seeded from real squads, never written anywhere.
  const today = todayISO();
  const battles: CalEvent[] = squads.slice(0, 2).map((s, i) => {
    const d = new Date();
    d.setDate(d.getDate() + 9 + i * 7);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const g = gameById(s.squad.game);
    return {
      id: `battle-${s.squad.id}`,
      kind: "battle" as const,
      date,
      start: "21:00",
      end: "23:00",
      assumed: true,
      title: `${(s.squad.clan_tag || s.squad.name || g.name).toUpperCase()} vs ${i === 0 ? "OSC" : "WRK"}`,
      game: s.squad.game,
      emoji: "⚔",
      colour: "var(--color-flag)",
      squadId: s.squad.id,
      squadName: s.squad.name || g.name,
      mine: s.mine,
      rosterIds: [],
      rosterCount: s.members.length,
      state: "marker" as const,
      href: "/hq/battles",
      proto: true,
      note: "Prototype — inter-Barracks battles are not yet wired",
    };
  });

  const events = [...operations, ...releases, ...battles];
  const squadOptions = squads.map((s) => ({
    id: s.squad.id,
    label: [s.squad.clan_tag, s.squad.name || gameById(s.squad.game).name].filter(Boolean).join(" "),
  }));

  const upcomingCount = operations.filter((e) => e.date >= today && e.state === "standing").length;

  return (
    <div>
      <PageHead
        eyebrow="Command"
        title="Calendar"
        right={
          <>
            <span className="hq-mono flex items-center gap-1.5 text-[11px] text-ink-soft">
              Battles layer <Proto />
            </span>
            <Link
              href="/hq/operations/new"
              className="hq-label rounded-[3px] px-3 py-2 font-semibold"
              style={{ backgroundColor: "var(--color-sand)", color: "#0b100e" }}
            >
              + Deploy operation
            </Link>
          </>
        }
      >
        {operations.length} operations tracked · {upcomingCount} standing by ·{" "}
        {releases.length} release{releases.length === 1 ? "" : "s"} on the radar
      </PageHead>

      <CalendarBoard events={events} squads={squadOptions} people={people} today={today} />
    </div>
  );
}
