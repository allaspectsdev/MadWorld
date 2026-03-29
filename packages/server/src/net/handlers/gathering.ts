import { Op, type ServerMessage, RESOURCE_NODES, getRecipe, SkillName } from "@madworld/shared";
import { levelForXp } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { grantXp } from "../../game/systems/CombatSystem.js";
import { getCurrentTick } from "../../game/GameLoop.js";
import { giveItem, sendInventory } from "./context.js";

export function handleGatherStart(player: Player, d: any): void {
  // Can't gather while already gathering
  if (player.gatheringState) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Already gathering." } } satisfies ServerMessage);
    return;
  }

  const nodeDef = RESOURCE_NODES[d.nodeId];
  if (!nodeDef) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Unknown resource." } } satisfies ServerMessage);
    return;
  }

  const skillXp = player.skills.get(nodeDef.skill as SkillName)?.xp ?? 0;
  const skillLevel = levelForXp(skillXp);
  if (skillLevel < nodeDef.levelRequired) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Requires ${nodeDef.skill} level ${nodeDef.levelRequired}.` } } satisfies ServerMessage);
    return;
  }

  // Apply gather_speed spec bonus — reduces ticks
  const gatherSpeedBonus = player.getSpecBonus("gather_speed", nodeDef.skill);
  const effectiveTicks = Math.max(5, Math.floor(nodeDef.gatherTicks / (1 + gatherSpeedBonus)));

  const currentTick = getCurrentTick();
  player.gatheringState = {
    nodeEid: d.nodeEid ?? 0,
    nodeId: nodeDef.id,
    skill: nodeDef.skill,
    completeTick: currentTick + effectiveTicks,
    yields: nodeDef.yields,
    xp: nodeDef.xp,
  };

  // Stop movement while gathering
  player.moveQueue = [];
  player.dx = 0;
  player.dy = 0;
  player.combatTarget = null;

  player.send({
    op: Op.S_GATHER_START,
    d: { nodeEid: d.nodeEid, nodeId: nodeDef.id, waitingForAssist: false, ticks: effectiveTicks },
  } satisfies ServerMessage);
}

/**
 * Called each game tick to check for gathering completion.
 * Returns true if a gather completed this tick.
 */
export function processGatheringTick(player: Player, currentTick: number): boolean {
  const state = player.gatheringState;
  if (!state) return false;
  if (currentTick < state.completeTick) return false;

  // Gathering complete — award items with yield_mult spec bonus
  const yieldMult = 1 + player.getSpecBonus("yield_mult", state.skill);

  for (const y of state.yields) {
    if (Math.random() < (y.chance ?? 1)) {
      const qty = Math.max(1, Math.floor(y.quantity * yieldMult));
      giveItem(player, y.itemId, qty);
    }
  }

  grantXp(player, state.skill as SkillName, state.xp);
  sendInventory(player);

  player.send({
    op: Op.S_GATHER_RESULT,
    d: { nodeEid: state.nodeEid, success: true, xp: state.xp, skillId: state.skill },
  } satisfies ServerMessage);

  player.gatheringState = null;
  return true;
}

export function handleGatherAssist(player: Player): void {
  player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Assisting gather..." } } satisfies ServerMessage);
}

export function handleCraftStart(player: Player, d: any): void {
  const recipe = getRecipe(d.recipeId);
  if (!recipe) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Unknown recipe." } } satisfies ServerMessage);
    return;
  }
  const skillXp = player.skills.get(recipe.skill as SkillName)?.xp ?? 0;
  const skillLevel = levelForXp(skillXp);
  if (skillLevel < recipe.levelRequired) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Requires ${recipe.skill} level ${recipe.levelRequired}.` } } satisfies ServerMessage);
    return;
  }
  if (recipe.combo) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "This recipe requires two players. Use combo crafting." } } satisfies ServerMessage);
    return;
  }
  let hasAll = true;
  for (const ing of recipe.ingredients) {
    let found = 0;
    for (const slot of player.inventory) {
      if (slot && slot.itemId === ing.itemId) found += slot.quantity;
    }
    if (found < ing.quantity) { hasAll = false; break; }
  }
  if (!hasAll) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Missing ingredients." } } satisfies ServerMessage);
    return;
  }
  for (const ing of recipe.ingredients) {
    let remaining = ing.quantity;
    for (let i = 0; i < player.inventory.length && remaining > 0; i++) {
      const slot = player.inventory[i];
      if (slot && slot.itemId === ing.itemId) {
        const take = Math.min(slot.quantity, remaining);
        slot.quantity -= take;
        remaining -= take;
        if (slot.quantity <= 0) player.inventory[i] = null;
      }
    }
  }

  // Apply cook_burn_reduce spec bonus
  const burnReduce = player.getSpecBonus("cook_burn_reduce");
  const baseBurnChance = recipe.burnChance ? recipe.burnChance(skillLevel) : 0;
  const effectiveBurnChance = baseBurnChance * (1 - burnReduce);
  const burned = effectiveBurnChance > 0 && Math.random() < effectiveBurnChance;

  if (burned) {
    sendInventory(player);
    player.send({ op: Op.S_CRAFT_RESULT, d: { recipeId: recipe.id, success: false, burned: true } } satisfies ServerMessage);
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You burned it!" } } satisfies ServerMessage);
    return;
  }

  // Apply yield_mult spec bonus to crafting output
  const yieldMult = 1 + player.getSpecBonus("yield_mult", recipe.skill);
  const resultQty = Math.max(1, Math.floor(recipe.result.quantity * yieldMult));

  giveItem(player, recipe.result.itemId, resultQty);
  grantXp(player, recipe.skill as SkillName, recipe.xp);
  sendInventory(player);
  player.send({
    op: Op.S_CRAFT_RESULT,
    d: { recipeId: recipe.id, success: true, items: { itemId: recipe.result.itemId, quantity: resultQty }, xp: recipe.xp },
  } satisfies ServerMessage);
}

export function handleCraftContribute(player: Player): void {
  player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Combo crafting requires a partner at a crafting station." } } satisfies ServerMessage);
}
