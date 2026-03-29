import { Op, type ServerMessage, RESOURCE_NODES, getRecipe, SkillName } from "@madworld/shared";
import { levelForXp } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { grantXp } from "../../game/systems/CombatSystem.js";
import { giveItem, sendInventory } from "./context.js";

export function handleGatherStart(player: Player, d: any): void {
  const nodeDef = RESOURCE_NODES[d.nodeEid as unknown as string];
  if (!nodeDef) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Unknown resource." } } satisfies ServerMessage);
    return;
  }
  const skillXp = player.skills.get(nodeDef.skill as SkillName)?.xp ?? 0;
  if (levelForXp(skillXp) < nodeDef.levelRequired) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Requires ${nodeDef.skill} level ${nodeDef.levelRequired}.` } } satisfies ServerMessage);
    return;
  }
  for (const y of nodeDef.yields) {
    if (Math.random() < (y.chance ?? 1)) {
      giveItem(player, y.itemId, y.quantity);
    }
  }
  grantXp(player, nodeDef.skill as SkillName, nodeDef.xp);
  sendInventory(player);
  player.send({
    op: Op.S_GATHER_RESULT,
    d: { nodeEid: d.nodeEid, success: true, xp: nodeDef.xp, skillId: nodeDef.skill },
  } satisfies ServerMessage);
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
  if (levelForXp(skillXp) < recipe.levelRequired) {
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
  const burned = recipe.burnChance
    ? Math.random() < recipe.burnChance(levelForXp(skillXp))
    : false;
  if (burned) {
    sendInventory(player);
    player.send({ op: Op.S_CRAFT_RESULT, d: { recipeId: recipe.id, success: false, burned: true } } satisfies ServerMessage);
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You burned it!" } } satisfies ServerMessage);
    return;
  }
  giveItem(player, recipe.result.itemId, recipe.result.quantity);
  grantXp(player, recipe.skill as SkillName, recipe.xp);
  sendInventory(player);
  player.send({
    op: Op.S_CRAFT_RESULT,
    d: { recipeId: recipe.id, success: true, items: recipe.result, xp: recipe.xp },
  } satisfies ServerMessage);
}

export function handleCraftContribute(player: Player): void {
  player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Combo crafting requires a partner at a crafting station." } } satisfies ServerMessage);
}
