"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gameComponent, preloadGame } from "@/games/client";
import type { GameProps } from "@/games/types";
import type { PlayOutcome, RunGame, RunSnapshot } from "@/lib/run";
import { Handoff } from "./Handoff";
import { Header } from "./Header";
import { ProgressStrip } from "./ProgressStrip";

/** How long a finished game stays on screen before its points are shown. */
const LINGER_MS = 1300;

type Stage = { id: string; view: unknown };
type Finished = { game: RunGame; next: RunGame | null; run: RunSnapshot };

/**
 * The run screen: header, progress strip and whichever game the player is
 * on. It passes moves to the server and walks the player from one game to
 * the next. It never needs to know what any game is.
 */
export function RunShell({ initial, nickname, streak }: { initial: RunSnapshot; nickname: string; streak: number }) {
  const router = useRouter();
  const [run, setRun] = useState(initial);
  const [stage, setStage] = useState<Stage>(initial.current!);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const inFlight = useRef(false);

  // Fetch the next game's code while the current one is being played.
  useEffect(() => {
    const index = run.games.findIndex((game) => game.id === stage.id);
    const next = run.games[index + 1];
    if (next) preloadGame(next.id);
  }, [run.games, stage.id]);

  const play = useCallback<GameProps["play"]>(
    async (action) => {
      if (inFlight.current) return { ok: false, error: "Still sending your last move." };
      inFlight.current = true;
      setBusy(true);
      try {
        const response = await fetch("/api/play", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ day: run.day, gameId: stage.id, action }),
        });
        const outcome: PlayOutcome | { ok: false; reason: "no-player"; error: string } = await response.json();
        if (!outcome.ok) {
          if (outcome.reason === "rejected") return { ok: false, error: outcome.error };
          // The day rolled over, or this tab is behind another one: start from the server's truth.
          window.location.reload();
          return { ok: false, error: outcome.error };
        }

        setStage({ id: stage.id, view: outcome.view });
        if (!outcome.result) {
          setRun(outcome.run);
          return { ok: true };
        }
        // The game is over. Let its final position sink in, then show the points.
        const game = outcome.run.games.find((g) => g.id === stage.id)!;
        const next = outcome.run.games.find((g) => g.status === "current") ?? null;
        window.setTimeout(() => {
          setRun(outcome.run);
          setFinished({ game, next, run: outcome.run });
        }, LINGER_MS);
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not reach the server. Check your connection and try again." };
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [run.day, stage.id],
  );

  const moveOn = useCallback(() => {
    if (!finished) return;
    if (finished.run.current) {
      setStage(finished.run.current);
      setFinished(null);
    } else {
      // Last game done: the server now renders the results in place of this screen.
      setLeaving(true);
      router.refresh();
    }
  }, [finished, router]);

  const Game = gameComponent(stage.id);
  const stageGame = run.games.find((game) => game.id === stage.id);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[30rem] flex-col">
      <Header dayNumber={run.dayNumber} hues={run.games.map((game) => game.hue)} nickname={nickname} streak={streak} />
      <ProgressStrip games={run.games} total={run.total} />
      <main className="hue relative flex min-h-0 flex-1 flex-col" style={{ "--hue": stageGame?.hue } as React.CSSProperties}>
        {finished ? (
          <Handoff game={finished.game} next={finished.next} total={finished.run.total} leaving={leaving} onContinue={moveOn} />
        ) : (
          <Suspense fallback={<div className="flex-1" />}>
            <Game key={stage.id} view={stage.view} play={play} busy={busy} draftKey={`${run.day}:${stage.id}`} />
          </Suspense>
        )}
      </main>
    </div>
  );
}
