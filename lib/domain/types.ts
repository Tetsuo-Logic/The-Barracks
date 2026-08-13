// Domain types — mirror the Supabase schema (§3). Hand-maintained; if the
// schema grows large, swap for `supabase gen types typescript`.

export type CompetitionFormat = "stroke" | "skins" | "stableford";
export type CompetitionStatus = "upcoming" | "played" | "cancelled";
export type RsvpStatus = "in" | "out" | "maybe";

export interface Profile {
  id: string;
  name: string;
  nickname: string | null; // scorecard grid, max 4 chars
  avatar_url: string | null;
  handicap: number | null;
  home_course: string | null;
  colour: string; // their ink colour across the app
  is_admin: boolean; // the organiser can add/edit/cancel dates
  is_president: boolean; // a nameable title; rules on board complaints
  inbox_seen_at: string | null; // last time they opened the notification inbox
  created_at: string;
}

export type ComplaintStatus = "open" | "addressed";

export interface Complaint {
  id: string;
  filed_by: string | null;
  against_id: string | null; // who the complaint is about
  reason: string;
  action: string | null;
  comment: string | null;
  status: ComplaintStatus;
  ruling: string | null;
  addressed_by: string | null;
  response: string | null; // the subject's reply
  response_at: string | null;
  second_opinion_by: string | null; // player asked for a second opinion
  second_opinion: string | null; // their response
  second_opinion_at: string | null;
  second_opinion_to_court: boolean | null; // their steer: take it to court?
  created_at: string;
  addressed_at: string | null;
}

export interface Competition {
  id: string;
  created_by: string | null;
  game: string; // which game — see lib/games.ts; 'threeball' is golf
  title: string | null;
  image_url: string | null; // optional banner for named one-off events
  course: string | null; // golf course; null for non-golf ops
  date: string; // bare 'YYYY-MM-DD'
  tee_time: string | null; // bare 'HH:MM:SS'
  holes: 9 | 18;
  format: CompetitionFormat;
  stake: string | null;
  notes: string | null;
  par: number[] | null;
  stroke_index: number[] | null;
  status: CompetitionStatus;
  cancel_reason: string | null; // why it was cancelled, if it was
  for_cup: boolean; // counts toward the Threeball Cup, vs a casual round
  started_at: string | null; // Operation Room: went live
  finished_at: string | null; // Operation Room: closed / archived
  games_count: number; // Operation Room: games played this session
  squad_id: string | null; // Sq-3: the squad this Operation belongs to (null = whole Barracks)
  confirm_by: string | null; // deadline for carried-over roll call answers — see 0045
  acting_captain_id: string | null; // Sq-3: stand-in Captain for this one event
  created_at: string;
}

export interface Rsvp {
  competition_id: string;
  player_id: string;
  status: RsvpStatus; // intent: were you expected?
  note: string | null;
  attended: boolean | null; // roll call: null = unrolled · true = present · false = no-show
  confirmed_at: string | null; // when they answered themselves; null = carried from a muster
  approved_late: boolean; // a Captain or the President let them back on
  updated_at: string;
}

export interface Score {
  competition_id: string;
  player_id: string;
  strokes: (number | null)[];
  updated_by: string | null;
  updated_at: string;
}

export interface Comment {
  id: string;
  competition_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface Photo {
  id: string;
  competition_id: string;
  uploader_id: string | null;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export type TrialStatus = "open" | "closed";
export type Verdict = "guilty" | "not_guilty";
export type Penalty = "strike" | "warning";

export interface Trial {
  id: string;
  defendant_id: string;
  competition_id: string | null;
  charge: string;
  defence: string | null;
  status: TrialStatus;
  verdict: Verdict | null;
  penalty: Penalty | null; // the outcome when guilty
  jury_opened: boolean; // did the President consult the jury
  note: string | null; // behaviour note / verdict caption
  judge_id: string | null; // mutiny cases: rules in the President's place (0042)
  created_by: string | null;
  created_at: string;
}

export type MutinyStatus = "voting" | "carried" | "failed";

// A motion against the sitting President. The target can't see it while the
// ranks vote (enforced by RLS, 0042); on failure they're told who raised it.
export interface Mutiny {
  id: string;
  group_id: string;
  raised_by: string | null;
  target_id: string | null;
  reason: string;
  status: MutinyStatus;
  agree_count: number;
  against_count: number;
  eligible_count: number;
  judge_id: string | null; // named on success; rules in the President's place
  trial_id: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface PlayerNote {
  id: string;
  player_id: string;
  note: string;
  trial_id: string | null;
  created_by: string | null;
  created_at: string;
}

// Universal result — one row per entrant per event, for every game (0031).
// Only ever attached to a real competition, so official rankings come only from
// recognised Barracks fixtures.
export interface Result {
  competition_id: string;
  player_id: string;
  score: number | null;
  placement: number | null;
  points: number | null;
  metrics: Record<string, unknown> | null;
  confirmed: boolean;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

// A game-specific squad within a Barracks — one game per squad, hard-locked.
export interface Squad {
  id: string;
  group_id: string;
  game: string; // the squad's fixed identity (a game id from lib/games)
  name: string | null; // optional custom name; display falls back to the game
  clan_tag: string | null; // e.g. [TAG] — editable by Captain or CO
  created_at: string;
}

export interface SquadMember {
  squad_id: string;
  user_id: string;
  is_captain: boolean;
  created_at: string;
}

export type MusterStatus = "open" | "proposed" | "approved" | "cancelled";

// The Captain's pre-week arrangement: candidate nights the squad votes on, then
// a chosen night proposed up to the President to deploy.
export interface Muster {
  id: string;
  squad_id: string;
  group_id: string;
  game: string;
  created_by: string | null;
  status: MusterStatus;
  dates: string[]; // candidate nights, 'YYYY-MM-DD'
  times: string[]; // legacy proposed start times, 'HH:MM' (superseded by window)
  window_from: string | null; // kick-off window start, 'HH:MM'
  window_to: string | null; // kick-off window end, 'HH:MM'
  note: string | null;
  chosen_date: string | null; // set when the Captain proposes
  chosen_time: string | null;
  competition_id: string | null; // set on approval
  created_at: string;
}

export interface MusterResponse {
  muster_id: string;
  user_id: string;
  available_dates: string[];
  from_times: string[]; // per-night start, index-aligned with available_dates
  to_times: string[]; // per-night end, index-aligned with available_dates
  updated_at: string;
}

// A squad member's nudge to their Captain to sort a night (pre-Muster).
export interface SquadNightRequest {
  id: string;
  squad_id: string;
  group_id: string;
  requested_by: string | null;
  note: string | null;
  created_at: string;
}

export type SquadRequestStatus = "open" | "approved" | "declined";

export interface SquadRequest {
  id: string;
  group_id: string;
  game: string;
  name: string | null;
  clan_tag: string | null;
  requested_by: string | null;
  status: SquadRequestStatus;
  created_at: string;
}

export interface TrialVote {
  trial_id: string;
  juror_id: string;
  vote: Verdict;
  penalty: Penalty | null; // this juror's steer when voting guilty
  comment: string | null;
  created_at: string;
}

export interface Strike {
  id: string;
  player_id: string;
  reason: string | null;
  competition_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Warning {
  id: string;
  player_id: string;
  reason: string | null;
  trial_id: string | null;
  created_by: string | null;
  created_at: string;
}

export type GameRequestStatus = "open" | "planning" | "done" | "declined";

export interface GameRequest {
  id: string;
  requested_by: string | null;
  game: string; // a game id from lib/games.ts
  note: string | null;
  available_from: string | null; // 'YYYY-MM-DD' — when they're free from
  available_to: string | null; // 'YYYY-MM-DD' — …to
  min_players: number | null;
  max_players: number | null;
  status: GameRequestStatus;
  created_at: string;
}

export interface RadarGame {
  id: string;
  title: string;
  note: string | null;
  release_date: string | null; // 'YYYY-MM-DD'
  youtube_url: string | null; // optional trailer link
  platform: string | null; // PC / PlayStation / Xbox / VR
  added_by: string | null;
  created_at: string;
}

export interface RadarInterest {
  radar_id: string;
  player_id: string;
  interested: boolean;
  updated_at: string;
}

// Comms transmission types. 'dates' is legacy — availability polls belong to
// Planning now — but the rows are real history, so they still render.
export type BroadcastKind = "announce" | "yesno" | "ask" | "dates" | "poll";

export interface Broadcast {
  id: string;
  created_by: string | null;
  kind: BroadcastKind;
  title: string | null;
  body: string;
  option_dates: string[] | null; // candidate dates for a legacy 'dates' poll
  options: string[] | null; // choices for a 'poll' — see 0043_comms_polls
  created_at: string;
}

export interface BroadcastMessage {
  id: string;
  broadcast_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface BroadcastResponse {
  broadcast_id: string;
  player_id: string;
  answer: "yes" | "no" | null;
  comment: string | null;
  available_dates: string[] | null; // which candidate dates this player can do
  date_times: string[] | null; // tee time that suits them per date, index-aligned with available_dates ('' = none)
  choice: string | null; // the option picked, for a 'poll'
  created_at: string;
}

export interface NotificationPrefs {
  player_id: string;
  new_comp: boolean;
  rsvp_changes: boolean;
  comments: boolean;
  results: boolean;
  day_of: boolean;
  chase_undecided: boolean;
  board: boolean;
}
