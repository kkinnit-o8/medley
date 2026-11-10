import "server-only";
import { config } from "@/medley.config";
import { loadGame } from "@/games/registry";
import { Rejected, type GameContext, type GameResult, type ServerGame } from "@/games/types";
import { dayKey, dayNumber, epochDay } from "./day";
import { db } from "./db";
import { recordCompletion } from "./player";
import * as store from "./store";

/**
 * The daily run: which game a player is on, and moving them through the
 * lineup in order. This file knows nothing about any particular game.
 */

export type RunGame = {
  id: string;
  name: string;
  tagline: string;
  hue: number;
  status: "done" | "current" | "upcoming";
  score: number | null;
  summary: string | null;
};

export type RunSnapshot = {
  day: string;
  dayNumber: number;
  games: RunGame[];
  /** Points so far and the most the lineup can give. */
  total: number;
  maxTotal: number;
  /** The game being played and what its player may see; null once the run is finished. */
  current: { id: string; view: unknown } | null;
  finished: boolean;
};

export type PlayOutcome =
  | { ok: true; view: unknown; result: GameResult | null; run: RunSnapshot }
  | { ok: false; reason: "rejected"; error: string }
  | { ok: false; reason: "new-day" | "out-of-turn"; error: string };

function contextFor(day: string, gameId: string, at: number): GameContext {
  return {
    day: { key: day, index: epochDay(day) },
    now: at,
    tally: {
      add: (bucket, value) => store.addTally(day, gameId, bucket, value),
      get: (bucket) => store.getTally(day, gameId, bucket),
    },
  };
}

/**
 * The games for a day, in playing order. The first time a day is opened its
 * lineup and every game's puzzle are stored, so nothing about the day can
 * change afterwards, even if the code or the content is updated mid-day.
 */
export async function lineupFor(day: string, at: number): Promise<ServerGame[]> {
  const { ids, opened } = await store.lineupForDay(day, config.lineup, at);
  const games = await Promise.all(ids.map(loadGame));
  if (opened) for (const game of games) await puzzleFor(day, game);
  return games;
}

export async function puzzleFor(day: string, game: ServerGame): Promise<unknown> {
  const stored = await store.getPuzzle(day, game.meta.id);
  if (stored !== undefined) return stored;
  const puzzle = await game.createPuzzle({ key: day, index: epochDay(day) });
  return store.keepPuzzle(day, game.meta.id, puzzle);
}

type Position = {
  lineup: ServerGame[];
  sessions: Map<string, store.Session>;
  current: { game: ServerGame; puzzle: unknown; state: unknown; ctx: GameContext } | null;
};

/**
 * Works out where a player is in today's lineup, opening the next game's
 * session when the previous one is finished and closing the run after the
 * last. Safe to call any number of times.
 */
async function locate(playerId: string, day: string, at: number): Promise<Position> {
  const lineup = await lineupFor(day, at);
  const sessions = new Map((await store.listSessions(playerId, day)).map((s) => [s.game_id, s]));

  for (const game of lineup) {
    const id = game.meta.id;
    let session = sessions.get(id);
    if (session && session.score !== null) continue;

    const puzzle = await puzzleFor(day, game);
    const ctx = contextFor(day, id, at);
    if (!session) {
      session = { game_id: id, state: game.start(puzzle), score: null, summary: null, share: null };
      await store.createSession(playerId, day, id, session.state, at);
      sessions.set(id, session);
    }

    if (game.settle) {
      const settled = await game.settle(puzzle, session.state, ctx);
      if (settled !== session.state) {
        session.state = settled;
        await store.saveSession(playerId, day, id, settled);
      }
    }

    const result = game.result(puzzle, session.state);
    if (!result) return { lineup, sessions, current: { game, puzzle, state: session.state, ctx } };
    await close(playerId, day, session, result, at);
  }

  if (!(await store.getRun(playerId, day))) {
    const total = lineup.reduce((sum, game) => sum + (sessions.get(game.meta.id)?.score ?? 0), 0);
    await store.createRun(playerId, day, total, at);
    await recordCompletion(playerId, day);
  }
  return { lineup, sessions, current: null };
}

async function close(playerId: string, day: string, session: store.Session, result: GameResult, at: number) {
  const score = Math.max(0, Math.min(100, Math.round(result.score)));
  await store.finishSession(playerId, day, session.game_id, { ...result, score }, at);
  Object.assign(session, { score, summary: result.summary, share: result.share });
}

function snapshot(day: string, position: Position): RunSnapshot {
  const { lineup, sessions, current } = position;
  const games = lineup.map((game): RunGame => {
    const session = sessions.get(game.meta.id);
    const done = session != null && session.score !== null;
    return {
      id: game.meta.id,
      name: game.meta.name,
      tagline: game.meta.tagline,
      hue: game.meta.hue,
      status: done ? "done" : current?.game === game ? "current" : "upcoming",
      score: done ? session.score : null,
      summary: done ? session.summary : null,
    };
  });
  return {
    day,
    dayNumber: dayNumber(day),
    games,
    total: games.reduce((sum, game) => sum + (game.score ?? 0), 0),
    maxTotal: games.length * 100,
    current: current && { id: current.game.meta.id, view: current.game.view(current.puzzle, current.state, current.ctx) },
    finished: current === null,
  };
}

/** Today's run for a player, exactly where they left it. */
export function getRun(playerId: string, at: number): Promise<RunSnapshot> {
  const day = dayKey(at);
  return db.transaction(async () => snapshot(day, await locate(playerId, day, at)));
}

/** Applies one move in the player's current game. */
export async function play(playerId: string, day: string, gameId: string, action: unknown, at: number): Promise<PlayOutcome> {
  if (day !== dayKey(at)) return { ok: false, reason: "new-day", error: "A new day has started." };
  try {
    return await db.transaction(async (): Promise<PlayOutcome> => {
      const { current } = await locate(playerId, day, at);
      if (!current || current.game.meta.id !== gameId) {
        return { ok: false, reason: "out-of-turn", error: "That game is not the one you are on." };
      }
      const { game, puzzle, ctx } = current;
      const state = await game.play(puzzle, current.state, action, ctx);
      await store.saveSession(playerId, day, gameId, state);

      const view = game.view(puzzle, state, ctx);
      const result = game.result(puzzle, state);
      // locate() again: if that move ended the game it records the score,
      // opens the next game, and closes the run after the last one.
      const run = snapshot(day, await locate(playerId, day, at));
      return { ok: true, view, result, run };
    });
  } catch (error) {
    if (error instanceof Rejected) return { ok: false, reason: "rejected", error: error.message };
    throw error;
  }
}
