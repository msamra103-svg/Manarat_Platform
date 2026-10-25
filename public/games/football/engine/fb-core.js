/* Football engine core: namespace, math helpers, seeded RNG. Football-only; the shared games/sports engine is untouched. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  FB.version = '21.0-football-realism';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOut = smooth;
  /** frame-rate independent exponential smoothing */
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  FB.math = { clamp, lerp, smooth, smoother, easeOut, easeInOut, damp, rng, TAU: Math.PI * 2 };

  /* Pitch & goal constants (metres, FIFA dimensions). The attacking goal line is at z = goalZ and the attack runs toward -Z.
   * The pitch centre is at z = goalZ + 52.5, so the penalty area sits close to the origin. */
  FB.PITCH = {
    length: 105, width: 68, goalZ: -20, centerZ: 32.5, goalHalf: 3.66, goalHeight: 2.44, postR: 0.06, netDepthTop: 1.0, netDepthBottom: 2.1,
    penaltyDepth: 16.5, penaltyHalf: 20.16, sixDepth: 5.5, sixHalf: 9.16, spotDist: 11, arcR: 9.15, ballR: 0.11, gravity: 9.81
  };

  /** hex/css colour -> linear THREE.Color (r128 does not colour-manage material colours when outputEncoding is sRGB) */
  FB.color = (c) => new THREE.Color(c).convertSRGBToLinear();
  FB.hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
})(typeof window !== 'undefined' ? window : globalThis);
