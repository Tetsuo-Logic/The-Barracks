// FUTURE / PROTOTYPE — see ./README.md. No database access in this file.
// Cross-Barracks discovery, challenges and battles. Replaced later by a public
// Barracks directory + a `challenges`/`battles` schema.

export type Platform = "Crossplay" | "PlayStation" | "Xbox" | "PC";

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
  platform: Platform;
  captain: string;
  founded: string;
  lastActive: string;
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
    platform: "Crossplay",
    captain: "Griff",
    founded: "2019",
    lastActive: "Online now",
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
    platform: "PlayStation",
    captain: "Benno",
    founded: "2021",
    lastActive: "2h ago",
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
    platform: "Xbox",
    captain: "Cillian",
    founded: "2024",
    lastActive: "Yesterday",
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
    platform: "PlayStation",
    captain: "Sully",
    founded: "2018",
    lastActive: "Online now",
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
    platform: "PC",
    captain: "Mathis",
    founded: "2022",
    lastActive: "4d ago",
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
    platform: "Xbox",
    captain: "Gaz",
    founded: "2004",
    lastActive: "3h ago",
    record: { p: 7, w: 3, l: 4 },
    form: ["W", "L", "L", "W", "L"],
  },
  {
    id: "lock-in",
    name: "The Lock-In",
    tag: "LKN",
    motto: "Doors shut, headsets on.",
    game: "cod",
    operatives: 10,
    region: "EU",
    timezone: "CET",
    nights: ["Wed", "Sat"],
    temper: "Competitive",
    openToChallenges: true,
    platform: "PC",
    captain: "Rik",
    founded: "2020",
    lastActive: "Online now",
    record: { p: 26, w: 17, l: 9 },
    form: ["W", "W", "W", "W", "L"],
  },
  {
    id: "dockyard",
    name: "The Dockyard",
    tag: "DCK",
    motto: "Late shift, long seasons.",
    game: "fifa",
    operatives: 11,
    region: "US-East",
    timezone: "EST",
    nights: ["Tue", "Thu"],
    temper: "Mixed",
    openToChallenges: true,
    platform: "PlayStation",
    captain: "Marcus",
    founded: "2023",
    lastActive: "6h ago",
    record: { p: 15, w: 8, l: 7 },
    form: ["L", "W", "W", "L", "W"],
  },
  {
    id: "depot",
    name: "The Depot",
    tag: "DPT",
    motto: "Nothing leaves the yard.",
    game: "gta",
    operatives: 14,
    region: "UK",
    timezone: "GMT",
    nights: ["Thu", "Fri", "Sun"],
    temper: "Casual",
    openToChallenges: true,
    platform: "Crossplay",
    captain: "Tez",
    founded: "2021",
    lastActive: "Online now",
    record: { p: 9, w: 5, l: 4 },
    form: ["W", "W", "L", "W", "L"],
  },
  {
    id: "sunday-league",
    name: "Sunday League",
    tag: "SUN",
    motto: "Hungover but present.",
    game: "fifa",
    operatives: 6,
    region: "UK",
    timezone: "GMT",
    nights: ["Sun"],
    temper: "Casual",
    openToChallenges: false,
    platform: "Crossplay",
    captain: "Dermot",
    founded: "2025",
    lastActive: "1w ago",
    record: { p: 4, w: 1, l: 3 },
    form: ["L", "W", "L", "L"],
  },
];

export function orgById(id: string): Org | null {
  return ORGS.find((o) => o.id === id) ?? null;
}

/** Filter vocabularies for the discovery rail — derived so they never drift. */
export const PLATFORMS: Platform[] = ["Crossplay", "PlayStation", "Xbox", "PC"];
export const REGIONS: string[] = Array.from(new Set(ORGS.map((o) => o.region)));
export const TIMEZONES: string[] = Array.from(new Set(ORGS.map((o) => o.timezone)));
export const TEMPERS = ["Casual", "Mixed", "Competitive"] as const;
export const NIGHTS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const SIZE_BANDS: { key: string; label: string; min: number; max: number }[] = [
  { key: "small", label: "1–6", min: 1, max: 6 },
  { key: "mid", label: "7–10", min: 7, max: 10 },
  { key: "large", label: "11+", min: 11, max: 999 },
];

/** Opposing rosters are shared once a battle is confirmed — not before. */
export type NetworkOperative = { name: string; role: string; captain?: boolean };

export const ORG_ROSTERS: Record<string, NetworkOperative[]> = {
  shed: [
    { name: "Griff", role: "Captain · Entry", captain: true },
    { name: "Locky", role: "Anchor" },
    { name: "Bez", role: "Support" },
    { name: "Tank", role: "Objective" },
    { name: "Yeti", role: "Flex" },
    { name: "Pip", role: "Sub" },
    { name: "Marn", role: "Sub" },
  ],
  unit7: [
    { name: "Benno", role: "Captain · Anchor", captain: true },
    { name: "Ash", role: "Entry" },
    { name: "Kez", role: "Support" },
    { name: "Digger", role: "Objective" },
  ],
  "lock-in": [
    { name: "Rik", role: "Captain · Entry", captain: true },
    { name: "Sander", role: "Anchor" },
    { name: "Joop", role: "Support" },
    { name: "Wout", role: "Flex" },
  ],
  nightshift: [
    { name: "Cillian", role: "Captain", captain: true },
    { name: "Fergal", role: "Entry" },
    { name: "Órla", role: "Support" },
  ],
  "old-school": [
    { name: "Gaz", role: "Captain", captain: true },
    { name: "Wozza", role: "Anchor" },
    { name: "Deano", role: "Flex" },
  ],
  "boot-room": [
    { name: "Sully", role: "Captain", captain: true },
    { name: "Chalky", role: "Striker" },
    { name: "Rem", role: "Keeper" },
  ],
  dockyard: [
    { name: "Marcus", role: "Captain", captain: true },
    { name: "Ty", role: "Striker" },
    { name: "Ferg", role: "Keeper" },
  ],
};

/** Roster if the opponent has shared it; empty means "not disclosed yet". */
export function rosterFor(orgId: string): NetworkOperative[] {
  return ORG_ROSTERS[orgId] ?? [];
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

/** What the system is waiting on at each stage — written in the system's voice. */
export const STAGE_BLURB: Record<ChallengeStage, string> = {
  challenge: "A challenge has been issued. Someone has to answer it.",
  accepted: "Both Barracks are in. Now find a night that works.",
  scheduling: "Slots on the table. The overlap becomes the battle.",
  confirmed: "Night agreed. Locked into both calendars.",
  room_open: "Battle room open. Lobby details published to participants.",
  roll_call: "Names on the sheet. Who is actually turning up.",
  live: "In progress. Games are being played right now.",
  result_pending: "Games done, evidence incomplete. Nothing is official yet.",
  captain_confirmation: "Both Captains must sign the result before it counts.",
  archived: "Signed off. Permanent record, counted in the rivalry.",
};

export function stageIndex(stage: ChallengeStage): number {
  return STAGES.findIndex((s) => s.key === stage);
}

/** A night on the table. Both Barracks mark what they can make; overlap wins. */
export type SlotProposal = {
  day: string;
  date: string;
  time: string;
  ours: boolean;
  theirs: boolean;
};

export type Challenge = {
  id: string;
  org: string; // Org.id
  game: string;
  format: string;
  stage: ChallengeStage;
  proposed: { date: string; time: string; agreed: boolean }[];
  note: string;
  incoming?: boolean;
  issued?: string;
  slots?: SlotProposal[];
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
    incoming: true,
    issued: "9 days ago",
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
    incoming: false,
    issued: "2 days ago",
    slots: [
      { day: "Wed", date: "13 Aug", time: "21:00", ours: true, theirs: true },
      { day: "Thu", date: "14 Aug", time: "20:30", ours: true, theirs: false },
      { day: "Fri", date: "15 Aug", time: "20:30", ours: false, theirs: true },
      { day: "Sun", date: "17 Aug", time: "19:00", ours: true, theirs: true },
    ],
  },
  {
    id: "ch-120",
    org: "boot-room",
    game: "fifa",
    format: "Best of 3",
    stage: "challenge",
    proposed: [],
    note: "Incoming challenge — awaiting our answer.",
    incoming: true,
    issued: "6h ago",
    slots: [
      { day: "Mon", date: "18 Aug", time: "20:00", ours: false, theirs: true },
      { day: "Thu", date: "21 Aug", time: "20:00", ours: false, theirs: true },
    ],
  },
  {
    id: "ch-121",
    org: "depot",
    game: "gta",
    format: "One night",
    stage: "accepted",
    proposed: [],
    note: "Accepted. Nights not on the table yet.",
    incoming: false,
    issued: "Yesterday",
    slots: [],
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

/** Pre-battle briefing published by the Captain to both rosters. */
export type Briefing = {
  objective: string;
  rules: string[];
  maps: string[];
};

export type Battle = {
  id: string;
  org: string;
  game: string;
  format: string;
  bestOf: number;
  stage: ChallengeStage;
  scheduled: string;
  lobby: { host: string; name: string; key: string; region: string; join?: string };
  games: BattleGame[];
  ourConfirmed: boolean;
  theirConfirmed: boolean;
  briefing?: Briefing;
  note?: string;
  stream?: { live: boolean; viewers: number; platform: string; caster: string };
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
    join: "20:20 — ten minutes before first game",
  },
  games: [
    { n: 1, us: "WIN", them: "LOSS", map: "Terminal", ourEvidence: true, theirEvidence: true, verdict: "verified" },
    { n: 2, us: "LOSS", them: "WIN", map: "Rust", ourEvidence: true, theirEvidence: true, verdict: "verified" },
    { n: 3, us: "WIN", them: "LOSS", map: "Highrise", ourEvidence: true, theirEvidence: false, verdict: "pending" },
    { n: 4, us: null, them: null, map: "Shipment", ourEvidence: false, theirEvidence: false, verdict: "pending" },
    { n: 5, us: null, them: null, map: "Crash", ourEvidence: false, theirEvidence: false, verdict: "pending" },
  ],
  ourConfirmed: false,
  theirConfirmed: false,
  briefing: {
    objective: "Take the series. Three games seals it — do not let it reach a decider.",
    rules: [
      "Search & Destroy · 6v6 · no killstreaks",
      "Host rotates on the hour if latency exceeds 80ms",
      "Evidence required from both sides within 10 minutes of each game",
      "Any dispute is settled by the two Captains, not the system",
    ],
    maps: ["Terminal", "Rust", "Highrise", "Shipment", "Crash"],
  },
  note: "Rematch. They asked for it.",
  stream: { live: true, viewers: 14, platform: "Barracks Watch", caster: "Steve" },
};

const BASE_BRIEFING: Briefing = {
  objective: "Win the series. Nothing else counts.",
  rules: [
    "Standard Barracks rules · 6v6",
    "Evidence required from both sides after every game",
    "Captains settle disputes — the system only assists",
  ],
  maps: ["Rotation decided in lobby"],
};

/** The full pipeline — a challenge and a battle are the same object at
 *  different stages, which is why they share one board. */
export const BATTLES: Battle[] = [
  LIVE_BATTLE,
  {
    id: "btl-119",
    org: "lock-in",
    game: "cod",
    format: "Best of 3",
    bestOf: 3,
    stage: "roll_call",
    scheduled: "Tonight · 21:00",
    lobby: { host: "The Lock-In", name: "LKN-BRK-119", key: "2208", region: "EU-Central", join: "20:50" },
    games: [
      { n: 1, us: null, them: null, map: "Sub Base", ourEvidence: false, theirEvidence: false, verdict: "pending" },
      { n: 2, us: null, them: null, map: "Karachi", ourEvidence: false, theirEvidence: false, verdict: "pending" },
      { n: 3, us: null, them: null, map: "Favela", ourEvidence: false, theirEvidence: false, verdict: "pending" },
    ],
    ourConfirmed: false,
    theirConfirmed: false,
    briefing: BASE_BRIEFING,
    note: "Roll call closes at 20:45. Four names still silent.",
  },
  {
    id: "btl-121",
    org: "dockyard",
    game: "fifa",
    format: "Best of 3",
    bestOf: 3,
    stage: "room_open",
    scheduled: "Thursday · 20:00",
    lobby: { host: "The Barracks", name: "BRK-DCK-121", key: "5190", region: "EU-West", join: "19:45" },
    games: [
      { n: 1, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
      { n: 2, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
      { n: 3, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
    ],
    ourConfirmed: false,
    theirConfirmed: false,
    briefing: BASE_BRIEFING,
    note: "Timezone split — they're five hours behind. 20:00 our time is their teatime.",
  },
  {
    id: "btl-120",
    org: "nightshift",
    game: "cod",
    format: "Best of 3",
    bestOf: 3,
    stage: "confirmed",
    scheduled: "Tuesday · 21:00",
    lobby: { host: "Night Shift", name: "NSH-BRK-120", key: "0913", region: "EU-West", join: "20:50" },
    games: [
      { n: 1, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
      { n: 2, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
      { n: 3, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
    ],
    ourConfirmed: false,
    theirConfirmed: false,
    briefing: BASE_BRIEFING,
    note: "Their first battle on the network. Go easy. Or don't.",
  },
  {
    id: "btl-116",
    org: "old-school",
    game: "cod",
    format: "Best of 3",
    bestOf: 3,
    stage: "captain_confirmation",
    scheduled: "Saturday · 20:00",
    lobby: { host: "The Barracks", name: "BRK-OSC-116", key: "4402", region: "EU-West" },
    games: [
      { n: 1, us: "WIN", them: "LOSS", map: "Estate", ourEvidence: true, theirEvidence: true, verdict: "verified" },
      { n: 2, us: "LOSS", them: "WIN", map: "Skidrow", ourEvidence: true, theirEvidence: true, verdict: "verified" },
      { n: 3, us: "WIN", them: "LOSS", map: "Wasteland", ourEvidence: true, theirEvidence: true, verdict: "verified" },
    ],
    ourConfirmed: true,
    theirConfirmed: false,
    briefing: BASE_BRIEFING,
    note: "Signed our side. Their Captain has 22 hours left to sign.",
  },
  {
    id: "btl-117",
    org: "shed",
    game: "cod",
    format: "Best of 5",
    bestOf: 5,
    stage: "archived",
    scheduled: "3 weeks ago",
    lobby: { host: "The Shed", name: "SHD-BRK-117", key: "1188", region: "EU-West" },
    games: [
      { n: 1, us: "WIN", them: "LOSS", map: "Terminal", ourEvidence: true, theirEvidence: true, verdict: "verified" },
      { n: 2, us: "WIN", them: "LOSS", map: "Rust", ourEvidence: true, theirEvidence: true, verdict: "verified" },
      { n: 3, us: "LOSS", them: "WIN", map: "Afghan", ourEvidence: true, theirEvidence: true, verdict: "verified" },
      { n: 4, us: "WIN", them: "LOSS", map: "Highrise", ourEvidence: true, theirEvidence: true, verdict: "verified" },
      { n: 5, us: null, them: null, ourEvidence: false, theirEvidence: false, verdict: "pending" },
    ],
    ourConfirmed: true,
    theirConfirmed: true,
    briefing: BASE_BRIEFING,
    note: "3–1. Sealed in four.",
  },
  {
    id: "btl-115",
    org: "unit7",
    game: "cod",
    format: "Best of 3",
    bestOf: 3,
    stage: "archived",
    scheduled: "Last month",
    lobby: { host: "Unit 7", name: "U7-BRK-115", key: "6631", region: "EU-West" },
    games: [
      { n: 1, us: "LOSS", them: "WIN", map: "Sub Base", ourEvidence: true, theirEvidence: true, verdict: "verified" },
      { n: 2, us: "WIN", them: "LOSS", map: "Karachi", ourEvidence: true, theirEvidence: true, verdict: "verified" },
      { n: 3, us: "LOSS", them: "WIN", map: "Derail", ourEvidence: true, theirEvidence: true, verdict: "verified" },
    ],
    ourConfirmed: true,
    theirConfirmed: true,
    briefing: BASE_BRIEFING,
    note: "1–2. Decider went to the wire.",
  },
];

export function battleById(id: string): Battle | null {
  return BATTLES.find((b) => b.id === id) ?? null;
}

export function series(b: Battle): { us: number; them: number } {
  return {
    us: b.games.filter((g) => g.us === "WIN").length,
    them: b.games.filter((g) => g.them === "WIN").length,
  };
}

/** Battle room chat. Replaced by the same comments machinery as an Operation. */
export type BattleMessage = {
  at: string;
  from: string;
  side: "us" | "them" | "system";
  text: string;
};

export const BATTLE_CHAT: BattleMessage[] = [
  { at: "20:18", from: "SYSTEM", side: "system", text: "BATTLE ROOM OPEN — BRK-SHD-118" },
  { at: "20:21", from: "Griff", side: "them", text: "Lobby's up. Same names as last time?" },
  { at: "20:22", from: "Rosco", side: "us", text: "Five out, two on the bench. Terminal first." },
  { at: "20:24", from: "SYSTEM", side: "system", text: "ROLL CALL COMPLETE — 5 PRESENT / 2 RESERVE" },
  { at: "20:31", from: "SYSTEM", side: "system", text: "BARRACKS LINK ONLINE — CAPTURE ARMED" },
  { at: "21:03", from: "Griff", side: "them", text: "Game 3 was ours and you know it." },
  { at: "21:04", from: "Rosco", side: "us", text: "Upload your scorecard then." },
  { at: "21:04", from: "SYSTEM", side: "system", text: "GAME 3 — AWAITING THE SHED EVIDENCE" },
];

/** Cross-Barracks system events — the network's own activity feed. */
export const NETWORK_FEED: { at: string; text: string; tone: "live" | "warn" | "alert" | "info" }[] = [
  { at: "21:04", text: "GAME 3 EVIDENCE OUTSTANDING — THE SHED", tone: "warn" },
  { at: "20:52", text: "GAME 2 VERIFIED — SCORECARDS MATCH", tone: "live" },
  { at: "20:31", text: "BATTLE 118 WENT LIVE — THE SHED", tone: "live" },
  { at: "18:40", text: "CHALLENGE RECEIVED — THE BOOT ROOM", tone: "alert" },
  { at: "14:12", text: "SLOT PROPOSED — UNIT 7 · SUN 19:00", tone: "info" },
  { at: "11:30", text: "BATTLE 116 AWAITING OLD SCHOOL CAPTAIN", tone: "warn" },
  { at: "09:02", text: "LEAGUE TABLE UPDATED — DIVISION 1", tone: "info" },
];

export type RivalMeeting = {
  when: string;
  format: string;
  score: string;
  result: "W" | "L";
  note: string;
};

export type Rivalry = {
  org: string;
  meetings: number;
  us: number;
  them: number;
  streak: string;
  biggest: string;
  last: string;
  next: string | null;
  since?: string;
  history?: RivalMeeting[];
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
    since: "Nov 2024",
    history: [
      { when: "3 weeks ago", format: "Best of 5", score: "3–1", result: "W", note: "Sealed in four." },
      { when: "May", format: "Best of 5", score: "3–2", result: "W", note: "Decider on Rust." },
      { when: "Mar", format: "Best of 5", score: "5–0", result: "W", note: "The whitewash. Still mentioned." },
      { when: "Feb", format: "Best of 3", score: "1–2", result: "L", note: "Two men short." },
      { when: "Jan", format: "Best of 3", score: "0–2", result: "L", note: "Comprehensive. Move on." },
    ],
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
    since: "Jan 2026",
    history: [
      { when: "Last month", format: "Best of 3", score: "1–2", result: "L", note: "Decider went to the wire." },
      { when: "Apr", format: "Best of 3", score: "0–2", result: "L", note: "Never got going." },
      { when: "Feb", format: "Best of 3", score: "1–2", result: "L", note: "Host advantage, allegedly." },
      { when: "Jan", format: "Best of 5", score: "3–2", result: "W", note: "Our only one so far." },
    ],
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
    since: "Dec 2025",
    history: [
      { when: "2 months ago", format: "Best of 3", score: "2–1", result: "W", note: "Won it on penalties." },
      { when: "Feb", format: "Best of 3", score: "0–2", result: "L", note: "Outplayed, plainly." },
    ],
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
  form: ("W" | "L")[];
  us?: boolean;
};

export type LeagueTable = {
  id: string;
  name: string;
  game: string;
  season: string;
  state: "live" | "complete";
  rounds: number;
  played: number;
  champion?: { org: string; name: string; season: string; note: string };
  next?: { org: string; when: string } | null;
  rows: LeagueRow[];
};

export const LEAGUE: { name: string; season: string; rows: LeagueRow[] } = {
  name: "Barracks COD League",
  season: "2026 · Division 1",
  rows: [
    { org: "self", name: "The Barracks", p: 8, w: 7, l: 1, diff: 14, pts: 21, us: true, form: ["W", "W", "L", "W", "W"] },
    { org: "shed", name: "The Shed", p: 8, w: 6, l: 2, diff: 9, pts: 18, form: ["W", "W", "W", "L", "W"] },
    { org: "boot-room", name: "The Boot Room", p: 8, w: 5, l: 3, diff: 4, pts: 15, form: ["L", "W", "W", "W", "L"] },
    { org: "unit7", name: "Unit 7", p: 8, w: 4, l: 4, diff: -1, pts: 12, form: ["W", "L", "W", "L", "L"] },
    { org: "nightshift", name: "Night Shift", p: 8, w: 2, l: 6, diff: -8, pts: 6, form: ["L", "L", "W", "L", "L"] },
    { org: "old-school", name: "Old School", p: 8, w: 0, l: 8, diff: -18, pts: 0, form: ["L", "L", "L", "L", "L"] },
  ],
};

/** Every table the Barracks is entered in. Squads are ranked — never players. */
export const LEAGUES: LeagueTable[] = [
  {
    id: "cod-d1",
    name: LEAGUE.name,
    game: "cod",
    season: LEAGUE.season,
    state: "live",
    rounds: 10,
    played: 8,
    next: { org: "shed", when: "Friday · 20:30" },
    rows: LEAGUE.rows,
  },
  {
    id: "fifa-open",
    name: "Barracks FIFA League",
    game: "fifa",
    season: "2026 · Open Division",
    state: "complete",
    rounds: 6,
    played: 6,
    champion: {
      org: "self",
      name: "The Barracks",
      season: "2026",
      note: "Won with a round to spare. Unbeaten at home.",
    },
    next: null,
    rows: [
      { org: "self", name: "The Barracks", p: 6, w: 5, l: 1, diff: 8, pts: 15, us: true, form: ["W", "W", "W", "L", "W"] },
      { org: "boot-room", name: "The Boot Room", p: 6, w: 4, l: 2, diff: 5, pts: 12, form: ["W", "L", "W", "W", "L"] },
      { org: "dockyard", name: "The Dockyard", p: 6, w: 3, l: 3, diff: 0, pts: 9, form: ["L", "W", "L", "W", "W"] },
      { org: "sunday-league", name: "Sunday League", p: 6, w: 0, l: 6, diff: -13, pts: 0, form: ["L", "L", "L", "L", "L"] },
    ],
  },
];

/** The honours board. Barracks-level titles only. */
export const LEAGUE_HONOURS: { season: string; league: string; org: string; name: string; note: string }[] = [
  { season: "2026", league: "Barracks FIFA League", org: "self", name: "The Barracks", note: "Won with a round to spare" },
  { season: "2025", league: "Barracks COD League", org: "shed", name: "The Shed", note: "Won on game difference" },
  { season: "2024", league: "Barracks COD League", org: "boot-room", name: "The Boot Room", note: "Unbeaten season" },
];
