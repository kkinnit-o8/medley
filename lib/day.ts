import { config } from "@/medley.config";

const DAY_MS = 86_400_000;

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: config.timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function localParts(ms: number): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(new Date(ms))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return parts;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The day a moment belongs to, as "YYYY-MM-DD" in the site's timezone. */
export function dayKey(ms: number): string {
  const p = localParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Whole days since 1970-01-01. Stable input for picking a day's puzzles. */
export function epochDay(key: string): number {
  return Math.round(Date.parse(`${key}T00:00:00Z`) / DAY_MS);
}

export function addDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 1 on the launch date, 2 the day after, and so on. */
export function dayNumber(key: string): number {
  return epochDay(key) - epochDay(config.launchDate) + 1;
}

/** The moment the next run starts: the coming midnight in the site's timezone. */
export function nextResetAt(ms: number): number {
  const tomorrow = Date.parse(`${addDays(dayKey(ms), 1)}T00:00:00Z`);
  // Start from "midnight UTC" and correct by the zone's offset at that time.
  // Two passes settle the rare case where the offset changes across midnight.
  let guess = tomorrow;
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess);
    const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess = tomorrow - (asIfUtc - guess);
  }
  return guess;
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
