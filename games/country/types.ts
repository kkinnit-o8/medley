/** Shared between the country game's server and client halves. */

export type Direction = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export type CountryGuess = {
  id: string;
  name: string;
  correct: boolean;
  /** Distance between the two countries' centre points. */
  km: number;
  /** Which way to travel from the guess to reach the answer. Null when correct. */
  direction: Direction | null;
  /** 100 = the answer itself, 0 = the far side of the planet. */
  proximity: number;
};

export type CountryView = {
  /** The silhouette: an SVG path in a 1000 x 1000 box, and how heavily to outline it. */
  shape: { path: string; stroke: number };
  guesses: CountryGuess[];
  maxGuesses: number;
  status: "playing" | "won" | "lost";
  /** Only filled in once the game is over. */
  answer: string | null;
};

export type CountryAction = { guess: string };
