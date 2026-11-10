import { dayKey, epochDay, isDayKey } from "./day";

/**
 * The server's clock. Everything that depends on "now" goes through here.
 *
 * For testing, start the server with MEDLEY_DATE=YYYY-MM-DD to pretend it is
 * that day. The time of day stays real, so timers and the countdown still
 * behave normally.
 */
export function now(): number {
  const real = Date.now();
  const pretend = process.env.MEDLEY_DATE;
  if (!pretend) return real;
  if (!isDayKey(pretend)) throw new Error(`MEDLEY_DATE must look like 2026-11-10, got "${pretend}"`);

  let shifted = real + (epochDay(pretend) - epochDay(dayKey(real))) * 86_400_000;
  // A daylight-saving change between the two dates can push us an hour over midnight.
  if (dayKey(shifted) < pretend) shifted += 3_600_000;
  else if (dayKey(shifted) > pretend) shifted -= 3_600_000;
  return shifted;
}

export function today(): string {
  return dayKey(now());
}
