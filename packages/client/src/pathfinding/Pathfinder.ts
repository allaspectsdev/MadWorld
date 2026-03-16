import { type TileType, WALKABLE_TILES } from "@madworld/shared";

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

const SQRT2 = Math.SQRT2;

function octileHeuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

function isWalkableAt(tiles: TileType[][], x: number, y: number): boolean {
  if (y < 0 || y >= tiles.length || x < 0 || x >= tiles[0].length) return false;
  return WALKABLE_TILES.has(tiles[y][x]);
}

/**
 * A* pathfinding on the tile grid. Returns an array of waypoint positions
 * (tile centers) from start to end, or null if no path exists.
 */
export function findPath(
  tiles: TileType[][],
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  maxSteps = 200,
): { x: number; y: number }[] | null {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  let ex = Math.floor(endX);
  let ey = Math.floor(endY);

  // If end tile is not walkable, find nearest walkable neighbor
  if (!isWalkableAt(tiles, ex, ey)) {
    let found = false;
    for (let r = 1; r <= 3 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          if (isWalkableAt(tiles, ex + dx, ey + dy)) {
            ex += dx;
            ey += dy;
            found = true;
          }
        }
      }
    }
    if (!found) return null;
  }

  if (sx === ex && sy === ey) return [{ x: ex + 0.5, y: ey + 0.5 }];

  // A* search
  const openSet: PathNode[] = [];
  const closedSet = new Set<number>();
  const width = tiles[0].length;
  const key = (x: number, y: number) => y * width + x;

  const startNode: PathNode = { x: sx, y: sy, g: 0, h: octileHeuristic(sx, sy, ex, ey), f: 0, parent: null };
  startNode.f = startNode.g + startNode.h;
  openSet.push(startNode);

  const gScores = new Map<number, number>();
  gScores.set(key(sx, sy), 0);

  let steps = 0;

  // 8-directional neighbors: [dx, dy, cost]
  const dirs: [number, number, number][] = [
    [0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1],
    [-1, -1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [1, 1, SQRT2],
  ];

  while (openSet.length > 0 && steps < maxSteps) {
    steps++;

    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet[bestIdx];
    openSet.splice(bestIdx, 1);

    if (current.x === ex && current.y === ey) {
      return reconstructPath(current);
    }

    const ck = key(current.x, current.y);
    if (closedSet.has(ck)) continue;
    closedSet.add(ck);

    for (const [dx, dy, cost] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (!isWalkableAt(tiles, nx, ny)) continue;

      // Prevent diagonal corner-cutting
      if (dx !== 0 && dy !== 0) {
        if (!isWalkableAt(tiles, current.x + dx, current.y) ||
            !isWalkableAt(tiles, current.x, current.y + dy)) {
          continue;
        }
      }

      const nk = key(nx, ny);
      if (closedSet.has(nk)) continue;

      const ng = current.g + cost;
      const prevG = gScores.get(nk);
      if (prevG !== undefined && ng >= prevG) continue;

      gScores.set(nk, ng);
      const nh = octileHeuristic(nx, ny, ex, ey);
      openSet.push({ x: nx, y: ny, g: ng, h: nh, f: ng + nh, parent: current });
    }
  }

  return null; // No path found
}

function reconstructPath(endNode: PathNode): { x: number; y: number }[] {
  const raw: { x: number; y: number }[] = [];
  let node: PathNode | null = endNode;
  while (node) {
    raw.unshift({ x: node.x + 0.5, y: node.y + 0.5 });
    node = node.parent;
  }
  // Smooth: remove collinear intermediate points
  if (raw.length <= 2) return raw;
  const smoothed: { x: number; y: number }[] = [raw[0]];
  for (let i = 1; i < raw.length - 1; i++) {
    const prev = raw[i - 1];
    const curr = raw[i];
    const next = raw[i + 1];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    // Keep point if direction changes
    if (Math.abs(dx1 - dx2) > 0.01 || Math.abs(dy1 - dy2) > 0.01) {
      smoothed.push(curr);
    }
  }
  smoothed.push(raw[raw.length - 1]);
  return smoothed;
}

/**
 * Trim a path so the last waypoint is within `range` tiles of (tx, ty).
 * Used to stop the player at attack/pickup distance instead of on top of the target.
 */
export function trimPathToRange(
  path: { x: number; y: number }[],
  tx: number,
  ty: number,
  range: number,
): { x: number; y: number }[] {
  if (path.length === 0) return path;

  for (let i = path.length - 1; i >= 0; i--) {
    const dx = path[i].x - tx;
    const dy = path[i].y - ty;
    if (Math.sqrt(dx * dx + dy * dy) >= range) {
      return path.slice(0, i + 1);
    }
  }
  return [path[0]]; // Already in range
}
