/**
 * DiscoverySystem — processes fog-of-war reveals each tick.
 *
 * Each tick, for every player:
 *   1. Determine which chunks the player can "see" (based on position + reveal radius)
 *   2. Mark any new chunks as discovered
 *   3. If party members are nearby, share discoveries
 *   4. Award discovery XP for new chunks
 *   5. Send S_DISCOVERY_UPDATE to the player
 *   6. Send S_CHUNK_DATA for newly-revealed chunks
 */

import {
  WORLD_CHUNK_SIZE,
  Op,
  type Biome,
} from "@madworld/shared";
import type { ChunkManager } from "../ChunkManager.js";
import { petManager } from "../PetManager.js";

interface DiscoveryPlayer {
  playerId: number;
  eid: number;
  x: number;
  y: number;
  send: (msg: any) => void;
  partyId?: string | null;
}

/** Base reveal radius in chunks around the player. */
const BASE_REVEAL_RADIUS = 1;

/** XP awarded per newly discovered chunk. */
const DISCOVERY_XP_PER_CHUNK = 15;

/** Bonus XP for discovering a chunk with a new biome type. */
const NEW_BIOME_BONUS_XP = 50;

/** Biomes a player has discovered (playerId → Set<Biome>). */
const playerBiomes = new Map<number, Set<string>>();

/**
 * Process discovery for a single player.
 * Call this each tick (or every N ticks for performance).
 */
export async function processDiscovery(
  player: DiscoveryPlayer,
  chunkManager: ChunkManager,
): Promise<void> {
  const cx = Math.floor(player.x / WORLD_CHUNK_SIZE);
  const cy = Math.floor(player.y / WORLD_CHUNK_SIZE);

  // Reveal radius: base + fox pet discovery_radius ability
  const petBonus = petManager.getAbilityValue(player.eid, "discovery_radius");
  const revealRadius = BASE_REVEAL_RADIUS + Math.floor(petBonus);

  // Collect chunks in reveal range
  const chunksToCheck: Array<{ cx: number; cy: number }> = [];
  for (let dx = -revealRadius; dx <= revealRadius; dx++) {
    for (let dy = -revealRadius; dy <= revealRadius; dy++) {
      chunksToCheck.push({ cx: cx + dx, cy: cy + dy });
    }
  }

  // Discover new chunks
  const newKeys = await chunkManager.discoverChunks(player.playerId, chunksToCheck);

  if (newKeys.length === 0) return;

  // Calculate XP
  let totalXp = newKeys.length * DISCOVERY_XP_PER_CHUNK;

  // Check for new biome discoveries
  let biomeSet = playerBiomes.get(player.playerId);
  if (!biomeSet) {
    biomeSet = new Set();
    playerBiomes.set(player.playerId, biomeSet);
  }

  for (const key of newKeys) {
    const [cxStr, cyStr] = key.split(",");
    const chunk = await chunkManager.getChunk(parseInt(cxStr), parseInt(cyStr));
    if (chunk && !biomeSet.has(chunk.biome)) {
      biomeSet.add(chunk.biome);
      totalXp += NEW_BIOME_BONUS_XP;
    }
  }

  // Send discovery update to player
  player.send({
    op: Op.S_DISCOVERY_UPDATE,
    d: {
      chunks: newKeys,
      xp: totalXp > 0 ? totalXp : undefined,
    },
  });

  // Send chunk data for newly discovered chunks
  for (const key of newKeys) {
    const [cxStr, cyStr] = key.split(",");
    const chunk = await chunkManager.getChunk(parseInt(cxStr), parseInt(cyStr));
    if (chunk) {
      player.send({
        op: Op.S_CHUNK_DATA,
        d: {
          chunkX: chunk.chunkX,
          chunkY: chunk.chunkY,
          biome: chunk.biome,
          tiles: chunk.tiles,
          lights: chunk.lights.length > 0 ? chunk.lights : undefined,
        },
      });
    }
  }

  // Award XP (exploration/agility)
  if (totalXp > 0) {
    player.send({
      op: Op.S_XP_GAIN,
      d: { skillId: "agility", xp: totalXp, totalXp: 0 },
    });
  }
}

/**
 * Send initial discovery state when a player connects.
 */
export function sendInitialDiscoveries(
  player: DiscoveryPlayer,
  chunkManager: ChunkManager,
): void {
  const discoveries = chunkManager.getDiscoveries(player.playerId);
  player.send({
    op: Op.S_DISCOVERY_INIT,
    d: {
      chunks: Array.from(discoveries),
    },
  });
}

/**
 * Share party discoveries: when a party member discovers a chunk,
 * reveal it for all party members.
 */
export async function sharePartyDiscovery(
  discovererPlayerId: number,
  newChunkKeys: string[],
  partyMembers: DiscoveryPlayer[],
  chunkManager: ChunkManager,
): Promise<void> {
  for (const member of partyMembers) {
    if (member.playerId === discovererPlayerId) continue;

    const chunks = newChunkKeys.map((key) => {
      const [cx, cy] = key.split(",").map(Number);
      return { cx, cy };
    });

    const memberNewKeys = await chunkManager.discoverChunks(member.playerId, chunks);

    if (memberNewKeys.length > 0) {
      member.send({
        op: Op.S_DISCOVERY_UPDATE,
        d: { chunks: memberNewKeys },
      });

      // Also send chunk data for shared discoveries
      for (const key of memberNewKeys) {
        const [cxStr, cyStr] = key.split(",");
        const chunk = await chunkManager.getChunk(parseInt(cxStr), parseInt(cyStr));
        if (chunk) {
          member.send({
            op: Op.S_CHUNK_DATA,
            d: {
              chunkX: chunk.chunkX,
              chunkY: chunk.chunkY,
              biome: chunk.biome,
              tiles: chunk.tiles,
              lights: chunk.lights.length > 0 ? chunk.lights : undefined,
            },
          });
        }
      }
    }
  }
}

/**
 * Clean up player biome tracking on disconnect.
 */
export function cleanupPlayerDiscovery(playerId: number): void {
  playerBiomes.delete(playerId);
}
