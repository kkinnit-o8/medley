import "server-only";
import { dealForDay } from "@/lib/rng";
import { Rejected, defineGame, type GameContext } from "../types";
import { answerKey, buildMatcher, type Matcher } from "./match";
import { PROMPT_BANK } from "./prompts";
import type { PromptDef } from "./prompts/types";
import {
  GRACE_MS,
  MISS_EMOJI,
  MISS_POINTS,
  PROMPTS_PER_DAY,
  SECONDS_PER_PROMPT,
  TIERS,
  blendedShare,
  finalScore,
  tierForShare,
} from "./scoring";
import type { RareAction, RareOutcome, RareView } from "./types";

type Puzzle = { prompts: string[] };
type Answered = {
  typed: string | null;
  answer: string | null;
  /** The answer's other name that was matched, when it was not the main one. */
  matchedAs?: string | null;
  points: number;
  tier: number | null;
  share: number | null;
  mostCommon: string;
};
type State = {
  phase: RareView["phase"];
  index: number;
  /** Server time at which the current prompt was shown. */
  shownAt: number | null;
  answered: Answered[];
};

const LIMIT_MS = SECONDS_PER_PROMPT * 1000;
/** Tally values that are not answers. */
const MISS = "~miss";
const TIMEOUT = "~timeout";

const PROMPTS = new Map(PROMPT_BANK.map((prompt) => [prompt.id, prompt]));
const matchers = new Map<string, Matcher>();

function matcherFor(prompt: PromptDef): Matcher {
  let matcher = matchers.get(prompt.id);
  if (!matcher) matchers.set(prompt.id, (matcher = buildMatcher(prompt)));
  return matcher;
}

function promptAt(puzzle: Puzzle, index: number): PromptDef {
  const prompt = PROMPTS.get(puzzle.prompts[index]);
  if (!prompt) throw new Error(`Prompt "${puzzle.prompts[index]}" is in today's puzzle but no longer in the prompt bank`);
  return prompt;
}

/** The starting estimates as fractions of all players. */
function estimates(prompt: PromptDef): number[] {
  const sum = prompt.answers.reduce((total, [, share]) => total + share, 0);
  return prompt.answers.map(([, share]) => share / Math.max(100, sum));
}

/** Scores one prompt and adds it to today's counts. `text` is null for a timeout. */
async function judge(prompt: PromptDef, text: string | null, ctx: GameContext): Promise<Answered> {
  const counts = await ctx.tally.get(prompt.id);
  const players = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const shares = estimates(prompt).map((estimate, i) => blendedShare(estimate, counts[prompt.answers[i][0]] ?? 0, players));
  const mostCommon = prompt.answers[shares.indexOf(Math.max(...shares))][0];

  const found = text === null ? null : matcherFor(prompt).find(text);
  if (!found) {
    await ctx.tally.add(prompt.id, text === null ? TIMEOUT : MISS);
    // Kept so missing answers can be found and added: see `npm run rejected`.
    if (text !== null) await ctx.tally.add(`rejected:${prompt.id}`, text.toLowerCase().replace(/\s+/g, " ").trim());
    return { typed: text, answer: null, points: MISS_POINTS, tier: null, share: null, mostCommon };
  }

  const name = prompt.answers[found.index][0];
  const tier = tierForShare(shares[found.index]);
  await ctx.tally.add(prompt.id, name);
  // The points are fixed here and never recalculated, whatever later players answer.
  return {
    typed: text,
    answer: name,
    matchedAs: found.matched === name ? null : found.matched,
    points: TIERS[tier].points,
    tier,
    share: shares[found.index],
    mostCommon,
  };
}

const deadlinePassed = (state: State, now: number, grace = 0) =>
  state.phase === "prompt" && state.shownAt !== null && now > state.shownAt + LIMIT_MS + grace;

async function timeOut(puzzle: Puzzle, state: State, ctx: GameContext): Promise<State> {
  const answered = await judge(promptAt(puzzle, state.index), null, ctx);
  return { ...state, phase: "feedback", answered: [...state.answered, answered] };
}

function outcome(answered: Answered): RareOutcome {
  return {
    typed: answered.typed,
    answer: answered.answer,
    matchedAs: answered.matchedAs ?? null,
    points: answered.points,
    tier: answered.tier,
    tierLabel: answered.tier === null ? null : TIERS[answered.tier].label,
    sharePercent: answered.share === null ? null : Math.round(answered.share * 1000) / 10,
    mostCommon: answered.mostCommon,
  };
}

export default defineGame<Puzzle, State, RareView, RareAction>({
  meta: { id: "rare", name: "Deep Cut", tagline: "Seven prompts. The answer fewest people give scores most.", hue: 330 },

  createPuzzle: (day) => ({
    prompts: dealForDay([...PROMPT_BANK].sort((a, b) => a.id.localeCompare(b.id)), day.index, "rare", PROMPTS_PER_DAY).map((prompt) => prompt.id),
  }),

  start: () => ({ phase: "intro", index: 0, shownAt: null, answered: [] }),

  // The timer runs on the server's clock: if it ran out while the player was
  // away (or refreshing), the prompt is scored as a timeout the next time we look.
  settle: (puzzle, state, ctx) => (deadlinePassed(state, ctx.now, GRACE_MS) ? timeOut(puzzle, state, ctx) : state),

  async play(puzzle, state, action, ctx) {
    switch (action?.type) {
      case "start":
        return state.phase === "intro" ? { ...state, phase: "prompt", shownAt: ctx.now } : state;

      case "answer": {
        if (state.phase !== "prompt") return state; // too late: the timeout already stands
        const text = typeof action.text === "string" ? action.text.trim().slice(0, 80) : "";
        if (!answerKey(text)) throw new Rejected("Type an answer first.");
        const answered = await judge(promptAt(puzzle, state.index), text, ctx);
        return { ...state, phase: "feedback", answered: [...state.answered, answered] };
      }

      case "timeout":
        return deadlinePassed(state, ctx.now) ? timeOut(puzzle, state, ctx) : state;

      case "next": {
        if (state.phase !== "feedback") return state;
        const last = state.index + 1 >= puzzle.prompts.length;
        return last ? { ...state, phase: "done", shownAt: null } : { ...state, phase: "prompt", index: state.index + 1, shownAt: ctx.now };
      }

      default:
        throw new Rejected("Unknown move.");
    }
  },

  view(puzzle, state, ctx) {
    const showing = state.phase === "prompt" || state.phase === "feedback";
    return {
      phase: state.phase,
      index: state.index,
      total: puzzle.prompts.length,
      secondsPerPrompt: SECONDS_PER_PROMPT,
      prompt: showing ? promptAt(puzzle, state.index).prompt : null,
      msLeft: state.phase === "prompt" && state.shownAt !== null ? Math.max(0, state.shownAt + LIMIT_MS - ctx.now) : 0,
      outcome: state.phase === "feedback" ? outcome(state.answered[state.answered.length - 1]) : null,
      history: state.answered.map(({ points, tier }) => ({ points, tier })),
      tiers: TIERS.map(({ points, label }) => ({ points, label })),
    };
  },

  result(puzzle, state) {
    if (state.phase !== "done") return null;
    const accepted = state.answered.filter((answered) => answered.answer !== null).length;
    return {
      score: finalScore(state.answered.map((answered) => answered.points)),
      summary: `${accepted} of ${puzzle.prompts.length} answers accepted`,
      share: state.answered.map((answered) => (answered.tier === null ? MISS_EMOJI : TIERS[answered.tier].emoji)).join(""),
    };
  },

  // A simulated player: picks an answer in proportion to how popular it is
  // estimated to be. Stronger players lean towards rarer answers and miss less.
  bot(puzzle, view, rng, skill) {
    if (view.phase === "intro") return { type: "start" };
    if (view.phase !== "prompt") return { type: "next" };
    if (rng() < 0.04 + 0.16 * (1 - skill)) return { type: "answer", text: "no idea" };

    const prompt = promptAt(puzzle, view.index);
    const weights = prompt.answers.map(([, share]) => Math.pow(share, 1 - 0.55 * skill));
    let roll = rng() * weights.reduce((sum, weight) => sum + weight, 0);
    const chosen = prompt.answers.find((_, i) => (roll -= weights[i]) <= 0) ?? prompt.answers[0];
    return { type: "answer", text: chosen[0] };
  },
});
