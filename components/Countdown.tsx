"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const two = (n: number) => String(n).padStart(2, "0");

/** Counts down to the next run, then offers it. */
export function Countdown({ ms }: { ms: number }) {
  const router = useRouter();
  // Null until the browser is running, so the server and browser never disagree about the time.
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = performance.now() + ms;
    const tick = () => setLeft(Math.max(0, end - performance.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [ms]);

  if (left === 0) {
    return (
      <button type="button" onClick={() => router.refresh()} className="display h-13 w-full rounded-xl bg-game text-xl text-on-game">
        Play the new run
      </button>
    );
  }

  const seconds = Math.ceil((left ?? ms) / 1000);
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-semibold text-muted">Next run in</span>
      <span className="display tabular text-3xl" role="timer" suppressHydrationWarning>
        {two(Math.floor(seconds / 3600))}:{two(Math.floor((seconds % 3600) / 60))}:{two(seconds % 60)}
      </span>
    </p>
  );
}
