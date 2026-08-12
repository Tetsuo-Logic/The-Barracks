// FUTURE / PROTOTYPE — see ./README.md. No database access in this file.
// Cross-Barracks discovery, challenges and battles. Replaced later by a public
// Barracks directory + a `challenges`/`battles` schema.

export type Org = {
  id: string;
  name: string;
  tag: string;
  motto: string;
  game: string;
  operatives: number;
  region: string;
  timezone: string;
  nights: string[];
  temper: "Casual" | "Competitive" | "Mixed";
  openToChallenges: boolean;
  record: { p: number; w: number; l: number };
  form: ("W" | "L")[];
};

export const ORGS: Org[] = [
  {
    id: "shed",
    name: "The Shed",
    tag: "SHD",
    motto: "Out back, every night.",
    game: "cod",
    operatives: 7,
    region: "UK",
    timezone: "GMT",
    nights: ["Fri", "Sat"],
    temper: "Competitive",
    openToChallenges: true,
    record: { p: 34, w: 22, l: 12 },
    form: ["W", "W", "L", "W", "W"],
  },
  {
    id: "unit7",
    name: "Unit 7",
    tag: "U7",
    motto: "Seven strong, no excuses.",
    game: "cod",
    operatives: 9,
    region: "UK",
    timezone: "GMT",
    nights: ["Wed", "Thu", "Sun"],
    temper: "Mixed",
    openToChallenges: true,
    record: { p: 28, w: 14, l: 14 },
    form: ["L", "W", "L", "L", "W"],
  },
  {
    id: "nightshift",
    name: "Night Shift",
    tag: "NSH",
    motto: "We play when you sleep.",
    game: "cod",
    operatives: 6,
    region: "IE",
    timezone: "GMT",
    nights: ["Tue", "Fri"],
    temper: "Casual",
    openToChallenges: true,
    record: { p: 11, w: 4, l: 7 },
    form: ["L", "L", "W", "L", "L"],
  },
  {
    id: "boot-room",
    name: "The Boot Room",
    tag: "BTR",
    motto: "It's only a game until it isn't.",
    game: "fifa",
    operatives: 8,
    region: "UK",
    timezone: "GMT",
    nights: ["Mon", "Thu"],
    temper: "Competitive",
    openToChallenges: true,
    record: { p: 41, w: 30, l: 11 },
    form: ["W", "W", "W", "L", "W"],
  },
  {
    id: "paddock",
    name: "Paddock Club",
    tag: "PDK",
    motto: "Lights out and away we go.",
    game: "f1",
    operatives: 12,
    region: "EU",
    timezone: "CET",
    nights: ["Sun"],
    temper: "Competitive",
    openToChallenges: false,
    record: { p: 19, w: 9, l: 10 },
    form: ["W", "L", "W", "W", "L"],
  },
  {
    id: "old-school",
    name: "Old School",
    tag: "OSC",
    motto: "Same lads since 2004.",
    game: "cod",
    operatives: 5,
    region: "UK",
    timezone: "GMT",
    nights: ["Sat"],
    temper: "Casual",
    openToChallenges: true,
    record: { p: 7, w: 3, l: 4 },
    form: ["W", "L", "L", "W", "L"],
  },
];

export function orgById(id: string): Org | null {
  return ORGS.find((o) => o.id === id) ?? null;
}

export type ChallengeStage =
  | "challenge"
  | "accepted"
  | "scheduling"
  | "confirmed"
  | "room_open"
  | "roll_call"
  | "live"
  | "result_pending"
  | "captain_confirmation"
  | "archived";

export const STAGES: { key: ChallengeStage; label: string }[] = [
  { key: "challenge", label: "Challenge" },
  { key: "accepted", label: "Accepted" },
  { key: "scheduling", label: "Scheduling" },
  { key: "confirmed", label: "Confirmed" },
  { key: "room_open", label: "Room open" },
  { key: "roll_call", label: "Roll call" },
  { key: "live", label: "Live" },
  { key: "result_pending", label: "Result pending" },
  { key: "captain_confirmation", label: "Captain confirmation" },
  { key: "archived", label: "Archived" },
];

export type Challenge = {
  id: string;
  org: string; // Org.id
  game: string;
  format: string;
  stage: ChallengeStage;
  proposed: { date: string; time: string; agreed: boolean }[];
  note: string;
};

export const CHALLENGES: Challenge[] = [
  {
    id: "ch-118",
    org: "shed",
    game: "cod",
    format: "Best of 5",
    stage: "live",
    proposed: [{ date: "Fri", time: "20:30", agreed: true }],
    note: "Rematch. They asked for it.",
  },
  {
    id: "ch-119",
    org: "unit7",
    game: "cod",
    format: "Best of 3",
    stage: "scheduling",
    proposed: [
      { date: "Wed", time: "21:00", agreed: true },
      { date: "Thu", time: "20:30", agreed: false },
      { date: "Sun", time: "19:00", agreed: true },
    ],
    note: "They're flexible midweek.",
  },
  {
    id: "ch-120",
    org: "boot-room",
    game: "fifa",
    format: "Best of 3",
    stage: "challenge",
    proposed: [],
    note: "Incoming challenge — awaiting our answer.",
  },
];

export type BattleGame = {
  n: number;
  us: "WIN" | "LOSS" | null;
  them: "WIN" | "LOSS" | null;
  map?: string;
  ourEvidence: boolean;
  theirEvidence: boolean;
  verdict: "verified" | "review" | "pending";
};

export type Battle = {
  id: string;
  org: string;
  game: string;
  format: string;
  bestOf: number;
  stage: ChallengeStage;
  scheduled: string;
  lobby: { host: string; name: string; key: string; region: string };
  games: BattleGame[];
  ourConfirmed: boolean;
  theirConfirmed: boolean;
};

export const LIVE_BATTLE: Battle = {
  id: "btl-118",
  org: "shed",
  game: "cod",
  format: "Best of 5",
  bestOf: 5,
  stage: "live",
  scheduled: "Friday · 20:30",
  lobby: {
    host: "The Barracks",
    name: "BRK-SHD-118",
    key: "7741",
    region: "EU-West",
  },
  games: [
    { n: 1, us: "WIN", them: "LOSS", map: "Terminal", ourEvidence: true, theirEvidence: true, verdict: "verified" },
    { n: 2, us: "LOSS", them: "WIN", map: "Rust", ourEvidence: true, theirEvidence: true, verdict: "verified" },
    { n: 3, us: "WIN", them: "LOSS", map: "Highrise", ourEvidence: true, theirEvidence: false, verdict: "pending" },
    { n: 4, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
    { n: 5, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
  ],
  ourConfirmed: false,
  theirConfirmed: false,
};

export function series(b: Battle): { us: number; them: number } {
  return {
    us: b.games.filter((g) => g.us === "WIN").length,
    them: b.games.filter((g) => g.them === "WIN").length,
  };
}

export type Rivalry = {
  org: string;
  meetings: number;
  us: number;
  them: number;
  streak: string;
  biggest: string;
  last: string;
  next: string | null;
};

export const RIVALRIES: Rivalry[] = [
  {
    org: "shed",
    meetings: 8,
    us: 5,
    them: 3,
    streak: "W2",
    biggest: "5–0 (Mar)",
    last: "3–1 win · 3 weeks ago",
    next: "Friday 20:30",
  },
  {
    org: "unit7",
    meetings: 4,
    us: 1,
    them: 3,
    streak: "L2",
    biggest: "3–2 win (Jan)",
    last: "1–3 loss · last month",
    next: null,
  },
  {
    org: "boot-room",
    meetings: 2,
    us: 1,
    them: 1,
    streak: "W1",
    biggest: "4–2 win (Feb)",
    last: "4–2 win · 2 months ago",
    next: null,
  },
];

export type LeagueRow = {
  org: string;
  name: string;
  p: number;
  w: number;
  l: number;
  diff: number;
  pts: number;
  us?: boolean;
};

export const LEAGUE: { name: string; season: string; rows: LeagueRow[] } = {
  name: "Barracks COD League",
  season: "2026 · Division 1",
  rows: [
    { org: "self", name: "The Barracks", p: 8, w: 7, l: 1, diff: 14, pts: 21, us: true },
    { org: "shed", name: "The Shed", p: 8, w: 6, l: 2, diff: 9, pts: 18 },
    { org: "boot-room", name: "The Boot Room", p: 8, w: 5, l: 3, diff: 4, pts: 15 },
    { org: "unit7", name: "Unit 7", p: 8, w: 4, l: 4, diff: -1, pts: 12 },
    { org: "nightshift", name: "Night Shift", p: 8, w: 2, l: 6, diff: -8, pts: 6 },
    { org: "old-school", name: "Old School", p: 8, w: 0, l: 8, diff: -18, pts: 0 },
  ],
};
