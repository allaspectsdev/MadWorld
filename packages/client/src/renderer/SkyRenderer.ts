import { Container, Graphics } from "pixi.js";

interface StarDef {
  x: number;
  y: number;
  alpha: number;
  freq: number;
  size: number;
}

interface CloudDef {
  x: number;
  y: number;
  rx: number;
  ry: number;
  speed: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
}

export class SkyRenderer {
  readonly container = new Container();
  private skyGfx = new Graphics();
  private screenW = 1920;
  private screenH = 1080;
  private stars: StarDef[] = [];
  private clouds: CloudDef[] = [];
  private shootingStars: ShootingStar[] = [];
  private timer = 0;
  private shootingStarTimer = 0;

  constructor(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
    this.container.addChild(this.skyGfx);

    // Generate stars with varying sizes
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * screenW,
        y: Math.random() * screenH * 0.6,
        alpha: 0.3 + Math.random() * 0.5,
        freq: 0.5 + Math.random() * 2.5,
        size: 0.4 + Math.random() * 1.0,
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
    let isDawn = false;
    let isDusk = false;
    let nightAmount = 0; // 0 = full day, 1 = full night

    if (timeOfDay < 3) {
      // Dawn
      isDawn = true;
      const t = timeOfDay / 3;
      nightAmount = 1 - t;
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
      isDusk = true;
      const t = (timeOfDay - 12) / 3;
      nightAmount = t;
      topColor = this.lerpColor(0x4488cc, 0x2a1a4a, t);
      bottomColor = this.lerpColor(0xaaccee, 0xff6644, t);
      cloudTint = this.lerpColor(0xffffff, 0xffaa88, t);
    } else {
      // Night
      isNight = true;
      nightAmount = 1;
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

    // Sun (during dawn, day, and dusk)
    if (!isNight) {
      const sunProgress = timeOfDay / 15; // 0 at dawn, 1 at end of dusk
      const sunX = w * 0.1 + sunProgress * w * 0.8;
      const sunArc = Math.sin(sunProgress * Math.PI);
      const sunY = h * 0.6 - sunArc * h * 0.45;
      const sunRadius = 18 + sunArc * 4;

      // Sun glow (outer halo)
      g.circle(sunX, sunY, sunRadius * 4);
      g.fill({ color: 0xffdd66, alpha: 0.04 });
      g.circle(sunX, sunY, sunRadius * 2.5);
      g.fill({ color: 0xffdd88, alpha: 0.08 });
      g.circle(sunX, sunY, sunRadius * 1.5);
      g.fill({ color: 0xffeeaa, alpha: 0.15 });

      // Sun body
      g.circle(sunX, sunY, sunRadius);
      g.fill(isDawn || isDusk ? 0xffaa44 : 0xffeecc);
      g.circle(sunX, sunY, sunRadius * 0.7);
      g.fill({ color: 0xffffff, alpha: 0.4 });

      // Sun rays (subtle rotating lines)
      if (sunArc > 0.2) {
        const rayCount = 8;
        for (let i = 0; i < rayCount; i++) {
          const angle = (i / rayCount) * Math.PI * 2 + this.timer * 0.15;
          const innerR = sunRadius * 1.3;
          const outerR = sunRadius * 2.2 + Math.sin(this.timer * 2 + i) * 4;
          const rayAlpha = 0.06 + Math.sin(this.timer * 1.5 + i * 0.7) * 0.03;
          g.moveTo(sunX + Math.cos(angle) * innerR, sunY + Math.sin(angle) * innerR);
          g.lineTo(sunX + Math.cos(angle) * outerR, sunY + Math.sin(angle) * outerR);
          g.stroke({ width: 2, color: 0xffeeaa, alpha: rayAlpha });
        }
      }
    }

    // Moon (during night and transitions)
    if (nightAmount > 0.3) {
      const moonProgress = isNight ? (timeOfDay - 15) / 9 : isDusk ? 0 : 1;
      const moonX = w * 0.15 + moonProgress * w * 0.7;
      const moonArc = Math.sin(moonProgress * Math.PI);
      const moonY = h * 0.1 + (1 - moonArc) * h * 0.25;
      const moonAlpha = Math.min(1, (nightAmount - 0.3) / 0.3);

      // Moon glow
      g.circle(moonX, moonY, 30);
      g.fill({ color: 0xaabbdd, alpha: 0.05 * moonAlpha });
      g.circle(moonX, moonY, 18);
      g.fill({ color: 0xccddff, alpha: 0.08 * moonAlpha });

      // Moon body (crescent effect using two overlapping circles)
      g.circle(moonX, moonY, 10);
      g.fill({ color: 0xddeeff, alpha: 0.9 * moonAlpha });
      g.circle(moonX, moonY, 8);
      g.fill({ color: 0xeef4ff, alpha: 0.5 * moonAlpha });
      // Shadow to create crescent
      g.circle(moonX + 4, moonY - 2, 8);
      g.fill({ color: topColor, alpha: 0.7 * moonAlpha });
    }

    // Stars (fade in at night, more varied)
    if (nightAmount > 0.2) {
      const starAlpha = Math.min(1, (nightAmount - 0.2) / 0.3);
      for (const star of this.stars) {
        const twinkle = star.alpha * (0.5 + 0.5 * Math.sin(this.timer * star.freq + star.x));
        const brightness = twinkle * starAlpha;
        if (brightness < 0.05) continue;

        // Larger stars get a subtle cross/glow
        if (star.size > 0.8) {
          g.circle(star.x, star.y, star.size * 2);
          g.fill({ color: 0xaaccff, alpha: brightness * 0.15 });
        }
        g.circle(star.x, star.y, star.size);
        g.fill({ color: 0xffffff, alpha: brightness });
      }
    }

    // Shooting stars (at night)
    if (isNight || nightAmount > 0.5) {
      this.shootingStarTimer += dt;
      // Spawn one every 6-14 seconds
      if (this.shootingStarTimer > 6 + Math.random() * 8) {
        this.shootingStarTimer = 0;
        const startX = Math.random() * w * 0.8;
        const startY = Math.random() * h * 0.3;
        const angle = Math.PI * 0.15 + Math.random() * 0.3;
        const speed = 300 + Math.random() * 200;
        this.shootingStars.push({
          x: startX,
          y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 0.4 + Math.random() * 0.3,
          length: 40 + Math.random() * 30,
        });
      }

      for (let i = this.shootingStars.length - 1; i >= 0; i--) {
        const ss = this.shootingStars[i];
        ss.life += dt;
        if (ss.life >= ss.maxLife) {
          this.shootingStars.splice(i, 1);
          continue;
        }
        ss.x += ss.vx * dt;
        ss.y += ss.vy * dt;

        const progress = ss.life / ss.maxLife;
        const fade = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
        const tailX = ss.x - (ss.vx / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.length;
        const tailY = ss.y - (ss.vy / Math.sqrt(ss.vx * ss.vx + ss.vy * ss.vy)) * ss.length;

        // Trail
        g.moveTo(tailX, tailY);
        g.lineTo(ss.x, ss.y);
        g.stroke({ width: 1.5, color: 0xffffff, alpha: fade * 0.6 * nightAmount });

        // Head glow
        g.circle(ss.x, ss.y, 2);
        g.fill({ color: 0xffffff, alpha: fade * 0.9 * nightAmount });
      }
    }

    // Aurora borealis (subtle, at night only)
    if (isNight) {
      const auroraAlpha = 0.025 + Math.sin(this.timer * 0.3) * 0.015;
      for (let band = 0; band < 3; band++) {
        const baseY = h * 0.08 + band * h * 0.06;
        const waveAmplitude = 15 + band * 8;
        const color = band === 0 ? 0x44ff88 : band === 1 ? 0x22ccaa : 0x8844ff;
        g.moveTo(0, baseY + Math.sin(this.timer * 0.4 + band) * waveAmplitude);
        for (let x = 0; x <= w; x += 30) {
          const waveY = baseY + Math.sin((x * 0.004) + this.timer * (0.3 + band * 0.1)) * waveAmplitude;
          const shimmer = Math.sin(x * 0.01 + this.timer * 0.8 + band * 2) * 8;
          g.lineTo(x, waveY + shimmer);
        }
        g.lineTo(w, baseY + h * 0.1);
        g.lineTo(0, baseY + h * 0.1);
        g.closePath();
        g.fill({ color, alpha: auroraAlpha });
      }
    }

    // Clouds with parallax
    const parallaxX = camX * 0.3;
    for (const cloud of this.clouds) {
      const cx = ((cloud.x + this.timer * cloud.speed - parallaxX) % (w + cloud.rx * 4)) - cloud.rx * 2;
      const cloudAlpha = isNight ? 0.12 : 0.25;
      // Main cloud body (3 overlapping ellipses)
      g.ellipse(cx, cloud.y, cloud.rx, cloud.ry);
      g.fill({ color: cloudTint, alpha: cloudAlpha });
      g.ellipse(cx - cloud.rx * 0.4, cloud.y + cloud.ry * 0.2, cloud.rx * 0.7, cloud.ry * 0.8);
      g.fill({ color: cloudTint, alpha: cloudAlpha * 0.8 });
      g.ellipse(cx + cloud.rx * 0.3, cloud.y - cloud.ry * 0.1, cloud.rx * 0.6, cloud.ry * 0.7);
      g.fill({ color: cloudTint, alpha: cloudAlpha * 0.8 });
    }

    // Distant hill silhouette along bottom (parallax at 0.15x)
    const hillParallax = camX * 0.15;
    const hillBase = h * 0.85;

    // Second layer of hills (farther, lighter)
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) {
      const hillY = hillBase - 10 + Math.sin((x + hillParallax * 0.6) * 0.005) * 30 + Math.sin((x + hillParallax * 0.6) * 0.002) * 50;
      g.lineTo(x, hillY);
    }
    g.lineTo(w, h);
    g.closePath();
    const farHillColor = isNight ? 0x0c0c1a : 0x3a6a3a;
    g.fill({ color: farHillColor, alpha: 0.3 });

    // Foreground hills
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) {
      const hillY = hillBase + Math.sin((x + hillParallax) * 0.008) * 25 + Math.sin((x + hillParallax) * 0.003) * 40;
      g.lineTo(x, hillY);
    }
    g.lineTo(w, h);
    g.closePath();
    const hillColor = isNight ? 0x0a0a15 : 0x2a5a2a;
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
