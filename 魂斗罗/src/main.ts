import "./style.css";

import { Game } from "./game/game";
import { createUi } from "./game/ui";

const viewport = document.getElementById("viewport");

if (!(viewport instanceof HTMLElement)) {
  throw new TypeError("Missing #viewport game container");
}

const game = new Game(viewport, createUi());
game.run();
