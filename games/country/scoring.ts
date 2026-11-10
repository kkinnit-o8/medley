/**
 * All scoring for the country game lives here.
 */

export const MAX_GUESSES = 6;

/** Points for naming the country on the 1st, 2nd, ... 6th guess. */
export const POINTS_BY_GUESS = [100, 90, 75, 60, 45, 30];

/** A player who never finds it still earns up to this much for getting close. */
export const FAIL_MAX_POINTS = 20;
/** ...shrinking to nothing when their closest guess was this far away (km) or more. */
export const FAIL_ZERO_AT_KM = 5000;

/** The distance shown as 0% proximity: about as far apart as two places on Earth can be. */
export const FARTHEST_KM = 20_000;

export function scoreFor(solvedOnGuess: number | null, closestKm: number): number {
  if (solvedOnGuess !== null) return POINTS_BY_GUESS[solvedOnGuess - 1];
  return Math.round(FAIL_MAX_POINTS * Math.max(0, 1 - closestKm / FAIL_ZERO_AT_KM));
}

/** 100 for the country itself, falling to 0 on the far side of the planet. */
export function proximity(km: number): number {
  return Math.max(0, Math.round((1 - km / FARTHEST_KM) * 100));
}
