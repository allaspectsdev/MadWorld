import { Graphics, Texture } from "pixi.js";
import { TileType, TILE_SIZE } from "@madworld/shared";
import { TextureFactory } from "./TextureFactory.js";

const S = TILE_SIZE;

function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// Helper: draw a small blade of grass
function blade(g: Graphics, x: number, y: number, h: number, color: number): void {
  g.moveTo(x, y);
  g.lineTo(x - 0.5, y - h);
  g.lineTo(x + 0.5, y - h);
  g.lineTo(x, y);
  g.fill(color);
}

// ---------------------------------------------------------------------------
// GRASS — 6 variants
// ---------------------------------------------------------------------------
function drawGrass(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 7919);
  const greens = [0x3d6b4a, 0x4a7c59, 0x5a8c69, 0x6a9c79, 0x3a6040, 0x528a5e];

  // Base fill
  g.rect(0, 0, S, S);
  g.fill(0x4a7c59);

  // Smooth gradient tonal variation: large overlapping fills at very low alpha
  g.rect(0, 0, S, S);
  g.fill({ color: 0x3a6040, alpha: 0.04 });
  g.rect(2, 2, S - 4, S - 4);
  g.fill({ color: 0x5a8c69, alpha: 0.03 });
  g.rect(4, 4, S - 8, S - 8);
  g.fill({ color: 0x4a7c59, alpha: 0.05 });

  // Subtle horizontal bands for tonal variation
  const grassBandH = Math.ceil(S / 4);
  g.rect(0, 0, S, grassBandH);
  g.fill({ color: 0x3d6b4a, alpha: 0.02 });
  g.rect(0, grassBandH, S, grassBandH);
  g.fill({ color: 0x5a8c69, alpha: 0.02 });
  g.rect(0, grassBandH * 2, S, grassBandH);
  g.fill({ color: 0x3a6040, alpha: 0.02 });
  g.rect(0, grassBandH * 3, S, grassBandH);
  g.fill({ color: 0x6a9c79, alpha: 0.02 });

  // 6-8 grass tufts as curved bezier arcs leaning in a seeded wind direction
  const windAngle = (rng() - 0.5) * 1.2; // consistent wind per variant
  const tuftCount = 6 + Math.floor(rng() * 3);
  for (let i = 0; i < tuftCount; i++) {
    const bx = 2 + rng() * (S - 4);
    const by = 4 + rng() * (S - 5);
    const bh = 3 + rng() * 2;
    const lean = windAngle + (rng() - 0.5) * 0.4;
    const tipX = bx + Math.sin(lean) * bh;
    const tipY = by - bh;
    const cpX = bx + Math.sin(lean) * bh * 0.6;
    const cpY = by - bh * 0.6;
    const color = greens[Math.floor(rng() * greens.length)];
    g.moveTo(bx, by);
    g.quadraticCurveTo(cpX, cpY, tipX, tipY);
    g.stroke({ width: 1, color, alpha: 0.85 });
  }

  // 2-3 dappled sunlight highlight ellipses in upper half
  const highlightCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < highlightCount; i++) {
    const hx = 4 + rng() * (S - 8);
    const hy = 2 + rng() * (S / 2 - 4);
    g.ellipse(hx, hy, 3 + rng() * 3, 2 + rng() * 2);
    g.fill({ color: 0xaaffaa, alpha: 0.05 });
  }

  // Variants 0-1: 4-petal flowers
  if (variant < 2) {
    const flowerColors = [0xffff66, 0xff99cc, 0xffffcc, 0xffaa66, 0xaaddff];
    const fCount = 1 + Math.floor(rng() * 2);
    for (let f = 0; f < fCount; f++) {
      const fx = 5 + rng() * (S - 10);
      const fy = 5 + rng() * (S - 10);
      const fc = flowerColors[Math.floor(rng() * flowerColors.length)];
      const petalR = 1.0;
      const petalOff = 1.8;
      // 4 petals
      g.ellipse(fx - petalOff, fy, petalR, petalR * 0.7);
      g.fill({ color: fc, alpha: 0.7 });
      g.ellipse(fx + petalOff, fy, petalR, petalR * 0.7);
      g.fill({ color: fc, alpha: 0.7 });
      g.ellipse(fx, fy - petalOff, petalR * 0.7, petalR);
      g.fill({ color: fc, alpha: 0.7 });
      g.ellipse(fx, fy + petalOff, petalR * 0.7, petalR);
      g.fill({ color: fc, alpha: 0.7 });
      // Center dot
      g.circle(fx, fy, 0.8);
      g.fill(0xffcc00);
    }
  }

  // Directional light: subtle top highlight, bottom shadow
  g.rect(0, 0, S, 4);
  g.fill({ color: 0xffffff, alpha: 0.02 });
  g.rect(0, S - 4, S, 4);
  g.fill({ color: 0x000000, alpha: 0.02 });

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// WATER — 3 frames (animated)
// ---------------------------------------------------------------------------
function drawWater(frame: number): Texture {
  const g = new Graphics();

  // Depth gradient: concentric rounded rects from dark edge to lighter center
  const depthColors = [0x1e4a78, 0x245a88, 0x2c6a98, 0x3474a8, 0x3a7cb0];
  for (let i = 0; i < depthColors.length; i++) {
    const inset = i * 3;
    g.roundRect(inset, inset, S - inset * 2, S - inset * 2, 2);
    g.fill(depthColors[i]);
  }

  // 2px dark edge shadow on all four sides
  g.rect(0, 0, S, 2);
  g.fill({ color: 0x0a2a4a, alpha: 0.15 });
  g.rect(0, S - 2, S, 2);
  g.fill({ color: 0x0a2a4a, alpha: 0.15 });
  g.rect(0, 0, 2, S);
  g.fill({ color: 0x0a2a4a, alpha: 0.15 });
  g.rect(S - 2, 0, 2, S);
  g.fill({ color: 0x0a2a4a, alpha: 0.15 });

  // Phase shift between frames
  const phaseShift = 2.1;
  const phase = frame * phaseShift;

  // 4-6 wave caustic bezier curves
  for (let i = 0; i < 5; i++) {
    const baseY = 3 + i * 6;
    g.moveTo(0, baseY + Math.sin(phase + i * 0.8) * 2);
    g.bezierCurveTo(
      S * 0.25, baseY + Math.sin(phase + i * 0.8 + 1.0) * 3,
      S * 0.75, baseY + Math.sin(phase + i * 0.8 + 2.0) * 3,
      S, baseY + Math.sin(phase + i * 0.8 + 3.0) * 2
    );
    g.stroke({ width: 1.5, color: 0x6ab0d8, alpha: 0.12 });
  }

  // 3-4 foam crescent arcs along wave crests
  for (let i = 0; i < 4; i++) {
    const foamX = 4 + ((i * 8 + frame * 5) % (S - 8));
    const foamY = 2 + ((i * 7 + frame * 3) % (S - 4));
    g.moveTo(foamX, foamY);
    g.quadraticCurveTo(foamX + 3, foamY - 1.5, foamX + 6, foamY);
    g.stroke({ width: 1, color: 0xbbddff, alpha: 0.25 });
  }

  // Specular highlights
  for (let i = 0; i < 5; i++) {
    const hx = ((7 + i * 7 + frame * 4) % (S - 4)) + 2;
    const hy = ((3 + i * 6 + frame * 3) % (S - 4)) + 2;
    g.circle(hx, hy, 0.7);
    g.fill({ color: 0xffffff, alpha: 0.3 });
    g.circle(hx, hy, 2);
    g.fill({ color: 0xaaddff, alpha: 0.08 });
  }

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// FOREST — 6 variants
// ---------------------------------------------------------------------------
function drawForest(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 8837);

  // Dark ground base
  g.rect(0, 0, S, S);
  g.fill(0x263e1e);

  // 15-20 moss/leaf debris dots
  const debrisCount = 15 + Math.floor(rng() * 6);
  const debrisColors = [0x1e3216, 0x2e4e26, 0x3a2a1a, 0x2a3a1e, 0x1a2e14, 0x3e2e1e];
  for (let i = 0; i < debrisCount; i++) {
    const dx = rng() * S;
    const dy = rng() * S;
    g.circle(dx, dy, 0.5 + rng() * 0.5);
    g.fill(debrisColors[Math.floor(rng() * debrisColors.length)]);
  }

  // Position the tree
  const tx = 8 + Math.floor(rng() * 14);
  const ty = 10 + Math.floor(rng() * 6);
  const trunkH = 10;
  const trunkBaseW = 5;
  const trunkTopW = 3;

  // Ground shadow ellipse beneath tree
  const shadowRx = 8 + rng();
  const shadowRy = 3 + rng();
  g.ellipse(tx + trunkBaseW / 2, ty + trunkH + 1, shadowRx, shadowRy);
  g.fill({ color: 0x0a1a08, alpha: 0.25 });

  // 2-3 mushrooms on variants 0-2
  if (variant < 3) {
    const mushCount = 2 + Math.floor(rng() * 2);
    const mushColors = [0xc8a050, 0xb03030, 0xd4a060];
    for (let m = 0; m < mushCount; m++) {
      const mx = tx + (rng() - 0.5) * 16;
      const my = ty + trunkH - 2 + rng() * 4;
      if (mx > 1 && mx < S - 1 && my > 1 && my < S - 1) {
        // Stem
        g.rect(mx - 0.5, my - 2, 1, 2);
        g.fill(0xe8dcc8);
        // Cap
        g.ellipse(mx, my - 2, 1.5, 1);
        g.fill(mushColors[Math.floor(rng() * mushColors.length)]);
      }
    }
  }

  // 3-4 root bezier curves from trunk base
  const rootCount = 3 + Math.floor(rng() * 2);
  for (let r = 0; r < rootCount; r++) {
    const rootStartX = tx + rng() * trunkBaseW;
    const rootStartY = ty + trunkH;
    const rootLen = 4 + rng() * 4;
    const rootAngle = (rng() - 0.5) * Math.PI * 0.8;
    const rootEndX = rootStartX + Math.sin(rootAngle) * rootLen;
    const rootEndY = rootStartY + Math.abs(Math.cos(rootAngle)) * rootLen * 0.4;
    g.moveTo(rootStartX, rootStartY);
    g.quadraticCurveTo(
      (rootStartX + rootEndX) / 2 + (rng() - 0.5) * 3,
      rootStartY + 2,
      rootEndX,
      rootEndY
    );
    g.stroke({ width: 0.8, color: 0x4a2e14, alpha: 0.7 });
  }

  // Tapered trunk polygon
  const trunkLeft = tx;
  const trunkRight = tx + trunkBaseW;
  const trunkTopLeft = tx + (trunkBaseW - trunkTopW) / 2;
  const trunkTopRight = trunkTopLeft + trunkTopW;
  g.moveTo(trunkLeft, ty + trunkH);
  g.lineTo(trunkTopLeft, ty);
  g.lineTo(trunkTopRight, ty);
  g.lineTo(trunkRight, ty + trunkH);
  g.closePath();
  g.fill(0x5c3a1e);

  // 3-4 bark detail lines on trunk
  for (let b = 0; b < 4; b++) {
    const by = ty + 1 + b * 2.5;
    const bx = trunkLeft + 1 + rng() * (trunkBaseW - 2);
    g.moveTo(bx, by);
    g.lineTo(bx + (rng() - 0.5) * 1.5, by + 1.5);
    g.stroke({ width: 0.5, color: 0x4a2e14, alpha: 0.5 });
  }

  // Highlight strip on trunk (light side)
  g.rect(trunkTopLeft + 0.5, ty + 1, 1, trunkH - 2);
  g.fill({ color: 0x8b6a3e, alpha: 0.3 });

  // 2 branch bezier curves from upper trunk
  const branchAngles = [Math.PI / 6, -Math.PI / 4]; // ~30 deg, ~-45 deg
  for (let b = 0; b < 2; b++) {
    const bStartX = tx + trunkBaseW / 2 + (b === 0 ? 1 : -1);
    const bStartY = ty + 2 + b * 1.5;
    const bLen = 4 + rng() * 3;
    const angle = branchAngles[b];
    const bEndX = bStartX + Math.cos(angle) * bLen * (b === 0 ? 1 : -1);
    const bEndY = bStartY - Math.sin(Math.abs(angle)) * bLen;
    g.moveTo(bStartX, bStartY);
    g.quadraticCurveTo(
      (bStartX + bEndX) / 2,
      bStartY - 2,
      bEndX,
      bEndY
    );
    g.stroke({ width: 1, color: 0x5c3a1e, alpha: 0.8 });
  }

  // 5-7 overlapping canopy ellipses
  const leafColors = [0x1a4e12, 0x1e5a16, 0x2a6e22, 0x347c2c];
  const canopyCount = 5 + Math.floor(rng() * 3);
  const canopyCenterX = tx + trunkBaseW / 2;
  const canopyCenterY = ty - 2;
  for (let c = 0; c < canopyCount; c++) {
    const lx = canopyCenterX + (rng() - 0.5) * 8;
    const ly = canopyCenterY + (rng() - 0.5) * 8;
    const rx = 3 + rng() * 3;
    const ry = 3 + rng() * 3;
    g.ellipse(lx, ly, rx, ry);
    g.fill(leafColors[Math.floor(rng() * leafColors.length)]);
  }

  // 2-3 canopy highlight ellipses in upper-left
  const hlCount = 2 + Math.floor(rng() * 2);
  for (let h = 0; h < hlCount; h++) {
    const hx = canopyCenterX - 2 + (rng() - 0.5) * 4;
    const hy = canopyCenterY - 2 + (rng() - 0.5) * 3;
    g.ellipse(hx, hy, 2 + rng() * 2, 1.5 + rng() * 1.5);
    g.fill({ color: 0x66aa44, alpha: 0.15 });
  }

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// MOUNTAIN — 3 variants
// ---------------------------------------------------------------------------
function drawMountain(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 2677);

  // Base gray
  g.rect(0, 0, S, S);
  g.fill(0x606060);

  // 5-7 irregular rock slab polygons
  const slabCount = 5 + Math.floor(rng() * 3);
  const grayRange = [0x555555, 0x5e5e5e, 0x666666, 0x6e6e6e, 0x757575];
  for (let s = 0; s < slabCount; s++) {
    const cx = rng() * S;
    const cy = rng() * S;
    const vertCount = 4 + Math.floor(rng() * 3); // 4-6 vertices
    const slabColor = grayRange[Math.floor(rng() * grayRange.length)];

    // Generate irregular polygon vertices
    const verts: { x: number; y: number }[] = [];
    for (let v = 0; v < vertCount; v++) {
      const angle = (v / vertCount) * Math.PI * 2;
      const rad = 3 + rng() * 4;
      verts.push({
        x: cx + Math.cos(angle) * rad,
        y: cy + Math.sin(angle) * rad,
      });
    }

    // Draw filled polygon
    g.moveTo(verts[0].x, verts[0].y);
    for (let v = 1; v < verts.length; v++) {
      g.lineTo(verts[v].x, verts[v].y);
    }
    g.closePath();
    g.fill(slabColor);

    // 1px dark outline
    g.moveTo(verts[0].x, verts[0].y);
    for (let v = 1; v < verts.length; v++) {
      g.lineTo(verts[v].x, verts[v].y);
    }
    g.closePath();
    g.stroke({ width: 1, color: 0x3a3a3a, alpha: 0.3 });

    // Highlight on top edges (upper vertices)
    for (let v = 0; v < verts.length; v++) {
      const next = (v + 1) % verts.length;
      if (verts[v].y < cy && verts[next].y < cy) {
        g.moveTo(verts[v].x, verts[v].y);
        g.lineTo(verts[next].x, verts[next].y);
        g.stroke({ width: 1, color: 0xffffff, alpha: 0.08 });
      }
    }
    // Shadow on bottom edges
    for (let v = 0; v < verts.length; v++) {
      const next = (v + 1) % verts.length;
      if (verts[v].y > cy && verts[next].y > cy) {
        g.moveTo(verts[v].x, verts[v].y);
        g.lineTo(verts[next].x, verts[next].y);
        g.stroke({ width: 1, color: 0x000000, alpha: 0.12 });
      }
    }
  }

  // 2-3 deep crack jagged lines
  const crackCount = 2 + Math.floor(rng() * 2);
  for (let c = 0; c < crackCount; c++) {
    let cx = rng() * S;
    let cy = rng() * S;
    g.moveTo(cx, cy);
    const segments = 3 + Math.floor(rng() * 3);
    for (let seg = 0; seg < segments; seg++) {
      // Sharp angles for jagged look
      cx += (rng() - 0.5) * 8;
      cy += 2 + rng() * 5;
      cx = Math.max(0, Math.min(S, cx));
      cy = Math.max(0, Math.min(S, cy));
      g.lineTo(cx, cy);
    }
    g.stroke({ width: 0.8, color: 0x222222, alpha: 0.6 });
  }

  // Snow cap on top 30%: irregular bezier polygon
  const snowY = S * 0.3;
  const snowPoints = 6;
  g.moveTo(0, snowY + rng() * 3);
  for (let i = 1; i <= snowPoints; i++) {
    const sx = (i / snowPoints) * S;
    const sy = snowY + (rng() - 0.5) * 5;
    const cpx = sx - S / snowPoints / 2;
    const cpy = sy + (rng() - 0.5) * 4;
    g.quadraticCurveTo(cpx, cpy, sx, Math.max(0, sy));
  }
  g.lineTo(S, 0);
  g.lineTo(0, 0);
  g.closePath();
  g.fill({ color: 0xffffff, alpha: 0.5 + rng() * 0.2 });

  // 2-3 tiny icicle triangles hanging from snow edge
  const icicleCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < icicleCount; i++) {
    const ix = 4 + rng() * (S - 8);
    const iy = snowY + rng() * 2;
    const ih = 2 + rng() * 2;
    g.moveTo(ix - 1, iy);
    g.lineTo(ix, iy + ih);
    g.lineTo(ix + 1, iy);
    g.closePath();
    g.fill({ color: 0xddeeff, alpha: 0.4 });
  }

  // 2-3 moss ellipses at bottom
  const mossCount = 2 + Math.floor(rng() * 2);
  for (let m = 0; m < mossCount; m++) {
    const mx = 2 + rng() * (S - 4);
    const my = S - 3 - rng() * 5;
    g.ellipse(mx, my, 2 + rng() * 2, 1 + rng());
    g.fill({ color: 0x3a5a2a, alpha: 0.3 });
  }

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// SAND — 5 variants
// ---------------------------------------------------------------------------
function drawSand(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 5101);

  // Base gradient: 4 horizontal bands from darker bottom to lighter top
  const bandColors = [0xb5a573, 0xbcb07c, 0xc0b480, 0xc8bb88];
  const bandH = Math.ceil(S / bandColors.length);
  for (let i = bandColors.length - 1; i >= 0; i--) {
    g.rect(0, i * bandH, S, bandH);
    g.fill(bandColors[i]);
  }

  // 6-8 paired ripple bezier curves (shadow + highlight)
  const rippleCount = 6 + Math.floor(rng() * 3);
  for (let i = 0; i < rippleCount; i++) {
    const ry = 2 + i * (S / rippleCount) + (rng() - 0.5) * 2;
    const amp = 0.8 + rng() * 1.2;
    const freq = 0.2 + rng() * 0.15;

    // Shadow line
    g.moveTo(0, ry);
    for (let x = 0; x <= S; x += 2) {
      g.lineTo(x, ry + Math.sin(x * freq + variant * 1.3 + i) * amp);
    }
    g.stroke({ width: 1.0, color: 0xa89860, alpha: 0.25 });

    // Highlight line one pixel above
    g.moveTo(0, ry - 1);
    for (let x = 0; x <= S; x += 2) {
      g.lineTo(x, ry - 1 + Math.sin(x * freq + variant * 1.3 + i) * amp);
    }
    g.stroke({ width: 1.0, color: 0xd6c898, alpha: 0.18 });
  }

  // Variant 0: Small spiral shell using arc segments
  if (variant === 0) {
    const sx = 8 + rng() * 16;
    const sy = 8 + rng() * 16;
    // Draw a tiny spiral shell
    for (let a = 0; a < 5; a++) {
      const angle0 = (a / 5) * Math.PI * 2;
      const angle1 = ((a + 1) / 5) * Math.PI * 2;
      const r = 1 + a * 0.3;
      g.moveTo(sx + Math.cos(angle0) * r, sy + Math.sin(angle0) * r);
      g.quadraticCurveTo(
        sx + Math.cos((angle0 + angle1) / 2) * (r + 0.5),
        sy + Math.sin((angle0 + angle1) / 2) * (r + 0.5),
        sx + Math.cos(angle1) * (r + 0.3),
        sy + Math.sin(angle1) * (r + 0.3)
      );
      g.stroke({ width: 0.6, color: 0xe8d8c0, alpha: 0.7 });
    }
    // Shell body fill
    g.circle(sx, sy, 1.5);
    g.fill({ color: 0xe8d8c0, alpha: 0.5 });
  }

  // Directional light: subtle top highlight, bottom shadow
  g.rect(0, 0, S, 4);
  g.fill({ color: 0xffffff, alpha: 0.04 });
  g.rect(0, S - 4, S, 4);
  g.fill({ color: 0x000000, alpha: 0.04 });

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// DIRT — 3 variants
// ---------------------------------------------------------------------------
function drawDirt(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 6271);

  // Base
  g.rect(0, 0, S, S);
  g.fill(0x8b7355);

  // Smooth horizontal bands for subtle tonal variation
  const bandH = Math.ceil(S / 3);
  g.rect(0, 0, S, bandH);
  g.fill({ color: 0x7b6345, alpha: 0.03 });
  g.rect(0, bandH, S, bandH);
  g.fill({ color: 0x9b8365, alpha: 0.02 });
  g.rect(0, bandH * 2, S, bandH);
  g.fill({ color: 0x7a6a50, alpha: 0.03 });

  // Variants 0-1: Lighter worn oval in center
  if (variant < 2) {
    g.ellipse(S / 2 + (rng() - 0.5) * 4, S / 2 + (rng() - 0.5) * 4, 5 + rng() * 3, 4 + rng() * 2);
    g.fill({ color: 0x9b8b6b, alpha: 0.15 });
  }

  // 3-4 branching crack paths with 2-segment branches splitting at +/-30 degrees
  const crackCount = 3 + Math.floor(rng() * 2);
  for (let c = 0; c < crackCount; c++) {
    let cx = rng() * S;
    let cy = rng() * S;
    let angle = rng() * Math.PI * 2;
    g.moveTo(cx, cy);

    for (let seg = 0; seg < 3; seg++) {
      const len = 3 + rng() * 4;
      angle += (rng() - 0.5) * 0.8;
      const nx = cx + Math.cos(angle) * len;
      const ny = cy + Math.sin(angle) * len;
      g.lineTo(
        Math.max(0, Math.min(S, nx)),
        Math.max(0, Math.min(S, ny))
      );

      // Branch at ~+/-30 degrees
      if (seg < 2 && rng() > 0.3) {
        const branchAngle = angle + (rng() > 0.5 ? 0.52 : -0.52); // ~30 degrees
        const bLen = 2 + rng() * 3;
        const bx1 = nx + Math.cos(branchAngle) * bLen;
        const by1 = ny + Math.sin(branchAngle) * bLen;
        g.moveTo(nx, ny);
        g.lineTo(
          Math.max(0, Math.min(S, bx1)),
          Math.max(0, Math.min(S, by1))
        );
        // Second segment of branch
        const branchAngle2 = branchAngle + (rng() - 0.5) * 0.4;
        const bLen2 = 1.5 + rng() * 2;
        g.lineTo(
          Math.max(0, Math.min(S, bx1 + Math.cos(branchAngle2) * bLen2)),
          Math.max(0, Math.min(S, by1 + Math.sin(branchAngle2) * bLen2))
        );
        // Return to main path
        g.moveTo(
          Math.max(0, Math.min(S, nx)),
          Math.max(0, Math.min(S, ny))
        );
      }

      cx = Math.max(0, Math.min(S, nx));
      cy = Math.max(0, Math.min(S, ny));
    }
    g.stroke({ width: 0.5, color: 0x5a4230, alpha: 0.4 });
  }

  // 2-3 pebble ellipses with shadow offset
  const pebbleCount = 2 + Math.floor(rng() * 2);
  const pebbleGrays = [0x888888, 0x999999, 0x777777, 0xaaaaaa, 0x8a8a8a];
  for (let p = 0; p < pebbleCount; p++) {
    const px = 2 + rng() * (S - 4);
    const py = 2 + rng() * (S - 4);
    const prx = 1 + rng() * 0.75;
    const pry = 0.8 + rng() * 0.7;
    // Shadow
    g.ellipse(px + 0.5, py + 0.5, prx, pry);
    g.fill({ color: 0x000000, alpha: 0.12 });
    // Pebble
    g.ellipse(px, py, prx, pry);
    g.fill(pebbleGrays[Math.floor(rng() * pebbleGrays.length)]);
  }

  // Variant 2: 2-3 tiny grass arcs along one edge
  if (variant === 2) {
    const grassCount = 2 + Math.floor(rng() * 2);
    const greens = [0x4a7c59, 0x3d6b4a, 0x5a8c69];
    for (let gIdx = 0; gIdx < grassCount; gIdx++) {
      const gx = 3 + rng() * (S - 6);
      const gy = S - 1;
      const gh = 2 + rng() * 2;
      g.moveTo(gx, gy);
      g.quadraticCurveTo(gx + (rng() - 0.5) * 2, gy - gh, gx + (rng() - 0.5) * 1.5, gy - gh);
      g.stroke({ width: 0.8, color: greens[Math.floor(rng() * greens.length)], alpha: 0.7 });
    }
  }

  // Directional light: subtle top highlight, bottom shadow
  g.rect(0, 0, S, 4);
  g.fill({ color: 0xffffff, alpha: 0.04 });
  g.rect(0, S - 4, S, 4);
  g.fill({ color: 0x000000, alpha: 0.04 });

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// COBBLESTONE — 3 variants
// ---------------------------------------------------------------------------
function drawCobblestone(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 4391);

  // Lighter mortar base
  g.rect(0, 0, S, S);
  g.fill(0x3a3a3a);

  // Row-based stone placement with rounded corners
  let y = 1;
  while (y < S - 1) {
    let x = 1;
    const rowShift = Math.floor(rng() * 5);
    while (x < S - 1) {
      const sw = 5 + Math.floor(rng() * 9);
      const sh = 4 + Math.floor(rng() * 5);
      const w = Math.min(sw, S - x - 1);
      const h = Math.min(sh, S - y - 1);
      if (w < 3 || h < 3) { x += sw + 1; continue; }

      const baseShade = 0x686868 + Math.floor(rng() * 0x303030);
      const sx = x + rowShift % 3;

      // Stone face with increased corner radius
      g.roundRect(sx, y, w, h, 2 + rng() * 0.5);
      g.fill(baseShade);

      // Reduced highlight (top-left)
      g.rect(sx + 1, y + 1, w - 2, 1);
      g.fill({ color: 0xffffff, alpha: 0.06 });
      g.rect(sx + 1, y + 1, 1, h - 2);
      g.fill({ color: 0xffffff, alpha: 0.04 });

      // Reduced shadow (bottom-right)
      g.rect(sx, y + h - 1, w, 1);
      g.fill({ color: 0x000000, alpha: 0.06 });
      g.rect(sx + w - 1, y, 1, h);
      g.fill({ color: 0x000000, alpha: 0.06 });

      x += w + 1;
    }
    y += 5 + Math.floor(rng() * 4);
  }

  // Directional light: subtle top highlight, bottom shadow
  g.rect(0, 0, S, 4);
  g.fill({ color: 0xffffff, alpha: 0.04 });
  g.rect(0, S - 4, S, 4);
  g.fill({ color: 0x000000, alpha: 0.04 });

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// BUILDING FLOOR — 3 variants
// ---------------------------------------------------------------------------
function drawBuildingFloor(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 3313);

  // Grout base
  g.rect(0, 0, S, S);
  g.fill(0x7a4a2e);

  // Mix of 8x8 and 6x10 flagstones with seeded pattern
  let ty = 0;
  let rowIdx = 0;
  while (ty < S) {
    let tx = 0;
    const useWide = (rowIdx + Math.floor(rng() * 2)) % 2 === 0;
    const tileH = useWide ? 8 : 10;
    const tileW = useWide ? 8 : 6;

    while (tx < S) {
      const w = Math.min(tileW, S - tx);
      const h = Math.min(tileH, S - ty);
      if (w < 2 || h < 2) { tx += tileW; continue; }

      const light = (Math.floor(tx / tileW) + rowIdx) % 2 === 0;
      const baseColor = light ? 0xa05028 : 0x984820;
      const shade = baseColor + Math.floor(rng() * 0x0a0a0a);

      g.rect(tx + 0.75, ty + 0.75, w - 1.5, h - 1.5);
      g.fill(shade);

      // 0.5px inner shadow all around each flagstone
      g.rect(tx + 0.75, ty + 0.75, w - 1.5, 0.5);
      g.fill({ color: 0x000000, alpha: 0.04 });
      g.rect(tx + 0.75, ty + h - 1.25, w - 1.5, 0.5);
      g.fill({ color: 0x000000, alpha: 0.04 });
      g.rect(tx + 0.75, ty + 0.75, 0.5, h - 1.5);
      g.fill({ color: 0x000000, alpha: 0.04 });
      g.rect(tx + w - 1.25, ty + 0.75, 0.5, h - 1.5);
      g.fill({ color: 0x000000, alpha: 0.04 });

      // Variants 1-2: Chip marks on edges
      if (variant >= 1 && rng() > 0.6) {
        const chipX = tx + (rng() > 0.5 ? 0.5 : w - 1.5);
        const chipY = ty + 1 + rng() * (h - 2);
        g.rect(chipX, chipY, 1, 1);
        g.fill({ color: 0x7a4a2e, alpha: 0.6 });
      }

      tx += tileW;
    }
    ty += tileH;
    rowIdx++;
  }

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// BRIDGE — 2 variants (enriched wood grain and nails)
// ---------------------------------------------------------------------------
function drawBridge(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 1993);

  g.rect(0, 0, S, S);
  g.fill(0x7b5904);

  // Planks with richer grain and gaps
  for (let y = 0; y < S; y += 5) {
    // Varied plank shading per row
    const baseTone = 0x8b6914 + Math.floor(rng() * 0x1a1a10);
    const darkTone = baseTone - 0x101008;
    g.rect(0, y, S, 4);
    g.fill(baseTone);

    // Warm highlight on plank top
    g.rect(0, y, S, 1);
    g.fill({ color: 0xffeedd, alpha: 0.08 });

    // Gap shadow
    g.rect(0, y + 4, S, 1);
    g.fill(0x3a2a04);

    // Richer grain: 3-5 fine grain lines per plank
    const grainCount = 3 + Math.floor(rng() * 3);
    for (let gl = 0; gl < grainCount; gl++) {
      const gx = rng() * S;
      const gxEnd = gx + (rng() - 0.5) * 4;
      g.moveTo(gx, y + 0.5);
      g.quadraticCurveTo(
        (gx + gxEnd) / 2 + (rng() - 0.5) * 2,
        y + 2,
        gxEnd,
        y + 3.5
      );
      g.stroke({ width: 0.3, color: darkTone, alpha: 0.25 + rng() * 0.15 });
    }

    // Knot (occasional)
    if (rng() > 0.7) {
      const kx = 4 + rng() * (S - 8);
      const ky = y + 1 + rng() * 2;
      g.circle(kx, ky, 0.8);
      g.fill({ color: 0x5a4010, alpha: 0.4 });
      g.circle(kx, ky, 1.2);
      g.stroke({ width: 0.3, color: 0x4a3008, alpha: 0.25 });
    }
  }

  // Railing posts on edges
  g.rect(1, 0, 3, S);
  g.fill({ color: 0x5c3a1e, alpha: 0.5 });
  g.rect(S - 4, 0, 3, S);
  g.fill({ color: 0x5c3a1e, alpha: 0.5 });

  // More prominent nails with highlight
  for (let y = 2; y < S; y += 10) {
    // Left nail
    g.circle(3, y, 1);
    g.fill(0x555555);
    g.circle(2.7, y - 0.3, 0.4);
    g.fill({ color: 0xaaaaaa, alpha: 0.4 });
    // Right nail
    g.circle(S - 3, y, 1);
    g.fill(0x555555);
    g.circle(S - 3.3, y - 0.3, 0.4);
    g.fill({ color: 0xaaaaaa, alpha: 0.4 });
  }

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// PORTAL — 3 frames (animated, kept as-is)
// ---------------------------------------------------------------------------
function drawPortal(frame: number): Texture {
  const g = new Graphics();

  // Dark base
  g.rect(0, 0, S, S);
  g.fill(0x1a0e30);

  // Large central glow
  g.circle(S / 2, S / 2, 10);
  g.fill({ color: 0x9b59b6, alpha: 0.2 });
  g.circle(S / 2, S / 2, 6);
  g.fill({ color: 0xc39bd3, alpha: 0.3 });
  g.circle(S / 2, S / 2, 3);
  g.fill({ color: 0xffffff, alpha: 0.5 });

  // Orbiting sparkles (6 particles)
  const angle = (frame * 50 * Math.PI) / 180;
  for (let i = 0; i < 6; i++) {
    const a = angle + (i * Math.PI * 2) / 6;
    const r = 8 + Math.sin(a * 2 + frame) * 2;
    const px = S / 2 + Math.cos(a) * r;
    const py = S / 2 + Math.sin(a) * r;
    if (px > 1 && px < S - 1 && py > 1 && py < S - 1) {
      g.circle(px, py, 1.5);
      g.fill({ color: 0xeeccff, alpha: 0.6 });
      g.circle(px, py, 3);
      g.fill({ color: 0x9b59b6, alpha: 0.15 });
    }
  }

  // Swirl arcs
  for (let i = 0; i < 3; i++) {
    const sa = angle + (i * Math.PI * 2) / 3;
    const sx = S / 2 + Math.cos(sa) * 6;
    const sy = S / 2 + Math.sin(sa) * 6;
    g.circle(sx, sy, 2);
    g.fill({ color: 0xc39bd3, alpha: 0.4 });
  }

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// DUNGEON PORTAL — 3 frames (animated, kept as-is)
// ---------------------------------------------------------------------------
function drawDungeonPortal(frame: number): Texture {
  const g = new Graphics();

  g.rect(0, 0, S, S);
  g.fill(0x2e0e0e);

  // Large red glow
  g.circle(S / 2, S / 2, 10);
  g.fill({ color: 0xe74c3c, alpha: 0.2 });
  g.circle(S / 2, S / 2, 6);
  g.fill({ color: 0xff6b6b, alpha: 0.3 });
  g.circle(S / 2, S / 2, 3);
  g.fill({ color: 0xffcccc, alpha: 0.5 });

  const angle = (frame * 50 * Math.PI) / 180;
  for (let i = 0; i < 6; i++) {
    const a = angle + (i * Math.PI * 2) / 6;
    const r = 8 + Math.sin(a * 2 + frame) * 2;
    const px = S / 2 + Math.cos(a) * r;
    const py = S / 2 + Math.sin(a) * r;
    if (px > 1 && px < S - 1 && py > 1 && py < S - 1) {
      g.circle(px, py, 1.5);
      g.fill({ color: 0xffaaaa, alpha: 0.6 });
      g.circle(px, py, 3);
      g.fill({ color: 0xe74c3c, alpha: 0.15 });
    }
  }

  for (let i = 0; i < 3; i++) {
    const sa = angle + (i * Math.PI * 2) / 3;
    const sx = S / 2 + Math.cos(sa) * 6;
    const sy = S / 2 + Math.sin(sa) * 6;
    g.circle(sx, sy, 2);
    g.fill({ color: 0xff6b6b, alpha: 0.4 });
  }

  return TextureFactory.generate(g, S, S);
}

// ---------------------------------------------------------------------------
// FENCE — 2 variants
// ---------------------------------------------------------------------------
function drawFence(variant: number): Texture {
  const g = new Graphics();
  const rng = seededRandom(variant * 6143);

  // Grass-colored background (same as grass tile base)
  g.rect(0, 0, S, S);
  g.fill(0x4a7c59);

  // A few subtle grass mottles on background
  for (let i = 0; i < 4; i++) {
    g.ellipse(rng() * S, rng() * S, 2 + rng() * 2, 2 + rng() * 2);
    g.fill({ color: rng() > 0.5 ? 0x3d6b4a : 0x5a8c69, alpha: 0.15 });
  }

  const postColor = 0x6b4226;
  const railColor = 0x8b6914;
  const postX1 = 4;
  const postX2 = 26;

  // Three horizontal rails at y=4, y=16, y=28
  const railYs = [4, 16, 28];
  for (const ry of railYs) {
    // Rail body connecting posts
    g.rect(postX1 + 2, ry, postX2 - postX1 - 2, 1);
    g.fill(railColor);
    // Highlight on top of rail
    g.rect(postX1 + 2, ry, postX2 - postX1 - 2, 0.5);
    g.fill({ color: 0xffffff, alpha: 0.08 });
    // Shadow below rail
    g.rect(postX1 + 2, ry + 1, postX2 - postX1 - 2, 0.3);
    g.fill({ color: 0x000000, alpha: 0.1 });
  }

  // Two vertical posts
  for (const px of [postX1, postX2]) {
    // Post body (2x8 roundRect, centered vertically-ish)
    g.roundRect(px, 2, 2, 28, 0.5);
    g.fill(postColor);

    // Bark detail lines on posts
    for (let d = 0; d < 3; d++) {
      const dy = 4 + d * 8 + rng() * 4;
      g.moveTo(px + 0.5, dy);
      g.lineTo(px + 0.5, dy + 2);
      g.stroke({ width: 0.3, color: 0x4a2e14, alpha: 0.4 });
    }

    // Light edge highlight
    g.rect(px, 2, 0.5, 28);
    g.fill({ color: 0xffffff, alpha: 0.06 });

    // Rounded cap on post top (semicircle, radius 1.5px)
    g.circle(px + 1, 2, 1.5);
    g.fill(postColor);
    // Cap highlight
    g.circle(px + 0.7, 1.5, 0.6);
    g.fill({ color: 0xffffff, alpha: 0.1 });
  }

  return TextureFactory.generate(g, S, S);
}

// === Public API ===

export type TileTextureSet = {
  variants: Texture[];
  frames?: Texture[][];
};

const tileSets = new Map<TileType, TileTextureSet>();

export function generateTileTextures(): void {
  const staticTiles: [TileType, (v: number) => Texture, number][] = [
    [TileType.GRASS, drawGrass, 6],
    [TileType.DIRT, drawDirt, 3],
    [TileType.COBBLESTONE, drawCobblestone, 3],
    [TileType.SAND, drawSand, 5],
    [TileType.FOREST, drawForest, 6],
    [TileType.MOUNTAIN, drawMountain, 3],
    [TileType.BRIDGE, drawBridge, 2],
    [TileType.BUILDING_FLOOR, drawBuildingFloor, 3],
    [TileType.FENCE, drawFence, 2],
  ];

  for (const [type, drawFn, count] of staticTiles) {
    const variants: Texture[] = [];
    for (let v = 0; v < count; v++) {
      variants.push(drawFn(v));
    }
    tileSets.set(type, { variants });
  }

  const animatedTiles: [TileType, (frame: number) => Texture][] = [
    [TileType.WATER, drawWater],
    [TileType.PORTAL, drawPortal],
    [TileType.DUNGEON_PORTAL, drawDungeonPortal],
  ];

  for (const [type, drawFn] of animatedTiles) {
    const frames: Texture[][] = [];
    for (let f = 0; f < 3; f++) {
      frames.push([drawFn(f)]);
    }
    tileSets.set(type, { variants: frames[0], frames });
  }
}

export function getTileTextureSet(type: TileType): TileTextureSet | undefined {
  return tileSets.get(type);
}

export function tileVariantHash(x: number, y: number): number {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}
