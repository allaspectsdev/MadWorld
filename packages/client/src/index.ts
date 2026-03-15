import { Application } from "pixi.js";
import { TextureFactory } from "./renderer/TextureFactory.js";
import { generateTileTextures } from "./renderer/TileTextures.js";
import { Game } from "./Game.js";
import { loadSpriteSheets, spriteSheetAnims } from "./renderer/SpriteSheetLoader.js";
import { LoadingScreen } from "./ui/components/LoadingScreen.js";

async function main() {
  const loading = new LoadingScreen();
  loading.setProgress(10, "Initializing...");

  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    resolution: 1,
  });

  const gameDiv = document.getElementById("game")!;
  gameDiv.insertBefore(app.canvas, gameDiv.firstChild);

  loading.setProgress(30, "Generating textures...");

  // Initialize procedural texture pipeline
  TextureFactory.init(app);
  generateTileTextures();

  loading.setProgress(50, "Loading sprites...");
  const sheets = await loadSpriteSheets();
  for (const [key, anims] of sheets) {
    spriteSheetAnims.set(key, anims);
  }

  loading.setProgress(80, "Starting game...");
  const game = new Game(app);
  game.start();

  loading.setProgress(100, "Ready!");
  loading.hide();
}

main().catch(console.error);
