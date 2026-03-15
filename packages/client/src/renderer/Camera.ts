import { Container } from "pixi.js";
import { TILE_SIZE } from "@madworld/shared";

export class Camera {
  readonly container = new Container();
  private targetX = 0;
  private targetY = 0;
  private screenWidth = 800;
  private screenHeight = 600;
  private _zoom = 1;
  private _targetZoom = 1;
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;
  private firstUpdate = true;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  setTarget(worldX: number, worldY: number): void {
    this.targetX = worldX * TILE_SIZE;
    this.targetY = worldY * TILE_SIZE;
  }

  setZoom(z: number): void {
    this._targetZoom = Math.max(0.75, Math.min(2.5, z));
  }

  get zoom(): number {
    return this._zoom;
  }

  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = 0;
  }

  update(dt = 0.016): void {
    // Smooth zoom lerp
    if (Math.abs(this._zoom - this._targetZoom) > 0.001) {
      this._zoom += (this._targetZoom - this._zoom) * Math.min(1, dt * 8);
    } else {
      this._zoom = this._targetZoom;
    }

    this.container.scale.set(this._zoom);

    // Center the target on screen
    // container.x positions the scaled container. To put targetX at screen center:
    // screenCenter = container.x + targetX * zoom
    // container.x = screenCenter - targetX * zoom
    const desiredX = this.screenWidth / 2 - this.targetX * this._zoom;
    const desiredY = this.screenHeight / 2 - this.targetY * this._zoom;

    // Snap on first update, then smooth lerp
    if (this.firstUpdate) {
      this.container.x = desiredX;
      this.container.y = desiredY;
      this.firstUpdate = false;
    } else {
      const lerpFactor = 1 - Math.pow(0.001, dt);
      this.container.x += (desiredX - this.container.x) * lerpFactor;
      this.container.y += (desiredY - this.container.y) * lerpFactor;
    }

    // Screen shake
    if (this.shakeTimer < this.shakeDuration) {
      this.shakeTimer += dt;
      const fade = 1 - this.shakeTimer / this.shakeDuration;
      this.container.x += (Math.random() - 0.5) * this.shakeIntensity * fade * 2;
      this.container.y += (Math.random() - 0.5) * this.shakeIntensity * fade * 2;
    }
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.container.x) / (TILE_SIZE * this._zoom),
      y: (screenY - this.container.y) / (TILE_SIZE * this._zoom),
    };
  }

  getViewBounds(): { left: number; top: number; right: number; bottom: number } {
    const left = -this.container.x / (TILE_SIZE * this._zoom);
    const top = -this.container.y / (TILE_SIZE * this._zoom);
    const right = left + this.screenWidth / (TILE_SIZE * this._zoom);
    const bottom = top + this.screenHeight / (TILE_SIZE * this._zoom);
    return { left, top, right, bottom };
  }
}
