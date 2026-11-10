/**
 * Checks the rare-answer prompt bank for mistakes that would hurt players.
 *
 *   npm run check:prompts              check every pack listed in prompts/index.ts
 *   npm run check:prompts -- food      check only games/rare/prompts/food.ts
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildMatcher } from "../games/rare/match";
import type { PromptDef } from "../games/rare/prompts/types";
import { PROMPTS_PER_DAY, TIERS, tierForShare } from "../games/rare/scoring";

async function load(): Promise<{ source: string; prompts: PromptDef[] }[]> {
  const names = process.argv.slice(2);
  if (names.length === 0) {
    const { PROMPT_BANK } = await import("../games/rare/prompts/index");
    return [{ source: "prompts/index.ts", prompts: PROMPT_BANK }];
  }
  return Promise.all(
    names.map(async (name) => {
      const file = path.resolve("games/rare/prompts", name.endsWith(".ts") ? name : `${name}.ts`);
      const mod = await import(pathToFileURL(file).href);
      return { source: path.basename(file), prompts: mod.default as PromptDef[] };
    }),
  );
}

async function main() {
  const packs = await load();
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, string>();
  const texts = new Map<string, string>();
  let count = 0;
  let answerCount = 0;

  for (const { source, prompts } of packs) {
    if (!Array.isArray(prompts)) {
      errors.push(`${source}: default export must be an array of prompts`);
      continue;
    }
    for (const prompt of prompts) {
      count++;
      const where = `${source} > ${prompt.id ?? "(no id)"}`;
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(prompt.id ?? "")) errors.push(`${where}: id must be a lowercase slug like "pasta-dish"`);
      if (ids.has(prompt.id)) errors.push(`${where}: id is already used in ${ids.get(prompt.id)}`);
      ids.set(prompt.id, source);

      const text = (prompt.prompt ?? "").trim();
      if (!/^Name /.test(text)) errors.push(`${where}: prompt should start with "Name ..."`);
      if (text.length > 70) warnings.push(`${where}: prompt is ${text.length} characters; keep it under 70 so it fits a phone screen`);
      const textKey = text.toLowerCase();
      if (texts.has(textKey)) errors.push(`${where}: same prompt text as ${texts.get(textKey)}`);
      texts.set(textKey, where);

      if (!Array.isArray(prompt.answers) || prompt.answers.length < 6) {
        errors.push(`${where}: needs at least 6 answers`);
        continue;
      }
      answerCount += prompt.answers.length;

      let shareSum = 0;
      const tierCounts = TIERS.map(() => 0);
      for (const answer of prompt.answers) {
        const [name, share, ...aliases] = answer;
        if (typeof name !== "string" || !name.trim()) errors.push(`${where}: an answer has no name`);
        if (typeof share !== "number" || !(share > 0) || share > 100) errors.push(`${where} > ${name}: share must be a number above 0 and at most 100`);
        if (aliases.some((alias) => typeof alias !== "string" || !alias.trim())) errors.push(`${where} > ${name}: aliases must be non-empty strings`);
        shareSum += share;
        tierCounts[tierForShare(share / 100)]++;
      }
      if (shareSum > 105) errors.push(`${where}: shares add up to ${shareSum.toFixed(1)}%; they are % of players, so keep the total at or under 100`);
      if (shareSum < 55) warnings.push(`${where}: shares add up to only ${shareSum.toFixed(1)}%; most players should be covered`);
      if (tierCounts[0] === 0 && tierCounts[1] === 0) warnings.push(`${where}: no answer is estimated at ${TIERS[1].minShare * 100}% or more, so nothing scores in the two most common tiers`);

      const matcher = buildMatcher(prompt);
      for (const { key, answers } of matcher.collisions) {
        errors.push(`${where}: "${answers[0]}" and "${answers[1]}" both match the text "${key}"; remove the alias from one of them`);
      }
      prompt.answers.forEach(([name], index) => {
        if (matcher.match(name) !== index) errors.push(`${where}: typing "${name}" does not match its own answer`);
      });
    }
  }

  for (const warning of warnings) console.log(`warning  ${warning}`);
  for (const error of errors) console.log(`ERROR    ${error}`);
  const days = Math.floor(count / PROMPTS_PER_DAY);
  console.log(
    `\n${count} prompts, ${answerCount} answers (${count ? Math.round(answerCount / count) : 0} per prompt), enough for ${days} days without a repeat. ` +
      `${errors.length} errors, ${warnings.length} warnings.`,
  );
  if (errors.length > 0) process.exit(1);
}

main();
