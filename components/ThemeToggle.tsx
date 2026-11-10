"use client";

import { MoonIcon, SunIcon } from "./Icons";

/** Switches between light and dark and remembers the choice on this device. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("medley-theme", next);
    } catch {
      /* the choice just will not be remembered */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
    >
      {/* Both icons render; CSS shows the one for the theme you would switch to. */}
      <MoonIcon className="theme-icon-moon" />
      <SunIcon className="theme-icon-sun" />
    </button>
  );
}
