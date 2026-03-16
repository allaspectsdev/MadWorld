import { TICK_MS, Op, type ServerMessage } from "@madworld/shared";
import { world } from "./World.js";
import { partyManager } from "./PartyManager.js";
import { processMovement } from "./systems/MovementSystem.js";
import { processAI } from "./systems/AISystem.js";
import { processBossAI } from "./systems/BossAISystem.js";
import { processCombat } from "./systems/CombatSystem.js";
import { processAbilities } from "./systems/AbilitySystem.js";
import { instanceManager } from "./InstanceManager.js";
import { GroundItem } from "./entities/GroundItem.js";
import type { Zone } from "./Zone.js";

let currentTick = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  currentTick++;

  // 1. Process player movement intents
  processMovement();

  // 2. Run mob AI (world + instance zones)
  processAI();

  // 3. Run boss AI (instance zones)
  processBossAI();

  // 4. Resolve combat (world + instance zones, shared XP)
  processCombat();

  // 5. Process ability cooldowns, status effects, and fishing timers
  processAbilities();
  processFishing(currentTick);

  // 6. Despawn expired ground items
  processGroundItemDespawn();

  // 7. Sync party member HP cross-zone
  for (const [, player] of world.playersByEid) {
    partyManager.syncPartyMemberHp(player);
  }

  // 8. Send tick sync to all players
  const tickMsg: ServerMessage = {
    op: Op.S_TICK,
    d: { tick: currentTick, serverTime: Date.now() },
  };
  for (const [, player] of world.playersByEid) {
    player.send(tickMsg);
  }

  // 9. Persist dirty players every 30 seconds (300 ticks)
  if (currentTick % 300 === 0) {
    persistDirtyPlayers();
  }

  // 10. Cleanup idle dungeon instances every ~60s
  if (currentTick % 600 === 0) {
    instanceManager.cleanupIdleInstances();
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
  for (const [, player] of world.playersByEid) {
    if (!player.dirty) continue;
    player.dirty = false;
    // Persistence handled by PlayerService — imported dynamically to avoid circular deps
    const { savePlayer } = await import("../services/PlayerService.js");
    await savePlayer(player).catch((err) =>
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
