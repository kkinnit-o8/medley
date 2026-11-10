import { now } from "@/lib/clock";
import { currentPlayer } from "@/lib/player";
import { play } from "@/lib/run";

/** One move in the player's current game. The server decides everything. */
export async function POST(request: Request) {
  const player = await currentPlayer();
  if (!player) return Response.json({ ok: false, reason: "no-player", error: "Start a run first." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.day !== "string" || typeof body?.gameId !== "string") {
    return Response.json({ ok: false, reason: "rejected", error: "Malformed request." }, { status: 400 });
  }
  const outcome = await play(player.id, body.day, body.gameId, body.action, now());
  return Response.json(outcome);
}
