import { world } from "../World.js";
import { Player } from "../entities/Player.js";
import { Mob } from "../entities/Mob.js";
import type { Zone } from "../Zone.js";
import { partyManager } from "../PartyManager.js";
import { instanceManager } from "../InstanceManager.js";
import { Op, AIState, PARTY_XP_RANGE, PARTY_XP_BONUS, type ServerMessage } from "@madworld/shared";
import { combatFormulas, movementFormulas } from "@madworld/shared";
import { levelForXp } from "@madworld/shared";
import { SkillName } from "@madworld/shared";
import { ITEMS } from "@madworld/shared";

function* allZones(): Iterable<Zone> {
  yield* world.zones.values();
  yield* world.instances.values();
}

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
        // Track threat for bosses
        if (target.isBoss) {
          const current = target.threatMap.get(player.eid) ?? 0;
          target.threatMap.set(player.eid, current + result.damage);
        }
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

  // Process mob attacks (world + instance zones)
  for (const zone of allZones()) {
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

function grantXp(player: Player, skill: SkillName, xp: number): void {
  const skillData = player.skills.get(skill);
  if (!skillData) return;
  const oldLevel = levelForXp(skillData.xp);
  skillData.xp += xp;
  const newLevel = levelForXp(skillData.xp);

  player.send({
    op: Op.S_XP_GAIN,
    d: { skillId: skill, xp, totalXp: skillData.xp },
  } satisfies ServerMessage);

  if (newLevel > oldLevel) {
    player.send({
      op: Op.S_LEVEL_UP,
      d: { skillId: skill, newLevel },
    } satisfies ServerMessage);
  }

  player.dirty = true;
}

function handleMobDeath(mob: Mob, killer: Player, zone: Zone): void {
  mob.aiState = AIState.DEAD;
  mob.respawnTimer = mob.def.respawnTicks;
  mob.dx = 0;
  mob.dy = 0;

  zone.broadcastToNearby(mob.x, mob.y, {
    op: Op.S_DEATH,
    d: { eid: mob.eid },
  } satisfies ServerMessage);

  // --- Shared XP ---
  const party = partyManager.getPartyForPlayer(killer.eid);
  const baseXp = mob.def.xpReward;

  if (party) {
    const membersInRange = partyManager.getPartyMembersInRange(
      party,
      mob.x,
      mob.y,
      killer.zoneId,
      PARTY_XP_RANGE,
    );
    const numInRange = Math.max(1, membersInRange.length);
    const sharedXp = Math.floor((baseXp * (1 + PARTY_XP_BONUS)) / numInRange);

    for (const member of membersInRange) {
      grantXp(member, SkillName.MELEE, sharedXp);
    }
  } else {
    grantXp(killer, SkillName.MELEE, baseXp);
  }

  // --- Boss Kill ---
  if (mob.isBoss && zone.instanceId) {
    instanceManager.handleBossKill(zone.instanceId);
  }
}

function handlePlayerDeath(player: Player, zone: Zone): void {
  zone.broadcastToNearby(player.x, player.y, {
    op: Op.S_DEATH,
    d: { eid: player.eid },
  } satisfies ServerMessage);

  // In dungeon: check for wipe, don't auto-respawn
  if (zone.instanceId) {
    const allDead = [...zone.players.values()].every((p) => p.hp <= 0);
    if (allDead) {
      setTimeout(() => {
        instanceManager.handleWipe(zone.instanceId!);
      }, 2000);
    }
    return;
  }

  // Overworld: respawn after 3 seconds
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
