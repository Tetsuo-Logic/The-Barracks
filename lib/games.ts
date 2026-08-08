// The fixed roster of games The Barracks runs. A tiny config, not a table — the
// list is fixed for now. Only The Threeball Cup keeps the golf machinery
// (scorecard + standings); every other game is just an op with a night, a roll
// call, chat and photos.

export type Game = {
  id: string; // stored in competitions.game
  name: string; // display name
  emoji: string;
  colour: string; // dot / accent in lists and the calendar
  hasScorecard: boolean; // golf-only scoring + cup standings
};

export const GAMES: Game[] = [
  { id: "threeball", name: "The Threeball Cup", emoji: "⛳", colour: "#3B6B3A", hasScorecard: true },
  { id: "cod", name: "COD", emoji: "🎮", colour: "#B4432A", hasScorecard: false },
  { id: "showdown", name: "Showdown", emoji: "🕹️", colour: "#8A6D3B", hasScorecard: false },
  { id: "fifa", name: "FIFA", emoji: "⚽", colour: "#C89B2C", hasScorecard: false },
  { id: "gta", name: "GTA", emoji: "🚗", colour: "#55604F", hasScorecard: false },
];

export const DEFAULT_GAME = "threeball";

const GAME_BY_ID = new Map(GAMES.map((g) => [g.id, g]));

/** Look up a game by id, always returning something (falls back to golf). */
export function gameById(id: string | null | undefined): Game {
  return (id && GAME_BY_ID.get(id)) || GAMES[0];
}

/** Does this game keep a scorecard (i.e. is it the golf cup)? */
export function gameHasScorecard(id: string | null | undefined): boolean {
  return gameById(id).hasScorecard;
}

/** The heading shown for a comp: an explicit title wins; else the course (golf)
 *  or the game name (everything else). */
export function compHeading(comp: {
  title: string | null;
  course: string | null;
  game: string;
}): string {
  const t = comp.title?.trim();
  if (t) return t;
  const g = gameById(comp.game);
  if (g.hasScorecard) return comp.course?.trim() || g.name;
  return g.name;
}

/** The short meta chip on list rows: holes·format for golf, emoji·name otherwise. */
export function compMetaChip(comp: {
  game: string;
  holes: number;
  format: string;
}): string {
  const g = gameById(comp.game);
  if (g.hasScorecard) return `${comp.holes} · ${comp.format.toUpperCase()}`;
  return `${g.emoji} ${g.name}`;
}
