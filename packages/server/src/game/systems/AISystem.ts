import { world } from "../World.js";
import { Mob } from "../entities/Mob.js";
import { Player } from "../entities/Player.js";
import { AIState, TICK_MS, Op } from "@madworld/shared";
import { movementFormulas } from "@madworld/shared";
import type { Zone } from "../Zone.js";

function* allZones(): Iterable<Zone> {
  yield* world.zones.values();
  yield* world.instances.values();
}

export function processAI(): void {
  for (const zone of allZones()) {
    for (const [, mob] of zone.mobs) {
      // Dead mobs always process (respawn timer), stun skips everything else
      if (mob.aiState === AIState.DEAD) {
        processDead(mob, zone);
        continue;
      }
      if (mob.stunTicks > 0) continue;
      switch (mob.aiState) {
        case AIState.IDLE:
          processIdle(mob);
          break;
        case AIState.PATROL:
          processPatrol(mob, zone);
          break;
        case AIState.AGGRO:
        case AIState.CHASE:
          processChase(mob, zone);
          break;
        case AIState.RETURN:
          processReturn(mob, zone);
          break;
      }
    }
  }
}

function processIdle(mob: Mob): void {
  mob.idleTicks++;

  // Check for nearby players to aggro
  if (mob.def.aggroRange > 0) {
    const zone = world.getZone(mob.zoneId);
    if (zone) {
      for (const [, player] of zone.players) {
        const dist = movementFormulas.distance(mob.x, mob.y, player.x, player.y);
        if (dist <= mob.def.aggroRange) {
          mob.aiState = AIState.CHASE;
          mob.targetEid = player.eid;
          return;
        }
      }
    }
  }

  // Occasionally switch to patrol
  if (mob.idleTicks > 30 + Math.random() * 40) {
    mob.aiState = AIState.PATROL;
    mob.idleTicks = 0;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * mob.wanderRadius;
    mob.patrolTarget = {
      x: mob.spawnX + Math.cos(angle) * dist,
      y: mob.spawnY + Math.sin(angle) * dist,
    };
  }
}

function processPatrol(mob: Mob, zone: Zone): void {
  // Check for aggro
  if (mob.def.aggroRange > 0) {
    for (const [, player] of zone.players) {
      const dist = movementFormulas.distance(mob.x, mob.y, player.x, player.y);
      if (dist <= mob.def.aggroRange) {
        mob.aiState = AIState.CHASE;
        mob.targetEid = player.eid;
        return;
      }
    }
  }

  if (!mob.patrolTarget) {
    mob.aiState = AIState.IDLE;
    return;
  }

  const dist = movementFormulas.distance(mob.x, mob.y, mob.patrolTarget.x, mob.patrolTarget.y);
  if (dist < 0.5) {
    mob.aiState = AIState.IDLE;
    mob.patrolTarget = null;
    mob.dx = 0;
    mob.dy = 0;
    return;
  }

  moveToward(mob, mob.patrolTarget.x, mob.patrolTarget.y, zone);
}

function processChase(mob: Mob, zone: Zone): void {
  if (mob.targetEid === null) {
    mob.aiState = AIState.RETURN;
    return;
  }

  const target = zone.entities.get(mob.targetEid);
  if (!target || (target instanceof Player && target.hp <= 0)) {
    mob.targetEid = null;
    mob.aiState = AIState.RETURN;
    return;
  }

  // Bosses never leash
  if (!mob.isBoss) {
    const distFromSpawn = movementFormulas.distance(mob.x, mob.y, mob.spawnX, mob.spawnY);
    if (distFromSpawn > mob.def.chaseRange) {
      mob.targetEid = null;
      mob.aiState = AIState.RETURN;
      return;
    }
  }

  const distToTarget = movementFormulas.distance(mob.x, mob.y, target.x, target.y);

  // Close enough to attack (handled by CombatSystem)
  if (distToTarget <= 1.5) {
    mob.dx = 0;
    mob.dy = 0;
    return;
  }

  moveToward(mob, target.x, target.y, zone);
}

function processReturn(mob: Mob, zone: Zone): void {
  const dist = movementFormulas.distance(mob.x, mob.y, mob.spawnX, mob.spawnY);
  if (dist < 0.5) {
    mob.hp = mob.def.maxHp;
    mob.aiState = AIState.IDLE;
    mob.dx = 0;
    mob.dy = 0;
    return;
  }
  moveToward(mob, mob.spawnX, mob.spawnY, zone);
}

function processDead(mob: Mob, zone: Zone): void {
  mob.respawnTimer--;
  if (mob.respawnTimer <= 0) {
    mob.reset();
    zone.spatial.updateEntity(mob.eid, mob.x, mob.y);
    // Notify nearby players of respawn
    zone.broadcastToNearby(mob.x, mob.y, {
      op: Op.S_ENTITY_SPAWN,
      d: {
        eid: mob.eid,
        type: mob.type,
        x: mob.x,
        y: mob.y,
        name: mob.def.name,
        hp: mob.hp,
        maxHp: mob.def.maxHp,
        level: mob.def.level,
      },
    });
  }
}

function moveToward(
  mob: Mob,
  targetX: number,
  targetY: number,
  zone: Zone,
): void {
  const dx = targetX - mob.x;
  const dy = targetY - mob.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;

  const ndx = dx / dist;
  const ndy = dy / dist;
  const dt = TICK_MS / 1000;
  const newX = mob.x + ndx * mob.speed * dt;
  const newY = mob.y + ndy * mob.speed * dt;

  if (movementFormulas.isWalkable(zone.def, newX, newY)) {
    zone.moveEntity(mob.eid, newX, newY);
    mob.dx = ndx;
    mob.dy = ndy;
  }
}
