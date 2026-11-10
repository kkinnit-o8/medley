import { Suspense } from "react";
import { connection } from "next/server";
import { config } from "@/medley.config";
import { ResultsPage } from "@/components/ResultsPage";
import { RunShell } from "@/components/RunShell";
import { Welcome } from "@/components/Welcome";
import { now } from "@/lib/clock";
import { dayKey, dayNumber } from "@/lib/day";
import { suggestNickname } from "@/lib/nickname";
import { currentPlayer, liveStreak } from "@/lib/player";
import { getResults } from "@/lib/results";
import { getRun, lineupFor } from "@/lib/run";

/**
 * The whole site is this one page. What it shows depends on where the player
 * is today: a welcome, the game they are on, or their results.
 */
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Today />
    </Suspense>
  );
}

async function Today() {
  // Everything below is personal and live, so it waits for a real request.
  await connection();
  const player = await currentPlayer();
  const at = now();
  const day = dayKey(at);

  if (!player) {
    const games = (await lineupFor(day, at)).map((game) => game.meta);
    return <Welcome dayNumber={dayNumber(day)} games={games} suggestion={suggestNickname()} />;
  }

  const run = await getRun(player.id, at);
  if (run.finished) {
    const results = await getResults(player, day, at);
    if (results) return <ResultsPage key={day} results={results} nickname={player.nickname} />;
  }
  return <RunShell key={run.day} initial={run} nickname={player.nickname} streak={liveStreak(player, day)} />;
}

function Loading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-4">
      <div className="flex h-13 items-center">
        <span className="display text-[1.7rem]">{config.siteName}</span>
      </div>
    </div>
  );
}
