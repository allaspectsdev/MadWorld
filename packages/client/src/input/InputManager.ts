import { EntityType, Op, type ClientMessage } from "@madworld/shared";
import type { Socket } from "../net/Socket.js";
import type { Camera } from "../renderer/Camera.js";
import type { EntityRenderer } from "../renderer/EntityRenderer.js";
import { KeyboardInput } from "./KeyboardInput.js";
import { TouchInput } from "./TouchInput.js";
import { VirtualJoystick } from "./VirtualJoystick.js";
import { ActionButtons } from "./ActionButtons.js";
import { isTouchDevice, onInputModeChange } from "./DeviceDetection.js";
import { useGameStore } from "../state/GameStore.js";

export class InputManager {
  private keyboard: KeyboardInput;
  private touchInput: TouchInput | null = null;
  private joystick: VirtualJoystick | null = null;
  private actionButtons: ActionButtons | null = null;
  private socket: Socket;
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private entities: EntityRenderer;
  private seq = 0;
  private suppressMouseUntil = 0;
  private sendTimer = 0;
  private static readonly SEND_INTERVAL = 0.1; // Send at 10Hz to match server tick rate

  onAttack: ((eid: number) => void) | null = null;
  onPartyInvite: ((eid: number) => void) | null = null;

  constructor(
    socket: Socket,
    canvas: HTMLCanvasElement,
    camera: Camera,
    entities: EntityRenderer,
  ) {
    this.socket = socket;
    this.canvas = canvas;
    this.camera = camera;
    this.entities = entities;

    // Always create keyboard input
    this.keyboard = new KeyboardInput();

    // Set up mouse handlers (desktop)
    this.setupMouseHandlers();

    // Set up touch if on touch device
    if (isTouchDevice()) {
      this.enableTouch();
    }

    // React to device mode changes
    onInputModeChange((isTouch) => {
      if (isTouch && !this.touchInput) {
        this.enableTouch();
      }
    });
  }

  private enableTouch(): void {
    this.joystick = new VirtualJoystick();
    this.touchInput = new TouchInput(this.canvas, this.camera);
    this.actionButtons = new ActionButtons(this.socket);
    this.actionButtons.start();

    // Tap → attack entity
    this.touchInput.onTap = (worldX, worldY, screenX, screenY) => {
      this.suppressMouseUntil = Date.now() + 500;
      const eid = this.entities.getEntityAtScreen(screenX, screenY, worldX, worldY, 2.5);
      if (eid !== null) {
        this.onAttack?.(eid);
      }
    };

    // Long-press → invite player
    this.touchInput.onLongPress = (worldX, worldY, screenX, screenY) => {
      this.suppressMouseUntil = Date.now() + 500;
      const eid = this.entities.getEntityAtScreen(screenX, screenY, worldX, worldY, 2.5);
      if (eid !== null) {
        const entity = useGameStore.getState().entities.get(eid);
        if (entity && entity.type === EntityType.PLAYER) {
          this.onPartyInvite?.(eid);
        }
      }
    };
  }

  private setupMouseHandlers(): void {
    this.canvas.addEventListener("click", (e) => {
      if (Date.now() < this.suppressMouseUntil) return;
      const worldPos = this.camera.screenToWorld(e.clientX, e.clientY);
      const eid = this.entities.getEntityAtScreen(e.clientX, e.clientY, worldPos.x, worldPos.y);
      if (eid !== null) {
        this.onAttack?.(eid);
      }
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (Date.now() < this.suppressMouseUntil) return;
      const worldPos = this.camera.screenToWorld(e.clientX, e.clientY);
      const eid = this.entities.getEntityAtScreen(e.clientX, e.clientY, worldPos.x, worldPos.y);
      if (eid !== null) {
        this.onPartyInvite?.(eid);
      }
    });

    // Scroll wheel zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.camera.setZoom(this.camera.zoom + delta);
    }, { passive: false });
  }

  update(dt: number): { dx: number; dy: number; seq: number } | null {
    // Touch joystick takes priority
    const touchDir = this.joystick?.getDirection();
    const dir = touchDir ?? this.keyboard.getDirection();

    if (!dir) {
      this.sendTimer = 0;
      return null;
    }

    // Only send to server at tick rate (10Hz) to avoid queue buildup
    this.sendTimer += dt;
    if (this.sendTimer >= InputManager.SEND_INTERVAL) {
      this.sendTimer -= InputManager.SEND_INTERVAL;
      this.seq++;

      this.socket.send({
        op: Op.C_MOVE,
        d: { seq: this.seq, dx: dir.dx, dy: dir.dy, timestamp: Date.now() },
      } as ClientMessage);
    }

    // Return direction every frame for smooth client-side prediction
    return { dx: dir.dx, dy: dir.dy, seq: this.seq };
  }

  destroy(): void {
    this.keyboard.destroy();
    this.touchInput?.destroy();
    this.joystick?.destroy();
    this.actionButtons?.destroy();
  }
}
