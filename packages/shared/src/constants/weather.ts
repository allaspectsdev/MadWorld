/**
 * Weather system definitions.
 *
 * Weather is per-chunk, derived from biome + a slow noise cycle.
 * Each weather type has visual effects (particles, lighting tint)
 * and gameplay modifiers (fishing bonus, movement penalty, etc.).
 */

import { Biome } from "../biome.js";

export enum WeatherType {
  CLEAR = "clear",
  RAIN = "rain",
  HEAVY_RAIN = "heavy_rain",
  SNOW = "snow",
  BLIZZARD = "blizzard",
  SANDSTORM = "sandstorm",
  FOG = "fog",
  THUNDERSTORM = "thunderstorm",
}

export interface WeatherDef {
  type: WeatherType;
  /** Ambient light color tint (multiplied with existing lighting). */
  ambientTint: number;
  /** Ambient light intensity multiplier (1.0 = no change). */
  ambientIntensity: number;
  /** Particle effect ID for the client renderer. */
  particleEffect: string;
  /** Movement speed multiplier (1.0 = no change). */
  speedMultiplier: number;
  /** Fishing catch rate multiplier. */
  fishingMultiplier: number;
  /** Damage per tick to players in this weather (0 = none). */
  damagePerTick: number;
  /** Visibility range multiplier (affects fog-of-war reveal). */
  visibilityMultiplier: number;
}

export const WEATHER_DEFS: Record<WeatherType, WeatherDef> = {
  [WeatherType.CLEAR]: {
    type: WeatherType.CLEAR,
    ambientTint: 0xffffff,
    ambientIntensity: 1.0,
    particleEffect: "none",
    speedMultiplier: 1.0,
    fishingMultiplier: 1.0,
    damagePerTick: 0,
    visibilityMultiplier: 1.0,
  },
  [WeatherType.RAIN]: {
    type: WeatherType.RAIN,
    ambientTint: 0xaabbcc,
    ambientIntensity: 0.8,
    particleEffect: "rain",
    speedMultiplier: 0.95,
    fishingMultiplier: 1.3,
    damagePerTick: 0,
    visibilityMultiplier: 0.9,
  },
  [WeatherType.HEAVY_RAIN]: {
    type: WeatherType.HEAVY_RAIN,
    ambientTint: 0x8899aa,
    ambientIntensity: 0.65,
    particleEffect: "heavy_rain",
    speedMultiplier: 0.85,
    fishingMultiplier: 1.5,
    damagePerTick: 0,
    visibilityMultiplier: 0.7,
  },
  [WeatherType.SNOW]: {
    type: WeatherType.SNOW,
    ambientTint: 0xccddee,
    ambientIntensity: 0.85,
    particleEffect: "snow",
    speedMultiplier: 0.9,
    fishingMultiplier: 0.8,
    damagePerTick: 0,
    visibilityMultiplier: 0.85,
  },
  [WeatherType.BLIZZARD]: {
    type: WeatherType.BLIZZARD,
    ambientTint: 0x99aacc,
    ambientIntensity: 0.5,
    particleEffect: "blizzard",
    speedMultiplier: 0.7,
    fishingMultiplier: 0.3,
    damagePerTick: 1,
    visibilityMultiplier: 0.4,
  },
  [WeatherType.SANDSTORM]: {
    type: WeatherType.SANDSTORM,
    ambientTint: 0xccaa77,
    ambientIntensity: 0.6,
    particleEffect: "sandstorm",
    speedMultiplier: 0.75,
    fishingMultiplier: 0,
    damagePerTick: 2,
    visibilityMultiplier: 0.3,
  },
  [WeatherType.FOG]: {
    type: WeatherType.FOG,
    ambientTint: 0xbbbbcc,
    ambientIntensity: 0.7,
    particleEffect: "fog",
    speedMultiplier: 1.0,
    fishingMultiplier: 1.1,
    damagePerTick: 0,
    visibilityMultiplier: 0.5,
  },
  [WeatherType.THUNDERSTORM]: {
    type: WeatherType.THUNDERSTORM,
    ambientTint: 0x7788aa,
    ambientIntensity: 0.55,
    particleEffect: "thunderstorm",
    speedMultiplier: 0.8,
    fishingMultiplier: 1.8,
    damagePerTick: 0,
    visibilityMultiplier: 0.6,
  },
};

/** Which weather types can occur in each biome, with relative weights. */
export const BIOME_WEATHER: Record<string, { type: WeatherType; weight: number }[]> = {
  [Biome.OCEAN]:        [{ type: WeatherType.CLEAR, weight: 4 }, { type: WeatherType.RAIN, weight: 3 }, { type: WeatherType.HEAVY_RAIN, weight: 1 }, { type: WeatherType.THUNDERSTORM, weight: 1 }, { type: WeatherType.FOG, weight: 2 }],
  [Biome.COAST]:        [{ type: WeatherType.CLEAR, weight: 5 }, { type: WeatherType.RAIN, weight: 2 }, { type: WeatherType.FOG, weight: 2 }, { type: WeatherType.THUNDERSTORM, weight: 1 }],
  [Biome.PLAINS]:       [{ type: WeatherType.CLEAR, weight: 6 }, { type: WeatherType.RAIN, weight: 2 }, { type: WeatherType.THUNDERSTORM, weight: 1 }, { type: WeatherType.FOG, weight: 1 }],
  [Biome.FOREST]:       [{ type: WeatherType.CLEAR, weight: 4 }, { type: WeatherType.RAIN, weight: 3 }, { type: WeatherType.HEAVY_RAIN, weight: 1 }, { type: WeatherType.FOG, weight: 2 }],
  [Biome.DENSE_FOREST]: [{ type: WeatherType.CLEAR, weight: 3 }, { type: WeatherType.RAIN, weight: 3 }, { type: WeatherType.HEAVY_RAIN, weight: 2 }, { type: WeatherType.FOG, weight: 3 }],
  [Biome.SWAMP]:        [{ type: WeatherType.CLEAR, weight: 2 }, { type: WeatherType.RAIN, weight: 3 }, { type: WeatherType.HEAVY_RAIN, weight: 2 }, { type: WeatherType.FOG, weight: 4 }],
  [Biome.DESERT]:       [{ type: WeatherType.CLEAR, weight: 7 }, { type: WeatherType.SANDSTORM, weight: 3 }],
  [Biome.MOUNTAINS]:    [{ type: WeatherType.CLEAR, weight: 4 }, { type: WeatherType.SNOW, weight: 3 }, { type: WeatherType.FOG, weight: 2 }, { type: WeatherType.RAIN, weight: 1 }],
  [Biome.SNOW_PEAKS]:   [{ type: WeatherType.CLEAR, weight: 2 }, { type: WeatherType.SNOW, weight: 4 }, { type: WeatherType.BLIZZARD, weight: 3 }, { type: WeatherType.FOG, weight: 1 }],
  [Biome.TUNDRA]:       [{ type: WeatherType.CLEAR, weight: 3 }, { type: WeatherType.SNOW, weight: 4 }, { type: WeatherType.BLIZZARD, weight: 2 }, { type: WeatherType.FOG, weight: 1 }],
  [Biome.JUNGLE]:       [{ type: WeatherType.CLEAR, weight: 2 }, { type: WeatherType.RAIN, weight: 3 }, { type: WeatherType.HEAVY_RAIN, weight: 3 }, { type: WeatherType.THUNDERSTORM, weight: 2 }],
  [Biome.SAVANNA]:      [{ type: WeatherType.CLEAR, weight: 7 }, { type: WeatherType.RAIN, weight: 2 }, { type: WeatherType.THUNDERSTORM, weight: 1 }],
};

/** Duration range for weather events (in ticks at 10/sec). */
export const WEATHER_MIN_DURATION = 600;   // 1 minute
export const WEATHER_MAX_DURATION = 6000;  // 10 minutes

/** Ticks between weather re-rolls per chunk region. */
export const WEATHER_REROLL_INTERVAL = 3000; // 5 minutes
