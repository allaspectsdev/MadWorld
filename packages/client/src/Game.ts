import { Application } from "pixi.js";
import { TICK_MS, PLAYER_SPEED, Op, type ClientMessage } from "@madworld/shared";
import { Socket } from "./net/Socket.js";
import { Dispatcher } from "./net/Dispatcher.js";
import { useGameStore } from "./state/GameStore.js";
import { Camera } from "./renderer/Camera.js";
import { TilemapRenderer } from "./renderer/TilemapRenderer.js";
import { EntityRenderer } from "./renderer/EntityRenderer.js";
import { HitSplatRenderer } from "./renderer/HitSplatRenderer.js";
import { InputManager } from "./input/InputManager.js";

export class Game {
  private app: Application;
  private socket: Socket;
  private dispatcher: Dispatcher;
  private input: InputManager;
  private camera: Camera;
  private tilemap: TilemapRenderer;
  private entities: EntityRenderer;
  private hitSplats: HitSplatRenderer;

  private isRegistering = false;

  constructor(app: Application) {
    this.app = app;
    this.socket = new Socket();
    this.camera = new Camera();
    this.tilemap = new TilemapRenderer();
    this.entities = new EntityRenderer();
    this.hitSplats = new HitSplatRenderer();
    this.dispatcher = new Dispatcher(this.hitSplats);
    this.input = new InputManager(this.socket);

    // Build scene graph
    this.camera.container.addChild(this.tilemap.container);
    this.camera.container.addChild(this.entities.container);
    this.camera.container.addChild(this.hitSplats.container);
    this.entities.container.sortableChildren = true;
    app.stage.addChild(this.camera.container);
  }

  start(): void {
    this.setupAuth();
    this.setupSocket();
    this.setupClickHandler();

    this.dispatcher.setOnZoneChange(() => {
      const state = useGameStore.getState();
      if (state.tiles) {
        this.tilemap.setTiles(state.tiles);
        this.entities.clear();
      }
    });

    // Game loop
    this.app.ticker.add(() => {
      this.update(this.app.ticker.deltaMS / 1000);
    });

    // Handle resize
    this.camera.setScreenSize(this.app.screen.width, this.app.screen.height);
    window.addEventListener("resize", () => {
      this.camera.setScreenSize(this.app.screen.width, this.app.screen.height);
    });
  }

  private update(dt: number): void {
    const state = useGameStore.getState();
    const lp = state.localPlayer;
    if (!lp || lp.isDead) return;

    // Process input and local prediction
    const move = this.input.update(dt);
    if (move) {
      // Predict locally
      state.updateLocalPlayer({
        x: lp.x + move.dx * PLAYER_SPEED * dt,
        y: lp.y + move.dy * PLAYER_SPEED * dt,
      });
    }

    // Re-read after potential update
    const current = useGameStore.getState().localPlayer;
    if (!current) return;

    // Update camera
    this.camera.setTarget(current.x, current.y);
    this.camera.update();

    // Render local player
    this.entities.setLocalPlayer(current.eid);
    this.entities.updateLocalPlayer(current.x, current.y);

    // Render remote entities with interpolation
    const now = performance.now();
    for (const [eid, entity] of state.entities) {
      const duration = entity.nextTime - entity.prevTime;
      const elapsed = now - entity.nextTime;
      const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
      const ix = entity.prevX + (entity.nextX - entity.prevX) * t;
      const iy = entity.prevY + (entity.nextY - entity.prevY) * t;
      this.entities.updateEntity(eid, ix, iy, entity);
    }

    // Update hit splats
    this.hitSplats.update();
  }

  private setupSocket(): void {
    this.socket.onMessage((msg) => this.dispatcher.handle(msg));
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

        // Success — connect WebSocket with token
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

  private setupClickHandler(): void {
    this.app.canvas.addEventListener("click", (e) => {
      const worldPos = this.camera.screenToWorld(e.clientX, e.clientY);
      const targetEid = this.entities.getEntityAtScreen(
        e.clientX,
        e.clientY,
        worldPos.x,
        worldPos.y,
      );

      if (targetEid !== null) {
        this.socket.send({
          op: Op.C_ATTACK,
          d: { targetEid },
        } as ClientMessage);
      }
    });
  }
}
