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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[ßæœøđðþłı]/g, (c) => LETTER_MAP[c] ?? c)
    // Symbols that are part of a name: "C++", "C#", "A+", "fish & chips".
    .replace(/\+\+/g, " plusplus ")
    .replace(/(?<=[a-z0-9])#/g, " sharp ")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/['’‘`´.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** The comparison key for a piece of text, or "" if nothing is left. */
export function answerKey(input: string, ignore: ReadonlySet<string> = new Set()): string {
  // Nothing but a symbol or two ("?", "...", "π"): the symbol itself is the answer.
  const bare = input.normalize("NFKC").trim();
  if (bare && [...bare].length <= 3 && !/[a-z0-9]/i.test(bare)) return `=${bare}`;

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

/**
 * Typos allowed for an answer whose key is this long: none for the very
 * shortest, one up to eight letters, two beyond that.
 */
export function allowedTypos(length: number): number {
  if (length <= 3) return 0;
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
  /** The same, plus which of the answer's names the input matched. Null when nothing matches. */
  find(input: string): { index: number; matched: string } | null;
  /** Keys shared by two different answers, or by an answer and the reject list: a content mistake. */
  collisions: { key: string; answers: [string, string] }[];
};

/** A prompt's filler words in the form answerKey() compares against. */
export function fillerWords(prompt: PromptDef): Set<string> {
  return new Set((prompt.ignore ?? []).map((word) => stem(tokens(word).join(""))));
}

export function buildMatcher(prompt: PromptDef): Matcher {
  const ignore = fillerWords(prompt);
  const keys = new Map<string, { index: number; matched: string }>();
  const collisions: Matcher["collisions"] = [];

  prompt.answers.forEach(([name, , ...aliases], index) => {
    for (const text of [name, ...aliases]) {
      const key = answerKey(text, ignore);
      if (!key) continue;
      const existing = keys.get(key);
      if (existing === undefined) keys.set(key, { index, matched: text });
      else if (existing.index !== index) {
        collisions.push({ key, answers: [prompt.answers[existing.index][0], name] });
      }
    }
  });

  const rejected = new Set<string>();
  for (const text of prompt.reject ?? []) {
    const key = answerKey(text, ignore);
    const accepted = keys.get(key);
    if (accepted !== undefined) collisions.push({ key, answers: [prompt.answers[accepted.index][0], `reject: ${text}`] });
    else if (key) rejected.add(key);
  }

  function find(input: string): { index: number; matched: string } | null {
    const key = answerKey(input, ignore);
    if (!key || rejected.has(key)) return null;
    const exact = keys.get(key);
    if (exact !== undefined) return exact;

    let best: { index: number; matched: string } | null = null;
    let bestDistance = Infinity;
    for (const [candidate, entry] of keys) {
      const limit = allowedTypos(candidate.length);
      if (limit === 0) continue;
      const d = editDistance(key, candidate, limit);
      if (d > limit) continue;
      // Four-letter answers and two-typo matches must at least start with the right letter.
      if ((candidate.length === 4 || d === 2) && candidate[0] !== key[0]) continue;
      const better =
        d < bestDistance ||
        // Equally close to two answers: take the more popular one, so a
        // typo can never earn more points than it deserves.
        (d === bestDistance && best !== null && prompt.answers[entry.index][1] > prompt.answers[best.index][1]);
      if (better) {
        best = entry;
        bestDistance = d;
      }
    }
    return best;
  }

  return { collisions, find, match: (input) => find(input)?.index ?? -1 };
}
