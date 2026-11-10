import { now } from "@/lib/clock";
import { checkNickname } from "@/lib/nickname";
import { currentPlayer, registerPlayer } from "@/lib/player";
import * as store from "@/lib/store";

/** Sets the nickname. The first call also creates the player. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const check = checkNickname(body?.nickname);
  if (!check.ok) return Response.json(check, { status: 400 });

  const player = await currentPlayer();
  if (player) await store.renamePlayer(player.id, check.nickname);
  else await registerPlayer(check.nickname, now());
  return Response.json({ ok: true, nickname: check.nickname });
}
