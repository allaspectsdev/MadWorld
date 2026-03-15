import { posToChunk, chunkKey, chunksInRange } from "@madworld/shared";
import { VIEW_RANGE_CHUNKS } from "@madworld/shared";

export class SpatialGrid {
  private chunks = new Map<string, Set<number>>();
  private entityChunk = new Map<number, string>();

  updateEntity(
    eid: number,
    x: number,
    y: number,
  ): { oldChunk: string | null; newChunk: string; changed: boolean } {
    const [cx, cy] = posToChunk(x, y);
    const newKey = chunkKey(cx, cy);
    const oldKey = this.entityChunk.get(eid) ?? null;

    if (oldKey === newKey) {
      return { oldChunk: oldKey, newChunk: newKey, changed: false };
    }

    if (oldKey !== null) {
      this.chunks.get(oldKey)?.delete(eid);
    }

    let bucket = this.chunks.get(newKey);
    if (!bucket) {
      bucket = new Set();
      this.chunks.set(newKey, bucket);
    }
    bucket.add(eid);
    this.entityChunk.set(eid, newKey);

    return { oldChunk: oldKey, newChunk: newKey, changed: true };
  }

  removeEntity(eid: number): void {
    const key = this.entityChunk.get(eid);
    if (key !== undefined) {
      this.chunks.get(key)?.delete(eid);
      this.entityChunk.delete(eid);
    }
  }

  queryNearby(x: number, y: number, range: number = VIEW_RANGE_CHUNKS): Set<number> {
    const [cx, cy] = posToChunk(x, y);
    const result = new Set<number>();
    const keys = chunksInRange(cx, cy, range);
    for (const key of keys) {
      const set = this.chunks.get(key);
      if (set) {
        for (const eid of set) {
          result.add(eid);
        }
      }
    }
    return result;
  }

  getChunk(key: string): ReadonlySet<number> {
    return this.chunks.get(key) ?? new Set();
  }
}
