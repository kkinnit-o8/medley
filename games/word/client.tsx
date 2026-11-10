"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDraft } from "@/lib/use-draft";
import type { GameProps } from "../types";
import type { Mark, WordAction, WordView } from "./types";

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const RANK: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };

const TILE: Record<Mark, string> = {
  hit: "bg-hit text-on-mark border-transparent",
  near: "bg-near text-on-near border-transparent",
  miss: "bg-miss text-on-mark border-transparent",
};
const KEY: Record<Mark, string> = {
  hit: "bg-hit text-on-mark",
  near: "bg-near text-on-near",
  miss: "bg-miss text-on-mark opacity-60",
};
const SPOKEN: Record<Mark, string> = { hit: "correct", near: "in the word, wrong place", miss: "not in the word" };

export default function WordGame({ view, play, busy, draftKey }: GameProps<WordView, WordAction>) {
  const [draft, setDraft] = useDraft(draftKey);
  const [notice, setNotice] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  // The row to flip open: only a row guessed in this sitting animates, not ones restored after a refresh.
  const [revealed, setRevealed] = useState(-1);
  const noticeTimer = useRef<number | undefined>(undefined);

  const playing = view.status === "playing";
  const typed = playing ? draft.slice(0, view.wordLength) : "";

  const say = useCallback((message: string) => {
    setNotice(message);
    setShake(true);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
    window.setTimeout(() => setShake(false), 450);
  }, []);

  const press = useCallback(
    async (key: string) => {
      if (!playing || busy) return;
      if (key === "enter") {
        if (typed.length < view.wordLength) return say("Not enough letters.");
        const row = view.rows.length;
        const outcome = await play({ guess: typed });
        if (outcome.ok) {
          setDraft("");
          setRevealed(row);
        } else say(outcome.error);
      } else if (key === "back") {
        setDraft(typed.slice(0, -1));
      } else if (/^[a-z]$/.test(key) && typed.length < view.wordLength) {
        setDraft(typed + key);
      }
    },
    [playing, busy, typed, view.wordLength, view.rows.length, play, say, setDraft],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, dialog")) return;
      const key = event.key === "Enter" ? "enter" : event.key === "Backspace" ? "back" : event.key.toLowerCase();
      if (key === "enter" || key === "back" || /^[a-z]$/.test(key)) {
        event.preventDefault();
        void press(key);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const best = new Map<string, Mark>();
  for (const row of view.rows) {
    row.word.split("").forEach((letter, i) => {
      const known = best.get(letter);
      if (!known || RANK[row.marks[i]] > RANK[known]) best.set(letter, row.marks[i]);
    });
  }

  const status =
    view.status === "won" ? "Solved." : view.status === "lost" ? `The word was ${view.answer?.toUpperCase()}.` : notice;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-2">
        <div
          className="grid aspect-[5/6] h-full max-h-[25rem] max-w-full gap-1.5"
          style={{ gridTemplateRows: `repeat(${view.maxGuesses}, 1fr)`, containerType: "size" }}
          role="group"
          aria-label={`Guesses: ${view.rows.length} of ${view.maxGuesses} used`}
        >
          {Array.from({ length: view.maxGuesses }, (_, r) => {
            const row = view.rows[r];
            const current = r === view.rows.length && playing;
            const letters = row ? row.word : current ? typed : "";
            return (
              <div
                key={r}
                className={`grid gap-1.5 ${current && shake ? "animate-shake" : ""}`}
                style={{ gridTemplateColumns: `repeat(${view.wordLength}, 1fr)` }}
                role="group"
                aria-label={row ? `Guess ${r + 1}: ${row.word}. ${row.marks.map((m, i) => `${row.word[i]} ${SPOKEN[m]}`).join(", ")}` : undefined}
              >
                {Array.from({ length: view.wordLength }, (_, c) => {
                  const letter = letters[c] ?? "";
                  const mark = row?.marks[c];
                  const flipping = row && r === revealed;
                  return (
                    <div
                      key={c}
                      aria-hidden={row ? true : undefined}
                      className={`display grid place-items-center rounded-lg border-2 text-[10cqh] ${
                        mark ? TILE[mark] : letter ? "animate-pop border-line-strong" : "border-line"
                      } ${flipping ? "animate-flip" : ""}`}
                      style={flipping ? { animationDelay: `${c * 110}ms` } : undefined}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <p
          role="status"
          className={`pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-bg shadow-lg transition-opacity ${
            status ? "opacity-100" : "opacity-0"
          }`}
        >
          {status}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1" aria-label="Keyboard">
        {KEY_ROWS.map((letters, rowIndex) => (
          <div key={letters} className="flex justify-center gap-[5px]">
            {rowIndex === 2 && <Key label="Enter" wide onPress={() => press("enter")} disabled={!playing || busy} />}
            {letters.split("").map((letter) => {
              const mark = best.get(letter);
              return (
                <Key
                  key={letter}
                  label={letter}
                  spoken={mark ? `${letter}, ${SPOKEN[mark]}` : letter}
                  className={mark ? KEY[mark] : "bg-sunken"}
                  onPress={() => press(letter)}
                  disabled={!playing}
                />
              );
            })}
            {rowIndex === 2 && <Key label="⌫" spoken="Delete" wide onPress={() => press("back")} disabled={!playing} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function Key({
  label,
  spoken,
  wide,
  className = "bg-sunken",
  onPress,
  disabled,
}: {
  label: string;
  spoken?: string;
  wide?: boolean;
  className?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={spoken ?? label}
      disabled={disabled}
      onClick={onPress}
      className={`h-[3.25rem] touch-manipulation select-none rounded-md font-bold uppercase transition-colors active:brightness-90 ${
        wide ? "max-w-16 flex-[1.6] text-xs" : "max-w-11 flex-1 text-lg"
      } ${className}`}
    >
      {label}
    </button>
  );
}
