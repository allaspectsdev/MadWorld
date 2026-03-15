import { Graphics, type Application } from "pixi.js";

const CYCLE_DURATION = 24 * 60; // 24 minutes in seconds

export class DayNightOverlay {
  private overlay: Graphics;
  private timer = 0;

  constructor(app: Application) {
    this.overlay = new Graphics();
    this.overlay.eventMode = "none";
    this.overlay.rect(0, 0, 4000, 4000);
    this.overlay.fill(0x000044);
    this.overlay.alpha = 0;
    app.stage.addChild(this.overlay);
  }

  update(dt: number): void {
    this.timer = (this.timer + dt) % CYCLE_DURATION;
    const minuteInCycle = this.timer / 60; // 0-24

    let color = 0x000044;
    let alpha = 0;

    if (minuteInCycle < 3) {
      // Dawn: warm orange fading out
      color = 0xffa500;
      alpha = 0.08 * (1 - minuteInCycle / 3);
    } else if (minuteInCycle < 12) {
      // Day: no tint
      alpha = 0;
    } else if (minuteInCycle < 15) {
      // Dusk: orange-pink fading in
      color = 0xff6347;
      alpha = 0.1 * ((minuteInCycle - 12) / 3);
    } else {
      // Night: cool blue
      color = 0x000044;
      const nightProgress = (minuteInCycle - 15) / 9; // 0 to 1
      alpha = 0.1 + Math.sin(nightProgress * Math.PI) * 0.04;
    }

    this.overlay.tint = color;
    this.overlay.alpha = alpha;
  }
}
