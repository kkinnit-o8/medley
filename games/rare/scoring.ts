/**
 * All scoring for the rare-answer game lives here.
 */

export const PROMPTS_PER_DAY = 7;
export const SECONDS_PER_PROMPT = 25;
/** Extra time the server allows after the deadline, to cover network delay. */
export const GRACE_MS = 1500;

/**
 * Rarity tiers, most common first. An answer lands in the first tier whose
 * `minShare` it reaches, where share = the fraction of players giving that
 * answer (0.2 = one player in five).
 */
export const TIERS = [
  { points: 10, minShare: 0.18, label: "Crowd favourite" },
  { points: 25, minShare: 0.08, label: "Popular" },
  { points: 50, minShare: 0.03, label: "Uncommon" },
  { points: 75, minShare: 0.01, label: "Rare" },
  { points: 100, minShare: 0, label: "Almost nobody" },
] as const;

/** Points for a wrong answer or a timeout. */
export const MISS_POINTS = 0;

/**
 * Until a prompt has this many real answers today, rarity comes only from
 * the starting estimates in the prompt bank.
 */
export const MIN_REAL_ANSWERS = 50;
/**
 * After that, real data is blended in. The starting estimate counts as this
 * many imaginary players, so with 50 real answers the two weigh the same and
 * with 500 the real data is ~90% of the result.
 */
export const ESTIMATE_WEIGHT = 50;

/** Tier index (0 = most common) for a share between 0 and 1. */
export function tierForShare(share: number): number {
  const index = TIERS.findIndex((tier) => share >= tier.minShare);
  return index === -1 ? TIERS.length - 1 : index;
}

/**
 * The share used for scoring: the starting estimate, blended with the real
 * share once enough players have answered.
 */
export function blendedShare(estimate: number, realCount: number, realTotal: number): number {
  if (realTotal < MIN_REAL_ANSWERS) return estimate;
  const realWeight = realTotal / (realTotal + ESTIMATE_WEIGHT);
  return estimate * (1 - realWeight) + (realCount / realTotal) * realWeight;
}

/** Final 0-100 score: the seven answers (max 700) divided by seven. */
export function finalScore(points: number[]): number {
  const max = TIERS[TIERS.length - 1].points;
  const total = points.reduce((sum, p) => sum + p, 0);
  return Math.round((total / (PROMPTS_PER_DAY * max)) * 100);
}
