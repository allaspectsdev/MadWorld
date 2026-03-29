import { Op, type ServerMessage, ITEMS, FISHING_SPOTS, TileType, SkillName } from "@madworld/shared";
import { levelForXp } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { world } from "../../game/World.js";
import { grantXp } from "../../game/systems/CombatSystem.js";
import { onItemPickup as questOnItemPickup } from "../../game/systems/QuestSystem.js";
import { getCurrentTick } from "../../game/GameLoop.js";
import { weatherManager } from "../../game/WeatherManager.js";

export function handleFishCast(player: Player): void {
  if (player.fishingState) return;
  if (player.stunTicks > 0) return;

  const zone = world.getZone(player.zoneId);
  if (!zone) return;

  const px = Math.floor(player.x);
  const py = Math.floor(player.y);
  let hasWater = false;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const tx = px + dx;
    const ty = py + dy;
    if (ty >= 0 && ty < zone.def.height && tx >= 0 && tx < zone.def.width) {
      if (zone.def.tiles[ty][tx] === TileType.WATER) { hasWater = true; break; }
    }
  }
  if (!hasWater) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You need to be next to water to fish." } } satisfies ServerMessage);
    return;
  }

  const fishingSkill = player.skills.get(SkillName.FISHING);
  const fishingLevel = fishingSkill ? levelForXp(fishingSkill.xp) : 1;

  const eligibleSpots = FISHING_SPOTS.filter((s) => fishingLevel >= s.levelReq);
  if (eligibleSpots.length === 0) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Nothing to catch here." } } satisfies ServerMessage);
    return;
  }

  const spot = eligibleSpots[Math.floor(Math.random() * eligibleSpots.length)];

  player.fishingState = {
    startTick: getCurrentTick(),
    fish: spot.fish,
    catchTick: spot.catchTicks,
    biteSent: false,
  };

  player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You cast your line..." } } satisfies ServerMessage);
}

export function handleFishReel(player: Player): void {
  if (!player.fishingState) return;

  const state = player.fishingState;
  const elapsed = getCurrentTick() - state.startTick;

  const weatherFishMult = weatherManager.getFishingMultiplier(player.x, player.y);
  const specFishMult = 1 + player.getSpecBonus("fish_catch_mult");
  const effectiveCatchTick = Math.floor(state.catchTick / (weatherFishMult * specFishMult));

  const biteAt = Math.floor(effectiveCatchTick * 0.7);
  if (elapsed < biteAt) {
    player.send({ op: Op.S_FISH_RESULT, d: { success: false } } satisfies ServerMessage);
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You reeled in too early!" } } satisfies ServerMessage);
    player.fishingState = null;
    return;
  }

  if (weatherFishMult <= 0) {
    player.send({ op: Op.S_FISH_RESULT, d: { success: false } } satisfies ServerMessage);
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "The weather is too harsh to fish!" } } satisfies ServerMessage);
    player.fishingState = null;
    return;
  }

  if (elapsed <= effectiveCatchTick + 20) {
    const spot = FISHING_SPOTS.find((s) => s.fish === state.fish);
    const xp = spot?.baseXp ?? 10;

    let fishSlot = -1;
    const fishDef = ITEMS[state.fish];
    if (fishDef?.stackable) {
      for (let i = 0; i < player.inventory.length; i++) {
        if (player.inventory[i]?.itemId === state.fish) { fishSlot = i; break; }
      }
    }
    if (fishSlot === -1) fishSlot = player.inventory.indexOf(null);
    if (fishSlot === -1) {
      player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Inventory full!" } } satisfies ServerMessage);
      player.fishingState = null;
      return;
    }

    const existing = player.inventory[fishSlot];
    if (existing?.itemId === state.fish) {
      existing.quantity += 1;
    } else {
      player.inventory[fishSlot] = { itemId: state.fish, quantity: 1 };
    }

    player.send({
      op: Op.S_INV_UPDATE,
      d: { slots: [{ index: fishSlot, itemId: player.inventory[fishSlot]!.itemId, quantity: player.inventory[fishSlot]!.quantity }] },
    } satisfies ServerMessage);

    player.send({ op: Op.S_FISH_RESULT, d: { success: true, itemId: state.fish, xp } } satisfies ServerMessage);
    grantXp(player, SkillName.FISHING, xp);
    questOnItemPickup(player, state.fish);
    player.dirty = true;
  } else {
    player.send({ op: Op.S_FISH_RESULT, d: { success: false } } satisfies ServerMessage);
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "The fish got away!" } } satisfies ServerMessage);
  }

  player.fishingState = null;
}
