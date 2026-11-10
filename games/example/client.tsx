"use client";

import { useState } from "react";
import type { GameProps } from "../types";
import type { ExampleAction, ExampleView } from "./server";

export default function Example({ view, play, busy }: GameProps<ExampleView, ExampleAction>) {
  const [error, setError] = useState<string | null>(null);
  const tried = new Map(view.guesses.map((g) => [g.value, g.hint]));

  async function guess(value: number) {
    const outcome = await play({ guess: value });
    setError(outcome.ok ? null : outcome.error);
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <p className="text-muted">
        {view.over ? "Done." : `${view.triesLeft} ${view.triesLeft === 1 ? "try" : "tries"} left`}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const hint = tried.get(n);
          return (
            <button
              key={n}
              disabled={busy || view.over || hint !== undefined}
              onClick={() => guess(n)}
              className={`h-14 w-14 rounded-xl border-2 text-xl font-bold ${
                hint === "correct" ? "border-transparent bg-hit text-white" : hint ? "border-line text-muted" : "border-line-strong"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <ul className="text-sm text-muted">
        {view.guesses.map((g) => (
          <li key={g.value}>
            {g.value}: {g.hint === "correct" ? "correct" : `go ${g.hint}`}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
