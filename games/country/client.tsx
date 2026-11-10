"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useDraft } from "@/lib/use-draft";
import type { GameProps } from "../types";
import names from "./data/names.json";
import { DEGREES } from "./geo";
import type { CountryAction, CountryView } from "./types";

type Entry = { id: string; name: string; keys: string[] };

const fold = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ENTRIES: Entry[] = (names as { id: string; name: string; also: string[] }[]).map((country) => ({
  id: country.id,
  name: country.name,
  keys: [country.name, ...country.also].map(fold),
}));

/** Countries matching what has been typed, best matches first. */
function search(text: string, exclude: Set<string>): Entry[] {
  const query = fold(text);
  if (!query) return [];
  const scored: [number, Entry][] = [];
  for (const entry of ENTRIES) {
    if (exclude.has(entry.id)) continue;
    let score = 0;
    entry.keys.forEach((key, i) => {
      const isName = i === 0;
      if (key === query) score = Math.max(score, isName ? 6 : 5);
      else if (key.startsWith(query)) score = Math.max(score, isName ? 4 : 3);
      else if (key.includes(` ${query}`)) score = Math.max(score, 2);
      else if (query.length >= 3 && key.includes(query)) score = Math.max(score, 1);
    });
    if (score > 0) scored.push([score, entry]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name)).map(([, entry]) => entry);
}

export default function CountryGame({ view, play, busy, draftKey }: GameProps<CountryView, CountryAction>) {
  const [text, setText] = useDraft(draftKey);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const playing = view.status === "playing";
  const guessed = useMemo(() => new Set(view.guesses.map((guess) => guess.id)), [view.guesses]);
  const matches = useMemo(() => search(text, guessed).slice(0, 5), [text, guessed]);
  const exact = matches.find((entry) => fold(entry.name) === fold(text)) ?? (matches.length === 1 && matches[0].keys.includes(fold(text)) ? matches[0] : undefined);
  const showList = open && matches.length > 0 && !(matches.length === 1 && fold(matches[0].name) === fold(text));

  function choose(entry: Entry) {
    setText(entry.name);
    setOpen(false);
    setError(null);
    input.current?.focus();
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!playing || busy) return;
    if (showList && !exact) return choose(matches[Math.min(active, matches.length - 1)]);
    if (!exact) return setError(text.trim() ? "Pick a country from the list." : "Type a country name.");
    const outcome = await play({ guess: exact.id });
    if (outcome.ok) {
      setText("");
      setError(null);
    } else setError(outcome.error);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!showList) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + matches.length) % matches.length);
    } else if (event.key === "Escape") setOpen(false);
  }

  const left = view.maxGuesses - view.guesses.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1">
      <figure className="flex min-h-28 flex-1 flex-col items-center justify-center rounded-2xl border border-line bg-surface p-2">
        <svg
          viewBox="0 0 1000 1000"
          role="img"
          aria-label={view.answer ? `Outline of ${view.answer}` : "Outline of the mystery country"}
          className="h-full max-h-64 w-full text-ink"
        >
          <path d={view.shape.path} fill="currentColor" fillRule="evenodd" stroke="currentColor" strokeWidth={view.shape.stroke} strokeLinejoin="round" />
        </svg>
        {view.answer && <figcaption className="display animate-rise pb-1 text-xl">{view.answer}</figcaption>}
      </figure>

      <ol className="flex shrink-0 flex-col gap-1" aria-label="Your guesses">
        {Array.from({ length: view.maxGuesses }, (_, i) => {
          const guess = view.guesses[i];
          if (!guess) {
            return (
              <li key={i} aria-hidden className="tabular flex h-9 items-center rounded-lg border border-dashed border-line px-3 text-xs font-bold text-muted">
                {i + 1}
              </li>
            );
          }
          return (
            <li
              key={i}
              className={`animate-rise flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold ${
                guess.correct ? "bg-hit text-on-mark" : "bg-sunken"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{guess.name}</span>
              {guess.correct ? (
                <span>Correct</span>
              ) : (
                <>
                  <span className="tabular shrink-0">{guess.km.toLocaleString("en")} km</span>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-game text-on-game" title={`Head ${guess.direction}`}>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" style={{ transform: `rotate(${DEGREES[guess.direction!]}deg)` }} aria-hidden>
                      <path d="M12 4v16M12 4l-6 6M12 4l6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="sr-only">towards {guess.direction}</span>
                  </span>
                  <span className="tabular w-10 shrink-0 text-right" title="How close: 100% is the country itself">
                    {guess.proximity}%
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <form onSubmit={submit} className="relative flex shrink-0 gap-2">
        {showList && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 bottom-full z-10 mb-1.5 overflow-hidden rounded-xl border border-line-strong bg-surface shadow-xl">
            {matches.map((entry, i) => (
              <li
                key={entry.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // Chosen on pointer-down so the input never loses focus (and the phone keyboard stays up).
                onPointerDown={(event) => {
                  event.preventDefault();
                  choose(entry);
                }}
                className={`cursor-pointer truncate px-3.5 py-2.5 font-semibold ${i === active ? "bg-sunken" : ""}`}
              >
                {entry.name}
              </li>
            ))}
          </ul>
        )}
        <input
          ref={input}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(0);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          disabled={!playing}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Guess a country"
          aria-invalid={error ? true : undefined}
          placeholder={playing ? `Country (${left} ${left === 1 ? "guess" : "guesses"} left)` : "No more guesses"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-line-strong bg-surface px-3.5 font-semibold outline-none placeholder:font-normal placeholder:text-muted focus:border-game disabled:opacity-60"
        />
        <button type="submit" disabled={!playing || busy} className="display h-12 shrink-0 rounded-xl bg-game px-5 text-lg text-on-game disabled:opacity-50">
          Guess
        </button>
        {error && (
          <p role="alert" className="absolute inset-x-0 bottom-full mb-1.5 rounded-lg bg-ink px-3 py-1.5 text-center text-sm font-bold text-bg">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
