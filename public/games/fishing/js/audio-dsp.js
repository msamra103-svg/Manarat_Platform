/* صيد الأسماك V24 — original procedural sound design (pure DSP, deterministic, no samples).
 * Used by tools/build-audio.cjs to render assets/audio/*.wav and by the game as an offline fallback.
 * Every sound here is synthesised from noise / oscillators / Karplus-Strong strings written for this project.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 * 2 - 1; }; }
  const buf = (sr, sec) => new Float32Array(Math.max(1, Math.round(sr * sec)));
  function biquad(type, sr, f, q = 0.707) { // RBJ cookbook
    const w = TAU * Math.min(f, sr * 0.45) / sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q); let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; } else { b0 = a; b1 = 0; b2 = -a; }
    a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; const B0 = b0 / a0, B1 = b1 / a0, B2 = b2 / a0, A1 = a1 / a0, A2 = a2 / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return x => { const y = B0 * x + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  function normalize(a, peak = 0.9) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m; return a; }
  function mix(dst, src, at = 0, g = 1) { for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * g; return dst; }
  const note = n => 440 * Math.pow(2, (n - 69) / 12);

  /* tonal building blocks */
  function marimba(sr, f, dur = 0.9, g = 1) { const a = buf(sr, dur); for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] = g * (Math.sin(TAU * f * t) * Math.exp(-t * 4.2) + 0.35 * Math.sin(TAU * f * 3.93 * t) * Math.exp(-t * 14) + 0.12 * Math.sin(TAU * f * 9.2 * t) * Math.exp(-t * 30)) * Math.min(1, t * 400); } return a; }
  function bellTone(sr, f, dur = 1.6, g = 1) { const parts = [[1, 1, 1.6], [2.76, 0.5, 2.6], [5.4, 0.28, 4], [8.93, 0.14, 6]]; const a = buf(sr, dur); for (let i = 0; i < a.length; i++) { const t = i / sr; let s = 0; for (const [r, amp, d] of parts) s += amp * Math.sin(TAU * f * r * t) * Math.exp(-t * d); a[i] = g * s * Math.min(1, t * 600); } return a; }
  function pluck(sr, f, dur = 1.2, g = 1, seed = 1, bright = 0.5) { // Karplus–Strong string (oud-like pluck)
    const r = rng(seed), N = Math.max(2, Math.round(sr / f)), line = new Float32Array(N); for (let i = 0; i < N; i++) line[i] = r() * (0.5 + bright * 0.5);
    const a = buf(sr, dur); let idx = 0, lp = 0; for (let i = 0; i < a.length; i++) { const cur = line[idx], nxt = line[(idx + 1) % N]; const v = 0.4985 * (cur + nxt); lp = lp * 0.2 + v * 0.8; line[idx] = lp; a[i] = cur * g; idx = (idx + 1) % N; }
    const body = biquad('bp', sr, 220, 1.2); for (let i = 0; i < a.length; i++) a[i] = a[i] * 0.85 + body(a[i]) * 0.4; return a; }
  function pad(sr, freqs, dur, g = 1) { const a = buf(sr, dur), lp = biquad('lp', sr, 1400, 0.7); for (let i = 0; i < a.length; i++) { const t = i / sr; let s = 0; for (const f of freqs) for (const d of [-0.004, 0.004]) s += ((t * f * (1 + d)) % 1) * 2 - 1; const env = Math.min(1, t / 0.4) * Math.min(1, (dur - t) / 0.6); a[i] = lp(s / (freqs.length * 2)) * env * g; } return a; }
  function drum(sr, low = true, g = 1, seed = 3) { const r = rng(seed), a = buf(sr, low ? 0.45 : 0.15), bp = biquad('bp', sr, low ? 140 : 2200, low ? 1.5 : 2); for (let i = 0; i < a.length; i++) { const t = i / sr; const tone = low ? Math.sin(TAU * (110 * Math.exp(-t * 9) + 55) * t) * Math.exp(-t * 9) : 0; a[i] = g * (tone + bp(r()) * Math.exp(-t * (low ? 18 : 40)) * (low ? 0.6 : 1.2)); } return a; }

  const DSP = {
    /* water */
    splash(sr, strength = 1, seed = 11) { const r = rng(seed), a = buf(sr, 1.3), lp = biquad('lp', sr, 3000, 0.8), lp2 = biquad('lp', sr, 900, 0.7);
      for (let i = 0; i < a.length; i++) { const t = i / sr; const n = r(); const env = Math.exp(-t * (7 - strength * 2)) * Math.min(1, t * 300); const f = 600 + 4200 * Math.exp(-t * 6); const w = TAU * f / sr; void w; a[i] = (lp(n) * 0.7 + lp2(n) * 0.6) * env + Math.sin(TAU * (80 * Math.exp(-t * 6) + 35) * t) * Math.exp(-t * 10) * 0.6 * strength; }
      for (let k = 0; k < 14; k++) { const at = Math.round(sr * (0.12 + Math.abs(r()) * 0.9)), f = 900 + Math.abs(r()) * 2600, d = buf(sr, 0.05); for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(TAU * f * (1 + t * 6) * t) * Math.exp(-t * 90) * 0.18; } mix(a, d, at); }
      return normalize(a, 0.85); },
    plop(sr) { const r = rng(5), a = buf(sr, 0.35), lp = biquad('lp', sr, 1800); for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] = Math.sin(TAU * (180 + 520 * Math.exp(-t * 35)) * t) * Math.exp(-t * 16) * 0.8 + lp(r()) * Math.exp(-t * 30) * 0.5; } return normalize(a, 0.8); },
    bubbles(sr, seed = 9) { const r = rng(seed), a = buf(sr, 1.0); for (let k = 0; k < 9; k++) { const at = Math.round(sr * Math.abs(r()) * 0.8), f = 380 + Math.abs(r()) * 900, d = buf(sr, 0.07); for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(TAU * f * (1 + t * 14) * t) * Math.exp(-t * 55) * Math.min(1, t * 2000); } mix(a, d, at, 0.5 + Math.abs(r()) * 0.5); } return normalize(a, 0.6); },
    lap(sr, seed = 21) { const r = rng(seed), a = buf(sr, 0.9), lp = biquad('lp', sr, 700); for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] = lp(r()) * Math.sin(Math.min(1, t / 0.9) * Math.PI) ** 2; } return normalize(a, 0.6); },
    /* rod / reel / line */
    whoosh(sr) { const r = rng(7), a = buf(sr, 0.5); let bp = biquad('bp', sr, 2400, 1.4); for (let i = 0; i < a.length; i++) { const t = i / sr; if (i % 64 === 0) bp = biquad('bp', sr, 2600 - 1900 * (t / 0.5), 1.6); a[i] = bp(r()) * Math.sin(Math.PI * Math.min(1, t / 0.5)) ** 1.5; } return normalize(a, 0.8); },
    click(sr) { const r = rng(13), a = buf(sr, 0.03), hp = biquad('hp', sr, 3000); for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] = hp(r()) * Math.exp(-t * 900) + Math.sin(TAU * 4700 * t) * Math.exp(-t * 260) * 0.35; } return normalize(a, 0.7); },
    bail(sr) { const a = buf(sr, 0.12); for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] = (Math.sin(TAU * 2900 * t) * 0.5 + Math.sin(TAU * 5200 * t) * 0.3) * Math.exp(-t * 60); } return normalize(a, 0.6); },
    twang(sr) { const a = buf(sr, 0.5); for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] = Math.sin(TAU * (210 + 60 * Math.exp(-t * 20)) * t) * Math.exp(-t * 9) + Math.sin(TAU * 630 * t) * Math.exp(-t * 18) * 0.3; } return normalize(a, 0.7); },
    creak(sr, seed = 17) { const r = rng(seed), a = buf(sr, 0.55); let ph = 0; const bp = biquad('bp', sr, 520, 6), bp2 = biquad('bp', sr, 1150, 5); for (let i = 0; i < a.length; i++) { const t = i / sr; const rate = 70 + 40 * Math.sin(t * 9); ph += rate / sr; const imp = ph >= 1 ? (ph -= 1, 1 + r() * 0.3) : 0; a[i] = (bp(imp) + bp2(imp) * 0.5) * Math.sin(Math.PI * t / 0.55); } return normalize(a, 0.5); },
    flop(sr, seed = 23) { const r = rng(seed), a = buf(sr, 0.9); for (const at of [0, 0.28, 0.52]) { const d = buf(sr, 0.25), lp = biquad('lp', sr, 500), bp = biquad('bp', sr, 1500, 1.2); for (let i = 0; i < d.length; i++) { const t = i / sr, n = r(); d[i] = (lp(n) * 1.4 + Math.sin(TAU * 120 * t) * 0.6) * Math.exp(-t * 28) + bp(n) * Math.exp(-t * 45) * 0.8; } mix(a, d, Math.round(at * sr), at ? 0.7 : 1); } return normalize(a, 0.8); },
    /* cues & music */
    bell(sr) { const a = mix(bellTone(sr, 1760, 1.8, 0.8), bellTone(sr, 1760, 1.6, 0.6), Math.round(sr * 0.18)); return normalize(a, 0.75); },
    chime(sr) { const a = buf(sr, 1.4); mix(a, marimba(sr, note(88), 1.2, 0.7)); mix(a, marimba(sr, note(83), 1.0, 0.6), Math.round(sr * 0.16)); return normalize(a, 0.7); },
    tension(sr) { const r = rng(31), a = buf(sr, 1.6), bp = biquad('bp', sr, 900, 3); for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] = (Math.sin(TAU * (300 + 260 * t) * t) * 0.25 + bp(r()) * 0.6) * Math.min(1, t / 1.2) * Math.min(1, (1.6 - t) / 0.2); } return normalize(a, 0.55); },
    success(sr) { const a = buf(sr, 2.0), ns = [74, 78, 81, 86]; ns.forEach((n, k) => mix(a, marimba(sr, note(n), 1.2, 0.8), Math.round(sr * k * 0.11))); mix(a, marimba(sr, note(90), 1.3, 0.55), Math.round(sr * 0.5)); mix(a, pad(sr, [note(62), note(66), note(69)], 1.6, 0.25), Math.round(sr * 0.3)); return normalize(a, 0.8); },
    fail(sr) { const a = buf(sr, 1.4), lp = biquad('lp', sr, 1200); for (const [n, at] of [[69, 0], [65, 0.28]]) { const f = note(n), d = buf(sr, 0.9); for (let i = 0; i < d.length; i++) { const t = i / sr, ph = (t * f) % 1; d[i] = (4 * Math.abs(ph - 0.5) - 1) * Math.exp(-t * 3.5) * Math.min(1, t * 200); } mix(a, d, Math.round(sr * at)); } for (let i = 0; i < a.length; i++) a[i] = lp(a[i]); return normalize(a, 0.55); },
    neutral(sr) { const a = buf(sr, 1.8); mix(a, bellTone(sr, note(79), 1.6, 0.6)); mix(a, bellTone(sr, note(86), 1.5, 0.4), Math.round(sr * 0.22)); return normalize(a, 0.55); },
    victory(sr) { // ~8.6 s original piece: D major, plucked string melody + pad + frame drum
      const bpm = 112, beat = 60 / bpm, a = buf(sr, 8.8);
      const chords = [[62, 66, 69], [67, 71, 74], [69, 73, 76], [62, 66, 69]];
      chords.forEach((c, i) => mix(a, pad(sr, c.map(note), beat * 4 + 0.4, 0.22), Math.round(sr * i * beat * 4)));
      const mel = [[74, 0, 1], [78, 1, 0.5], [76, 1.5, 0.5], [74, 2, 1], [71, 3, 1], [74, 4, 0.5], [76, 4.5, 0.5], [79, 5, 1], [78, 6, 0.5], [76, 6.5, 0.5], [74, 7, 1], [76, 8, 1], [78, 9, 0.5], [79, 9.5, 0.5], [81, 10, 1.5], [78, 11.5, 0.5], [79, 12, 0.5], [78, 12.5, 0.5], [76, 13, 0.5], [74, 13.5, 2.5]];
      mel.forEach(([n, at, d], k) => mix(a, pluck(sr, note(n), Math.max(0.6, d * beat + 0.5), 0.75, 100 + k, 0.6), Math.round(sr * at * beat)));
      for (let b = 0; b < 16; b++) { mix(a, drum(sr, true, b % 4 === 0 ? 0.8 : 0.45, b), Math.round(sr * b * beat)); if (b % 2) mix(a, drum(sr, false, 0.35, 50 + b), Math.round(sr * (b + 0.5) * beat)); }
      mix(a, marimba(sr, note(86), 2.0, 0.5), Math.round(sr * 13.5 * beat));
      for (let i = 0; i < a.length; i++) { const t = i / sr; a[i] *= Math.min(1, (8.8 - t) / 0.8); }
      return normalize(a, 0.85); },
    /* loops (seamless: all modulations use whole cycles over the loop length) */
    sea(sr) { const L = 8, r = rng(41), a = buf(sr, L), lp = biquad('lp', sr, 520, 0.6), hp = biquad('hp', sr, 2500, 0.7), lp2 = biquad('lp', sr, 6000); let pink = 0;
      for (let i = 0; i < a.length; i++) { const t = i / sr, n = r(); pink = pink * 0.97 + n * 0.03; const sw = 0.55 + 0.25 * Math.sin(TAU * t / L * 2) + 0.2 * Math.sin(TAU * t / L * 3 + 1); const hiss = 0.4 + 0.6 * Math.max(0, Math.sin(TAU * t / L * 4 + 2)) ** 2; a[i] = lp(pink * 6) * sw + lp2(hp(n)) * hiss * 0.18; }
      const f = Math.round(sr * 0.25); for (let i = 0; i < f; i++) { const k = i / f; a[i] = a[i] * k + a[a.length - f + i] * (1 - k); } return normalize(a.subarray(0, a.length - f), 0.6); },
    wind(sr) { const L = 8, r = rng(43), a = buf(sr, L); let bp = biquad('bp', sr, 600, 0.9);
      for (let i = 0; i < a.length; i++) { const t = i / sr; if (i % 256 === 0) bp = biquad('bp', sr, 520 + 260 * Math.sin(TAU * t / L * 2) + 120 * Math.sin(TAU * t / L * 5), 0.9); a[i] = bp(r()) * (0.5 + 0.5 * Math.sin(TAU * t / L * 1 + 0.5) ** 2); }
      const f = Math.round(sr * 0.25); for (let i = 0; i < f; i++) { const k = i / f; a[i] = a[i] * k + a[a.length - f + i] * (1 - k); } return normalize(a.subarray(0, a.length - f), 0.5); },
    underwater(sr) { const L = 8, r = rng(47), a = buf(sr, L), lp = biquad('lp', sr, 260, 0.8); let br = 0;
      for (let i = 0; i < a.length; i++) { const t = i / sr; br = (br + r() * 0.02) * 0.996; a[i] = lp(br * 8) * (0.7 + 0.3 * Math.sin(TAU * t / L * 2)); }
      const f = Math.round(sr * 0.25); for (let i = 0; i < f; i++) { const k = i / f; a[i] = a[i] * k + a[a.length - f + i] * (1 - k); } return normalize(a.subarray(0, a.length - f), 0.6); }
  };
  const NAMES = Object.keys(DSP);
  function render(name, sr = 32000) { return DSP[name](sr); }
  function wav(samples, sr) { // 16-bit PCM mono
    const n = samples.length, b = new ArrayBuffer(44 + n * 2), d = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, sr, true); d.setUint32(28, sr * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true); return b;
  }
  const api = { DSP, NAMES, render, wav };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FishingAudioDSP = api;
})(typeof window !== 'undefined' ? window : globalThis);
