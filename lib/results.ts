import "server-only";
import { config } from "@/medley.config";
import { dayNumber, nextResetAt } from "./day";
import { liveStreak } from "./player";
import { lineupFor } from "./run";
import * as store from "./store";

/**
 * Everything the results page shows for one player on one day. Works for any
 * lineup: it only reads scores, summaries and share lines.
 */

export type GameResults = {
  id: string;
  name: string;
  hue: number;
  score: number;
  summary: string;
  /** Everyone who has finished this game today. */
  players: number;
  average: number;
  /** Ten bars: scores 0-9, 10-19, ... 90-100. */
  histogram: number[];
  /** Which bar this player's score falls in. */
  myBar: number;
};

export type LeaderboardEntry = { rank: number; nickname: string; total: number; isMe: boolean };

export type Results = {
  day: string;
  dayNumber: number;
  total: number;
  maxTotal: number;
  /** Players who have finished today's whole run, this one included. */
  players: number;
  /** False while there are too few players for a rank to mean anything. */
  ranked: boolean;
  /** 1 = best. Players on the same total share a rank. */
  rank: number;
  /** Share of the other players with a lower total, 0-100. */
  betterThan: number;
  /** 1 = the first player to finish today. */
  finishOrder: number;
  games: GameResults[];
  leaderboard: LeaderboardEntry[];
  /** This player's row when they are below the leaderboard, otherwise null. */
  myRow: LeaderboardEntry | null;
  streak: number;
  bestStreak: number;
  shareText: string;
  msUntilNextRun: number;
};

export async function getResults(player: store.Player, day: string, at: number): Promise<Results | null> {
  const run = await store.getRun(player.id, day);
  if (!run) return null;

  const lineup = await lineupFor(day, at);
  const sessions = new Map((await store.listSessions(player.id, day)).map((session) => [session.game_id, session]));

  const games: GameResults[] = [];
  for (const game of lineup) {
    const session = sessions.get(game.meta.id);
    const score = session?.score ?? 0;
    const stats = await store.gameStats(day, game.meta.id);
    games.push({
      id: game.meta.id,
      name: game.meta.name,
      hue: game.meta.hue,
      score,
      summary: session?.summary ?? "",
      players: stats.players,
      average: stats.average,
      histogram: stats.histogram,
      myBar: Math.min(9, Math.floor(score / 10)),
    });
  }

  const standing = await store.standing(day, run.total, run.finished_at);
  const rank = standing.above + 1;

  let previous: LeaderboardEntry | undefined;
  const top = await store.leaderboard(day, config.leaderboardSize);
  const leaderboard = top.map((row, index): LeaderboardEntry => {
    const entry = {
      rank: previous && previous.total === row.total ? previous.rank : index + 1,
      nickname: row.nickname,
      total: row.total,
      isMe: row.player_id === player.id,
    };
    previous = entry;
    return entry;
  });
  const onBoard = leaderboard.some((entry) => entry.isMe);

  const maxTotal = lineup.length * 100;
  const shareText = [
    `${config.siteName} #${dayNumber(day)} · ${run.total}/${maxTotal}`,
    ...lineup.map((game) => {
      const session = sessions.get(game.meta.id);
      return `${game.meta.name} ${session?.score ?? 0} · ${session?.share ?? ""}`.trim();
    }),
    config.siteUrl,
  ].join("\n");

  return {
    day,
    dayNumber: dayNumber(day),
    total: run.total,
    maxTotal,
    players: standing.players,
    ranked: standing.players >= config.minPlayersForRanking,
    rank,
    betterThan: standing.players > 1 ? Math.floor((standing.below / (standing.players - 1)) * 100) : 0,
    finishOrder: standing.earlier + 1,
    games,
    leaderboard,
    myRow: onBoard ? null : { rank, nickname: player.nickname, total: run.total, isMe: true },
    streak: liveStreak(player, day),
    bestStreak: player.best_streak,
    shareText,
    msUntilNextRun: Math.max(0, nextResetAt(at) - at),
  };
}

/** 1 -> "1st", 22 -> "22nd", 113 -> "113th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}
