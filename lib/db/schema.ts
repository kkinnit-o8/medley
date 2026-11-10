/**
 * Tables. Written so the same statements run on SQLite and Postgres.
 * Times are milliseconds since 1970; `day` is "YYYY-MM-DD" in the site's timezone.
 */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    last_completed TEXT,
    is_seed INTEGER NOT NULL DEFAULT 0
  )`,

  // The lineup a day was played with, fixed the first time anyone opens that day.
  `CREATE TABLE IF NOT EXISTS days (
    day TEXT PRIMARY KEY,
    lineup TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,

  // Each game's puzzle for a day, including the answers. Never sent to the browser.
  `CREATE TABLE IF NOT EXISTS puzzles (
    day TEXT NOT NULL,
    game_id TEXT NOT NULL,
    puzzle TEXT NOT NULL,
    PRIMARY KEY (day, game_id)
  )`,

  // One row per player per game per day: the primary key is what makes a
  // second attempt impossible. `score` stays NULL until the game is finished.
  `CREATE TABLE IF NOT EXISTS sessions (
    player_id TEXT NOT NULL,
    day TEXT NOT NULL,
    game_id TEXT NOT NULL,
    state TEXT NOT NULL,
    score INTEGER,
    summary TEXT,
    share TEXT,
    started_at BIGINT NOT NULL,
    finished_at BIGINT,
    PRIMARY KEY (player_id, day, game_id)
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_by_game ON sessions (day, game_id, score)`,

  // One row per player per day, written when their last game finishes.
  `CREATE TABLE IF NOT EXISTS runs (
    player_id TEXT NOT NULL,
    day TEXT NOT NULL,
    total INTEGER NOT NULL,
    finished_at BIGINT NOT NULL,
    PRIMARY KEY (player_id, day)
  )`,
  `CREATE INDEX IF NOT EXISTS runs_by_day ON runs (day, total)`,

  // Counters any game can use for crowd data (e.g. how many players gave each answer).
  `CREATE TABLE IF NOT EXISTS tallies (
    day TEXT NOT NULL,
    game_id TEXT NOT NULL,
    bucket TEXT NOT NULL,
    value TEXT NOT NULL,
    n INTEGER NOT NULL,
    PRIMARY KEY (day, game_id, bucket, value)
  )`,
];
