import { Op, type ServerMessage } from "@madworld/shared";
import { movementFormulas } from "@madworld/shared";
import { world } from "../World.js";
import { Mob } from "../entities/Mob.js";
import { Player } from "../entities/Player.js";
import { AIState } from "@madworld/shared";
import type { Zone } from "../Zone.js";
import type { BossAbilityDef } from "@madworld/shared";

export function processBossAI(): void {
  for (const [, zone] of world.instances) {
    for (const [, mob] of zone.mobs) {
      if (!mob.isBoss || mob.aiState === AIState.DEAD) continue;
      if (mob.aiState !== AIState.CHASE) continue;
      processBossAbilities(mob, zone);
    }
  }
}

function processBossAbilities(boss: Mob, zone: Zone): void {
  if (!boss.def.bossAbilities) return;

  for (const ability of boss.def.bossAbilities) {
    const cd = boss.abilityCooldowns.get(ability.id) ?? 0;
    if (cd > 0) {
      boss.abilityCooldowns.set(ability.id, cd - 1);
      continue;
    }

    executeBossAbility(boss, ability, zone);
    boss.abilityCooldowns.set(ability.id, ability.cooldownTicks);
  }
}

function executeBossAbility(boss: Mob, ability: BossAbilityDef, zone: Zone): void {
  if (ability.radius > 0 && ability.damage > 0) {
    // AoE ability — telegraph first, then damage
    zone.broadcastToNearby(boss.x, boss.y, {
      op: Op.S_BOSS_ABILITY,
      d: {
        bossEid: boss.eid,
        abilityId: ability.id,
        targetX: boss.x,
        targetY: boss.y,
        radius: ability.radius,
      },
    } satisfies ServerMessage);

    // Schedule damage after telegraph
    const telegraphMs = ability.telegraphTicks * 100;
    setTimeout(() => {
      if (boss.hp <= 0) return;
      for (const [, player] of zone.players) {
        if (player.hp <= 0) continue;
        const dist = movementFormulas.distance(boss.x, boss.y, player.x, player.y);
        if (dist <= ability.radius) {
          player.hp = Math.max(0, player.hp - ability.damage);
          player.dirty = true;
          zone.broadcastToNearby(player.x, player.y, {
            op: Op.S_DAMAGE,
            d: {
              sourceEid: boss.eid,
              targetEid: player.eid,
              amount: ability.damage,
              isCrit: false,
              targetHpAfter: player.hp,
            },
          } satisfies ServerMessage);
        }
      }
    }, telegraphMs);
  } else if (ability.id === "death_gaze" && ability.damage > 0) {
    // Single-target ability — target highest threat
    let maxThreat = 0;
    let targetEid: number | null = null;
    for (const [eid, threat] of boss.threatMap) {
      const p = zone.players.get(eid);
      if (p && p.hp > 0 && threat > maxThreat) {
        maxThreat = threat;
        targetEid = eid;
      }
    }
    if (targetEid === null) return;

    const target = zone.players.get(targetEid);
    if (!target) return;

    zone.broadcastToNearby(target.x, target.y, {
      op: Op.S_BOSS_ABILITY,
      d: {
        bossEid: boss.eid,
        abilityId: ability.id,
        targetX: target.x,
        targetY: target.y,
        radius: 0,
      },
    } satisfies ServerMessage);

    setTimeout(() => {
      if (boss.hp <= 0 || target.hp <= 0) return;
      target.hp = Math.max(0, target.hp - ability.damage);
      target.dirty = true;
      zone.broadcastToNearby(target.x, target.y, {
        op: Op.S_DAMAGE,
        d: {
          sourceEid: boss.eid,
          targetEid: target.eid,
          amount: ability.damage,
          isCrit: false,
          targetHpAfter: target.hp,
        },
      } satisfies ServerMessage);
    }, ability.telegraphTicks * 100);
  }
  // war_cry: internal buff, no broadcast needed — handled in combat via stat boost
}
