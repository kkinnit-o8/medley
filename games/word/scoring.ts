/**
 * All scoring for the word game lives here.
 */

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** Points for solving on the 1st, 2nd, ... 6th guess. */
export const POINTS_BY_GUESS = [100, 90, 75, 60, 45, 30];
/** Points for not solving it. */
export const FAIL_POINTS = 0;

export function scoreFor(solvedOnGuess: number | null): number {
  return solvedOnGuess === null ? FAIL_POINTS : POINTS_BY_GUESS[solvedOnGuess - 1];
}
