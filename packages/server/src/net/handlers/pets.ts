import { Op, type ServerMessage, PETS, movementFormulas } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { Mob } from "../../game/entities/Mob.js";
import { world } from "../../game/World.js";
import { petManager } from "../../game/PetManager.js";
import { sendInventory } from "./context.js";

export async function handlePetTame(player: Player, d: any): Promise<void> {
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  const targetMob = zone.mobs.get(d.targetEid);
  if (!targetMob) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "No creature to tame here." } } satisfies ServerMessage);
    return;
  }
  const dist = movementFormulas.distance(player.x, player.y, targetMob.x, targetMob.y);
  if (dist > 2.5) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Too far away." } } satisfies ServerMessage);
    return;
  }
  const petDef = Object.values(PETS).find((p) => p.sourceMobId === targetMob.def.id);
  if (!petDef) {
    player.send({ op: Op.S_PET_TAME_RESULT, d: { success: false, message: "This creature can't be tamed." } } satisfies ServerMessage);
    return;
  }
  const treatSlot = player.inventory.findIndex((s) => s && s.itemId === petDef.treatItemId);
  if (treatSlot === -1) {
    player.send({ op: Op.S_PET_TAME_RESULT, d: { success: false, message: `You need ${petDef.treatItemId} to tame this creature.` } } satisfies ServerMessage);
    return;
  }
  const ts = player.inventory[treatSlot]!;
  ts.quantity -= 1;
  if (ts.quantity <= 0) player.inventory[treatSlot] = null;
  sendInventory(player);
  const tamed = await petManager.attemptTame(
    player.playerId, player.eid, targetMob.def.id,
    player.x, player.y, player.zoneId,
    true, (m) => player.send(m),
  );
  if (tamed) zone.removeEntity(d.targetEid);
}

export async function handlePetSummon(player: Player, d: any): Promise<void> {
  await petManager.summonPet(
    player.playerId, player.eid, d.petId,
    player.x, player.y, player.zoneId,
    (m) => player.send(m),
  );
}

export async function handlePetRename(player: Player, d: any): Promise<void> {
  await petManager.renamePet(player.playerId, d.petId, d.name, (m) => player.send(m));
}
