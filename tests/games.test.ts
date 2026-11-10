import assert from "node:assert/strict";
import { test } from "node:test";
import { bearing, compass, distanceKm } from "../games/country/geo";
import * as country from "../games/country/scoring";
import { markGuess } from "../games/word/server";
import * as word from "../games/word/scoring";
import answers from "../games/word/data/answers.json";
import guesses from "../games/word/data/guesses.json";
import countries from "../games/country/data/countries.json";
import names from "../games/country/data/names.json";

test("word: letters are marked green, yellow and grey", () => {
  assert.deepEqual(markGuess("crane", "crane"), ["hit", "hit", "hit", "hit", "hit"]);
  assert.deepEqual(markGuess("moist", "ample"), ["near", "miss", "miss", "miss", "miss"]);
});

test("word: a repeated letter is only marked as often as it is in the answer", () => {
  assert.deepEqual(markGuess("allee", "apple"), ["hit", "near", "miss", "miss", "hit"]);
  assert.deepEqual(markGuess("babes", "abbey"), ["near", "near", "hit", "hit", "miss"]);
  assert.deepEqual(markGuess("geese", "eagle"), ["near", "near", "miss", "miss", "hit"]);
});

test("word: points by number of guesses", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(word.scoreFor), [100, 90, 75, 60, 45, 30]);
  assert.equal(word.scoreFor(null), 0);
});

test("word: lists are five-letter words and every answer is a valid guess", () => {
  const valid = new Set(guesses);
  assert.ok(answers.length > 1500 && guesses.length > answers.length);
  assert.ok(guesses.every((w) => /^[a-z]{5}$/.test(w)));
  assert.ok(answers.every((w) => valid.has(w)));
});

test("country: distance and direction between two known points", () => {
  const oslo = { lat: 59.91, lon: 10.75 };
  const paris = { lat: 48.86, lon: 2.35 };
  assert.ok(Math.abs(distanceKm(oslo, paris) - 1343) < 15);
  assert.equal(compass(bearing(oslo, paris)), "SW");
  assert.ok(Math.abs(bearing(paris, oslo) - 20.5) < 1);
  assert.deepEqual([0, 22.4, 22.6, 45, 90, 135, 180, 225, 270, 315, 337.6, 359.9].map(compass), ["N", "N", "NE", "NE", "E", "SE", "S", "SW", "W", "NW", "N", "N"]);
  assert.equal(compass(bearing({ lat: 0, lon: 0 }, { lat: 10, lon: 0 })), "N");
  assert.equal(compass(bearing({ lat: 0, lon: 170 }, { lat: 0, lon: -170 })), "E"); // across the date line
});

test("country: points by number of guesses, and partial credit for a near miss", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => country.scoreFor(n, 0)), [100, 90, 75, 60, 45, 30]);
  assert.equal(country.scoreFor(null, 0), country.FAIL_MAX_POINTS);
  assert.equal(country.scoreFor(null, country.FAIL_ZERO_AT_KM / 2), country.FAIL_MAX_POINTS / 2);
  assert.equal(country.scoreFor(null, country.FAIL_ZERO_AT_KM), 0);
  assert.equal(country.scoreFor(null, 15_000), 0);
  assert.ok(country.scoreFor(null, 1) < country.POINTS_BY_GUESS[5], "a miss never beats a solve");
});

test("country: proximity runs from 100 down to 0", () => {
  assert.equal(country.proximity(0), 100);
  assert.equal(country.proximity(country.FARTHEST_KM / 2), 50);
  assert.equal(country.proximity(country.FARTHEST_KM), 0);
  assert.equal(country.proximity(25_000), 0);
});

test("country: every country has an outline, a centre point and a name for the guess box", () => {
  assert.ok(countries.length >= 190);
  const listed = new Set(names.map((n) => n.id));
  for (const c of countries) {
    assert.ok(c.path.startsWith("M") && c.path.length > 20, c.name);
    assert.ok(c.lat >= -90 && c.lat <= 90 && c.lon >= -180 && c.lon <= 180, c.name);
    assert.ok(listed.has(c.id), c.name);
  }
  assert.equal(new Set(countries.map((c) => c.name)).size, countries.length);
});
