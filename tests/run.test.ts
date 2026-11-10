import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { loadGame } from "../games/registry";
import { dayKey } from "../lib/day";
import { seededRng } from "../lib/rng";
import * as run from "../lib/run";
import * as store from "../lib/store";
import { config } from "../medley.config";

// The run engine against a throwaway database. (The database is opened on
// first use, so pointing MEDLEY_DB somewhere else here is early enough.)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "medley-test-"));
process.env.MEDLEY_DB = path.join(dir, "test.db");
delete process.env.MEDLEY_DATE;

const T0 = Date.UTC(2026, 10, 10, 9, 0, 0);
const DAY_MS = 86_400_000;
let counter = 0;

async function newPlayer(at = T0): Promise<string> {
  const id = `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  await store.createPlayer({ id, nickname: `Tester ${counter}`, at });
  return id;
}

/** Plays a whole day with each game's bot and returns the total. */
async function playThrough(playerId: string, start: number, skill = 0.6): Promise<number> {
  const rng = seededRng(`${playerId}:${start}`);
  let at = start;
  let snapshot = await run.getRun(playerId, at);
  for (let moves = 0; snapshot.current && moves < 500; moves++) {
    const game = await loadGame(snapshot.current.id);
    at += 3000;
    const action = game.bot!(await run.puzzleFor(snapshot.day, game), snapshot.current.view, rng, skill);
    const outcome = await run.play(playerId, snapshot.day, snapshot.current.id, action, at);
    if (outcome.ok) snapshot = outcome.run;
    else assert.equal(outcome.reason, "rejected");
  }
  assert.equal(snapshot.finished, true);
  return snapshot.total;
}

after(() => fs.rmSync(dir, { recursive: true, force: true }));

test("a new player starts on the first game of the lineup", async () => {
  const player = await newPlayer();
  const snapshot = await run.getRun(player, T0);
  assert.deepEqual(snapshot.games.map((g) => g.id), [...config.lineup]);
  assert.equal(snapshot.current?.id, config.lineup[0]);
  assert.deepEqual(snapshot.games.map((g) => g.status), ["current", ...config.lineup.slice(1).map(() => "upcoming")]);
  assert.equal(snapshot.total, 0);
  assert.equal(snapshot.maxTotal, config.lineup.length * 100);
});

test("moves are only accepted for the game the player is on, and only today", async () => {
  const player = await newPlayer();
  const { day } = await run.getRun(player, T0);
  const later = await run.play(player, day, config.lineup[1], { guess: "crane" }, T0);
  assert.equal(later.ok, false);
  assert.equal(!later.ok && later.reason, "out-of-turn");
  const stale = await run.play(player, dayKey(T0 - DAY_MS), config.lineup[0], { type: "start" }, T0);
  assert.equal(!stale.ok && stale.reason, "new-day");
});

test("a full run: every game scores 0-100, the total is their sum, and it cannot be replayed", async () => {
  const player = await newPlayer();
  const total = await playThrough(player, T0);
  const day = dayKey(T0);
  const sessions = await store.listSessions(player, day);
  assert.equal(sessions.length, config.lineup.length);
  for (const session of sessions) assert.ok(session.score !== null && session.score >= 0 && session.score <= 100);
  assert.equal(total, sessions.reduce((sum, s) => sum + s.score!, 0));
  assert.equal((await store.getRun(player, day))?.total, total);

  const before = JSON.stringify(sessions);
  for (const id of config.lineup) {
    const again = await run.play(player, day, id, { type: "start", guess: "crane" }, T0 + 3_600_000);
    assert.equal(again.ok, false);
  }
  assert.equal(JSON.stringify(await store.listSessions(player, day)), before);
  assert.equal((await run.getRun(player, T0 + 3_600_000)).finished, true);
});

test("the same day gives every player the same puzzles; another day gives different ones", async () => {
  const day = dayKey(T0);
  const next = dayKey(T0 + DAY_MS);
  await run.lineupFor(next, T0 + DAY_MS);
  for (const id of config.lineup) {
    const today = await store.getPuzzle(day, id);
    assert.ok(today !== undefined);
    assert.notDeepEqual(today, await store.getPuzzle(next, id), `${id} repeated its puzzle`);
  }
});

test("streaks: consecutive days count up, a missed day starts over", async () => {
  const player = await newPlayer();
  await playThrough(player, T0);
  assert.equal((await store.getPlayer(player))?.streak, 1);
  await playThrough(player, T0 + DAY_MS);
  assert.equal((await store.getPlayer(player))?.streak, 2);
  await playThrough(player, T0 + 4 * DAY_MS);
  const after = await store.getPlayer(player);
  assert.equal(after?.streak, 1);
  assert.equal(after?.best_streak, 2);
});

test("rare-answer timer runs on the server clock and survives being left alone", { skip: !config.lineup.includes("rare") || config.lineup[0] !== "rare" }, async () => {
  const { SECONDS_PER_PROMPT, GRACE_MS } = await import("../games/rare/scoring");
  const player = await newPlayer();
  const { day } = await run.getRun(player, T0);
  await run.play(player, day, "rare", { type: "start" }, T0);

  const midway = await run.getRun(player, T0 + 10_000);
  const view = midway.current!.view as { phase: string; msLeft: number };
  assert.equal(view.phase, "prompt");
  assert.equal(view.msLeft, SECONDS_PER_PROMPT * 1000 - 10_000);

  // Just inside the grace period an answer still counts...
  const late = await run.play(player, day, "rare", { type: "answer", text: "zzzz" }, T0 + SECONDS_PER_PROMPT * 1000 + GRACE_MS - 1);
  assert.equal(late.ok && (late.view as { outcome: { typed: string } }).outcome.typed, "zzzz");

  // ...but a prompt left open is a timeout, whenever the player comes back.
  const other = await newPlayer();
  await run.play(other, day, "rare", { type: "start" }, T0);
  const back = await run.getRun(other, T0 + 3_600_000);
  const timedOut = back.current!.view as { phase: string; outcome: { typed: string | null; points: number } };
  assert.equal(timedOut.phase, "feedback");
  assert.equal(timedOut.outcome.typed, null);
  assert.equal(timedOut.outcome.points, 0);
});

test("two copies of the same move arriving together count once", { skip: !config.lineup.includes("rare") || config.lineup[0] !== "rare" }, async () => {
  const player = await newPlayer();
  const { day } = await run.getRun(player, T0);
  await run.play(player, day, "rare", { type: "start" }, T0);
  const [a, b] = await Promise.all([
    run.play(player, day, "rare", { type: "answer", text: "qqqq" }, T0 + 1000),
    run.play(player, day, "rare", { type: "answer", text: "qqqq" }, T0 + 1000),
  ]);
  assert.equal(a.ok && b.ok, true);
  const [session] = await store.listSessions(player, day);
  assert.equal((session.state as { answered: unknown[] }).answered.length, 1);
});
