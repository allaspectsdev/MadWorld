import { CHUNK_SIZE } from "./constants/game.js";

export function posToChunk(x: number, y: number): [cx: number, cy: number] {
  return [Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE)];
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function chunksInRange(cx: number, cy: number, range: number): string[] {
  const keys: string[] = [];
  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      keys.push(chunkKey(cx + dx, cy + dy));
    }
  }
  return keys;
}
