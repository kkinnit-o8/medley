import type { PromptDef } from "./prompts/types";

/**
 * Forgiving answer matching for the rare-answer game.
 *
 * Both the accepted answers and the player's text go through the same
 * `answerKey` function, so the rules only need to be consistent, not
 * linguistically correct. On top of that, small typos are tolerated.
 */

const LETTER_MAP: Record<string, string> = {
  ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ð: "d", þ: "th", ł: "l", ı: "i",
};

const IRREGULAR: Record<string, string> = {
  men: "man", women: "woman", children: "child", feet: "foot", teeth: "tooth",
  mice: "mouse", geese: "goose", people: "person", oxen: "ox", lice: "louse",
};

/** Dropped wherever they appear. */
const FILLER = new Set(["the", "and", "of"]);
/** Dropped only at the start ("a christmas carol"). */
const LEADING = new Set(["a", "an"]);

function stem(token: string): string {
  if (IRREGULAR[token]) return IRREGULAR[token];
  let t = token;
  if (t.length >= 4 && t.endsWith("s") && !/(ss|us|is)$/.test(t)) t = t.slice(0, -1);
  if (t.length >= 4 && t.endsWith("e")) t = t.slice(0, -1);
  if (t.length >= 3 && t.endsWith("y")) t = t.slice(0, -1) + "i";
  if (t.length >= 4 && t.endsWith("v")) t = t.slice(0, -1) + "f";
  return t;
}

export function tokens(input: string): string[] {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[ßæœøđðþłı]/g, (c) => LETTER_MAP[c] ?? c)
    .replace(/&|\+/g, " and ")
    .replace(/['’‘`´.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** The comparison key for a piece of text, or "" if nothing is left. */
export function answerKey(input: string, ignore: ReadonlySet<string> = new Set()): string {
  const all = tokens(input);
  let kept = all.filter((t, i) => {
    if (FILLER.has(t)) return false;
    if (i === 0 && LEADING.has(t) && all.length > 1) return false;
    if (t === "n" && i > 0 && i < all.length - 1) return false; // "fish n chips"
    return true;
  });
  if (kept.length === 0) kept = all;
  const stemmed = kept.map(stem);
  const withoutIgnored = stemmed.filter((t) => !ignore.has(t));
  return (withoutIgnored.length > 0 ? withoutIgnored : stemmed).join("");
}

/** Typos allowed for an answer of this length. Short answers must be exact. */
export function allowedTypos(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

/** Damerau-Levenshtein distance (adjacent swaps count as one), capped at max + 1. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

export type Matcher = {
  /** Index into prompt.answers, or -1 when nothing matches. */
  match(input: string): number;
  /** Keys shared by two different answers: a content mistake. */
  collisions: { key: string; answers: [string, string] }[];
};

export function buildMatcher(prompt: PromptDef): Matcher {
  const ignore = new Set((prompt.ignore ?? []).map((w) => stem(tokens(w).join(""))));
  const keys = new Map<string, number>();
  const collisions: Matcher["collisions"] = [];

  prompt.answers.forEach(([name, , ...aliases], index) => {
    for (const text of [name, ...aliases]) {
      const key = answerKey(text, ignore);
      if (!key) continue;
      const existing = keys.get(key);
      if (existing === undefined) keys.set(key, index);
      else if (existing !== index) {
        collisions.push({ key, answers: [prompt.answers[existing][0], name] });
      }
    }
  });

  return {
    collisions,
    match(input: string): number {
      const key = answerKey(input, ignore);
      if (!key) return -1;
      const exact = keys.get(key);
      if (exact !== undefined) return exact;

      const max = allowedTypos(key.length);
      if (max === 0) return -1;
      let best = -1;
      let bestDistance = max + 1;
      for (const [candidate, index] of keys) {
        if (allowedTypos(candidate.length) === 0) continue;
        const d = editDistance(key, candidate, Math.min(max, bestDistance));
        if (d > max) continue;
        // Two typos only count when the first letter is right.
        if (d === 2 && candidate[0] !== key[0]) continue;
        const better =
          d < bestDistance ||
          // Equally close to two answers: take the more popular one, so a
          // typo can never earn more points than it deserves.
          (d === bestDistance && best !== -1 && prompt.answers[index][1] > prompt.answers[best][1]);
        if (better) {
          best = index;
          bestDistance = d;
        }
      }
      return best;
    },
  };
}
