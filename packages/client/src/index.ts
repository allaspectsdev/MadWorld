import { Application } from "pixi.js";
import { TextureFactory } from "./renderer/TextureFactory.js";
import { generateTileTextures } from "./renderer/TileTextures.js";
import { Game } from "./Game.js";

async function main() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    resolution: window.devicePixelRatio,
  });

  const gameDiv = document.getElementById("game")!;
  gameDiv.insertBefore(app.canvas, gameDiv.firstChild);

  // Initialize procedural texture pipeline
  TextureFactory.init(app);
  generateTileTextures();

  const game = new Game(app);
  game.start();
}

main().catch(console.error);
