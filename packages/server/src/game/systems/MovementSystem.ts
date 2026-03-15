import { world } from "../World.js";
import { Player } from "../entities/Player.js";
import { partyManager } from "../PartyManager.js";
import { instanceManager } from "../InstanceManager.js";
import { Op, TICK_MS, TileType, type ServerMessage, type Portal } from "@madworld/shared";
import { movementFormulas } from "@madworld/shared";

export function processMovement(): void {
  for (const [, player] of world.playersByEid) {
    if (player.moveQueue.length === 0) continue;

    // Process only the latest move intent per tick (drain stale ones)
    const move = player.moveQueue.length > 1
      ? player.moveQueue.splice(0, player.moveQueue.length).pop()!
      : player.moveQueue.shift()!;
    const zone = world.getZone(player.zoneId);
    if (!zone) continue;

    const dt = TICK_MS / 1000;
    const newX = player.x + move.dx * player.speed * dt;
    const newY = player.y + move.dy * player.speed * dt;

    // Check walkability
    if (!movementFormulas.isWalkable(zone.def, newX, newY)) {
      // Send correction back
      player.send({
        op: Op.S_ENTITY_MOVE,
        d: {
          eid: player.eid,
          x: player.x,
          y: player.y,
          dx: 0,
          dy: 0,
          speed: player.speed,
          seq: move.seq,
        },
      } satisfies ServerMessage);
      continue;
    }

    // Check for portal
    const tile = movementFormulas.tileAt(zone.def, newX, newY);
    if (tile !== null) {
      const portal = zone.def.portals.find(
        (p) => p.x === Math.floor(newX) && p.y === Math.floor(newY),
      );
      if (portal) {
        if (portal.dungeonId) {
          handleDungeonEntry(player, portal);
        } else {
          handleZoneTransition(player, portal.targetZoneId, portal.targetX, portal.targetY);
        }
        continue;
      }
    }

    // Apply movement
    zone.moveEntity(player.eid, newX, newY);
    player.dx = move.dx;
    player.dy = move.dy;
    player.lastMoveSeq = move.seq;
    player.dirty = true;

    // Broadcast to nearby
    zone.broadcastToNearby(newX, newY, {
      op: Op.S_ENTITY_MOVE,
      d: {
        eid: player.eid,
        x: newX,
        y: newY,
        dx: move.dx,
        dy: move.dy,
        speed: player.speed,
        seq: move.seq,
      },
    } satisfies ServerMessage);
  }
}

function handleZoneTransition(
  player: Player,
  targetZoneId: string,
  targetX: number,
  targetY: number,
): void {
  const oldZone = world.getZone(player.zoneId);
  const newZone = world.getZone(targetZoneId);
  if (!oldZone || !newZone) return;

  oldZone.removeEntity(player.eid);
  player.zoneId = targetZoneId;
  player.x = targetX;
  player.y = targetY;
  player.dirty = true;

  newZone.addEntity(player);
  newZone.sendZoneData(player);
}

function handleDungeonEntry(player: Player, portal: Portal): void {
  const party = partyManager.getPartyForPlayer(player.eid);

  if (!party) {
    player.send({
      op: Op.S_SYSTEM_MESSAGE,
      d: { message: "You must be in a party to enter a dungeon." },
    } satisfies ServerMessage);
    return;
  }

  if (party.leaderEid !== player.eid) {
    player.send({
      op: Op.S_SYSTEM_MESSAGE,
      d: { message: "Only the party leader can enter the dungeon." },
    } satisfies ServerMessage);
    return;
  }

  let instance = instanceManager.getInstanceForParty(party.id);
  if (!instance) {
    instance = instanceManager.createInstance(party.id, portal.dungeonId!);
  }

  // Pull in all party members near the portal
  for (const memberEid of party.members) {
    const member = world.getPlayer(memberEid);
    if (!member) continue;
    if (member.zoneId !== player.zoneId) continue;

    const dist = movementFormulas.distance(member.x, member.y, portal.x, portal.y);
    if (dist > 5) continue;

    instanceManager.enterInstance(member, instance.instanceId);
  }
}
