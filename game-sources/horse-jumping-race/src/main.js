import './ui/styles.css';
import { loadConfig, urlFlags, GAME_ID } from './config/config.js';
import { GameController } from './game/gameController.js';

// نقطة الدخول. كل شيء داخل كائن واحد على window لتجنب التعارض مع متغيرات المنصة.
(function bootstrap() {
  const root = document.getElementById('qcr-root');
  if (!root) return;
  const config = loadConfig();
  const flags = urlFlags();
  // وضع الالتقاط (لقطات/فيديو بزمن يدوي): لا تتقدم حركات CSS دون حلقة رسم حقيقية،
  // فتُعرض العناصر بحالتها النهائية مباشرة حتى تطابق اللقطات ما يراه اللاعب.
  if (flags.capture) {
    const st = document.createElement('style');
    st.textContent = '.qcr *, .qcr *::before, .qcr *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; }';
    document.head.appendChild(st);
  }
  const game = new GameController(root, config, flags);
  const api = {
    id: GAME_ID,
    version: '1.1.0',
    dispose: () => game.dispose(),
    pause: () => game.pause(),
    resume: () => game.resume(),
    restart: () => game.restart(),
  };
  if (flags.debug || flags.capture) api.debug = game.debugAPI();
  window.HorseJumpingRace = api;
  window.addEventListener('pagehide', () => game.dispose(), { once: true });
  game.boot();
})();
