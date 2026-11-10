/**
 * Site-wide settings. This is the one file to edit when you buy a domain,
 * rename the site, move the launch date or change the day's lineup.
 */
export const config = {
  /** Shown in the header, the page title and the share text. */
  siteName: "Medley",
  /** Used in the share text and metadata. No trailing slash. */
  siteUrl: "https://medley.example",
  tagline: "Every game. One run. One score.",

  /** A new run starts at midnight in this timezone. */
  timezone: "Europe/Oslo",
  /** The day that counts as Medley #1 (YYYY-MM-DD, in the timezone above). */
  launchDate: "2026-11-10",

  /**
   * Today's games, in playing order. Each id is a folder under /games.
   * Adding a game = add its folder, then add its id here.
   */
  lineup: ["rare", "word", "country"],

  nickname: { minLength: 2, maxLength: 16 },
  leaderboardSize: 20,
  /** Below this many finished players, the results page shows "you're the Nth player today" instead of rank and percentile. */
  minPlayersForRanking: 20,
} as const;

export type MedleyConfig = typeof config;
