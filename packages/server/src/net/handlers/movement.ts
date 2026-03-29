import { Op, type ServerMessage, movementFormulas, encodeEntityMove } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { world } from "../../game/World.js";

export function handleMove(player: Player, d: any): void {
  if (!Number.isFinite(d.dx) || !Number.isFinite(d.dy)) return;
  const moveMag = Math.sqrt(d.dx * d.dx + d.dy * d.dy);
  if (moveMag > 1.5) return;
  if (player.moveQueue.length >= 10) return;
  player.moveQueue.push({ dx: d.dx, dy: d.dy, seq: d.seq });
}

export function handleStop(player: Player): void {
  player.moveQueue = [];
  player.dx = 0;
  player.dy = 0;
}

export function handleGodTeleport(player: Player, d: any): void {
  if (!player.isGod) return;
  const tpX = d.x;
  const tpY = d.y;
  if (!Number.isFinite(tpX) || !Number.isFinite(tpY)) return;
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  if (tpX < 0 || tpX >= zone.def.width || tpY < 0 || tpY >= zone.def.height) return;
  if (!movementFormulas.isWalkable(zone.def, tpX, tpY)) return;
  player.moveQueue = [];
  player.dx = 0;
  player.dy = 0;
  player.combatTarget = null;
  player.fishingState = null;
  zone.moveEntity(player.eid, tpX, tpY);
  player.dirty = true;
  zone.broadcastToNearby(tpX, tpY, {
    op: Op.S_ENTITY_MOVE,
    d: { eid: player.eid, x: tpX, y: tpY, dx: 0, dy: 0, speed: 0, seq: player.lastMoveSeq },
  } satisfies ServerMessage);
  player.send({
    op: Op.S_ENTITY_STOP,
    d: { eid: player.eid, x: tpX, y: tpY },
  } satisfies ServerMessage);
}
