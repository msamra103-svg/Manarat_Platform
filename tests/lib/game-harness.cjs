/* Runs the real games/bowling/game.js (and the real audio.js) in a Node VM with a minimal DOM and a
 * scripted scene stub, so the educational flow and the platform message contract can be tested
 * exhaustively without a GPU. The stub scene emits the same events as the real one. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');

function makeEl(id) {
  const el = {
    id, hidden: false, disabled: false, textContent: '', value: '', checked: false, dataset: {}, style: {}, children: [], attrs: {}, listeners: {},
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(...c) { c.forEach(x => this.set.delete(x)); }, toggle(c, on) { if (on === undefined) on = !this.set.has(c); on ? this.set.add(c) : this.set.delete(c); return on; }, contains(c) { return this.set.has(c); } },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    dispatch(t, e = {}) { (this.listeners[t] || []).forEach(f => f(Object.assign({ target: el, preventDefault() { } }, e))); if (t === 'input' || t === 'change') { } },
    focus() { el.focused = true; }, setPointerCapture() { }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
    replaceChildren(...c) { this.children = c; }, querySelector() { return this.children[0] || null; }, querySelectorAll() { return this.children; },
    click() { if (this.disabled) return; if (this.onclick) this.onclick({ target: el, preventDefault() { } }); }
  };
  return el;
}

function makeScene(opts, ctl) {
  // a scripted stand-in for BowlingScene: same API and event names
  let mode = 'loading';
  const world = { knocked: 0 };
  const sc = {
    quality: { tier: 'low', pixelRatio: 1, reason: 'test' }, camera: { position: { toArray: () => [0, 1, 4] }, matrixWorld: { elements: [1, 0, 0] } },
    world, calls: [],
    load: () => Promise.resolve().then(() => { mode = 'ready'; opts.onEvent('loaded', {}); }),
    update() { }, resize() { }, setShift() { }, setPixelRatio() { }, setShadows() { }, thinCrowd() { }, setReducedMotion() { }, dispose() { sc.disposed = true; },
    setAim(i) { if (mode !== 'ready') return false; sc.aim = Object.assign({}, i); return true; },
    setHand() { return mode === 'ready'; },
    throw() { if (mode !== 'ready') return false; mode = 'approach'; sc.calls.push('throw'); return true; },
    resume() { if (mode !== 'frozen') return false; mode = 'resolve'; sc.calls.push('resume'); return true; },
    react(k) { sc.calls.push('react:' + k); },
    nextRack() { if (!['settled', 'ready'].includes(mode)) return false; mode = 'resetting'; sc.calls.push('nextRack'); return true; },
    hardReset() { mode = 'ready'; world.knocked = 0; sc.calls.push('hardReset'); opts.onEvent('ready', {}); },
    aimAt: () => ({ angle: 1 }), setMonitor(d) { sc.monitor = d; }, snapshot: () => ({ mode }), poseCheck: () => null,
    // test drivers (what the real scene does on its own)
    _release() { mode = 'rolling'; opts.onEvent('release', { pos: [0, 0.2, 0] }); },
    _half() { mode = 'frozen'; opts.onEvent('question', {}); },
    _settle(knocked, gutter = false) { if (mode !== 'resolve') return false; world.knocked = knocked; mode = 'settled'; opts.onEvent('settled', { knocked, gutter }); return true; },
    _ready() { mode = 'ready'; opts.onEvent('ready', {}); },
    get mode() { return mode; }
  };
  ctl.scene = sc;
  return sc;
}

function load({ embedded = false, search = '', storage = {} } = {}) {
  const els = new Map(), el = id => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); };
  const winListeners = {}, docListeners = {}, posted = [], ctl = {}, timers = [];
  const origin = 'https://manarat.test';
  const parent = { postMessage: (m, target) => posted.push({ m: JSON.parse(JSON.stringify(m)), target }) };
  const localStorage = { getItem: k => (k in storage ? storage[k] : null), setItem: (k, v) => { storage[k] = String(v); } };
  const document = {
    getElementById: el, createElement: () => makeEl('created'), body: makeEl('body'), hidden: false, title: '',
    addEventListener: (t, f) => { (docListeners[t] = docListeners[t] || []).push(f); }, fonts: null, fullscreenElement: null
  };
  const window = {
    addEventListener: (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); },
    location: { origin, search }, matchMedia: () => ({ matches: false }), devicePixelRatio: 1, localStorage
  };
  window.parent = embedded ? parent : window;
  const ctx = {
    window, document, location: window.location, parent: window.parent, localStorage, navigator: {}, console, Math, JSON, Promise, Number, String, Object, Array, Set, Map, URLSearchParams,
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => { }, requestAnimationFrame: () => 1, cancelAnimationFrame: () => { },
    addEventListener: window.addEventListener, matchMedia: window.matchMedia, getComputedStyle: () => ({ display: 'block' }),
    BowlingScene: { detectQuality: () => ({ tier: 'low', pixelRatio: 1, reason: 'test' }), TIERS: { low: { maxDpr: 1.25 }, medium: { maxDpr: 1.5 }, high: { maxDpr: 2 } }, create: (canvas, opts) => makeScene(opts, ctl) }
  };
  ctx.globalThis = ctx; window.window = window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'games/bowling/audio.js'), 'utf8'), ctx);
  ctx.BowlingAudio = ctx.window.BowlingAudio || ctx.BowlingAudio;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'games/bowling/game.js'), 'utf8'), ctx, { filename: 'game.js' });
  const G = ctx.window.Bowling || ctx.Bowling;
  const flush = () => new Promise(r => setImmediate(r));
  const send = (data, { source = parent, from = origin } = {}) => (winListeners.message || []).forEach(f => f({ origin: from, source, data }));
  return { el, posted, send, G: () => ctx.window.Bowling, ctx, ctl, flush, parent, origin, timers, controls: () => ctx.window.ManaratGameControls, storage };
}
module.exports = { load };
