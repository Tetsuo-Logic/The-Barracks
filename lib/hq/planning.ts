import { createClient } from "@/lib/supabase/server";
import { getSquads } from "@/lib/queries";
import { gameById } from "@/lib/games";
import { todayISO, shortTime } from "@/lib/dates";
import { buildSquadIntel } from "@/components/hq/availability/model";
import { rankOptions, bumpedBy, type CalendarEntry, type Option } from "@/components/hq/availability/recommend";
import type { SquadIntel } from "@/components/hq/availability/model";
import type { Profile, Competition, Rsvp, Muster } from "@/lib/types";
import { hqSampleRequests } from "@/lib/hq/future/planning";

// Command Planning — the read side of the President's deployment queue.
//
// This composes the existing muster domain; it invents no workflow of its own.
// The lifecycle a request moves through is already in the schema:
//
//   squad_night_requests        → REQUESTED        (members nudge their Captain)
//   musters.status 'open'       → MUSTER OPEN      (squad reporting their hours)
//   …enough reported            → READY            (Captain can send it up)
//   musters.status 'proposed'   → SUBMITTED        (President's queue — here)
//   musters.status 'approved'   → DEPLOYED         (a real Operation exists)
//
// The President's queue is the SUBMITTED band. Everything before it is shown so
// neither role is blind to the pipeline, not because it's actionable here.

export type Stage = "requested" | "open" | "ready" | "submitted" | "deployed";

export const STAGES: { key: Stage; label: string }[] = [
  { key: "requested", label: "Requested" },
  { key: "open", label: "Muster open" },
  { key: "ready", label: "Ready" },
  { key: "submitted", label: "Submitted to command" },
  { key: "deployed", label: "Deployed" },
];

export type PlanningRequest = {
  /** Muster id where one exists — the deploy target. Nudges have no muster. */
  id: string;
  musterId: string | null;
  squadId: string;
  squadName: string;
  game: string;
  emoji: string;
  tag: string | null;
  /** What's being organised, in the system's voice: "COD NIGHT". */
  title: string;
  captainName: string;
  submittedBy: string | null;
  reported: number;
  total: number;
  required: number;
  /** Operatives who haven't reported — the Captain's chase list. */
  outstanding: string[];
  stage: Stage;
  windowLabel: string;
  nightsOffered: number;
  note: string | null;
  /** The Captain's own pick, when they've proposed one. */
  captainPick: { iso: string; time: string | null; label: string } | null;
  top: Option | null;
  options: Option[];
  /** The same ranking with the Barracks calendar taken out. A Captain plans
   *  inside their own squad; only Command weighs a night against everything
   *  else on the board, so the two roles genuinely see different answers. */
  squadOptions: Option[];
  bumped: ReturnType<typeof bumpedBy>;
  deployed: { compId: string | null; iso: string; time: string | null } | null;
  intel: SquadIntel | null;
  demo: boolean;
};

export type Planning = {
  requests: PlanningRequest[];
  calendar: CalendarEntry[];
  /** Squads the caller captains — the scope of the Captain's own planning view. */
  captainOf: string[];
  demoCount: number;
};

/** Operations already on the board, in the shape the recommender wants.
 *  An Operation has a start but no end in the schema, so a session is treated
 *  as three hours — long enough to catch a real collision, short enough not to
 *  block the whole evening. */
const SESSION_HOURS = 3;

function toCalendar(
  comps: Competition[],
  rsvps: Rsvp[],
  squadMembers: Map<string, string[]>,
): CalendarEntry[] {
  const today = todayISO();
  const inByComp = new Map<string, string[]>();
  for (const r of rsvps) {
    if (r.status !== "in") continue;
    const arr = inByComp.get(r.competition_id) ?? [];
    arr.push(r.player_id);
    inByComp.set(r.competition_id, arr);
  }

  return comps
    .filter((c) => c.status === "upcoming" && c.date >= today)
    .map((c) => {
      const g = gameById(c.game);
      const from = (c.tee_time ?? "20:00:00").slice(0, 5);
      const [h, m] = from.split(":").map(Number);
      const to = `${String(Math.min(23, (h || 0) + SESSION_HOURS)).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
      // Who's expected: RSVPs where they exist, otherwise the squad it belongs
      // to. Before roll call opens, squad membership is the best signal we have.
      const rsvpd = inByComp.get(c.id) ?? [];
      const committed = rsvpd.length ? rsvpd : c.squad_id ? (squadMembers.get(c.squad_id) ?? []) : [];
      return {
        id: c.id,
        title: c.title || g.name,
        emoji: g.emoji,
        iso: c.date,
        from,
        to,
        squadId: c.squad_id,
        committed,
      };
    });
}

/**
 * Everything Command Planning renders, for whichever role is looking.
 *
 * Recommendations are computed here, against the calendar as it stands at the
 * moment of the request — never cached, never batched. Deploy an Operation and
 * the next request reviewed sees it.
 */
export async function getPlanning(profile: Profile): Promise<Planning> {
  const supabase = await createClient();
  const today = todayISO();

  const [squads, { data: comps }, { data: rsvps }, { data: approved }] = await Promise.all([
    getSquads(profile.id),
    supabase.from("competitions").select("*"),
    supabase.from("rsvps").select("*"),
    supabase
      .from("musters")
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const allComps = (comps ?? []) as Competition[];
  const squadMembers = new Map(squads.map((s) => [s.squad.id, s.members.map((m) => m.profile.id)]));
  const calendar = toCalendar(allComps, (rsvps ?? []) as Rsvp[], squadMembers);

  const requests: PlanningRequest[] = [];

  for (const s of squads) {
    const g = gameById(s.squad.game);
    const squadName = s.squad.name || g.name;
    const captain = s.members.find((m) => m.is_captain)?.profile ?? null;
    const mu = s.muster?.muster ?? null;

    const base = {
      squadId: s.squad.id,
      squadName,
      game: s.squad.game,
      emoji: g.emoji,
      tag: s.squad.clan_tag,
      title: `${squadName.toUpperCase()} NIGHT`,
      captainName: captain?.name ?? "No captain",
      total: s.members.length,
      demo: false,
    };

    // ── A muster is running or has been sent up ──────────────────────────
    if (mu) {
      const intel = buildSquadIntel(s, today);
      // A live muster's calendar excludes any Operation it already produced.
      const options = rankOptions(intel, calendar);
      const reported = s.muster?.responses.length ?? 0;
      const respondedIds = new Set((s.muster?.responses ?? []).map((r) => r.user_id));
      const outstanding = s.members
        .filter((m) => !respondedIds.has(m.profile.id))
        .map((m) => m.profile.nickname || m.profile.name);

      const stage: Stage =
        mu.status === "proposed"
          ? "submitted"
          : reported >= intel.required
            ? "ready"
            : "open";

      requests.push({
        ...base,
        id: mu.id,
        musterId: mu.id,
        submittedBy: captain?.name ?? null,
        reported,
        required: intel.required,
        outstanding,
        stage,
        windowLabel: `${intel.windowFrom}–${intel.windowTo}`,
        nightsOffered: mu.dates.length,
        note: mu.note,
        captainPick: mu.chosen_date
          ? {
              iso: mu.chosen_date,
              time: mu.chosen_time,
              label: `${mu.chosen_date}${mu.chosen_time ? ` · ${shortTime(mu.chosen_time)}` : ""}`,
            }
          : null,
        top: options[0] ?? null,
        options,
        squadOptions: rankOptions(intel, []),
        bumped: bumpedBy(options),
        deployed: null,
        intel,
      });
      continue;
    }

    // ── No muster, but members have nudged the Captain ───────────────────
    if (s.nightRequests.length > 0) {
      requests.push({
        ...base,
        id: `nudge-${s.squad.id}`,
        musterId: null,
        submittedBy: s.nightRequests[0]?.requester?.name ?? null,
        reported: 0,
        required: 0,
        outstanding: [],
        stage: "requested",
        windowLabel: "—",
        nightsOffered: 0,
        note: s.nightRequests[0]?.note ?? null,
        captainPick: null,
        top: null,
        options: [],
        squadOptions: [],
        bumped: null,
        deployed: null,
        intel: null,
      });
    }
  }

  // ── Already deployed — the tail of the lifecycle ─────────────────────────
  const compById = new Map(allComps.map((c) => [c.id, c]));
  for (const row of (approved ?? []) as Muster[]) {
    const s = squads.find((sq) => sq.squad.id === row.squad_id);
    const g = gameById(row.game);
    const squadName = s?.squad.name || g.name;
    const comp = row.competition_id ? compById.get(row.competition_id) : undefined;
    requests.push({
      id: row.id,
      musterId: row.id,
      squadId: row.squad_id,
      squadName,
      game: row.game,
      emoji: g.emoji,
      tag: s?.squad.clan_tag ?? null,
      title: `${squadName.toUpperCase()} NIGHT`,
      captainName: s?.members.find((m) => m.is_captain)?.profile.name ?? "—",
      submittedBy: null,
      reported: 0,
      total: s?.members.length ?? 0,
      required: 0,
      outstanding: [],
      stage: "deployed",
      windowLabel: "—",
      nightsOffered: row.dates.length,
      note: row.note,
      captainPick: null,
      top: null,
      options: [],
      squadOptions: [],
      bumped: null,
      deployed: {
        compId: row.competition_id,
        iso: comp?.date ?? row.chosen_date ?? "",
        time: comp?.tee_time ?? row.chosen_time,
      },
      intel: null,
      demo: false,
    });
  }

  // Dev-only scenarios, scored through the same engine against the same real
  // calendar — so a demo card is a genuine recommendation over invented
  // availability, not invented reasoning. Empty in production.
  const samples = hqSampleRequests(today, calendar);
  requests.push(...samples);

  return {
    requests,
    calendar,
    captainOf: squads.filter((s) => s.captainId === profile.id).map((s) => s.squad.id),
    demoCount: samples.length,
  };
}

/** One request by id — the evidence view's entry point. */
export async function getPlanningRequest(
  profile: Profile,
  id: string,
): Promise<{ request: PlanningRequest; calendar: CalendarEntry[] } | null> {
  const planning = await getPlanning(profile);
  const request = planning.requests.find((r) => r.id === id);
  return request ? { request, calendar: planning.calendar } : null;
}
