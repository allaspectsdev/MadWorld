import { Application } from "pixi.js";
import { PLAYER_SPEED, TILE_SIZE, EntityType, Op, type ClientMessage } from "@madworld/shared";
import { Socket } from "./net/Socket.js";
import { Dispatcher } from "./net/Dispatcher.js";
import { useGameStore } from "./state/GameStore.js";
import { Camera } from "./renderer/Camera.js";
import { TilemapRenderer } from "./renderer/TilemapRenderer.js";
import { EntityRenderer } from "./renderer/EntityRenderer.js";
import { HitSplatRenderer } from "./renderer/HitSplatRenderer.js";
import { ParticleSystem } from "./renderer/ParticleSystem.js";
import { ScreenEffects } from "./renderer/ScreenEffects.js";
import { DayNightOverlay } from "./renderer/DayNightOverlay.js";
import { AmbientParticles } from "./renderer/AmbientParticles.js";
import { TelegraphRenderer } from "./renderer/TelegraphRenderer.js";
import { Minimap } from "./renderer/Minimap.js";
import { InputManager } from "./input/InputManager.js";
import { initDeviceDetection, isTouchDevice } from "./input/DeviceDetection.js";
import { PartyHUD } from "./ui/components/PartyHUD.js";
import { PartyInviteModal } from "./ui/components/PartyInviteModal.js";
import { ChatPanel } from "./ui/components/ChatPanel.js";

export class Game {
  private app: Application;
  private socket: Socket;
  private dispatcher: Dispatcher;
  private input: InputManager;
  private camera: Camera;
  private tilemap: TilemapRenderer;
  private entities: EntityRenderer;
  private hitSplats: HitSplatRenderer;
  private particles: ParticleSystem;
  private screenEffects: ScreenEffects;
  private dayNight: DayNightOverlay;
  private ambientParticles: AmbientParticles;
  private telegraphs: TelegraphRenderer;
  private minimap: Minimap;
  private partyHUD: PartyHUD;
  private partyInviteModal: PartyInviteModal;
  private chatPanel: ChatPanel;

  private isRegistering = false;

  constructor(app: Application) {
    this.app = app;
    this.socket = new Socket();
    this.camera = new Camera();
    this.tilemap = new TilemapRenderer();
    this.entities = new EntityRenderer();
    this.hitSplats = new HitSplatRenderer();
    this.particles = new ParticleSystem();
    this.particles.init();
    this.screenEffects = new ScreenEffects(app);
    this.dayNight = new DayNightOverlay(app);
    this.ambientParticles = new AmbientParticles(this.particles);
    this.telegraphs = new TelegraphRenderer();
    this.minimap = new Minimap();
    this.dispatcher = new Dispatcher(
      this.hitSplats,
      this.entities,
      this.particles,
      this.screenEffects,
      this.telegraphs,
      this.minimap,
    );

    initDeviceDetection();

    this.input = new InputManager(
      this.socket,
      this.app.canvas as HTMLCanvasElement,
      this.camera,
      this.entities,
    );

    this.partyHUD = new PartyHUD();
    this.partyInviteModal = new PartyInviteModal(this.socket);
    this.chatPanel = new ChatPanel(this.socket);

    // When chat is focused, disable movement input
    this.chatPanel.setOnFocusChange((focused) => {
      this.input.keyboard.enabled = !focused;
    });

    // Build scene graph
    this.camera.container.addChild(this.tilemap.container);
    this.camera.container.addChild(this.telegraphs.container);
    this.camera.container.addChild(this.entities.container);
    this.camera.container.addChild(this.particles.container);
    this.camera.container.addChild(this.hitSplats.container);
    this.entities.container.sortableChildren = true;
    app.stage.addChild(this.camera.container);
    // ScreenEffects and DayNight add themselves to app.stage in their constructors

    // Default zoom for mobile
    if (isTouchDevice()) {
      this.camera.setZoom(1.5);
    }
  }

  start(): void {
    this.setupAuth();
    this.setupSocket();
    this.setupInputCallbacks();
    this.partyHUD.start();
    this.partyInviteModal.start();

    // Enter key toggles chat
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        this.chatPanel.toggle();
      }
    });

    this.dispatcher.setOnZoneChange(() => {
      const state = useGameStore.getState();
      if (state.tiles) {
        this.tilemap.setTiles(state.tiles);
        this.minimap.renderTiles(state.tiles);
        this.entities.clear();

        // Detect zone type for ambient particles
        if (state.localPlayer?.zoneId.startsWith("dungeon:")) {
          this.ambientParticles.setZoneType("dungeon");
        } else {
          const zoneName = state.localPlayer?.zoneName ?? "";
          if (zoneName.includes("Forest") || zoneName.includes("Darkwood")) {
            this.ambientParticles.setZoneType("forest");
          } else if (zoneName.includes("Field")) {
            this.ambientParticles.setZoneType("default");
          } else {
            this.ambientParticles.setZoneType("default");
          }
        }
      }
    });

    // Game loop
    this.app.ticker.add(() => {
      this.update(this.app.ticker.deltaMS / 1000);
    });

    // Handle resize — use window dimensions directly for reliability
    this.camera.setScreenSize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", () => {
      this.camera.setScreenSize(window.innerWidth, window.innerHeight);
    });
  }

  private update(dt: number): void {
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp || lp.isDead) {
      // Still update visual effects while dead
      this.screenEffects.update(dt);
      this.dayNight.update(dt);
      this.particles.update(dt);
      this.telegraphs.update(dt);
      return;
    }

    // Process input and local prediction
    const move = this.input.update(dt);
    if (move) {
      state.updateLocalPlayer({
        x: lp.x + move.dx * PLAYER_SPEED * dt,
        y: lp.y + move.dy * PLAYER_SPEED * dt,
      });
    }

    const current = useGameStore.getState().localPlayer;
    if (!current) return;

    // Update camera
    this.camera.setTarget(current.x, current.y);
    this.camera.update();

    // Update tilemap (animated tiles)
    this.tilemap.update(dt);

    // Render local player
    this.entities.setLocalPlayer(current.eid);
    this.entities.updateLocalPlayer(current.x, current.y, dt);

    // Render remote entities with interpolation
    const now = performance.now();
    for (const [eid, entity] of state.entities) {
      const duration = entity.nextTime - entity.prevTime;
      const elapsed = now - entity.nextTime;
      const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
      const ix = entity.prevX + (entity.nextX - entity.prevX) * t;
      const iy = entity.prevY + (entity.nextY - entity.prevY) * t;
      this.entities.updateEntity(eid, ix, iy, entity, dt);
    }

    // Update all visual systems
    this.hitSplats.update();
    this.particles.update(dt);
    this.screenEffects.update(dt);
    this.dayNight.update(dt);
    this.telegraphs.update(dt);
    this.minimap.update(dt);

    // Chat
    this.chatPanel.update();

    // Ambient particles
    const bounds = this.camera.getViewBounds();
    this.ambientParticles.setCamera(
      bounds.left * TILE_SIZE,
      bounds.top * TILE_SIZE,
      (bounds.right - bounds.left) * TILE_SIZE,
      (bounds.bottom - bounds.top) * TILE_SIZE,
    );
    this.ambientParticles.update(dt);
  }

  private setupSocket(): void {
    this.socket.onMessage((msg) => this.dispatcher.handle(msg));
  }

  private setupInputCallbacks(): void {
    this.input.onAttack = (eid: number) => {
      this.socket.send({
        op: Op.C_ATTACK,
        d: { targetEid: eid },
      } as ClientMessage);
    };

    this.input.onPartyInvite = (eid: number) => {
      const entity = useGameStore.getState().entities.get(eid);
      if (entity && entity.type === EntityType.PLAYER) {
        this.socket.send({
          op: Op.C_PARTY_INVITE,
          d: { targetEid: eid },
        } as ClientMessage);
      }
    };
  }

  private setupAuth(): void {
    const loginForm = document.getElementById("login-form") as HTMLFormElement;
    const emailInput = document.getElementById("auth-email") as HTMLInputElement;
    const passwordInput = document.getElementById("auth-password") as HTMLInputElement;
    const nameInput = document.getElementById("auth-name") as HTMLInputElement;
    const submitBtn = document.getElementById("auth-submit") as HTMLButtonElement;
    const errorDiv = document.getElementById("auth-error") as HTMLDivElement;
    const toggleDiv = document.getElementById("auth-toggle") as HTMLDivElement;

    toggleDiv.addEventListener("click", () => {
      this.isRegistering = !this.isRegistering;
      nameInput.style.display = this.isRegistering ? "block" : "none";
      submitBtn.textContent = this.isRegistering ? "Register" : "Login";
      toggleDiv.textContent = this.isRegistering
        ? "Already have an account? Login"
        : "Don't have an account? Register";
      errorDiv.textContent = "";
    });

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorDiv.textContent = "";
      submitBtn.disabled = true;

      const endpoint = this.isRegistering ? "/api/register" : "/api/login";
      const body: Record<string, string> = {
        email: emailInput.value,
        password: passwordInput.value,
      };
      if (this.isRegistering) {
        body.displayName = nameInput.value;
      }

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
          errorDiv.textContent = data.error || "Something went wrong";
          submitBtn.disabled = false;
          return;
        }

        useGameStore.getState().setToken(data.token);
        document.getElementById("login-screen")!.style.display = "none";
        document.getElementById("hud")!.style.display = "flex";

        this.socket.connect(data.token);
      } catch {
        errorDiv.textContent = "Failed to connect to server";
        submitBtn.disabled = false;
      }
    });
  }
}
