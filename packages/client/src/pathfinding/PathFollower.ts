export interface PendingAction {
  type: "attack" | "pickup" | "interact";
  targetEid: number;
}

export class PathFollower {
  private path: { x: number; y: number }[] = [];
  private currentIndex = 0;
  private _active = false;
  private _pendingAction: PendingAction | null = null;
  private arrivalThreshold = 0.3; // tiles

  /** Set a new path to follow. Cancels any previous path. */
  setPath(path: { x: number; y: number }[], action?: PendingAction): void {
    this.path = path;
    this.currentIndex = 0;
    this._active = path.length > 0;
    this._pendingAction = action ?? null;
  }

  /** Get the movement direction toward the current waypoint. Returns null if arrived or inactive. */
  getDirection(playerX: number, playerY: number): { dx: number; dy: number } | null {
    if (!this._active || this.currentIndex >= this.path.length) {
      this._active = false;
      return null;
    }

    const target = this.path[this.currentIndex];
    let dx = target.x - playerX;
    let dy = target.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.arrivalThreshold) {
      this.currentIndex++;
      if (this.currentIndex >= this.path.length) {
        this._active = false;
        return null;
      }
      // Recalculate for next waypoint
      const next = this.path[this.currentIndex];
      dx = next.x - playerX;
      dy = next.y - playerY;
      const nextDist = Math.sqrt(dx * dx + dy * dy);
      if (nextDist < 0.01) return null;
      return { dx: dx / nextDist, dy: dy / nextDist };
    }

    // Normalize
    return { dx: dx / dist, dy: dy / dist };
  }

  /** Stop following the current path. */
  cancel(): void {
    this._active = false;
    this.path = [];
    this.currentIndex = 0;
    this._pendingAction = null;
  }

  isActive(): boolean {
    return this._active;
  }

  /** Get the pending action to execute on arrival. Clears it after retrieval. */
  getPendingAction(): PendingAction | null {
    const action = this._pendingAction;
    this._pendingAction = null;
    return action;
  }

  /** Get destination point for visual indicator. */
  getDestination(): { x: number; y: number } | null {
    if (!this._active || this.path.length === 0) return null;
    return this.path[this.path.length - 1];
  }
}
