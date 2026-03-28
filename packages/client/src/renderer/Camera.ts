import { Container } from "pixi.js";
import { cartToIso, isoToCart, ISO_HALF_W, ISO_HALF_H } from "@madworld/shared";

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
  private leadX = 0;
  private leadY = 0;
  private currentLeadX = 0;
  private currentLeadY = 0;

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  /** Set camera target using cartesian world-tile coordinates. */
  setTarget(worldX: number, worldY: number): void {
    const iso = cartToIso(worldX, worldY);
    this.targetX = iso.x;
    this.targetY = iso.y;
  }

  setZoom(z: number): void {
    this._targetZoom = Math.max(0.5, Math.min(2.5, z));
  }

  get zoom(): number {
    return this._zoom;
  }

  /** Movement lead — direction is still cartesian, but we convert to iso. */
  setMovementLead(dx: number, dy: number): void {
    const lead = cartToIso(dx * 1.5, dy * 1.5);
    this.leadX = lead.x;
    this.leadY = lead.y;
  }

  shake(intensity: number, duration: number): void {
    const remaining = this.shakeDuration - this.shakeTimer;
    const currentPower = this.shakeIntensity * Math.max(0, remaining);
    if (intensity * duration >= currentPower) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
      this.shakeTimer = 0;
    }
  }

  update(dt = 0.016): void {
    // Smooth zoom lerp
    if (Math.abs(this._zoom - this._targetZoom) > 0.001) {
      this._zoom += (this._targetZoom - this._zoom) * Math.min(1, dt * 8);
    } else {
      this._zoom = this._targetZoom;
    }

    this.container.scale.set(this._zoom);

    // Smoothly lerp the movement lead
    const leadLerp = 1 - Math.pow(0.001, dt);
    this.currentLeadX += (this.leadX - this.currentLeadX) * leadLerp;
    this.currentLeadY += (this.leadY - this.currentLeadY) * leadLerp;

    // Center the target on screen, offset by movement lead
    const targetWithLeadX = this.targetX + this.currentLeadX;
    const targetWithLeadY = this.targetY + this.currentLeadY;
    const desiredX = this.screenWidth / 2 - targetWithLeadX * this._zoom;
    const desiredY = this.screenHeight / 2 - targetWithLeadY * this._zoom;

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

  /**
   * Convert screen pixel coordinates to cartesian world-tile coordinates.
   * This is the inverse of the full projection pipeline:
   *   screen → iso-pixel (undo camera pan+zoom) → cartesian (isoToCart)
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    // Undo camera pan and zoom to get iso-pixel space
    const isoX = (screenX - this.container.x) / this._zoom;
    const isoY = (screenY - this.container.y) / this._zoom;
    return isoToCart(isoX, isoY);
  }

  /**
   * Return the iso-pixel viewport bounds (before camera transform).
   * Useful for culling — callers convert these to cartesian tile bounds
   * using isoViewBounds().
   */
  getViewBounds(): { left: number; top: number; right: number; bottom: number } {
    const left = -this.container.x / this._zoom;
    const top = -this.container.y / this._zoom;
    const right = left + this.screenWidth / this._zoom;
    const bottom = top + this.screenHeight / this._zoom;
    return { left, top, right, bottom };
  }

  /**
   * Convert a cartesian world position to the camera's current screen position.
   * Useful for lighting and UI overlays that need screen-space coordinates.
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const iso = cartToIso(worldX, worldY);
    return {
      x: iso.x * this._zoom + this.container.x,
      y: iso.y * this._zoom + this.container.y,
    };
  }

  /** Expose the camera's current iso-pixel center position (for lighting). */
  get worldCenterX(): number {
    return -this.container.x / this._zoom + this.screenWidth / (2 * this._zoom);
  }
  get worldCenterY(): number {
    return -this.container.y / this._zoom + this.screenHeight / (2 * this._zoom);
  }
}
