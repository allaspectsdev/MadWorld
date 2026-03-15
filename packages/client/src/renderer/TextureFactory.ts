import { Application, Graphics, Texture, type Renderer } from "pixi.js";

let renderer: Renderer | null = null;
const cache = new Map<string, Texture>();

export const TextureFactory = {
  init(app: Application): void {
    renderer = app.renderer;
  },

  generate(g: Graphics, width: number, height: number): Texture {
    if (!renderer) throw new Error("TextureFactory not initialized");
    return renderer.generateTexture({ target: g, resolution: 1 });
  },

  store(key: string, texture: Texture): void {
    cache.set(key, texture);
  },

  get(key: string): Texture | undefined {
    return cache.get(key);
  },

  getOrThrow(key: string): Texture {
    const t = cache.get(key);
    if (!t) throw new Error(`Texture not found: ${key}`);
    return t;
  },

  has(key: string): boolean {
    return cache.has(key);
  },
};
