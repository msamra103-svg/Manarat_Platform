/* Abu Ubaida SchoolResult-style game bridge — embeds Champions Race V8 into Manarat_Platform.
 * IMPORTANT: assessment remains exclusively on the parent school's server.
 * Standalone student / teacher offline exports are NOT changed.
 */
(() => {
  'use strict';
  const enabled = window.parent !== window && new URLSearchParams(location.search).get('school') === '1';
  const origin = location.origin;
  let token = '', total = 0, configured = false, pendingIndex = -1, finished = false;
  let settled = null;
  function post(type, extra = {}) {
    if (!enabled || !token && type !== 'school-race-ready') return;
    parent.postMessage({ type, ...extra, ...(token ? { token } : {}) }, origin);
  }
  function resolveSchoolLogo(input) {
    const value = typeof input === 'string' ? input.trim() : '';
    if (!value || value.length > 5_000_000) return '';
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value)) return value;
    try {
      const u = new URL(value.replace(/^\/+(?=assets\/)/, ''), location.origin + '/');
      return ['https:', 'http:'].includes(u.protocol) && (u.origin === location.origin || u.protocol === 'https:') ? u.href : '';
    } catch (_) { return ''; }
  }
  const bridge = {
    enabled,
    async awaitPlatformConfiguration() {
      if (!enabled) return;
      if (configured) return;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          settled = null;
          reject(new Error('تعذر الاتصال بمنصة المدرسة. افتح اللعبة من رابط المهمة داخل المنصة.'));
        }, 20000);
        settled = () => { clearTimeout(timeout); resolve(); };
        post('school-race-ready');
      });
    },
    snapshot() {
      return { enabled, configured, pendingIndex, finished, total, state: GameEngine.state };
    }
  };
  window.RaceSchoolBridge = bridge;
  if (!enabled) return;
  document.documentElement.style.setProperty('--accent-red', '#8a1538');
  document.documentElement.style.setProperty('--accent-gold', '#ffffff');
  document.documentElement.style.setProperty('--accent-green', '#16a34a');

  // The student iframe must not grade locally. All answers are submitted in the parent,
  // then the server-confirmed outcome is sent back through the validated channel.
  const originalCheckpointTotal = GameEngine.checkpointTotal;
  GameEngine.checkpointTotal = function(poolLen) {
    return Math.max(1, Math.min(100, Number(APP_CONFIG.checkpointCount) || poolLen || 1));
  };
  const originalOpenQuestion = GameEngine.openQuestionForCurrentCheckpoint;
  GameEngine.openQuestionForCurrentCheckpoint = function() {
    if (!configured || this.state === 'QUESTION' || pendingIndex !== -1) return;
    const idx = this.currentCheckpointIndex;
    if (!Number.isInteger(idx) || idx < 0 || idx >= total) return;
    this.state = 'QUESTION';
    this.stats.pauseStartStamp = this.clock;
    pendingIndex = idx;
    document.getElementById('question-overlay')?.classList.add('hidden');
    post('school-race-question', { index: idx });
  };
  const originalResultsModal = UIController.showResultsModal;
  UIController.showResultsModal = function() {
    if (finished) return;
    if (GameEngine.currentCheckpointIndex < total) return;
    finished = true;
    post('school-race-finished', { index: total - 1 });
  };
  UIController.toggleFullscreen = function() { post('school-race-fullscreen'); };

  // Prevent nonplatform configuration from overwriting teacher/quiz identity in the iframe.
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.origin !== origin || !event.data || typeof event.data !== 'object') return;
    const msg = event.data;
    if (msg.type === 'school-race-config') {
      if (configured || !settled || typeof msg.token !== 'string' || !msg.token.trim()) return;
      const count = Number(msg.count);
      if (!Number.isSafeInteger(count) || count < 1 || count > 100) {
        console.error('Race config: school question count must be 1..100');
        return;
      }
      total = count;
      token = msg.token;
      const maxText = (v, n) => typeof v === 'string' ? v.slice(0,n) : '';
      window.__STUDENT_ONLY_BUILD__ = true;
      window.__EXPORTED_CONFIG__ = {
        ...createDefaultConfig(),
        schoolName: maxText(msg.school, 150) || 'مدرسة أبو عبيدة الإعدادية للبنين',
        teacherName: maxText(msg.teacher, 150) || 'المعلم',
        deptName: maxText(msg.subject, 100) || 'منصة الألعاب التعليمية',
        gameTitle: maxText(msg.title, 150) || 'سباق الأبطال ثلاثي الأبعاد',
        gameSubtitle: 'سباق تعليمي ثلاثي الأبعاد — أسئلة وتصحيح منصة المدرسة',
        schoolLogo: resolveSchoolLogo(msg.logo),
        trackId: 'doha',
        carModel: 'ferrari_458_real',
        checkpointCount: count,
        questionOrder: 'fixed',
        questionTimer: 0,
        questions: Array.from({ length: count }, (_, i) => ({
          id: 'platform-' + i, text: 'سؤال من مهمة المعلم',
          type: 'mcq', options: [], correctAnswer: '', enabled: true,
          subject: 'المهمة المدرسية', difficulty: 'متوسط', hint: '', image: ''
        }))
      };
      configured = true;
      settled(); settled = null;
      return;
    }
    if (msg.type !== 'school-race-continue' || !configured || msg.token !== token) return;
    const idx = Number(msg.index);
    if (GameEngine.state !== 'QUESTION' || pendingIndex < 0 || idx !== pendingIndex) return;
    const correct = msg.correct === true;
    const pending = msg.pending === true;
    const engine = GameEngine;
    const cp = engine.checkpoints[pendingIndex];
    if (!cp || cp.cleared) return;
    pendingIndex = -1;
    if (correct) {
      engine.triggerCorrectAnswerCelebration(null);
    } else {
      // Server grades the answer. Pending essays are never treated as wrong.
      if (!pending) {
        engine.stats.wrongAttempts++;
        engine.stats.points = Math.max(0, (engine.stats.points || 0) - 40);
      }
      engine.stats.pausedTimeAccum += Math.max(0, engine.clock - engine.stats.pauseStartStamp);
      engine.state = 'CORRECT_CELEBRATION';
      engine.celebrationDriveThroughActive = true;
      cp.isOpen = true;
      cp.targetAngle = Math.PI * 0.48;
      const color = pending ? 0x93c5fd : 0xf5a623;
      cp.lightMat.color.setHex(color);
      cp.lightMat.emissive.setHex(color);
      document.getElementById('question-overlay')?.classList.add('hidden');
      if (pending) {
        UIController.showBanner('إجابتك في انتظار تصحيح المعلم. تابع القيادة!', 'info');
      } else {
        try { SoundFX.playWrongWarning(); } catch (_) {}
        UIController.showBanner('واصل المحاولة، السؤال التالي فرصة جديدة! 💪', 'warning');
      }
      engine.updateHUD();
    }
  });
})();
