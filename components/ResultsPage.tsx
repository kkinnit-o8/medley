import { ordinal, type Results } from "@/lib/results";
import { Countdown } from "./Countdown";
import { Header } from "./Header";
import { Histogram } from "./Histogram";
import { FlameIcon } from "./Icons";
import { ShareButton } from "./ShareButton";

const count = (n: number) => n.toLocaleString("en");

/** The payoff: your total, where it puts you, each game against the field, and the day's leaderboard. */
export function ResultsPage({ results, nickname }: { results: Results; nickname: string }) {
  const { games, leaderboard, myRow } = results;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col">
      <Header dayNumber={results.dayNumber} hues={games.map((game) => game.hue)} nickname={nickname} streak={results.streak} />

      <main className="flex flex-col gap-4 px-4 pb-10 pt-2">
        <section className="animate-rise rounded-3xl bg-ink px-5 pb-5 pt-6 text-bg" aria-labelledby="total-heading">
          <h2 id="total-heading" className="text-sm font-semibold uppercase tracking-wide opacity-70">
            Run complete
          </h2>
          <p className="display tabular mt-1 text-[5.5rem]">
            {results.total}
            <span className="text-3xl opacity-60"> / {results.maxTotal}</span>
          </p>
          {/* One stripe per game, as long as its share of the points. */}
          <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {games.map((game) => (
              <span key={game.id} className="h-full flex-1 rounded-full bg-bg/20">
                <span className="hue block h-full rounded-full bg-[oklch(0.72_0.17_var(--hue))]" style={{ "--hue": game.hue, width: `${game.score}%` } as React.CSSProperties} />
              </span>
            ))}
          </div>

          <div className="mt-5">
            {results.ranked ? (
              <>
                <p className="display text-3xl">
                  {ordinal(results.rank)} <span className="opacity-60">of {count(results.players)}</span>
                </p>
                <p className="mt-1.5 font-semibold opacity-80">
                  {results.rank === 1
                    ? "The top score today."
                    : results.betterThan > 0
                      ? `Better than ${results.betterThan}% of players.`
                      : "Tomorrow is another run."}
                </p>
              </>
            ) : (
              <>
                <p className="display text-3xl">You&rsquo;re the {ordinal(results.finishOrder)} player today</p>
                <p className="mt-1.5 text-sm font-semibold opacity-80">
                  {results.players === 1
                    ? "Nobody to compare with yet. Come back later to see how your total holds up."
                    : `Only ${count(results.players)} have finished so far, too few for a ranking to mean much. Come back later.`}
                </p>
              </>
            )}
          </div>
        </section>

        <ShareButton text={results.shareText} />

        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <Countdown ms={results.msUntilNextRun} />
          {results.streak > 0 && (
            <p className="flex items-center gap-1.5 border-t border-line pt-2 text-sm font-semibold">
              <FlameIcon className="h-4 w-4 text-[oklch(0.7_0.18_55)]" />
              {results.streak === 1 ? "Day 1 of a new streak." : `${results.streak} days in a row.`}
              {results.bestStreak > results.streak && <span className="font-normal text-muted">Best: {results.bestStreak}.</span>}
            </p>
          )}
        </section>

        <h2 className="display mt-3 text-2xl">Game by game</h2>
        {games.map((game) => (
          <section
            key={game.id}
            className="hue flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4"
            style={{ "--hue": game.hue } as React.CSSProperties}
            aria-label={`${game.name}: ${game.score} points`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="display flex items-center gap-2 text-xl">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-game" aria-hidden />
                  {game.name}
                </h3>
                <p className="mt-1.5 text-sm text-muted">{game.summary}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="display tabular text-4xl">{game.score}</p>
                <p className="tabular mt-1 text-xs text-muted">average {Math.round(game.average)}</p>
              </div>
            </div>
            <Histogram bars={game.histogram} mine={game.myBar} label={`How everyone scored in ${game.name}`} />
          </section>
        ))}

        <h2 className="display mt-3 text-2xl">Today&rsquo;s top {leaderboard.length < 20 ? "scores" : leaderboard.length}</h2>
        <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
          {leaderboard.map((entry, index) => (
            <LeaderboardRow key={index} entry={entry} />
          ))}
          {myRow && (
            <>
              <li aria-hidden className="border-t border-line py-0.5 text-center text-xs leading-none text-muted">
                ⋮
              </li>
              <LeaderboardRow entry={myRow} />
            </>
          )}
        </ol>
      </main>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: Results["leaderboard"][number] }) {
  return (
    <li
      className={`flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0 ${entry.isMe ? "bg-sunken font-bold" : ""}`}
      aria-current={entry.isMe ? "true" : undefined}
    >
      <span className="tabular w-9 shrink-0 text-sm font-bold text-muted">{entry.rank}</span>
      <span className="min-w-0 flex-1 truncate">
        {entry.nickname}
        {entry.isMe && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-bg">You</span>}
      </span>
      <span className="display tabular shrink-0 text-xl">{entry.total}</span>
    </li>
  );
}
