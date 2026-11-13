import "./ui/styles.css";
import { loadConfig, urlFlags, GAME_ID } from "./config/config.mjs";
import { GameController } from "./game/gameController.mjs";
(function bootstrap() {
  const root = document.getElementById("qcr-root");
  if (!root) return;
  const config = loadConfig();
  const flags = urlFlags();
  const game = new GameController(root, config, flags);
  const api = {
    id: GAME_ID,
    version: "1.0.0",
    dispose: () => game.dispose(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    restart: () => game.restart()
  };
  if (flags.debug || flags.capture) api.debug = game.debugAPI();
  window.QatarCamelRace = api;
  window.addEventListener("pagehide", () => game.dispose(), { once: true });
  game.boot();
})();
