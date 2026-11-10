import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "../medley.config";
import { addDays, dayKey, dayNumber, epochDay, nextResetAt } from "../lib/day";
import { checkNickname, suggestNickname } from "../lib/nickname";
import { dealForDay, seededRng } from "../lib/rng";

// These dates assume the site's timezone is Europe/Oslo.
const oslo = config.timezone === "Europe/Oslo";

test("a day runs from midnight to midnight in the site's timezone", { skip: !oslo }, () => {
  assert.equal(dayKey(Date.UTC(2026, 10, 10, 22, 59, 59)), "2026-11-10"); // 23:59:59 in winter
  assert.equal(dayKey(Date.UTC(2026, 10, 10, 23, 0, 0)), "2026-11-11");
  assert.equal(dayKey(Date.UTC(2026, 5, 30, 21, 59, 59)), "2026-06-30"); // 23:59:59 in summer
  assert.equal(dayKey(Date.UTC(2026, 5, 30, 22, 0, 0)), "2026-07-01");
});

test("the next run starts at local midnight, including across clock changes", { skip: !oslo }, () => {
  assert.equal(nextResetAt(Date.UTC(2026, 10, 10, 12)), Date.UTC(2026, 10, 10, 23));
  assert.equal(nextResetAt(Date.UTC(2026, 10, 10, 22, 59, 59)), Date.UTC(2026, 10, 10, 23));
  assert.equal(nextResetAt(Date.UTC(2026, 10, 10, 23)), Date.UTC(2026, 10, 11, 23));
  // Clocks go forward on 29 March 2026 and back on 25 October 2026.
  assert.equal(nextResetAt(Date.UTC(2026, 2, 28, 12)), Date.UTC(2026, 2, 28, 23));
  assert.equal(nextResetAt(Date.UTC(2026, 2, 29, 12)), Date.UTC(2026, 2, 29, 22));
  assert.equal(nextResetAt(Date.UTC(2026, 9, 24, 12)), Date.UTC(2026, 9, 24, 22));
  assert.equal(nextResetAt(Date.UTC(2026, 9, 25, 12)), Date.UTC(2026, 9, 25, 23));
});

test("day numbers count from the launch date", () => {
  assert.equal(dayNumber(config.launchDate), 1);
  assert.equal(dayNumber(addDays(config.launchDate, 141)), 142);
  assert.equal(epochDay("1970-01-02"), 1);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("puzzles are dealt without repeats until the list runs out, and the same day always gets the same ones", () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  const perCycle = Math.floor(items.length / 7);
  for (const cycleStart of [0, perCycle * 3]) {
    const seen = new Set<number>();
    for (let day = cycleStart; day < cycleStart + perCycle; day++) {
      const dealt = dealForDay(items, day, "test", 7);
      assert.equal(dealt.length, 7);
      for (const item of dealt) {
        assert.ok(!seen.has(item), `item ${item} repeated within one cycle`);
        seen.add(item);
      }
    }
    assert.equal(seen.size, perCycle * 7);
  }
  assert.deepEqual(dealForDay(items, 20_000, "test", 7), dealForDay(items, 20_000, "test", 7));
  assert.notDeepEqual(dealForDay(items, 20_000, "test", 7), dealForDay(items, 20_001, "test", 7));
  assert.notDeepEqual(dealForDay(items, 20_000, "a", 7), dealForDay(items, 20_000, "b", 7));
  assert.throws(() => dealForDay([1, 2], 0, "test", 7));
});

test("nicknames: length, characters and a basic profanity filter", () => {
  const ok = (name: string) => checkNickname(name).ok;
  assert.equal(ok("Kasper"), true);
  assert.equal(ok("  Åse   Marie "), true);
  assert.deepEqual(checkNickname("  Åse   Marie "), { ok: true, nickname: "Åse Marie" });
  assert.equal(ok("quiz_master-99"), true);
  assert.equal(ok("Dickens"), true);
  assert.equal(ok("Cassandra"), true);
  assert.equal(ok("x"), false);
  assert.equal(ok("a".repeat(config.nickname.maxLength + 1)), false);
  assert.equal(ok("<script>"), false);
  assert.equal(ok("sh1thead"), false);
  assert.equal(ok("F.U.C.K"), false);
  assert.equal(ok("fuuuuck"), false);
  assert.equal(ok("a$$"), false);
  assert.equal(ok(42 as unknown as string), false);
  for (let i = 0; i < 50; i++) assert.equal(ok(suggestNickname(seededRng(`n${i}`))), true);
});
