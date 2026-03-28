import { TileType, WALKABLE_TILES, type ZoneDef } from "../types/map.js";

export function tileAt(zone: ZoneDef, x: number, y: number): TileType | null {
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  if (tileX < 0 || tileX >= zone.width || tileY < 0 || tileY >= zone.height) {
    return null;
  }
  return zone.tiles[tileY][tileX];
}

export function isWalkable(zone: ZoneDef, x: number, y: number): boolean {
  const tile = tileAt(zone, x, y);
  if (tile === null) return false;
  return WALKABLE_TILES.has(tile);
}

/** Tiles navigable by boat (water + sand for docking). */
const BOAT_TILES = new Set([TileType.WATER, TileType.SAND, TileType.BRIDGE]);

/**
 * Check if a position is traversable while in a boat.
 * Boats can move on water, sand (coasts for docking), and bridges.
 */
export function isBoatWalkable(zone: ZoneDef, x: number, y: number): boolean {
  const tile = tileAt(zone, x, y);
  if (tile === null) return false;
  return BOAT_TILES.has(tile);
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}
