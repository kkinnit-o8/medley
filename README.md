# Medley

A daily puzzle site where the challenge is to finish several games back to back, in one run, for one score, and then see how you did against everyone else.

Every day has one run. Everyone gets the same puzzles, in the same order, and nobody gets a second try. Today's lineup:

1. **Deep Cut**: seven open-ended prompts, 25 seconds each. Any correct answer scores, and the fewer players who give it, the more it is worth.
2. **Fiver**: find the five-letter word in six guesses.
3. **Borderline**: name the country from its outline in six guesses, with distance, direction and proximity clues.

The game names are working titles. Each one is set in a single place: the `meta` block at the top of `games/<id>/server.ts`.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. There is nothing else to set up: the database is a file that creates itself at `data/medley.db`.

To see the results page with a full field of players before real ones exist:

```bash
npm run seed
```

That adds 300 simulated players for today (`npm run seed -- 500` for another number, `npm run seed -- --clear` to remove them). They play through the real engine move by move, so their scores, the rare-answer counts and the leaderboard are produced by the same code real players use.

### Other commands

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for matching, scoring, dates and the run engine |
| `npm run lint` | ESLint |
| `npm run build` then `npm start` | Production build and server |
| `npm run check:prompts` | Validates the rare-answer prompt bank |
| `npm run try -- pasta-dish "spag bol" "sushi"` | Shows how the rare-answer game would judge what a player types |
| `npm run rejected` | Lists the answers the rare-answer game turned down today, most frequent first |
| `npm run build:words` | Rebuilds the word lists from their sources |
| `npm run build:countries` | Rebuilds the country outlines from Natural Earth |

## Settings

Everything site-wide is in [`medley.config.ts`](medley.config.ts): the site name and URL (used in the share text), the timezone a day rolls over in, the launch date that counts as Medley #1, the lineup, the nickname length limits, the leaderboard size, and how many players there must be before the results page shows a rank and percentile.

To pretend it is another day while testing, start the server with a date:

```bash
MEDLEY_DATE=2026-12-24 npm run dev
```

The time of day stays real, so timers and the countdown behave normally.

## How a day works

- A day is a date in the configured timezone (`Europe/Oslo`). The run resets at midnight there.
- Each game picks its puzzle from the date alone, so nothing needs scheduling. Lists are dealt out without repeats: the word list, the country list and the prompt bank are each shuffled once per cycle and worked through day by day.
- The first time a day is opened, its lineup and puzzles are stored in the database. After that the day cannot change, even if you deploy new words, prompts or games in the middle of it. Changes take effect from the next day.
- Everything about a player's progress lives on the server. A refresh, a closed tab or a second device with the same cookie all land exactly where the player left off.
- If midnight passes while someone is mid-run, their unfinished run is over and the page reloads into the new day.

## Fairness

- Today's answers never leave the server. The browser receives only a "view" of the game (see below), and the answer files are never part of the browser bundle.
- Every guess is checked and every score is computed on the server.
- One row per player per game per day is enforced by the database's primary key, and a finished game cannot be written to again. Moves are only accepted for the game the player is currently on, so there is no skipping ahead or going back.
- The rare-answer timer runs on the server's clock. A refresh does not reset it, and a prompt left open is scored as a timeout.
- A rare answer's points are fixed the moment it is given and never recalculated.

Players are anonymous: a random id in an `httpOnly` cookie, plus a nickname. That is enough to stop casual cheating, not a determined one (clearing cookies gives a fresh identity). Accounts are the real fix and are out of scope for this version.

## Adding a game

A game is one folder under `games/` with two files, and one line in the lineup.

1. Copy `games/example` (a complete, tiny game) to `games/<your-id>`.
2. In `server.ts`, set `meta.id` to the folder name, pick a name and an accent hue, and implement the game. The default export is a `ServerGame` (see [`games/types.ts`](games/types.ts)):

   | You write | What it is for |
   | --- | --- |
   | `createPuzzle(day)` | Today's puzzle, answers included, derived from the date |
   | `start(puzzle)` | A player's starting state |
   | `play(puzzle, state, action, ctx)` | Apply one move and return the new state. Throw `Rejected("message")` for unusable input |
   | `view(puzzle, state, ctx)` | What the browser may see. Leave the answers out until the game is over |
   | `result(puzzle, state)` | `null` while playing, then `{ score, summary, share }` with a score from 0 to 100 |
   | `settle(...)` (optional) | Apply anything the clock decides, such as an expired timer |
   | `bot(...)` (optional) | A simulated player, used by `npm run seed` |

3. In `client.tsx`, default-export a React component that takes `{ view, play, busy, draftKey }`. It renders `view` and calls `play(action)` when the player moves. Saving and restoring is automatic: the state is stored on the server after every move, and after a refresh the component simply receives the current `view` again.
4. Add the id to `lineup` in `medley.config.ts`.

Nothing else changes. The run flow, progress strip, storage, results page, share text, leaderboard and seed script only know games through that interface, and the day's maximum grows by 100 per game. The new lineup applies from the next day (or straight away on a day nobody has opened yet).

Two things a game gets for free through `ctx`: `ctx.now` (the server's clock) and `ctx.tally` (counters shared by all of today's players of that game, which is how the rare-answer game knows how common an answer is).

## Scoring

Each game reports 0 to 100, so every game counts the same and the day's total is the sum. Each game's numbers are in one file:

- [`games/rare/scoring.ts`](games/rare/scoring.ts): seconds per prompt, the five rarity tiers and their thresholds, and how real answers are blended with the starting estimates.
- [`games/word/scoring.ts`](games/word/scoring.ts): points by number of guesses.
- [`games/country/scoring.ts`](games/country/scoring.ts): points by number of guesses, and the partial credit for a near miss.

### How rarity works

Every answer in the prompt bank has an estimate of what percentage of players give it. Until a prompt has 50 real answers on a given day, points come from those estimates. From then on the real share of players is blended in, weighted so the estimate counts as 50 players: at 50 real answers the two weigh the same, at 500 the real data is about 90% of the result.

## The prompt bank

Prompts live in `games/rare/prompts/`, one file per theme. A prompt looks like this:

```ts
{
  id: "planet",
  prompt: "Name a planet in our solar system",
  ignore: ["planet"],                      // filler words to disregard when matching
  reject: ["Pluto"],                       // optional: wrong answers to turn away even if they resemble a right one
  answers: [
    ["Mars", 24, "the red planet"],        // [name, estimated % of players, ...other names]
    ["Earth", 16, "terra", "tellus"],
  ],
}
```

To add prompts, append to one of the files, or add a new file and list it in `prompts/index.ts`. Then run `npm run check:prompts`, which catches the mistakes that hurt players: two answers sharing a name, percentages over 100, an answer that does not match itself.

The matcher already forgives case, accents, punctuation, spacing, plurals, a leading "the" and small typos, so other names only need to cover genuinely different names and spellings. Use `npm run try` to see what a given input would do.

Rejecting a correct answer is the worst thing this game can do, so every rejected answer is counted. `npm run rejected` lists them; anything correct on that list should be added to the prompt.

## The database

SQLite, in one file (`data/medley.db`, or wherever `MEDLEY_DB` points). The layers are deliberately thin:

- [`lib/db/driver.ts`](lib/db/driver.ts) is the whole surface the app needs from a database: four methods.
- [`lib/db/sqlite.ts`](lib/db/sqlite.ts) implements it for SQLite.
- [`lib/db/schema.ts`](lib/db/schema.ts) holds the tables, written to run on both SQLite and Postgres.
- [`lib/store.ts`](lib/store.ts) holds every query in the app, in SQL both databases understand.

To move to hosted Postgres, write a second driver (the same four methods, with `?` placeholders rewritten to `$1, $2, ...` and `transaction` using a real database transaction with the connection kept in `AsyncLocalStorage`), and return it from `connect()` in [`lib/db/index.ts`](lib/db/index.ts). That driver is not written or tested yet.

While it runs on SQLite, the site needs a normal long-running Node server with a disk that persists (a VPS, Fly.io, Railway and the like). Serverless hosts without a persistent disk need the Postgres driver first.

## Where things are

```
medley.config.ts        site name, URL, timezone, launch date, lineup
app/                    the single page and the two API routes (nickname, play a move)
components/             run screen, progress strip, hand-off between games, results page
games/types.ts          the interface every game implements
games/rare|word|country the three games: server.ts, client.tsx, scoring.ts, data
games/example           a tiny template game
lib/run.ts              the daily run: where a player is, moving them through the lineup
lib/results.ts          everything the results page shows
lib/store.ts, lib/db/   queries and the database driver
scripts/                seed, prompt tools, and the builders for word and country data
tests/                  unit tests
```

## Data and licences

- **Word lists** (`games/word/data`): built by `npm run build:words` from [SCOWL](http://wordlist.aspell.net/) (answers: its most common words; valid guesses: all its sizes up to 70) and the public-domain ENABLE list (valid guesses). SCOWL's copyright notice is kept in `games/word/data/SCOWL-LICENSE.txt`, as its licence asks.
- **Country outlines and centre points** (`games/country/data`): built by `npm run build:countries` from [Natural Earth](https://www.naturalearthdata.com/) 1:50m and 1:10m country data, which is in the public domain.
- **Prompts and answer lists** are original to this project.
- **Typeface**: Archivo, under the SIL Open Font License.

## Not in this version

Accounts and login, friend groups, an archive of past days, ads, and any game beyond these three.
