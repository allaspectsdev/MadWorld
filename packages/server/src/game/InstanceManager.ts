import { Op, MOBS, type ServerMessage, type ZoneDef, TileType } from "@madworld/shared";
import { Zone } from "./Zone.js";
import { Mob } from "./entities/Mob.js";
import { Player } from "./entities/Player.js";
import { world } from "./World.js";
import { DUNGEON_DEFS, buildDungeonZone } from "./data/dungeons/index.js";

interface DungeonInstance {
  instanceId: string;
  dungeonId: string;
  partyId: string;
  zone: Zone;
  createdAt: number;
  lastActivityAt: number;
  isComplete: boolean;
  idleTimeoutId: ReturnType<typeof setTimeout> | null;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let instanceCounter = 0;

function generateInstanceId(): string {
  return `inst_${++instanceCounter}_${Date.now().toString(36)}`;
}

class InstanceManager {
  private instances = new Map<string, DungeonInstance>();
  private partyInstances = new Map<string, string>();

  createInstance(partyId: string, dungeonId: string): DungeonInstance {
    const dungeonDef = DUNGEON_DEFS.find((d) => d.id === dungeonId);
    if (!dungeonDef) throw new Error(`Unknown dungeon: ${dungeonId}`);

    const instanceId = generateInstanceId();
    const zoneDef = buildDungeonZone(dungeonId);
    const zone = new Zone(zoneDef, instanceId, partyId);

    // Spawn mobs in the instance
    for (const spawn of zoneDef.mobSpawns) {
      const mobDef = MOBS[spawn.mobId];
      if (!mobDef) continue;
      for (let i = 0; i < spawn.count; i++) {
        const offsetX = (Math.random() - 0.5) * spawn.wanderRadius * 2;
        const offsetY = (Math.random() - 0.5) * spawn.wanderRadius * 2;
        const mob = new Mob(
          mobDef,
          zone.id,
          spawn.x + offsetX,
          spawn.y + offsetY,
          spawn.wanderRadius,
        );
        zone.addEntity(mob);
      }
    }

    world.addInstance(zone);

    const instance: DungeonInstance = {
      instanceId,
      dungeonId,
      partyId,
      zone,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      isComplete: false,
      idleTimeoutId: null,
    };

    this.instances.set(instanceId, instance);
    this.partyInstances.set(partyId, instanceId);

    console.log(`[Instance] Created ${dungeonDef.name} (${instanceId}) for party ${partyId}`);
    return instance;
  }

  enterInstance(player: Player, instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    // Save return position
    player.returnZoneId = player.zoneId;
    player.returnX = player.x;
    player.returnY = player.y;

    // Remove from current zone
    const currentZone = world.getZone(player.zoneId);
    if (currentZone) {
      currentZone.removeEntity(player.eid);
    }

    // Move to instance
    player.zoneId = instance.zone.id;
    player.x = instance.zone.def.spawnX;
    player.y = instance.zone.def.spawnY;

    instance.zone.addEntity(player);
    instance.zone.sendZoneData(player);
    instance.lastActivityAt = Date.now();

    // Clear idle timeout
    if (instance.idleTimeoutId) {
      clearTimeout(instance.idleTimeoutId);
      instance.idleTimeoutId = null;
    }

    const dungeonDef = DUNGEON_DEFS.find((d) => d.id === instance.dungeonId);
    player.send({
      op: Op.S_DUNGEON_ENTER,
      d: {
        dungeonId: instance.dungeonId,
        dungeonName: dungeonDef?.name ?? instance.dungeonId,
        instanceId,
      },
    } satisfies ServerMessage);
  }

  exitInstance(player: Player): void {
    if (!player.returnZoneId) return;

    const instanceZone = world.getZone(player.zoneId);
    if (instanceZone) {
      instanceZone.removeEntity(player.eid);
    }

    // Restore to overworld
    player.zoneId = player.returnZoneId;
    player.x = player.returnX;
    player.y = player.returnY;
    player.returnZoneId = null;

    const returnZone = world.getZone(player.zoneId);
    if (returnZone) {
      returnZone.addEntity(player);
      returnZone.sendZoneData(player);
    }

    player.send({
      op: Op.S_DUNGEON_EXIT,
      d: { returnZoneId: player.zoneId, returnX: player.x, returnY: player.y },
    } satisfies ServerMessage);

    // Check if instance is now empty
    if (instanceZone?.instanceId) {
      const instance = this.instances.get(instanceZone.instanceId);
      if (instance && instanceZone.players.size === 0) {
        this.startIdleTimeout(instance);
      }
    }
  }

  handleBossKill(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.isComplete) return;

    instance.isComplete = true;
    instance.zone.isComplete = true;

    // Spawn exit portal at spawn point
    const def = instance.zone.def;
    if (def.portals.length === 0) {
      const dungeonDef = DUNGEON_DEFS.find((d) => d.id === instance.dungeonId);
      if (dungeonDef) {
        def.portals.push({
          x: def.spawnX,
          y: def.spawnY,
          targetZoneId: dungeonDef.exitReturnZoneId,
          targetX: dungeonDef.exitReturnX,
          targetY: dungeonDef.exitReturnY,
        });
        // Mark spawn tile as portal
        if (def.tiles[def.spawnY] && def.tiles[def.spawnY][def.spawnX] !== undefined) {
          def.tiles[def.spawnY][def.spawnX] = TileType.PORTAL;
        }
      }
    }

    // Notify all players in the instance
    for (const [, player] of instance.zone.players) {
      player.send({
        op: Op.S_DUNGEON_COMPLETE,
        d: { dungeonId: instance.dungeonId, instanceId },
      } satisfies ServerMessage);
      player.send({
        op: Op.S_SYSTEM_MESSAGE,
        d: { message: "The dungeon is complete! An exit portal has appeared." },
      } satisfies ServerMessage);
    }

    console.log(`[Instance] Dungeon ${instance.dungeonId} (${instanceId}) completed`);
  }

  handleWipe(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    // Notify
    for (const [, player] of instance.zone.players) {
      player.send({
        op: Op.S_DUNGEON_WIPE,
        d: { instanceId },
      } satisfies ServerMessage);
    }

    // After 3 seconds, eject all players and reset mobs
    setTimeout(() => {
      const playersToEject = [...instance.zone.players.values()];
      for (const player of playersToEject) {
        player.hp = player.maxHp;
        player.combatTarget = null;
        this.exitInstance(player);
      }
      instance.zone.resetInstance();
      console.log(`[Instance] Wipe in ${instance.dungeonId} (${instanceId}), mobs reset`);
    }, 3000);
  }

  destroyInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    if (instance.idleTimeoutId) {
      clearTimeout(instance.idleTimeoutId);
    }

    // Eject any remaining players
    for (const [, player] of instance.zone.players) {
      this.exitInstance(player);
    }

    world.removeInstance(instance.zone.id);
    this.partyInstances.delete(instance.partyId);
    this.instances.delete(instanceId);

    console.log(`[Instance] Destroyed ${instance.dungeonId} (${instanceId})`);
  }

  cleanupIdleInstances(): void {
    const now = Date.now();
    for (const [instanceId, instance] of this.instances) {
      if (instance.zone.players.size === 0 && now - instance.lastActivityAt > IDLE_TIMEOUT_MS) {
        this.destroyInstance(instanceId);
      }
    }
  }

  getInstanceForParty(partyId: string): DungeonInstance | undefined {
    const instanceId = this.partyInstances.get(partyId);
    if (!instanceId) return undefined;
    return this.instances.get(instanceId);
  }

  isPlayerInDungeon(player: Player): boolean {
    return player.zoneId.startsWith("dungeon:");
  }

  private startIdleTimeout(instance: DungeonInstance): void {
    if (instance.idleTimeoutId) clearTimeout(instance.idleTimeoutId);
    instance.idleTimeoutId = setTimeout(() => {
      this.destroyInstance(instance.instanceId);
    }, IDLE_TIMEOUT_MS);
  }
}

export const instanceManager = new InstanceManager();
