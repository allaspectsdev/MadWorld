import { Op, type ServerMessage, ABILITIES, ITEMS, PARTY_XP_RANGE, AIState, SkillName, movementFormulas, combatFormulas } from "@madworld/shared";
import { levelForXp } from "@madworld/shared";
import type { Player } from "../../game/entities/Player.js";
import { Mob } from "../../game/entities/Mob.js";
import { world } from "../../game/World.js";
import { partyManager } from "../../game/PartyManager.js";
import { handleMobDeath } from "../../game/systems/CombatSystem.js";
import { applyStatusEffect } from "../../game/systems/AbilitySystem.js";

export function handleUseSkill(player: Player, d: any): void {
  if (player.hp <= 0) return;
  const abilityDef = ABILITIES[d.abilityId];
  if (!abilityDef) return;

  const cd = player.abilityCooldowns.get(abilityDef.id) ?? 0;
  if (cd > 0) return;
  if (player.stunTicks > 0) return;

  const skillData = player.skills.get(abilityDef.skillRequired as SkillName);
  const skillLevel = skillData ? levelForXp(skillData.xp) : 1;
  if (skillLevel < abilityDef.levelRequired) return;

  const zone = world.getZone(player.zoneId);
  if (!zone) return;

  player.abilityCooldowns.set(abilityDef.id, abilityDef.cooldownTicks);
  player.send({
    op: Op.S_SKILL_COOLDOWN,
    d: { abilityId: abilityDef.id, remainingMs: abilityDef.cooldownTicks * 100 },
  } satisfies ServerMessage);

  // Heal
  if (abilityDef.healPercent) {
    const healAmount = Math.floor(player.maxHp * abilityDef.healPercent);
    player.hp = Math.min(player.maxHp, player.hp + healAmount);
    player.dirty = true;
    zone.broadcastToNearby(player.x, player.y, {
      op: Op.S_DAMAGE,
      d: { sourceEid: player.eid, targetEid: player.eid, amount: -healAmount, isCrit: false, targetHpAfter: player.hp },
    } satisfies ServerMessage);
  }

  // Enemy-targeted
  if (abilityDef.targetType === "enemy" && d.targetEid !== undefined) {
    const target = zone.entities.get(d.targetEid);
    if (!target) return;

    const abilityDist = movementFormulas.distance(player.x, player.y, target.x, target.y);
    if (abilityDist > (abilityDef.range ?? 2.5)) return;

    if (target instanceof Mob && target.aiState !== AIState.DEAD) {
      const meleeSkill = player.skills.get(SkillName.MELEE);
      const meleeLevel = meleeSkill ? levelForXp(meleeSkill.xp) : 1;
      let equipAttack = 0;
      for (const [, itemId] of player.equipment) {
        const item = ITEMS[itemId];
        if (item?.stats?.attack) equipAttack += item.stats.attack;
      }

      const rollResult = combatFormulas.rollDamage(meleeLevel, equipAttack, target.def.defense, 0);
      let damage: number;
      if (abilityDef.guaranteedHit) {
        damage = Math.max(1, Math.floor(rollResult.damage * (abilityDef.damageMultiplier ?? 1)));
      } else {
        damage = rollResult.hit ? Math.floor(rollResult.damage * (abilityDef.damageMultiplier ?? 1)) : 0;
      }

      damage = Math.floor(damage * player.damageMultiplier);

      if (damage > 0) {
        target.hp = Math.max(0, target.hp - damage);
        if (target.isBoss) {
          const current = target.threatMap.get(player.eid) ?? 0;
          target.threatMap.set(player.eid, current + damage);
        }
      }

      zone.broadcastToNearby(target.x, target.y, {
        op: Op.S_DAMAGE,
        d: { sourceEid: player.eid, targetEid: target.eid, amount: damage, isCrit: rollResult.isCrit, targetHpAfter: target.hp },
      } satisfies ServerMessage);

      if (abilityDef.statusEffect && damage > 0) {
        applyStatusEffect(target.eid, abilityDef.statusEffect, player.eid, zone);
      }

      if (target.hp <= 0) {
        handleMobDeath(target, player, zone);
      }
    }
  }

  // Self buff
  if (abilityDef.statusEffect && abilityDef.targetType === "self") {
    applyStatusEffect(player.eid, abilityDef.statusEffect, player.eid, zone);

    if (abilityDef.partyBuff) {
      const party = partyManager.getPartyForPlayer(player.eid);
      if (party) {
        const members = partyManager.getPartyMembersInRange(party, player.x, player.y, player.zoneId, PARTY_XP_RANGE);
        for (const member of members) {
          if (member.eid !== player.eid) {
            applyStatusEffect(member.eid, abilityDef.statusEffect!, player.eid, zone);
          }
        }
      }
    }
  }

  // Dodge Roll
  if (abilityDef.dashDistance) {
    const lastMove = player.moveQueue.length > 0 ? player.moveQueue[player.moveQueue.length - 1] : null;
    const dashDx = lastMove ? lastMove.dx : (player.dx || 0);
    const dashDy = lastMove ? lastMove.dy : (player.dy || 1);
    const len = Math.sqrt(dashDx * dashDx + dashDy * dashDy) || 1;
    const newX = player.x + (dashDx / len) * abilityDef.dashDistance;
    const newY = player.y + (dashDy / len) * abilityDef.dashDistance;

    if (movementFormulas.isWalkable(zone.def, newX, newY)) {
      player.x = newX;
      player.y = newY;
      zone.moveEntity(player.eid, player.x, player.y);
      player.dirty = true;
      zone.broadcastToNearby(player.x, player.y, {
        op: Op.S_ENTITY_MOVE,
        d: { eid: player.eid, x: player.x, y: player.y, dx: dashDx / len, dy: dashDy / len, speed: player.speed * 3 },
      } satisfies ServerMessage);
    }
    if (abilityDef.invulnerableTicks) {
      player.invulnerableTicks = abilityDef.invulnerableTicks;
      applyStatusEffect(player.eid, "invulnerable", player.eid, zone);
    }
  }
}
