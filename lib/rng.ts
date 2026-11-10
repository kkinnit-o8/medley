/** Small deterministic random helpers, so a date always produces the same puzzle. */

export type Rng = () => number;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A repeatable random number generator (mulberry32) seeded from text. */
export function seededRng(seed: string): Rng {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Choose `count` items for a day so that nothing repeats until the whole list
 * has been used: the list is shuffled once per cycle and dealt out day by day.
 */
export function dealForDay<T>(items: readonly T[], dayIndex: number, salt: string, count = 1): T[] {
  if (items.length < count) throw new Error(`"${salt}" needs at least ${count} items, has ${items.length}`);
  const daysPerCycle = Math.floor(items.length / count);
  const cycle = Math.floor(dayIndex / daysPerCycle);
  const position = ((dayIndex % daysPerCycle) + daysPerCycle) % daysPerCycle;
  const order = shuffled(items, seededRng(`${salt}:${cycle}`));
  return order.slice(position * count, position * count + count);
}
