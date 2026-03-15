import { SpatialGrid } from "./SpatialGrid.js";
import { Entity } from "./entities/Entity.js";
import { Player } from "./entities/Player.js";
import { Mob } from "./entities/Mob.js";
import { GroundItem } from "./entities/GroundItem.js";
import { Op, EntityType, type ZoneDef, type ServerMessage } from "@madworld/shared";

export class Zone {
  readonly id: string;
  readonly def: ZoneDef;
  readonly spatial = new SpatialGrid();
  readonly entities = new Map<number, Entity>();
  readonly players = new Map<number, Player>();
  readonly mobs = new Map<number, Mob>();

  // Instance dungeon fields
  instanceId: string | null = null;
  partyId: string | null = null;
  isDungeon = false;
  isComplete = false;

  constructor(def: ZoneDef, instanceId?: string, partyId?: string) {
    this.id = instanceId ? `dungeon:${instanceId}` : def.id;
    this.def = def;
    if (instanceId) {
      this.instanceId = instanceId;
      this.partyId = partyId ?? null;
      this.isDungeon = true;
    }
  }

  resetInstance(): void {
    for (const [, mob] of this.mobs) {
      mob.reset();
      this.spatial.updateEntity(mob.eid, mob.x, mob.y);
    }
    this.isComplete = false;
  }

  addEntity(entity: Entity): void {
    this.entities.set(entity.eid, entity);
    this.spatial.updateEntity(entity.eid, entity.x, entity.y);

    if (entity instanceof Player) {
      this.players.set(entity.eid, entity);
    } else if (entity instanceof Mob) {
      this.mobs.set(entity.eid, entity);
    }

    // Notify nearby players about the new entity
    this.broadcastToNearby(entity.x, entity.y, {
      op: Op.S_ENTITY_SPAWN,
      d: {
        eid: entity.eid,
        type: entity.type,
        x: entity.x,
        y: entity.y,
        ...(entity instanceof Player
          ? { name: entity.name, appearance: entity.appearance, hp: entity.hp, maxHp: entity.maxHp }
          : {}),
        ...(entity instanceof Mob
          ? { name: entity.def.name, mobId: entity.def.id, hp: entity.hp, maxHp: entity.def.maxHp, level: entity.def.level }
          : {}),
        ...(entity instanceof GroundItem
          ? { name: entity.itemId, mobId: entity.itemId }
          : {}),
      },
    } satisfies ServerMessage);
  }

  removeEntity(eid: number): void {
    const entity = this.entities.get(eid);
    if (!entity) return;

    this.broadcastToNearby(entity.x, entity.y, {
      op: Op.S_ENTITY_DESPAWN,
      d: { eid },
    } satisfies ServerMessage);

    this.spatial.removeEntity(eid);
    this.entities.delete(eid);
    this.players.delete(eid);
    this.mobs.delete(eid);
  }

  moveEntity(eid: number, x: number, y: number): void {
    const entity = this.entities.get(eid);
    if (!entity) return;
    entity.x = x;
    entity.y = y;
    this.spatial.updateEntity(eid, x, y);
  }

  broadcastToNearby(x: number, y: number, msg: ServerMessage, exclude?: number): void {
    const nearbyEids = this.spatial.queryNearby(x, y);
    const payload = JSON.stringify(msg);
    for (const eid of nearbyEids) {
      if (eid === exclude) continue;
      const player = this.players.get(eid);
      if (player) {
        player.send(msg);
      }
    }
  }

  /** Send zone data to a player entering this zone */
  sendZoneData(player: Player): void {
    player.send({
      op: Op.S_ENTER_ZONE,
      d: {
        zoneId: this.id,
        name: this.def.name,
        width: this.def.width,
        height: this.def.height,
        tiles: this.def.tiles,
        spawnX: this.def.spawnX,
        spawnY: this.def.spawnY,
        lights: this.def.lights,
      },
    } satisfies ServerMessage);

    // Send all nearby entities to the player
    const nearby = this.spatial.queryNearby(player.x, player.y);
    for (const eid of nearby) {
      if (eid === player.eid) continue;
      const entity = this.entities.get(eid);
      if (!entity) continue;

      player.send({
        op: Op.S_ENTITY_SPAWN,
        d: {
          eid: entity.eid,
          type: entity.type,
          x: entity.x,
          y: entity.y,
          ...(entity instanceof Player
            ? { name: entity.name, appearance: entity.appearance, hp: entity.hp, maxHp: entity.maxHp }
            : {}),
          ...(entity instanceof Mob
            ? { name: entity.def.name, mobId: entity.def.id, hp: entity.hp, maxHp: entity.def.maxHp, level: entity.def.level }
            : {}),
          ...(entity instanceof GroundItem
            ? { name: entity.itemId, mobId: entity.itemId }
            : {}),
        },
      } satisfies ServerMessage);
    }
  }
}
