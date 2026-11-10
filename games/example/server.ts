import "server-only";
import { seededRng } from "@/lib/rng";
import { Rejected, defineGame } from "../types";

/**
 * A deliberately tiny game, kept as a template: guess a number from 1 to 10
 * in three tries. Copy this folder to start a new game.
 */
type Puzzle = { secret: number };
type State = { guesses: number[] };
export type ExampleView = {
  guesses: { value: number; hint: "higher" | "lower" | "correct" }[];
  triesLeft: number;
  over: boolean;
};
export type ExampleAction = { guess: number };

const TRIES = 3;
const POINTS = [100, 60, 30]; // solved on try 1, 2, 3

const won = (puzzle: Puzzle, state: State) => state.guesses.includes(puzzle.secret);
const over = (puzzle: Puzzle, state: State) => won(puzzle, state) || state.guesses.length >= TRIES;

export default defineGame<Puzzle, State, ExampleView, ExampleAction>({
  meta: { id: "example", name: "Number Hunch", tagline: "Find the number from 1 to 10 in three tries.", hue: 30 },

  createPuzzle: (day) => ({ secret: 1 + Math.floor(seededRng(`example:${day.key}`)() * 10) }),

  start: () => ({ guesses: [] }),

  play(puzzle, state, action) {
    const guess = Number(action?.guess);
    if (!Number.isInteger(guess) || guess < 1 || guess > 10) throw new Rejected("Pick a number from 1 to 10.");
    if (state.guesses.includes(guess)) throw new Rejected("You already tried that one.");
    return { guesses: [...state.guesses, guess] };
  },

  view: (puzzle, state) => ({
    guesses: state.guesses.map((value) => ({
      value,
      hint: value === puzzle.secret ? "correct" : value < puzzle.secret ? "higher" : "lower",
    })),
    triesLeft: TRIES - state.guesses.length,
    over: over(puzzle, state),
  }),

  result(puzzle, state) {
    if (!over(puzzle, state)) return null;
    const solved = won(puzzle, state);
    const tries = state.guesses.length;
    return {
      score: solved ? POINTS[tries - 1] : 0,
      summary: solved ? `Found it in ${tries}` : `Missed. It was ${puzzle.secret}`,
      share: solved ? `${tries}/${TRIES}` : `X/${TRIES}`,
    };
  },

  bot(puzzle, view, rng) {
    const tried = new Set(view.guesses.map((g) => g.value));
    let low = 1;
    let high = 10;
    for (const g of view.guesses) {
      if (g.hint === "higher") low = Math.max(low, g.value + 1);
      if (g.hint === "lower") high = Math.min(high, g.value - 1);
    }
    let guess = low + Math.floor(rng() * (high - low + 1));
    while (tried.has(guess)) guess = 1 + Math.floor(rng() * 10);
    return { guess };
  },
});
