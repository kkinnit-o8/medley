"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/medley.config";
import { FlameIcon } from "./Icons";
import { NicknameForm } from "./NicknameForm";
import { ThemeToggle } from "./ThemeToggle";

export type HeaderProps = {
  dayNumber: number;
  /** Accent hues of today's games, drawn as the stripe under the wordmark. */
  hues: number[];
  nickname?: string;
  streak?: number;
};

export function Header({ dayNumber, hues, nickname, streak = 0 }: HeaderProps) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(nickname);
  const [editing, setEditing] = useState(false);

  function open() {
    setEditing(true);
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
  }

  return (
    <header className="flex h-13 shrink-0 items-center justify-between gap-2 px-4">
      <div className="flex items-baseline gap-2">
        <div>
          <h1 className="display text-[1.7rem]">{config.siteName}</h1>
          <div className="mt-0.5 flex gap-0.5" aria-hidden>
            {hues.map((hue, index) => (
              <span key={index} className="hue h-1 flex-1 rounded-full bg-game" style={{ "--hue": hue } as React.CSSProperties} />
            ))}
          </div>
        </div>
        <span className="tabular text-sm font-semibold text-muted" title={`Day ${dayNumber}`}>
          #{dayNumber}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-1">
        {streak > 0 && (
          <span className="tabular flex items-center gap-0.5 text-sm font-bold" title={`${streak}-day streak`}>
            <FlameIcon className="h-4 w-4 text-[oklch(0.7_0.18_55)]" />
            {streak}
            <span className="sr-only">-day streak</span>
          </span>
        )}
        {name && (
          <button
            type="button"
            onClick={open}
            className="min-w-0 max-w-36 truncate rounded-full px-2.5 py-1.5 text-sm font-semibold hover:bg-sunken"
            aria-label={`Nickname: ${name}. Change it`}
          >
            {name}
          </button>
        )}
        <ThemeToggle />
      </div>

      <dialog
        ref={dialog}
        onClose={() => setEditing(false)}
        onClick={(event) => event.target === dialog.current && close()}
        className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink backdrop:bg-black/50"
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <h2 className="display text-2xl">Change nickname</h2>
            <NicknameForm
              initial={name ?? ""}
              submitLabel="Save"
              autoFocus
              onSaved={(saved) => {
                setName(saved);
                close();
                router.refresh();
              }}
            />
            <button type="button" onClick={close} className="text-sm font-semibold text-muted">
              Cancel
            </button>
          </div>
        )}
      </dialog>
    </header>
  );
}
