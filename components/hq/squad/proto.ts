// FUTURE / PROTOTYPE — presentation data for the squad dossier's game panels.
//
// No database access in this file. Battle records, formations, lap times,
// tyre compounds, loadouts and map rotations have no schema yet, so they're
// derived here from real ids and real member names. Every consumer marks the
// panel with <Proto /> so the boundary is visible in the interface too.
//
// Everything is deterministic: the same squad always renders the same numbers,
// so nothing flickers between renders or between server and client.

// ── Deterministic noise ────────────────────────────────────────────────────

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small, fast, seeded PRNG — stable output for a given seed string. */
export function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(arr: readonly T[], r: number): T => arr[Math.floor(r * arr.length) % arr.length];

/** A member's short call sign for grids and timing towers. */
export function callsign(name: string, nickname?: string | null): string {
  const raw = (nickname?.trim() || name.trim() || "—").split(/\s+/)[0];
  return raw.toUpperCase().slice(0, 8);
}

// ── Squad battle record (prototype) ────────────────────────────────────────

export type SquadRecord = {
  played: number;
  won: number;
  lost: number;
  pct: number;
  form: ("W" | "L")[];
  streak: string;
};

export function squadRecord(squadId: string): SquadRecord {
  const r = rng(`record:${squadId}`);
  const played = 6 + Math.floor(r() * 34);
  const won = Math.max(0, Math.min(played, Math.round(played * (0.32 + r() * 0.45))));
  const lost = played - won;
  const form: ("W" | "L")[] = Array.from({ length: 5 }, () => (r() > 0.42 ? "W" : "L"));
  let n = 1;
  while (n < form.length && form[n] === form[0]) n++;
  return {
    played,
    won,
    lost,
    pct: played ? Math.round((won / played) * 100) : 0,
    form,
    streak: `${form[0]}${n}`,
  };
}

// ── Football — 4-2-3-1 (prototype) ─────────────────────────────────────────

export type Slot = { code: string; role: string; x: number; y: number };

/** Percentage coordinates on the pitch. y=100 is our goal line, y=0 theirs. */
export const FORMATION_4231: { name: string; slots: Slot[] } = {
  name: "4-2-3-1",
  slots: [
    { code: "GK", role: "Goalkeeper", x: 50, y: 92 },
    { code: "LB", role: "Left back", x: 15, y: 74 },
    { code: "CB", role: "Centre back", x: 37, y: 79 },
    { code: "CB", role: "Centre back", x: 63, y: 79 },
    { code: "RB", role: "Right back", x: 85, y: 74 },
    { code: "CDM", role: "Holding mid", x: 36, y: 57 },
    { code: "CDM", role: "Holding mid", x: 64, y: 57 },
    { code: "LW", role: "Left wing", x: 15, y: 36 },
    { code: "CAM", role: "Attacking mid", x: 50, y: 40 },
    { code: "RW", role: "Right wing", x: 85, y: 36 },
    { code: "ST", role: "Striker", x: 50, y: 17 },
  ],
};

export const TACTICS = [
  { k: "Shape", v: "4-2-3-1 · narrow" },
  { k: "Mentality", v: "Balanced" },
  { k: "Press", v: "High · trigger on back pass" },
  { k: "Build-up", v: "Short from the keeper" },
  { k: "Width", v: "Wingers hold the touchline" },
  { k: "Set pieces", v: "Near post, second ball" },
] as const;

// ── Racing — timing tower, circuits, championship (prototype) ──────────────

export type TimingRow = {
  pos: number;
  driver: string;
  gap: string;
  interval: string;
  last: string;
  best: string;
  bestMs: number;
  tyre: "S" | "M" | "H" | "I";
  age: number;
  stops: number;
  drs: boolean;
  sectors: ("purple" | "green" | "yellow")[];
  fastest: boolean;
};

const lapTime = (ms: number) => {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const t = Math.round(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(t).padStart(3, "0")}`;
};

export const formatLap = lapTime;

export function timingTower(seed: string, drivers: string[]): TimingRow[] {
  const r = rng(`timing:${seed}`);
  const base = 89_000 + Math.floor(r() * 8_000); // ~1:29 – 1:37
  let gap = 0;
  const rows: TimingRow[] = drivers.map((driver, i) => {
    const interval = i === 0 ? 0 : 0.18 + r() * 3.4;
    gap += interval;
    const bestMs = base + Math.round(r() * 900) + i * 40;
    return {
      pos: i + 1,
      driver,
      gap: i === 0 ? "LEADER" : `+${gap.toFixed(3)}`,
      interval: i === 0 ? "—" : `+${interval.toFixed(3)}`,
      last: lapTime(bestMs + Math.round(r() * 1400)),
      best: lapTime(bestMs),
      bestMs,
      tyre: pick(["S", "M", "H", "I"] as const, r()),
      age: 1 + Math.floor(r() * 24),
      stops: Math.floor(r() * 3),
      drs: i > 0 && gap < 1.0,
      sectors: Array.from({ length: 3 }, () =>
        pick(["purple", "green", "yellow"] as const, r()),
      ),
      fastest: false,
    };
  });
  // Exactly one purple fastest lap, and it owns all three of its sectors.
  let quickest = 0;
  rows.forEach((row, i) => {
    if (row.bestMs < rows[quickest].bestMs) quickest = i;
  });
  if (rows[quickest]) {
    rows[quickest].fastest = true;
    rows[quickest].sectors = ["purple", "purple", "purple"];
  }
  return rows;
}

export type Circuit = {
  name: string;
  country: string;
  laps: number;
  lengthKm: number;
  corners: number;
  drs: number;
  record: string;
  recordBy: string;
  /** Closed loop drawn in a 0 0 200 120 viewBox. */
  path: string;
  /** Start/finish tick — [x1,y1,x2,y2]. */
  line: [number, number, number, number];
  markers: { s: string; x: number; y: number }[];
};

export const CIRCUITS: Circuit[] = [
  {
    name: "Silverstone",
    country: "GBR",
    laps: 52,
    lengthKm: 5.891,
    corners: 18,
    drs: 2,
    record: "1:27.097",
    recordBy: "Prototype",
    path:
      "M22,84 C18,52 40,30 76,28 C110,26 132,40 158,34 C182,29 190,50 176,62 C160,76 128,68 112,80 C96,92 96,106 70,106 C42,106 26,104 22,84 Z",
    line: [26, 96, 26, 74],
    markers: [
      { s: "S1", x: 74, y: 22 },
      { s: "S2", x: 184, y: 56 },
      { s: "S3", x: 86, y: 112 },
    ],
  },
  {
    name: "Spa-Francorchamps",
    country: "BEL",
    laps: 44,
    lengthKm: 7.004,
    corners: 19,
    drs: 2,
    record: "1:46.286",
    recordBy: "Prototype",
    path:
      "M28,102 L30,44 C31,24 52,14 72,24 L118,46 C142,58 174,46 182,64 C190,84 152,96 118,90 L58,78 C40,74 27,86 28,102 Z",
    line: [22, 96, 38, 96],
    markers: [
      { s: "S1", x: 60, y: 16 },
      { s: "S2", x: 188, y: 60 },
      { s: "S3", x: 44, y: 110 },
    ],
  },
  {
    name: "Monza",
    country: "ITA",
    laps: 53,
    lengthKm: 5.793,
    corners: 11,
    drs: 3,
    record: "1:21.046",
    recordBy: "Prototype",
    path:
      "M26,104 L64,26 C68,16 84,16 88,28 L112,94 C117,106 134,106 140,94 L170,38 C177,24 162,12 152,22 L44,110 C36,116 22,112 26,104 Z",
    line: [30, 110, 44, 100],
    markers: [
      { s: "S1", x: 78, y: 12 },
      { s: "S2", x: 128, y: 110 },
      { s: "S3", x: 178, y: 30 },
    ],
  },
  {
    name: "Suzuka",
    country: "JPN",
    laps: 53,
    lengthKm: 5.807,
    corners: 18,
    drs: 1,
    record: "1:30.983",
    recordBy: "Prototype",
    path:
      "M24,90 C20,58 46,34 78,38 C104,41 116,60 138,58 C164,56 176,34 184,48 C192,64 168,76 142,80 C114,84 100,98 74,104 C44,110 27,108 24,90 Z",
    line: [24, 100, 24, 80],
    markers: [
      { s: "S1", x: 76, y: 30 },
      { s: "S2", x: 190, y: 44 },
      { s: "S3", x: 92, y: 110 },
    ],
  },
];

export function circuitFor(seed: string): Circuit {
  return CIRCUITS[hash(`circuit:${seed}`) % CIRCUITS.length];
}

export const TYRE_LABEL: Record<TimingRow["tyre"], string> = {
  S: "Soft",
  M: "Medium",
  H: "Hard",
  I: "Inter",
};

export type StandingRow = { driver: string; pts: number; wins: number; podiums: number };

export function championship(seed: string, drivers: string[]): StandingRow[] {
  const r = rng(`champ:${seed}`);
  return drivers
    .map((driver) => ({
      driver,
      pts: 18 + Math.floor(r() * 210),
      wins: Math.floor(r() * 6),
      podiums: Math.floor(r() * 11),
    }))
    .sort((a, b) => b.pts - a.pts);
}

export const RACE_CONTROL_LOG = [
  { t: "14:02:11", m: "TRACK LIMITS — TURN 9 UNDER REVIEW", tone: "warn" as const },
  { t: "14:06:48", m: "DRS ENABLED", tone: "live" as const },
  { t: "14:14:02", m: "CAR 4 — 5 SECOND PENALTY, UNSAFE RELEASE", tone: "alert" as const },
  { t: "14:21:37", m: "YELLOW FLAG SECTOR 2 — CLEARED", tone: "warn" as const },
  { t: "14:29:15", m: "FASTEST LAP OF THE RACE", tone: "live" as const },
];

// ── Shooter — briefing, loadouts, map rotation (prototype) ─────────────────

export const ROLES = [
  { role: "Assault", brief: "First through the door. Holds the centre." },
  { role: "Support", brief: "Ammo, smoke and the long hold." },
  { role: "Recon", brief: "Eyes up. Calls the flank before it lands." },
  { role: "Breacher", brief: "Doors, walls and objectives." },
  { role: "Marksman", brief: "Overwatch on the long lane." },
  { role: "Engineer", brief: "Kills armour, denies the spawn." },
] as const;

const PRIMARIES = ["M4 CARBINE", "MP5-K", "AK-74", "SCAR-H", "MCX SPEAR", "VECTOR .45"];
const SECONDARIES = ["X12 SIDEARM", ".50 GS", "RENETTI", "COMBAT KNIFE"];
const PERKS = ["Double Time", "Fast Hands", "Ghost", "Overkill", "Tempered", "Scavenger"];

export type Loadout = { role: string; brief: string; primary: string; secondary: string; perk: string };

export function loadoutFor(seed: string, i: number): Loadout {
  const r = rng(`loadout:${seed}:${i}`);
  const base = ROLES[i % ROLES.length];
  return {
    role: base.role,
    brief: base.brief,
    primary: pick(PRIMARIES, r()),
    secondary: pick(SECONDARIES, r()),
    perk: pick(PERKS, r()),
  };
}

export type MapSlot = { map: string; mode: string; state: "played" | "live" | "queued" };

const MAPS = ["TERMINAL", "RUST", "HIGHRISE", "SKIDROW", "SHIPMENT", "CROSSFIRE", "SCRAPYARD", "FAVELA"];
const MODES = ["Hardpoint", "Search & Destroy", "Domination", "Control", "Team Deathmatch"];

export function mapRotation(seed: string): MapSlot[] {
  const r = rng(`maps:${seed}`);
  const used = new Set<string>();
  const out: MapSlot[] = [];
  for (let i = 0; i < 5; i++) {
    let map = pick(MAPS, r());
    let guard = 0;
    while (used.has(map) && guard++ < 12) map = pick(MAPS, r());
    used.add(map);
    out.push({
      map,
      mode: pick(MODES, r()),
      state: i < 2 ? "played" : i === 2 ? "live" : "queued",
    });
  }
  return out;
}

export const OBJECTIVES = [
  "Hold the hardpoint through the second rotation.",
  "No solo pushes — pairs on every lane.",
  "Call the flank before you take the fight.",
  "Bank the first two rounds. Don't chase the highlight.",
] as const;

/** Operation names for the briefing header — proto until battles are real. */
const OPERATIONS = [
  "IRON CURTAIN",
  "NIGHT PORTER",
  "BLACK ARROW",
  "COLD HARBOUR",
  "SILENT ANVIL",
  "RED LANTERN",
];

export function operationName(seed: string): string {
  return OPERATIONS[hash(`op:${seed}`) % OPERATIONS.length];
}

// ── Golf — a prototype scorecard when no real round exists ─────────────────

export function protoPar(holes: number): number[] {
  const shape = [4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4];
  return Array.from({ length: holes }, (_, i) => shape[i % shape.length]);
}

export function protoStrokeIndex(holes: number): number[] {
  const shape = [5, 11, 17, 1, 7, 15, 3, 13, 9, 6, 12, 18, 2, 8, 16, 4, 14, 10];
  return Array.from({ length: holes }, (_, i) => shape[i % shape.length]);
}

export function protoStrokes(seed: string, par: number[]): (number | null)[] {
  const r = rng(`strokes:${seed}`);
  return par.map((p) => {
    const v = r();
    const delta = v < 0.06 ? -1 : v < 0.42 ? 0 : v < 0.78 ? 1 : 2;
    return p + delta;
  });
}
