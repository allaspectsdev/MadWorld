import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { TextureFactory } from "./TextureFactory.js";

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
  fadeOut: boolean;
  scaleDecay: number;
  active: boolean;
  rotation: number;
  angularVel: number;
  startScale: number;
}

let circleTexture: Texture | null = null;
let glowTexture: Texture | null = null;
let starTexture: Texture | null = null;
let trailTexture: Texture | null = null;
let sparkTexture: Texture | null = null;
let diamondTexture: Texture | null = null;

function ensureTextures(): void {
  if (circleTexture) return;

  // Small white circle
  const g1 = new Graphics();
  g1.circle(2, 2, 2);
  g1.fill(0xffffff);
  circleTexture = TextureFactory.generate(g1, 4, 4);

  // Soft glow
  const g2 = new Graphics();
  g2.circle(4, 4, 4);
  g2.fill({ color: 0xffffff, alpha: 0.6 });
  g2.circle(4, 4, 2);
  g2.fill({ color: 0xffffff, alpha: 0.9 });
  glowTexture = TextureFactory.generate(g2, 8, 8);

  // Star
  const g3 = new Graphics();
  g3.star(3, 3, 4, 3, 1.5);
  g3.fill(0xffffff);
  starTexture = TextureFactory.generate(g3, 6, 6);

  // Trail (elongated)
  const g4 = new Graphics();
  g4.ellipse(6, 2, 6, 2);
  g4.fill({ color: 0xffffff, alpha: 0.7 });
  trailTexture = TextureFactory.generate(g4, 12, 4);

  // Spark (small bright diamond shape)
  const g5 = new Graphics();
  g5.moveTo(3, 0);
  g5.lineTo(6, 3);
  g5.lineTo(3, 6);
  g5.lineTo(0, 3);
  g5.closePath();
  g5.fill(0xffffff);
  sparkTexture = TextureFactory.generate(g5, 6, 6);

  // Diamond (larger, for pickup effects)
  const g6 = new Graphics();
  g6.moveTo(4, 0);
  g6.lineTo(8, 4);
  g6.lineTo(4, 8);
  g6.lineTo(0, 4);
  g6.closePath();
  g6.fill(0xffffff);
  g6.moveTo(4, 1);
  g6.lineTo(7, 4);
  g6.lineTo(4, 7);
  g6.lineTo(1, 4);
  g6.closePath();
  g6.fill({ color: 0xffffff, alpha: 0.6 });
  diamondTexture = TextureFactory.generate(g6, 8, 8);
}

export type ParticleTexType = "circle" | "glow" | "star" | "trail" | "spark" | "diamond";

function getParticleTex(type: ParticleTexType): Texture {
  ensureTextures();
  switch (type) {
    case "circle": return circleTexture!;
    case "glow": return glowTexture!;
    case "star": return starTexture!;
    case "trail": return trailTexture!;
    case "spark": return sparkTexture!;
    case "diamond": return diamondTexture!;
  }
}

const POOL_SIZE = 600;

export class ParticleSystem {
  readonly container = new Container();
  private pool: Particle[] = [];

  constructor() {
    // Pre-allocate pool once textures exist (call after TextureFactory.init)
  }

  init(): void {
    ensureTextures();
    for (let i = 0; i < POOL_SIZE; i++) {
      const sprite = new Sprite(circleTexture!);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.container.addChild(sprite);
      this.pool.push({
        sprite, vx: 0, vy: 0, life: 0, maxLife: 0,
        gravity: 0, fadeOut: true, scaleDecay: 0, active: false,
        rotation: 0, angularVel: 0, startScale: 1,
      });
    }
  }

  emit(
    x: number, y: number,
    count: number,
    config: {
      texType?: ParticleTexType;
      tint?: number;
      speed?: number;
      spread?: number;
      life?: number;
      gravity?: number;
      scaleDecay?: number;
      dirX?: number;
      dirY?: number;
      baseScale?: number;
      spin?: number;
    },
  ): void {
    const {
      texType = "circle",
      tint = 0xffffff,
      speed = 50,
      spread = Math.PI * 2,
      life = 0.5,
      gravity = 0,
      scaleDecay = 0,
      dirX = 0,
      dirY = -1,
      baseScale = 1,
      spin = 0,
    } = config;

    const baseAngle = Math.atan2(dirY, dirX);

    for (let i = 0; i < count; i++) {
      const p = this.getInactive();
      if (!p) break;

      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const spd = speed * (0.5 + Math.random() * 0.5);

      p.sprite.texture = getParticleTex(texType);
      p.sprite.tint = tint;
      p.sprite.x = x;
      p.sprite.y = y;
      p.sprite.scale.set(baseScale);
      p.sprite.alpha = 1;
      p.sprite.visible = true;
      p.sprite.rotation = 0;

      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = 0;
      p.maxLife = life * (0.8 + Math.random() * 0.4);
      p.gravity = gravity;
      p.fadeOut = true;
      p.scaleDecay = scaleDecay;
      p.active = true;
      p.rotation = 0;
      p.angularVel = spin > 0 ? (Math.random() - 0.5) * spin : 0;
      p.startScale = baseScale;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }

      p.vy += p.gravity * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;

      // Rotation
      if (p.angularVel !== 0) {
        p.rotation += p.angularVel * dt;
        p.sprite.rotation = p.rotation;
      }

      const t = p.life / p.maxLife;
      if (p.fadeOut) p.sprite.alpha = 1 - t;
      if (p.scaleDecay > 0) {
        const s = Math.max(0, p.startScale * (1 - t * p.scaleDecay));
        p.sprite.scale.set(s);
      }
    }
  }

  private getInactive(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) return p;
    }
    return null;
  }
}
