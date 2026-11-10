/**
 * Shows how the rare-answer game would judge what a player types.
 *
 *   npm run try -- pasta-dish "spag bol" "sushi"
 *   npm run try -- --file path/to/pack.ts pasta-dish "spag bol"
 *
 * Handy when adding answers: type what a player might, see what gets rejected.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildMatcher } from "../games/rare/match";
import type { PromptDef } from "../games/rare/prompts/types";
import { TIERS, tierForShare } from "../games/rare/scoring";

async function main() {
  const args = process.argv.slice(2);
  let prompts: PromptDef[];
  if (args[0] === "--file") {
    prompts = (await import(pathToFileURL(path.resolve(args[1])).href)).default;
    args.splice(0, 2);
  } else {
    prompts = (await import("../games/rare/prompts/index")).PROMPT_BANK;
  }

  const [id, ...inputs] = args;
  const prompt = prompts.find((candidate) => candidate.id === id);
  if (!prompt) {
    console.log(`No prompt with id "${id}". Available: ${prompts.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }
  if (inputs.length === 0) {
    console.log(`${prompt.prompt}: ${prompt.answers.length} answers. Pass some text to try, in quotes.`);
    return;
  }

  const matcher = buildMatcher(prompt);
  const total = Math.max(100, prompt.answers.reduce((sum, [, share]) => sum + share, 0));
  for (const input of inputs) {
    const index = matcher.match(input);
    if (index === -1) {
      console.log(`REJECTED  "${input}"`);
      continue;
    }
    const [name, share] = prompt.answers[index];
    console.log(`accepted  "${input}" -> ${name} (${share}% est., ${TIERS[tierForShare(share / total)].points} pts)`);
  }
}

main();
