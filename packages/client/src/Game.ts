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
import { LightingSystem } from "./renderer/LightingSystem.js";
import { AmbientParticles } from "./renderer/AmbientParticles.js";
import { TelegraphRenderer } from "./renderer/TelegraphRenderer.js";
import { Minimap } from "./renderer/Minimap.js";
import { InputManager } from "./input/InputManager.js";
import { initDeviceDetection, isTouchDevice } from "./input/DeviceDetection.js";
import { PartyHUD } from "./ui/components/PartyHUD.js";
import { PartyInviteModal } from "./ui/components/PartyInviteModal.js";
import { ChatPanel } from "./ui/components/ChatPanel.js";
import { InventoryPanel } from "./ui/components/InventoryPanel.js";
import { QuestLog } from "./ui/components/QuestLog.js";
import { NPCDialog } from "./ui/components/NPCDialog.js";
import { AudioManager } from "./audio/AudioManager.js";
import { SkillBar } from "./ui/components/SkillBar.js";
import { SettingsPanel } from "./ui/components/SettingsPanel.js";

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
  private lighting: LightingSystem;
  private ambientParticles: AmbientParticles;
  private telegraphs: TelegraphRenderer;
  private minimap: Minimap;
  private partyHUD: PartyHUD;
  private partyInviteModal: PartyInviteModal;
  private chatPanel: ChatPanel;
  private inventoryPanel: InventoryPanel;
  private audio: AudioManager;
  private skillBar: SkillBar;
  private settingsPanel: SettingsPanel;
  private questLog: QuestLog;
  private npcDialog: NPCDialog;

  private isRegistering = false;
  private currentTarget: number | null = null;
  private autoAttackTimer = 0;
  private static readonly AUTO_ATTACK_INTERVAL = 0.5;

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
    this.lighting = new LightingSystem(app);
    this.ambientParticles = new AmbientParticles(this.particles);
    this.telegraphs = new TelegraphRenderer();
    this.minimap = new Minimap();
    this.audio = new AudioManager();
    this.dispatcher = new Dispatcher(
      this.hitSplats,
      this.entities,
      this.particles,
      this.screenEffects,
      this.telegraphs,
      this.minimap,
      this.audio,
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
    this.inventoryPanel = new InventoryPanel(this.socket);
    this.skillBar = new SkillBar();
    this.settingsPanel = new SettingsPanel(this.audio, this.camera);
    this.questLog = new QuestLog();
    this.npcDialog = new NPCDialog(this.socket);

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
    // ScreenEffects adds itself to app.stage in its constructor
    // LightingSystem adds its overlay to app.stage in its constructor (multiply blend)

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
    this.questLog.start();
    this.npcDialog.start();

    // Initialize audio on first user interaction
    const initAudio = () => {
      this.audio.init();
      window.removeEventListener("click", initAudio);
      window.removeEventListener("touchstart", initAudio);
      window.removeEventListener("keydown", initAudio);
    };
    window.addEventListener("click", initAudio);
    window.addEventListener("touchstart", initAudio);
    window.addEventListener("keydown", initAudio);

    // Enter key toggles chat
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        this.chatPanel.toggle();
      }

      // I key toggles inventory (only when chat is not focused)
      if ((e.key === "i" || e.key === "I") && !useGameStore.getState().chatOpen) {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        useGameStore.getState().toggleInventory();
      }

      // L key toggles quest log (only when chat is not focused)
      if ((e.key === "l" || e.key === "L") && !useGameStore.getState().chatOpen) {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        useGameStore.getState().toggleQuestLog();
      }

      // Escape key toggles settings panel
      if (e.key === "Escape") {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        this.settingsPanel.toggle();
      }
    });

    this.dispatcher.setOnEntityDeath((eid) => {
      if (this.currentTarget === eid) {
        this.clearTarget();
      }
    });

    this.dispatcher.setOnZoneChange(() => {
      const state = useGameStore.getState();
      if (state.tiles) {
        this.tilemap.setTiles(state.tiles);
        this.minimap.renderTiles(state.tiles);
        this.entities.clear();

        // Set zone lights for lighting system
        const zoneLights = state.zoneLights ?? [];
        this.lighting.setZoneLights(
          zoneLights.map((l) => ({
            x: l.x,
            y: l.y,
            radius: l.radius,
            color: l.color,
            intensity: 1,
            flicker: l.flicker,
          })),
        );

        // Switch audio for zone
        if (state.localPlayer) {
          this.audio.setZone(state.localPlayer.zoneId, state.localPlayer.zoneName);
        }

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
      this.lighting.resize();
    });
  }

  private update(dt: number): void {
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp || lp.isDead) {
      // Still update visual effects while dead
      this.screenEffects.update(dt);
      this.lighting.update(dt, lp?.x ?? 0, lp?.y ?? 0);
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
      this.camera.setMovementLead(move.dx, move.dy);
    } else {
      this.camera.setMovementLead(0, 0);
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

    // Auto-attack: keep sending C_ATTACK while target is alive
    if (this.currentTarget !== null) {
      const targetEntity = state.entities.get(this.currentTarget);
      if (!targetEntity) {
        // Target despawned or died
        this.clearTarget();
      } else {
        this.autoAttackTimer += dt;
        if (this.autoAttackTimer >= Game.AUTO_ATTACK_INTERVAL) {
          this.autoAttackTimer -= Game.AUTO_ATTACK_INTERVAL;
          this.audio.playSfx("swing");
          this.entities.triggerAttackAnim(current.eid);
          this.socket.send({
            op: Op.C_ATTACK,
            d: { targetEid: this.currentTarget },
          } as ClientMessage);
        }
      }
    }

    // Update all visual systems
    this.hitSplats.update();
    this.particles.update(dt);
    this.screenEffects.update(dt);
    this.telegraphs.update(dt);
    this.minimap.update(dt);

    // Lighting system
    this.lighting.setCamera(current.x, current.y, this.camera.zoom);
    this.lighting.update(dt, current.x, current.y);

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
      const entity = useGameStore.getState().entities.get(eid);
      if (entity && entity.type === EntityType.NPC) {
        // NPC interaction instead of attack
        this.socket.send({
          op: Op.C_NPC_INTERACT,
          d: { targetEid: eid },
        } as ClientMessage);
        this.clearTarget();
        return;
      }

      // Immediate client-side feedback
      this.audio.playSfx("swing");
      this.entities.triggerAttackAnim(
        useGameStore.getState().localPlayer?.eid ?? 0,
      );

      // Set target and show selection ring
      this.currentTarget = eid;
      this.autoAttackTimer = 0;
      this.entities.setTargetHighlight(eid);

      // Send attack to server
      this.socket.send({
        op: Op.C_ATTACK,
        d: { targetEid: eid },
      } as ClientMessage);
    };

    this.input.onEmptyClick = () => {
      this.audio.playSfx("whoosh", { volume: 0.4 });
      this.clearTarget();
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

  private clearTarget(): void {
    this.currentTarget = null;
    this.autoAttackTimer = 0;
    this.entities.setTargetHighlight(null);
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

    const enterGame = (token: string) => {
      useGameStore.getState().setToken(token);
      document.getElementById("login-screen")!.style.display = "none";
      document.getElementById("hud")!.style.display = "flex";
      document.getElementById("skill-bar")!.style.display = "flex";
      this.audio.resume();
      this.socket.connect(token);
    };

    // Guest play
    const guestBtn = document.getElementById("guest-btn");
    if (guestBtn) {
      guestBtn.addEventListener("click", async () => {
        errorDiv.textContent = "";
        guestBtn.textContent = "Joining...";
        try {
          const res = await fetch("/api/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          const data = await res.json();
          if (!res.ok) {
            errorDiv.textContent = data.error || "Failed to create guest";
            guestBtn.textContent = "Play as Guest";
            return;
          }
          enterGame(data.token);
        } catch {
          errorDiv.textContent = "Failed to connect to server";
          guestBtn.textContent = "Play as Guest";
        }
      });
    }

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

        enterGame(data.token);
      } catch {
        errorDiv.textContent = "Failed to connect to server";
        submitBtn.disabled = false;
      }
    });
  }
}
