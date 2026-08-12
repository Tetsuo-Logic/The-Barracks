// FUTURE / PROTOTYPE — see ./README.md. No database access in this file.
// Presence, voice, Discord, Barracks Link, modules, commendations, elections
// and the Dispatch. Each is shaped like the real query we'd eventually write.

// ── Presence ───────────────────────────────────────────────────────────────
// Replaced by a Supabase Realtime presence channel.
export type PresenceState = "ready" | "deployed" | "online" | "away" | "offline";

export const PRESENCE_TONE: Record<PresenceState, "live" | "warn" | "info" | "idle" | "alert"> = {
  ready: "live",
  deployed: "warn",
  online: "info",
  away: "idle",
  offline: "idle",
};

/** Deterministic so the UI doesn't flicker between renders. */
export function presenceFor(id: string, i: number): PresenceState {
  const order: PresenceState[] = ["ready", "online", "deployed", "away", "online", "offline"];
  return order[(id.charCodeAt(0) + i) % order.length];
}

// ── Voice ──────────────────────────────────────────────────────────────────
// Replaced by WebRTC/SFU, or a Discord voice bridge.
export type VoiceMember = { name: string; speaking: boolean; muted: boolean; deafened: boolean };

export const VOICE: { channel: string; members: VoiceMember[] } = {
  channel: "COD // DEPLOYMENT",
  members: [
    { name: "Rosco", speaking: true, muted: false, deafened: false },
    { name: "Steve", speaking: false, muted: false, deafened: false },
    { name: "Dave", speaking: false, muted: true, deafened: false },
    { name: "Matt", speaking: false, muted: false, deafened: true },
  ],
};

// ── Discord ────────────────────────────────────────────────────────────────
export type DiscordChannel = { name: string; kind: "text" | "voice"; create: boolean };
export type DiscordCategory = { name: string; channels: DiscordChannel[] };

export const DISCORD = {
  connected: true,
  guild: "The Barracks",
  members: 11,
  linked: 7,
  events: [
    { key: "operation_created", label: "Operation created", channel: "#operations", on: true },
    { key: "battle_confirmed", label: "Battle confirmed", channel: "#operations", on: true },
    { key: "radar_added", label: "Radar contact added", channel: "#radar", on: true },
    { key: "release_alert", label: "Release alert", channel: "#radar", on: true },
    { key: "court_summons", label: "Court summons", channel: "#court-notices", on: true },
    { key: "result", label: "Result posted", channel: "#operations", on: false },
    { key: "dispatch", label: "Weekly Dispatch", channel: "#announcements", on: true },
  ],
  roleMap: [
    { barracks: "President", discord: "Command", colour: "var(--color-sand)" },
    { barracks: "Squad Captain", discord: "Captain", colour: "var(--color-moss)" },
    { barracks: "Operative", discord: "Operative", colour: "var(--color-ink-soft)" },
  ],
};

/** The generated server structure, seeded from the Barracks' real squads. */
export function discordTemplate(squads: { name: string; game: string }[]): DiscordCategory[] {
  const base: DiscordCategory[] = [
    {
      name: "COMMAND",
      channels: [
        { name: "announcements", kind: "text", create: true },
        { name: "radar", kind: "text", create: true },
        { name: "calendar", kind: "text", create: true },
        { name: "dispatch", kind: "text", create: true },
      ],
    },
  ];

  const perGame: Record<string, DiscordChannel[]> = {
    fifa: [
      { name: "squad-comms", kind: "text", create: true },
      { name: "fixtures", kind: "text", create: true },
      { name: "dressing-room", kind: "voice", create: true },
    ],
    f1: [
      { name: "race-control", kind: "text", create: true },
      { name: "championship", kind: "text", create: true },
      { name: "paddock", kind: "voice", create: true },
    ],
    threeball: [
      { name: "clubhouse", kind: "text", create: true },
      { name: "scorecards", kind: "text", create: true },
      { name: "halfway-hut", kind: "voice", create: true },
    ],
  };

  for (const s of squads) {
    base.push({
      name: `${s.name.toUpperCase()} SQUAD`,
      channels:
        perGame[s.game] ?? [
          { name: "squad-comms", kind: "text", create: true },
          { name: "operations", kind: "text", create: true },
          { name: "voice-deployment", kind: "voice", create: true },
        ],
    });
  }

  base.push({
    name: "COURT",
    channels: [{ name: "court-notices", kind: "text", create: true }],
  });
  return base;
}

// ── Barracks Link ──────────────────────────────────────────────────────────
// Replaced by a small desktop companion (process + OBS detection, evidence upload).
export const LINK = {
  online: true,
  version: "0.3.2-beta",
  host: "ROSCO-PC",
  obs: true,
  detected: "Call of Duty",
  captureActive: true,
  battleLinked: true,
  log: [
    { t: "20:31:04", m: "BARRACKS LINK ONLINE", tone: "live" as const },
    { t: "20:31:06", m: "OBS WEBSOCKET CONNECTED", tone: "live" as const },
    { t: "20:32:41", m: "PROCESS MATCH — CALL OF DUTY", tone: "info" as const },
    { t: "20:32:41", m: "GAME CAPTURE ACTIVE", tone: "live" as const },
    { t: "20:44:12", m: "GAME START DETECTED", tone: "info" as const },
    { t: "21:02:58", m: "RESULT SCREEN DETECTED", tone: "warn" as const },
    { t: "21:02:59", m: "EVIDENCE CAPTURED → BATTLE 118 / GAME 3", tone: "live" as const },
  ],
};

export const ADAPTERS = [
  { game: "Call of Duty", detect: "Auto result detection", state: "Supported" as const },
  { game: "EA Sports FC", detect: "Full-time detection", state: "Beta" as const },
  { game: "F1", detect: "Classification detection", state: "Beta" as const },
  { game: "Golf", detect: "Scorecard OCR", state: "Beta" as const },
  { game: "Generic", detect: "Manual / screen capture", state: "Fallback" as const },
];

export const CAPTURE_MODES = ["Manual", "Barracks Link", "OBS", "Stream integration", "Auto capture (beta)"];

// ── Modules ────────────────────────────────────────────────────────────────
export type ModuleDef = {
  key: string;
  name: string;
  blurb: string;
  on: boolean;
  live: boolean; // true = actually built in the platform today
};

export const MODULES: ModuleDef[] = [
  { key: "court", name: "Court", blurb: "Complaints, tribunals, mutinies, strikes.", on: true, live: true },
  { key: "radar", name: "Radar", blurb: "Upcoming releases and group interest.", on: true, live: true },
  { key: "squads", name: "Squads", blurb: "Game-specific squads with captains.", on: true, live: true },
  { key: "musters", name: "Musters", blurb: "Pre-week availability gathering.", on: true, live: true },
  { key: "archives", name: "Archives", blurb: "Permanent record of every operation.", on: true, live: true },
  { key: "elections", name: "Elections", blurb: "Secret ballot for the presidency.", on: false, live: false },
  { key: "commendations", name: "Commendations", blurb: "Medals, honours and disgraces.", on: true, live: false },
  { key: "battles", name: "Battles", blurb: "Clan vs clan across Barracks.", on: true, live: false },
  { key: "leagues", name: "Leagues", blurb: "Structured seasons and tables.", on: false, live: false },
  { key: "voice", name: "Voice", blurb: "Native voice inside Operation Rooms.", on: true, live: false },
  { key: "streaming", name: "Streaming", blurb: "Watch a room you're not playing in.", on: false, live: false },
  { key: "discord", name: "Discord", blurb: "Mirror Barracks events to a server.", on: true, live: false },
  { key: "race", name: "Race Control", blurb: "Motorsport timing tower for F1 squads.", on: true, live: false },
  { key: "match", name: "Match Command", blurb: "Team sheets and formations for football.", on: true, live: false },
  { key: "capture", name: "AI Capture", blurb: "Automatic result evidence.", on: false, live: false },
];

// ── System personality ─────────────────────────────────────────────────────
export type Personality = "command" | "dry" | "broadcast" | "savage";

export const PERSONALITIES: { key: Personality; name: string; sample: string }[] = [
  { key: "command", name: "Military command", sample: "DAVE HAS WITHDRAWN FROM THE OPERATION. 47 MINUTES' NOTICE." },
  { key: "dry", name: "Dry", sample: "Dave cancelled. 47 minutes before kick-off." },
  { key: "broadcast", name: "Sports broadcast", sample: "And Dave pulls out LATE — 47 minutes on the clock. Costly." },
  { key: "savage", name: "Savage", sample: "DAVE HAS ABANDONED HIS POST WITH 47 MINUTES' NOTICE. AGAIN." },
];

// ── Commendations ──────────────────────────────────────────────────────────
export type Medal = {
  key: string;
  name: string;
  blurb: string;
  tone: "sand" | "moss" | "flag";
  holders: string[];
};

export const MEDALS: Medal[] = [
  { key: "threeball", name: "Order of the Threeball", blurb: "For services to the original game.", tone: "sand", holders: ["Rosco", "Steve"] },
  { key: "reliable", name: "Reliable Bastard", blurb: "Never once missed a roll call.", tone: "moss", holders: ["Steve"] },
  { key: "veteran", name: "Veteran", blurb: "Fifty operations deployed.", tone: "sand", holders: ["Rosco"] },
  { key: "mvp", name: "Battle MVP", blurb: "Carried the lads when it counted.", tone: "moss", holders: ["Dave"] },
  { key: "warcrim", name: "War Criminal", blurb: "Found guilty in the Courtroom.", tone: "flag", holders: ["Matt"] },
  { key: "ghost", name: "The Ghost", blurb: "Said in. Was not in.", tone: "flag", holders: ["Matt"] },
];

// ── Elections ──────────────────────────────────────────────────────────────
export const ELECTION = {
  status: "closed" as "open" | "closed" | "none",
  opened: "12 Jul",
  closed: "19 Jul",
  turnout: 7,
  eligible: 7,
  candidates: [
    { name: "Rosco", votes: 5, incumbent: true },
    { name: "Steve", votes: 2, incumbent: false },
  ],
  outcome: "ROSCO RETAINS COMMAND",
  history: [
    { term: "2026", president: "Rosco", note: "Retained · 5–2" },
    { term: "2025", president: "Rosco", note: "Elected unopposed" },
    { term: "2024", president: "Steve", note: "Elected · 4–3" },
  ],
};

// ── Dispatch ───────────────────────────────────────────────────────────────
export type DispatchSection = { heading: string; lines: string[] };

export function dispatch(input: {
  operations: number;
  hours: number;
  upcoming: string[];
  radar: string[];
  court: string[];
  squads: string[];
}): DispatchSection[] {
  return [
    {
      heading: "Operations completed",
      lines: [
        `${input.operations} operations run this week.`,
        `${input.hours} hours deployed across the Barracks.`,
      ],
    },
    { heading: "On the board", lines: input.upcoming.length ? input.upcoming : ["Nothing scheduled — a quiet week."] },
    { heading: "Radar", lines: input.radar.length ? input.radar : ["No new contacts."] },
    { heading: "Squad activity", lines: input.squads.length ? input.squads : ["No squad movement."] },
    { heading: "The Court", lines: input.court.length ? input.court : ["No cases. A peaceful reign."] },
  ];
}
