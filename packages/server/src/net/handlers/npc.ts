import { Op, type ServerMessage, SHOPS, movementFormulas } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { NPC } from "../../game/entities/NPC.js";
import { world } from "../../game/World.js";
import { getAvailableQuests, acceptQuest, turnInQuest } from "../../game/systems/QuestSystem.js";

export function handleNpcInteract(player: Player, d: any): void {
  const zone = world.getZone(player.zoneId);
  if (!zone) return;
  const target = zone.entities.get(d.targetEid);
  if (!target || !(target instanceof NPC)) return;
  if (movementFormulas.distance(player.x, player.y, target.x, target.y) > 2) return;

  const { available, turnIn } = getAvailableQuests(player, target.quests);

  player.send({
    op: Op.S_NPC_DIALOG,
    d: {
      npcName: target.name,
      dialog: target.dialog,
      availableQuests: available,
      turnInQuests: turnIn,
    },
  } satisfies ServerMessage);

  const npcShopItems = SHOPS[target.npcId];
  if (npcShopItems) {
    player.send({
      op: Op.S_SHOP_OPEN,
      d: {
        npcName: target.name,
        items: npcShopItems.map((e) => ({ itemId: e.itemId, buyPrice: e.buyPrice, stock: e.stock })),
      },
    } satisfies ServerMessage);
  }
}

export function handleQuestAccept(player: Player, d: any): void {
  acceptQuest(player, d.questId);
}

export function handleQuestTurnIn(player: Player, d: any): void {
  turnInQuest(player, d.questId);
}
