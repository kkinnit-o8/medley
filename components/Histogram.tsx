"use client";

import { useState } from "react";

/**
 * Everyone's scores for one game as ten bars (0-9 ... 90-100), with the bar
 * holding the player's own score picked out in the game's colour. Hover,
 * focus or tap a bar to read its numbers.
 */
export function Histogram({ bars, mine, label }: { bars: number[]; mine: number; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const tallest = Math.max(1, ...bars);
  const players = bars.reduce((sum, n) => sum + n, 0);
  const range = (i: number) => (i === 9 ? "90-100" : `${i * 10}-${i * 10 + 9}`);
  const describe = (i: number) =>
    `${range(i)} points: ${bars[i].toLocaleString("en")} ${bars[i] === 1 ? "player" : "players"}` +
    (players > 0 ? ` (${Math.round((bars[i] / players) * 100)}%)` : "") +
    (i === mine ? ", including you" : "");

  return (
    <figure className="flex flex-col gap-1">
      <p className="tabular h-4 text-xs text-muted" aria-live="polite">
        {active === null ? `Hover or tap a bar. ${players.toLocaleString("en")} ${players === 1 ? "player" : "players"} so far.` : describe(active)}
      </p>
      {/* Every column keeps the same headroom, so the "You" label never squeezes its own bar. */}
      <div role="list" aria-label={label} className="flex h-28 items-stretch border-b border-line" onPointerLeave={() => setActive(null)}>
        {bars.map((count, i) => {
          const height = count === 0 ? "0px" : `max(3px, ${(count / tallest) * 100}%)`;
          return (
            <button
              key={i}
              type="button"
              role="listitem"
              aria-label={describe(i)}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(i)}
              // The whole column is the target, not just the painted bar.
              className="group min-w-0 flex-1 cursor-default px-px pt-4 outline-none"
            >
              <span className="relative flex h-full items-end justify-center">
                {i === mine && (
                  <span className="absolute text-[0.65rem] font-bold leading-none text-ink" style={{ bottom: `calc(${height} + 3px)` }}>
                    You
                  </span>
                )}
                <span
                  className={`w-full max-w-6 rounded-t group-focus-visible:outline-2 group-focus-visible:outline-offset-1 group-focus-visible:outline-ink ${
                    i === mine ? "bg-game" : "bg-bar"
                  } ${active === i ? "brightness-110" : ""}`}
                  style={{ height }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="tabular flex justify-between text-[0.65rem] text-muted" aria-hidden>
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </figure>
  );
}
