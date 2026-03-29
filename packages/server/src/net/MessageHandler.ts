/**
 * MessageHandler — thin opcode router.
 *
 * All handler logic lives in net/handlers/*.ts. This file is responsible
 * only for: rate limiting, JSON parse, auth gating, and switch dispatch.
 */

import { Op, type ClientMessage, encodePong } from "@madworld/shared";
import type { ServerWebSocket } from "bun";
import type { Player } from "../game/entities/Player.js";

// ---- Per-system handler imports ----
import { handleAuth, handleDisconnect as authHandleDisconnect, handleGodCommand } from "./handlers/auth.js";
import { handleMove, handleStop, handleGodTeleport } from "./handlers/movement.js";
import { handleAttack } from "./handlers/combat.js";
import { handlePartyInvite, handlePartyAccept, handlePartyDecline, handlePartyLeave, handlePartyKick } from "./handlers/party.js";
import { handleDungeonEnter } from "./handlers/dungeon.js";
import { handleChatSend } from "./handlers/chat.js";
import { handlePickup, handleInvMove, handleInvDrop, handleInvUse, handleEquip, handleUnequip } from "./handlers/inventory.js";
import { handleNpcInteract, handleQuestAccept, handleQuestTurnIn } from "./handlers/npc.js";
import { handleUseSkill } from "./handlers/ability.js";
import { handleShopBuy, handleShopSell } from "./handlers/shop.js";
import { handleFishCast, handleFishReel } from "./handlers/fishing.js";
import { handleBoatPlace, handleBoatEnter, handleBoatExit } from "./handlers/boat.js";
import { handlePlaceCamp, handleInteractCamp, handleCampStore, handleCampWithdraw, handleFastTravel } from "./handlers/camp.js";
import { handlePlaceFurniture, handleRemoveFurniture, handleGardenPlant } from "./handlers/homestead.js";
import { handleGatherStart, handleGatherAssist, handleCraftStart, handleCraftContribute } from "./handlers/gathering.js";
import { handlePetTame, handlePetSummon, handlePetRename } from "./handlers/pets.js";
import { handleSpecChoose } from "./handlers/specialization.js";

// ---- Connection types & rate limiting ----

export interface SocketData {
  userId: number | null;
  player: Player | null;
  msgCount: number;
}

export type GameWebSocket = ServerWebSocket<SocketData>;

const MSG_RATE_LIMIT = 20;
const activeWebSockets = new Set<GameWebSocket>();

export function createSocketData(): SocketData {
  return { userId: null, player: null, msgCount: 0 };
}

export function trackConnection(ws: GameWebSocket): void {
  activeWebSockets.add(ws);
}

export function untrackConnection(ws: GameWebSocket): void {
  activeWebSockets.delete(ws);
}

export function resetAllRateLimits(): void {
  for (const ws of activeWebSockets) ws.data.msgCount = 0;
}

// ---- Main message router ----

export async function handleMessage(ws: GameWebSocket, raw: string): Promise<void> {
  ws.data.msgCount++;
  if (ws.data.msgCount > MSG_RATE_LIMIT) return;

  let msg: ClientMessage;
  try { msg = JSON.parse(raw); } catch { return; }

  if (msg.op === Op.C_AUTH_LOGIN) {
    await handleAuth(ws, msg.d as any);
    return;
  }

  const player = ws.data.player;
  if (!player) {
    ws.send(JSON.stringify({ op: Op.S_AUTH_ERROR, d: { reason: "Not authenticated" } }));
    return;
  }

  switch (msg.op) {
    // Movement
    case Op.C_MOVE:           handleMove(player, msg.d); break;
    case Op.C_STOP:           handleStop(player); break;
    case Op.C_GOD_TELEPORT:   handleGodTeleport(player, msg.d); break;

    // Combat
    case Op.C_ATTACK:         handleAttack(player, msg.d); break;
    case Op.C_USE_SKILL:      handleUseSkill(player, msg.d); break;

    // Party
    case Op.C_PARTY_INVITE:   handlePartyInvite(player, msg.d); break;
    case Op.C_PARTY_ACCEPT:   handlePartyAccept(player, msg.d); break;
    case Op.C_PARTY_DECLINE:  handlePartyDecline(player, msg.d); break;
    case Op.C_PARTY_LEAVE:    handlePartyLeave(player); break;
    case Op.C_PARTY_KICK:     handlePartyKick(player, msg.d); break;

    // Dungeons
    case Op.C_DUNGEON_ENTER:  await handleDungeonEnter(player, msg.d); break;

    // Chat (god commands handled inside)
    case Op.C_CHAT_SEND: {
      const rawMsg = msg.d.message;
      if (rawMsg && typeof rawMsg === "string" && rawMsg.startsWith("/") && player.isGod) {
        const message = rawMsg.replace(/<[^>]*>/g, "").trim();
        handleGodCommand(player, message);
      } else {
        handleChatSend(player, msg.d);
      }
      break;
    }

    // Inventory
    case Op.C_PICKUP:         handlePickup(player, msg.d); break;
    case Op.C_INV_MOVE:       handleInvMove(player, msg.d); break;
    case Op.C_INV_DROP:       handleInvDrop(player, msg.d); break;
    case Op.C_INV_USE:        handleInvUse(player, msg.d); break;
    case Op.C_EQUIP:          handleEquip(player, msg.d); break;
    case Op.C_UNEQUIP:        handleUnequip(player, msg.d); break;

    // NPC & Quests
    case Op.C_NPC_INTERACT:   handleNpcInteract(player, msg.d); break;
    case Op.C_QUEST_ACCEPT:   handleQuestAccept(player, msg.d); break;
    case Op.C_QUEST_TURN_IN:  handleQuestTurnIn(player, msg.d); break;

    // Shops
    case Op.C_SHOP_BUY:       handleShopBuy(player, msg.d); break;
    case Op.C_SHOP_SELL:      handleShopSell(player, msg.d); break;

    // Fishing
    case Op.C_FISH_CAST:      handleFishCast(player); break;
    case Op.C_FISH_REEL:      handleFishReel(player); break;

    // Boats
    case Op.C_BOAT_PLACE:     handleBoatPlace(player, msg.d); break;
    case Op.C_BOAT_ENTER:     handleBoatEnter(player, msg.d); break;
    case Op.C_BOAT_EXIT:      handleBoatExit(player); break;

    // Camps
    case Op.C_PLACE_CAMP:     await handlePlaceCamp(player, msg.d); break;
    case Op.C_INTERACT_CAMP:  await handleInteractCamp(player); break;
    case Op.C_CAMP_STORE:     await handleCampStore(player, msg.d); break;
    case Op.C_CAMP_WITHDRAW:  await handleCampWithdraw(player, msg.d); break;
    case Op.C_FAST_TRAVEL:    handleFastTravel(player, msg.d); break;

    // Homestead
    case Op.C_PLACE_FURNITURE:  await handlePlaceFurniture(player, msg.d); break;
    case Op.C_REMOVE_FURNITURE: await handleRemoveFurniture(player, msg.d); break;
    case Op.C_GARDEN_PLANT:     await handleGardenPlant(player, msg.d); break;

    // Gathering & Crafting
    case Op.C_GATHER_START:     handleGatherStart(player, msg.d); break;
    case Op.C_GATHER_ASSIST:    handleGatherAssist(player); break;
    case Op.C_CRAFT_START:      handleCraftStart(player, msg.d); break;
    case Op.C_CRAFT_CONTRIBUTE: handleCraftContribute(player); break;

    // Pets
    case Op.C_PET_TAME:       await handlePetTame(player, msg.d); break;
    case Op.C_PET_SUMMON:     await handlePetSummon(player, msg.d); break;
    case Op.C_PET_RENAME:     await handlePetRename(player, msg.d); break;

    // Specializations
    case Op.C_SPEC_CHOOSE:    await handleSpecChoose(player, msg.d); break;

    // Ping
    case Op.C_PING:           player.send(encodePong(msg.d.t ?? 0, Date.now())); break;

    default: break;
  }
}

export { authHandleDisconnect as handleDisconnect };
