export type AnimPhase = "idle" | "walk" | "attack" | "death";

export interface AnimState {
  phase: AnimPhase;
  timer: number;
  prevX: number;
  prevY: number;
  facingLeft: boolean;
  hasSprites: boolean;
}

const IDLE_BOB_SPEED = 1.8;
const IDLE_BOB_AMOUNT = 0.6;
const IDLE_SWAY = 0.3;
const IDLE_BREATHE_SPEED = 2.2;
const IDLE_BREATHE_AMOUNT = 0.012; // subtle scale pulse
const ATTACK_DURATION = 0.35;
const DEATH_DURATION = 0.5;

export function createAnimState(): AnimState {
  return { phase: "idle", timer: 0, prevX: 0, prevY: 0, facingLeft: false, hasSprites: false };
}

const NEUTRAL_TRANSFORM = { offsetY: 0, offsetX: 0, scaleX: 1, scaleY: 1, alpha: 1, rotation: 0 };

export function getAnimName(state: AnimState): string {
  return state.phase;
}

export function updateAnimation(
  state: AnimState,
  dt: number,
  x: number,
  y: number,
): { offsetY: number; offsetX: number; scaleX: number; scaleY: number; alpha: number; rotation: number } {
  state.timer += dt;

  const dx = x - state.prevX;
  const moved = Math.abs(dx) > 0.01 || Math.abs(y - state.prevY) > 0.01;

  // Track facing direction based on horizontal movement
  if (Math.abs(dx) > 0.01) {
    state.facingLeft = dx < 0;
  }

  state.prevX = x;
  state.prevY = y;

  if (state.phase === "idle" && moved) {
    state.phase = "walk";
    state.timer = 0;
  } else if (state.phase === "walk" && !moved) {
    state.phase = "idle";
    state.timer = 0;
  }

  // When using sprite sheets, still track state transitions but return neutral transforms
  if (state.hasSprites) {
    // Still need to handle timed phase transitions (attack/death finishing)
    if (state.phase === "attack") {
      const t = Math.min(state.timer / ATTACK_DURATION, 1);
      if (t >= 1) {
        state.phase = "idle";
        state.timer = 0;
      }
    } else if (state.phase === "death") {
      const t = Math.min(state.timer / DEATH_DURATION, 1);
      return { ...NEUTRAL_TRANSFORM, alpha: 1 - t * t };
    }
    return { ...NEUTRAL_TRANSFORM };
  }

  switch (state.phase) {
    case "idle": {
      const bob = Math.sin(state.timer * IDLE_BOB_SPEED) * IDLE_BOB_AMOUNT;
      const sway = Math.sin(state.timer * 0.8) * IDLE_SWAY;
      // Breathing: subtle chest-expand cycle
      const breathe = Math.sin(state.timer * IDLE_BREATHE_SPEED);
      const scaleX = 1 + breathe * IDLE_BREATHE_AMOUNT;
      const scaleY = 1 - breathe * IDLE_BREATHE_AMOUNT * 0.5; // inverse for chest expand
      return { offsetY: bob, offsetX: sway, scaleX, scaleY, alpha: 1, rotation: 0 };
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
      let offsetX = 0;
      if (t < 0.2) {
        // Wind-up: lean back slightly
        const p = t / 0.2;
        scaleX = 1 - p * 0.08;
        scaleY = 1 + p * 0.04;
        offsetX = -p * 2;
      } else if (t < 0.5) {
        // Strike: lunge forward with visible stretch
        const p = (t - 0.2) / 0.3;
        scaleX = 0.92 + p * 0.38; // up to 1.3
        scaleY = 1.04 - p * 0.08; // slight vertical squash
        offsetX = -2 + p * 6;     // lunge from -2 to +4
      } else {
        // Settle: spring back
        const p = (t - 0.5) / 0.5;
        const ease = 1 - Math.pow(1 - p, 2);
        scaleX = 1.3 - ease * 0.3;
        scaleY = 0.96 + ease * 0.04;
        offsetX = 4 - ease * 4;
      }
      if (t >= 1) {
        state.phase = "idle";
        state.timer = 0;
      }
      return { offsetY: 0, offsetX, scaleX, scaleY, alpha: 1, rotation: 0 };
    }
    case "death": {
      const t = Math.min(state.timer / DEATH_DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const rotation = ease * (Math.PI / 3); // 60 degrees, less cartoonish
      const scale = 1 - ease * 0.5;
      return {
        offsetY: ease * 8,
        offsetX: ease * 3,
        scaleX: scale * (1 + Math.sin(t * 8) * 0.05), // wobble
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
