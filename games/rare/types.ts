/** Shared between the rare-answer game's server and client halves. */

/** One answered prompt, as shown back to the player. */
export type RareOutcome = {
  /** What they typed, or null if time ran out. */
  typed: string | null;
  /** The accepted answer it matched, or null. */
  answer: string | null;
  /**
   * Set when the text matched one of the answer's other names rather than
   * its main one ("eggplant" for Aubergine): that other name.
   */
  matchedAs: string | null;
  points: number;
  /** 0 = most common tier ... 4 = rarest. Null for a miss. */
  tier: number | null;
  tierLabel: string | null;
  /** Roughly what percentage of players give this answer. */
  sharePercent: number | null;
  /** The most popular answer to this prompt. */
  mostCommon: string;
};

export type RareView = {
  phase: "intro" | "prompt" | "feedback" | "done";
  /** Which prompt (0-based) is on screen, and how many there are. */
  index: number;
  total: number;
  secondsPerPrompt: number;
  /** The prompt text. Null before the first prompt has started. */
  prompt: string | null;
  /** Time left on the server's clock when this view was made. */
  msLeft: number;
  /** The result of the prompt on screen (feedback phase only). */
  outcome: RareOutcome | null;
  /** Points and tier for every prompt answered so far. */
  history: { points: number; tier: number | null }[];
  tiers: { points: number; label: string }[];
};

export type RareAction =
  | { type: "start" }
  | { type: "answer"; text: string }
  /** Sent when the browser's countdown reaches zero. */
  | { type: "timeout" }
  | { type: "next" };
