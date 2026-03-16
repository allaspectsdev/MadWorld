import { world } from "../World.js";
import { Player } from "../entities/Player.js";
import { Mob } from "../entities/Mob.js";
import { Op, STATUS_EFFECTS, type ServerMessage } from "@madworld/shared";
import type { Zone } from "../Zone.js";

function* allZones(): Iterable<Zone> {
  yield* world.zones.values();
  yield* world.instances.values();
}

export function processAbilities(): void {
  for (const [, player] of world.playersByEid) {
    // Tick down ability cooldowns
    for (const [id, ticks] of player.abilityCooldowns) {
      if (ticks > 0) {
        player.abilityCooldowns.set(id, ticks - 1);
      } else {
        player.abilityCooldowns.delete(id);
      }
    }

    // Tick stun & invulnerability
    if (player.stunTicks > 0) player.stunTicks--;
    if (player.invulnerableTicks > 0) player.invulnerableTicks--;

    // Reset stat multipliers each tick, then reapply from active effects
    player.speedMultiplier = 1;
    player.damageMultiplier = 1;

    // Process status effects
    processStatusEffects(player);
  }

  // Process mob status effects
  for (const zone of allZones()) {
    for (const [, mob] of zone.mobs) {
      if (mob.stunTicks > 0) mob.stunTicks--;
      processMobStatusEffects(mob, zone);
    }
  }
}

function processStatusEffects(player: Player): void {
  for (const [effectId, effect] of player.statusEffects) {
    const def = STATUS_EFFECTS[effect.defId];
    if (!def) {
      player.statusEffects.delete(effectId);
      continue;
    }

    effect.ticksLeft--;

    // Apply stat modifiers
    if (def.statMod) {
      if (def.statMod.stat === "speed") player.speedMultiplier *= def.statMod.multiplier;
      if (def.statMod.stat === "damage") player.damageMultiplier *= def.statMod.multiplier;
    }

    // Per-tick effects (poison damage, regen)
    if (def.onTick && effect.ticksLeft > 0 && effect.ticksLeft % def.onTick.intervalTicks === 0) {
      const zone = world.getZone(player.zoneId);
      if (def.onTick.damage && zone) {
        player.hp = Math.max(0, player.hp - def.onTick.damage);
        player.dirty = true;
        zone.broadcastToNearby(player.x, player.y, {
          op: Op.S_DAMAGE,
          d: {
            sourceEid: effect.sourceEid,
            targetEid: player.eid,
            amount: def.onTick.damage,
            isCrit: false,
            targetHpAfter: player.hp,
          },
        } satisfies ServerMessage);
        zone.broadcastToNearby(player.x, player.y, {
          op: Op.S_STATUS_EFFECT,
          d: { targetEid: player.eid, effectId: effect.defId, action: "tick" },
        } satisfies ServerMessage);
      }
      if (def.onTick.heal) {
        player.hp = Math.min(player.maxHp, player.hp + def.onTick.heal);
        player.dirty = true;
      }
    }

    // Expire
    if (effect.ticksLeft <= 0) {
      player.statusEffects.delete(effectId);
      const zone = world.getZone(player.zoneId);
      if (zone) {
        zone.broadcastToNearby(player.x, player.y, {
          op: Op.S_STATUS_EFFECT,
          d: { targetEid: player.eid, effectId: effect.defId, action: "remove" },
        } satisfies ServerMessage);
      }
    }
  }
}

function processMobStatusEffects(mob: Mob, zone: Zone): void {
  for (const [effectId, effect] of mob.statusEffects) {
    const def = STATUS_EFFECTS[effect.defId];
    if (!def) {
      mob.statusEffects.delete(effectId);
      continue;
    }

    effect.ticksLeft--;

    if (def.onTick && effect.ticksLeft > 0 && effect.ticksLeft % def.onTick.intervalTicks === 0) {
      if (def.onTick.damage) {
        mob.hp = Math.max(0, mob.hp - def.onTick.damage);
        zone.broadcastToNearby(mob.x, mob.y, {
          op: Op.S_DAMAGE,
          d: {
            sourceEid: effect.sourceEid,
            targetEid: mob.eid,
            amount: def.onTick.damage,
            isCrit: false,
            targetHpAfter: mob.hp,
          },
        } satisfies ServerMessage);
        zone.broadcastToNearby(mob.x, mob.y, {
          op: Op.S_STATUS_EFFECT,
          d: { targetEid: mob.eid, effectId: effect.defId, action: "tick" },
        } satisfies ServerMessage);
      }
    }

    if (effect.ticksLeft <= 0) {
      mob.statusEffects.delete(effectId);
      zone.broadcastToNearby(mob.x, mob.y, {
        op: Op.S_STATUS_EFFECT,
        d: { targetEid: mob.eid, effectId: effect.defId, action: "remove" },
      } satisfies ServerMessage);
    }
  }
}

export function applyStatusEffect(targetEid: number, defId: string, sourceEid: number, zone: Zone): void {
  const def = STATUS_EFFECTS[defId];
  if (!def) return;

  // Find target (player or mob)
  const entity = zone.entities.get(targetEid);
  if (!entity) return;

  const isPlayer = entity instanceof Player;
  const isMob = entity instanceof Mob;
  if (!isPlayer && !isMob) return;

  const target = entity as Player | Mob;
  target.statusEffects.set(defId, { defId, ticksLeft: def.durationTicks, sourceEid });

  // Apply stun
  if (defId === "stun") {
    target.stunTicks = def.durationTicks;
  }

  zone.broadcastToNearby(target.x, target.y, {
    op: Op.S_STATUS_EFFECT,
    d: {
      targetEid,
      effectId: defId,
      action: "apply",
      durationMs: def.durationTicks * 100,
    },
  } satisfies ServerMessage);
}
