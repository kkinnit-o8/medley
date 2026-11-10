"use client";

import { useState } from "react";
import { CheckIcon, ShareIcon } from "./Icons";

/** Copies the spoiler-free summary to the clipboard. */
export function ShareButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2500);
    } catch {
      // No clipboard access (older browser, or blocked): show the text to copy by hand.
      setState("manual");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={copy} className="display flex h-13 items-center justify-center gap-2 rounded-xl bg-ink text-xl text-bg">
        {state === "copied" ? <CheckIcon className="h-5 w-5" /> : <ShareIcon className="h-5 w-5" />}
        <span aria-live="polite">{state === "copied" ? "Copied" : "Share result"}</span>
      </button>
      {state === "manual" && (
        <textarea
          readOnly
          value={text}
          rows={text.split("\n").length}
          onFocus={(event) => event.target.select()}
          aria-label="Your result, ready to copy"
          className="w-full resize-none rounded-xl border border-line-strong bg-surface p-3 text-sm"
        />
      )}
    </div>
  );
}
