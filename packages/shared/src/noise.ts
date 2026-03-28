/**
 * 2D Simplex noise — pure TypeScript, zero dependencies.
 *
 * Based on Stefan Gustavson's simplex noise implementation.
 * Produces values in [-1, 1] for any (x, y) input.
 *
 * Usage:
 *   const noise = createNoise2D(seed);
 *   const value = noise(x, y);           // -1..1
 *   const terrain = octaveNoise(noise, x, y, 6, 0.5); // layered
 */

// Gradient vectors for 2D simplex
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

// Skewing factors for 2D simplex
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

function dot2(g: number[], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

/**
 * Create a seeded permutation table for noise generation.
 */
function buildPerm(seed: number): Uint8Array {
  const perm = new Uint8Array(512);
  const source = new Uint8Array(256);
  for (let i = 0; i < 256; i++) source[i] = i;

  // Seed-based shuffle (xorshift32)
  let s = seed | 0;
  if (s === 0) s = 1;
  for (let i = 255; i > 0; i--) {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    const j = ((s >>> 0) % (i + 1));
    const tmp = source[i];
    source[i] = source[j];
    source[j] = tmp;
  }

  for (let i = 0; i < 256; i++) {
    perm[i] = source[i];
    perm[i + 256] = source[i];
  }
  return perm;
}

export type Noise2D = (x: number, y: number) => number;

/**
 * Create a 2D simplex noise function with the given seed.
 * Returns a function (x, y) => value in [-1, 1].
 */
export function createNoise2D(seed: number): Noise2D {
  const perm = buildPerm(seed);

  return function noise2d(xin: number, yin: number): number {
    // Skew the input space
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);

    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);

    // Determine which simplex triangle we're in
    let i1: number, j1: number;
    if (x0 > y0) {
      i1 = 1; j1 = 0; // lower triangle
    } else {
      i1 = 0; j1 = 1; // upper triangle
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    // Contributions from the three corners
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = perm[ii + perm[jj]] % 8;
      t0 *= t0;
      n0 = t0 * t0 * dot2(GRAD2[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
      t1 *= t1;
      n1 = t1 * t1 * dot2(GRAD2[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = perm[ii + 1 + perm[jj + 1]] % 8;
      t2 *= t2;
      n2 = t2 * t2 * dot2(GRAD2[gi2], x2, y2);
    }

    // Scale to [-1, 1]
    return 70 * (n0 + n1 + n2);
  };
}

/**
 * Layered (fractal Brownian motion) noise for natural terrain.
 *
 * @param noise    Base noise function from createNoise2D()
 * @param x        World x coordinate
 * @param y        World y coordinate
 * @param octaves  Number of noise layers (6 is good for terrain)
 * @param persistence  Amplitude decay per octave (0.5 typical)
 * @param lacunarity   Frequency multiplier per octave (2.0 typical)
 * @param scale    Initial frequency (lower = smoother)
 * @returns Value in approximately [-1, 1]
 */
export function octaveNoise(
  noise: Noise2D,
  x: number,
  y: number,
  octaves = 6,
  persistence = 0.5,
  lacunarity = 2.0,
  scale = 1.0,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = scale;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise(x * frequency, y * frequency) * amplitude;
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}
