import { db } from "../db/index.js";
import { players, skills, inventory, equipment, users, questProgress, skillSpecializations } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { Player } from "../game/entities/Player.js";
import { type SkillName, type Appearance, levelForXp, movementFormulas, getSpecNode } from "@madworld/shared";
import { ZONE_DEFS } from "../game/data/zones/index.js";

export async function loadPlayer(userId: number): Promise<Player | null> {
  const [row] = await db
    .select()
    .from(players)
    .where(eq(players.userId, userId))
    .limit(1);

  if (!row) return null;

  // Validate saved position — if stuck in non-walkable tile, reset to zone spawn
  let posX = row.posX;
  let posY = row.posY;
  let zoneId = row.zoneId;

  const zoneDef = ZONE_DEFS.find((z) => z.id === zoneId);
  if (zoneDef) {
    if (!movementFormulas.isWalkable(zoneDef, posX, posY)) {
      console.log(`[PlayerService] Player ${row.name} stuck at (${posX},${posY}) in ${zoneId}, resetting to spawn`);
      posX = zoneDef.spawnX;
      posY = zoneDef.spawnY;
    }
  } else {
    // Zone doesn't exist (maybe a dungeon instance that's gone) — reset to default
    console.log(`[PlayerService] Player ${row.name} in unknown zone ${zoneId}, resetting to greendale`);
    const defaultZone = ZONE_DEFS[0];
    zoneId = defaultZone.id;
    posX = defaultZone.spawnX;
    posY = defaultZone.spawnY;
  }

  // Check if user is a God
  const [userRow] = await db
    .select({ isGod: users.isGod })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const isGod = userRow?.isGod ?? false;

  const player = new Player(
    row.id,
    userId,
    row.name,
    zoneId,
    posX,
    posY,
    row.currentHp,
    row.maxHp,
    (row.appearance as Appearance) ?? { hairStyle: 0, hairColor: 0, skinColor: 0, shirtColor: 0 },
    isGod,
  );

  // Load skills
  const skillRows = await db
    .select()
    .from(skills)
    .where(eq(skills.playerId, row.id));

  for (const skill of skillRows) {
    player.skills.set(skill.skillId as SkillName, { xp: skill.xp });
  }

  // Load inventory
  const invRows = await db
    .select()
    .from(inventory)
    .where(eq(inventory.playerId, row.id));

  for (const inv of invRows) {
    if (inv.slotIndex >= 0 && inv.slotIndex < player.inventory.length) {
      player.inventory[inv.slotIndex] = {
        itemId: inv.itemId,
        quantity: inv.quantity,
      };
    }
  }

  // Load equipment
  const equipRows = await db
    .select()
    .from(equipment)
    .where(eq(equipment.playerId, row.id));

  for (const equip of equipRows) {
    player.equipment.set(equip.slot, equip.itemId);
  }

  // Load specialization effects
  const specRows = await db
    .select()
    .from(skillSpecializations)
    .where(eq(skillSpecializations.playerId, row.id));

  for (const spec of specRows) {
    const node = getSpecNode(spec.skillId as SkillName, spec.level);
    if (!node) continue;
    const choice = node.choiceA.id === spec.choiceId ? node.choiceA : node.choiceB;
    const effect = choice.effect as { type: string; value: number; skill?: string };
    player.specEffects.push({
      type: effect.type,
      value: effect.value,
      skill: (effect as any).skill,
    });
  }

  // Calculate combat level + apply spec bonuses
  const defenseXp = player.skills.get("defense" as SkillName)?.xp ?? 0;
  const defenseLevel = levelForXp(defenseXp);
  const baseMaxHp = 100 + defenseLevel * 5;
  const hpMult = player.getSpecBonus("hp_mult");
  player.maxHp = Math.floor(baseMaxHp * (1 + hpMult));
  player.hp = Math.min(player.hp, player.maxHp);

  // Apply speed_mult spec bonus to base speed multiplier
  const speedMult = player.getSpecBonus("speed_mult");
  if (speedMult > 0) {
    player.speedMultiplier = 1 + speedMult;
  }

  return player;
}

export async function savePlayer(player: Player): Promise<void> {
  await db
    .update(players)
    .set({
      zoneId: player.zoneId,
      posX: player.x,
      posY: player.y,
      currentHp: player.hp,
      maxHp: player.maxHp,
      lastSavedAt: new Date(),
    })
    .where(eq(players.id, player.playerId));

  // Save skills
  for (const [skillId, data] of player.skills) {
    await db
      .insert(skills)
      .values({ playerId: player.playerId, skillId, xp: data.xp })
      .onConflictDoUpdate({
        target: [skills.playerId, skills.skillId],
        set: { xp: data.xp },
      });
  }

  // Save inventory
  await db.delete(inventory).where(eq(inventory.playerId, player.playerId));
  for (let i = 0; i < player.inventory.length; i++) {
    const slot = player.inventory[i];
    if (slot) {
      await db.insert(inventory).values({
        playerId: player.playerId,
        slotIndex: i,
        itemId: slot.itemId,
        quantity: slot.quantity,
      });
    }
  }

  // Save equipment
  await db.delete(equipment).where(eq(equipment.playerId, player.playerId));
  for (const [slot, itemId] of player.equipment) {
    await db.insert(equipment).values({
      playerId: player.playerId,
      slot,
      itemId,
    });
  }
}

export async function saveQuestProgress(
  playerId: number,
  questId: string,
  step: number,
  completed: boolean,
  data?: Record<string, number>,
): Promise<void> {
  const existing = await db
    .select()
    .from(questProgress)
    .where(eq(questProgress.playerId, playerId))
    .then((rows) => rows.find((r) => r.questId === questId));

  if (existing) {
    await db
      .update(questProgress)
      .set({ step, completed, data: data ?? null })
      .where(eq(questProgress.id, existing.id));
  } else {
    await db.insert(questProgress).values({
      playerId,
      questId,
      step,
      completed,
      data: data ?? null,
    });
  }
}

export async function loadQuestProgress(
  playerId: number,
): Promise<{ questId: string; step: number; completed: boolean; data: Record<string, number> | null }[]> {
  return db
    .select()
    .from(questProgress)
    .where(eq(questProgress.playerId, playerId))
    .then((rows) => rows.map((r) => ({
      questId: r.questId,
      step: r.step,
      completed: r.completed,
      data: r.data as Record<string, number> | null,
    })));
}
