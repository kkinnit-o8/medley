import type { RunGame } from "@/lib/run";
import { CheckIcon } from "./Icons";

/** The row under the header: every game in today's run, where you are, and your points so far. */
export function ProgressStrip({ games, total }: { games: RunGame[]; total: number }) {
  const currentIndex = games.findIndex((game) => game.status === "current");
  const label =
    currentIndex === -1
      ? `All ${games.length} games finished, ${total} points`
      : `Game ${currentIndex + 1} of ${games.length}: ${games[currentIndex].name}. ${total} points so far`;

  return (
    <nav aria-label={label} className="flex shrink-0 items-stretch gap-2 px-4 pb-2.5 pt-1">
      <ol className="flex min-w-0 flex-1 gap-1.5">
        {games.map((game, index) => (
          <li
            key={game.id}
            className="hue min-w-0 flex-1"
            style={{ "--hue": game.hue } as React.CSSProperties}
            aria-current={game.status === "current" ? "step" : undefined}
          >
            <div
              className={`h-1.5 rounded-full ${
                game.status === "done" ? "bg-game" : game.status === "current" ? "animate-pulse-soft bg-game" : "bg-line"
              }`}
            />
            <div className={`mt-1 flex items-center gap-1 text-xs ${game.status === "upcoming" ? "text-muted" : "text-ink"}`}>
              {game.status === "done" ? (
                <CheckIcon className="h-3 w-3 shrink-0 text-game" />
              ) : (
                <span className="tabular shrink-0 font-bold text-muted">{index + 1}</span>
              )}
              <span className={`min-w-0 flex-1 truncate ${game.status === "current" ? "font-bold" : "font-medium"}`}>{game.name}</span>
              {game.score !== null && <span className="tabular shrink-0 font-bold">{game.score}</span>}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex shrink-0 flex-col items-end justify-center border-l border-line pl-2.5" aria-hidden>
        <span className="display tabular text-xl">{total}</span>
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">points</span>
      </div>
    </nav>
  );
}
