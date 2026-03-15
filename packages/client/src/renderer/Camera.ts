import { Container } from "pixi.js";
import { TILE_SIZE } from "@madworld/shared";

export class Camera {
  readonly container = new Container();
  private targetX = 0;
  private targetY = 0;
  private screenWidth = 0;
  private screenHeight = 0;
  private lerp = 0.15;
  private _zoom = 1;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  setTarget(worldX: number, worldY: number): void {
    this.targetX = worldX * TILE_SIZE;
    this.targetY = worldY * TILE_SIZE;
  }

  setZoom(z: number): void {
    this._zoom = Math.max(0.75, Math.min(2.5, z));
  }

  get zoom(): number {
    return this._zoom;
  }

  update(): void {
    this.container.scale.set(this._zoom);
    const desiredX = -this.targetX * this._zoom + this.screenWidth / 2;
    const desiredY = -this.targetY * this._zoom + this.screenHeight / 2;

    this.container.x += (desiredX - this.container.x) * this.lerp;
    this.container.y += (desiredY - this.container.y) * this.lerp;
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
