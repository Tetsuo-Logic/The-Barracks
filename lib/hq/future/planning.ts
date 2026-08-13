// FUTURE / PROTOTYPE — see ./README.md. No database access in this file.
//
// Command Planning scenarios, so the President's queue can be designed against
// states a quiet Barracks won't produce: several requests waiting at once, a
// request still gathering responses, and — the one that matters — a
// recommendation the existing calendar has moved.
//
// These are NOT fake recommendations. Each scenario supplies availability only;
// the nights, windows, headcounts, checks and ranking all come from the real
// engine (components/hq/availability/model + recommend), scored against the
// real calendar. What's invented is who said they could play, nothing else.
//
// Deleted outright once there's enough genuine muster traffic to design against.

import { heroDate } from "@/lib/dates";
import { gameById } from "@/lib/games";
import {
  computeNights,
  nextNights,
  requiredFor,
  type Cell,
  type MemberIntel,
  type SquadIntel,
} from "@/components/hq/availability/model";
import { rankOptions, bumpedBy, type CalendarEntry } from "@/components/hq/availability/recommend";
import type { PlanningRequest, Stage } from "@/lib/hq/planning";

// "20:00-23:00" = available those hours · "-" = out · "?" = hasn't reported.
type Availability = string;

type Scenario = {
  key: string;
  squadName: string;
  game: string;
  tag: string | null;
  captain: string;
  note: string | null;
  stage: Stage;
  /** Candidate nights as offsets from today. */
  offsets: number[];
  windowFrom: string;
  windowTo: string;
  /** Index-aligned with offsets. */
  members: { name: string; nights: Availability[] }[];
  /** The Captain's own pick, as an offset + time. */
  pick?: { offset: number; time: string };
  /** An Operation invented purely to demonstrate a calendar collision. */
  clash?: { title: string; emoji: string; offset: number; from: string; to: string; members: number[] };
};

const SCENARIOS: Scenario[] = [
  // 1 · The clean one. Everybody reported, one night stands out, nothing on the
  //     calendar touches it. This is the card that should read as "deploy me".
  {
    key: "cod",
    squadName: "COD Squad",
    game: "cod",
    tag: "COD",
    captain: "Rosco",
    note: "Ranked push — want a proper full squad on.",
    stage: "submitted",
    offsets: [0, 1, 3, 4],
    windowFrom: "19:00",
    windowTo: "23:00",
    pick: { offset: 0, time: "20:00" },
    members: [
      { name: "Rosco", nights: ["20:00-23:00", "21:00-23:00", "-", "20:00-22:00"] },
      { name: "Deano", nights: ["20:00-23:00", "-", "20:00-23:00", "20:00-23:00"] },
      { name: "Mick", nights: ["20:00-23:00", "21:00-23:00", "20:00-22:00", "-"] },
      { name: "Baz", nights: ["19:00-23:00", "-", "-", "20:00-23:00"] },
      { name: "Tel", nights: ["20:00-23:00", "21:00-23:00", "20:00-23:00", "-"] },
      { name: "Jonesy", nights: ["20:00-22:00", "-", "20:00-23:00", "20:00-23:00"] },
      { name: "Smudge", nights: ["-", "21:00-23:00", "20:00-23:00", "20:00-23:00"] },
    ],
  },

  // 2 · The interesting one. Saturday is the strongest night on paper, but an
  //     Operation already holds it and takes two of this squad with it — so the
  //     engine should move the answer and say why.
  {
    key: "fifa",
    squadName: "FIFA Squad",
    game: "fifa",
    tag: "FIFA",
    captain: "Deano",
    note: "League night — six is plenty.",
    stage: "submitted",
    offsets: [2, 3, 5],
    windowFrom: "20:00",
    windowTo: "23:00",
    pick: { offset: 3, time: "21:00" },
    clash: {
      title: "Threeball — the annual",
      emoji: "⛳",
      offset: 3,
      from: "20:00",
      to: "23:00",
      members: [0, 1],
    },
    members: [
      { name: "Deano", nights: ["21:00-23:00", "20:00-23:00", "-"] },
      { name: "Mick", nights: ["-", "20:00-23:00", "21:00-23:00"] },
      { name: "Baz", nights: ["21:00-23:00", "20:00-23:00", "21:00-23:00"] },
      { name: "Tel", nights: ["21:00-23:00", "20:00-23:00", "21:00-23:00"] },
      { name: "Jonesy", nights: ["21:00-23:00", "20:00-23:00", "21:00-23:00"] },
      { name: "Smudge", nights: ["21:00-23:00", "20:00-23:00", "21:00-23:00"] },
    ],
  },

  // 3 · Submitted early. The Captain sent it up before the squad finished
  //     reporting, so it's deployable but the evidence is thin.
  {
    key: "f1",
    squadName: "F1 Squad",
    game: "gta",
    tag: "F1",
    captain: "Tel",
    note: "Silverstone. Grid of eight if we can get it.",
    stage: "submitted",
    offsets: [4, 6],
    windowFrom: "19:00",
    windowTo: "22:00",
    members: [
      { name: "Tel", nights: ["19:30-22:00", "19:00-22:00"] },
      { name: "Rosco", nights: ["19:30-22:00", "-"] },
      { name: "Baz", nights: ["19:30-22:00", "19:00-21:00"] },
      { name: "Jonesy", nights: ["-", "19:00-22:00"] },
      { name: "Deano", nights: ["?", "?"] },
      { name: "Mick", nights: ["?", "?"] },
      { name: "Smudge", nights: ["?", "?"] },
      { name: "Ando", nights: ["?", "?"] },
    ],
  },

  // 4 · Still in the squad. Not the President's problem yet, but they shouldn't
  //     be blind to what's coming.
  {
    key: "showdown",
    squadName: "Showdown Squad",
    game: "showdown",
    tag: null,
    captain: "Baz",
    note: null,
    stage: "open",
    offsets: [5, 6, 7],
    windowFrom: "20:00",
    windowTo: "23:00",
    members: [
      { name: "Baz", nights: ["20:00-23:00", "-", "20:00-23:00"] },
      { name: "Smudge", nights: ["21:00-23:00", "21:00-23:00", "-"] },
      { name: "Ando", nights: ["-", "20:00-23:00", "20:00-22:00"] },
      { name: "Mick", nights: ["?", "?", "?"] },
      { name: "Tel", nights: ["?", "?", "?"] },
      { name: "Jonesy", nights: ["?", "?", "?"] },
    ],
  },
];

// A nudge that hasn't become a muster yet — the very start of the lifecycle.
const NUDGE = {
  key: "gta",
  squadName: "GTA Squad",
  game: "gta",
  captain: "Jonesy",
  by: "Ando",
  note: "Any chance of a heist night this week?",
};

function buildIntel(sc: Scenario, dates: string[]): SquadIntel {
  const g = gameById(sc.game);

  const members: MemberIntel[] = sc.members.map((m, i) => ({
    id: `demo:${sc.key}:${i}`,
    name: m.name,
    short: m.name.slice(0, 8),
    captain: m.name === sc.captain,
    responded: !m.nights.every((n) => n === "?"),
    nights: 0,
  }));

  const cells: Record<string, Record<string, Cell>> = {};
  sc.members.forEach((m, i) => {
    const row: Record<string, Cell> = {};
    dates.forEach((iso, d) => {
      const spec = m.nights[d] ?? "-";
      if (spec === "?") {
        row[iso] = { state: "silent", from: null, to: null, full: false };
        return;
      }
      if (spec === "-") {
        row[iso] = { state: "off", from: null, to: null, full: false };
        return;
      }
      const [from, to] = spec.split("-");
      members[i].nights++;
      row[iso] = {
        state: "on",
        from,
        to,
        full: from <= sc.windowFrom && to >= sc.windowTo,
      };
    });
    cells[members[i].id] = row;
  });

  return {
    id: `demo:${sc.key}`,
    name: sc.squadName,
    game: sc.game,
    emoji: g.emoji,
    colour: g.colour,
    tag: sc.tag,
    live: true,
    mine: false,
    status: sc.stage === "submitted" ? "proposed" : "open",
    note: sc.note,
    windowFrom: sc.windowFrom,
    windowTo: sc.windowTo,
    required: requiredFor(members.length),
    members,
    nights: computeNights(dates, members, cells, sc.windowFrom, sc.windowTo),
    cells,
    responded: members.filter((m) => m.responded).length,
    total: members.length,
    chosenDate: null,
    chosenTime: null,
  };
}

/**
 * Sample requests for Command Planning. Empty in production — this is a design
 * aid, so it must never reach a real Barracks.
 *
 * `calendar` is the *live* calendar: demo requests are scored against the real
 * board, so deploying a real Operation genuinely changes what these recommend.
 */
export function hqSampleRequests(todayISO: string, calendar: CalendarEntry[]): PlanningRequest[] {
  if (process.env.NODE_ENV === "production") return [];

  const week = nextNights(todayISO, 8);
  const out: PlanningRequest[] = [];

  for (const sc of SCENARIOS) {
    const dates = sc.offsets.map((o) => week[o]);
    const intel = buildIntel(sc, dates);

    // A scenario may plant one Operation of its own, purely so the calendar
    // collision is visible on any day of the week.
    const board = [...calendar];
    if (sc.clash) {
      board.push({
        id: `demo-op:${sc.key}`,
        title: sc.clash.title,
        emoji: sc.clash.emoji,
        iso: week[sc.clash.offset],
        from: sc.clash.from,
        to: sc.clash.to,
        squadId: null,
        committed: sc.clash.members.map((i) => `demo:${sc.key}:${i}`),
      });
    }

    const options = rankOptions(intel, board);
    const outstanding = intel.members.filter((m) => !m.responded).map((m) => m.name);
    const pickISO = sc.pick ? week[sc.pick.offset] : null;
    const hd = pickISO ? heroDate(pickISO) : null;

    out.push({
      id: `demo:${sc.key}`,
      musterId: null,
      squadId: `demo:${sc.key}`,
      squadName: sc.squadName,
      game: sc.game,
      emoji: intel.emoji,
      tag: sc.tag,
      title: `${sc.squadName.toUpperCase().replace(/ SQUAD$/, "")} NIGHT`,
      captainName: sc.captain,
      submittedBy: sc.captain,
      reported: intel.responded,
      total: intel.total,
      required: intel.required,
      outstanding,
      stage: sc.stage === "open" && intel.responded >= intel.required ? "ready" : sc.stage,
      windowLabel: `${sc.windowFrom}–${sc.windowTo}`,
      nightsOffered: dates.length,
      note: sc.note,
      captainPick:
        pickISO && hd && sc.pick
          ? { iso: pickISO, time: sc.pick.time, label: `${hd.dow} ${hd.day} ${hd.mon} · ${sc.pick.time}` }
          : null,
      top: options[0] ?? null,
      options,
      squadOptions: rankOptions(intel, []),
      bumped: bumpedBy(options),
      deployed: null,
      intel,
      demo: true,
    });
  }

  const g = gameById(NUDGE.game);
  out.push({
    id: `demo:${NUDGE.key}`,
    musterId: null,
    squadId: `demo:${NUDGE.key}`,
    squadName: NUDGE.squadName,
    game: NUDGE.game,
    emoji: g.emoji,
    tag: null,
    title: `${NUDGE.squadName.toUpperCase().replace(/ SQUAD$/, "")} NIGHT`,
    captainName: NUDGE.captain,
    submittedBy: NUDGE.by,
    reported: 0,
    total: 5,
    required: 0,
    outstanding: [],
    stage: "requested",
    windowLabel: "—",
    nightsOffered: 0,
    note: NUDGE.note,
    captainPick: null,
    top: null,
    options: [],
    squadOptions: [],
    bumped: null,
    deployed: null,
    intel: null,
    demo: true,
  });

  return out;
}
