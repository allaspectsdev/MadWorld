import { Application, ColorMatrixFilter } from "pixi.js";
import { PLAYER_SPEED, TILE_SIZE, EntityType, Op, TileType, type ClientMessage, cartToIso, ISO_TILE_H } from "@madworld/shared";
import { Socket } from "./net/Socket.js";
import { Dispatcher } from "./net/Dispatcher.js";
import { useGameStore } from "./state/GameStore.js";
import { Camera } from "./renderer/Camera.js";
import { TilemapRenderer } from "./renderer/TilemapRenderer.js";
import { EntityRenderer } from "./renderer/EntityRenderer.js";
import { HitSplatRenderer } from "./renderer/HitSplatRenderer.js";
import { ChatBubbleRenderer } from "./renderer/ChatBubbleRenderer.js";
import { ParticleSystem } from "./renderer/ParticleSystem.js";
import { ScreenEffects } from "./renderer/ScreenEffects.js";
import { LightingSystem } from "./renderer/LightingSystem.js";
import { SkyRenderer } from "./renderer/SkyRenderer.js";
import { AmbientParticles } from "./renderer/AmbientParticles.js";
import { TelegraphRenderer } from "./renderer/TelegraphRenderer.js";
import { DecorationRenderer } from "./renderer/DecorationRenderer.js";
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
import { ShopPanel } from "./ui/components/ShopPanel.js";
import { SettingsPanel } from "./ui/components/SettingsPanel.js";
import { WorldMap } from "./ui/components/WorldMap.js";
import { SkillsPanel } from "./ui/components/SkillsPanel.js";
import { PathFollower, type PendingAction } from "./pathfinding/PathFollower.js";
import { findPath, trimPathToRange } from "./pathfinding/Pathfinder.js";

export class Game {
  private app: Application;
  private socket: Socket;
  private dispatcher: Dispatcher;
  private input: InputManager;
  private camera: Camera;
  private tilemap: TilemapRenderer;
  private entities: EntityRenderer;
  private hitSplats: HitSplatRenderer;
  private chatBubbles: ChatBubbleRenderer;
  private particles: ParticleSystem;
  private screenEffects: ScreenEffects;
  private lighting: LightingSystem;
  private ambientParticles: AmbientParticles;
  private telegraphs: TelegraphRenderer;
  private decorations: DecorationRenderer;
  private minimap: Minimap;
  private partyHUD: PartyHUD;
  private partyInviteModal: PartyInviteModal;
  private chatPanel: ChatPanel;
  private inventoryPanel: InventoryPanel;
  private audio: AudioManager;
  private skillBar: SkillBar;
  private shopPanel: ShopPanel;
  private settingsPanel: SettingsPanel;
  private questLog: QuestLog;
  private npcDialog: NPCDialog;
  private skillsPanel: SkillsPanel;
  private worldMap: WorldMap;
  private colorGrading: ColorMatrixFilter;
  private sky: SkyRenderer;

  private isRegistering = false;
  private currentTarget: number | null = null;
  private autoAttackTimer = 0;
  private deadEntities = new Set<number>();
  private pathFollower = new PathFollower();
  private pathSendTimer = 0;
  private pathSeq = 10000; // offset to avoid collision with input seq
  private lastDustX = 0;
  private lastDustY = 0;
  private static readonly AUTO_ATTACK_INTERVAL = 0.5;

  constructor(app: Application) {
    this.app = app;
    this.socket = new Socket();
    this.camera = new Camera();
    this.tilemap = new TilemapRenderer();
    this.entities = new EntityRenderer();
    this.hitSplats = new HitSplatRenderer();
    this.chatBubbles = new ChatBubbleRenderer();
    this.particles = new ParticleSystem();
    this.particles.init();
    this.screenEffects = new ScreenEffects(app);
    this.lighting = new LightingSystem(app);
    this.sky = new SkyRenderer(app.screen.width, app.screen.height);
    this.ambientParticles = new AmbientParticles(this.particles);
    this.ambientParticles.onLightning = () => this.screenEffects.flashLightning();
    this.telegraphs = new TelegraphRenderer();
    this.decorations = new DecorationRenderer();
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
      this.camera,
      this.chatBubbles,
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
    this.shopPanel = new ShopPanel(this.socket);
    this.settingsPanel = new SettingsPanel(this.audio, this.camera);
    this.questLog = new QuestLog();
    this.npcDialog = new NPCDialog(this.socket);
    this.skillsPanel = new SkillsPanel();
    this.worldMap = new WorldMap();

    // HUD toggle buttons
    document.getElementById("btn-inventory")?.addEventListener("click", () => {
      const state = useGameStore.getState();
      if (state.skillsOpen) state.toggleSkills();
      state.toggleInventory();
      this.updateHudButtons();
    });
    document.getElementById("btn-skills")?.addEventListener("click", () => {
      const state = useGameStore.getState();
      if (state.inventoryOpen) state.toggleInventory();
      state.toggleSkills();
      this.updateHudButtons();
    });
    document.getElementById("btn-quests")?.addEventListener("click", () => {
      const ql = document.getElementById("quest-log");
      if (ql) ql.classList.toggle("open");
      this.updateHudButtons();
    });
    document.getElementById("btn-map")?.addEventListener("click", () => {
      this.worldMap.toggle();
    });
    document.getElementById("btn-settings")?.addEventListener("click", () => {
      const sp = document.getElementById("settings-panel");
      if (sp) sp.classList.toggle("open");
      this.updateHudButtons();
    });

    // When chat is focused, disable movement input
    this.chatPanel.setOnFocusChange((focused) => {
      this.input.keyboard.enabled = !focused;
    });

    // Confirm before leaving page (prevents accidental logout)
    window.addEventListener("beforeunload", (e) => {
      if (useGameStore.getState().localPlayer) {
        e.preventDefault();
      }
    });

    // Build scene graph
    this.camera.container.addChild(this.tilemap.container);
    this.camera.container.addChild(this.decorations.container);
    this.camera.container.addChild(this.telegraphs.container);
    this.camera.container.addChild(this.entities.container);
    this.camera.container.addChild(this.particles.container);
    this.camera.container.addChild(this.hitSplats.container);
    this.camera.container.addChild(this.chatBubbles.container);
    this.entities.container.sortableChildren = true;
    app.stage.addChildAt(this.sky.container, 0);
    app.stage.addChild(this.camera.container);
    this.colorGrading = new ColorMatrixFilter();
    this.camera.container.filters = [this.colorGrading];
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
    this.shopPanel.start();

    // Subscribe to ability list changes from server
    useGameStore.subscribe((state) => {
      this.skillBar.setAbilities(state.abilities);
    });
    // Subscribe to individual cooldown changes
    useGameStore.subscribe((state) => {
      for (const ab of state.abilities) {
        this.skillBar.setCooldown(ab.abilityId, ab.cooldownMs);
      }
    });

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
        const state = useGameStore.getState();
        if (state.skillsOpen) state.toggleSkills();
        state.toggleInventory();
        this.updateHudButtons();
      }

      // K key toggles skills panel (only when chat is not focused)
      if ((e.key === "k" || e.key === "K") && !useGameStore.getState().chatOpen) {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        const state = useGameStore.getState();
        if (state.inventoryOpen) state.toggleInventory();
        state.toggleSkills();
        this.updateHudButtons();
      }

      // L key toggles quest log (only when chat is not focused)
      if ((e.key === "l" || e.key === "L") && !useGameStore.getState().chatOpen) {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        useGameStore.getState().toggleQuestLog();
      }

      // Escape key toggles settings panel (or closes world map)
      if (e.key === "Escape") {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        if (this.worldMap.isOpen()) {
          this.worldMap.toggle();
        } else {
          this.settingsPanel.toggle();
        }
      }

      // M key toggles world map
      if ((e.key === "m" || e.key === "M") && !useGameStore.getState().chatOpen) {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        this.worldMap.toggle();
      }

      // Keys 2-8 for skill bar abilities
      if (e.key >= "2" && e.key <= "8" && !useGameStore.getState().chatOpen) {
        const loginScreen = document.getElementById("login-screen");
        if (loginScreen && loginScreen.style.display !== "none") return;
        e.preventDefault();
        const slotNum = parseInt(e.key);
        const abilityId = this.skillBar.getAbilityForSlot(slotNum);
        if (abilityId && abilityId !== "auto_attack") {
          this.socket.send({
            op: Op.C_USE_SKILL,
            d: { abilityId, targetEid: this.currentTarget ?? undefined },
          } as ClientMessage);
        }
      }
    });

    this.dispatcher.setOnEntityDeath((eid) => {
      this.deadEntities.add(eid);
      if (this.currentTarget === eid) {
        this.clearTarget();
      }
    });

    this.dispatcher.setOnZoneChange(() => {
      const state = useGameStore.getState();
      if (state.tiles) {
        this.tilemap.setTiles(state.tiles);
        this.decorations.setTiles(state.tiles);
        this.minimap.renderTiles(state.tiles);
        this.entities.clear();
        this.deadEntities.clear();
        this.pathFollower.cancel();

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
        const zoneName = state.localPlayer?.zoneName ?? "";
        if (state.localPlayer?.zoneId.startsWith("dungeon:")) {
          this.ambientParticles.setZoneType("dungeon");
        } else {
          if (zoneName.includes("Forest") || zoneName.includes("Darkwood")) {
            this.ambientParticles.setZoneType("forest");
          } else if (zoneName.includes("Field")) {
            this.ambientParticles.setZoneType("default");
          } else {
            this.ambientParticles.setZoneType("default");
          }
        }

        // Pass zone lights to ambient particles for ember effects
        this.ambientParticles.zoneLights = (state.zoneLights ?? []).map(l => ({ x: l.x, y: l.y, radius: l.radius, color: l.color }));

        // Zone color grading
        this.colorGrading.reset();
        if (state.localPlayer?.zoneId.startsWith("dungeon:")) {
          this.colorGrading.saturate(-0.3, true);
          this.colorGrading.contrast(1.15, true);
          this.colorGrading.brightness(0.85, true);
          this.screenEffects.setVignetteIntensity(0.3);
          this.screenEffects.enableFog(true);
        } else if (zoneName.includes("Forest") || zoneName.includes("Darkwood")) {
          this.colorGrading.saturate(-0.15, true);
          this.colorGrading.brightness(0.95, true);
          this.screenEffects.setVignetteIntensity(0.18);
          this.screenEffects.enableFog(false);
        } else if (zoneName.includes("Field")) {
          this.colorGrading.saturate(0.1, true);
          this.colorGrading.brightness(1.05, true);
          this.screenEffects.setVignetteIntensity(0.12);
          this.screenEffects.enableFog(false);
        } else {
          this.screenEffects.setVignetteIntensity(0.12);
          this.screenEffects.enableFog(false);
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
      this.sky.resize(this.app.screen.width, this.app.screen.height);
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
      // Keyboard/joystick input cancels any active pathfinding
      this.pathFollower.cancel();
      state.updateLocalPlayer({
        x: lp.x + move.dx * PLAYER_SPEED * dt,
        y: lp.y + move.dy * PLAYER_SPEED * dt,
      });
      this.camera.setMovementLead(move.dx, move.dy);
    } else if (this.pathFollower.isActive()) {
      // Follow computed path
      const pathDir = this.pathFollower.getDirection(lp.x, lp.y);
      if (pathDir) {
        state.updateLocalPlayer({
          x: lp.x + pathDir.dx * PLAYER_SPEED * dt,
          y: lp.y + pathDir.dy * PLAYER_SPEED * dt,
        });
        this.camera.setMovementLead(pathDir.dx, pathDir.dy);
        // Send to server at tick rate
        this.pathSendTimer += dt;
        if (this.pathSendTimer >= 0.1) {
          this.pathSendTimer -= 0.1;
          this.pathSeq++;
          this.socket.send({
            op: Op.C_MOVE,
            d: { seq: this.pathSeq, dx: pathDir.dx, dy: pathDir.dy, timestamp: Date.now() },
          } as ClientMessage);
        }
      } else {
        // Arrived at destination — execute pending action if any
        const action = this.pathFollower.getPendingAction();
        if (action) {
          this.executePendingAction(action);
        }
        this.camera.setMovementLead(0, 0);
      }
    } else {
      this.camera.setMovementLead(0, 0);
    }

    const current = useGameStore.getState().localPlayer;
    if (!current) return;

    // Update camera
    this.camera.setTarget(current.x, current.y);
    this.camera.update();

    // Footstep dust particles
    const dustDist = Math.sqrt((current.x - this.lastDustX) ** 2 + (current.y - this.lastDustY) ** 2);
    if (dustDist > 0.5) {
      this.lastDustX = current.x;
      this.lastDustY = current.y;
      const dustTile = state.tiles?.[Math.floor(current.y)]?.[Math.floor(current.x)];
      if (dustTile === TileType.DIRT || dustTile === TileType.SAND || dustTile === TileType.COBBLESTONE) {
        const dustIso = cartToIso(current.x, current.y);
        this.particles.emit(dustIso.x, dustIso.y + ISO_TILE_H * 0.3, 3, {
          texType: "circle",
          tint: dustTile === TileType.SAND ? 0xc2b280 : 0x998877,
          speed: 15, spread: Math.PI, life: 0.4, gravity: -10,
          baseScale: 0.5, scaleDecay: 1,
        });
      }
    }

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

    // Remove stale entity sprites that no longer exist in the store
    this.entities.pruneStaleSprites(state.entities);

    // Clean up dead entities that have despawned from the store
    for (const eid of this.deadEntities) {
      if (!state.entities.has(eid)) this.deadEntities.delete(eid);
    }

    // Auto-attack: keep sending C_ATTACK while target is alive
    if (this.currentTarget !== null) {
      const targetEntity = state.entities.get(this.currentTarget);
      if (!targetEntity || this.deadEntities.has(this.currentTarget)) {
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
    this.chatBubbles.update(dt, (eid) => {
      const e = state.entities.get(eid);
      if (!e) {
        const lp = state.localPlayer;
        if (lp && lp.eid === eid) return { x: lp.x, y: lp.y };
        return null;
      }
      return { x: e.nextX, y: e.nextY };
    });
    this.particles.update(dt);
    this.screenEffects.update(dt);
    this.telegraphs.update(dt);
    this.minimap.update(dt);
    this.worldMap.update(dt);

    // Lighting system
    this.lighting.setCamera(current.x, current.y, this.camera.zoom);
    this.lighting.update(dt, current.x, current.y);
    this.sky.update(dt, this.lighting.getTimeOfDay(), current.x, current.y);
    this.ambientParticles.isNight = this.lighting.isNight();

    // Skill bar cooldown ticking
    this.skillBar.update(dt);

    // Chat
    this.chatPanel.update();

    // Ambient particles
    const bounds = this.camera.getViewBounds();
    // getViewBounds returns iso-pixel space; pass directly to ambient particles
    this.ambientParticles.setCamera(
      bounds.left,
      bounds.top,
      bounds.right - bounds.left,
      bounds.bottom - bounds.top,
    );
    this.ambientParticles.update(dt, current.x, current.y);
  }

  private setupSocket(): void {
    this.socket.onMessage((msg) => this.dispatcher.handle(msg));
  }

  private setupInputCallbacks(): void {
    this.input.onAttack = (eid: number) => {
      const entity = useGameStore.getState().entities.get(eid);
      if (!entity || this.deadEntities.has(eid)) return;
      const lp = useGameStore.getState().localPlayer;
      if (!lp) return;

      const dist = Math.sqrt((lp.x - entity.nextX) ** 2 + (lp.y - entity.nextY) ** 2);
      const actionRange = 2.0;

      if (dist <= actionRange) {
        // In range — execute immediately
        this.executeEntityAction(eid, entity);
      } else if (lp.isGod) {
        // God players teleport to entity and act
        this.socket.send({ op: Op.C_GOD_TELEPORT, d: { x: entity.nextX, y: entity.nextY } } as ClientMessage);
        useGameStore.getState().updateLocalPlayer({ x: entity.nextX, y: entity.nextY });
        setTimeout(() => this.executeEntityAction(eid, entity), 100);
      } else {
        // Out of range — pathfind to within range, then act
        const tiles = useGameStore.getState().tiles;
        if (!tiles) return;
        const path = findPath(tiles, lp.x, lp.y, entity.nextX, entity.nextY);
        if (path && path.length > 0) {
          const trimmed = trimPathToRange(path, entity.nextX, entity.nextY, actionRange - 0.3);
          const actionType: PendingAction["type"] =
            entity.type === EntityType.NPC ? "interact"
            : entity.type === EntityType.GROUND_ITEM ? "pickup"
            : "attack";
          this.pathFollower.setPath(trimmed, { type: actionType, targetEid: eid });
          // Show target ring for visual feedback
          if (entity.type !== EntityType.NPC && entity.type !== EntityType.GROUND_ITEM) {
            this.entities.setTargetHighlight(eid);
          }
        }
      }
    };

    this.input.onGroundClick = (worldX: number, worldY: number) => {
      this.clearTarget();
      const store = useGameStore.getState();
      const tiles = store.tiles;

      // God players teleport instantly
      if (store.localPlayer?.isGod) {
        this.socket.send({ op: Op.C_GOD_TELEPORT, d: { x: worldX, y: worldY } });
        useGameStore.getState().updateLocalPlayer({ x: worldX, y: worldY });
        return;
      }

      const lp = useGameStore.getState().localPlayer;
      if (!tiles || !lp) return;
      const path = findPath(tiles, lp.x, lp.y, worldX, worldY);
      if (path && path.length > 0) {
        this.pathFollower.setPath(path);
      }
    };

    this.input.onEmptyClick = () => {
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

  /** Execute an action on an entity that's in range. */
  private executeEntityAction(eid: number, entity: { type: string }): void {
    if (entity.type === EntityType.NPC) {
      this.socket.send({
        op: Op.C_NPC_INTERACT,
        d: { targetEid: eid },
      } as ClientMessage);
      this.clearTarget();
      return;
    }

    if (entity.type === EntityType.GROUND_ITEM) {
      this.socket.send({
        op: Op.C_PICKUP,
        d: { targetEid: eid },
      } as ClientMessage);
      this.clearTarget();
      return;
    }

    // Combat — immediate client-side feedback
    this.audio.playSfx("swing");
    this.entities.triggerAttackAnim(
      useGameStore.getState().localPlayer?.eid ?? 0,
    );
    this.currentTarget = eid;
    this.autoAttackTimer = 0;
    this.entities.setTargetHighlight(eid);
    this.socket.send({
      op: Op.C_ATTACK,
      d: { targetEid: eid },
    } as ClientMessage);
  }

  /** Execute a pending action after pathfinding arrival. */
  private executePendingAction(action: PendingAction): void {
    const entity = useGameStore.getState().entities.get(action.targetEid);
    if (!entity || this.deadEntities.has(action.targetEid)) return;

    switch (action.type) {
      case "attack":
        this.executeEntityAction(action.targetEid, entity);
        break;
      case "pickup":
        this.socket.send({
          op: Op.C_PICKUP,
          d: { targetEid: action.targetEid },
        } as ClientMessage);
        break;
      case "interact":
        this.socket.send({
          op: Op.C_NPC_INTERACT,
          d: { targetEid: action.targetEid },
        } as ClientMessage);
        break;
    }
  }

  private clearTarget(): void {
    this.currentTarget = null;
    this.autoAttackTimer = 0;
    this.entities.setTargetHighlight(null);
  }

  private updateHudButtons(): void {
    const state = useGameStore.getState();
    document.getElementById("btn-inventory")?.classList.toggle("active", state.inventoryOpen);
    document.getElementById("btn-skills")?.classList.toggle("active", state.skillsOpen);
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
