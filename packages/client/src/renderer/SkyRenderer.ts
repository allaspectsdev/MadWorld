import { Container, Graphics } from "pixi.js";

interface StarDef {
  x: number;
  y: number;
  alpha: number;
  freq: number;
}

interface CloudDef {
  x: number;
  y: number;
  rx: number;
  ry: number;
  speed: number;
}

export class SkyRenderer {
  readonly container = new Container();
  private skyGfx = new Graphics();
  private screenW = 1920;
  private screenH = 1080;
  private stars: StarDef[] = [];
  private clouds: CloudDef[] = [];
  private timer = 0;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.container.addChild(this.skyGfx);

    // Generate stars
    for (let i = 0; i < 35; i++) {
      this.stars.push({
        x: Math.random() * screenW,
        y: Math.random() * screenH * 0.6,
        alpha: 0.3 + Math.random() * 0.4,
        freq: 0.5 + Math.random() * 2,
      });
    }

    // Generate clouds
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: Math.random() * screenW * 1.5,
        y: 30 + Math.random() * screenH * 0.4,
        rx: 40 + Math.random() * 60,
        ry: 15 + Math.random() * 20,
        speed: 8 + Math.random() * 12,
      });
    }
  }

  resize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
  }

  update(dt: number, timeOfDay: number, camX: number, camY: number): void {
    this.timer += dt;
    const g = this.skyGfx;
    g.clear();

    const w = this.screenW;
    const h = this.screenH;

    // Determine sky colors based on time of day (0-24 minute cycle)
    let topColor: number, bottomColor: number, cloudTint: number;
    let isNight = false;

    if (timeOfDay < 3) {
      // Dawn
      const t = timeOfDay / 3;
      topColor = this.lerpColor(0x1a0a3a, 0x4488cc, t);
      bottomColor = this.lerpColor(0xff8844, 0xaaccee, t);
      cloudTint = 0xffccaa;
    } else if (timeOfDay < 12) {
      // Day
      topColor = 0x4488cc;
      bottomColor = 0xaaccee;
      cloudTint = 0xffffff;
    } else if (timeOfDay < 15) {
      // Dusk
      const t = (timeOfDay - 12) / 3;
      topColor = this.lerpColor(0x4488cc, 0x2a1a4a, t);
      bottomColor = this.lerpColor(0xaaccee, 0xff6644, t);
      cloudTint = this.lerpColor(0xffffff, 0xffaa88, t);
    } else {
      // Night
      isNight = true;
      topColor = 0x0a0a2a;
      bottomColor = 0x1a1a3a;
      cloudTint = 0x334466;
    }

    // Draw sky gradient (3 bands for smooth transition)
    const bandH = Math.ceil(h / 3);
    const midColor = this.lerpColor(topColor, bottomColor, 0.5);
    g.rect(0, 0, w, bandH);
    g.fill(topColor);
    g.rect(0, bandH, w, bandH);
    g.fill(midColor);
    g.rect(0, bandH * 2, w, bandH + 2);
    g.fill(bottomColor);

    // Stars (only at night)
    if (isNight) {
      for (const star of this.stars) {
        const twinkle = star.alpha * (0.6 + 0.4 * Math.sin(this.timer * star.freq));
        g.circle(star.x, star.y, 0.8);
        g.fill({ color: 0xffffff, alpha: twinkle });
      }
    }

    // Clouds with parallax
    const parallaxX = camX * 0.3;
    for (const cloud of this.clouds) {
      const cx = ((cloud.x + this.timer * cloud.speed - parallaxX) % (w + cloud.rx * 4)) - cloud.rx * 2;
      // Main cloud body (3 overlapping ellipses)
      g.ellipse(cx, cloud.y, cloud.rx, cloud.ry);
      g.fill({ color: cloudTint, alpha: 0.25 });
      g.ellipse(cx - cloud.rx * 0.4, cloud.y + cloud.ry * 0.2, cloud.rx * 0.7, cloud.ry * 0.8);
      g.fill({ color: cloudTint, alpha: 0.2 });
      g.ellipse(cx + cloud.rx * 0.3, cloud.y - cloud.ry * 0.1, cloud.rx * 0.6, cloud.ry * 0.7);
      g.fill({ color: cloudTint, alpha: 0.2 });
    }

    // Distant hill silhouette along bottom (parallax at 0.5x)
    const hillParallax = camX * 0.15;
    const hillBase = h * 0.85;
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) {
      const hillY = hillBase + Math.sin((x + hillParallax) * 0.008) * 25 + Math.sin((x + hillParallax) * 0.003) * 40;
      g.lineTo(x, hillY);
    }
    g.lineTo(w, h);
    g.closePath();
    const hillColor = isNight ? 0x0a0a15 : this.lerpColor(0x2a5a2a, 0x1a3a1a, isNight ? 1 : 0);
    g.fill({ color: hillColor, alpha: 0.6 });
  }

  private lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const gv = Math.round(ag + (bg - ag) * t);
    const bv = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (gv << 8) | bv;
  }
}
