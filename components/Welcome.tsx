"use client";

import { useRouter } from "next/navigation";
import { config } from "@/medley.config";
import type { GameMeta } from "@/games/types";
import { Header } from "./Header";
import { NicknameForm } from "./NicknameForm";

/** First visit: what this is, today's games, and a nickname to play under. */
export function Welcome({ dayNumber, games, suggestion }: { dayNumber: number; games: GameMeta[]; suggestion: string }) {
  const router = useRouter();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col">
      <Header dayNumber={dayNumber} hues={games.map((game) => game.hue)} />
      <main className="flex flex-1 flex-col gap-7 px-5 pb-8 pt-6">
        <div>
          <p className="display text-[2.6rem] leading-[0.95]">{config.tagline}</p>
          <p className="mt-3 text-muted">
            {games.length} games, played back to back. No breaks, no second tries. Everyone gets the same puzzles, and at the
            end you see how your total compares.
          </p>
        </div>

        <ol className="flex flex-col gap-2">
          {games.map((game, index) => (
            <li
              key={game.id}
              className="hue flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3"
              style={{ "--hue": game.hue } as React.CSSProperties}
            >
              <span className="display tabular grid h-9 w-9 shrink-0 place-items-center rounded-full bg-game text-lg text-on-game">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="display block text-xl">{game.name}</span>
                <span className="block text-sm text-muted">{game.tagline}</span>
              </span>
            </li>
          ))}
        </ol>

        <NicknameForm initial={suggestion} submitLabel="Start today's run" onSaved={() => router.refresh()} />

        <p className="text-center text-xs text-muted">
          No sign-up. One run a day; a new one starts at midnight ({config.timezone.split("/").pop()?.replace("_", " ")} time).
        </p>
      </main>
    </div>
  );
}
