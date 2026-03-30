export interface EmoteDef {
  id: string;
  actionText: string;
  bubbleText: string;
  particles?: {
    texType: "circle" | "glow" | "star" | "trail";
    tint: number;
    count: number;
    speed: number;
    spread: number;
    life: number;
    gravity: number;
    baseScale: number;
  };
}

export const EMOTES: Record<string, EmoteDef> = {
  wave:  { id: "wave",  actionText: "waves",              bubbleText: "\u{1F44B}" },
  dance: { id: "dance", actionText: "dances",             bubbleText: "\u{1F3B6}",
           particles: { texType: "star", tint: 0xffd700, count: 12, speed: 35, spread: Math.PI * 2, life: 1.0, gravity: -10, baseScale: 0.7 } },
  cheer: { id: "cheer", actionText: "cheers",             bubbleText: "\u{1F389}",
           particles: { texType: "star", tint: 0xff4488, count: 18, speed: 60, spread: Math.PI * 2, life: 1.2, gravity: 30, baseScale: 0.8 } },
  laugh: { id: "laugh", actionText: "laughs",             bubbleText: "\u{1F602}" },
  bow:   { id: "bow",   actionText: "bows respectfully",  bubbleText: "\u{1F647}" },
  cry:   { id: "cry",   actionText: "cries",              bubbleText: "\u{1F622}",
           particles: { texType: "circle", tint: 0x4488ff, count: 8, speed: 20, spread: Math.PI * 0.6, life: 0.8, gravity: 60, baseScale: 0.5 } },
  think: { id: "think", actionText: "is thinking...",     bubbleText: "\u{1F914}" },
  heart: { id: "heart", actionText: "sends love",         bubbleText: "\u{2764}\uFE0F",
           particles: { texType: "glow", tint: 0xff4466, count: 10, speed: 25, spread: Math.PI * 2, life: 1.5, gravity: -20, baseScale: 0.9 } },
};

export const EMOTE_COOLDOWN_MS = 2500;
