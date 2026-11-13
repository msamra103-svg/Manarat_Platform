const GAME_ID = "qatar-camel-race";
const GAME_TITLE = "سباق الهجن القطري";
const GAME_VERSION = "1.0.0";
const DEFAULTS = {
  race: { segmentSeconds: 6, sprintSeconds: 4, countdownSeconds: 3, competitors: 5, difficulty: "normal", correctBoost: 0.12, baseSpeedMps: 12, introShot: true },
  questions: { maxQuestions: 6, shuffleChoices: true, answerTimerSeconds: 0, pointsPerCorrect: 10, autoContinueSeconds: { correct: 2.5, wrong: 6 } },
  mode: { default: "solo", classroomManualContinue: true },
  audio: {
    master: 0.9,
    voice: { enabled: true, volume: 1, readQuestions: false, commentary: true },
    effects: { enabled: true, volume: 0.85 },
    music: { enabled: false, volume: 0.35 }
  },
  graphics: { quality: "auto", reducedMotion: false, maxPixelRatio: 2, camelModelUrl: "" },
  integration: { bridge: "local", allowedOrigins: [], handshakeTimeoutMs: 1e4, gradeTimeoutMs: 12e3, protocol: "qcr-bridge/1" },
  gameId: GAME_ID
};
function isObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}
function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isObj(over)) return out;
  for (const k of Object.keys(over)) {
    if (["__proto__", "constructor", "prototype"].includes(k)) continue;
    if (isObj(over[k]) && isObj(base?.[k])) out[k] = deepMerge(base[k], over[k]);
    else if (over[k] !== void 0) out[k] = over[k];
  }
  return out;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
function sanitize(cfg) {
  cfg.race.segmentSeconds = clamp(Number(cfg.race.segmentSeconds) || 6, 4, 8);
  cfg.race.sprintSeconds = clamp(Number(cfg.race.sprintSeconds) || 4, 3, 6);
  cfg.race.countdownSeconds = clamp(Math.round(Number(cfg.race.countdownSeconds) || 3), 1, 5);
  cfg.race.competitors = clamp(Math.round(Number(cfg.race.competitors) || 5), 1, 5);
  if (!["easy", "normal", "hard"].includes(cfg.race.difficulty)) cfg.race.difficulty = "normal";
  cfg.race.correctBoost = clamp(Number(cfg.race.correctBoost) || 0.12, 0.05, 0.25);
  cfg.questions.maxQuestions = clamp(Math.round(Number(cfg.questions.maxQuestions) || 6), 1, 20);
  cfg.questions.answerTimerSeconds = clamp(Math.round(Number(cfg.questions.answerTimerSeconds) || 0), 0, 300);
  if (!["auto", "high", "medium", "low"].includes(cfg.graphics.quality)) cfg.graphics.quality = "auto";
  if (!["local", "postMessage"].includes(cfg.integration.bridge)) cfg.integration.bridge = "local";
  if (!["solo", "classroom"].includes(cfg.mode.default)) cfg.mode.default = "solo";
  return cfg;
}
function loadConfig() {
  let cfg = deepMerge(DEFAULTS, typeof window !== "undefined" && window.QATAR_CAMEL_RACE_CONFIG || {});
  const p = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
  const num = (k) => p.has(k) ? Number(p.get(k)) : void 0;
  const over = {
    race: { segmentSeconds: num("segment"), difficulty: p.get("difficulty") || void 0, competitors: num("competitors") },
    questions: { maxQuestions: num("questions"), answerTimerSeconds: num("timer") },
    graphics: {
      quality: p.get("quality") || void 0,
      reducedMotion: p.has("reducedMotion") ? p.get("reducedMotion") !== "0" : void 0
    },
    mode: { default: p.get("mode") || void 0 },
    integration: {
      // لا نقبل مصدر المنصة من الرابط (أمانًا)؛ يُضبط في game.config.js وإلا فالمصدر نفسه فقط
      bridge: p.get("bridge") || void 0
    }
  };
  cfg = deepMerge(cfg, over);
  if (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches && !p.has("reducedMotion")) {
    cfg.graphics.reducedMotion = true;
  }
  cfg.integration.bridge = "postMessage";
  cfg.integration.allowedOrigins = typeof location !== "undefined" ? [location.origin] : [];
  return sanitize(cfg);
}
function urlFlags() {
  const p = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
  return {
    capture: p.has("capture"),
    debug: p.has("debug"),
    sim: p.get("sim") || "",
    // مثال: latency:1500,fail:1,pending:1 (اختبار المحاكي المحلي)
    autostart: p.has("autostart")
  };
}
export {
  DEFAULTS,
  GAME_ID,
  GAME_TITLE,
  GAME_VERSION,
  deepMerge,
  loadConfig,
  sanitize,
  urlFlags
};
