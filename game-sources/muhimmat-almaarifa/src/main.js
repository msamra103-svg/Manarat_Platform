// «مهمّة المعرفة» — نقطة التشغيل وآلة الحالات:
// loading → menu → intro → presenting → question ⇄ (خطأ) → feedback → moving → … → done | failed
import './ui/styles.css';
import * as THREE from 'three';
import { APP_NAME, DEFAULT_PREFS, DEFAULT_RULES, STORAGE_KEYS, WORLD, FEEDBACK, num, countQuestions } from './core/config.js';
import { storage } from './core/storage.js';
import { validateBank, parseBankText } from './core/bank.js';
import { createSession, currentMission, submitAnswer, advance, retryCurrent, summarize } from './core/session.js';
import demoBank from './data/demo-bank.json';
import { Assets } from './gfx/assets.js';
import { createMaterials } from './gfx/materials.js';
import { World, SUN_DIR } from './gfx/world.js';
import { TargetSets } from './gfx/targets.js';
import { ViewModel, POSE } from './gfx/viewmodel.js';
import { FX, Character } from './gfx/fx.js';
import { GameAudio } from './audio/audio.js';
import { Controls } from './input/controls.js';
import { UI, $, downloadText } from './ui/ui.js';
import { TeacherPanel } from './ui/teacher.js';

const QUALITY = {
  low: { maxRatio: 1.25, shadows: false, shadowSize: 512, aniso: 2, tier: '512' },
  medium: { maxRatio: 1.75, shadows: true, shadowSize: 1024, aniso: 4, tier: '512' },
  high: { maxRatio: 2, shadows: true, shadowSize: 2048, aniso: 8, tier: '1k' }
};
const PLAYING = ['intro', 'presenting', 'question', 'feedback', 'moving'];
const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
const pick = list => list[Math.floor(Math.random() * list.length)];
const smooth = t => t * t * (3 - 2 * t);

class Game {
  constructor() {
    this.ui = new UI();
    const saved = storage.read(STORAGE_KEYS.settings, {}) || {};
    this.prefs = { ...DEFAULT_PREFS, ...(saved.prefs || {}) };
    this.rules = { ...DEFAULT_RULES, ...(saved.rules || {}) };
    if (!Array.isArray(this.rules.points) || this.rules.points.length !== 4) this.rules.points = DEFAULT_RULES.points.slice();
    const stored = storage.read(STORAGE_KEYS.bank, null);
    const check = stored ? validateBank(stored) : null;
    this.bank = check && check.ok ? check.bank : validateBank(demoBank).bank;
    this.state = 'loading'; this.paused = false; this.session = null;
    this.timers = []; this.clock = 0; this.lastShot = -1; this.player = new THREE.Vector3(0, 0, 5.6);
    this.move = null; this.kick = 0; this.fps = 60; this.fpsAcc = 0; this.fpsN = 0; this.slow = 0; this.vmVisible = false; this.skipRotate = false;
    this.raycaster = new THREE.Raycaster(); this.raycaster.far = 90;
    this.v1 = new THREE.Vector3(); this.v2 = new THREE.Vector3();
  }

  /** نقطة ربط للمنصات المستضيفة: حدث على النافذة ورسالة postMessage للإطار الأب إن وُجد. */
  notifyHost(type, detail) {
    try {
      window.dispatchEvent(new CustomEvent('mm:' + type, { detail }));
      if (window.parent && window.parent !== window) window.parent.postMessage({ source: 'muhimmat-almaarifa', type, detail }, '*');
    } catch (e) { /* الربط اختياري ولا يؤثر في اللعب */ }
  }

  saveSettings() { return storage.write(STORAGE_KEYS.settings, { prefs: this.prefs, rules: this.rules }); }
  sessionCount() { const n = this.bank.questions.length; return this.rules.questionLimit > 0 ? Math.min(n, this.rules.questionLimit) : n; }

  // ---------- التهيئة ----------
  async init() {
    const ui = this.ui, canvas = $('view');
    ui.setLoading(0.02, 'جارٍ تجهيز الميدان…');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.prefs.quality !== 'low', powerPreference: 'high-performance', stencil: false });
    } catch (e) {
      $('loadText').textContent = 'تعذّر تشغيل الرسوم ثلاثية الأبعاد على هذا المتصفح. جرّب متصفحًا حديثًا مثل Chrome أو Edge أو Safari، وتأكد من تفعيل تسريع الرسوم.';
      $('loadFill').parentElement.classList.add('hidden'); $('loadPct').classList.add('hidden');
      return;
    }
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.6;
    r.shadowMap.type = THREE.PCFShadowMap; r.shadowMap.autoUpdate = false; r.autoClear = false;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; if (PLAYING.includes(this.state)) this.pause(); ui.toast('توقّف عرض الرسوم مؤقتًا. سيُستكمل تلقائيًا، وتقدّمك محفوظ.', 6000); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.shadowDirty = true; });
    this.autoTier = this.detectTier();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, 16 / 9, 0.12, 2600);
    this.camera.rotation.order = 'YXZ';

    // نقطة ربط اختيارية: ‎?bank=رابط‎ يحمّل بنك أسئلة JSON من الموقع المستضيف دون تعديل الحزمة
    const bankUrl = new URLSearchParams(location.search).get('bank');
    if (bankUrl) {
      try {
        const v = parseBankText(await (await fetch(bankUrl)).text());
        if (v.ok) this.bank = v.bank; else this.bootNotice = 'بنك الأسئلة المحدَّد في الرابط غير صالح؛ تُستعمل الأسئلة المحفوظة في الجهاز.';
      } catch (e) { this.bootNotice = 'تعذّر تحميل بنك الأسئلة المحدَّد في الرابط؛ تُستعمل الأسئلة المحفوظة في الجهاز.'; }
    }
    this.assets = new Assets();
    const fontJob = Promise.resolve(); // Arabic system font fallback only
    const tier = QUALITY[this.prefs.quality === 'auto' ? this.autoTier : this.prefs.quality].tier;
    const failed = await this.assets.loadAll(tier, p => ui.setLoading(0.05 + p * 0.7, 'جارٍ تحميل الخامات والنماذج…'));
    await fontJob;
    ui.setLoading(0.8, 'جارٍ بناء المحطات…');
    await new Promise(res => requestAnimationFrame(res));

    this.mats = createMaterials(this.assets);
    this.world = new World(this.scene, this.mats, this.assets);
    const env = this.world.build(this.sessionCount(), r);
    this.targets = new TargetSets(this.scene, this.mats);
    this.fx = new FX(this.scene);
    this.vm = new ViewModel(this.assets, env);
    this.character = new Character(this.scene, this.assets);
    this.audio = new GameAudio(this.prefs);
    this.controls = new Controls(canvas, {
      onFire: ndc => this.onFire(ndc), onSelect: n => this.onSelect(n), onPause: () => this.togglePause(),
      onLockChange: locked => { if (!locked && PLAYING.includes(this.state) && !this.paused && this.controls.wantLock) this.pause(); }
    });
    this.controls.sensitivity = this.prefs.sensitivity;
    ui.setLoading(0.94, 'اللمسات الأخيرة…');
    this.applyQuality();
    this.bindUI();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    document.addEventListener('visibilitychange', () => { if (document.hidden && PLAYING.includes(this.state)) this.pause(); });
    document.addEventListener('fullscreenchange', () => this.resize());
    this.resize();
    r.compile(this.scene, this.camera);
    ui.setLoading(1, 'جاهز');
    this.enterMenu(true);
    this.last = performance.now();
    r.setAnimationLoop(t => this.frame(t));
    if (failed.length) ui.toast('تعذّر تحميل بعض العناصر البصرية، وسيستمر اللعب ببدائل مبسّطة.', 6000);
    else if (this.bootNotice) ui.toast(this.bootNotice, 6000);
    if (new URLSearchParams(location.search).get('school') === '1') window.__mmSchoolGame = this; // واجهة الربط المدرسي فقط
    else if (import.meta.env.DEV && new URLSearchParams(location.search).has('test')) window.__mmTest = this; // التطوير فقط
    if (import.meta.env.DEV) { window.__mm = this; window.__POSE = POSE; }
  }

  detectTier() {
    let name = '';
    try { const gl = this.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); if (ext) name = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ''; } catch (e) { /* تجاهل */ }
    this.software = /swiftshader|llvmpipe|software|basic render/i.test(name);
    if (this.software) return 'low';
    const mobile = matchMedia('(pointer: coarse)').matches, cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    if (mobile) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
    return cores >= 8 ? 'high' : 'medium';
  }

  applyQuality() {
    const tier = this.prefs.quality === 'auto' ? this.autoTier : this.prefs.quality, Q = QUALITY[tier], r = this.renderer;
    this.tier = tier;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.maxRatio));
    const changed = r.shadowMap.enabled !== Q.shadows;
    r.shadowMap.enabled = Q.shadows;
    const sh = this.world.sun.shadow;
    if (sh.mapSize.x !== Q.shadowSize) { sh.mapSize.set(Q.shadowSize, Q.shadowSize); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    this.assets.setAnisotropy(Math.min(Q.aniso, r.capabilities.getMaxAnisotropy()));
    this.assets.setTier(Q.tier);
    if (changed) this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    this.shadowDirty = true; this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight, aspect = w / Math.max(1, h);
    this.renderer.setSize(w, h, false);
    // مجال أفقي لا يقل عن 84° حتى تظهر الأهداف الأربعة كلها على أي نسبة عرض
    const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(42)) / aspect);
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(v), 52, 96);
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    this.vm.resize(aspect);
    const portrait = this.ui.isTouch && h > w * 1.05;
    if (portrait && !this.skipRotate) { this.ui.show('scrRotate'); if (PLAYING.includes(this.state)) this.pause(); }
    else this.ui.hide('scrRotate');
    if (this.session && this.state !== 'menu') { const m = currentMission(this.session); if (m) this.ui.setQuestion(m.question.text); }
  }

  // ---------- ربط الواجهة ----------
  bindUI() {
    const ui = this.ui, on = (id, fn) => $(id).addEventListener('click', e => { e.preventDefault(); this.audio.unlock(); this.audio.play('ui'); fn(e); });
    $('playerName').value = this.prefs.playerName;
    on('btnStart', () => { this.prefs.playerName = $('playerName').value.trim().slice(0, 30); this.saveSettings(); this.controls.requestLock(); this.startSession(); });
    on('btnHow', () => ui.show('scrHow'));
    on('btnSettings', () => this.openSettings());
    on('btnPauseSettings', () => { ui.hide('scrPause'); this.openSettings(); });
    on('btnPause', () => this.pause());
    on('btnResume', () => this.resume());
    on('btnRestart', () => { this.unpauseSilently(); this.controls.requestLock(); this.startSession(); });
    on('btnQuit', () => { this.unpauseSilently(); this.enterMenu(); });
    on('btnRetry', () => this.retry());
    on('btnFailNew', () => { this.controls.requestLock(); this.startSession(); });
    on('btnFailHome', () => this.enterMenu());
    on('btnAgain', () => { this.controls.requestLock(); this.startSession(); });
    on('btnEndHome', () => this.enterMenu());
    on('btnSaveResult', () => this.exportResult());
    on('btnRotateSkip', () => { this.skipRotate = true; ui.hide('scrRotate'); });
    on('btnFullscreen', () => {
      const d = document, el = d.documentElement;
      if (d.fullscreenElement) d.exitFullscreen().catch(() => {}); else if (el.requestFullscreen) el.requestFullscreen().catch(() => ui.toast('ملء الشاشة غير متاح في هذا المتصفح.'));
    });
    if (!document.documentElement.requestFullscreen) $('btnFullscreen').classList.add('hidden');
    for (const id of ['fireL', 'fireR']) $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.onFire(null); });
    ui.onClose = id => { if (id === 'scrSettings' && this.paused) ui.show('scrPause'); };
    ui.bindSettings(this.prefs, key => {
      if (key === 'quality') this.applyQuality();
      if (key === 'sensitivity') this.controls.sensitivity = this.prefs.sensitivity;
      this.audio.unlock(); this.audio.applyPrefs();
      if (key === 'speechOn' && this.prefs.speechOn) { this.updateSpeechNote(); this.audio.speak(['تم تفعيل القراءة الصوتية.']); }
      this.saveSettings();
    });
    this.teacher = new TeacherPanel({
      get bank() { return game.bank; }, get rules() { return game.rules; },
      saveBank: b => { this.bank = b; return storage.write(STORAGE_KEYS.bank, b); },
      saveRules: rl => { this.rules = rl; return this.saveSettings(); },
      persistent: () => storage.available
    }, () => { this.idle = false; this.enterMenu(); });
    on('btnTeacher', () => { this.character.hide(); ui.only('scrTeacher'); this.teacher.open(); this.idle = true; });   // لا رسم خلف لوحة المعلم
    if (window.speechSynthesis && 'onvoiceschanged' in window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => this.updateSpeechNote();
  }

  openSettings() { this.updateSpeechNote(); $('fpsNote').textContent = `مستوى الجودة الحالي: ${{ low: 'منخفضة', medium: 'متوسطة', high: 'عالية' }[this.tier]} — معدل العرض المقاس: ${num(Math.round(this.fps))} إطارًا في الثانية.`; this.ui.show('scrSettings'); }
  updateSpeechNote() {
    const a = this.audio;
    $('speechNote').textContent = !a.speechSupported() ? 'القراءة الصوتية غير مدعومة في هذا المتصفح، واللعب يعمل بدونها.'
      : (a.speechVoice() ? 'قراءة آلية بصوت الجهاز العربي.' : 'لم يُعثر على صوت عربي في هذا الجهاز؛ قد لا تعمل القراءة أو تكون بنطق غير دقيق.');
  }

  // ---------- الشاشة الرئيسية ----------
  enterMenu(first = false) {
    const go = () => {
      this.timers.length = 0; this.session = null; this.paused = false; this.move = null;
      this.audio.suspend(false); this.audio.stopSpeech();
      this.controls.enabled = false; this.controls.releaseLock(); this.controls.reset();
      const n = this.sessionCount();
      this.world.reset(n); this.targets.hideAll(); this.fx.clearDecals();
      this.targets.stage(0, 4);
      this.world.followSun(new THREE.Vector3(0, 0, 6)); this.shadowDirty = true;
      this.vmVisible = false; this.state = 'menu';
      this.character.show(-1.25, 6.4, 3.6);
      this.camera.position.set(1.55, 1.42, 10.4); this.camera.lookAt(-2.9, 1.5, 2.0);
      $('bankNote').textContent = `بنك الأسئلة: ${this.bank.title} — ${countQuestions(n)}`;
      this.ui.showHud(false); this.ui.only('scrStart'); this.ui.fade(false);
    };
    if (first) go(); else { this.ui.fade(true); setTimeout(go, 230); }
  }

  // ---------- الجلسة ----------
  startSession() {
    const v = validateBank(this.bank);
    if (!v.ok) { this.ui.toast('بنك الأسئلة غير صالح. افتح لوحة المعلم لتصحيحه.'); return; }
    this.audio.unlock(); this.audio.suspend(false);
    this.ui.fade(true);
    this.state = 'starting'; this.paused = false;
    setTimeout(() => {
      this.timers.length = 0; this.token = (this.token || 0) + 1;
      this.session = createSession(v.bank, this.rules, (Date.now() ^ (Math.random() * 1e9)) >>> 0);
      const s = this.session, n = s.missions.length;
      this.world.reset(n); this.character.hide(); this.targets.hideAll(); this.fx.clearDecals();
      this.targets.stage(0, s.missions[0].order.length);
      if (n > 1) this.targets.stage(1, s.missions[1].order.length);
      this.player.set(0, 0, 5.6); this.controls.reset(); this.kick = 0;
      this.world.followSun(this.player); this.shadowDirty = true;
      this.vmVisible = true;
      const ui = this.ui; ui.only(null); ui.showHud(true); ui.clearFeedback(); ui.aimed(null);
      ui.setHealth(s.health, s.maxHealth); ui.setScore(0); ui.setMission(0, n); ui.setQuestion('');
      ui.fade(false);
      this.state = 'intro';
      this.notifyHost('session-start', { total: n, bankTitle: this.bank.title });
      this.moveTo(this.world.stand(0), WORLD.introSeconds, () => this.beginQuestion());
    }, 200);
  }

  after(seconds, fn) { this.timers.push({ t: this.clock + seconds, fn, token: this.token }); }

  moveTo(target, seconds, done) {
    this.controls.enabled = false;
    this.controls.aimTo(0, 0, Math.min(0.7, seconds * 0.5));
    this.move = { from: this.player.clone(), to: target.clone(), t: 0, d: seconds, done, step: 0 };
  }

  beginQuestion() {
    const s = this.session, i = s.index, m = currentMission(s), ui = this.ui;
    const options = m.order.map(id => m.question.options.find(o => o.id === id));
    this.targets.present(i, options, m.wrong);
    this.audio.play('boardDown');
    ui.setMission(i, s.missions.length); ui.setQuestion(m.question.text);
    this.state = 'presenting';
    this.after(0.4, () => {
      this.state = 'question'; this.controls.enabled = true; this.shotGate = this.clock + 0.2;
      this.audio.speak([m.question.speech || m.question.text, ...options.map((o, k) => `الخيار ${ORDINALS[k]}: ${o.text}`)]);
    });
  }

  /** كل طرق الإطلاق تنتهي هنا. ndc = موضع اللمسة/النقرة، أو null للتصويب الحالي. */
  onFire(ndc) {
    if (this.state !== 'question' || this.paused || this.aiming()) return;
    if (!ndc) { this.fire(); return; }
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.camera);
    const hit = this.raycaster.intersectObjects([...this.targets.hitMeshes(), ...this.world.occluders], false)[0];
    const point = hit ? hit.point : this.raycaster.ray.at(40, this.v1);
    this.aimAt(point);
  }

  onSelect(n) {
    if (this.state !== 'question' || this.paused || this.aiming()) return;
    const b = this.targets.byBadge(n); if (!b || !b.active) return;
    this.aimAt(b.face.getWorldPosition(this.v1));
  }

  aimAt(point) {
    const d = this.v2.copy(point).sub(this.camera.position);
    this.controls.aimTo(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)), 0.16, () => {
      this.syncCamera(); this.fire();
      this.recenterAt = this.clock + 0.55;      // بعد التصويب باللمس أو المفاتيح يعود النظر للوسط حتى تبقى كل الأهداف ظاهرة
    });
  }

  /** تصويب آلي جارٍ نحو هدف (لا يشمل عودة النظر الهادئة إلى الوسط، فهذه تقطعها أي لمسة جديدة). */
  aiming() { return !!this.controls.tween && !this.controls.tween.passive; }

  fire() {
    if (this.state !== 'question' || this.paused) return;
    if (this.clock - this.lastShot < 0.17 || this.clock < this.shotGate) return;
    this.lastShot = this.clock;
    this.vm.fire(); this.audio.play('shot');
    if (!this.prefs.reduceMotion) this.kick = 0.012;
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    // أقرب تقاطع واحد فقط: لا إصابة عبر الجدران ولا إصابتان بطلقة واحدة
    const hit = this.raycaster.intersectObjects([...this.targets.hitMeshes(), ...this.world.occluders], false)[0];
    const from = this.vm.muzzleWorld(this.camera, this.v1);
    const to = hit ? hit.point.clone() : this.raycaster.ray.at(70, new THREE.Vector3());
    this.fx.shot(from, to);
    if (!hit) return;
    const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : this.raycaster.ray.direction.clone().negate();
    const board = hit.object.userData.board;
    if (board && board.active) {
      this.fx.impact(hit.point, normal, 'board', board.swing); this.audio.play('hitBoard'); this.ui.hitmark();
      this.evaluate(board);
    } else { this.fx.impact(hit.point, normal, 'wall'); this.audio.play('hitWall'); }
  }

  evaluate(board) {
    const s = this.session, m = currentMission(s), ui = this.ui;
    const res = submitAnswer(s, board.optionId);
    if (res.type === 'ignored') return;
    if (res.type === 'wrong') {
      board.setState('wrong'); this.audio.play('wrong');
      ui.setHealth(s.health, s.maxHealth, true);
      const title = pick(FEEDBACK.wrong), hint = m.question.hint ? `تلميح: ${m.question.hint}` : '';
      ui.feedback('no', title, hint); this.audio.speak([title, m.question.hint]);
      const stamp = this.clock; this.fbStamp = stamp;
      if (res.failed) {
        this.state = 'failed'; this.controls.enabled = false;
        this.after(1.0, () => this.showFail());
      } else this.after(3.4, () => { if (this.fbStamp === stamp && this.state === 'question') ui.clearFeedback(); });
      return;
    }
    // إجابة صحيحة: نتيجة مرئية ثم انتقال قصير
    this.state = 'feedback'; this.controls.enabled = false;
    board.setState('correct'); this.fx.successPulse(board.face); this.audio.play('correct');
    ui.setScore(s.score); ui.aimed(null); this.targets.setHover(null);
    const title = `${pick(FEEDBACK.correct)} +${num(res.points)}`;
    ui.feedback('ok', title, m.question.explanation); this.audio.speak([title.replace(/\+.*/, ''), m.question.explanation]);
    const solved = s.missions.filter(x => x.solved).length, i = s.index, hold = Math.max(1, Number(this.rules.feedbackSeconds) || 2.2);
    this.world.setProgress(solved);
    this.world.prepare(Math.min(i + 1, s.missions.length));      // تجهيز المحطات القادمة أثناء لحظة ثابتة
    this.after(0.2, () => { this.world.openGate(i); this.audio.play('gate'); });
    this.after(Math.max(0.8, hold - 0.75), () => { this.targets.retract(); this.audio.play('boardUp'); });
    this.after(hold, () => this.goNext());
  }

  goNext() {
    const s = this.session;
    advance(s);
    this.state = 'moving';
    if (s.status === 'done') {
      this.ui.setMission(s.missions.length, s.missions.length);
      this.moveTo(this.world.stand(s.missions.length), WORLD.moveSeconds, () => this.finish());
    } else {
      const next = s.index + 1;
      this.moveTo(this.world.stand(s.index), WORLD.moveSeconds, () => {
        this.ui.clearFeedback();
        // لوحات المحطة السابقة صارت خلف اللاعب: تُنقل الآن فارغةً ومرفوعةً إلى المحطة بعد التالية
        if (next < s.missions.length) this.targets.stage(next, s.missions[next].order.length);
        this.beginQuestion();
      });
    }
  }

  showFail() {
    const s = this.session;
    this.audio.play('fail'); this.audio.stopSpeech(); this.controls.releaseLock();
    this.ui.clearFeedback(); this.ui.renderFail(summarize(s), currentMission(s), s.index); this.ui.only('scrFail');
  }

  retry() {
    const s = this.session; if (!s || !retryCurrent(s)) return;
    this.controls.requestLock();
    this.ui.only(null); this.ui.setHealth(s.health, s.maxHealth);
    this.beginQuestion();
  }

  finish() {
    const s = this.session, n = s.missions.length;
    this.state = 'done'; this.controls.enabled = false; this.controls.releaseLock();
    this.audio.play('complete'); this.audio.stopSpeech();
    this.result = summarize(s);
    this.notifyHost('session-end', { playerName: this.prefs.playerName, bankTitle: this.bank.title, result: this.result });
    this.ui.fade(true);
    setTimeout(() => {
      const z = -n * WORLD.pitch;
      this.vmVisible = false; this.ui.showHud(false);
      this.character.show(-1.2, z - 2.8, 3.6);
      this.camera.position.set(0.9, 1.5, z + 0.7); this.camera.lookAt(0.4, 1.3, z - 6);
      this.world.followSun(new THREE.Vector3(0, 0, z - 3)); this.shadowDirty = true;
      this.ui.renderEnd(this.result, this.prefs.playerName); this.ui.only('scrEnd'); this.ui.fade(false);
    }, 260);
  }

  exportResult() {
    const r = this.result; if (!r) return;
    const lines = [`${APP_NAME} — نتيجة الجلسة`, `اللاعب: ${this.prefs.playerName || 'غير محدد'}`, `التاريخ: ${new Date().toLocaleString('ar')}`, `بنك الأسئلة: ${this.bank.title}`, '',
      `النقاط: ${num(r.score)} من ${num(r.maxScore)}`, `الإجابات الصحيحة من المحاولة الأولى: ${num(r.firstTry)} من ${num(r.total)} (${num(r.firstTryPercent)}٪)`,
      `عدد الأخطاء: ${num(r.mistakes)}`, `المهمات المكتملة: ${num(r.completed)} من ${num(r.total)}`, `مرات الاستكمال بعد نفاد الصحة: ${num(r.retries)}`, '', 'تفصيل الأسئلة:',
      ...r.missions.map((m, i) => `${num(i + 1)}. ${m.text}\n   الإجابة الصحيحة: ${m.correctText} — عدد الأخطاء: ${num(m.wrong)} — النقاط: ${num(m.points)}`)];
    downloadText(`${APP_NAME} - نتيجة${this.prefs.playerName ? ' ' + this.prefs.playerName : ''}.txt`, lines.join('\r\n'), 'text/plain', true);
  }

  // ---------- الإيقاف المؤقت ----------
  togglePause() { if (this.paused) { if (this.ui.visible('scrPause')) this.resume(); } else this.pause(); }
  pause() {
    if (this.paused || !PLAYING.includes(this.state)) return;
    this.paused = true; this.controls.releaseLock(); this.audio.suspend(true);
    this.ui.show('scrPause');
  }
  unpauseSilently() { this.paused = false; this.ui.hide('scrPause'); this.audio.suspend(false); }
  resume() {
    if (!this.paused) return;
    this.unpauseSilently(); this.controls.requestLock();
    this.shotGate = this.clock + 0.25;       // نقرة «متابعة» لا تُحسب طلقة
  }

  // ---------- الإطار ----------
  syncCamera() {
    const c = this.camera, k = this.prefs.reduceMotion ? 0 : 1;
    const bob = this.move ? Math.sin(this.move.t * this.move.d * 10.5) * 0.022 * k : 0;
    c.position.set(this.player.x, WORLD.eye + bob, this.player.z);
    c.rotation.set(this.controls.pitch + this.kick, this.controls.yaw, 0);
    c.updateMatrixWorld();
  }

  /** خطوة محاكاة واحدة (زمن اللعبة، المؤقتات، الحركة، الأهداف، المؤثرات). */
  step(dt) {
    let busy = false;
    this.clock += dt;
    if (this.timers.length) {
      const due = this.timers.filter(t => t.t <= this.clock); this.timers = this.timers.filter(t => t.t > this.clock);
      for (const t of due) if (t.token === this.token) t.fn();
    }
    const look = this.controls.update(dt);
    if (this.recenterAt) {
      if (look.dx || look.dy || this.controls.pointer || this.state !== 'question') this.recenterAt = 0;     // اللاعب يحرّك النظر بنفسه
      else if (this.clock >= this.recenterAt && !this.controls.tween) { this.controls.aimTo(0, 0, 0.35); this.controls.tween.passive = true; this.recenterAt = 0; }
    }
    if (this.move) {
      const m = this.move; m.t = Math.min(1, m.t + dt / m.d);
      this.player.lerpVectors(m.from, m.to, smooth(m.t));
      if (m.t * m.d >= m.step) { this.audio.play('step'); m.step += 0.34; }
      this.world.followSun(this.player); busy = true;
      if (m.t >= 1) { this.move = null; m.done && m.done(); }
    }
    this.kick = Math.max(0, this.kick - dt * 0.09);
    if (this.world.update(dt)) busy = true;
    if (this.targets.update(dt)) busy = true;
    this.fx.update(dt);
    // هل موضع اللاعب في الشمس أم في ظل جدار؟ (لإضاءة السلاح واليدين بما يطابق المكان)
    this.sunT = (this.sunT || 0) - dt;
    if (this.sunT <= 0 && this.vmVisible) {
      this.sunT = 0.12;
      this.raycaster.set(this.v1.set(this.player.x, WORLD.eye - 0.3, this.player.z), SUN_DIR);
      const lit = this.raycaster.intersectObjects(this.world.occluders.filter(o => o !== this.world.terrain), false).length ? 0 : 1;
      this.sunGoal = lit;
    }
    this.sunlit = (this.sunlit ?? 1) + ((this.sunGoal ?? 1) - (this.sunlit ?? 1)) * Math.min(1, dt * 6);
    return { dx: look.dx, dy: look.dy, busy };
  }

  frame(now) {
    const raw = Math.min(0.25, Math.max(0, (now - this.last) / 1000)); this.last = now;
    this.fpsAcc += raw; this.fpsN += 1;
    if (this.fpsAcc >= 1) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; this.adaptQuality(); }
    if (this.lost || this.idle) return;
    const dt = this.paused ? 0 : raw;
    let busy = false, look = { dx: 0, dy: 0 };
    const inGame = this.state !== 'menu' && this.state !== 'done' && this.state !== 'loading' && this.state !== 'starting';
    if (!this.paused) {
      const n = Math.max(1, Math.ceil(dt / 0.034)), h = dt / n;
      for (let k = 0; k < n; k++) {
        const l = this.step(h); look.dx += l.dx; look.dy += l.dy; if (l.busy) busy = true;
      }
    }
    if (inGame) {
      this.syncCamera();
      if (this.debugCam) { this.camera.position.fromArray(this.debugCam.pos); this.camera.lookAt(...this.debugCam.look); this.camera.updateMatrixWorld(); }
      if (this.state === 'question' && !this.paused) {
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const h = this.raycaster.intersectObjects(this.targets.hitMeshes(), false)[0];
        const board = h ? h.object.userData.board : null;
        this.targets.setHover(board); this.ui.aimed(board);
      }
    } else if (this.character.ok) { this.character.update(raw); busy = true; }
    if (this.vmVisible) this.vm.update(dt, { moving: !!this.move, reduceMotion: this.prefs.reduceMotion, lookDX: look.dx / Math.max(dt, 0.001) * 0.016, lookDY: look.dy / Math.max(dt, 0.001) * 0.016, cameraQuat: this.camera.quaternion, sunlit: this.sunlit ?? 1 });
    const r = this.renderer;
    if (busy || this.shadowDirty) { r.shadowMap.needsUpdate = true; this.shadowDirty = false; }
    r.clear(); r.render(this.scene, this.camera);
    if (this.vmVisible) { r.clearDepth(); r.render(this.vm.scene, this.vm.camera); }
  }

  /** في الوضع التلقائي: إذا قِيس أداء ضعيف لعدة ثوانٍ ننزل درجة جودة واحدة. */
  adaptQuality() {
    if (this.prefs.quality !== 'auto' || !PLAYING.includes(this.state) || this.paused || document.hidden) { this.slow = 0; return; }
    this.slow = this.fps < 27 ? this.slow + 1 : 0;
    if (this.slow >= 4 && this.autoTier !== 'low') { this.autoTier = this.autoTier === 'high' ? 'medium' : 'low'; this.slow = 0; this.applyQuality(); }
  }
}

const game = new Game();
game.init().catch(err => {
  console.error(err);
  const t = document.getElementById('loadText');
  if (t) t.textContent = 'حدث خطأ أثناء تشغيل اللعبة. أعد تحميل الصفحة، وإن تكرر الخطأ فتأكد من تشغيلها عبر خادم ويب وليس بفتح الملف مباشرة.';
});
