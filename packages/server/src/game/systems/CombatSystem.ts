import { world } from "../World.js";
import { Player } from "../entities/Player.js";
import { Mob } from "../entities/Mob.js";
import { GroundItem } from "../entities/GroundItem.js";
import type { Zone } from "../Zone.js";
import { partyManager } from "../PartyManager.js";
import { instanceManager } from "../InstanceManager.js";
import { onMobKill as questOnMobKill } from "./QuestSystem.js";
import { Op, AIState, PARTY_XP_RANGE, PARTY_XP_BONUS, type ServerMessage } from "@madworld/shared";
import { combatFormulas, movementFormulas } from "@madworld/shared";
import { levelForXp, xpForLevel } from "@madworld/shared";
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

    // Skip if player is stunned
    if (player.stunTicks > 0) continue;

    const zone = world.getZone(player.zoneId);
    if (!zone) continue;

    const target = zone.entities.get(player.combatTarget);
    if (!target) {
      player.combatTarget = null;
      continue;
    }

    const dist = movementFormulas.distance(player.x, player.y, target.x, target.y);
    if (dist > 2.5) {
      // Only show "too far" message if genuinely far away (>4 tiles),
      // not for minor desync during active combat
      if (dist > 4) {
        const now = Date.now();
        if (!player.lastRangeMsg || now - player.lastRangeMsg >= 2000) {
          player.lastRangeMsg = now;
          player.send({
            op: Op.S_SYSTEM_MESSAGE,
            d: { message: "Too far to attack" },
          } satisfies ServerMessage);
        }
      }
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
      // Skip dead mobs — prevents double-kill from auto-attack
      if (target.aiState === AIState.DEAD) {
        player.combatTarget = null;
        continue;
      }

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
      if (mob.stunTicks > 0) continue;
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

      // Skip damage if target is invulnerable
      if (target.invulnerableTicks > 0) continue;

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

export function grantXp(player: Player, skill: SkillName, xp: number): void {
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

export function handleMobDeath(mob: Mob, killer: Player, zone: Zone): void {
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
      questOnMobKill(member, mob.def.id);
    }
  } else {
    grantXp(killer, SkillName.MELEE, baseXp);
    questOnMobKill(killer, mob.def.id);
  }

  // --- Boss Kill ---
  if (mob.isBoss && zone.instanceId) {
    instanceManager.handleBossKill(zone.instanceId);
  }

  // --- Loot Drops ---
  for (const loot of mob.def.lootTable) {
    if (Math.random() < loot.chance) {
      const offsetX = (Math.random() - 0.5) * 1.5;
      const offsetY = (Math.random() - 0.5) * 1.5;
      const groundItem = new GroundItem(
        zone.id,
        mob.x + offsetX,
        mob.y + offsetY,
        loot.itemId,
        loot.quantity,
      );
      zone.addEntity(groundItem);
    }
  }
}

function handlePlayerDeath(player: Player, zone: Zone): void {
  zone.broadcastToNearby(player.x, player.y, {
    op: Op.S_DEATH,
    d: { eid: player.eid },
  } satisfies ServerMessage);

  // Death penalty: lose 5% XP in melee skill (cannot drop below current level floor)
  const meleeSkill = player.skills.get(SkillName.MELEE);
  if (meleeSkill && meleeSkill.xp > 0) {
    const currentLevel = levelForXp(meleeSkill.xp);
    const levelFloorXp = xpForLevel(currentLevel);
    const loss = Math.floor(meleeSkill.xp * 0.05);
    const actualLoss = Math.min(loss, meleeSkill.xp - levelFloorXp);
    if (actualLoss > 0) {
      meleeSkill.xp -= actualLoss;
      player.send({
        op: Op.S_XP_GAIN,
        d: { skillId: SkillName.MELEE, xp: -actualLoss, totalXp: meleeSkill.xp },
      } satisfies ServerMessage);
    }
  }

  // Death penalty: drop 10% gold
  let totalGold = 0;
  for (const slot of player.inventory) {
    if (slot && slot.itemId === "gold_coins") totalGold += slot.quantity;
  }
  const goldLoss = Math.floor(totalGold * 0.1);
  if (goldLoss > 0) {
    let remaining = goldLoss;
    for (let i = 0; i < player.inventory.length && remaining > 0; i++) {
      const slot = player.inventory[i];
      if (slot && slot.itemId === "gold_coins") {
        const take = Math.min(remaining, slot.quantity);
        slot.quantity -= take;
        remaining -= take;
        if (slot.quantity <= 0) player.inventory[i] = null;
      }
    }
    // Drop gold on ground
    const groundItem = new GroundItem(
      zone.id,
      player.x,
      player.y,
      "gold_coins",
      goldLoss,
    );
    zone.addEntity(groundItem);
    player.dirty = true;

    player.send({
      op: Op.S_SYSTEM_MESSAGE,
      d: { message: `You died and lost ${goldLoss} gold.` },
    } satisfies ServerMessage);
  }

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

  // Overworld: respawn after 5 seconds
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
  }, 5000);
}
