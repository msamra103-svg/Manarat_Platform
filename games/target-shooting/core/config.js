/* Target Shooting 3D — game identity, mode catalogue, difficulty presets and teacher configuration.
 * The teacher configuration is plain JSON. sanitize() is the single gate every source passes through
 * (localStorage, an exported student file, the platform's assignment settings), so the game never trusts
 * shapes or ranges it did not check itself.
 */
(function (root) {
  'use strict';
  const TS = root.TS = root.TS || {};
  const GAME_NAME = 'التصويب على الهدف';
  const DEFAULT_SCHOOL = 'مدرسة أبو عبيدة الإعدادية للبنين';
  const KEY = 'target-shooting';

  const MODES = {
    archery: { key: 'archery', title: 'رماية الأسهم', sub: 'ميدان رماية احترافي بحلقات تسجيل حقيقية', target: 'هدف', targets: 'الأهداف' },
    birds: { key: 'birds', title: 'صيد الطيور', sub: 'طيور افتراضية تحلّق فوق مرج جبلي — تحدٍّ رياضي آمن', target: 'طائر', targets: 'الطيور' },
    balloons: { key: 'balloons', title: 'فرقعة البالونات', sub: 'مهرجان مفتوح وبالونات تطفو مع الرياح', target: 'بالون', targets: 'البالونات' },
    clay: { key: 'clay', title: 'الطبق الطائر', sub: 'أطباق تُقذف من منصات إطلاق بمسارات فيزيائية', target: 'طبق', targets: 'الأطباق' }
  };
  const MODE_KEYS = Object.keys(MODES);
  const DIFFICULTY = {
    beginner: { key: 'beginner', title: 'مبتدئ', speed: 0.55, size: 1.45, assist: 0.6, distance: 0.7 },
    intermediate: { key: 'intermediate', title: 'متوسط', speed: 1.0, size: 1.0, assist: 0.25, distance: 1.0 },
    advanced: { key: 'advanced', title: 'متقدم', speed: 1.35, size: 0.8, assist: 0, distance: 1.25 }
  };

  const DEFAULTS = {
    version: 1,
    school: DEFAULT_SCHOOL, department: '', teacher: '', lesson: '',
    mode: 'choice',               // 'choice' lets the student pick; otherwise a MODES key
    difficulty: 'beginner',
    questionCount: 0,             // 0 = every question in the list
    arrowsPerQuestion: 3,         // shots in each scoring round before the question opens
    targetsPerQuestion: 3,        // targets presented in the round
    attempts: 1,                  // answer attempts in the offline version (1 = no retry)
    speed: 1, size: 1,            // teacher multipliers on top of the difficulty preset
    aimAssist: 'auto',            // 'auto' (from difficulty) | 'off' | 'low' | 'high'
    controls: 'standard',         // 'standard' (hold to draw) | 'simple' (tap to shoot)
    timeLimit: 0,                 // seconds per round, 0 = none
    sound: true, music: true,
    celebration: 'normal',        // 'low' | 'normal' | 'high'
    feedback: 'explain',          // 'explain' (show correct answer) | 'brief'
    order: 'fixed',               // 'fixed' | 'random'
    shuffleOptions: true,
    pointsCorrect: 100,           // local game points for a correct answer (offline only; the platform grades officially)
    accent: '#8A1538',
    questions: null               // null = demo questions
  };

  const DEMO_QUESTIONS = [
    { id: 'd1', type: 'multiple_choice', text: 'كم حلقة تسجيل ملونة في هدف الرماية الأولمبي؟', options: ['عشر حلقات', 'خمس حلقات', 'ثلاث حلقات', 'سبع حلقات'], correct: 0, explanation: 'الهدف الأولمبي فيه عشر حلقات بخمسة ألوان؛ لكل لون حلقتان.' },
    { id: 'd2', type: 'true_false', text: 'تسقط السهام نحو الأرض أثناء طيرانها بسبب الجاذبية الأرضية.', options: ['صح', 'خطأ'], correct: 0, explanation: 'الجاذبية تشد السهم إلى الأسفل، لذلك يصوّب الرامي فوق الهدف قليلًا في المسافات البعيدة.' },
    { id: 'd3', type: 'multiple_choice', text: 'ما ناتج ٧ × ٨؟', options: ['٥٤', '٥٦', '٦٤', '٤٨'], correct: 1, explanation: '٧ × ٨ = ٥٦.' },
    { id: 'd4', type: 'multiple_choice', text: 'ما عاصمة دولة قطر؟', options: ['الوكرة', 'الخور', 'الدوحة', 'دخان'], correct: 2, explanation: 'الدوحة عاصمة دولة قطر.' },
    { id: 'd5', type: 'open_text', text: 'اكتب جملة قصيرة عن أهمية التركيز في الرياضة.', explanation: '' }
  ];

  const str = (v, max, d = '') => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : d;
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const oneOf = (v, list, d) => list.includes(v) ? v : d;

  function sanitizeQuestion(q, i) {
    if (!q || typeof q !== 'object') return null;
    const type = oneOf(q.type, ['multiple_choice', 'true_false', 'open_text'], 'multiple_choice');
    const text = str(q.text, 500); if (!text) return null;
    const out = { id: str(q.id, 40) || ('q' + (i + 1)), type, text, explanation: str(q.explanation, 400) };
    if (type === 'multiple_choice') {
      const opts = (Array.isArray(q.options) ? q.options : []).map(o => str(o, 160)).slice(0, 4);
      while (opts.length < 4) opts.push('');
      const filled = opts.filter(Boolean);
      if (filled.length < 2) return null;
      let correct = Number.isInteger(q.correct) ? q.correct : 0;
      if (!opts[correct]) correct = opts.findIndex(Boolean);
      // keep the correct answer's text, drop empty slots
      const keep = opts.map((o, k) => ({ o, k })).filter(x => x.o);
      out.options = keep.map(x => x.o); out.correct = keep.findIndex(x => x.k === correct);
    } else if (type === 'true_false') {
      out.options = ['صح', 'خطأ']; out.correct = q.correct === 1 ? 1 : 0;
    } else {
      out.answers = (Array.isArray(q.answers) ? q.answers : []).map(a => str(a, 160)).filter(Boolean).slice(0, 10);
    }
    if (q.image && typeof q.image === 'string' && /^(data:image\/(png|jpe?g|webp|gif);base64,|https:\/\/)/.test(q.image) && q.image.length < 1500000) out.image = q.image;
    return out;
  }

  function sanitize(input) {
    const c = Object.assign({}, DEFAULTS), x = input && typeof input === 'object' ? input : {};
    c.school = str(x.school, 120) || DEFAULT_SCHOOL;
    c.department = str(x.department, 80); c.teacher = str(x.teacher, 80); c.lesson = str(x.lesson, 140);
    c.mode = oneOf(x.mode, ['choice', ...MODE_KEYS], DEFAULTS.mode);
    c.difficulty = oneOf(x.difficulty, Object.keys(DIFFICULTY), DEFAULTS.difficulty);
    c.questionCount = Math.round(num(x.questionCount, 0, 100, 0));
    c.arrowsPerQuestion = Math.round(num(x.arrowsPerQuestion, 1, 10, DEFAULTS.arrowsPerQuestion));
    c.targetsPerQuestion = Math.round(num(x.targetsPerQuestion, 1, 8, DEFAULTS.targetsPerQuestion));
    c.attempts = Math.round(num(x.attempts, 1, 3, DEFAULTS.attempts));
    c.speed = num(x.speed, 0.4, 1.8, 1); c.size = num(x.size, 0.6, 1.8, 1);
    c.aimAssist = oneOf(x.aimAssist, ['auto', 'off', 'low', 'high'], 'auto');
    c.controls = oneOf(x.controls, ['standard', 'simple'], 'standard');
    c.timeLimit = Math.round(num(x.timeLimit, 0, 600, 0));
    c.sound = x.sound !== false; c.music = x.music !== false;
    c.celebration = oneOf(x.celebration, ['low', 'normal', 'high'], 'normal');
    c.feedback = oneOf(x.feedback, ['explain', 'brief'], 'explain');
    c.order = oneOf(x.order, ['fixed', 'random'], 'fixed');
    c.shuffleOptions = x.shuffleOptions !== false;
    c.pointsCorrect = Math.round(num(x.pointsCorrect, 10, 1000, 100));
    c.accent = /^#[0-9a-fA-F]{6}$/.test(x.accent || '') ? x.accent : DEFAULTS.accent;
    c.questions = Array.isArray(x.questions) ? x.questions.map(sanitizeQuestion).filter(Boolean).slice(0, 100) : null;
    if (c.questions && !c.questions.length) c.questions = null;
    return c;
  }

  /** Assignment settings sent by the platform (subset; the platform never sends questions here). */
  function fromPlatform(s) {
    const x = s && typeof s === 'object' ? s : {};
    return sanitize({
      school: x.school, mode: x.mode, difficulty: x.difficulty, arrowsPerQuestion: x.arrowsPerQuestion,
      targetsPerQuestion: x.targetsPerQuestion, aimAssist: x.aimAssist, controls: x.controls, speed: x.speed, size: x.size,
      celebration: x.celebration, timeLimit: x.timeLimit, sound: x.sound, music: x.music
    });
  }

  function assistStrength(cfg) {
    if (cfg.aimAssist === 'off') return 0;
    if (cfg.aimAssist === 'low') return 0.3;
    if (cfg.aimAssist === 'high') return 0.75;
    return DIFFICULTY[cfg.difficulty].assist;
  }

  TS.config = { GAME_NAME, DEFAULT_SCHOOL, KEY, MODES, MODE_KEYS, DIFFICULTY, DEFAULTS, DEMO_QUESTIONS, sanitize, sanitizeQuestion, fromPlatform, assistStrength };
  if (typeof module !== 'undefined' && module.exports) module.exports = TS.config;
})(typeof window !== 'undefined' ? window : globalThis);
