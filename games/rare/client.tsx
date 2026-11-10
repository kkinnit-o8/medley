"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDraft } from "@/lib/use-draft";
import type { GameProps } from "../types";
import type { RareAction, RareView } from "./types";

/** How long an answer's result stays up before the next prompt starts. */
const FEEDBACK_MS = 2600;

/** One colour per rarity tier, from everyday (0) to almost nobody (4). */
const TIER_STYLE = [
  "bg-sunken text-ink",
  "bg-[oklch(0.86_0.12_95)] text-[oklch(0.25_0.05_95)]",
  "bg-[oklch(0.78_0.15_60)] text-[oklch(0.22_0.05_60)]",
  "bg-[oklch(0.62_0.21_25)] text-white",
  "bg-[oklch(0.5_0.24_320)] text-white",
];
const MISS_STYLE = "bg-miss text-on-mark";

/** Milliseconds left, counted down in the browser from what the server reported. */
function useCountdown(view: RareView, onZero: () => void): number {
  const running = view.phase === "prompt";
  const [left, setLeft] = useState(view.msLeft);
  const zero = useRef(onZero);
  useEffect(() => {
    zero.current = onZero;
  }, [onZero]);

  useEffect(() => {
    if (!running) return;
    const end = performance.now() + view.msLeft;
    let fired = false;
    const tick = () => {
      const remaining = Math.max(0, end - performance.now());
      setLeft(remaining);
      if (remaining === 0 && !fired) {
        fired = true;
        zero.current();
      }
    };
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
    // A new view object means the server has spoken again: restart from its number.
  }, [running, view]);

  return running ? left : 0;
}

export default function RareGame({ view, play, busy, draftKey }: GameProps<RareView, RareAction>) {
  const [text, setText] = useDraft(`${draftKey}:${view.index}`);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const timeUp = useCallback(() => void play({ type: "timeout" }), [play]);
  const msLeft = useCountdown(view, timeUp);
  const secondsLeft = Math.ceil(msLeft / 1000);
  const expired = view.phase === "prompt" && msLeft === 0;

  // After the result has been up for a moment, start the next prompt.
  const next = useCallback(() => void play({ type: "next" }), [play]);
  useEffect(() => {
    if (view.phase !== "feedback") return;
    const timer = window.setTimeout(next, FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [view.phase, view.index, next]);

  // If a timeout could not be reported (say the connection dropped), keep trying.
  useEffect(() => {
    if (!expired || busy) return;
    const timer = window.setTimeout(timeUp, 1500);
    return () => window.clearTimeout(timer);
  }, [expired, busy, timeUp]);

  function start() {
    // Focus first, inside the tap, so phones open the keyboard for prompt one.
    input.current?.focus({ preventScroll: true });
    void play({ type: "start" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (view.phase !== "prompt" || busy || expired) return;
    const outcome = await play({ type: "answer", text });
    if (outcome.ok) {
      setText("");
      setError(null);
    } else setError(outcome.error);
  }

  const totalMs = view.secondsPerPrompt * 1000;
  const urgent = view.phase === "prompt" && secondsLeft <= 5;
  const outcome = view.outcome;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
      {/* One pip per prompt, filling in with the points scored. */}
      <ol className="flex shrink-0 gap-1" aria-label={`Prompt ${Math.min(view.index + 1, view.total)} of ${view.total}`}>
        {Array.from({ length: view.total }, (_, i) => {
          const past = view.history[i];
          const current = !past && i === view.index && view.phase !== "intro";
          const style = past
            ? past.tier === null
              ? MISS_STYLE
              : TIER_STYLE[past.tier]
            : current
              ? "border-2 border-game text-game"
              : "border border-line text-muted";
          return (
            <li key={i} className={`tabular grid h-7 flex-1 place-items-center rounded-md text-xs font-bold ${style}`}>
              {past ? past.points : i + 1}
            </li>
          );
        })}
      </ol>

      {/* While answering, the prompt sits low, just above the answer box, so it stays in view above a phone keyboard. */}
      <div className={`flex min-h-0 flex-1 flex-col gap-4 py-3 ${view.phase === "intro" || view.phase === "done" ? "justify-center" : "justify-end"}`}>
        {view.phase === "intro" && (
          <div className="animate-rise flex flex-col gap-4">
            <p className="display text-4xl">
              {view.total} prompts.
              <br />
              {view.secondsPerPrompt} seconds each.
            </p>
            <p className="text-muted">
              Type one answer per prompt. Any correct answer scores, and the fewer players who give it, the more it is worth.
              A wrong answer or running out of time scores nothing.
            </p>
            <ul className="flex flex-col gap-1">
              {view.tiers.map((tier, i) => (
                <li key={tier.label} className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className={`tabular grid h-7 w-11 place-items-center rounded-md text-xs font-bold ${TIER_STYLE[i]}`}>{tier.points}</span>
                  {tier.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(view.phase === "prompt" || view.phase === "feedback") && (
          <div key={view.index} className="animate-rise flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Prompt {view.index + 1} of {view.total}
            </p>
            <h2 className="display text-[2.1rem] leading-[1.02]">{view.prompt}</h2>
          </div>
        )}

        {view.phase === "feedback" && outcome && (
          <div className="animate-rise flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4" role="status">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">
                  {outcome.answer ? titled(outcome.matchedAs ?? outcome.answer) : outcome.typed ? `“${outcome.typed}”` : "No answer"}
                </p>
                <p className="text-sm text-muted">
                  {outcome.answer
                    ? `${outcome.tierLabel}: about ${formatPercent(outcome.sharePercent!)} of players say this`
                    : outcome.typed
                      ? "Not on today's list"
                      : "Out of time"}
                </p>
                {/* Accepted under another name: say which answer it is counted with. */}
                {outcome.answer && outcome.matchedAs && <p className="truncate text-sm text-muted">Counted together with {outcome.answer}</p>}
              </div>
              <span className={`display tabular grid h-14 min-w-16 shrink-0 place-items-center rounded-xl px-2 text-3xl ${outcome.tier === null ? MISS_STYLE : TIER_STYLE[outcome.tier]}`}>
                +{outcome.points}
              </span>
            </div>
            {outcome.answer !== outcome.mostCommon && (
              <p className="border-t border-line pt-2 text-sm text-muted">
                Most common answer: <span className="font-semibold text-ink">{outcome.mostCommon}</span>
              </p>
            )}
          </div>
        )}

        {view.phase === "done" && (
          <p className="display animate-rise text-center text-4xl">
            {view.history.reduce((sum, item) => sum + item.points, 0)}
            <span className="block pt-1 text-base text-muted">of {view.total * 100} possible</span>
          </p>
        )}
      </div>

      <div className="shrink-0">
        {/* The timer bar. It starts part-way along when a prompt is resumed after a refresh. */}
        <div className={`mb-2 flex items-center gap-2 ${view.phase === "prompt" ? "" : "invisible"}`}>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
            <div
              key={`${view.index}-${view.msLeft}`}
              className={`h-full origin-left rounded-full ${urgent ? "bg-bad" : "bg-game"}`}
              style={{ animation: `drain ${totalMs}ms linear ${view.msLeft - totalMs}ms both` }}
            />
          </div>
          <span className={`display tabular w-7 text-right text-xl ${urgent ? "text-bad" : ""}`} aria-hidden>
            {secondsLeft}
          </span>
          <span className="sr-only" role="timer">
            {secondsLeft} seconds left
          </span>
        </div>

        {view.phase === "intro" ? (
          <button type="button" onClick={start} disabled={busy} className="display h-13 w-full rounded-xl bg-game text-xl text-on-game disabled:opacity-50">
            Start the clock
          </button>
        ) : view.phase === "feedback" ? (
          <button type="button" onClick={next} disabled={busy} className="display relative h-13 w-full overflow-hidden rounded-xl border-2 border-line bg-surface text-xl">
            {view.index + 1 < view.total ? "Next prompt" : "Finish"}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 origin-left bg-game" style={{ animation: `fill ${FEEDBACK_MS}ms linear both` }} />
          </button>
        ) : null}

        {/*
          The answer box stays mounted through every phase and is only hidden,
          never removed, so a phone keeps its keyboard open from prompt to prompt.
        */}
        <form onSubmit={submit} className={`relative flex gap-2 ${view.phase === "prompt" ? "" : "pointer-events-none absolute h-0 overflow-hidden opacity-0"}`}>
          <input
            ref={input}
            value={view.phase === "prompt" ? text : ""}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
            readOnly={view.phase !== "prompt" || expired}
            tabIndex={view.phase === "prompt" ? 0 : -1}
            maxLength={80}
            aria-label={view.prompt ?? "Your answer"}
            aria-invalid={error ? true : undefined}
            placeholder="Your answer"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            className="h-13 min-w-0 flex-1 rounded-xl border-2 border-line-strong bg-surface px-3.5 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-muted focus:border-game"
          />
          <button type="submit" disabled={busy || expired || !text.trim()} className="display h-13 shrink-0 rounded-xl bg-game px-5 text-lg text-on-game disabled:opacity-50">
            Lock in
          </button>
          {error && (
            <p role="alert" className="absolute inset-x-0 bottom-full mb-1.5 rounded-lg bg-ink px-3 py-1.5 text-center text-sm font-bold text-bg">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

/** Other names are stored in lower case; give them a capital for display. */
function titled(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatPercent(value: number): string {
  if (value < 1) return "under 1%";
  return `${Math.round(value)}%`;
}
