/** Shared between the word game's server and client halves. */

/** hit = right letter, right place. near = in the word, wrong place. miss = not in the word. */
export type Mark = "hit" | "near" | "miss";

export type WordView = {
  rows: { word: string; marks: Mark[] }[];
  wordLength: number;
  maxGuesses: number;
  status: "playing" | "won" | "lost";
  /** Only filled in once the game is lost. */
  answer: string | null;
};

export type WordAction = { guess: string };
