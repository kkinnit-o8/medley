/**
 * One accepted answer: [display name, estimated % of players who give it, ...aliases].
 *
 * The estimate is a starting guess used until real players have answered
 * (see ../scoring.ts). Aliases are other things a player might type for the
 * same answer. Case, accents, punctuation, plurals and small typos are
 * already handled by the matcher, so aliases only need to cover genuinely
 * different names and spellings.
 */
export type AnswerDef = [name: string, share: number, ...aliases: string[]];

export type PromptDef = {
  /** Stable, unique slug. Never reuse or rename one that has been played. */
  id: string;
  /** Shown to the player, e.g. "Name a pasta dish". */
  prompt: string;
  /**
   * Filler words to ignore when matching, so "penne pasta" matches "Penne"
   * and "River Nile" matches "Nile". Lowercase, singular.
   */
  ignore?: string[];
  answers: AnswerDef[];
};
