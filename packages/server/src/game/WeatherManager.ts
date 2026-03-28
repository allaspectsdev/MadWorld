/**
 * WeatherManager — per-region weather state derived from biome + noise cycle.
 *
 * Weather regions are 4x4 chunks (128x128 tiles). Each region has an
 * independent weather state that transitions on a slow cycle.
 *
 * Every WEATHER_REROLL_INTERVAL ticks, each region re-rolls its weather
 * based on the biome weights. The result is sent to all players in that
 * region via S_WEATHER_UPDATE.
 *
 * Gameplay effects are applied in the game loop:
 *   - speedMultiplier affects player movement
 *   - fishingMultiplier affects catch rates
 *   - damagePerTick hurts exposed players
 */

import {
  WeatherType,
  WEATHER_DEFS,
  BIOME_WEATHER,
  WEATHER_MIN_DURATION,
  WEATHER_MAX_DURATION,
  WEATHER_REROLL_INTERVAL,
  WORLD_CHUNK_SIZE,
  Op,
  type ServerMessage,
} from "@madworld/shared";
import { world } from "./World.js";

/** Weather region = 4x4 chunks. */
const REGION_SIZE = 4;

interface WeatherState {
  type: WeatherType;
  intensity: number;    // 0..1
  remainingTicks: number;
  totalTicks: number;
}

function regionKey(rx: number, ry: number): string {
  return `${rx},${ry}`;
}

class WeatherManager {
  private regions = new Map<string, WeatherState>();
  private tickCounter = 0;

  /**
   * Called every game tick. Processes weather transitions and applies effects.
   */
  processTick(): void {
    this.tickCounter++;

    // Re-roll weather regions periodically
    if (this.tickCounter % WEATHER_REROLL_INTERVAL === 0) {
      this.rerollAllRegions();
    }

    // Tick down durations and apply effects
    for (const [key, state] of this.regions) {
      state.remainingTicks--;

      // Update intensity (ramps up then fades)
      const progress = 1 - state.remainingTicks / state.totalTicks;
      if (progress < 0.15) {
        state.intensity = progress / 0.15; // Ramp up
      } else if (progress > 0.85) {
        state.intensity = (1 - progress) / 0.15; // Fade out
      } else {
        state.intensity = 1;
      }

      // Expire
      if (state.remainingTicks <= 0) {
        this.regions.delete(key);
      }
    }

    // Apply weather damage to players (every 10 ticks = 1 second)
    if (this.tickCounter % 10 === 0) {
      this.applyWeatherDamage();
    }
  }

  /**
   * Get the weather state for a world position.
   */
  getWeatherAt(worldX: number, worldY: number): WeatherState {
    const rx = Math.floor(worldX / (WORLD_CHUNK_SIZE * REGION_SIZE));
    const ry = Math.floor(worldY / (WORLD_CHUNK_SIZE * REGION_SIZE));
    return this.regions.get(regionKey(rx, ry)) ?? {
      type: WeatherType.CLEAR,
      intensity: 0,
      remainingTicks: 0,
      totalTicks: 1,
    };
  }

  /**
   * Get the speed multiplier for a player based on their weather.
   */
  getSpeedMultiplier(worldX: number, worldY: number): number {
    const weather = this.getWeatherAt(worldX, worldY);
    if (weather.type === WeatherType.CLEAR || weather.intensity < 0.1) return 1;
    const def = WEATHER_DEFS[weather.type];
    // Lerp between 1.0 and the weather's multiplier based on intensity
    return 1 + (def.speedMultiplier - 1) * weather.intensity;
  }

  /**
   * Get the fishing multiplier for a player based on their weather.
   */
  getFishingMultiplier(worldX: number, worldY: number): number {
    const weather = this.getWeatherAt(worldX, worldY);
    if (weather.type === WeatherType.CLEAR || weather.intensity < 0.1) return 1;
    const def = WEATHER_DEFS[weather.type];
    return 1 + (def.fishingMultiplier - 1) * weather.intensity;
  }

  /**
   * Send current weather to a player (on login or zone change).
   */
  sendWeatherToPlayer(player: { x: number; y: number; send: (msg: any) => void }): void {
    const weather = this.getWeatherAt(player.x, player.y);
    const def = WEATHER_DEFS[weather.type];
    player.send({
      op: Op.S_WEATHER_UPDATE,
      d: {
        weather: weather.type,
        intensity: Math.round(weather.intensity * 100) / 100,
        durationTicks: weather.remainingTicks,
        ambientTint: def.ambientTint,
      },
    } satisfies ServerMessage);
  }

  // ---- Internal ----

  private rerollAllRegions(): void {
    // Collect all unique regions that have players
    const activeRegions = new Set<string>();
    const regionBiomes = new Map<string, string>();

    for (const [, player] of world.playersByEid) {
      const rx = Math.floor(player.x / (WORLD_CHUNK_SIZE * REGION_SIZE));
      const ry = Math.floor(player.y / (WORLD_CHUNK_SIZE * REGION_SIZE));
      const key = regionKey(rx, ry);
      activeRegions.add(key);

      // We don't have direct biome access here, so use a simple latitude-based
      // heuristic. In a full integration, ChunkManager would provide this.
      if (!regionBiomes.has(key)) {
        regionBiomes.set(key, this.estimateBiome(player.x, player.y));
      }
    }

    for (const key of activeRegions) {
      // Don't re-roll if current weather still has time
      const existing = this.regions.get(key);
      if (existing && existing.remainingTicks > 0) continue;

      const biome = regionBiomes.get(key) ?? "plains";
      const weather = this.rollWeather(biome);
      if (weather) {
        this.regions.set(key, weather);
        this.broadcastWeatherForRegion(key, weather);
      }
    }
  }

  private rollWeather(biome: string): WeatherState | null {
    const options = BIOME_WEATHER[biome];
    if (!options || options.length === 0) return null;

    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let roll = Math.random() * totalWeight;
    let type = WeatherType.CLEAR;

    for (const opt of options) {
      roll -= opt.weight;
      if (roll <= 0) {
        type = opt.type;
        break;
      }
    }

    // Clear weather doesn't need a state entry
    if (type === WeatherType.CLEAR) return null;

    const duration = WEATHER_MIN_DURATION +
      Math.floor(Math.random() * (WEATHER_MAX_DURATION - WEATHER_MIN_DURATION));

    return {
      type,
      intensity: 0,
      remainingTicks: duration,
      totalTicks: duration,
    };
  }

  /** Simple biome estimation from world position. */
  private estimateBiome(x: number, y: number): string {
    // Use y-coordinate as a rough latitude proxy
    const normalizedY = (y % 1000) / 1000;
    if (normalizedY < 0.1) return "snow_peaks";
    if (normalizedY < 0.25) return "tundra";
    if (normalizedY < 0.4) return "forest";
    if (normalizedY < 0.6) return "plains";
    if (normalizedY < 0.75) return "savanna";
    if (normalizedY < 0.9) return "desert";
    return "jungle";
  }

  private broadcastWeatherForRegion(key: string, state: WeatherState): void {
    const [rxStr, ryStr] = key.split(",");
    const rx = parseInt(rxStr);
    const ry = parseInt(ryStr);
    const def = WEATHER_DEFS[state.type];

    const msg: ServerMessage = {
      op: Op.S_WEATHER_UPDATE,
      d: {
        weather: state.type,
        intensity: Math.round(state.intensity * 100) / 100,
        durationTicks: state.remainingTicks,
        ambientTint: def.ambientTint,
      },
    };

    // Send to all players in this region
    const regionMinX = rx * WORLD_CHUNK_SIZE * REGION_SIZE;
    const regionMaxX = regionMinX + WORLD_CHUNK_SIZE * REGION_SIZE;
    const regionMinY = ry * WORLD_CHUNK_SIZE * REGION_SIZE;
    const regionMaxY = regionMinY + WORLD_CHUNK_SIZE * REGION_SIZE;

    for (const [, player] of world.playersByEid) {
      if (player.x >= regionMinX && player.x < regionMaxX &&
          player.y >= regionMinY && player.y < regionMaxY) {
        player.send(msg);
      }
    }
  }

  private applyWeatherDamage(): void {
    for (const [, player] of world.playersByEid) {
      if (player.hp <= 0) continue;
      const weather = this.getWeatherAt(player.x, player.y);
      if (weather.type === WeatherType.CLEAR) continue;

      const def = WEATHER_DEFS[weather.type];
      if (def.damagePerTick <= 0) continue;

      const damage = Math.ceil(def.damagePerTick * weather.intensity);
      if (damage <= 0) continue;

      // Don't kill players with weather, leave at 1 HP
      player.hp = Math.max(1, player.hp - damage);
      player.dirty = true;
    }
  }
}

export const weatherManager = new WeatherManager();
