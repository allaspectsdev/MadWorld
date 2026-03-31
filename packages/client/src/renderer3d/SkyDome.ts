import * as THREE from "three";

interface StarDef {
  position: THREE.Vector3;
  baseAlpha: number;
  freq: number;
  size: number;
}

interface CloudDef {
  mesh: THREE.Sprite;
  baseX: number;
  y: number;
  speed: number;
  scale: number;
}

interface ShootingStar {
  mesh: THREE.Line;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uMidColor;
  uniform vec3 uBottomColor;
  varying vec3 vWorldPosition;

  void main() {
    float h = normalize(vWorldPosition).y;
    vec3 color;
    if (h > 0.0) {
      color = mix(uMidColor, uTopColor, clamp(h * 2.0, 0.0, 1.0));
    } else {
      color = mix(uMidColor, uBottomColor, clamp(-h * 4.0, 0.0, 1.0));
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

function lerpColor(a: number, b: number, t: number): THREE.Color {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

/**
 * Sky dome with gradient, sun, moon, stars, clouds, and aurora.
 * Port of the PixiJS SkyRenderer using Three.js primitives.
 */
export class SkyDome {
  readonly group = new THREE.Group();

  private skyMesh: THREE.Mesh;
  private skyMaterial: THREE.ShaderMaterial;

  // Celestial bodies
  private sunSprite: THREE.Sprite;
  private sunGlowSprite: THREE.Sprite;
  private moonSprite: THREE.Sprite;
  private moonGlowSprite: THREE.Sprite;

  // Stars as a Points system
  private stars: StarDef[] = [];
  private starPoints!: THREE.Points;
  private starSizes!: Float32Array;
  private starAlphas!: Float32Array;

  // Clouds
  private clouds: CloudDef[] = [];

  // Shooting stars
  private shootingStars: ShootingStar[] = [];
  private shootingStarTimer = 0;

  // Aurora meshes
  private auroraMeshes: THREE.Mesh[] = [];

  private timer = 0;

  constructor() {
    // Sky dome sphere (large, camera is always inside)
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(0x4488cc) },
        uMidColor: { value: new THREE.Color(0x88aacc) },
        uBottomColor: { value: new THREE.Color(0xaaccee) },
      },
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.renderOrder = -100;
    this.group.add(this.skyMesh);

    // Sun
    const sunTex = this.createCircleTexture(64, 0xffeecc, 1.0);
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.sunSprite.scale.set(12, 12, 1);
    this.group.add(this.sunSprite);

    const sunGlowTex = this.createGlowTexture(128, 0xffdd66);
    this.sunGlowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunGlowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.sunGlowSprite.scale.set(40, 40, 1);
    this.group.add(this.sunGlowSprite);

    // Moon
    const moonTex = this.createCircleTexture(48, 0xddeeff, 0.9);
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonTex,
      transparent: true,
      depthWrite: false,
    }));
    this.moonSprite.scale.set(6, 6, 1);
    this.group.add(this.moonSprite);

    const moonGlowTex = this.createGlowTexture(96, 0xaabbdd);
    this.moonGlowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: moonGlowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.moonGlowSprite.scale.set(18, 18, 1);
    this.group.add(this.moonGlowSprite);

    // Stars
    this.initStars(120);

    // Clouds
    this.initClouds(7);

    // Aurora bands
    this.initAurora();
  }

  private createCircleTexture(size: number, color: number, alpha: number): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const r = size / 2;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    const c = new THREE.Color(color);
    gradient.addColorStop(0, `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${alpha})`);
    gradient.addColorStop(0.7, `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${alpha*0.5})`);
    gradient.addColorStop(1, `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private createGlowTexture(size: number, color: number): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const r = size / 2;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    const c = new THREE.Color(color);
    gradient.addColorStop(0, `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},0.15)`);
    gradient.addColorStop(0.5, `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},0.05)`);
    gradient.addColorStop(1, `rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private initStars(count: number): void {
    const positions = new Float32Array(count * 3);
    this.starSizes = new Float32Array(count);
    this.starAlphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute on upper hemisphere of sky dome
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45; // upper sky only
      const r = 350;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const def: StarDef = {
        position: new THREE.Vector3(x, y, z),
        baseAlpha: 0.3 + Math.random() * 0.5,
        freq: 0.5 + Math.random() * 2.5,
        size: 1.5 + Math.random() * 3.0,
      };
      this.stars.push(def);
      this.starSizes[i] = def.size;
      this.starAlphas[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(this.starSizes, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.starPoints = new THREE.Points(geo, mat);
    this.group.add(this.starPoints);
  }

  private initClouds(count: number): void {
    const cloudTex = this.createCloudTexture();
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        color: 0xffffff,
      });
      const sprite = new THREE.Sprite(mat);
      const scale = 20 + Math.random() * 30;
      sprite.scale.set(scale, scale * 0.4, 1);
      const y = 60 + Math.random() * 40;
      sprite.position.set(
        (Math.random() - 0.5) * 600,
        y,
        (Math.random() - 0.5) * 600,
      );

      this.clouds.push({
        mesh: sprite,
        baseX: sprite.position.x,
        y,
        speed: 3 + Math.random() * 5,
        scale,
      });
      this.group.add(sprite);
    }
  }

  private createCloudTexture(): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const r = size / 2;
    // Soft cloud shape
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, "rgba(255,255,255,0.8)");
    gradient.addColorStop(0.3, "rgba(255,255,255,0.5)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.2)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private initAurora(): void {
    const colors = [0x44ff88, 0x22ccaa, 0x8844ff];
    for (let band = 0; band < 3; band++) {
      const geo = new THREE.PlaneGeometry(300, 20, 60, 1);
      geo.rotateX(-Math.PI / 6);
      const mat = new THREE.MeshBasicMaterial({
        color: colors[band],
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 120 + band * 15, -150);
      this.auroraMeshes.push(mesh);
      this.group.add(mesh);
    }
  }

  /**
   * Update sky based on time of day (0-24 minute cycle).
   * Matches the color ramp from the original SkyRenderer.
   */
  update(dt: number, timeOfDay: number, camX: number, camZ: number): void {
    this.timer += dt;

    // Move sky dome with camera (so it's always centered)
    this.skyMesh.position.set(camX, 0, camZ);

    // Determine sky colors
    let topColor: number, bottomColor: number;
    let isNight = false;
    let nightAmount = 0;

    if (timeOfDay < 3) {
      // Dawn
      const t = timeOfDay / 3;
      nightAmount = 1 - t;
      topColor = this.lerpColorHex(0x1a0a3a, 0x4488cc, t);
      bottomColor = this.lerpColorHex(0xff8844, 0xaaccee, t);
    } else if (timeOfDay < 12) {
      // Day
      topColor = 0x4488cc;
      bottomColor = 0xaaccee;
    } else if (timeOfDay < 15) {
      // Dusk
      const t = (timeOfDay - 12) / 3;
      nightAmount = t;
      topColor = this.lerpColorHex(0x4488cc, 0x2a1a4a, t);
      bottomColor = this.lerpColorHex(0xaaccee, 0xff6644, t);
    } else {
      // Night
      isNight = true;
      nightAmount = 1;
      topColor = 0x0a0a2a;
      bottomColor = 0x1a1a3a;
    }

    const midColor = this.lerpColorHex(topColor, bottomColor, 0.5);
    this.skyMaterial.uniforms.uTopColor.value.set(topColor);
    this.skyMaterial.uniforms.uMidColor.value.set(midColor);
    this.skyMaterial.uniforms.uBottomColor.value.set(bottomColor);

    // Sun position (arcs across the sky during dawn->dusk)
    if (timeOfDay < 15) {
      const sunProgress = timeOfDay / 15;
      const sunAngle = sunProgress * Math.PI;
      const sunR = 250;
      const sunX = camX + Math.cos(sunAngle) * sunR * 0.8;
      const sunY = Math.sin(sunAngle) * sunR * 0.6 + 20;
      const sunZ = camZ - 200;

      this.sunSprite.position.set(sunX, sunY, sunZ);
      this.sunGlowSprite.position.set(sunX, sunY, sunZ);
      this.sunSprite.visible = true;
      this.sunGlowSprite.visible = true;

      const sunIntensity = Math.sin(sunAngle);
      (this.sunGlowSprite.material as THREE.SpriteMaterial).opacity = sunIntensity * 0.12;
    } else {
      this.sunSprite.visible = false;
      this.sunGlowSprite.visible = false;
    }

    // Moon position
    if (nightAmount > 0.3) {
      const moonProgress = isNight ? (timeOfDay - 15) / 9 : 0;
      const moonAngle = moonProgress * Math.PI;
      const moonR = 250;
      const moonX = camX + Math.cos(moonAngle) * moonR * 0.7;
      const moonY = Math.sin(moonAngle) * moonR * 0.4 + 60;
      const moonZ = camZ - 180;
      const moonAlpha = Math.min(1, (nightAmount - 0.3) / 0.3);

      this.moonSprite.position.set(moonX, moonY, moonZ);
      this.moonGlowSprite.position.set(moonX, moonY, moonZ);
      this.moonSprite.visible = true;
      this.moonGlowSprite.visible = true;
      (this.moonSprite.material as THREE.SpriteMaterial).opacity = moonAlpha * 0.9;
      (this.moonGlowSprite.material as THREE.SpriteMaterial).opacity = moonAlpha * 0.08;
    } else {
      this.moonSprite.visible = false;
      this.moonGlowSprite.visible = false;
    }

    // Stars
    if (nightAmount > 0.2) {
      const starBaseAlpha = Math.min(1, (nightAmount - 0.2) / 0.3);
      (this.starPoints.material as THREE.PointsMaterial).opacity = starBaseAlpha;
      this.starPoints.visible = true;
      this.starPoints.position.set(camX, 0, camZ);
    } else {
      this.starPoints.visible = false;
    }

    // Clouds
    for (const cloud of this.clouds) {
      cloud.mesh.position.x = cloud.baseX + this.timer * cloud.speed + camX * 0.3;
      cloud.mesh.position.z = camZ - 100;
      const cloudOpacity = isNight ? 0.08 : 0.2;
      (cloud.mesh.material as THREE.SpriteMaterial).opacity = cloudOpacity;
    }

    // Aurora (night only)
    for (let i = 0; i < this.auroraMeshes.length; i++) {
      const mesh = this.auroraMeshes[i];
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (isNight) {
        mat.opacity = 0.025 + Math.sin(this.timer * 0.3 + i) * 0.015;
        mesh.position.x = camX;
        mesh.position.z = camZ - 150;
        // Animate aurora vertices for wave effect
        const positions = mesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let v = 0; v < positions.count; v++) {
          const x = positions.getX(v);
          const baseY = 0;
          const waveY = Math.sin(x * 0.02 + this.timer * (0.3 + i * 0.1)) * 8
                      + Math.sin(x * 0.01 + this.timer * 0.8 + i * 2) * 4;
          positions.setY(v, baseY + waveY);
        }
        positions.needsUpdate = true;
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
    }

    // Shooting stars
    if (isNight || nightAmount > 0.5) {
      this.shootingStarTimer += dt;
      if (this.shootingStarTimer > 6 + Math.random() * 8 && this.shootingStars.length < 3) {
        this.shootingStarTimer = 0;
        this.spawnShootingStar(camX, camZ);
      }
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const ss = this.shootingStars[i];
      ss.life += dt;
      if (ss.life >= ss.maxLife) {
        this.group.remove(ss.mesh);
        ss.mesh.geometry.dispose();
        (ss.mesh.material as THREE.Material).dispose();
        this.shootingStars.splice(i, 1);
        continue;
      }
      ss.position.add(ss.velocity.clone().multiplyScalar(dt));
      const progress = ss.life / ss.maxLife;
      const fade = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
      (ss.mesh.material as THREE.LineBasicMaterial).opacity = fade * 0.7 * nightAmount;

      // Update line positions
      const positions = ss.mesh.geometry.attributes.position as THREE.BufferAttribute;
      const tailOffset = ss.velocity.clone().normalize().multiplyScalar(-20);
      positions.setXYZ(0, ss.position.x + tailOffset.x, ss.position.y + tailOffset.y, ss.position.z + tailOffset.z);
      positions.setXYZ(1, ss.position.x, ss.position.y, ss.position.z);
      positions.needsUpdate = true;
    }
  }

  private spawnShootingStar(camX: number, camZ: number): void {
    const startX = camX + (Math.random() - 0.5) * 200;
    const startY = 150 + Math.random() * 100;
    const startZ = camZ - 150 + (Math.random() - 0.5) * 100;

    const angle = Math.PI * 0.15 + Math.random() * 0.3;
    const speed = 150 + Math.random() * 100;
    const velocity = new THREE.Vector3(
      Math.cos(angle) * speed,
      -Math.sin(angle) * speed * 0.5,
      0,
    );

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(6);
    positions[0] = startX; positions[1] = startY; positions[2] = startZ;
    positions[3] = startX; positions[4] = startY; positions[5] = startZ;
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geo, mat);
    this.group.add(line);

    this.shootingStars.push({
      mesh: line,
      position: new THREE.Vector3(startX, startY, startZ),
      velocity,
      life: 0,
      maxLife: 0.4 + Math.random() * 0.3,
    });
  }

  private lerpColorHex(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const gv = Math.round(ag + (bg - ag) * t);
    const bv = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (gv << 8) | bv;
  }
}
