import { Op, type ServerMessage } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { partyManager } from "../../game/PartyManager.js";
import { instanceManager } from "../../game/InstanceManager.js";

export async function handleDungeonEnter(player: Player, d: any): Promise<void> {
  const party = partyManager.getPartyForPlayer(player.eid);
  if (!party) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You need a party to enter a dungeon." } } satisfies ServerMessage);
    return;
  }
  const existing = instanceManager.getInstanceForParty(party.id);
  if (existing) {
    instanceManager.enterInstance(player, existing.instanceId);
  } else {
    const portalId = d.portalId;
    if (!portalId) return;
    try {
      const inst = instanceManager.createInstance(party.id, portalId);
      instanceManager.enterInstance(player, inst.instanceId);
    } catch {
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Failed to create dungeon instance." } } satisfies ServerMessage);
    }
  }
}
