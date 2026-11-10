import { config } from "@/medley.config";

/**
 * Nickname rules: length limits, a small character set and a basic profanity
 * filter. The filter is deliberately simple: it catches the obvious cases,
 * including common letter swaps (sh1t, a$$), and nothing more.
 */

// Matched anywhere in the name, so only words that rarely appear inside innocent ones.
const BLOCKED_ANYWHERE = [
  "fuck", "shit", "cunt", "nigger", "nigga", "faggot", "bitch", "whore", "slut", "wank", "bollock", "asshole", "arsehole",
  "dickhead", "motherf", "pussy", "retard", "rapist", "nazi", "hitler", "kike", "spastic", "tranny", "cocksuck", "jizz",
  "twat", "porn", "penis", "vagina", "fitte", "faen", "helvete", "jævla", "jaevla", "javla", "kuk", "hore", "pikk",
  "fanden", "satan", "drittsekk", "kukk", "knull",
];
// Matched only as the whole name, because they are common inside other words.
const BLOCKED_WHOLE = ["ass", "arse", "cock", "dick", "cum", "tit", "tits", "fag", "hoe", "anal", "sex", "rape", "piss", "crap", "dritt"];

const LOOKALIKES: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i" };

function squash(name: string): string {
  return name
    .toLowerCase()
    .replace(/[013457@8$!]/g, (c) => LOOKALIKES[c] ?? c)
    .replace(/[^a-zæøå]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1"); // "fuuuuck" -> "fuuck"
}

export function isProfane(name: string): boolean {
  const squashed = squash(name);
  const tight = squashed.replace(/(.)\1+/g, "$1"); // "fuuck" -> "fuck"
  return (
    BLOCKED_ANYWHERE.some((word) => squashed.includes(word) || tight.includes(word)) ||
    BLOCKED_WHOLE.includes(squashed) ||
    BLOCKED_WHOLE.includes(tight)
  );
}

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; error: string };

export function checkNickname(input: unknown): NicknameCheck {
  if (typeof input !== "string") return { ok: false, error: "Enter a nickname." };
  const nickname = input.normalize("NFC").replace(/\s+/g, " ").trim();
  const { minLength, maxLength } = config.nickname;
  const length = [...nickname].length;
  if (length < minLength) return { ok: false, error: `Use at least ${minLength} characters.` };
  if (length > maxLength) return { ok: false, error: `Keep it to ${maxLength} characters or fewer.` };
  if (!/^[\p{L}\p{N} ._-]+$/u.test(nickname)) return { ok: false, error: "Use letters, numbers, spaces, dots, dashes or underscores." };
  if (isProfane(nickname)) return { ok: false, error: "Pick a different nickname, please." };
  return { ok: true, nickname };
}

const FIRST = ["Quiet", "Brisk", "Lucky", "Amber", "Nimble", "Mellow", "Bold", "Sunny", "Clever", "Steady", "Swift", "Polar", "Velvet", "Copper", "Misty", "Jolly", "Dapper", "Witty", "Calm", "Rapid"];
const SECOND = ["Otter", "Falcon", "Maple", "Comet", "Badger", "Heron", "Lynx", "Pebble", "Walrus", "Finch", "Puffin", "Moose", "Willow", "Marten", "Gecko", "Raven", "Tulip", "Bison", "Wren", "Fjord"];

/** A friendly suggestion such as "BriskHeron42". */
export function suggestNickname(random: () => number = Math.random): string {
  const pick = (list: string[]) => list[Math.floor(random() * list.length)];
  return `${pick(FIRST)}${pick(SECOND)}${10 + Math.floor(random() * 90)}`;
}
