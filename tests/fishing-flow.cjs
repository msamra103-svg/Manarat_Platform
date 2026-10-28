/* Fishing V24 — platform bridge & game-flow tests: exact school-fishing-* contract, trusted parent/origin,
 * token/index guards, one event per question, correct = 1 catch, wrong = 0, pending = neutral 0, standalone demo. */
'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const SRC = ['fishing-physics.js', 'fishing-fish.js', 'fishing-sim.js'].map(f => fs.readFileSync('games/fishing/js/' + f, 'utf8')), GAME = fs.readFileSync('games/fishing/js/game.js', 'utf8');
let checks = 0; const ok = (c, m) => { assert(c, m); checks++; };

function create({ embedded, hash = '' }) {
  const nodes = new Map(), listeners = {}, messages = [], docListeners = {};
  const mk = id => ({ id, hidden: false, disabled: false, textContent: '', value: '', checked: false, dataset: {}, style: {}, children: [], _l: {},
    classList: { s: new Set(), add(...a) { a.forEach(x => this.s.add(x)); }, remove(...a) { a.forEach(x => this.s.delete(x)); }, toggle(x, v) { (v === undefined ? !this.s.has(x) : v) ? this.s.add(x) : this.s.delete(x); }, contains(x) { return this.s.has(x); } },
    setAttribute() {}, focus() {}, addEventListener(k, f) { this._l[k] = f; }, replaceChildren(...c) { this.children = c; }, appendChild(c) { this.children.push(c); }, querySelector() { return this.children[0] || null; },
    get firstElementChild() { return { style: {} }; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) });
  const node = id => { if (!nodes.has(id)) nodes.set(id, mk(id)); return nodes.get(id); };
  const aims = ['left', 'center', 'right'].map(a => { const n = mk('aim-' + a); n.dataset.aim = a; return n; });
  let raf = null, now = 0;
  const parent = { postMessage: (m, o) => messages.push({ ...m, _origin: o }) };
  const window = { addEventListener: (k, f) => { listeners[k] = f; }, location: { origin: 'https://school.test', search: '', hash, protocol: 'https:' }, requestAnimationFrame: f => { raf = f; return 1; }, cancelAnimationFrame() {}, matchMedia: () => ({ matches: false }), devicePixelRatio: 1 };
  window.parent = embedded ? parent : window; window.window = window;
  const document = { hidden: false, body: { dataset: {} }, getElementById: node, querySelector: () => node('aim'), querySelectorAll: () => aims, createElement: () => mk('el'), addEventListener: (k, f) => { docListeners[k] = f; }, fullscreenElement: null };
  const director = { mode: 'auto', cycle() { return 'wide'; }, label() { return ''; }, update() {}, reduced: false };
  window.FishingView = { autoQuality: () => 'high', FishingView: class { constructor(_canvas, opts) { this.qualityName = opts.quality === 'auto' ? 'high' : opts.quality; this.director = director; this.camera = {}; this.under = false; this.fps = 60; this.renderer = { getPixelRatio: () => 1, setPixelRatio() {} }; } load(p) { p(1); return Promise.resolve({}); } update() {} handleEvents() {} resize() {} setReduced() {} snapshot() { return {}; } dispose() {} } };
  const ctx = { window, document, URLSearchParams, Math, JSON, Promise, setTimeout, clearTimeout, setInterval: () => 0, performance: { now: () => now }, localStorage: { getItem: () => null, setItem() {} }, atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'), escape, unescape, decodeURIComponent, encodeURIComponent, console };
  Object.assign(window, ctx); vm.createContext(window);
  SRC.forEach(s => vm.runInContext(s, window)); vm.runInContext(GAME, window);
  const advance = sec => { for (let i = 0; i < Math.ceil(sec / 0.05); i++) { now += 50; raf(now); } };
  const until = (pred, max = 60) => { for (let i = 0; i < max * 20 && !pred(); i++) { now += 50; raf(now); } return pred(); };
  const msg = (type, extra = {}, over = {}) => listeners.message({ origin: 'https://school.test', source: parent, data: { type: 'school-fishing-' + type, token: 'tok-1', index: G().round, ...extra }, ...over });
  const G = () => window.FishingGame;
  return { node, G, advance, until, msg, messages, parent, flush: () => new Promise(r => setImmediate(r)), types: () => messages.map(m => m.type.replace('school-fishing-', '')) };
}

(async () => {
  /* ---------- embedded in the school platform ---------- */
  const t = create({ embedded: true }); await t.flush();
  ok(t.types()[0] === 'ready', 'posts ready on load'); ok(t.messages[0]._origin === 'https://school.test', 'targets own origin only');
  ok(t.G().phase === 'loading', 'waits for config');
  t.msg('config', { count: 3, title: 'مهمة' }, { origin: 'https://evil.test' }); ok(t.G().phase === 'loading', 'config from foreign origin ignored');
  t.msg('config', { count: 3, title: 'مهمة' }, { source: { postMessage() {} } }); ok(t.G().phase === 'loading', 'config from non-parent window ignored');
  t.msg('config', { count: 3, title: 'مهمة العلوم', token: 'tok-1', images: ['', 'a.png'] }); await t.flush();
  ok(t.G().phase === 'welcome' && t.G().total === 3, 'config accepted'); ok(t.node('modeLabel').textContent === 'مهمة العلوم', 'title shown');
  t.msg('config', { count: 9, token: 'evil' }); ok(t.G().total === 3, 'second config ignored');
  t.node('start').onclick(); ok(t.G().phase === 'ready', 'start → ready');
  t.msg('result', { correct: true }); ok(t.G().phase === 'ready', 'result outside question ignored');
  for (let round = 0; round < 3; round++) {
    const kind = ['correct', 'wrong', 'pending'][round];
    ok(t.until(() => t.G().simPhase === 'ready'), 'sim ready r' + round);
    const q0 = t.types().filter(x => x === 'question').length; t.advance(0.2); t.node('cast').onclick({ detail: 0 }); ok(t.G().phase === 'casting', 'cast r' + round);
    ok(t.until(() => t.G().phase === 'question'), 'question reached r' + round);
    t.advance(2); const q = t.types().filter(x => x === 'question').length; ok(q === q0 + 1, 'exactly one question post per round');
    const qm = t.messages.filter(m => m.type === 'school-fishing-question').pop(); ok(qm.token === 'tok-1' && qm.index === round, 'question carries token + index');
    t.node('reopen').onclick(); ok(t.types().filter(x => x === 'question').length === q0 + 2, 'reopen re-posts the question');
    t.msg('result', { correct: true, token: 'wrong' }); ok(t.G().phase === 'question', 'wrong token ignored');
    t.msg('result', { correct: true, index: round + 5 }); ok(t.G().phase === 'question', 'wrong index ignored');
    t.msg('result', { correct: true }, { origin: 'https://evil.test' }); ok(t.G().phase === 'question', 'foreign origin result ignored');
    const before = { c: t.G().catches, m: t.G().misses, p: t.G().pendings };
    t.msg('result', { correct: kind === 'correct', pending: kind === 'pending', feedback: 'ملاحظة المعلم' }); ok(t.G().phase === 'resolve', 'result accepted');
    t.msg('result', { correct: true }); ok(t.G().phase === 'resolve', 'duplicate result ignored');
    ok(t.until(() => t.G().phase === 'outcome', 80), 'outcome reached r' + round);
    t.advance(1);
    ok(t.types().filter(x => x === 'outcome').length === round + 1, 'one outcome post per round');
    const after = { c: t.G().catches, m: t.G().misses, p: t.G().pendings };
    if (kind === 'correct') ok(after.c === before.c + 1 && after.m === before.m && after.p === before.p, 'correct = exactly one catch');
    if (kind === 'wrong') ok(after.c === before.c && after.m === before.m + 1, 'wrong = no catch, escape');
    if (kind === 'pending') ok(after.c === before.c && after.m === before.m && after.p === before.p + 1, 'pending = neutral (no catch, no miss)');
    ok(t.G().sim.catchCount === t.G().catches, 'sim catches == HUD catches');
    ok(t.node('cardText').textContent.includes('ملاحظة المعلم'), 'host feedback displayed');
    t.node('next').onclick(); ok(t.types().filter(x => x === 'next').length === round + 1, 'next posted for round ' + round);
    if (round < 2) { t.msg('advance'); ok(t.G().round === round + 1 && t.G().phase === 'retrieving', 'host advance → round ' + (round + 1)); }
  }
  /* explicit next/advance/retry checks on a fresh session */
  const u = create({ embedded: true }); await u.flush(); u.msg('config', { count: 2, token: 'tok-1' }); await u.flush(); u.node('start').onclick();
  u.until(() => u.G().simPhase === 'ready'); u.node('cast').onclick({ detail: 0 }); u.until(() => u.G().phase === 'question'); u.msg('result', { correct: true }); u.until(() => u.G().phase === 'outcome', 80);
  u.node('next').onclick(); u.node('next').onclick(); ok(u.types().filter(x => x === 'next').length === 1, 'next posted once');
  u.msg('retry'); ok(!u.node('next').disabled, 'retry re-enables next'); u.node('next').onclick(); ok(u.types().filter(x => x === 'next').length === 2, 'next after retry');
  u.msg('advance', { index: 7 }); ok(u.G().round === 0, 'advance with wrong index ignored');
  u.msg('advance'); ok(u.G().round === 1 && u.G().phase === 'retrieving', 'advance → next round');
  u.msg('advance', { index: 0 }); ok(u.G().round === 1, 'stale advance ignored');
  ok(u.until(() => u.G().phase === 'ready', 30), 'line retrieved → ready for round 2');
  u.node('fullscreen').onclick(); await u.flush(); ok(u.types().includes('fullscreen'), 'fullscreen delegated to host');
  ok(u.messages.every(m => /^school-fishing-(ready|question|outcome|next|fullscreen)$/.test(m.type) && m._origin === 'https://school.test'), 'only contract messages, same origin');
  ok(u.messages.filter(m => m.type !== 'school-fishing-ready').every(m => m.token === 'tok-1' && Number.isInteger(m.index)), 'token + index on every message');
  ok(!/supabase|fetch\(\s*['"]http|api\(/i.test(fs.readFileSync('games/fishing/js/game.js', 'utf8')), 'game never contacts grading APIs');

  /* ---------- standalone demo (3 sample questions, clearly labelled, local only) ---------- */
  const d = create({ embedded: false }); await d.flush();
  ok(d.G().phase === 'welcome' && d.G().total === 3 && d.G().localKind === 'demo', 'standalone demo with 3 questions');
  ok(d.node('modeLabel').textContent.includes('تجريبي'), 'demo mode clearly labelled'); ok(d.messages.length === 0, 'standalone never posts to a parent');
  d.node('start').onclick();
  const answers = [1, 0, null]; // correct, wrong (first option of Q2 is correct → choose wrong one), essay → pending
  for (let r = 0; r < 3; r++) {
    d.until(() => d.G().simPhase === 'ready'); d.node('cast').onclick({ detail: 0 }); ok(d.until(() => d.G().phase === 'question'), 'demo question ' + r);
    ok(!d.node('question').hidden, 'in-game question panel visible');
    if (r === 0) d.node('choices').children[1].onclick(); else if (r === 1) d.node('choices').children[2].onclick(); else d.node('essaySend').onclick();
    ok(d.until(() => d.G().phase === 'outcome', 80), 'demo outcome ' + r); d.node('next').onclick();
  }
  ok(d.G().phase === 'finished', 'demo finishes'); ok(d.G().catches === 1 && d.G().misses === 1 && d.G().pendings === 1, 'demo: 1 catch, 1 escape, 1 neutral review');
  ok(JSON.stringify(d.G().results) === JSON.stringify(['catch', 'escape', 'pending']), 'results order');
  /* ---------- teacher local practice link ---------- */
  const qs = [{ text: 'ما عاصمة قطر؟', options: ['الدوحة', 'الخور'], correct: 0 }]; const enc = encodeURIComponent(Buffer.from(unescape(encodeURIComponent(JSON.stringify(qs))), 'binary').toString('base64'));
  const tt = create({ embedded: false, hash: '#q=' + enc }); await tt.flush(); ok(tt.G().localKind === 'teacher' && tt.G().total === 1, 'teacher local questions loaded');
  console.log(`PASS fishing platform flow (${checks} checks): ready/config/question/result/outcome/next/advance/retry/fullscreen contract, origin+source+token+index guards, 1/0/0 catches, demo + teacher practice`);
})().catch(e => { console.error(e); process.exit(1); });
