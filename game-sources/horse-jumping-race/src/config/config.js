// تحميل الإعدادات: القيم الافتراضية ← ملف game.config.js ← معاملات الرابط ← إعدادات المنصة/المعلم
export const GAME_ID = 'horse-jumping-race';
export const GAME_TITLE = 'سباق الخيل — قفز الحواجز';
export const GAME_VERSION = '1.1.0';

export const DEFAULTS = {
  race: { segmentSeconds: 6, sprintSeconds: 4, countdownSeconds: 3, competitors: 5, difficulty: 'normal', correctBoost: 0.12, baseSpeedMps: 12, introShot: true },
  questions: { maxQuestions: 6, shuffleChoices: true, answerTimerSeconds: 0, pointsPerCorrect: 10, autoContinueSeconds: { correct: 2.5, wrong: 6 } },
  mode: { default: 'solo', classroomManualContinue: true },
  audio: {
    master: 0.9,
    voice: { enabled: true, volume: 1, readQuestions: false, commentary: true },
    effects: { enabled: true, volume: 0.85 },
    music: { enabled: false, volume: 0.35 },
  },
  graphics: { quality: 'auto', reducedMotion: false, maxPixelRatio: 2 },
  integration: { bridge: 'local', allowedOrigins: [], handshakeTimeoutMs: 10000, gradeTimeoutMs: 12000, protocol: 'qcr-bridge/1' },
  gameId: GAME_ID,
};

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
export function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isObj(over)) return out;
  for (const k of Object.keys(over)) {
    if (isObj(over[k]) && isObj(base?.[k])) out[k] = deepMerge(base[k], over[k]);
    else if (over[k] !== undefined) out[k] = over[k];
  }
  return out;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function sanitize(cfg) {
  cfg.race.segmentSeconds = clamp(Number(cfg.race.segmentSeconds) || 6, 4, 8);
  cfg.race.sprintSeconds = clamp(Number(cfg.race.sprintSeconds) || 4, 3, 6);
  cfg.race.countdownSeconds = clamp(Math.round(Number(cfg.race.countdownSeconds) || 3), 1, 5);
  cfg.race.competitors = clamp(Math.round(Number(cfg.race.competitors) || 5), 1, 5);
  if (!['easy', 'normal', 'hard'].includes(cfg.race.difficulty)) cfg.race.difficulty = 'normal';
  cfg.race.correctBoost = clamp(Number(cfg.race.correctBoost) || 0.12, 0.05, 0.25);
  cfg.questions.maxQuestions = clamp(Math.round(Number(cfg.questions.maxQuestions) || 6), 1, 100);
  cfg.questions.answerTimerSeconds = clamp(Math.round(Number(cfg.questions.answerTimerSeconds) || 0), 0, 300);
  if (!['auto', 'high', 'medium', 'low'].includes(cfg.graphics.quality)) cfg.graphics.quality = 'auto';
  if (!['local', 'postMessage'].includes(cfg.integration.bridge)) cfg.integration.bridge = 'local';
  if (!['solo', 'classroom'].includes(cfg.mode.default)) cfg.mode.default = 'solo';
  return cfg;
}

export function loadConfig() {
  let cfg = deepMerge(DEFAULTS, (typeof window !== 'undefined' && window.HORSE_JUMPING_RACE_CONFIG) || {});
  const p = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const num = (k) => (p.has(k) ? Number(p.get(k)) : undefined);
  const over = {
    race: { segmentSeconds: num('segment'), difficulty: p.get('difficulty') || undefined, competitors: num('competitors') },
    questions: { maxQuestions: num('questions'), answerTimerSeconds: num('timer') },
    graphics: {
      quality: p.get('quality') || undefined,
      reducedMotion: p.has('reducedMotion') ? p.get('reducedMotion') !== '0' : undefined,
    },
    mode: { default: p.get('mode') || undefined },
    integration: {
      // لا نقبل مصدر المنصة من الرابط (أمانًا)؛ يُضبط في game.config.js وإلا فالمصدر نفسه فقط
      bridge: p.get('bridge') || undefined,
    },
  };
  cfg = deepMerge(cfg, over);
  // تفضيل المستخدم لتقليل الحركة من النظام
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches && !p.has('reducedMotion')) {
    cfg.graphics.reducedMotion = true;
  }
  if(p.get('school')==='1'){cfg.integration.bridge='postMessage';cfg.questions.maxQuestions=100;}
  return sanitize(cfg);
}

export function urlFlags() {
  const p = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  return {
    capture: p.has('capture'),
    debug: p.has('debug'),
    sim: p.get('sim') || '', // مثال: latency:1500,fail:1,pending:1 (اختبار المحاكي المحلي)
    autostart: p.has('autostart'),
  };
}
