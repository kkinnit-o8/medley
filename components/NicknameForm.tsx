"use client";

import { useState } from "react";
import { config } from "@/medley.config";

/** A nickname field with its button. Saves to the server and reports back. */
export function NicknameForm({
  initial,
  submitLabel,
  onSaved,
  autoFocus,
}: {
  initial: string;
  submitLabel: string;
  onSaved: (nickname: string) => void;
  autoFocus?: boolean;
}) {
  const [nickname, setNickname] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/player", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const body = await response.json();
      if (body.ok) onSaved(body.nickname);
      else setError(body.error ?? "That did not work. Try again.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-muted">Nickname</span>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={config.nickname.maxLength}
          autoFocus={autoFocus}
          autoComplete="nickname"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={error ? true : undefined}
          aria-describedby="nickname-help"
          className="h-12 rounded-xl border-2 border-line-strong bg-surface px-3.5 text-lg font-semibold outline-none focus:border-game"
        />
      </label>
      <p id="nickname-help" role={error ? "alert" : undefined} className={`text-sm ${error ? "text-bad" : "text-muted"}`}>
        {error ?? "Shown on the leaderboard. You can change it later."}
      </p>
      <button
        type="submit"
        disabled={saving || nickname.trim().length === 0}
        className="display h-13 rounded-xl bg-game text-xl text-on-game disabled:opacity-50"
      >
        {saving ? "Saving" : submitLabel}
      </button>
    </form>
  );
}
