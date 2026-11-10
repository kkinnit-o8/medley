import "server-only";
import { db } from "./db";

/**
 * Every database query in the app. Nothing outside this file writes SQL, so
 * this is the only place to look at when moving to another database.
 */

// ---------------------------------------------------------------- players

export type Player = {
  id: string;
  nickname: string;
  created_at: number;
  streak: number;
  best_streak: number;
  last_completed: string | null;
  is_seed: number;
};

export function getPlayer(id: string) {
  return db.get<Player>(`SELECT * FROM players WHERE id = ?`, [id]);
}

export async function createPlayer(player: { id: string; nickname: string; at: number; isSeed?: boolean }) {
  await db.run(`INSERT INTO players (id, nickname, created_at, is_seed) VALUES (?, ?, ?, ?)`, [
    player.id,
    player.nickname,
    player.at,
    player.isSeed ? 1 : 0,
  ]);
}

export async function renamePlayer(id: string, nickname: string) {
  await db.run(`UPDATE players SET nickname = ? WHERE id = ?`, [nickname, id]);
}

export async function saveStreak(id: string, streak: number, day: string) {
  await db.run(
    `UPDATE players SET streak = ?, best_streak = CASE WHEN best_streak > ? THEN best_streak ELSE ? END, last_completed = ? WHERE id = ?`,
    [streak, streak, streak, day, id],
  );
}

export async function deleteSeedPlayers(): Promise<number> {
  const seeded = `(SELECT id FROM players WHERE is_seed = 1)`;
  await db.run(`DELETE FROM sessions WHERE player_id IN ${seeded}`);
  await db.run(`DELETE FROM runs WHERE player_id IN ${seeded}`);
  return (await db.run(`DELETE FROM players WHERE is_seed = 1`)).changes;
}

// ------------------------------------------------------- days and puzzles

/**
 * The lineup for a day. The first caller decides it; everyone after gets the
 * same answer. `opened` is true for that first caller.
 */
export async function lineupForDay(day: string, proposed: readonly string[], at: number): Promise<{ ids: string[]; opened: boolean }> {
  const { changes } = await db.run(`INSERT INTO days (day, lineup, created_at) VALUES (?, ?, ?) ON CONFLICT (day) DO NOTHING`, [
    day,
    JSON.stringify(proposed),
    at,
  ]);
  const row = await db.get<{ lineup: string }>(`SELECT lineup FROM days WHERE day = ?`, [day]);
  return { ids: JSON.parse(row!.lineup), opened: changes === 1 };
}

export async function getPuzzle(day: string, gameId: string): Promise<unknown | undefined> {
  const row = await db.get<{ puzzle: string }>(`SELECT puzzle FROM puzzles WHERE day = ? AND game_id = ?`, [day, gameId]);
  return row ? JSON.parse(row.puzzle) : undefined;
}

/** Stores a day's puzzle unless one is already there, and returns the stored one. */
export async function keepPuzzle(day: string, gameId: string, puzzle: unknown): Promise<unknown> {
  await db.run(`INSERT INTO puzzles (day, game_id, puzzle) VALUES (?, ?, ?) ON CONFLICT (day, game_id) DO NOTHING`, [
    day,
    gameId,
    JSON.stringify(puzzle),
  ]);
  return (await getPuzzle(day, gameId))!;
}

// --------------------------------------------------------------- sessions

export type Session = {
  game_id: string;
  state: unknown;
  score: number | null;
  summary: string | null;
  share: string | null;
};

export async function listSessions(playerId: string, day: string): Promise<Session[]> {
  const rows = await db.all<Omit<Session, "state"> & { state: string }>(
    `SELECT game_id, state, score, summary, share FROM sessions WHERE player_id = ? AND day = ?`,
    [playerId, day],
  );
  return rows.map((row) => ({ ...row, state: JSON.parse(row.state) }));
}

export async function createSession(playerId: string, day: string, gameId: string, state: unknown, at: number) {
  await db.run(`INSERT INTO sessions (player_id, day, game_id, state, started_at) VALUES (?, ?, ?, ?, ?)`, [
    playerId,
    day,
    gameId,
    JSON.stringify(state),
    at,
  ]);
}

/** Saves progress. Refuses to touch a finished game. */
export async function saveSession(playerId: string, day: string, gameId: string, state: unknown) {
  const { changes } = await db.run(
    `UPDATE sessions SET state = ? WHERE player_id = ? AND day = ? AND game_id = ? AND score IS NULL`,
    [JSON.stringify(state), playerId, day, gameId],
  );
  if (changes !== 1) throw new Error(`No open ${gameId} session to save for ${day}`);
}

/** Records the final score, once. */
export async function finishSession(
  playerId: string,
  day: string,
  gameId: string,
  result: { score: number; summary: string; share: string },
  at: number,
) {
  const { changes } = await db.run(
    `UPDATE sessions SET score = ?, summary = ?, share = ?, finished_at = ?
     WHERE player_id = ? AND day = ? AND game_id = ? AND score IS NULL`,
    [result.score, result.summary, result.share, at, playerId, day, gameId],
  );
  if (changes !== 1) throw new Error(`${gameId} was already finished for ${day}`);
}

// ------------------------------------------------------------------- runs

export type Run = { total: number; finished_at: number };

export function getRun(playerId: string, day: string) {
  return db.get<Run>(`SELECT total, finished_at FROM runs WHERE player_id = ? AND day = ?`, [playerId, day]);
}

export async function createRun(playerId: string, day: string, total: number, at: number) {
  await db.run(`INSERT INTO runs (player_id, day, total, finished_at) VALUES (?, ?, ?, ?)`, [playerId, day, total, at]);
}

// ---------------------------------------------------------------- tallies

export async function addTally(day: string, gameId: string, bucket: string, value: string) {
  await db.run(
    `INSERT INTO tallies (day, game_id, bucket, value, n) VALUES (?, ?, ?, ?, 1)
     ON CONFLICT (day, game_id, bucket, value) DO UPDATE SET n = tallies.n + 1`,
    [day, gameId, bucket, value],
  );
}

export async function getTally(day: string, gameId: string, bucket: string): Promise<Record<string, number>> {
  const rows = await db.all<{ value: string; n: number }>(
    `SELECT value, n FROM tallies WHERE day = ? AND game_id = ? AND bucket = ?`,
    [day, gameId, bucket],
  );
  return Object.fromEntries(rows.map((row) => [row.value, row.n]));
}

export function listTallies(day: string, gameId: string) {
  return db.all<{ bucket: string; value: string; n: number }>(
    `SELECT bucket, value, n FROM tallies WHERE day = ? AND game_id = ? ORDER BY bucket, n DESC`,
    [day, gameId],
  );
}

// ---------------------------------------------------------------- results

/** How a total compares with everyone who finished that day. */
export async function standing(day: string, total: number, finishedAt: number) {
  const row = await db.get<{ players: number; above: number; below: number; earlier: number }>(
    `SELECT COUNT(*) AS players,
            COALESCE(SUM(CASE WHEN total > ? THEN 1 ELSE 0 END), 0) AS above,
            COALESCE(SUM(CASE WHEN total < ? THEN 1 ELSE 0 END), 0) AS below,
            COALESCE(SUM(CASE WHEN finished_at < ? THEN 1 ELSE 0 END), 0) AS earlier
     FROM runs WHERE day = ?`,
    [total, total, finishedAt, day],
  );
  return row!;
}

export type LeaderboardRow = { player_id: string; nickname: string; total: number; finished_at: number };

/** Best totals first; equal totals are ordered by who finished first. */
export function leaderboard(day: string, limit: number) {
  return db.all<LeaderboardRow>(
    `SELECT runs.player_id, players.nickname, runs.total, runs.finished_at
     FROM runs JOIN players ON players.id = runs.player_id
     WHERE runs.day = ?
     ORDER BY runs.total DESC, runs.finished_at ASC, runs.player_id ASC
     LIMIT ?`,
    [day, limit],
  );
}

/** Finished scores for one game on one day, grouped into ten bars (0-9, 10-19, ... 90-100). */
export async function gameStats(day: string, gameId: string) {
  const rows = await db.all<{ bar: number; players: number; points: number }>(
    `SELECT CASE WHEN score >= 100 THEN 9 ELSE score / 10 END AS bar, COUNT(*) AS players, SUM(score) AS points
     FROM sessions WHERE day = ? AND game_id = ? AND score IS NOT NULL
     GROUP BY 1`,
    [day, gameId],
  );
  const histogram = Array.from({ length: 10 }, () => 0);
  let players = 0;
  let points = 0;
  for (const row of rows) {
    histogram[Number(row.bar)] = Number(row.players);
    players += Number(row.players);
    points += Number(row.points);
  }
  return { histogram, players, average: players ? points / players : 0 };
}
