import type { Texture } from "pixi.js";

export interface AnimationDef {
  name: string;
  frames: Texture[];
  frameDuration: number;
  loop: boolean;
}

export class SpriteAnimator {
  private anims = new Map<string, AnimationDef>();
  private current: AnimationDef | null = null;
  private frameIndex = 0;
  private elapsed = 0;
  facingLeft = false;

  addAnimation(def: AnimationDef): void {
    this.anims.set(def.name, def);
  }

  play(name: string): void {
    if (this.current?.name === name) return;
    const anim = this.anims.get(name);
    if (!anim) return;
    this.current = anim;
    this.frameIndex = 0;
    this.elapsed = 0;
  }

  update(dt: number): Texture | null {
    if (!this.current || this.current.frames.length === 0) return null;

    this.elapsed += dt;

    while (this.elapsed >= this.current.frameDuration) {
      this.elapsed -= this.current.frameDuration;
      this.frameIndex++;

      if (this.frameIndex >= this.current.frames.length) {
        if (this.current.loop) {
          this.frameIndex = 0;
        } else {
          this.frameIndex = this.current.frames.length - 1;
          break;
        }
      }
    }

    return this.current.frames[this.frameIndex] ?? null;
  }

  isPlaying(name: string): boolean {
    return this.current?.name === name;
  }

  getCurrentAnimName(): string | null {
    return this.current?.name ?? null;
  }
}
