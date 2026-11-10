import "server-only";
import type { ServerGame } from "./types";

const loaded = new Map<string, ServerGame>();

/**
 * Loads a game's server half by id. The folder name is the id, so adding a
 * game never means editing this file.
 */
export async function loadGame(id: string): Promise<ServerGame> {
  const cached = loaded.get(id);
  if (cached) return cached;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`"${id}" is not a valid game id`);

  let game: ServerGame;
  try {
    game = (await import(`./${id}/server`)).default;
  } catch (error) {
    throw new Error(`Could not load games/${id}/server.ts. Is "${id}" in the lineup without a matching folder?`, { cause: error });
  }
  if (game?.meta?.id !== id) throw new Error(`games/${id}/server.ts must default-export a game whose meta.id is "${id}"`);
  loaded.set(id, game);
  return game;
}
