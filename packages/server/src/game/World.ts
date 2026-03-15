import { Zone } from "./Zone.js";
import { Player } from "./entities/Player.js";
import { Mob } from "./entities/Mob.js";
import { MOBS, type ZoneDef } from "@madworld/shared";
import { ZONE_DEFS } from "./data/zones/index.js";

export class World {
  readonly zones = new Map<string, Zone>();
  readonly instances = new Map<string, Zone>();
  readonly playersByEid = new Map<number, Player>();
  readonly playersByUserId = new Map<number, Player>();

  init(): void {
    for (const def of ZONE_DEFS) {
      const zone = new Zone(def);
      this.zones.set(def.id, zone);

      // Spawn mobs
      for (const spawn of def.mobSpawns) {
        const mobDef = MOBS[spawn.mobId];
        if (!mobDef) continue;
        for (let i = 0; i < spawn.count; i++) {
          const offsetX = (Math.random() - 0.5) * spawn.wanderRadius * 2;
          const offsetY = (Math.random() - 0.5) * spawn.wanderRadius * 2;
          const mob = new Mob(
            mobDef,
            def.id,
            spawn.x + offsetX,
            spawn.y + offsetY,
            spawn.wanderRadius,
          );
          zone.addEntity(mob);
        }
      }
    }
    console.log(`[World] Initialized ${this.zones.size} zones`);
  }

  getZone(id: string): Zone | undefined {
    return this.zones.get(id) ?? this.instances.get(id);
  }

  addInstance(zone: Zone): void {
    this.instances.set(zone.id, zone);
  }

  removeInstance(id: string): void {
    this.instances.delete(id);
  }

  addPlayer(player: Player): void {
    this.playersByEid.set(player.eid, player);
    this.playersByUserId.set(player.userId, player);

    const zone = this.getZone(player.zoneId);
    if (zone) {
      zone.addEntity(player);
      zone.sendZoneData(player);
    }
  }

  removePlayer(player: Player): void {
    const zone = this.getZone(player.zoneId);
    if (zone) {
      zone.removeEntity(player.eid);
    }
    this.playersByEid.delete(player.eid);
    this.playersByUserId.delete(player.userId);
  }

  getPlayer(eid: number): Player | undefined {
    return this.playersByEid.get(eid);
  }

  getPlayerByUserId(userId: number): Player | undefined {
    return this.playersByUserId.get(userId);
  }
}

export const world = new World();
