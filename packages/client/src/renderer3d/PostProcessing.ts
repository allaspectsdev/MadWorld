import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import type { ThreeApp } from "./ThreeApp.js";

// ── Vignette Shader ──
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uIntensity: { value: 0.4 },
    uSmoothness: { value: 0.5 },
    uTintColor: { value: new THREE.Vector3(0, 0, 0) },
    uTintAmount: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uSmoothness;
    uniform vec3 uTintColor;
    uniform float uTintAmount;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float vignette = smoothstep(0.5, 0.5 - uSmoothness, dist) * uIntensity;
      vignette = 1.0 - (1.0 - vignette) * uIntensity;
      color.rgb *= vignette;

      // Optional tint (for low HP, damage flash, etc.)
      color.rgb = mix(color.rgb, uTintColor, uTintAmount);

      gl_FragColor = color;
    }
  `,
};

// ── Screen Flash Shader ──
const FlashShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uFlashColor: { value: new THREE.Vector3(1, 0, 0) },
    uFlashAmount: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uFlashColor;
    uniform float uFlashAmount;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      color.rgb = mix(color.rgb, uFlashColor, uFlashAmount * 0.2);
      gl_FragColor = color;
    }
  `,
};

/**
 * Post-processing pipeline: bloom, vignette, screen flash, fade.
 * Replaces ScreenEffects.ts and DayNightOverlay.ts.
 */
export class PostProcessing {
  private app: ThreeApp;
  private bloomPass: UnrealBloomPass;
  private vignettePass: ShaderPass;
  private flashPass: ShaderPass;

  // Flash state
  private flashTimer = 0;
  private flashDuration = 0;
  private flashColor = new THREE.Vector3(1, 0, 0);

  // Low HP pulse
  private hpRatio = 1;

  // Fade state (for zone transitions)
  private fadeOverlay: HTMLDivElement | null = null;

  constructor(app: ThreeApp) {
    this.app = app;

    // Bloom pass (subtle)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.25, // strength
      0.4,  // radius
      0.85, // threshold
    );
    app.composer.addPass(this.bloomPass);

    // Flash pass
    this.flashPass = new ShaderPass(FlashShader);
    app.composer.addPass(this.flashPass);

    // Vignette pass (always on)
    this.vignettePass = new ShaderPass(VignetteShader);
    app.composer.addPass(this.vignettePass);

    // Create DOM fade overlay for zone transitions
    this.fadeOverlay = document.createElement("div");
    this.fadeOverlay.style.position = "fixed";
    this.fadeOverlay.style.top = "0";
    this.fadeOverlay.style.left = "0";
    this.fadeOverlay.style.width = "100%";
    this.fadeOverlay.style.height = "100%";
    this.fadeOverlay.style.backgroundColor = "black";
    this.fadeOverlay.style.opacity = "0";
    this.fadeOverlay.style.pointerEvents = "none";
    this.fadeOverlay.style.transition = "opacity 0.3s ease";
    this.fadeOverlay.style.zIndex = "999";
    document.body.appendChild(this.fadeOverlay);
  }

  /** Trigger a screen flash */
  flash(color: number, duration = 0.2): void {
    const r = ((color >> 16) & 0xff) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;
    this.flashColor.set(r, g, b);
    this.flashDuration = duration;
    this.flashTimer = 0;
  }

  /** Convenience: red damage flash */
  flashDamage(): void {
    this.flash(0xff0000, 0.2);
  }

  /** Convenience: gold level-up flash */
  flashLevelUp(): void {
    this.flash(0xffd700, 0.5);
  }

  /** Convenience: lightning flash */
  flashLightning(): void {
    this.flash(0xccddff, 0.4);
  }

  /** Set current HP ratio for low-HP vignette pulse */
  setHpRatio(ratio: number): void {
    this.hpRatio = ratio;
  }

  /** Trigger zone transition fade */
  fadeZoneTransition(): void {
    if (!this.fadeOverlay) return;
    this.fadeOverlay.style.opacity = "1";
    setTimeout(() => {
      if (this.fadeOverlay) this.fadeOverlay.style.opacity = "0";
    }, 450);
  }

  /** Update post-processing each frame */
  update(dt: number): void {
    // Flash animation
    if (this.flashTimer < this.flashDuration) {
      this.flashTimer += dt;
      const t = this.flashTimer / this.flashDuration;
      // Triangle pulse: ramp up to peak at 0.3, then decay
      const peak = 0.3;
      const amount = t < peak ? t / peak : 1 - (t - peak) / (1 - peak);
      this.flashPass.uniforms.uFlashAmount.value = Math.max(0, amount);
      this.flashPass.uniforms.uFlashColor.value.copy(this.flashColor);
    } else {
      this.flashPass.uniforms.uFlashAmount.value = 0;
    }

    // Low HP vignette pulse
    if (this.hpRatio < 0.25) {
      const pulse = Math.sin(performance.now() * 0.006) * 0.5 + 0.5; // 3Hz
      this.vignettePass.uniforms.uTintColor.value.set(0.8, 0.1, 0.1);
      this.vignettePass.uniforms.uTintAmount.value = (1 - this.hpRatio / 0.25) * pulse * 0.15;
    } else {
      this.vignettePass.uniforms.uTintAmount.value = 0;
    }
  }

  resize(): void {
    this.bloomPass.resolution.set(window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    if (this.fadeOverlay) {
      this.fadeOverlay.remove();
      this.fadeOverlay = null;
    }
  }
}
