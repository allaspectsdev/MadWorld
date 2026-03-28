import { Op, type ServerMessage } from "@madworld/shared";
import { movementFormulas } from "@madworld/shared";
import { world } from "../World.js";
import { Mob } from "../entities/Mob.js";
import { Player } from "../entities/Player.js";
import { AIState } from "@madworld/shared";
import type { Zone } from "../Zone.js";
import type { BossAbilityDef } from "@madworld/shared";
import { getCurrentTick } from "../GameLoop.js";

export function processBossAI(): void {
  const tick = getCurrentTick();

  for (const [, zone] of world.instances) {
    for (const [, mob] of zone.mobs) {
      if (!mob.isBoss || mob.aiState === AIState.DEAD) continue;

      // Drain the pending actions queue
      drainPendingActions(mob, tick);

      if (mob.aiState !== AIState.CHASE) continue;
      processBossAbilities(mob, zone, tick);
    }
  }
}

/** Execute any pending actions whose fire tick has arrived. */
function drainPendingActions(mob: Mob, currentTick: number): void {
  let i = 0;
  while (i < mob.pendingActions.length) {
    const entry = mob.pendingActions[i];
    if (currentTick >= entry.fireTick) {
      mob.pendingActions.splice(i, 1);
      entry.action();
    } else {
      i++;
    }
  }
}

function processBossAbilities(boss: Mob, zone: Zone, currentTick: number): void {
  if (!boss.def.bossAbilities) return;

  for (const ability of boss.def.bossAbilities) {
    const cd = boss.abilityCooldowns.get(ability.id) ?? 0;
    if (cd > 0) {
      boss.abilityCooldowns.set(ability.id, cd - 1);
      continue;
    }

    executeBossAbility(boss, ability, zone, currentTick);
    boss.abilityCooldowns.set(ability.id, ability.cooldownTicks);
  }
}

function executeBossAbility(
  boss: Mob,
  ability: BossAbilityDef,
  zone: Zone,
  currentTick: number,
): void {
  if (ability.radius > 0 && ability.damage > 0) {
    // AoE ability — telegraph first, then damage after delay
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

    // Schedule damage via tick-based queue (not setTimeout)
    const fireTick = currentTick + ability.telegraphTicks;
    const bossEid = boss.eid;
    const zoneId = zone.id;
    const radius = ability.radius;
    const damage = ability.damage;

    boss.pendingActions.push({
      fireTick,
      action() {
        // Re-resolve zone and boss by ID to avoid stale references
        const z = world.getZone(zoneId);
        if (!z) return;
        const b = z.mobs.get(bossEid);
        if (!b || b.hp <= 0) return;

        for (const [, player] of z.players) {
          if (player.hp <= 0) continue;
          const dist = movementFormulas.distance(b.x, b.y, player.x, player.y);
          if (dist <= radius) {
            player.hp = Math.max(0, player.hp - damage);
            player.dirty = true;
            z.broadcastToNearby(player.x, player.y, {
              op: Op.S_DAMAGE,
              d: {
                sourceEid: bossEid,
                targetEid: player.eid,
                amount: damage,
                isCrit: false,
                targetHpAfter: player.hp,
              },
            } satisfies ServerMessage);
          }
        }
      },
    });
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

    // Schedule single-target damage via tick queue
    const fireTick = currentTick + ability.telegraphTicks;
    const bossEid = boss.eid;
    const zoneId = zone.id;
    const capturedTargetEid = targetEid;
    const damage = ability.damage;

    boss.pendingActions.push({
      fireTick,
      action() {
        const z = world.getZone(zoneId);
        if (!z) return;
        const b = z.mobs.get(bossEid);
        if (!b || b.hp <= 0) return;
        const t = z.players.get(capturedTargetEid);
        if (!t || t.hp <= 0) return;

        t.hp = Math.max(0, t.hp - damage);
        t.dirty = true;
        z.broadcastToNearby(t.x, t.y, {
          op: Op.S_DAMAGE,
          d: {
            sourceEid: bossEid,
            targetEid: capturedTargetEid,
            amount: damage,
            isCrit: false,
            targetHpAfter: t.hp,
          },
        } satisfies ServerMessage);
      },
    });
  }
  // war_cry: internal buff, no broadcast needed — handled in combat via stat boost
}
