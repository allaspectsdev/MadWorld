import { TICK_MS, Op, type ServerMessage, encodeTick } from "@madworld/shared";
import { world } from "./World.js";
import { partyManager } from "./PartyManager.js";
import { processMovement } from "./systems/MovementSystem.js";
import { processAI } from "./systems/AISystem.js";
import { processBossAI } from "./systems/BossAISystem.js";
import { processCombat } from "./systems/CombatSystem.js";
import { processAbilities } from "./systems/AbilitySystem.js";
import { instanceManager } from "./InstanceManager.js";
import { GroundItem } from "./entities/GroundItem.js";
import { resetAllRateLimits } from "../net/MessageHandler.js";
import { weatherManager } from "./WeatherManager.js";
import { petManager } from "./PetManager.js";
import { processGatheringTick } from "../net/handlers/gathering.js";
import type { Zone } from "./Zone.js";

let currentTick = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Injected at startup to break the circular dep chain. */
let persistFn: ((player: import("./entities/Player.js").Player) => Promise<void>) | null = null;

/** Call from index.ts before startGameLoop() to wire in PlayerService.savePlayer. */
export function setPlayerPersist(fn: typeof persistFn): void {
  persistFn = fn;
}

function tick(): void {
  try {
    currentTick++;

    // 0. Reset per-connection message rate limits
    resetAllRateLimits();

    // 1. Process player movement intents
    processMovement();

    // 2. Run mob AI (world + instance zones)
    processAI();

    // 3. Run boss AI (instance zones)
    processBossAI();

    // 3b. Process instance tick (pending wipe ejections)
    instanceManager.processTick();

    // 4. Resolve combat (world + instance zones, shared XP)
    processCombat();

    // 5. Process ability cooldowns, status effects, fishing timers, and gathering
    processAbilities();
    processFishing(currentTick);
    processGathering(currentTick);

    // 5b. Pet follow + bond XP
    petManager.updatePetPositions();
    petManager.processTickBondXp();

    // 5c. Weather tick (transitions, damage, region re-rolls)
    weatherManager.processTick();

    // 6. Despawn expired ground items
    processGroundItemDespawn();

    // 7. Sync party member HP cross-zone
    for (const [, player] of world.playersByEid) {
      partyManager.syncPartyMemberHp(player);
    }

    // 8. Send tick sync to all players (binary — 13 bytes vs ~60 bytes JSON)
    const tickBuf = encodeTick(currentTick, Date.now());
    for (const [, player] of world.playersByEid) {
      player.send(tickBuf);
    }

    // 9. Persist dirty players every 30 seconds (300 ticks)
    if (currentTick % 300 === 0) {
      persistDirtyPlayers();
    }

    // 10. Cleanup idle dungeon instances every ~60s
    if (currentTick % 600 === 0) {
      instanceManager.cleanupIdleInstances();
    }
  } catch (err) {
    console.error('[GameLoop] Tick error:', err);
  }
}

function* allZones(): Iterable<Zone> {
  yield* world.zones.values();
  yield* world.instances.values();
}

function processFishing(tick: number): void {
  for (const [, player] of world.playersByEid) {
    if (!player.fishingState) continue;

    const state = player.fishingState;
    const elapsed = tick - state.startTick;

    // Send bite notification at ~70% of catch time
    const biteAt = Math.floor(state.catchTick * 0.7);
    if (!state.biteSent && elapsed >= biteAt) {
      state.biteSent = true;
      player.send({
        op: Op.S_FISH_BITE,
        d: { spotId: state.fish },
      } satisfies ServerMessage);
    }

    // Auto-fail if player doesn't reel in within catch window + grace period
    if (elapsed > state.catchTick + 20) {
      player.send({
        op: Op.S_FISH_RESULT,
        d: { success: false },
      } satisfies ServerMessage);
      player.fishingState = null;
    }
  }
}

function processGathering(tick: number): void {
  for (const [, player] of world.playersByEid) {
    if (!player.gatheringState) continue;
    // Cancel gathering if player moved
    if (player.moveQueue.length > 0 || player.dx !== 0 || player.dy !== 0) {
      player.gatheringState = null;
      player.send({
        op: Op.S_SYSTEM_MESSAGE,
        d: { message: "Gathering interrupted." },
      } satisfies ServerMessage);
      continue;
    }
    processGatheringTick(player, tick);
  }
}

function processGroundItemDespawn(): void {
  for (const zone of allZones()) {
    for (const [eid, entity] of zone.entities) {
      if (!(entity instanceof GroundItem)) continue;
      entity.despawnTimer--;
      if (entity.despawnTimer <= 0) {
        zone.removeEntity(eid);
      }
    }
  }
}

async function persistDirtyPlayers(): Promise<void> {
  if (!persistFn) return;
  for (const [, player] of world.playersByEid) {
    if (!player.dirty) continue;
    player.dirty = false;
    await persistFn(player).catch((err) =>
      console.error(`[Persist] Failed to save player ${player.name}:`, err),
    );
  }
}

export function startGameLoop(): void {
  if (intervalId) return;
  intervalId = setInterval(tick, TICK_MS);
  console.log(`[GameLoop] Started at ${1000 / TICK_MS} ticks/sec`);
}

export function stopGameLoop(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[GameLoop] Stopped");
  }
}

export function getCurrentTick(): number {
  return currentTick;
}
