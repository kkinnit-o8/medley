import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { addDays } from "./day";
import * as store from "./store";

/**
 * Players are anonymous. The browser holds a random id in a cookie that
 * scripts cannot read; that id is the only key to a player's run, so it is
 * never shown to anyone else.
 */
const COOKIE = "medley_player";
const ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function currentPlayer(): Promise<store.Player | undefined> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id || !ID_FORMAT.test(id)) return undefined;
  return store.getPlayer(id);
}

/** Creates a player and stores their id in the browser. Call only from a route handler. */
export async function registerPlayer(nickname: string, at: number): Promise<store.Player> {
  const id = randomUUID();
  await store.createPlayer({ id, nickname, at });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return (await store.getPlayer(id))!;
}

/** The streak to show on a given day: it only counts if it reaches today or yesterday. */
export function liveStreak(player: Pick<store.Player, "streak" | "last_completed">, day: string): number {
  if (!player.last_completed) return 0;
  return player.last_completed === day || player.last_completed === addDays(day, -1) ? player.streak : 0;
}

/** Updates the streak when a player completes a day's run. */
export async function recordCompletion(playerId: string, day: string): Promise<void> {
  const player = await store.getPlayer(playerId);
  if (!player || player.last_completed === day) return;
  const streak = player.last_completed === addDays(day, -1) ? player.streak + 1 : 1;
  await store.saveStreak(playerId, streak, day);
}
