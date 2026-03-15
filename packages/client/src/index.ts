import { Application } from "pixi.js";
import { Game } from "./Game.js";

async function main() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    resolution: 1,
  });

  const gameDiv = document.getElementById("game")!;
  gameDiv.insertBefore(app.canvas, gameDiv.firstChild);

  const game = new Game(app);
  game.start();
}

main().catch(console.error);
