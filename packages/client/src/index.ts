import { initSpriteBakery } from "./renderer3d/SpriteBakery.js";
import { generateTileTextures } from "./renderer/TileTextures.js";
import { ThreeApp } from "./renderer3d/ThreeApp.js";
import { Game3D } from "./renderer3d/Game3D.js";
import { LoadingScreen } from "./ui/components/LoadingScreen.js";

async function main() {
  const loading = new LoadingScreen();
  loading.setProgress(10, "Initializing...");

  // Create the Three.js canvas
  const canvas = document.createElement("canvas");
  canvas.id = "game-canvas";
  const gameDiv = document.getElementById("game")!;
  gameDiv.insertBefore(canvas, gameDiv.firstChild);

  loading.setProgress(20, "Setting up renderer...");

  // Initialize the Three.js application
  const threeApp = new ThreeApp(canvas);

  loading.setProgress(30, "Generating textures...");

  // Initialize hidden PixiJS sprite bakery + generate tile textures
  await initSpriteBakery();
  generateTileTextures();

  loading.setProgress(70, "Starting game...");

  // Create and start the game
  const game = new Game3D(threeApp);
  game.start();

  loading.setProgress(100, "Ready!");
  loading.hide();
}

main().catch(console.error);
