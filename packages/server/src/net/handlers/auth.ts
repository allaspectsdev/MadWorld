import { Op, type ServerMessage, ITEMS, ABILITIES, AIState, SkillName, movementFormulas } from "@madworld/shared";
import { levelForXp, xpForLevel } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { NPC } from "../../game/entities/NPC.js";
import { world } from "../../game/World.js";
import { partyManager } from "../../game/PartyManager.js";
import { verifyToken } from "../../auth/jwt.js";
import { loadPlayer, savePlayer } from "../../services/PlayerService.js";
import { tradeManager } from "../../game/TradeManager.js";
import { initQuestState, sendQuestList, cleanupQuestState, persistQuestState } from "../../game/systems/QuestSystem.js";
import { sendInitialDiscoveries } from "../../game/systems/DiscoverySystem.js";
import { handleMobDeath } from "../../game/systems/CombatSystem.js";
import { giveItem } from "./context.js";
import type { GameWebSocket } from "../MessageHandler.js";

export async function handleAuth(
  ws: GameWebSocket,
  data: { email: string; password: string },
): Promise<void> {
  const tokenData = data as unknown as { token: string };
  if (tokenData.token) {
    const userId = await verifyToken(tokenData.token);
    if (!userId) {
      ws.send(JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "Invalid token" } }));
      return;
    }

    const existing = world.getPlayerByUserId(userId);
    if (existing) {
      if (existing.partyId) partyManager.leaveParty(existing);
      if (existing.ws) {
        existing.ws.send(JSON.stringify({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Logged in from another device." } }));
        existing.ws.close(1000, "Logged in elsewhere");
      }
      world.removePlayer(existing);
    }

    const player = await loadPlayer(userId);
    if (!player) {
      ws.send(JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "No character found" } }));
      return;
    }

    if (player.isGod) {
      player.maxHp = 99999;
      player.hp = 99999;
      player.speed = player.speed * 1.5;
    }

    ws.data.userId = userId;
    ws.data.player = player;
    player.ws = ws;

    world.addPlayer(player);

    ws.send(JSON.stringify({
      op: Op.S_AUTH_OK,
      d: { token: "", playerId: player.playerId, eid: player.eid, ...(player.isGod ? { isGod: true } : {}), appearance: player.appearance },
    }));

    ws.send(JSON.stringify({ op: Op.S_PLAYER_STATS, d: { hp: player.hp, maxHp: player.maxHp, level: 1 } }));

    const invSlots: Array<{ index: number; itemId: string | null; quantity: number }> = [];
    for (let i = 0; i < player.inventory.length; i++) {
      const slot = player.inventory[i];
      if (slot) invSlots.push({ index: i, itemId: slot.itemId, quantity: slot.quantity });
    }
    if (invSlots.length > 0) {
      player.send({ op: Op.S_INV_UPDATE, d: { slots: invSlots } } satisfies ServerMessage);
    }

    for (const [slot, itemId] of player.equipment) {
      player.send({ op: Op.S_EQUIP_UPDATE, d: { slot, itemId } } satisfies ServerMessage);
    }

    await initQuestState(player);
    sendQuestList(player);

    await world.chunkManager.loadPlayerDiscoveries(player.playerId);
    await world.chunkManager.warmArea(player.x, player.y, 2);
    sendInitialDiscoveries(player, world.chunkManager);

    const unlockedAbilities: { slot: number; abilityId: string; cooldownMs: number }[] = [];
    for (const [abilityId, aDef] of Object.entries(ABILITIES)) {
      const aSkillData = player.skills.get(aDef.skillRequired as SkillName);
      const aSkillLevel = aSkillData ? levelForXp(aSkillData.xp) : 1;
      if (aSkillLevel >= aDef.levelRequired) {
        const remainingCd = player.abilityCooldowns.get(abilityId) ?? 0;
        unlockedAbilities.push({ slot: aDef.slot, abilityId, cooldownMs: remainingCd * 100 });
      }
    }
    player.send({ op: Op.S_ABILITY_LIST, d: { abilities: unlockedAbilities } } satisfies ServerMessage);

    ws.send(JSON.stringify({
      op: Op.S_CHAT_MESSAGE,
      d: { channel: "system", senderName: "", message: "Welcome to MadWorld! Use WASD to move. Click mobs to attack. Press Enter to chat.", timestamp: Date.now() },
    }));
  }
}

export async function handleDisconnect(ws: GameWebSocket): Promise<void> {
  const player = ws.data.player;
  if (player) {
    player.ws = null;
    tradeManager.onPlayerDisconnect(player);
    await persistQuestState(player).catch((err) =>
      console.error(`[Disconnect] Failed to save quests for ${player.name}:`, err));
    cleanupQuestState(player.eid);
    if (player.partyId) partyManager.leaveParty(player);
    await savePlayer(player).catch((err) =>
      console.error(`[Disconnect] Failed to save player ${player.name}:`, err));
    world.chunkManager.removePlayer(player.playerId);
    world.removePlayer(player);
  }
}

// ---- God commands ----

function godZoneTransition(player: Player, targetZoneId: string, targetX: number, targetY: number): boolean {
  const oldZone = world.getZone(player.zoneId);
  const newZone = world.getZone(targetZoneId);
  if (!oldZone || !newZone) return false;
  player.moveQueue = [];
  player.combatTarget = null;
  player.fishingState = null;
  oldZone.removeEntity(player.eid);
  player.zoneId = targetZoneId;
  player.x = targetX;
  player.y = targetY;
  player.dirty = true;
  newZone.addEntity(player);
  newZone.sendZoneData(player);
  return true;
}

export function handleGodCommand(player: Player, command: string): void {
  const parts = command.slice(1).split(" ");
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "give": {
      const itemId = args[0];
      const quantity = parseInt(args[1] ?? "1", 10) || 1;
      if (!itemId || !ITEMS[itemId]) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Unknown item: ${itemId}. Use /items to list.` } } satisfies ServerMessage);
        break;
      }
      const result = giveItem(player, itemId, quantity);
      if (result) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Spawned ${quantity}x ${ITEMS[itemId].name}` } } satisfies ServerMessage);
      } else {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory full" } } satisfies ServerMessage);
      }
      break;
    }

    case "items": {
      const filter = args[0]?.toLowerCase();
      const entries = Object.values(ITEMS)
        .filter((item: any) => !filter || item.category === filter || item.id.includes(filter))
        .slice(0, 20);
      const list = entries.map((i: any) => `${i.id} (${i.category}, ${i.rarity})`).join(", ");
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Items: ${list}` } } satisfies ServerMessage);
      break;
    }

    case "spawn": {
      const npcName = args[0]?.replace(/_/g, " ");
      if (!npcName) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Usage: /spawn <NPC_Name> [dialog text]" } } satisfies ServerMessage);
        break;
      }
      const dialog = args.slice(1).join(" ") || "...";
      const zone = world.getZone(player.zoneId);
      if (!zone) break;
      const npc = new NPC(`god_npc_${Date.now()}`, npcName, dialog, [], player.zoneId, player.x, player.y);
      zone.addEntity(npc);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Spawned NPC "${npcName}"` } } satisfies ServerMessage);
      break;
    }

    case "heal": {
      player.hp = player.maxHp;
      player.dirty = true;
      player.send({ op: Op.S_PLAYER_STATS, d: { hp: player.hp, maxHp: player.maxHp, level: 1 } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Fully healed" } } satisfies ServerMessage);
      break;
    }

    case "kill": {
      const zone = world.getZone(player.zoneId);
      if (!zone) break;
      let count = 0;
      for (const [, mob] of zone.mobs) {
        const dist = movementFormulas.distance(player.x, player.y, mob.x, mob.y);
        if (dist <= 5 && mob.aiState !== AIState.DEAD) {
          mob.hp = 0;
          handleMobDeath(mob, player, zone);
          count++;
        }
      }
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Killed ${count} nearby mobs` } } satisfies ServerMessage);
      break;
    }

    case "killall": {
      const zone = world.getZone(player.zoneId);
      if (!zone) break;
      let count = 0;
      for (const [, mob] of zone.mobs) {
        if (mob.aiState !== AIState.DEAD) {
          mob.hp = 0;
          handleMobDeath(mob, player, zone);
          count++;
        }
      }
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Killed all ${count} mobs in zone` } } satisfies ServerMessage);
      break;
    }

    case "goto": {
      const targetZoneId = args[0]?.toLowerCase();
      if (!targetZoneId) {
        const zoneIds = Array.from(world.zones.keys()).join(", ");
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Usage: /goto <zone>. Zones: ${zoneIds}` } } satisfies ServerMessage);
        break;
      }
      let matchedZoneId: string | null = null;
      for (const zid of world.zones.keys()) {
        if (zid === targetZoneId || zid.includes(targetZoneId)) { matchedZoneId = zid; break; }
      }
      if (!matchedZoneId) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Unknown zone: ${targetZoneId}. Use /zones to list.` } } satisfies ServerMessage);
        break;
      }
      const targetZone = world.getZone(matchedZoneId);
      if (!targetZone) break;
      const ok = godZoneTransition(player, matchedZoneId, targetZone.def.spawnX, targetZone.def.spawnY);
      if (ok) player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Teleported to ${targetZone.def.name}` } } satisfies ServerMessage);
      break;
    }

    case "zones": {
      const zoneList = Array.from(world.zones.entries()).map(([id, z]) => `${id} (${z.def.name})`).join(", ");
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Zones: ${zoneList}` } } satisfies ServerMessage);
      break;
    }

    case "speed": {
      const mult = parseFloat(args[0] ?? "1.5");
      if (isNaN(mult) || mult < 0.5 || mult > 10) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Usage: /speed <0.5-10>" } } satisfies ServerMessage);
        break;
      }
      player.speed = 3 * mult;
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Speed set to ${mult}x` } } satisfies ServerMessage);
      break;
    }

    case "level": {
      const skillId = args[0]?.toLowerCase();
      const targetLevel = parseInt(args[1] ?? "10", 10);
      if (!skillId) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Usage: /level <skill> <level>. Skills: melee, defense, agility, fishing, mining, woodcutting, foraging, cooking, smithing, alchemy" } } satisfies ServerMessage);
        break;
      }
      const skillData = player.skills.get(skillId as SkillName);
      if (!skillData) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Unknown skill: ${skillId}` } } satisfies ServerMessage);
        break;
      }
      const xpNeeded = xpForLevel(targetLevel);
      skillData.xp = xpNeeded;
      player.dirty = true;
      player.send({ op: Op.S_XP_GAIN, d: { skillId, xp: 0, totalXp: xpNeeded } } satisfies ServerMessage);
      player.send({ op: Op.S_LEVEL_UP, d: { skillId, newLevel: targetLevel } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Set ${skillId} to level ${targetLevel}` } } satisfies ServerMessage);
      break;
    }

    case "who": {
      const players: string[] = [];
      for (const [, p] of world.playersByEid) players.push(`${p.name} (${p.zoneId})`);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Online (${players.length}): ${players.join(", ") || "none"}` } } satisfies ServerMessage);
      break;
    }

    case "tp": {
      const targetName = args[0];
      if (!targetName) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Usage: /tp <playerName>" } } satisfies ServerMessage);
        break;
      }
      let targetPlayer: Player | undefined;
      for (const [, p] of world.playersByEid) {
        if (p.name.toLowerCase() === targetName.toLowerCase()) { targetPlayer = p; break; }
      }
      if (!targetPlayer) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Player "${targetName}" not found or offline` } } satisfies ServerMessage);
        break;
      }
      if (player.zoneId !== targetPlayer.zoneId) {
        godZoneTransition(player, targetPlayer.zoneId, targetPlayer.x, targetPlayer.y);
      } else {
        const tpZone = world.getZone(player.zoneId);
        if (tpZone) {
          player.moveQueue = [];
          tpZone.moveEntity(player.eid, targetPlayer.x, targetPlayer.y);
          player.dirty = true;
          tpZone.broadcastToNearby(targetPlayer.x, targetPlayer.y, {
            op: Op.S_ENTITY_MOVE,
            d: { eid: player.eid, x: targetPlayer.x, y: targetPlayer.y, dx: 0, dy: 0, speed: 0, seq: player.lastMoveSeq },
          } satisfies ServerMessage);
          player.send({ op: Op.S_ENTITY_STOP, d: { eid: player.eid, x: targetPlayer.x, y: targetPlayer.y } } satisfies ServerMessage);
        }
      }
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Teleported to ${targetPlayer.name}` } } satisfies ServerMessage);
      break;
    }

    case "summon": {
      const summonName = args[0];
      if (!summonName) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Usage: /summon <playerName>" } } satisfies ServerMessage);
        break;
      }
      let summonTarget: Player | undefined;
      for (const [, p] of world.playersByEid) {
        if (p.name.toLowerCase() === summonName.toLowerCase()) { summonTarget = p; break; }
      }
      if (!summonTarget) {
        player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Player "${summonName}" not found or offline` } } satisfies ServerMessage);
        break;
      }
      if (summonTarget.zoneId !== player.zoneId) {
        const oldZone = world.getZone(summonTarget.zoneId);
        const newZone = world.getZone(player.zoneId);
        if (oldZone && newZone) {
          oldZone.removeEntity(summonTarget.eid);
          summonTarget.zoneId = player.zoneId;
          summonTarget.x = player.x;
          summonTarget.y = player.y;
          summonTarget.dirty = true;
          newZone.addEntity(summonTarget);
          newZone.sendZoneData(summonTarget);
        }
      } else {
        const zone = world.getZone(player.zoneId);
        if (zone) {
          zone.moveEntity(summonTarget.eid, player.x, player.y);
          zone.broadcastToNearby(player.x, player.y, {
            op: Op.S_ENTITY_MOVE,
            d: { eid: summonTarget.eid, x: player.x, y: player.y, dx: 0, dy: 0, speed: 0, seq: 0 },
          } satisfies ServerMessage);
        }
      }
      summonTarget.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `You have been summoned by ${player.name}` } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Summoned ${summonTarget.name}` } } satisfies ServerMessage);
      break;
    }

    case "god":
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `God mode active. HP: ${player.hp}/${player.maxHp}, Speed: ${player.speed.toFixed(1)}, Zone: ${player.zoneId} (${player.x.toFixed(1)}, ${player.y.toFixed(1)})` } } satisfies ServerMessage);
      break;

    case "clear": {
      for (let i = 0; i < player.inventory.length; i++) player.inventory[i] = null;
      const slots = player.inventory.map((_, i) => ({ index: i, itemId: null as string | null, quantity: 0 }));
      player.send({ op: Op.S_INV_UPDATE, d: { slots } } satisfies ServerMessage);
      player.dirty = true;
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory cleared" } } satisfies ServerMessage);
      break;
    }

    case "help":
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "God commands:" } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "/give <item> [qty] | /items [filter] | /goto <zone> | /zones" } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "/tp <player> | /summon <player> | /spawn <Name> [dialog]" } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "/kill | /killall | /heal | /speed <mult> | /level <skill> <lvl>" } } satisfies ServerMessage);
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "/who | /god | /clear" } } satisfies ServerMessage);
      break;

    default:
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Unknown command: /${cmd}. Type /help for list.` } } satisfies ServerMessage);
  }
}
