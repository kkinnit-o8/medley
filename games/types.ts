/**
 * The contract every game implements. A game is a folder under /games with:
 *
 *   server.ts   default export: a ServerGame (puzzle, rules, scoring). Never sent to the browser.
 *   client.tsx  default export: a React component taking GameProps (what the player sees).
 *
 * The run flow, storage, progress strip, results page and leaderboard only
 * ever talk to games through these types.
 */
import type { Rng } from "@/lib/rng";

export type GameMeta = {
  /** Must match the folder name and the id used in medley.config.ts. */
  id: string;
  name: string;
  /** One line shown under the name. */
  tagline: string;
  /** Accent colour as a hue angle, 0-360 (0 red, 140 green, 250 blue...). */
  hue: number;
};

export type DayInfo = {
  /** "YYYY-MM-DD" in the site's timezone. */
  key: string;
  /** Whole days since 1970, for use with dealForDay() from lib/rng. */
  index: number;
};

/** A finished game. */
export type GameResult = {
  /** 0-100. Every game is worth the same. */
  score: number;
  /** Short and human, shown when the game ends and on the results page. May reveal the answer. */
  summary: string;
  /** One line for the share text. Must not give anything away. */
  share: string;
};

/** Counters shared by all of today's players of this game, for crowd-based scoring. */
export type Tally = {
  add(bucket: string, value: string): Promise<void>;
  get(bucket: string): Promise<Record<string, number>>;
};

export type GameContext = {
  day: DayInfo;
  /** The server's clock in milliseconds. Use this, never Date.now(). */
  now: number;
  tally: Tally;
};

/** Throw from act() when the player's input is not usable. Nothing is saved; the message is shown to them. */
export class Rejected extends Error {}

/**
 * Puzzle: today's puzzle including its answers (stored on the server).
 * State:  one player's progress (stored on the server).
 * View:   what the browser may see of the two. This is all the client gets,
 *         so restoring after a refresh means rendering the view again.
 * Action: a move sent from the browser. Treat it as untrusted input.
 *
 * Puzzle, State and View must survive JSON.stringify.
 */
export interface ServerGame<Puzzle = unknown, State = unknown, View = unknown, Action = unknown> {
  meta: GameMeta;

  /** Today's puzzle. Must return the same thing every time for the same day. */
  createPuzzle(day: DayInfo): Puzzle | Promise<Puzzle>;

  /** Where a player starts. */
  start(puzzle: Puzzle): State;

  /**
   * Apply a move and return the new state. Throw Rejected for unusable input.
   * Scores must be decided here, on the server.
   */
  play(puzzle: Puzzle, state: State, action: Action, ctx: GameContext): State | Promise<State>;

  /**
   * Optional. Called before every play() and view() so the game can apply
   * anything the clock decides, such as a timer that ran out while the
   * player was away.
   */
  settle?(puzzle: Puzzle, state: State, ctx: GameContext): State | Promise<State>;

  /** What to show the player. Leave the answers out until the game is over. */
  view(puzzle: Puzzle, state: State, ctx: GameContext): View;

  /** The final result once the game is over, otherwise null. */
  result(puzzle: Puzzle, state: State): GameResult | null;

  /**
   * Optional. A simulated player for `npm run seed`: given what a player
   * would see, return a move. `skill` runs from 0 (weak) to 1 (strong).
   */
  bot?(puzzle: Puzzle, view: View, rng: Rng, skill: number): Action;
}

/** What a game's client component receives. */
export type GameProps<View = unknown, Action = unknown> = {
  /** The latest view from the server. */
  view: View;
  /**
   * Send a move. Resolves with ok: false and a message when the server
   * rejected it; on success the component simply re-renders with a new view.
   */
  play(action: Action): Promise<{ ok: true } | { ok: false; error: string }>;
  /** True while a move is on its way to the server. */
  busy: boolean;
  /** Unique per player-day-game. Handy as a localStorage key for unsent input. */
  draftKey: string;
};

/** Helper so a game file can declare its types once. */
export function defineGame<Puzzle, State, View, Action>(
  game: ServerGame<Puzzle, State, View, Action>,
): ServerGame<Puzzle, State, View, Action> {
  return game;
}
