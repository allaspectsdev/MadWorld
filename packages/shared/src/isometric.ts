/**
 * Isometric projection utilities.
 *
 * The world grid is still stored as cartesian (x right, y down).
 * These helpers convert between cartesian world-tile coordinates
 * and isometric screen-pixel coordinates using a standard 2:1
 * diamond projection.
 *
 * Tile footprint on screen:
 *   ISO_TILE_W = 64 px wide (diamond width)
 *   ISO_TILE_H = 32 px tall (diamond height)
 *
 * Height is expressed in discrete elevation levels.  Each level
 * shifts the tile up by ELEVATION_PX pixels on screen.
 */

// ---- Constants ----

/** Width of one isometric tile diamond in pixels. */
export const ISO_TILE_W = 64;

/** Height of one isometric tile diamond in pixels. */
export const ISO_TILE_H = 32;

/** Pixels per elevation level (how high one "step" is). */
export const ELEVATION_PX = 16;

/** Half-tile helpers (used constantly in the math). */
export const ISO_HALF_W = ISO_TILE_W / 2; // 32
export const ISO_HALF_H = ISO_TILE_H / 2; // 16

// ---- Coordinate conversion ----

/**
 * Convert cartesian world coordinates (tile-space, float) to
 * isometric screen-pixel coordinates.
 *
 * @param cx  Cartesian x (tiles, float)
 * @param cy  Cartesian y (tiles, float)
 * @param elevation  Height level (0 = ground). Default 0.
 * @returns  Screen-pixel position { x, y } relative to map origin.
 */
export function cartToIso(
  cx: number,
  cy: number,
  elevation = 0,
): { x: number; y: number } {
  return {
    x: (cx - cy) * ISO_HALF_W,
    y: (cx + cy) * ISO_HALF_H - elevation * ELEVATION_PX,
  };
}

/**
 * Inverse of cartToIso — convert isometric screen-pixel position
 * back to cartesian world coordinates.
 *
 * @param ix  Screen x (pixels, relative to map origin)
 * @param iy  Screen y (pixels, relative to map origin)
 * @param elevation  Assumed height level. Default 0.
 * @returns  World tile position { x, y } as floats.
 */
export function isoToCart(
  ix: number,
  iy: number,
  elevation = 0,
): { x: number; y: number } {
  // Undo the elevation shift first
  const iyAdj = iy + elevation * ELEVATION_PX;
  return {
    x: (ix / ISO_HALF_W + iyAdj / ISO_HALF_H) / 2,
    y: (iyAdj / ISO_HALF_H - ix / ISO_HALF_W) / 2,
  };
}

// ---- Depth sorting ----

/**
 * Compute a depth/z-index value for an entity or tile at the given
 * cartesian position.  Higher values render on top (closer to viewer).
 *
 * For a standard isometric view the depth is simply (x + y), with
 * elevation used as a tiebreaker so raised objects draw above ground
 * tiles at the same base position.
 */
export function isoDepth(cx: number, cy: number, elevation = 0): number {
  return cx + cy + elevation * 0.001;
}

// ---- Viewport helpers ----

/**
 * Given a rectangular screen viewport (in pixels), compute the
 * bounding rectangle of cartesian tiles that could be visible.
 *
 * Returns integer tile bounds with a configurable margin.
 */
export function isoViewBounds(
  screenLeft: number,
  screenTop: number,
  screenRight: number,
  screenBottom: number,
  mapWidth: number,
  mapHeight: number,
  margin = 3,
): { minX: number; minY: number; maxX: number; maxY: number } {
  // Sample the four screen corners in cart-space
  const tl = isoToCart(screenLeft, screenTop);
  const tr = isoToCart(screenRight, screenTop);
  const bl = isoToCart(screenLeft, screenBottom);
  const br = isoToCart(screenRight, screenBottom);

  const minX = Math.floor(Math.min(tl.x, tr.x, bl.x, br.x)) - margin;
  const maxX = Math.ceil(Math.max(tl.x, tr.x, bl.x, br.x)) + margin;
  const minY = Math.floor(Math.min(tl.y, tr.y, bl.y, br.y)) - margin;
  const maxY = Math.ceil(Math.max(tl.y, tr.y, bl.y, br.y)) + margin;

  return {
    minX: Math.max(0, minX),
    minY: Math.max(0, minY),
    maxX: Math.min(mapWidth - 1, maxX),
    maxY: Math.min(mapHeight - 1, maxY),
  };
}
