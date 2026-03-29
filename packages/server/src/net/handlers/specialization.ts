import { Op, type ServerMessage, getSpecNode, SkillName } from "@madworld/shared";
import { levelForXp } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { skillSpecializations } from "../../db/schema.js";
import { db } from "../../db/index.js";
import { eq, and } from "drizzle-orm";

export async function handleSpecChoose(player: Player, d: any): Promise<void> {
  const { skillId, level, choiceId } = d;
  const node = getSpecNode(skillId as SkillName, level);
  if (!node) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Invalid specialization." } } satisfies ServerMessage);
    return;
  }
  const choice = node.choiceA.id === choiceId ? node.choiceA
    : node.choiceB.id === choiceId ? node.choiceB : null;
  if (!choice) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "Invalid choice." } } satisfies ServerMessage);
    return;
  }
  const skillXp = player.skills.get(skillId as SkillName)?.xp ?? 0;
  if (levelForXp(skillXp) < level) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Requires ${skillId} level ${level}.` } } satisfies ServerMessage);
    return;
  }
  const existing = await db.select().from(skillSpecializations)
    .where(and(
      eq(skillSpecializations.playerId, player.playerId),
      eq(skillSpecializations.skillId, skillId),
      eq(skillSpecializations.level, level),
    )).limit(1);
  if (existing.length > 0) {
    player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: "You already chose a specialization at this level." } } satisfies ServerMessage);
    return;
  }
  await db.insert(skillSpecializations).values({ playerId: player.playerId, skillId, level, choiceId });
  player.send({ op: Op.S_SYSTEM_MESSAGE, d: { message: `Specialized as ${choice.name}!` } } satisfies ServerMessage);
  await sendSpecList(player);
}

export async function sendSpecList(player: Player): Promise<void> {
  const rows = await db.select().from(skillSpecializations)
    .where(eq(skillSpecializations.playerId, player.playerId));
  const specs = rows.map((r) => {
    const node = getSpecNode(r.skillId as SkillName, r.level);
    const choice = node?.choiceA.id === r.choiceId ? node.choiceA : node?.choiceB;
    return {
      skillId: r.skillId,
      level: r.level,
      choiceId: r.choiceId,
      name: choice?.name ?? r.choiceId,
      description: choice?.description ?? "",
    };
  });
  player.send({ op: Op.S_SPEC_LIST, d: { specs } } satisfies ServerMessage);
}
