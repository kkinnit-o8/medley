import assert from "node:assert/strict";
import { test } from "node:test";
import { answerKey, buildMatcher } from "../games/rare/match";
import type { PromptDef } from "../games/rare/prompts/types";
import { ESTIMATE_WEIGHT, MIN_REAL_ANSWERS, TIERS, blendedShare, finalScore, tierForShare } from "../games/rare/scoring";

const fruit: PromptDef = {
  id: "fruit",
  prompt: "Name a fruit",
  ignore: ["fruit"],
  answers: [
    ["Apple", 30, "granny smith", "eple"],
    ["Strawberry", 12, "jordbær"],
    ["Crème de cassis berry", 1, "blackcurrant"],
    ["Fish and Chips fruit", 1],
    ["Kiwi", 5, "kiwifruit", "chinese gooseberry"],
    ["Plum", 3],
    ["Peach", 3],
    ["Fig", 2],
  ],
};
const name = (input: string) => {
  const index = buildMatcher(fruit).match(input);
  return index === -1 ? null : fruit.answers[index][0];
};

test("matching ignores case, accents, punctuation and spacing", () => {
  assert.equal(name("  APPLE "), "Apple");
  assert.equal(name("creme de cassis berry"), "Crème de cassis berry");
  assert.equal(name("Jordbaer"), "Strawberry");
  assert.equal(name("jordbær"), "Strawberry");
  assert.equal(name("granny-smith!"), "Apple");
  assert.equal(name("kiwi fruit"), "Kiwi");
});

test("matching forgives plurals, articles, 'and' and filler words", () => {
  assert.equal(name("apples"), "Apple");
  assert.equal(name("strawberries"), "Strawberry");
  assert.equal(name("an apple"), "Apple");
  assert.equal(name("the apple fruit"), "Apple");
  assert.equal(name("fish & chips fruit"), "Fish and Chips fruit");
  assert.equal(name("fish n chips fruit"), "Fish and Chips fruit");
});

test("small typos are forgiven; the shorter the answer, the stricter", () => {
  assert.equal(name("strawbery"), "Strawberry");
  assert.equal(name("starwberry"), "Strawberry"); // swapped letters
  assert.equal(name("stawbery"), "Strawberry"); // two typos in a long answer
  assert.equal(name("xtrawbery"), null); // ...but not with the first letter wrong too
  assert.equal(name("appel"), "Apple");
  assert.equal(name("peech"), "Peach");
  assert.equal(name("plim"), "Plum"); // four letters: one typo, same first letter
  assert.equal(name("glum"), null);
  assert.equal(name("fog"), null); // three letters: exact only
  assert.equal(name("fig"), "Fig");
});

test("wrong or empty answers are rejected", () => {
  assert.equal(name("carrot"), null);
  assert.equal(name(""), null);
  assert.equal(name("fruit"), null); // only the filler word
  assert.equal(name("???"), null);
});

test("a typo that is equally close to two answers goes to the more common one", () => {
  const prompt: PromptDef = { id: "x", prompt: "Name a x", answers: [["Marten", 1], ["Martin", 20], ["Aaaaaa", 1], ["Bbbbbb", 1], ["Cccccc", 1], ["Dddddd", 1]] };
  assert.equal(prompt.answers[buildMatcher(prompt).match("Marton")][0], "Martin");
});

test("look-alike wrong answers can be turned away", () => {
  const answers: PromptDef["answers"] = [["Zambia", 10, "zambian republic"], ["Austria", 20], ["Chad", 5], ["Mali", 5], ["Niger", 5], ["Nepal", 5]];
  const loose = buildMatcher({ id: "x", prompt: "Name a landlocked country", answers });
  const strict = buildMatcher({ id: "x", prompt: "Name a landlocked country", reject: ["Gambia", "Nigeria"], answers });
  assert.equal(answers[loose.match("Gambia")][0], "Zambia"); // one letter off: let through unless told otherwise
  assert.equal(strict.match("Gambia"), -1);
  assert.equal(strict.match("the gambia"), -1);
  assert.equal(answers[strict.match("Zambia")][0], "Zambia");
  assert.equal(answers[strict.match("Zambai")][0], "Zambia");
  assert.equal(loose.match("Australia"), -1); // two letters off a seven-letter answer is too far
  const clash = buildMatcher({ id: "x", prompt: "Name a landlocked country", reject: ["Zambian Republic"], answers });
  assert.equal(clash.collisions.length, 1);
});

test("the matcher reports two answers that share a name", () => {
  const prompt: PromptDef = { id: "x", prompt: "Name a x", answers: [["Aubergine", 5, "eggplant"], ["Eggplants", 5]] };
  assert.equal(buildMatcher(prompt).collisions.length, 1);
});

test("symbols can be answers, and names with symbols in them stay distinct", () => {
  const prompt: PromptDef = {
    id: "x",
    prompt: "Name a x",
    answers: [["Question mark", 10, "?"], ["Ellipsis", 5, "...", "…"], ["Pi", 5, "π"], ["C", 5], ["C++", 5, "cpp"], ["C#", 5], ["Ampersand", 5, "&"]],
  };
  const pick = (input: string) => {
    const index = buildMatcher(prompt).match(input);
    return index === -1 ? null : prompt.answers[index][0];
  };
  assert.equal(buildMatcher(prompt).collisions.length, 0);
  assert.equal(pick("?"), "Question mark");
  assert.equal(pick(" ... "), "Ellipsis");
  assert.equal(pick("π"), "Pi");
  assert.equal(pick("pi"), "Pi");
  assert.equal(pick("&"), "Ampersand");
  assert.equal(pick("!"), null);
  assert.equal(pick("c"), "C");
  assert.equal(pick("C++"), "C++");
  assert.equal(pick("c plus plus"), "C++");
  assert.equal(pick("c#"), "C#");
  assert.equal(pick("C Sharp"), "C#");
  assert.equal(answerKey("   "), "");
  assert.equal(answerKey("fish & chips"), answerKey("fish and chips"));
});

test("rarity tiers follow the thresholds", () => {
  assert.equal(TIERS[tierForShare(0.5)].points, 10);
  assert.equal(TIERS[tierForShare(TIERS[0].minShare)].points, 10);
  assert.equal(TIERS[tierForShare(TIERS[0].minShare - 0.0001)].points, 25);
  assert.equal(TIERS[tierForShare(TIERS[2].minShare)].points, 50);
  assert.equal(TIERS[tierForShare(TIERS[3].minShare)].points, 75);
  assert.equal(TIERS[tierForShare(TIERS[3].minShare - 0.0001)].points, 100);
  assert.equal(TIERS[tierForShare(0)].points, 100);
});

test("real answers are only blended in once there are enough of them", () => {
  assert.equal(blendedShare(0.3, 0, MIN_REAL_ANSWERS - 1), 0.3);
  const total = MIN_REAL_ANSWERS;
  const weight = total / (total + ESTIMATE_WEIGHT);
  assert.ok(Math.abs(blendedShare(0.3, 5, total) - (0.3 * (1 - weight) + (5 / total) * weight)) < 1e-9);
  // With lots of real data the estimate barely matters.
  assert.ok(Math.abs(blendedShare(0.3, 10, 10_000) - 0.001) < 0.003);
});

test("the final score is the seven answers divided by seven", () => {
  assert.equal(finalScore([100, 100, 100, 100, 100, 100, 100]), 100);
  assert.equal(finalScore([0, 0, 0, 0, 0, 0, 0]), 0);
  assert.equal(finalScore([10, 25, 50, 75, 100, 0, 0]), 37);
});
