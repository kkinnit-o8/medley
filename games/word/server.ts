import "server-only";
import { dealForDay, pick } from "@/lib/rng";
import { Rejected, defineGame } from "../types";
import answers from "./data/answers.json";
import guesses from "./data/guesses.json";
import { MAX_GUESSES, WORD_LENGTH, scoreFor } from "./scoring";
import type { Mark, WordAction, WordView } from "./types";

type Puzzle = { answer: string };
type State = { guesses: string[] };

const VALID = new Set<string>(guesses);

/** Green/yellow/grey for one guess. Repeated letters are only marked as often as they occur in the answer. */
export function markGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(guess.length).fill("miss");
  const unused = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = "hit";
    else unused.set(answer[i], (unused.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    const left = unused.get(guess[i]) ?? 0;
    if (marks[i] !== "hit" && left > 0) {
      marks[i] = "near";
      unused.set(guess[i], left - 1);
    }
  }
  return marks;
}

const solved = (puzzle: Puzzle, state: State) => state.guesses.includes(puzzle.answer);
const statusOf = (puzzle: Puzzle, state: State): WordView["status"] =>
  solved(puzzle, state) ? "won" : state.guesses.length >= MAX_GUESSES ? "lost" : "playing";

export default defineGame<Puzzle, State, WordView, WordAction>({
  meta: { id: "word", name: "Fiver", tagline: "Find the five-letter word in six guesses.", hue: 150 },

  createPuzzle: (day) => ({ answer: dealForDay(answers, day.index, "word")[0] }),

  start: () => ({ guesses: [] }),

  play(puzzle, state, action) {
    if (statusOf(puzzle, state) !== "playing") return state;
    const guess = typeof action?.guess === "string" ? action.guess.trim().toLowerCase() : "";
    if (!/^[a-z]+$/.test(guess) || guess.length !== WORD_LENGTH) throw new Rejected(`Enter a ${WORD_LENGTH}-letter word.`);
    if (!VALID.has(guess)) throw new Rejected("Not in the word list.");
    if (state.guesses.includes(guess)) throw new Rejected("You already tried that word.");
    return { guesses: [...state.guesses, guess] };
  },

  view(puzzle, state) {
    const status = statusOf(puzzle, state);
    return {
      rows: state.guesses.map((word) => ({ word, marks: markGuess(word, puzzle.answer) })),
      wordLength: WORD_LENGTH,
      maxGuesses: MAX_GUESSES,
      status,
      answer: status === "lost" ? puzzle.answer : null,
    };
  },

  result(puzzle, state) {
    const status = statusOf(puzzle, state);
    if (status === "playing") return null;
    const used = state.guesses.length;
    return status === "won"
      ? { score: scoreFor(used), summary: used === 1 ? "Solved on the first guess" : `Solved in ${used} guesses`, share: `${used}/${MAX_GUESSES}` }
      : { score: scoreFor(null), summary: `Not solved. The word was ${puzzle.answer.toUpperCase()}`, share: `X/${MAX_GUESSES}` };
  },

  // A simulated player: usually guesses a word that fits every clue so far,
  // and the weaker it is, the more often it wastes a guess on one that does not.
  bot(puzzle, view, rng, skill) {
    const tried = new Set(view.rows.map((row) => row.word));
    const fits = answers.filter(
      (word) => !tried.has(word) && view.rows.every((row) => markGuess(row.word, word).join() === row.marks.join()),
    );
    const careless = rng() < (1 - skill) * 0.3;
    const pool = careless || fits.length === 0 ? answers.filter((word) => !tried.has(word)) : fits;
    return { guess: pick(pool, rng) };
  },
});
