"use client";

import { useCallback, useEffect, useState } from "react";

const PREFIX = "medley-draft:";

/**
 * Like useState for text the player has typed but not sent, kept in the
 * browser so a refresh does not lose it. Drafts from other days are cleared.
 */
export function useDraft(key: string): [string, (value: string) => void] {
  const [value, setValue] = useState("");

  useEffect(() => {
    try {
      const today = key.split(":")[0];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const stored = localStorage.key(i);
        if (stored?.startsWith(PREFIX) && !stored.startsWith(PREFIX + today)) localStorage.removeItem(stored);
      }
      // Reading saved text has to wait until the browser is running.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(localStorage.getItem(PREFIX + key) ?? "");
    } catch {
      /* private mode: drafts simply are not kept */
    }
  }, [key]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      try {
        if (next) localStorage.setItem(PREFIX + key, next);
        else localStorage.removeItem(PREFIX + key);
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  return [value, update];
}
