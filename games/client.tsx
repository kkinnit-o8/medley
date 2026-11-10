"use client";

import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { GameProps } from "./types";

type GameComponent = LazyExoticComponent<ComponentType<GameProps>>;
const loaded = new Map<string, GameComponent>();

/**
 * The browser half of a game, loaded on demand by id. Only client.tsx files
 * can be reached from here, so nothing from a game's server.ts ends up in
 * the browser.
 */
export function gameComponent(id: string): GameComponent {
  let component = loaded.get(id);
  if (!component) loaded.set(id, (component = lazy(() => import(`./${id}/client`))));
  return component;
}

/** Start downloading a game's code before it is needed. */
export function preloadGame(id: string): void {
  void import(`./${id}/client`).catch(() => undefined);
}
