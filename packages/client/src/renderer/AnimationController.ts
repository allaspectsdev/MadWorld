export type AnimPhase = "idle" | "walk" | "attack" | "death";

export interface AnimState {
  phase: AnimPhase;
  timer: number;
  prevX: number;
  prevY: number;
}

const IDLE_BOB_SPEED = 2.5;
const IDLE_BOB_AMOUNT = 1;
const ATTACK_DURATION = 0.15;
const DEATH_DURATION = 0.3;

export function createAnimState(): AnimState {
  return { phase: "idle", timer: 0, prevX: 0, prevY: 0 };
}

export function updateAnimation(
  state: AnimState,
  dt: number,
  x: number,
  y: number,
): { offsetY: number; scaleX: number; scaleY: number; alpha: number } {
  state.timer += dt;

  const moved = Math.abs(x - state.prevX) > 0.01 || Math.abs(y - state.prevY) > 0.01;
  state.prevX = x;
  state.prevY = y;

  // Transition phases
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
      return { offsetY: bob, scaleX: 1, scaleY: 1, alpha: 1 };
    }
    case "walk": {
      const bob = Math.sin(state.timer * 8) * 1.5;
      // Slight horizontal sway
      const sway = Math.sin(state.timer * 4) * 0.03;
      return { offsetY: bob, scaleX: 1 + sway, scaleY: 1 - sway * 0.5, alpha: 1 };
    }
    case "attack": {
      const t = Math.min(state.timer / ATTACK_DURATION, 1);
      const scale = 1 + Math.sin(t * Math.PI) * 0.15;
      if (t >= 1) {
        state.phase = "idle";
        state.timer = 0;
      }
      return { offsetY: 0, scaleX: scale, scaleY: scale, alpha: 1 };
    }
    case "death": {
      const t = Math.min(state.timer / DEATH_DURATION, 1);
      return { offsetY: 0, scaleX: 1 - t * 0.5, scaleY: 1 - t, alpha: 1 - t };
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
