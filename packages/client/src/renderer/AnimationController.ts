export type AnimPhase = "idle" | "walk" | "attack" | "death";

export interface AnimState {
  phase: AnimPhase;
  timer: number;
  prevX: number;
  prevY: number;
}

const IDLE_BOB_SPEED = 1.5;
const IDLE_BOB_AMOUNT = 0.8;
const IDLE_SWAY = 0.4;
const ATTACK_DURATION = 0.2;
const DEATH_DURATION = 0.5;

export function createAnimState(): AnimState {
  return { phase: "idle", timer: 0, prevX: 0, prevY: 0 };
}

export function updateAnimation(
  state: AnimState,
  dt: number,
  x: number,
  y: number,
): { offsetY: number; offsetX: number; scaleX: number; scaleY: number; alpha: number; rotation: number } {
  state.timer += dt;

  const moved = Math.abs(x - state.prevX) > 0.01 || Math.abs(y - state.prevY) > 0.01;
  state.prevX = x;
  state.prevY = y;

  if (state.phase === "idle" && moved) {
    state.phase = "walk";
    state.timer = 0;
  } else if (state.phase === "walk" && !moved) {
    state.phase = "idle";
    state.timer = 0;
  }

  switch (state.phase) {
    case "idle": {
      const bob = Math.sin(state.timer * IDLE_BOB_SPEED) * IDLE_BOB_AMOUNT;
      const sway = Math.sin(state.timer * 0.8) * IDLE_SWAY;
      return { offsetY: bob, offsetX: sway, scaleX: 1, scaleY: 1, alpha: 1, rotation: 0 };
    }
    case "walk": {
      // Squash-stretch to simulate leg movement
      const cycle = Math.sin(state.timer * 10);
      const squash = cycle * 0.05;
      const bob = Math.abs(Math.sin(state.timer * 10)) * 1.2;
      return {
        offsetY: -bob,
        offsetX: 0,
        scaleX: 1 + squash,
        scaleY: 1 - squash * 0.7,
        alpha: 1,
        rotation: 0,
      };
    }
    case "attack": {
      const t = Math.min(state.timer / ATTACK_DURATION, 1);
      let scaleX = 1;
      let scaleY = 1;
      if (t < 0.25) {
        // Wind-up: shrink
        const p = t / 0.25;
        scaleX = 1 - p * 0.1;
        scaleY = 1 - p * 0.05;
      } else if (t < 0.6) {
        // Strike: expand
        const p = (t - 0.25) / 0.35;
        scaleX = 0.9 + p * 0.3;
        scaleY = 0.95 + p * 0.15;
      } else {
        // Settle
        const p = (t - 0.6) / 0.4;
        scaleX = 1.2 - p * 0.2;
        scaleY = 1.1 - p * 0.1;
      }
      if (t >= 1) {
        state.phase = "idle";
        state.timer = 0;
      }
      return { offsetY: 0, offsetX: 0, scaleX, scaleY, alpha: 1, rotation: 0 };
    }
    case "death": {
      const t = Math.min(state.timer / DEATH_DURATION, 1);
      const rotation = t * (Math.PI / 2);
      const scale = 1 - t * 0.3;
      return {
        offsetY: t * 4,
        offsetX: t * 3,
        scaleX: scale,
        scaleY: scale,
        alpha: 1 - t * t,
        rotation,
      };
    }
  }
}

export function triggerAttack(state: AnimState): void {
  state.phase = "attack";
  state.timer = 0;
}

export function triggerDeath(state: AnimState): void {
  state.phase = "death";
  state.timer = 0;
}
