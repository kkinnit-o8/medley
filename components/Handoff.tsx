"use client";

import { useEffect, useRef, useState } from "react";
import type { RunGame } from "@/lib/run";
import { ArrowIcon } from "./Icons";

/** How long the points stay up before the next game starts by itself. */
const SHOW_MS = 3200;

/** Counts up to a number over a short moment. */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function step(time) {
      const progress = Math.min(1, (time - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/**
 * The moment between two games: the points for the game just finished, then
 * straight on to the next one.
 */
export function Handoff({
  game,
  next,
  total,
  leaving,
  onContinue,
}: {
  game: RunGame;
  next: RunGame | null;
  total: number;
  leaving: boolean;
  onContinue: () => void;
}) {
  const score = useCountUp(game.score ?? 0);
  const button = useRef<HTMLButtonElement>(null);
  const proceed = useRef(onContinue);
  useEffect(() => {
    proceed.current = onContinue;
  }, [onContinue]);

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => proceed.current(), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section
      className="hue flex flex-1 flex-col items-center justify-center gap-7 px-6 pb-10 text-center"
      style={{ "--hue": game.hue } as React.CSSProperties}
      aria-live="polite"
    >
      <div className="animate-rise flex flex-col items-center gap-2">
        <p className="display text-xl text-game">{game.name}</p>
        <p className="display tabular text-[6.5rem]">
          {score}
          <span className="sr-only"> points out of 100</span>
        </p>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted" aria-hidden>
          points out of 100
        </p>
        {game.summary && <p className="mt-2 text-lg font-semibold">{game.summary}</p>}
      </div>

      <button
        ref={button}
        type="button"
        onClick={onContinue}
        disabled={leaving}
        className="hue animate-rise relative w-full max-w-xs overflow-hidden rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-left [animation-delay:250ms]"
        style={{ "--hue": next?.hue ?? game.hue } as React.CSSProperties}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
              {next ? "Next up" : "Run complete"}
            </span>
            <span className="display mt-1 block truncate text-2xl">{next ? next.name : leaving ? "Adding it up" : `${total} points`}</span>
          </span>
          <ArrowIcon className="h-6 w-6 shrink-0 text-game" />
        </span>
        {/* Fills up as the automatic hand-off approaches. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1 origin-left bg-game"
          style={{ animation: `fill ${SHOW_MS}ms linear both` }}
        />
        <span className="sr-only">{next ? `Continue to ${next.name}` : "See your results"}</span>
      </button>
    </section>
  );
}
