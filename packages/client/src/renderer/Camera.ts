import { Container } from "pixi.js";
import { TILE_SIZE } from "@madworld/shared";

export class Camera {
  readonly container = new Container();
  private targetX = 0;
  private targetY = 0;
  private screenWidth = 0;
  private screenHeight = 0;
  private lerp = 0.15;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  setTarget(worldX: number, worldY: number): void {
    this.targetX = worldX * TILE_SIZE;
    this.targetY = worldY * TILE_SIZE;
  }

  update(): void {
    const desiredX = -this.targetX + this.screenWidth / 2;
    const desiredY = -this.targetY + this.screenHeight / 2;

    this.container.x += (desiredX - this.container.x) * this.lerp;
    this.container.y += (desiredY - this.container.y) * this.lerp;
  }

  /** Get world position from screen position */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.container.x) / TILE_SIZE,
      y: (screenY - this.container.y) / TILE_SIZE,
    };
  }
}
