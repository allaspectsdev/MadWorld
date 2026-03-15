import type { Camera } from "../renderer/Camera.js";

const TAP_MAX_DURATION = 300;
const TAP_MAX_DISTANCE = 10;
const LONG_PRESS_DURATION = 500;

interface PendingTouch {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
}

export class TouchInput {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private pending = new Map<number, PendingTouch>();

  onTap: ((worldX: number, worldY: number, screenX: number, screenY: number) => void) | null = null;
  onLongPress: ((worldX: number, worldY: number, screenX: number, screenY: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.camera = camera;

    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", this.onTouchCancel, { passive: false });
  }

  private onTouchStart = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pending: PendingTouch = {
        id: touch.identifier,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        longPressTimer: null,
      };

      // Long-press timer
      pending.longPressTimer = setTimeout(() => {
        pending.longPressTimer = null;
        const worldPos = this.camera.screenToWorld(pending.startX, pending.startY);
        if (navigator.vibrate) navigator.vibrate(50);
        this.onLongPress?.(worldPos.x, worldPos.y, pending.startX, pending.startY);
        this.pending.delete(pending.id);
      }, LONG_PRESS_DURATION);

      this.pending.set(touch.identifier, pending);
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pending = this.pending.get(touch.identifier);
      if (!pending) continue;

      const dx = touch.clientX - pending.startX;
      const dy = touch.clientY - pending.startY;
      if (Math.sqrt(dx * dx + dy * dy) > TAP_MAX_DISTANCE) {
        // Moved too far — cancel tap and long-press
        if (pending.longPressTimer) {
          clearTimeout(pending.longPressTimer);
          pending.longPressTimer = null;
        }
        this.pending.delete(touch.identifier);
      }
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pending = this.pending.get(touch.identifier);
      if (!pending) continue;

      // Cancel long-press
      if (pending.longPressTimer) {
        clearTimeout(pending.longPressTimer);
        pending.longPressTimer = null;
      }

      const elapsed = Date.now() - pending.startTime;
      if (elapsed < TAP_MAX_DURATION) {
        const worldPos = this.camera.screenToWorld(touch.clientX, touch.clientY);
        this.onTap?.(worldPos.x, worldPos.y, touch.clientX, touch.clientY);
      }

      this.pending.delete(touch.identifier);
    }
  };

  private onTouchCancel = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const pending = this.pending.get(e.changedTouches[i].identifier);
      if (pending?.longPressTimer) clearTimeout(pending.longPressTimer);
      this.pending.delete(e.changedTouches[i].identifier);
    }
  };

  destroy(): void {
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.onTouchCancel);
    for (const p of this.pending.values()) {
      if (p.longPressTimer) clearTimeout(p.longPressTimer);
    }
    this.pending.clear();
  }
}
