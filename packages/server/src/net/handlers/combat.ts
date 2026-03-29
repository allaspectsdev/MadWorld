import { AIState, movementFormulas } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { Mob } from "../../game/entities/Mob.js";
import { world } from "../../game/World.js";

export function handleAttack(player: Player, d: any): void {
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  const target = zone.entities.get(d.targetEid);
  if (!target || !(target instanceof Mob) || target.aiState === AIState.DEAD) return;
  const dist = movementFormulas.distance(player.x, player.y, target.x, target.y);
  if (dist > 10) return;
  player.combatTarget = d.targetEid;
}
