/**
 * Lists the answers the rare-answer game turned down, most frequent first,
 * so real answers that are missing from the prompt bank can be found and added.
 *
 *   npm run rejected                 today
 *   npm run rejected -- 2026-11-10   another day
 */
import { now } from "../lib/clock";
import { dayKey, isDayKey } from "../lib/day";
import * as store from "../lib/store";

async function main() {
  const arg = process.argv[2];
  const day = isDayKey(arg) ? arg : dayKey(now());
  const rows = (await store.listTallies(day, "rare")).filter((row) => row.bucket.startsWith("rejected:"));
  if (rows.length === 0) return console.log(`No rejected answers recorded for ${day}.`);

  let prompt = "";
  for (const row of rows) {
    const id = row.bucket.slice("rejected:".length);
    if (id !== prompt) console.log(`\n${(prompt = id)}`);
    console.log(`  ${String(row.n).padStart(4)}  ${row.value}`);
  }
  console.log(`\nTo accept one, add it to that prompt in games/rare/prompts/ and run: npm run check:prompts`);
}

main();
