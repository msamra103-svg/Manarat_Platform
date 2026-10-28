/* عدّاء قطر — lesson configuration: defaults, validation, storage (namespaced, never touches other games),
 * sample questions (used only until a teacher saves a lesson), and answer shuffling.
 */
(function (root) {
  'use strict';
  const KEY = 'qatarRunner.config.v1';
  const SAMPLE = [
    { id: 's1', text: 'ما عاصمة دولة قطر؟', options: ['الدوحة', 'الوكرة', 'الخور', 'الريان'], correct: 0, image: '' },
    { id: 's2', text: 'كم يساوي ٨ × ٧؟', options: ['٥٤', '٥٦', '٦٤', '٤٨'], correct: 1, image: '' },
    { id: 's3', text: 'ما لون علم دولة قطر مع الأبيض؟', options: ['الأخضر', 'الأزرق', 'العنابي', 'الأسود'], correct: 2, image: '' },
    { id: 's4', text: 'أيّ هذه الكلمات اسمٌ؟', options: ['يجري', 'سريعًا', 'في', 'المدرسة'], correct: 3, image: '' },
    { id: 's5', text: 'الماء يتجمد عند درجة حرارة…', options: ['صفر درجة مئوية', '٥٠ درجة مئوية', '١٠٠ درجة مئوية', '٢٥ درجة مئوية'], correct: 0, image: '' }
  ];
  function defaults() {
    return {
      version: 1, sample: true,
      school: 'مدرسة أبو عبيدة الإعدادية للبنين', teacher: 'المعلم', lesson: 'درس تجريبي', grade: '', className: '', student: '',
      questions: SAMPLE.map(q => Object.assign({}, q, { options: q.options.slice() })),
      answers: 4,            // 2 | 3 | 4 answer choices shown
      attempts: 3,           // hearts for the whole run
      onFail: 'retry-gate',  // 'retry-gate' | 'restart'
      difficulty: 'normal',  // 'easy' | 'normal' | 'hard'  (obstacle density)
      speed: 'normal',       // 'slow' | 'normal' | 'fast'
      timer: 0,              // seconds per question, 0 = no timer
      countdownSound: true,
      gap: 'medium',         // distance between question gates: 'short' | 'medium' | 'long'
      threshold: 60,         // % correct (first try) to count the lesson as passed
      environment: 'tour',   // 'tour' (Corniche → Souq Waqif) | 'corniche' | 'souq'
      dayNight: true,        // light changes from day → sunset → night as questions are answered
      music: 0.7, sfx: 0.9,
      controls: 'auto',      // on-screen buttons: 'auto' (touch devices) | 'on' | 'off'
      quality: 'auto'
    };
  }
  const str = (v, n, d = '') => typeof v === 'string' ? v.trim().slice(0, n) : d;
  const pick = (v, list, d) => list.includes(v) ? v : d;
  const num = (v, a, b, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
  function cleanQuestion(q, i) {
    if (!q || typeof q !== 'object') return null;
    const options = (Array.isArray(q.options) ? q.options : []).map(o => str(String(o == null ? '' : o), 160)).filter(Boolean).slice(0, 4);
    const text = str(q.text, 400);
    if (!text || options.length < 2) return null;
    const correct = num(q.correct, 0, options.length - 1, 0);
    const image = typeof q.image === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(q.image) && q.image.length < 1.6e6 ? q.image : '';
    return { id: str(q.id, 40) || ('q' + (i + 1) + '-' + Math.random().toString(36).slice(2, 7)), text, options, correct, image };
  }
  function validate(c) {
    const d = defaults(), o = Object.assign({}, d);
    if (!c || typeof c !== 'object') return o;
    o.sample = c.sample === true;
    o.school = str(c.school, 150, d.school) || d.school; o.teacher = str(c.teacher, 150, d.teacher) || d.teacher; o.lesson = str(c.lesson, 150, d.lesson) || d.lesson;
    o.grade = str(c.grade, 60); o.className = str(c.className, 60); o.student = str(c.student, 80);
    const qs = Array.isArray(c.questions) ? c.questions.map(cleanQuestion).filter(Boolean).slice(0, 60) : [];
    o.questions = qs.length ? qs : d.questions; if (!qs.length) o.sample = true;
    o.answers = num(c.answers, 2, 4, 4) | 0; o.attempts = num(c.attempts, 1, 9, 3) | 0;
    o.onFail = pick(c.onFail, ['retry-gate', 'restart'], d.onFail);
    o.difficulty = pick(c.difficulty, ['easy', 'normal', 'hard'], d.difficulty); o.speed = pick(c.speed, ['slow', 'normal', 'fast'], d.speed);
    o.timer = num(c.timer, 0, 120, 0) | 0; o.countdownSound = c.countdownSound !== false;
    o.gap = pick(c.gap, ['short', 'medium', 'long'], d.gap); o.threshold = num(c.threshold, 0, 100, 60) | 0;
    o.environment = pick(c.environment, ['tour', 'corniche', 'souq'], d.environment); o.dayNight = c.dayNight !== false;
    o.music = num(c.music, 0, 1, d.music); o.sfx = num(c.sfx, 0, 1, d.sfx);
    o.controls = pick(c.controls, ['auto', 'on', 'off'], d.controls); o.quality = pick(c.quality, ['auto', 'high', 'medium', 'low'], d.quality);
    return o;
  }
  function load() {
    if (root.__QR_EMBEDDED_CONFIG__) return validate(root.__QR_EMBEDDED_CONFIG__);      // student export
    try { const raw = root.localStorage && root.localStorage.getItem(KEY); if (raw) return validate(JSON.parse(raw)); } catch (e) { /* storage blocked */ }
    return defaults();
  }
  function save(c) {
    const v = validate(c);
    try { root.localStorage.setItem(KEY, JSON.stringify(v)); return { ok: true, config: v }; }
    catch (e) { return { ok: false, config: v, error: 'تعذّر الحفظ: مساحة التخزين في المتصفح ممتلئة. قلّل عدد الصور أو أحجامها.' }; }
  }
  function reset() { try { root.localStorage.removeItem(KEY); } catch (e) { /* ignore */ } return defaults(); }
  // Fisher–Yates; returns presented options + where the correct answer went. Never biased to position 0.
  function present(q, count, rnd = Math.random) {
    let idx = q.options.map((_, i) => i);
    if (count < idx.length) { // keep the correct answer, drop random distractors
      const others = idx.filter(i => i !== q.correct); for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
      idx = [q.correct].concat(others.slice(0, count - 1));
    }
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return { order: idx, options: idx.map(i => q.options[i]), correctPos: idx.indexOf(q.correct) };
  }
  const GAPS = { short: 230, medium: 320, long: 430 };
  const SPEEDS = { slow: [6.2, 9.0], normal: [7.4, 10.8], fast: [8.6, 12.5] };
  root.QRConfig = { KEY, SAMPLE, defaults, validate, load, save, reset, present, GAPS, SPEEDS };
})(typeof window !== 'undefined' ? window : globalThis);
