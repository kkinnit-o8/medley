import "server-only";
import { dealForDay, pick } from "@/lib/rng";
import { Rejected, defineGame } from "../types";
import data from "./data/countries.json";
import { DEGREES, bearing, compass, distanceKm } from "./geo";
import { MAX_GUESSES, proximity, scoreFor } from "./scoring";
import type { CountryAction, CountryGuess, CountryView } from "./types";

type Country = { id: string; name: string; lat: number; lon: number; stroke: number; path: string };
type Puzzle = { id: string };
type State = { guesses: string[] };

const COUNTRIES = data as Country[];
const BY_ID = new Map(COUNTRIES.map((country) => [country.id, country]));

function compare(guess: Country, answer: Country): CountryGuess {
  const correct = guess.id === answer.id;
  const km = correct ? 0 : Math.round(distanceKm(guess, answer));
  return {
    id: guess.id,
    name: guess.name,
    correct,
    km,
    direction: correct ? null : compass(bearing(guess, answer)),
    proximity: correct ? 100 : Math.min(99, proximity(km)),
  };
}

const statusOf = (puzzle: Puzzle, state: State): CountryView["status"] =>
  state.guesses.includes(puzzle.id) ? "won" : state.guesses.length >= MAX_GUESSES ? "lost" : "playing";

export default defineGame<Puzzle, State, CountryView, CountryAction>({
  meta: { id: "country", name: "Borderline", tagline: "Name the country from its outline in six guesses.", hue: 235 },

  createPuzzle: (day) => ({ id: dealForDay(COUNTRIES, day.index, "country")[0].id }),

  start: () => ({ guesses: [] }),

  play(puzzle, state, action) {
    if (statusOf(puzzle, state) !== "playing") return state;
    const id = typeof action?.guess === "string" ? action.guess : "";
    if (!BY_ID.has(id)) throw new Rejected("Pick a country from the list.");
    if (state.guesses.includes(id)) throw new Rejected("You already guessed that country.");
    return { guesses: [...state.guesses, id] };
  },

  view(puzzle, state) {
    const answer = BY_ID.get(puzzle.id)!;
    const status = statusOf(puzzle, state);
    return {
      shape: { path: answer.path, stroke: answer.stroke },
      guesses: state.guesses.map((id) => compare(BY_ID.get(id)!, answer)),
      maxGuesses: MAX_GUESSES,
      status,
      answer: status === "playing" ? null : answer.name,
    };
  },

  result(puzzle, state) {
    const status = statusOf(puzzle, state);
    if (status === "playing") return null;
    const answer = BY_ID.get(puzzle.id)!;
    const used = state.guesses.length;
    if (status === "won") {
      return {
        score: scoreFor(used, 0),
        summary: used === 1 ? `${answer.name}, first guess` : `${answer.name} in ${used} guesses`,
        share: `${used}/${MAX_GUESSES}`,
      };
    }
    const closest = Math.min(...state.guesses.map((id) => distanceKm(BY_ID.get(id)!, answer)));
    return {
      score: scoreFor(null, closest),
      summary: `Not found. It was ${answer.name}`,
      share: `X/${MAX_GUESSES}`,
    };
  },

  // A simulated player: sometimes recognises the outline outright, otherwise
  // homes in using the distance and direction clues, more loosely the weaker it is.
  bot(puzzle, view, rng, skill) {
    const tried = new Set(view.guesses.map((guess) => guess.id));
    const open = COUNTRIES.filter((country) => !tried.has(country.id));
    if (rng() < 0.05 + 0.45 * skill * skill) return { guess: puzzle.id };
    if (view.guesses.length === 0) return { guess: pick(open, rng).id };

    const slackKm = 150 + (1 - skill) * 1800;
    const fits = open.filter((country) =>
      view.guesses.every((guess) => {
        const from = BY_ID.get(guess.id)!;
        const turn = Math.abs(((bearing(from, country) - DEGREES[guess.direction!] + 540) % 360) - 180);
        return Math.abs(distanceKm(from, country) - guess.km) <= slackKm && turn <= 50 + (1 - skill) * 40;
      }),
    );
    return { guess: pick(fits.length > 0 ? fits : open, rng).id };
  },
});
