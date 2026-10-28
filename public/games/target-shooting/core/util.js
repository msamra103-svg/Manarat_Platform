/* Target Shooting 3D — shared helpers (browser + Node).
 * Everything time-based here is frame-rate independent: smoothing uses exact exponential decay or a
 * critically damped spring integrated with sub-steps, so the same input gives the same curve at 30, 60
 * or 144 fps. No random noise is ever added to character bones; the seeded RNG is only for scenery and
 * target spawning (deterministic per round so tests can replay a round).
 */
(function (root) {
  'use strict';
  const TS = root.TS = root.TS || {};
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const smoother = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
  /** exact exponential approach: same result for one 1/30 s step or two 1/60 s steps */
  const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
  const wrapAngle = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  /** Critically damped scalar spring (no overshoot). omega = 2π / settle-ish time. */
  class Spring {
    constructor(value = 0, omega = 18) { this.x = value; this.v = 0; this.omega = omega; }
    set(value) { this.x = value; this.v = 0; return this; }
    update(target, dt) {
      // closed-form critically damped step (exact for constant target over dt, unconditionally stable)
      const w = this.omega, x0 = this.x - target, v0 = this.v;
      const e = Math.exp(-w * dt);
      const c = v0 + w * x0;
      this.x = target + (x0 + c * dt) * e;
      this.v = (v0 - w * c * dt) * e;
      return this.x;
    }
  }

  /** Small seeded RNG (mulberry32) — scenery and spawns only. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.pick = arr => arr[Math.floor(f() * arr.length) % arr.length];
    f.sign = () => (f() < 0.5 ? -1 : 1);
    return f;
  }
  const digits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const store = {
    get(k, d) { try { const v = root.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  function shuffle(arr, r = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /** Timers owned by the game: cleared on restart so nothing fires into a new round. */
  function timerSet() {
    const ids = new Set();
    return {
      later(fn, ms) { const id = setTimeout(() => { ids.delete(id); fn(); }, ms); ids.add(id); return id; },
      clear() { ids.forEach(clearTimeout); ids.clear(); },
      get size() { return ids.size; }
    };
  }

  TS.util = { clamp, lerp, smooth, smoother, damp, wrapAngle, Spring, rng, digits, esc, store, shuffle, timerSet };
  if (typeof module !== 'undefined' && module.exports) module.exports = TS.util;
})(typeof window !== 'undefined' ? window : globalThis);
