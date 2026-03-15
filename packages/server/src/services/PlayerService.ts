import { db } from "../db/index.js";
import { players, skills, inventory, equipment } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { Player } from "../game/entities/Player.js";
import { type SkillName, type Appearance, levelForXp } from "@madworld/shared";

export async function loadPlayer(userId: number): Promise<Player | null> {
  const [row] = await db
    .select()
    .from(players)
    .where(eq(players.userId, userId))
    .limit(1);

  if (!row) return null;

  const player = new Player(
    row.id,
    userId,
    row.name,
    row.zoneId,
    row.posX,
    row.posY,
    row.currentHp,
    row.maxHp,
    (row.appearance as Appearance) ?? { hairStyle: 0, hairColor: 0, skinColor: 0, shirtColor: 0 },
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

  // Calculate combat level
  const meleeXp = player.skills.get("melee" as SkillName)?.xp ?? 0;
  const defenseXp = player.skills.get("defense" as SkillName)?.xp ?? 0;
  const meleeLevel = levelForXp(meleeXp);
  const defenseLevel = levelForXp(defenseXp);
  player.maxHp = 100 + defenseLevel * 5;
  player.hp = Math.min(player.hp, player.maxHp);

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
}
