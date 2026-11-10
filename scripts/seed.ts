/**
 * Fills a day with simulated players, so the results page can be judged
 * before real players exist. For local testing only.
 *
 *   npm run seed                  300 simulated players for today
 *   npm run seed -- 500           a different number
 *   npm run seed -- --clear       remove every simulated player and their scores
 *
 * Each simulated player goes through the real run, move by move, using the
 * `bot` each game provides. Their scores are therefore produced by the same
 * code real players go through, including the rare-answer counts.
 */
import { randomUUID } from "node:crypto";
import { loadGame } from "../games/registry";
import { now } from "../lib/clock";
import { dayKey, nextResetAt } from "../lib/day";
import { seededRng, type Rng } from "../lib/rng";
import { getRun, play, puzzleFor } from "../lib/run";
import * as store from "../lib/store";

const FIRST = ["Quiet", "Brisk", "Lucky", "Amber", "Nimble", "Mellow", "Bold", "Sunny", "Clever", "Steady", "Swift", "Polar", "Velvet", "Copper", "Misty", "Jolly"];
const SECOND = ["Otter", "Falcon", "Maple", "Comet", "Badger", "Heron", "Lynx", "Pebble", "Walrus", "Finch", "Puffin", "Moose", "Willow", "Marten", "Gecko", "Raven"];
const NAMES = [
  "ingrid", "Ola", "mari", "Jonas", "sofie", "Emil", "nora", "Lars", "thea", "Henrik", "ida", "Magnus", "astrid", "Sven", "linnea", "Oskar",
  "freja", "Mikkel", "saga", "Anders", "elin", "Tobias", "maja", "Kasper", "Hannah", "leo", "Chloe", "Ravi", "amira", "Diego", "yuki", "Priya",
  "Tom", "Zoe", "noah", "Lucia", "Felix", "Anya", "Mateo", "Clara", "Idris", "Mina", "Jack", "Elsa", "Hugo", "Lena", "Omar", "Ruth",
];
const TAGS = ["", "", "_", ".", "x", "the", "puzzle", "quiz", "daily", "word", "geo"];

function nickname(rng: Rng): string {
  const pick = <T,>(list: T[]) => list[Math.floor(rng() * list.length)];
  const style = rng();
  if (style < 0.3) return `${pick(FIRST)}${pick(SECOND)}${10 + Math.floor(rng() * 90)}`;
  if (style < 0.55) return pick(NAMES);
  if (style < 0.8) return `${pick(NAMES)}${pick(["", "_", "."])}${Math.floor(rng() * 100)}`;
  return `${pick(TAGS)}${pick(NAMES)}${pick(["", "", "99", "_no", "123", "07"])}`.slice(0, 16);
}

/** A bell-shaped random number, by averaging. */
const bell = (rng: Rng, mean: number, spread: number) => mean + ((rng() + rng() + rng() + rng()) / 4 - 0.5) * spread * 3.46;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

async function simulate(day: string, startAt: number, lastMoment: number, rng: Rng): Promise<number> {
  const id = randomUUID();
  await store.createPlayer({ id, nickname: nickname(rng), at: startAt, isSeed: true });
  const skill = clamp(bell(rng, 0.5, 0.2), 0, 1);

  let at = startAt;
  let run = await getRun(id, at);
  for (let moves = 0; run.current && moves < 400; moves++) {
    const game = await loadGame(run.current.id);
    at = Math.min(lastMoment, at + 2000 + Math.floor(rng() * 6000));

    if (!game.bot) {
      // A game without a bot gets a plausible made-up score, so a lineup that includes it can still be seeded.
      const score = Math.round(clamp(bell(rng, 45 + skill * 30, 18), 0, 100));
      await store.finishSession(id, day, run.current.id, { score, summary: "Simulated", share: `${score}` }, at);
      run = await getRun(id, at);
      continue;
    }

    const action = game.bot(await puzzleFor(day, game), run.current.view, rng, skill);
    const outcome = await play(id, day, run.current.id, action, at);
    if (outcome.ok) run = outcome.run;
    else if (outcome.reason !== "rejected") throw new Error(outcome.error);
  }
  if (!run.finished) throw new Error(`A simulated player got stuck in ${run.current?.id}`);
  return run.total;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--clear")) {
    console.log(`Removed ${await store.deleteSeedPlayers()} simulated players. (Their rare-answer counts for past days stay in the tallies.)`);
    return;
  }

  const count = Number(args.find((arg) => /^\d+$/.test(arg)) ?? 300);
  const at = now();
  const day = dayKey(at);
  // Spread the players over the day so far, leaving each time to finish before "now".
  const dayStart = nextResetAt(at) - 24 * 3600 * 1000;
  const latestStart = Math.max(dayStart, at - 15 * 60 * 1000);
  const rng = seededRng(`seed:${day}:${at}`);

  const totals: number[] = [];
  const started = Date.now();
  for (let i = 0; i < count; i++) {
    const startAt = Math.floor(dayStart + rng() * (latestStart - dayStart));
    totals.push(await simulate(day, startAt, at, rng));
    if ((i + 1) % 50 === 0) console.log(`${i + 1}/${count}`);
  }

  totals.sort((a, b) => a - b);
  const mean = totals.reduce((sum, total) => sum + total, 0) / totals.length;
  console.log(
    `Added ${count} simulated players for ${day} in ${((Date.now() - started) / 1000).toFixed(1)}s. ` +
      `Totals: lowest ${totals[0]}, median ${totals[Math.floor(totals.length / 2)]}, mean ${mean.toFixed(0)}, highest ${totals[totals.length - 1]}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
