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
  created_at: string;
}

export interface Rsvp {
  competition_id: string;
  player_id: string;
  status: RsvpStatus; // intent: were you expected?
  note: string | null;
  attended: boolean | null; // roll call: null = unrolled · true = present · false = no-show
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
  created_by: string | null;
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

export type BroadcastKind = "announce" | "yesno" | "ask" | "dates";

export interface Broadcast {
  id: string;
  created_by: string | null;
  kind: BroadcastKind;
  title: string | null;
  body: string;
  option_dates: string[] | null; // candidate dates for a 'dates' poll
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
