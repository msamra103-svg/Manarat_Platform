// Basketball controller + platform contract (Node, stubbed DOM/scene/audio). Run: node tests/basketball-flow-v23.cjs
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const ORIGIN = 'https://school.example';

function boot({ embedded }) {
  const nodes = new Map(), events = {}, docEvents = {}, posted = [];
  const mk = (id) => {
    const n = {
      id, hidden: false, disabled: false, textContent: '', value: '', dataset: {}, style: {}, attrs: {}, children: [], className: '', type: '',
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, focus() { focused = this; }, addEventListener(k, f) { (this.ev || (this.ev = {}))[k] = f; },
      replaceChildren(...c) { this.children = c; }, querySelector() { return this.children[0] || mk('x'); }, querySelectorAll() { return this.children; },
      set innerHTML(h) { this._html = h; this.lastChild = { textContent: '' }; }, get innerHTML() { return this._html || ''; },
      click() { this.onclick && this.onclick({}); }
    };
    return n;
  };
  let focused = null;
  const node = id => { if (!nodes.has(id)) nodes.set(id, mk(id)); return nodes.get(id); };
  let raf = null, emit = null;
  const sceneCalls = [];
  const sceneState = { mode: 'intro' };
  const parent = { postMessage: (m, origin) => posted.push({ m, origin }) };
  const window = {
    addEventListener: (k, f) => { events[k] = f; }, matchMedia: () => ({ matches: false }), location: { origin: ORIGIN, search: '' },
    SportScene: {
      detectQuality: () => ({ tier: 'low', pixelRatio: 1 }),
      create: (canvas, opts) => { emit = opts.onEvent; return {
        load: () => Promise.resolve(), shoot: () => { sceneCalls.push('shoot'); return true; }, resolve: r => { sceneCalls.push('resolve:' + r); return true; },
        nextRound: () => { sceneCalls.push('next'); return true; }, update() { }, resize() { }, dispose() { }, snapshot: () => ({}), scoreboard: s => { sceneCalls.push('board:' + s.home); },
        setPixelRatio() { }, camera: null, get state() { return sceneState; } }; }
    },
    BasketballAudio: { create: () => ({ unlock: () => Promise.resolve(false), event() { }, crowd() { }, setListener() { }, setMuted(m) { this.m = m; }, setVolume() { }, suspend() { }, resume() { }, stopReactions() { }, close() { }, stats: () => ({}), get muted() { return !!this.m; }, volume: 0.8 }) }
  };
  window.parent = embedded ? parent : window;
  window.window = window;
  const document = {
    body: { dataset: {} }, hidden: false, fullscreenElement: null, getElementById: node,
    addEventListener: (k, f) => { docEvents[k] = f; }, querySelector: () => mk('q'), querySelectorAll: () => [],
    createElement: () => mk('el')
  };
  window.document = document;
  const ctx = { URLSearchParams, window, document, location: window.location, requestAnimationFrame: f => { raf = f; return 1; }, cancelAnimationFrame() { }, setTimeout: () => 0, clearTimeout() { }, setInterval: () => 0, Promise, Math, Number, String, JSON, console, isFinite };
  ctx.globalThis = ctx;
  for (const k of ['SportScene', 'BasketballAudio']) ctx[k] = window[k];
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('games/basketball/game.js', 'utf8'), ctx);
  const msg = (data, over = {}) => events.message({ origin: ORIGIN, source: parent, data, ...over });
  const flush = () => new Promise(r => setImmediate(r));
  return { node, posted, sceneCalls, sceneState, msg, flush, game: window.Basketball, emit: (t, d) => emit(t, d || {}), window, docEvents };
}

(async () => {
  // ---------------- standalone demo ----------------
  {
    const t = boot({ embedded: false });
    await t.flush(); await t.flush();
    assert.equal(t.game.phase, 'welcome', 'welcome after assets');
    assert.equal(t.node('start').disabled, false);
    assert(t.window.ManaratGameControls, 'standalone exposes lifecycle controls to the shared nav');
    t.node('start').click();
    assert.equal(t.game.phase, 'intro');
    t.emit('ready');
    assert.equal(t.game.phase, 'ready');
    t.node('shoot').click();
    assert.deepEqual(t.sceneCalls.filter(c => c === 'shoot'), ['shoot']);
    assert.equal(t.game.phase, 'windup');
    t.node('shoot').click(); // double press ignored
    assert.equal(t.sceneCalls.filter(c => c === 'shoot').length, 1);
    t.emit('question');
    assert.equal(t.game.phase, 'question');
    assert.equal(t.node('choices').children.length, 4, 'demo shows 4 options');
    t.node('choices').children[0].onclick();
    assert(t.sceneCalls.includes('resolve:make'), 'correct demo answer -> make');
    assert.equal(t.game.phase, 'resolve');
    t.emit('outcome', { result: 'make' });
    assert.equal(t.game.phase, 'outcome'); assert.equal(t.game.goals, 1); assert.equal(t.node('bbPoints').textContent, '٢');
    t.node('next').click();
    assert.equal(t.game.phase, 'passing'); assert(t.sceneCalls.includes('next'));
    t.emit('ready'); assert.equal(t.game.round, 1);
    t.node('shoot').click(); t.emit('question'); t.node('choices').children[0].onclick(); // wrong for Q2
    assert(t.sceneCalls.includes('resolve:miss'), 'wrong demo answer -> miss');
    t.emit('outcome', { result: 'miss' });
    assert.equal(t.game.outcome, 'wide'); assert.equal(t.game.goals, 1, 'miss does not score');
    t.node('next').click(); t.emit('ready');
    t.node('shoot').click(); t.emit('question'); t.node('choices').children[2].onclick(); t.emit('outcome', {});
    t.node('next').click();
    assert.equal(t.game.phase, 'finished');
    assert.equal(t.node('summary').hidden, false);
    assert.equal(t.node('sumTitle').textContent, 'تحدّي كرة السلة التدريبي');
    assert.equal(t.node('sumBall').textContent, '٤');
    t.node('again').click();
    assert.equal(t.game.round, 0); assert.equal(t.game.goals, 0);
    // early end through the platform navigation hook
    t.emit('ready');
    await t.window.ManaratGameControls.end();
    assert.equal(t.game.phase, 'finished'); assert.equal(t.node('sumEyebrow').textContent, 'انتهت المحاولة مبكرًا');
    assert.equal(t.posted.length, 0, 'standalone never posts to a parent');
    console.log('PASS standalone demo: start, dribble->shot, question, make, miss, summary, restart, early end');
  }

  // ---------------- embedded in the platform ----------------
  {
    const t = boot({ embedded: true });
    const P = t.posted;
    assert.equal(P[0].m.type, 'school-basketball-ready'); assert.equal(P[0].origin, ORIGIN, 'targetOrigin is the trusted parent origin, never *');
    await t.flush(); await t.flush();
    assert.equal(t.game.phase, 'loading', 'waits for config');
    // invalid origin / source / token
    t.msg({ type: 'school-basketball-config', title: 'X', count: 2, token: 'tok' }, { origin: 'https://evil.example' });
    t.msg({ type: 'school-basketball-config', title: 'X', count: 2, token: 'tok' }, { source: {} });
    t.msg({ type: 'school-basketball-config', title: 'X', count: 2 });
    t.msg('school-basketball-config');
    t.msg({ type: 'school-football-config', title: 'X', count: 2, token: 'tok' });
    assert.equal(t.game.phase, 'loading', 'invalid configs ignored');
    t.msg({ type: 'school-basketball-config', title: 'لعبة النباتات المائية', count: 2, token: 'tok', subject: 'العلوم', teacher: 'أ. أحمد' });
    assert.equal(t.game.phase, 'welcome'); assert.equal(t.game.title, 'لعبة النباتات المائية');
    assert.equal(t.node('assignmentTitle').textContent, 'لعبة النباتات المائية', 'assignment title shown, not a generic name');
    assert.equal(t.node('assignmentMeta').textContent, 'العلوم · المعلّم: أ. أحمد');
    t.msg({ type: 'school-basketball-config', title: 'Other', count: 9, token: 'tok2' });
    assert.equal(t.game.title, 'لعبة النباتات المائية', 'second config ignored'); assert.equal(t.game.total, 2);
    t.node('start').click(); t.emit('ready'); t.node('shoot').click(); t.emit('question');
    const q = P.at(-1).m;
    assert.equal(q.type, 'school-basketball-question'); assert.equal(q.token, 'tok'); assert.equal(q.index, 0);
    assert.equal(t.node('choices').children.length, 0, 'no question/answer keys rendered inside the embedded game');
    t.node('reopen').click(); assert.equal(P.at(-1).m.type, 'school-basketball-question', 'reopen posts question again');
    // invalid results ignored
    t.msg({ type: 'school-basketball-result', token: 'bad', index: 0, correct: true });
    t.msg({ type: 'school-basketball-result', token: 'tok', index: 1, correct: true });
    t.msg({ type: 'school-basketball-result', token: 'tok', index: 0, correct: true }, { origin: 'https://evil.example' });
    t.msg({ type: 'school-basketball-result', token: 'tok', index: 0, correct: true }, { source: {} });
    t.msg({ type: 'school-basketball-advance', token: 'tok', index: 0 });
    assert.equal(t.game.phase, 'question', 'invalid/out-of-phase messages ignored');
    // pending teacher review stays neutral
    t.msg({ type: 'school-basketball-result', token: 'tok', index: 0, correct: false, pending: true, feedback: 'ستراجع المعلمة إجابتك' });
    assert(t.sceneCalls.includes('resolve:pending'));
    t.emit('outcome', { result: 'pending' });
    assert.equal(t.game.outcome, 'pending'); assert.equal(t.game.goals, 0); assert.equal(t.game.correct, 0); assert.equal(t.game.pending, 1);
    assert.equal(t.node('momentLabel').textContent, 'بانتظار مراجعة المعلّم');
    assert.equal(t.node('feedback').dataset.kind, 'pending');
    assert.deepEqual([P.at(-1).m.type, P.at(-1).m.outcome, P.at(-1).m.index, P.at(-1).m.token], ['school-basketball-outcome', 'pending', 0, 'tok']);
    // duplicate result after resolution ignored
    t.msg({ type: 'school-basketball-result', token: 'tok', index: 0, correct: true });
    assert.equal(t.game.goals, 0);
    // next -> host decides; retry re-enables; advance moves on
    t.node('next').click(); assert.equal(P.at(-1).m.type, 'school-basketball-next'); assert.equal(t.node('next').disabled, true);
    t.msg({ type: 'school-basketball-retry', token: 'tok', index: 0 }); assert.equal(t.node('next').disabled, false);
    t.msg({ type: 'school-basketball-advance', token: 'tok', index: 0 });
    assert.equal(t.game.round, 1); assert(t.sceneCalls.includes('next'));
    t.msg({ type: 'school-basketball-advance', token: 'tok', index: 0 }); assert.equal(t.game.round, 1, 'stale advance ignored');
    t.emit('ready'); t.node('shoot').click(); t.emit('question');
    assert.equal(P.at(-1).m.index, 1);
    t.msg({ type: 'school-basketball-result', token: 'tok', index: 1, correct: true, feedback: 'أحسنت', points: 5 });
    assert(t.sceneCalls.includes('resolve:make'));
    t.emit('outcome', {});
    assert.equal(t.game.outcome, 'goal'); assert.equal(t.game.goals, 1); assert.equal(t.node('eduPoints').textContent, '٥');
    assert.equal(P.at(-1).m.outcome, 'goal');
    t.node('fullscreen').onclick(); assert.equal(P.at(-1).m.type, 'school-basketball-fullscreen');
    assert.equal(t.node('assignmentTitle').textContent, 'لعبة النباتات المائية', 'title kept through the final round');
    assert(!t.window.ManaratGameControls, 'embedded game leaves navigation to the platform');
    assert(P.every(p => p.origin === ORIGIN && p.m.type.startsWith('school-basketball-')), 'all posts use the basketball contract and trusted origin');
    // a wrong answer becomes a miss
    const t2 = boot({ embedded: true }); await t2.flush(); await t2.flush();
    t2.msg({ type: 'school-basketball-config', title: 'لعبة النباتات المائية', count: 1, token: 'k' });
    t2.node('start').click(); t2.emit('ready'); t2.node('shoot').click(); t2.emit('question');
    t2.msg({ type: 'school-basketball-result', token: 'k', index: 0, correct: false, pending: false });
    assert(t2.sceneCalls.includes('resolve:miss')); t2.emit('outcome', {});
    assert.equal(t2.game.outcome, 'wide'); assert.equal(t2.game.goals, 0);
    console.log('PASS embedded contract: ready/config/question/result/outcome/next/retry/advance/fullscreen, origin+source+token+index+phase validation, pending neutral, title preserved');
  }
})().catch(e => { console.error(e); process.exit(1); });
