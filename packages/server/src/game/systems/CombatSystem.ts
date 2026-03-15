import { world } from "../World.js";
import { Player } from "../entities/Player.js";
import { Mob } from "../entities/Mob.js";
import type { Zone } from "../Zone.js";
import { Op, AIState, type ServerMessage } from "@madworld/shared";
import { combatFormulas, movementFormulas } from "@madworld/shared";
import { levelForXp } from "@madworld/shared";
import { SkillName } from "@madworld/shared";
import { ITEMS } from "@madworld/shared";

export function processCombat(): void {
  // Process player attacks
  for (const [, player] of world.playersByEid) {
    if (player.combatTarget === null) continue;
    if (player.attackCooldown > 0) {
      player.attackCooldown--;
      continue;
    }

    const zone = world.getZone(player.zoneId);
    if (!zone) continue;

    const target = zone.entities.get(player.combatTarget);
    if (!target) {
      player.combatTarget = null;
      continue;
    }

    const dist = movementFormulas.distance(player.x, player.y, target.x, target.y);
    if (dist > 2) {
      player.combatTarget = null;
      continue;
    }

    // Calculate player stats
    const meleeSkill = player.skills.get(SkillName.MELEE);
    const meleeLevel = meleeSkill ? levelForXp(meleeSkill.xp) : 1;
    let equipAttack = 0;
    for (const [, itemId] of player.equipment) {
      const item = ITEMS[itemId];
      if (item?.stats?.attack) equipAttack += item.stats.attack;
    }

    if (target instanceof Mob) {
      const result = combatFormulas.rollDamage(
        meleeLevel,
        equipAttack,
        target.def.defense,
        0,
      );

      if (result.hit) {
        target.hp = Math.max(0, target.hp - result.damage);
      }

      zone.broadcastToNearby(target.x, target.y, {
        op: Op.S_DAMAGE,
        d: {
          sourceEid: player.eid,
          targetEid: target.eid,
          amount: result.damage,
          isCrit: result.isCrit,
          targetHpAfter: target.hp,
        },
      } satisfies ServerMessage);

      if (target.hp <= 0) {
        handleMobDeath(target, player, zone);
      }
    }

    player.attackCooldown = 4; // 4 ticks = ~400ms
  }

  // Process mob attacks
  for (const [, zone] of world.zones) {
    for (const [, mob] of zone.mobs) {
      if (mob.aiState !== AIState.CHASE || mob.targetEid === null) continue;
      if (mob.attackCooldown > 0) {
        mob.attackCooldown--;
        continue;
      }

      const target = zone.players.get(mob.targetEid);
      if (!target || target.hp <= 0) continue;

      const dist = movementFormulas.distance(mob.x, mob.y, target.x, target.y);
      if (dist > 1.5) continue;

      const defenseSkill = target.skills.get(SkillName.DEFENSE);
      const defenseLevel = defenseSkill ? levelForXp(defenseSkill.xp) : 1;
      let equipDefense = 0;
      for (const [, itemId] of target.equipment) {
        const item = ITEMS[itemId];
        if (item?.stats?.defense) equipDefense += item.stats.defense;
      }

      const result = combatFormulas.rollDamage(
        mob.def.attack,
        0,
        defenseLevel,
        equipDefense,
      );

      if (result.hit) {
        target.hp = Math.max(0, target.hp - result.damage);
        target.dirty = true;
      }

      zone.broadcastToNearby(target.x, target.y, {
        op: Op.S_DAMAGE,
        d: {
          sourceEid: mob.eid,
          targetEid: target.eid,
          amount: result.damage,
          isCrit: result.isCrit,
          targetHpAfter: target.hp,
        },
      } satisfies ServerMessage);

      if (target.hp <= 0) {
        handlePlayerDeath(target, zone);
      }

      mob.attackCooldown = mob.def.attackSpeed;
    }
  }
}

function handleMobDeath(
  mob: Mob,
  killer: Player,
  zone: Zone,
): void {
  mob.aiState = AIState.DEAD;
  mob.respawnTimer = mob.def.respawnTicks;
  mob.dx = 0;
  mob.dy = 0;

  zone.broadcastToNearby(mob.x, mob.y, {
    op: Op.S_DEATH,
    d: { eid: mob.eid },
  } satisfies ServerMessage);

  // Grant XP
  const meleeSkill = killer.skills.get(SkillName.MELEE);
  if (meleeSkill) {
    meleeSkill.xp += mob.def.xpReward;
    const newLevel = levelForXp(meleeSkill.xp);
    killer.send({
      op: Op.S_XP_GAIN,
      d: { skillId: SkillName.MELEE, xp: mob.def.xpReward, totalXp: meleeSkill.xp },
    } satisfies ServerMessage);
    killer.dirty = true;
  }

  // Roll loot (drops handled later in Phase 3)
}

function handlePlayerDeath(
  player: Player,
  zone: Zone,
): void {
  zone.broadcastToNearby(player.x, player.y, {
    op: Op.S_DEATH,
    d: { eid: player.eid },
  } satisfies ServerMessage);

  // Respawn after 3 seconds (30 ticks)
  setTimeout(() => {
    player.hp = player.maxHp;
    const spawnZone = world.getZone(player.zoneId);
    if (!spawnZone) return;

    player.x = spawnZone.def.spawnX;
    player.y = spawnZone.def.spawnY;
    spawnZone.moveEntity(player.eid, player.x, player.y);
    player.combatTarget = null;
    player.dirty = true;

    zone.broadcastToNearby(player.x, player.y, {
      op: Op.S_RESPAWN,
      d: { eid: player.eid, x: player.x, y: player.y, hp: player.hp },
    } satisfies ServerMessage);
  }, 3000);
}
