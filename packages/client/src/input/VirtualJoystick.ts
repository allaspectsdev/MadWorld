const BASE_SIZE = 120;
const KNOB_SIZE = 50;
const MAX_RADIUS = BASE_SIZE / 2;
const DEAD_ZONE = 8;

export class VirtualJoystick {
  private zone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private trackingId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private _dx = 0;
  private _dy = 0;

  constructor() {
    this.zone = document.getElementById("joystick-zone")!;
    this.base = document.createElement("div");
    this.base.id = "joystick-base";
    this.knob = document.createElement("div");
    this.knob.id = "joystick-knob";
    this.base.appendChild(this.knob);
    this.zone.appendChild(this.base);
    this.base.style.display = "none";

    this.zone.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.zone.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.zone.addEventListener("touchend", this.onTouchEnd, { passive: false });
    this.zone.addEventListener("touchcancel", this.onTouchEnd, { passive: false });
  }

  getDirection(): { dx: number; dy: number } | null {
    if (this.trackingId === null) return null;
    if (this._dx === 0 && this._dy === 0) return null;
    return { dx: this._dx, dy: this._dy };
  }

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (this.trackingId !== null) return;

    const touch = e.changedTouches[0];
    this.trackingId = touch.identifier;
    this.baseX = touch.clientX;
    this.baseY = touch.clientY;

    this.base.style.display = "block";
    this.base.style.left = `${this.baseX - BASE_SIZE / 2}px`;
    this.base.style.top = `${this.baseY - BASE_SIZE / 2}px`;
    this.knob.style.transform = "translate(0px, 0px)";
    this._dx = 0;
    this._dy = 0;
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (this.trackingId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== this.trackingId) continue;

      const rawDx = touch.clientX - this.baseX;
      const rawDy = touch.clientY - this.baseY;
      const rawDist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);

      if (rawDist < DEAD_ZONE) {
        this._dx = 0;
        this._dy = 0;
        this.knob.style.transform = `translate(${rawDx}px, ${rawDy}px)`;
        return;
      }

      const angle = Math.atan2(rawDy, rawDx);
      const clampedDist = Math.min(rawDist, MAX_RADIUS);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;
      this.knob.style.transform = `translate(${knobX}px, ${knobY}px)`;

      const effectiveDist = (clampedDist - DEAD_ZONE) / (MAX_RADIUS - DEAD_ZONE);
      this._dx = Math.cos(angle) * effectiveDist;
      this._dy = Math.sin(angle) * effectiveDist;
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.trackingId) {
        this.trackingId = null;
        this._dx = 0;
        this._dy = 0;
        this.base.style.display = "none";
        return;
      }
    }
  };

  destroy(): void {
    this.zone.removeEventListener("touchstart", this.onTouchStart);
    this.zone.removeEventListener("touchmove", this.onTouchMove);
    this.zone.removeEventListener("touchend", this.onTouchEnd);
    this.zone.removeEventListener("touchcancel", this.onTouchEnd);
  }
}
