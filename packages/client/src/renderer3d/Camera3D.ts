import * as THREE from "three";
import type { ThreeApp } from "./ThreeApp.js";

/**
 * Isometric camera controller. Handles follow-target, zoom, shake,
 * screen-to-world conversion via raycasting, and view bounds.
 */
export class Camera3D {
  private app: ThreeApp;
  private targetX = 0;
  private targetZ = 0;
  private currentX = 0;
  private currentZ = 0;
  private firstUpdate = true;

  // Zoom
  private _targetZoom = 1;

  // Movement lead (camera looks slightly ahead of movement direction)
  private leadX = 0;
  private leadZ = 0;
  private currentLeadX = 0;
  private currentLeadZ = 0;

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  // Raycasting for screen-to-world
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Isometric direction vector (same as ThreeApp)
  private static readonly ISO_DIR = new THREE.Vector3(1, Math.sqrt(2), 1).normalize();
  private static readonly CAM_DISTANCE = 200;

  constructor(app: ThreeApp) {
    this.app = app;
  }

  /** Set follow target in cartesian world coords (cx, cy -> Three.js x, z) */
  setTarget(worldX: number, worldY: number): void {
    this.targetX = worldX;
    this.targetZ = worldY; // game Y -> Three.js Z
  }

  /** Set camera lead direction (cartesian movement delta) */
  setMovementLead(dx: number, dy: number): void {
    this.leadX = dx * 1.5;
    this.leadZ = dy * 1.5;
  }

  setZoom(z: number): void {
    this._targetZoom = Math.max(0.3, Math.min(3.0, z));
  }

  get zoom(): number {
    return this.app.zoom;
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

  update(dt: number): void {
    // Smooth zoom
    const currentZoom = this.app.zoom;
    if (Math.abs(currentZoom - this._targetZoom) > 0.001) {
      this.app.zoom = currentZoom + (this._targetZoom - currentZoom) * Math.min(1, dt * 8);
    } else {
      this.app.zoom = this._targetZoom;
    }

    // Smooth movement lead
    const leadLerp = 1 - Math.pow(0.001, dt);
    this.currentLeadX += (this.leadX - this.currentLeadX) * leadLerp;
    this.currentLeadZ += (this.leadZ - this.currentLeadZ) * leadLerp;

    const goalX = this.targetX + this.currentLeadX;
    const goalZ = this.targetZ + this.currentLeadZ;

    // Snap on first frame, then smooth lerp
    if (this.firstUpdate) {
      this.currentX = goalX;
      this.currentZ = goalZ;
      this.firstUpdate = false;
    } else {
      const lerpFactor = 1 - Math.pow(0.001, dt);
      this.currentX += (goalX - this.currentX) * lerpFactor;
      this.currentZ += (goalZ - this.currentZ) * lerpFactor;
    }

    // Position camera along isometric direction from current target
    let camX = this.currentX;
    let camZ = this.currentZ;

    // Screen shake
    if (this.shakeTimer < this.shakeDuration) {
      this.shakeTimer += dt;
      const fade = 1 - this.shakeTimer / this.shakeDuration;
      const shakeScale = this.shakeIntensity * fade * 0.05; // scale to world units
      camX += (Math.random() - 0.5) * shakeScale * 2;
      camZ += (Math.random() - 0.5) * shakeScale * 2;
    }

    const d = Camera3D.CAM_DISTANCE;
    const dir = Camera3D.ISO_DIR;
    this.app.camera.position.set(
      camX + dir.x * d,
      dir.y * d,
      camZ + dir.z * d,
    );
    this.app.camera.lookAt(camX, 0, camZ);

    // Move sun shadow to follow player
    this.app.sun.target.position.set(this.currentX, 0, this.currentZ);
    this.app.sun.target.updateMatrixWorld();
  }

  /**
   * Convert screen pixel coordinates to cartesian world-tile coordinates.
   * Uses raycasting against the Y=0 ground plane.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const ndc = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.app.camera);
    const hit = new THREE.Vector3();
    const intersected = this.raycaster.ray.intersectPlane(this.groundPlane, hit);
    if (!intersected) {
      return { x: this.currentX, y: this.currentZ };
    }
    return { x: hit.x, y: hit.z }; // Three.js X,Z -> game cx, cy
  }

  /**
   * Convert world coordinates to screen pixel position.
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const vec = new THREE.Vector3(worldX, 0, worldY);
    vec.project(this.app.camera);
    return {
      x: (vec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-vec.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  /**
   * Get the cartesian tile bounds currently visible in the viewport.
   * Unprojects the four screen corners to the ground plane.
   */
  getViewBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const corners = [
      this.screenToWorld(0, 0),
      this.screenToWorld(window.innerWidth, 0),
      this.screenToWorld(0, window.innerHeight),
      this.screenToWorld(window.innerWidth, window.innerHeight),
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    // Add margin for decorations/entities at tile edges
    const margin = 3;
    return {
      minX: minX - margin,
      minY: minY - margin,
      maxX: maxX + margin,
      maxY: maxY + margin,
    };
  }

  /** Current camera focus position in world coords */
  get worldCenterX(): number {
    return this.currentX;
  }
  get worldCenterY(): number {
    return this.currentZ;
  }
}
