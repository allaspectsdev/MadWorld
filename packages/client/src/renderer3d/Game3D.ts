import { PLAYER_SPEED, EntityType, Op, TileType, type ClientMessage } from "@madworld/shared";
import { Socket } from "../net/Socket.js";
import { Dispatcher3D } from "./Dispatcher3D.js";
import { useGameStore } from "../state/GameStore.js";
import { ThreeApp } from "./ThreeApp.js";
import { Camera3D } from "./Camera3D.js";
import { TerrainManager } from "./TerrainManager.js";
import { EntityRenderer3D } from "./EntityRenderer3D.js";
import { DecorationRenderer3D } from "./DecorationRenderer3D.js";
import { FogOfWar3D } from "./FogOfWar3D.js";
import { LightingManager } from "./LightingManager.js";
import { PostProcessing } from "./PostProcessing.js";
import { ParticleSystem3D } from "./ParticleSystem3D.js";
import { AmbientParticles3D } from "./AmbientParticles3D.js";
import { TelegraphRenderer3D } from "./TelegraphRenderer3D.js";
import { SkyDome } from "./SkyDome.js";
import { Minimap } from "../renderer/Minimap.js";
import { AudioManager } from "../audio/AudioManager.js";
import { isBossMob } from "./SpriteBakery.js";
import { PathFollower, type PendingAction } from "../pathfinding/PathFollower.js";
import { findPath, trimPathToRange } from "../pathfinding/Pathfinder.js";
import { initDeviceDetection, isTouchDevice } from "../input/DeviceDetection.js";
import { KeyboardInput } from "../input/KeyboardInput.js";

// UI components (unchanged — pure DOM)
import { PartyHUD } from "../ui/components/PartyHUD.js";
import { PartyInviteModal } from "../ui/components/PartyInviteModal.js";
import { ChatPanel } from "../ui/components/ChatPanel.js";
import { InventoryPanel } from "../ui/components/InventoryPanel.js";
import { QuestLog } from "../ui/components/QuestLog.js";
import { NPCDialog } from "../ui/components/NPCDialog.js";
import { SkillBar } from "../ui/components/SkillBar.js";
import { ShopPanel } from "../ui/components/ShopPanel.js";
import { SettingsPanel } from "../ui/components/SettingsPanel.js";
import { WorldMap } from "../ui/components/WorldMap.js";
import { SkillsPanel } from "../ui/components/SkillsPanel.js";
import { BossHealthBar } from "../ui/components/BossHealthBar.js";
import { AchievementTracker } from "../ui/components/AchievementTracker.js";
import { KeybindHints } from "../ui/components/KeybindHints.js";
import { TradePanel } from "../ui/components/TradePanel.js";
import { TradeInviteModal } from "../ui/components/TradeInviteModal.js";
import { CharacterCreation } from "../ui/components/CharacterCreation.js";

/**
 * Main game orchestrator for the Three.js renderer.
 * Replaces the PixiJS-based Game class.
 */
export class Game3D {
  private threeApp: ThreeApp;
  private socket: Socket;
  private dispatcher: Dispatcher3D;
  private keyboard: KeyboardInput;
  private camera: Camera3D;
  private terrain: TerrainManager;
  private entities: EntityRenderer3D;
  private decorations: DecorationRenderer3D;
  private fog: FogOfWar3D;
  private lighting: LightingManager;
  private postProcess: PostProcessing;
  private particles: ParticleSystem3D;
  private ambientParticles: AmbientParticles3D;
  private telegraphs: TelegraphRenderer3D;
  private sky: SkyDome;
  private minimap: Minimap;
  private audio: AudioManager;

  // UI panels
  private partyHUD: PartyHUD;
  private partyInviteModal: PartyInviteModal;
  private tradePanel: TradePanel;
  private tradeInviteModal: TradeInviteModal;
  private chatPanel: ChatPanel;
  private inventoryPanel: InventoryPanel;
  private skillBar: SkillBar;
  private shopPanel: ShopPanel;
  private settingsPanel: SettingsPanel;
  private questLog: QuestLog;
  private npcDialog: NPCDialog;
  private skillsPanel: SkillsPanel;
  private worldMap: WorldMap;
  private bossHealthBar: BossHealthBar;
  private achievements: AchievementTracker;
  private keybindHints: KeybindHints;

  // Game state
  private isRegistering = false;
  private currentTarget: number | null = null;
  private autoAttackTimer = 0;
  private deadEntities = new Set<number>();
  private pathFollower = new PathFollower();
  private pathSendTimer = 0;
  private pathSeq = 10000;
  private lastDustX = 0;
  private lastDustY = 0;
  private sendTimer = 0;
  private timeOfDay = 6;
  private static readonly AUTO_ATTACK_INTERVAL = 0.5;

  constructor(threeApp: ThreeApp) {
    this.threeApp = threeApp;
    this.socket = new Socket();
    this.camera = new Camera3D(threeApp);
    this.terrain = new TerrainManager(threeApp);
    this.entities = new EntityRenderer3D(threeApp);
    this.decorations = new DecorationRenderer3D(threeApp);
    this.fog = new FogOfWar3D(threeApp);
    this.lighting = new LightingManager(threeApp);
    this.postProcess = new PostProcessing(threeApp);
    this.particles = new ParticleSystem3D(threeApp);
    this.ambientParticles = new AmbientParticles3D(this.particles);
    this.telegraphs = new TelegraphRenderer3D(threeApp);
    this.sky = new SkyDome();
    threeApp.skyGroup.add(this.sky.group);
    this.minimap = new Minimap();
    this.audio = new AudioManager();
    this.achievements = new AchievementTracker();

    this.dispatcher = new Dispatcher3D(
      this.entities,
      this.particles,
      this.postProcess,
      this.telegraphs,
      this.minimap,
      this.audio,
      this.camera,
      this.achievements,
    );

    initDeviceDetection();
    this.keyboard = new KeyboardInput();

    // Setup mouse/click handlers directly
    this.setupMouseHandlers();

    // UI panels
    this.partyHUD = new PartyHUD();
    this.partyInviteModal = new PartyInviteModal(this.socket);
    this.tradePanel = new TradePanel(this.socket);
    this.tradeInviteModal = new TradeInviteModal(this.socket);
    this.chatPanel = new ChatPanel(this.socket);
    this.inventoryPanel = new InventoryPanel(this.socket);
    this.skillBar = new SkillBar();
    this.shopPanel = new ShopPanel(this.socket);
    this.settingsPanel = new SettingsPanel(this.audio, this.camera as any);
    this.questLog = new QuestLog();
    this.npcDialog = new NPCDialog(this.socket);
    this.skillsPanel = new SkillsPanel();
    this.worldMap = new WorldMap();
    this.bossHealthBar = new BossHealthBar();
    this.keybindHints = new KeybindHints();

    // HUD toggle buttons (same as original Game.ts)
    document.getElementById("btn-inventory")?.addEventListener("click", () => {
      const state = useGameStore.getState();
      if (state.skillsOpen) state.toggleSkills();
      state.toggleInventory();
    });
    document.getElementById("btn-skills")?.addEventListener("click", () => {
      const state = useGameStore.getState();
      if (state.inventoryOpen) state.toggleInventory();
      state.toggleSkills();
    });
    document.getElementById("btn-quests")?.addEventListener("click", () => {
      const ql = document.getElementById("quest-log");
      if (ql) ql.classList.toggle("open");
    });
    document.getElementById("btn-map")?.addEventListener("click", () => this.worldMap.toggle());
    document.getElementById("btn-settings")?.addEventListener("click", () => {
      const sp = document.getElementById("settings-panel");
      if (sp) sp.classList.toggle("open");
    });

    this.chatPanel.setOnFocusChange((focused) => {
      this.keyboard.enabled = !focused;
    });

    window.addEventListener("beforeunload", (e) => {
      if (useGameStore.getState().localPlayer) e.preventDefault();
    });

    if (isTouchDevice()) {
      this.camera.setZoom(1.5);
    }
  }

  start(): void {
    this.setupAuth();
    this.socket.onMessage((msg) => this.dispatcher.handle(msg));
    this.setupKeyboardShortcuts();

    this.partyHUD.start();
    this.partyInviteModal.start();
    this.tradePanel.start();
    this.tradeInviteModal.start();
    this.questLog.start();
    this.npcDialog.start();
    this.shopPanel.start();

    useGameStore.subscribe((state) => { this.skillBar.setAbilities(state.abilities); });
    useGameStore.subscribe((state) => { for (const ab of state.abilities) this.skillBar.setCooldown(ab.abilityId, ab.cooldownMs); });

    // Audio init on first interaction
    const initAudio = () => {
      this.audio.init();
      window.removeEventListener("click", initAudio);
      window.removeEventListener("touchstart", initAudio);
      window.removeEventListener("keydown", initAudio);
    };
    window.addEventListener("click", initAudio);
    window.addEventListener("touchstart", initAudio);
    window.addEventListener("keydown", initAudio);

    this.dispatcher.setOnEntityDeath((eid) => {
      this.deadEntities.add(eid);
      if (this.currentTarget === eid) this.clearTarget();
    });

    this.dispatcher.setOnZoneChange(() => {
      const state = useGameStore.getState();
      if (state.tiles) {
        this.minimap.renderTiles(state.tiles);
        this.deadEntities.clear();
        this.pathFollower.cancel();

        // Load terrain from tiles for static zones
        // (Chunk-based zones use S_CHUNK_DATA instead)
        if (state.tiles.length > 0) {
          this.terrain.addChunk(0, 0, state.tiles);
          this.decorations.addChunk(0, 0, state.tiles);
        }

        // Zone lights
        const zoneLights = state.zoneLights ?? [];
        this.lighting.clearPointLights();
        for (const l of zoneLights) {
          this.lighting.addPointLight(l.x, l.y, l.color, 1, l.radius, l.flicker);
        }
        this.ambientParticles.setZoneLights(zoneLights.map(l => ({ x: l.x, z: l.y })));

        // Zone audio
        if (state.localPlayer) {
          this.audio.setZone(state.localPlayer.zoneId, state.localPlayer.zoneName);
        }

        // Ambient particle zone type
        const zoneName = state.localPlayer?.zoneName ?? "";
        if (state.localPlayer?.zoneId.startsWith("dungeon:")) {
          this.ambientParticles.setZone("dungeon");
        } else if (zoneName.includes("Forest") || zoneName.includes("Darkwood")) {
          this.ambientParticles.setZone("forest");
        } else {
          this.ambientParticles.setZone("default");
        }
      }
    });

    // Game loop — wired to ThreeApp's render loop
    this.threeApp.onTick((dt) => this.update(dt));
    this.threeApp.start();
  }

  private update(dt: number): void {
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp || lp.isDead) {
      this.postProcess.update(dt);
      this.particles.update(dt);
      this.telegraphs.update(dt);
      return;
    }

    // Input (keyboard-driven movement)
    const move = this.keyboard.getDirection();
    if (move && (move.dx !== 0 || move.dy !== 0)) {
      this.pathFollower.cancel();
      state.updateLocalPlayer({
        x: lp.x + move.dx * PLAYER_SPEED * dt,
        y: lp.y + move.dy * PLAYER_SPEED * dt,
      });
      this.camera.setMovementLead(move.dx, move.dy);
      // Send to server at 10Hz
      this.sendTimer += dt;
      if (this.sendTimer >= 0.1) {
        this.sendTimer -= 0.1;
        this.pathSeq++;
        this.socket.send({
          op: Op.C_MOVE,
          d: { seq: this.pathSeq, dx: move.dx, dy: move.dy, timestamp: Date.now() },
        } as ClientMessage);
      }
    } else if (this.pathFollower.isActive()) {
      const pathDir = this.pathFollower.getDirection(lp.x, lp.y);
      if (pathDir) {
        state.updateLocalPlayer({
          x: lp.x + pathDir.dx * PLAYER_SPEED * dt,
          y: lp.y + pathDir.dy * PLAYER_SPEED * dt,
        });
        this.camera.setMovementLead(pathDir.dx, pathDir.dy);
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
        const action = this.pathFollower.getPendingAction();
        if (action) this.executePendingAction(action);
        this.camera.setMovementLead(0, 0);
      }
    } else {
      this.camera.setMovementLead(0, 0);
    }

    const current = useGameStore.getState().localPlayer;
    if (!current) return;

    // Camera
    this.camera.setTarget(current.x, current.y);
    this.camera.update(dt);

    // Terrain + water animation
    this.terrain.setPlayerPosition(current.x, current.y);
    this.terrain.update(dt);

    // Render local player
    this.entities.updateEntity(
      current.eid,
      current.x,
      current.y,
      {
        eid: current.eid,
        type: EntityType.PLAYER,
        x: current.x,
        y: current.y,
        name: current.name,
        hp: current.hp,
        maxHp: current.maxHp,
        level: current.level,
        isGod: current.isGod,
        appearance: current.appearance,
        prevX: current.x, prevY: current.y, prevTime: 0,
        nextX: current.x, nextY: current.y, nextTime: 0,
      },
      dt,
    );

    // Remote entities with interpolation
    const now = performance.now();
    const activeEids = new Set<number>([current.eid]);
    for (const [eid, entity] of state.entities) {
      const duration = entity.nextTime - entity.prevTime;
      const elapsed = now - entity.nextTime;
      const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
      const ix = entity.prevX + (entity.nextX - entity.prevX) * t;
      const iy = entity.prevY + (entity.nextY - entity.prevY) * t;
      this.entities.updateEntity(eid, ix, iy, entity, dt);
      activeEids.add(eid);
    }
    this.entities.pruneStale(activeEids);
    this.entities.update(dt);

    // Dead entity cleanup
    for (const eid of this.deadEntities) {
      if (!state.entities.has(eid)) this.deadEntities.delete(eid);
    }

    // Auto-attack
    if (this.currentTarget !== null) {
      const targetEntity = state.entities.get(this.currentTarget);
      if (!targetEntity || this.deadEntities.has(this.currentTarget)) {
        this.clearTarget();
      } else {
        this.autoAttackTimer += dt;
        if (this.autoAttackTimer >= Game3D.AUTO_ATTACK_INTERVAL) {
          this.autoAttackTimer -= Game3D.AUTO_ATTACK_INTERVAL;
          this.audio.playSfx("swing");
          this.entities.attackEntity(current.eid);
          this.socket.send({ op: Op.C_ATTACK, d: { targetEid: this.currentTarget } } as ClientMessage);
        }
      }
    }

    // Visual systems
    this.dispatcher.updateOverlays(dt);
    this.particles.update(dt);
    this.postProcess.setHpRatio(current.hp !== undefined && current.maxHp ? current.hp / current.maxHp : 1);
    this.postProcess.update(dt);
    this.telegraphs.update(dt);
    this.minimap.update(dt);
    this.worldMap.update(dt);
    this.bossHealthBar.update(dt);

    // Lighting + sky
    this.timeOfDay = (this.timeOfDay + dt / 60) % 24; // 24 minute cycle
    this.lighting.setTimeOfDay(this.timeOfDay);
    this.lighting.update(dt, current.x, current.y);
    this.sky.update(dt, this.timeOfDay, current.x, current.y);
    this.entities.setSunTime(this.lighting.getSunDirection());
    this.ambientParticles.setNight(this.timeOfDay >= 15 || this.timeOfDay < 3);
    this.ambientParticles.setPlayerPosition(current.x, current.y);
    this.ambientParticles.update(dt);

    // Fog of war
    this.fog.setCenter(current.x, current.y);

    // Boss health bar tracking
    this.updateBossHealthBar(state);

    // Skill bar cooldowns
    this.skillBar.update(dt);
    this.chatPanel.update();

    // Footstep particles
    const dustDist = Math.sqrt((current.x - this.lastDustX) ** 2 + (current.y - this.lastDustY) ** 2);
    if (dustDist > 0.5) {
      this.lastDustX = current.x;
      this.lastDustY = current.y;
      this.particles.emit(current.x, 0.1, current.y, 3, {
        tint: 0x998877, speed: 2, spread: Math.PI, life: 0.4, gravity: -2, baseScale: 0.3, scaleDecay: 1,
      });
    }
  }

  private setupMouseHandlers(): void {
    const canvas = this.threeApp.canvas;

    canvas.addEventListener("click", (e) => {
      const worldPos = this.camera.screenToWorld(e.clientX, e.clientY);
      const eid = this.entities.getEntityAtScreen(worldPos.x, worldPos.y);
      if (eid !== null) {
        this.onEntityClick(eid);
      } else {
        this.onGroundClick(worldPos.x, worldPos.y);
      }
    });

    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const worldPos = this.camera.screenToWorld(e.clientX, e.clientY);
      const eid = this.entities.getEntityAtScreen(worldPos.x, worldPos.y);
      if (eid !== null) {
        const entity = useGameStore.getState().entities.get(eid);
        if (entity && entity.type === EntityType.PLAYER) {
          this.socket.send({ op: Op.C_PARTY_INVITE, d: { targetEid: eid } } as ClientMessage);
        }
      }
    });

    canvas.addEventListener("mousemove", (e) => {
      const worldPos = this.camera.screenToWorld(e.clientX, e.clientY);
      const eid = this.entities.getEntityAtScreen(worldPos.x, worldPos.y);
      this.entities.setHovered(eid);
    });

    canvas.addEventListener("wheel", (e) => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.camera.setZoom(this.camera.zoom + delta);
    });
  }

  private onEntityClick(eid: number): void {
    const entity = useGameStore.getState().entities.get(eid);
    if (!entity || this.deadEntities.has(eid)) return;
    const lp = useGameStore.getState().localPlayer;
    if (!lp) return;

    const dist = Math.sqrt((lp.x - entity.nextX) ** 2 + (lp.y - entity.nextY) ** 2);
    const actionRange = 2.0;

    if (dist <= actionRange) {
      this.executeEntityAction(eid, entity);
    } else if (lp.isGod) {
      this.socket.send({ op: Op.C_GOD_TELEPORT, d: { x: entity.nextX, y: entity.nextY } } as ClientMessage);
      useGameStore.getState().updateLocalPlayer({ x: entity.nextX, y: entity.nextY });
      setTimeout(() => this.executeEntityAction(eid, entity), 100);
    } else {
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
        if (entity.type !== EntityType.NPC && entity.type !== EntityType.GROUND_ITEM) {
          this.entities.setSelected(eid);
        }
      }
    }
  }

  private onGroundClick(worldX: number, worldY: number): void {
    this.clearTarget();
    const store = useGameStore.getState();
    if (store.localPlayer?.isGod) {
      this.socket.send({ op: Op.C_GOD_TELEPORT, d: { x: worldX, y: worldY } });
      useGameStore.getState().updateLocalPlayer({ x: worldX, y: worldY });
      return;
    }
    const tiles = store.tiles;
    const lp = useGameStore.getState().localPlayer;
    if (!tiles || !lp) return;
    const path = findPath(tiles, lp.x, lp.y, worldX, worldY);
    if (path && path.length > 0) this.pathFollower.setPath(path);
  }

  private executeEntityAction(eid: number, entity: { type: string }): void {
    if (entity.type === EntityType.NPC) {
      this.socket.send({ op: Op.C_NPC_INTERACT, d: { targetEid: eid } } as ClientMessage);
      this.clearTarget();
      return;
    }
    if (entity.type === EntityType.GROUND_ITEM) {
      this.socket.send({ op: Op.C_PICKUP, d: { targetEid: eid } } as ClientMessage);
      this.clearTarget();
      return;
    }
    this.audio.playSfx("swing");
    this.entities.attackEntity(useGameStore.getState().localPlayer?.eid ?? 0);
    this.currentTarget = eid;
    this.autoAttackTimer = 0;
    this.entities.setSelected(eid);
    this.socket.send({ op: Op.C_ATTACK, d: { targetEid: eid } } as ClientMessage);
  }

  private executePendingAction(action: PendingAction): void {
    const entity = useGameStore.getState().entities.get(action.targetEid);
    if (!entity || this.deadEntities.has(action.targetEid)) return;
    switch (action.type) {
      case "attack": this.executeEntityAction(action.targetEid, entity); break;
      case "pickup": this.socket.send({ op: Op.C_PICKUP, d: { targetEid: action.targetEid } } as ClientMessage); break;
      case "interact": this.socket.send({ op: Op.C_NPC_INTERACT, d: { targetEid: action.targetEid } } as ClientMessage); break;
    }
  }

  private clearTarget(): void {
    this.currentTarget = null;
    this.autoAttackTimer = 0;
    this.entities.setSelected(null);
  }

  private updateBossHealthBar(state: ReturnType<typeof useGameStore.getState>): void {
    let bossEid: number | null = null;
    let bossEntity: { name?: string; hp?: number; maxHp?: number } | null = null;
    for (const [eid, entity] of state.entities) {
      if (entity.type === EntityType.MOB && entity.name && isBossMob(entity.name)) {
        bossEid = eid;
        bossEntity = entity;
        break;
      }
    }
    if (bossEid !== null && bossEntity?.hp !== undefined && bossEntity.maxHp) {
      if (this.bossHealthBar.bossEid !== bossEid) {
        this.bossHealthBar.show(bossEid, bossEntity.name ?? "Boss", bossEntity.hp, bossEntity.maxHp);
      } else {
        this.bossHealthBar.updateHp(bossEid, bossEntity.hp, bossEntity.maxHp);
      }
    } else if (this.bossHealthBar.bossEid !== null) {
      this.bossHealthBar.hide();
    }
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener("keydown", (e) => {
      const loginScreen = document.getElementById("login-screen");
      if (loginScreen && loginScreen.style.display !== "none") return;

      if (e.key === "Enter") { e.preventDefault(); this.chatPanel.toggle(); }
      if (!useGameStore.getState().chatOpen) {
        if (e.key === "i" || e.key === "I") { e.preventDefault(); const s = useGameStore.getState(); if (s.skillsOpen) s.toggleSkills(); s.toggleInventory(); }
        if (e.key === "k" || e.key === "K") { e.preventDefault(); const s = useGameStore.getState(); if (s.inventoryOpen) s.toggleInventory(); s.toggleSkills(); }
        if (e.key === "l" || e.key === "L") { e.preventDefault(); useGameStore.getState().toggleQuestLog(); }
        if (e.key === "m" || e.key === "M") { e.preventDefault(); this.worldMap.toggle(); }
        if (e.key >= "2" && e.key <= "8") {
          e.preventDefault();
          const abilityId = this.skillBar.getAbilityForSlot(parseInt(e.key));
          if (abilityId && abilityId !== "auto_attack") {
            this.socket.send({ op: Op.C_USE_SKILL, d: { abilityId, targetEid: this.currentTarget ?? undefined } } as ClientMessage);
          }
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (this.worldMap.isOpen()) this.worldMap.toggle();
        else this.settingsPanel.toggle();
      }
    });
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
      toggleDiv.textContent = this.isRegistering ? "Already have an account? Login" : "Don't have an account? Register";
      errorDiv.textContent = "";
    });

    const enterGame = (token: string) => {
      useGameStore.getState().setToken(token);
      document.getElementById("login-screen")!.style.display = "none";
      document.getElementById("hud")!.style.display = "flex";
      document.getElementById("skill-bar")!.style.display = "flex";
      this.audio.resume();
      this.socket.connect(token);
      setTimeout(() => this.keybindHints.show(), 1500);
    };

    const showCharacterCreation = (token: string) => {
      document.getElementById("login-screen")!.style.display = "none";
      const cc = new CharacterCreation(null as any, async (appearance) => {
        try {
          await fetch("/api/player/appearance", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ appearance }),
          });
        } catch { /* non-critical */ }
        cc.hide();
        enterGame(token);
      });
      cc.show();
    };

    const guestBtn = document.getElementById("guest-btn");
    if (guestBtn) {
      guestBtn.addEventListener("click", async () => {
        errorDiv.textContent = "";
        guestBtn.textContent = "Joining...";
        try {
          const res = await fetch("/api/guest", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          const data = await res.json();
          if (!res.ok) { errorDiv.textContent = data.error || "Failed to create guest"; guestBtn.textContent = "Play as Guest"; return; }
          if (data.isNewPlayer) showCharacterCreation(data.token);
          else enterGame(data.token);
        } catch { errorDiv.textContent = "Failed to connect to server"; guestBtn.textContent = "Play as Guest"; }
      });
    }

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorDiv.textContent = "";
      submitBtn.disabled = true;
      const endpoint = this.isRegistering ? "/api/register" : "/api/login";
      const body: Record<string, string> = { email: emailInput.value, password: passwordInput.value };
      if (this.isRegistering) body.displayName = nameInput.value;
      try {
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) { errorDiv.textContent = data.error || "Something went wrong"; submitBtn.disabled = false; return; }
        if (data.isNewPlayer) showCharacterCreation(data.token);
        else enterGame(data.token);
      } catch { errorDiv.textContent = "Failed to connect to server"; submitBtn.disabled = false; }
    });
  }
}
