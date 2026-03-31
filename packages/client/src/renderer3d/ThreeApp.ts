import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

/**
 * Core Three.js application. Creates WebGLRenderer, Scene, OrthographicCamera,
 * EffectComposer, and CSS2DRenderer. Owns the render loop.
 */
export class ThreeApp {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly composer: EffectComposer;
  readonly labelRenderer: CSS2DRenderer;
  readonly clock = new THREE.Clock();

  // Scene groups (render order controlled by scene.add order + depth buffer)
  readonly skyGroup = new THREE.Group();
  readonly terrainGroup = new THREE.Group();
  readonly waterGroup = new THREE.Group();
  readonly decorationGroup = new THREE.Group();
  readonly entityGroup = new THREE.Group();
  readonly particleGroup = new THREE.Group();
  readonly overlayGroup = new THREE.Group();
  readonly fogGroup = new THREE.Group();

  // Lighting
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.AmbientLight;

  private _zoom = 1;
  private animationId = 0;
  private onTickCallbacks: Array<(dt: number) => void> = [];

  // Isometric camera constants
  // For a 2:1 iso diamond, the camera looks along (1, sqrt(2), 1) normalized
  // atan(1/sqrt(2)) ≈ 35.264 degrees
  private static readonly ISO_ANGLE_X = Math.atan(1 / Math.sqrt(2));
  private static readonly ISO_ANGLE_Y = Math.PI / 4; // 45 degrees
  private static readonly CAM_DISTANCE = 200;
  private static readonly DEFAULT_FRUSTUM = 32; // tiles visible vertically at zoom=1

  constructor(canvas: HTMLCanvasElement) {
    // WebGL renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x1a1a2e);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Orthographic camera for isometric view
    const aspect = window.innerWidth / window.innerHeight;
    const f = ThreeApp.DEFAULT_FRUSTUM;
    this.camera = new THREE.OrthographicCamera(
      (-f * aspect) / 2,
      (f * aspect) / 2,
      f / 2,
      -f / 2,
      0.1,
      500,
    );

    // Position camera for isometric angle
    this._positionCamera(0, 0);

    // Lighting
    this.sun = new THREE.DirectionalLight(0xffeedd, 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 300;
    const s = 60;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.position.set(50, 80, 50);
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambient);

    // Add scene groups in order
    this.scene.add(this.skyGroup);
    this.scene.add(this.terrainGroup);
    this.scene.add(this.waterGroup);
    this.scene.add(this.decorationGroup);
    this.scene.add(this.entityGroup);
    this.scene.add(this.particleGroup);
    this.scene.add(this.overlayGroup);
    this.scene.add(this.fogGroup);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // CSS2D label renderer (for name plates, HP bars, chat bubbles)
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0";
    this.labelRenderer.domElement.style.left = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    canvas.parentElement?.appendChild(this.labelRenderer.domElement);

    // Resize handler
    window.addEventListener("resize", () => this.resize());
  }

  /** Position camera at isometric angle looking at world (x, 0, z) */
  _positionCamera(x: number, z: number): void {
    const d = ThreeApp.CAM_DISTANCE;
    const dir = new THREE.Vector3(1, Math.sqrt(2), 1).normalize();
    this.camera.position.set(
      x + dir.x * d,
      dir.y * d,
      z + dir.z * d,
    );
    this.camera.lookAt(x, 0, z);
  }

  get zoom(): number {
    return this._zoom;
  }

  set zoom(z: number) {
    this._zoom = Math.max(0.3, Math.min(3.0, z));
    this._updateFrustum();
  }

  private _updateFrustum(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const f = ThreeApp.DEFAULT_FRUSTUM / this._zoom;
    this.camera.left = (-f * aspect) / 2;
    this.camera.right = (f * aspect) / 2;
    this.camera.top = f / 2;
    this.camera.bottom = -f / 2;
    this.camera.updateProjectionMatrix();
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this._updateFrustum();
    this.composer.setSize(w, h);
  }

  /** Register a callback to be called each frame with dt in seconds */
  onTick(cb: (dt: number) => void): void {
    this.onTickCallbacks.push(cb);
  }

  /** Start the render loop */
  start(): void {
    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.1); // cap at 100ms
      for (const cb of this.onTickCallbacks) cb(dt);
      this.composer.render();
      this.labelRenderer.render(this.scene, this.camera);
    };
    this.clock.start();
    loop();
  }

  /** Stop the render loop */
  stop(): void {
    cancelAnimationFrame(this.animationId);
  }

  /** Get the canvas element */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
