/* Bowling audio (Web Audio API), bowling-only. Every sound is synthesised locally at start-up —
 * there are no third-party recordings in this package (see ASSETS_AND_LICENSES.md).
 *
 * V20.1 sound design (re-evaluated after listening tests of an offline render):
 *  - impacts are NOISE-EXCITED MODAL RESONATORS (two-pole filters with measured-style decay times)
 *    instead of summed sine waves, so pins "crack" like coated maple and do not ring like bells;
 *  - every loop is generated with an equal-power crossfade of its tail into its head (no click or gap);
 *  - rolling = low lane rumble + board-seam texture + a once-per-revolution thump (periodic wave);
 *    a hollow band for the gutter; level/brightness follow speed and the listener distance;
 *  - hall ambience = HVAC room tone + crowd babble (many formant-filtered talkers with syllable
 *    envelopes) + occasional distant ball/pin crashes from other lanes;
 *  - a hall reverb with early reflections and a frequency-dependent tail (highs die sooner);
 *  - per-kind and global voice limits, distance gain/lowpass/pan, compressor before the output.
 * Sounds are triggered by physics/choreography events only (one per new contact, never per sub-step).
 * Audio starts only after a user gesture. create({ context }) accepts an OfflineAudioContext for QA
 * renders; .at(t) then sets the scheduling clock.
 */
(function (root) {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const TAU = Math.PI * 2;

  function create(opts = {}) {
    let ctx = null, master = null, comp = null, sfx = null, amb = null, verbSend = null, verb = null;
    const offline = !!opts.context;
    let clock = 0;
    const now = () => offline ? clock : ctx.currentTime;
    const buffers = {}, active = new Map();
    const limits = { step: 3, slide: 1, release: 1, land: 2, pinHit: 4, pinPin: 8, pinDeck: 6, kick: 3, gutterHit: 3, pit: 3, sweep: 1, setter: 1, ret: 1, applause: 1, far: 1 };
    const GLOBAL_LIMIT = 28;
    let muted = !!opts.muted, volume = clamp(opts.volume ?? 0.8, 0, 1), unlocked = false, closed = false;
    let listener = { pos: [0, 1.6, 4], right: [1, 0, 0] };
    let roll = null, bed = null, slideVoice = null, quiet = false, nextFar = 9;
    let synthesis = null;
    let rand = rnd(opts.seed || 977);

    function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

    // ------------------------------------------------------------------ offline DSP helpers (synthesis)
    function normalize(b, peakTo) {
      let peak = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
      if (peak > 0) for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= peakTo / peak; }
      return b;
    }
    /** gen(c, r) -> per-sample function (i) => value. Mono or multi-channel. */
    let RATE = 44100;   // sample rate of the buffer being synthesised (ambience/rumbles use a lower rate: cheaper, no audible loss)
    // synthesis runs in time slices (yields to the page every ~10 ms) so the first gesture never freezes a frame
    let sliceT = 0;
    const clockMs = () => (root.performance && root.performance.now ? root.performance.now() : Date.now());
    function slice() { if (offline || clockMs() - sliceT < 10) return null; return new Promise(res => setTimeout(() => { sliceT = clockMs(); res(); }, 0)); }
    async function many(list, fn) { const out = []; for (const k of list) out.push(await fn(k)); return out; }
    async function render(sec, gen, seed = 7, channels = 1, peakTo = 0.92, sr = 0) {
      RATE = sr || ctx.sampleRate;
      const n = Math.max(1, Math.floor(RATE * sec)), b = ctx.createBuffer(channels, n, RATE);
      for (let c = 0; c < channels; c++) { const d = b.getChannelData(c), f = gen(c, rnd(seed + c * 101)); for (let i = 0; i < n; i++) { d[i] = f(i); if ((i & 1023) === 1023) { const w = slice(); if (w) { await w; RATE = sr || ctx.sampleRate; } } } }
      return normalize(b, peakTo);
    }
    /** Seamless loop: renders sec + fade and crossfades (equal power) the tail into the head. */
    async function loop(sec, gen, seed, channels = 1, peakTo = 0.9, fade = 0.5, rate = 0) {
      const sr = RATE = rate || ctx.sampleRate, n = Math.floor(sr * sec), F = Math.floor(sr * fade), b = ctx.createBuffer(channels, n, sr);
      for (let c = 0; c < channels; c++) {
        const f = gen(c, rnd(seed + c * 101)), tmp = new Float32Array(n + F);
        for (let i = 0; i < n + F; i++) { tmp[i] = f(i); if ((i & 1023) === 1023) { const w = slice(); if (w) { await w; RATE = sr; } } }
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = tmp[i];
        for (let i = 0; i < F; i++) { const u = i / F; d[i] = tmp[i] * Math.sin(u * Math.PI / 2) + tmp[n + i] * Math.cos(u * Math.PI / 2); }
      }
      return normalize(b, peakTo);
    }
    // sample-rate filters
    function onePoleLP(fc) { const a = Math.exp(-TAU * fc / RATE); let y = 0; return x => (y = (1 - a) * x + a * y); }
    function onePoleHP(fc) { const lp = onePoleLP(fc); return x => x - lp(x); }
    function bandpass(fc, q) { // RBJ, 0 dB peak
      const w = TAU * fc / RATE, al = Math.sin(w) / (2 * q), a0 = 1 + al, b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      return x => { const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
    }
    /** Bank of two-pole resonators: modes [freq Hz, amplitude, decay tau s]. Excite with any signal. */
    function modes(list, jitter = 0, r = Math.random) {
      const sr = RATE;
      const m = list.map(([f, a, tau]) => { f *= 1 + (r() * 2 - 1) * jitter; const w = TAU * f / sr, rr = Math.exp(-1 / (tau * sr)); return { c1: 2 * rr * Math.cos(w), c2: -rr * rr, g: a * Math.sin(w) * 6, y1: 0, y2: 0 }; });
      return x => { let s = 0; for (const o of m) { const y = o.g * x + o.c1 * o.y1 + o.c2 * o.y2; o.y2 = o.y1; o.y1 = y; s += y; } return s; };
    }
    const white = r => r() * 2 - 1;
    /** excitation: an impulse plus a short decaying noise burst (contact duration ~ 1/decay). */
    function burst(r, i, decay, noiseAmt = 0.6) { const t = i / RATE; return (i === 0 ? 1 : 0) + white(r) * noiseAmt * Math.exp(-t * decay); }

    async function synth(onLoopsReady) {
      const SR = ctx.sampleRate, LO = Math.min(22050, SR), LO2 = Math.min(16000, SR);
      // ---- shoe step: heel strike (low, damped) + toe scuff (bright, later)
      buffers.step = await many([0, 1, 2], k => render(0.26, (c, r) => {
        const body = modes([[118 + k * 9, 0.7, 0.018], [260 + k * 15, 0.35, 0.012], [610, 0.12, 0.006]], 0.04, r), lp = onePoleLP(900), sc = bandpass(2600 + k * 300, 0.9);
        return i => { const t = i / SR; const heel = body(burst(r, i, 260, 0.9)) + lp(white(r)) * Math.exp(-t * 55) * 0.5; const ts = t - 0.055 - k * 0.006; const scuff = ts > 0 ? sc(white(r)) * Math.min(1, ts / 0.008) * Math.exp(-ts * 34) * 0.55 : sc(0); return heel + scuff; };
      }, 11 + k));
      // ---- slide: leather sole on approach boards; grainy band noise, rough micro-modulation
      buffers.slide = [await render(1.0, (c, r) => {
        const b1 = bandpass(1150, 0.9), b2 = bandpass(420, 1.0), grain = onePoleLP(35), soft = onePoleLP(3200);
        return i => { const t = i / SR, e = Math.min(1, t / 0.04) * Math.exp(-t * 2.0); const g = 0.65 + 2.2 * Math.abs(grain(white(r))); return soft(b1(white(r)) * 0.9 + b2(white(r)) * 0.6) * e * g; };
      }, 21)];
      // ---- release: thumb leaving the hole (soft pop) + sleeve/air swish
      buffers.release = [await render(0.34, (c, r) => {
        const pop = modes([[640, 0.6, 0.01], [1350, 0.25, 0.006]], 0, r), sw = bandpass(1900, 0.7);
        return i => { const t = i / SR; return pop(burst(r, i, 900, 0.3)) + sw(white(r)) * Math.sin(Math.PI * clamp(t / 0.3, 0, 1)) ** 2 * 0.45; };
      }, 31)];
      // ---- ball landing on the lane: 7 kg on maple boards (deep thud + board ring + click)
      buffers.land = await many([0, 1], k => render(0.6, (c, r) => {
        const m = modes([[54 + k * 5, 1.0, 0.11], [96 + k * 7, 0.6, 0.07], [181, 0.35, 0.045], [312, 0.22, 0.03], [655, 0.1, 0.012]], 0.03, r), hp = onePoleHP(3000);
        return i => m(burst(r, i, 400, 0.5)) + hp(white(r)) * Math.exp(-i / SR * 900) * 0.35;
      }, 41 + k));
      // ---- ball -> pin: a hard "crack" (very short broadband contact) into a coated maple pin's modes
      const PIN = [[355, 0.55, 0.05], [812, 1.0, 0.045], [1290, 0.75, 0.038], [1980, 0.55, 0.03], [2770, 0.4, 0.022], [3640, 0.28, 0.016], [5150, 0.16, 0.01]];
      buffers.pinHit = await many([0, 1, 2, 3], k => render(0.5, (c, r) => {
        const pin = modes(PIN, 0.06, r), ball = modes([[88 + k * 6, 0.8, 0.05], [210, 0.3, 0.03]], 0.03, r), hp = onePoleHP(1800);
        return i => { const e = burst(r, i, 2200, 1.0); return pin(e) * 0.9 + ball(e) * 1.1 + hp(white(r)) * Math.exp(-i / SR * 1400) * 0.9; };
      }, 51 + k));
      // ---- pin -> pin: lighter and shorter, two pins excited at once (two slightly different sets)
      buffers.pinPin = await many([0, 1, 2, 3, 4, 5], k => render(0.34, (c, r) => {
        const a = modes(PIN.map(([f, am, t]) => [f * 1.04, am, t * 0.8]), 0.08, r), b = modes(PIN.map(([f, am, t]) => [f * 0.97, am * 0.8, t * 0.7]), 0.08, r), hp = onePoleHP(2500);
        return i => { const e = burst(r, i, 3000, 0.8); return (a(e) + b(e * 0.8)) * 0.6 + hp(white(r)) * Math.exp(-i / SR * 1800) * 0.7; };
      }, 61 + k));
      // ---- pin falling on the wooden deck: pin knock + deck board thud + one or two small bounces
      buffers.pinDeck = await many([0, 1, 2, 3], k => render(0.42, (c, r) => {
        const pin = modes(PIN.map(([f, am, t]) => [f, am * 0.5, t * 0.6]), 0.08, r), deck = modes([[150 + k * 18, 0.9, 0.04], [395 + k * 25, 0.5, 0.025], [890, 0.2, 0.012]], 0.04, r);
        const hits = [[0, 1], [0.045 + k * 0.012, 0.35], [0.1 + k * 0.02, 0.14]].map(([t, a]) => [Math.floor(t * SR), a]);
        return i => { let e = 0; for (const [i0, a] of hits) if (i >= i0) e += burst(r, i - i0, 1600, 0.7) * a * (i - i0 < 60 ? 1 : 0.3); return pin(e) * 0.7 + deck(e); };
      }, 71 + k));
      // ---- rolling loop (4 s, seamless). ch0 = lane rumble + seam texture, ch1 = gutter hollow band
      buffers.roll = [await loop(4.0, (c, r) => {
        const lp2x = fc => { const a = onePoleLP(fc), b = onePoleLP(fc); return x => b(a(x)); };      // 12 dB/oct
        const lp1 = lp2x(150), lp2 = lp2x(380), seam = onePoleLP(22), tex = bandpass(1300, 0.9), hol = bandpass(780, 2.2), hol2 = bandpass(1450, 3);
        return c === 0
          ? i => { const s = 1 + 0.9 * seam(white(r)); return lp1(white(r)) * 5 + lp2(white(r)) * 1.6 * s + tex(white(r)) * 0.03 * s; }
          : i => { const s = 1 + 1.2 * seam(white(r)); return (hol(white(r)) * 0.8 + hol2(white(r)) * 0.35 + lp1(white(r)) * 1.2) * s; };
      }, 141, 2, 0.9, 0.6, LO2)];
      if (!closed) startRoll();
      const ir = await impulse(); if (!closed && verb) verb.buffer = ir;
      // ---- kickback / masking board knock
      buffers.kick = await many([0, 1], k => render(0.5, (c, r) => {
        const m = modes([[132 + k * 14, 1, 0.06], [347, 0.55, 0.04], [760, 0.3, 0.02], [1430, 0.12, 0.01]], 0.04, r);
        return i => m(burst(r, i, 800, 0.6));
      }, 81 + k));
      // ---- pin rattling in the gutter: hollow, longer modes
      buffers.gutterHit = await many([0, 1], k => render(0.55, (c, r) => {
        const m = modes([[402, 0.8, 0.09], [935, 0.6, 0.06], [1620, 0.45, 0.045], [2310, 0.25, 0.03]], 0.05, r), pin = modes(PIN, 0.08, r);
        return i => { const e = burst(r, i, 1600, 0.7) + (i > SR * 0.07 ? burst(r, i - SR * 0.07 | 0, 1600, 0.5) * 0.4 : 0); return m(e) * 0.7 + pin(e) * 0.4; };
      }, 91 + k));
      // ---- pit floor / back cushion: muffled heavy thump
      buffers.pit = await many([0, 1], k => render(0.6, (c, r) => {
        const m = modes([[62 + k * 8, 1, 0.09], [140, 0.4, 0.04]], 0.04, r), lp = onePoleLP(380);
        return i => { const t = i / SR; return m(burst(r, i, 120, 0.4)) + lp(white(r)) * Math.exp(-t * 14) * 1.4; };
      }, 101 + k));
      // ---- pinsetter machinery: sweep (motor + gearbox + chain) and setter (motor + two clunks)
      const motor = (r, sec, f0) => { const SR = RATE, lp = onePoleLP(500), wh = bandpass(f0 * 8.6, 8); let ph = 0; return i => { const t = i / SR, env = Math.min(1, t / 0.18) * Math.min(1, (sec - t) / 0.3); const f = f0 * (0.9 + 0.1 * Math.min(1, t / 0.4)); ph += TAU * f / SR; return env * (Math.sin(ph) * 0.32 + Math.sin(2 * ph) * 0.22 + Math.sin(3 * ph) * 0.1 + lp(white(r)) * 1.2 + wh(white(r)) * 0.5); }; };
      buffers.sweep = [await render(1.9, (c, r) => {
        const SR = RATE, m = motor(r, 1.9, 60), k1 = modes([[180, 1, 0.05], [520, 0.4, 0.02]], 0, r);
        return i => m(i) + k1(i === Math.floor(0.05 * SR) || i === Math.floor(1.55 * SR) ? 1.2 : 0);
      }, 111, 1, 0.92, LO)];
      buffers.setter = [await render(1.5, (c, r) => {
        const SR = RATE, m = motor(r, 1.5, 50), k1 = modes([[140, 1, 0.07], [420, 0.5, 0.03], [1100, 0.2, 0.012]], 0, r);
        return i => m(i) * 0.7 + k1(i === Math.floor(0.35 * SR) ? 1.4 : i === Math.floor(1.15 * SR) ? 2.2 : 0);
      }, 121, 1, 0.92, LO)];
      // ---- ball return: rumble along the track, then the ball knocks into the rack ball
      buffers.ret = [await render(2.4, (c, r) => {
        const SR = RATE, lp = onePoleLP(160), thump = modes([[70, 1, 0.08]], 0, r), clack = modes([[205, 0.8, 0.06], [470, 0.5, 0.04], [1280, 0.3, 0.02]], 0, r);
        let next = 0;
        return i => { const t = i / SR, env = Math.sin(Math.PI * clamp(t / 1.95, 0, 1)); let e = 0; if (t < 1.9 && i >= next) { next = i + Math.floor(SR * (0.09 + r() * 0.05)); e = 0.25 * env; } return lp(white(r)) * env * 3 + thump(e) + clack(i === Math.floor(1.95 * SR) ? 2 : i === Math.floor(2.05 * SR) ? 0.6 : 0); };
      }, 131, 1, 0.92, LO2)];
      // ---- applause: Poisson claps, each a noise burst through a random "hand cavity" resonance
      buffers.applause = await many([0, 1], async k => {
        const SR = RATE = ctx.sampleRate, sec = 3.6, n = Math.floor(SR * sec), b = ctx.createBuffer(2, n, SR), r = rnd(201 + k);
        for (let ch = 0; ch < 2; ch++) {
          const w = slice(); if (w) { await w; RATE = SR; }
          const d = b.getChannelData(ch); let t = 0;
          while (t < sec) {
            const w2 = slice(); if (w2) { await w2; RATE = SR; }
            const rate = 16 + 80 * Math.exp(-Math.pow((t - 0.8) / 1.0, 2));
            t += -Math.log(1 - r()) / rate;
            const i0 = Math.floor(t * SR), len = Math.floor(SR * 0.03), f = 800 + r() * 1800, amp = (0.3 + r() * 0.7) * Math.min(1, (sec - t) / 1.1);
            const bp = bandpass(f, 1.6 + r() * 2), hp = onePoleHP(500);
            const k1 = Math.exp(-(180 + r() * 60) / SR); let e1 = amp * 2.5;
            for (let j = 0; j < len && i0 + j < n; j++) { d[i0 + j] += bp(hp(white(r))) * e1; e1 *= k1; }
          }
        }
        return normalize(b, 0.8);
      });
      // ---- hall bed (10 s stereo, seamless): HVAC room tone + crowd babble
      buffers.bed = [await loop(7.0, (c, r) => {
        const SR = RATE, hv1 = onePoleLP(260), hv2 = onePoleLP(900);
        const talkers = []; for (let k = 0; k < 9; k++) talkers.push({ f1: bandpass(320 + r() * 450, 4), f2: bandpass(1000 + r() * 1300, 6), g: (0.25 + r() * 0.75) * (k % 2 === c ? 1 : 0.55), env: 0, target: 0, nextI: Math.floor(r() * SR), talking: r() < 0.5, phraseEnd: Math.floor(r() * SR * 3), hp: onePoleHP(200) });
        const envK = 0.0016 * 44100 / SR;
        return i => {
          let s = hv1(white(r)) * 0.9 + hv2(white(r)) * 0.15;
          for (const tk of talkers) {
            if (i >= tk.phraseEnd) { tk.talking = !tk.talking; tk.phraseEnd = i + Math.floor(SR * (tk.talking ? 1.2 + r() * 2.8 : 0.6 + r() * 2.5)); }
            if (i >= tk.nextI) { tk.nextI = i + Math.floor(SR * (0.12 + r() * 0.16)); tk.target = tk.talking ? 0.4 + r() * 0.6 : 0; }
            tk.env += (tk.target * (i < tk.nextI - SR * 0.04 ? 1 : 0.2) - tk.env) * envK;
            const x = tk.hp(white(r)); s += (tk.f1(x) * 1.2 + tk.f2(x) * 0.7) * tk.env * tk.g;
          }
          return s;
        };
      }, 151, 2, 0.55, 1.0, LO2)];
      if (!closed) startBed();
      // ---- distant crash on another lane (rumble -> pin clatter), heavily low-passed
      buffers.far = await many([0, 1, 2], k => render(3.2, (c, r) => {
        const SR = RATE, rum = onePoleLP(120), lpc = onePoleLP(1500), pins = modes(PIN, 0.1, r), pins2 = modes(PIN.map(([f, a, t]) => [f * 1.06, a, t]), 0.1, r);
        const hits = []; let t = 1.25 + k * 0.1; for (let h = 0; h < 14 + k * 3; h++) { hits.push([Math.floor(t * SR), (h < 2 ? 1 : 0.25 + r() * 0.6) * Math.exp(-(t - 1.25) * 2.2)]); t += 0.006 + r() * 0.07; }
        let hi = 0;
        return i => { const tt = i / SR, roll = rum(white(r)) * 2.2 * Math.min(1, tt / 0.6) * (tt < 1.3 ? 1 : Math.exp(-(tt - 1.3) * 8)); let e = 0; while (hi < hits.length && hits[hi][0] <= i) { e += hits[hi][1] * 1.5; hi++; } return roll + lpc(pins(e) * 0.6 + pins2(e * 0.6) * 0.5); };
      }, 171 + k, 1, 0.8, LO2));
    }
    async function impulse(sec = 1.9) { // medium hall: pre-delay, early reflections, frequency-dependent tail
      const SR = RATE = ctx.sampleRate, n = Math.floor(SR * sec), b = ctx.createBuffer(2, n, SR);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch), r = rnd(401 + ch * 13), lp = onePoleLP(1400), pre = Math.floor(0.012 * SR);
        for (let i = 0; i < n; i++) {
          if ((i & 1023) === 1023) { const w = slice(); if (w) { await w; RATE = SR; } }
          const t = i / SR; if (i < pre) { d[i] = 0; continue; }
          const w = white(r), low = lp(w), high = w - low;
          d[i] = (low * Math.exp(-t * 6.9 / 1.7) * 1.4 + high * Math.exp(-t * 6.9 / 0.65) * 0.5) * Math.min(1, (t - 0.012) / 0.02) * 0.4;
        }
        for (let k = 0; k < 9; k++) { const i = Math.floor((0.014 + r() * 0.05) * SR); d[i] += (r() < 0.5 ? -1 : 1) * (0.5 - k * 0.04); }
      }
      return b;
    }

    // ------------------------------------------------------------------ lifecycle
    async function unlock() {
      if (closed) return false;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!offline && !AC) return false;
      try {
        if (!ctx) {
          ctx = offline ? opts.context : new AC({ latencyHint: 'interactive' });
          master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
          comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
          master.connect(comp).connect(ctx.destination);
          sfx = ctx.createGain(); sfx.connect(master);
          amb = ctx.createGain(); amb.gain.value = 1; amb.connect(master);
          verb = ctx.createConvolver(); verbSend = ctx.createGain(); verbSend.gain.value = 0.4; verbSend.connect(verb).connect(master);
          synthesis = synth().catch(() => { });          // sounds become available as they are built (offline: awaited)
        }
        if (offline) await synthesis;
        if (!offline) await ctx.resume();
      } catch (e) { return false; }
      unlocked = offline ? true : ctx && ctx.state === 'running';
      return unlocked;
    }

    function startBed() {
      if (!ctx || bed) return;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buffers.bed[0]; s.loop = true; f.type = 'lowpass'; f.frequency.value = 2600; g.gain.value = 0;
      s.connect(f).connect(g).connect(amb); const send = ctx.createGain(); send.gain.value = 0.25; g.connect(send).connect(verbSend);
      s.start(now());
      g.gain.setTargetAtTime(0.13, now(), 1.2);
      bed = { s, f, g };
    }
    function revWave() { // smooth pulse once per period (finger-hole/track thump), zero mean
      const N = 24, re = new Float32Array(N), im = new Float32Array(N);
      for (let k = 1; k < N; k++) re[k] = Math.exp(-Math.pow(k * 0.16, 2) / 2);
      return ctx.createPeriodicWave(re, im);
    }
    function startRoll() {
      if (!ctx || roll) return;
      const s = ctx.createBufferSource(); s.buffer = buffers.roll[0]; s.loop = true;
      const split = ctx.createChannelSplitter(2);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.5;
      const gLane = ctx.createGain(), gGut = ctx.createGain(); gLane.gain.value = 0; gGut.gain.value = 0;
      const am = ctx.createGain(); am.gain.value = 1;
      const lfo = ctx.createOscillator(), lfoDepth = ctx.createGain(); lfo.setPeriodicWave(revWave()); lfo.frequency.value = 4; lfoDepth.gain.value = 0; lfo.connect(lfoDepth).connect(am.gain); lfo.start(now());
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      s.connect(split); split.connect(lp, 0).connect(gLane).connect(am); split.connect(gGut, 1); gGut.connect(am);
      let out = am; if (pan) { am.connect(pan); out = pan; }
      out.connect(sfx); const send = ctx.createGain(); send.gain.value = 0.2; out.connect(send).connect(verbSend);
      s.start(now());
      roll = { s, lp, gLane, gGut, lfo, lfoDepth, pan, send };
    }

    function spatial(pos) {
      if (!pos) return { gain: 1, pan: 0, wet: 0.25, cutoff: 14000, d: 0 };
      const dx = pos[0] - listener.pos[0], dy = pos[1] - listener.pos[1], dz = pos[2] - listener.pos[2];
      const d = Math.hypot(dx, dy, dz);
      const pan = clamp((dx * listener.right[0] + dz * listener.right[2]) / Math.max(d, 1), -0.8, 0.8);
      return { gain: 1 / Math.sqrt(1 + (d / 6) ** 2), pan, wet: clamp(0.16 + d / 30, 0.16, 0.7), cutoff: clamp(15000 - d * 450, 2200, 15000), d };
    }
    function totalVoices() { let n = 0; active.forEach(l => { n += l.length; }); return n; }
    function voice(kind, { gain = 1, rate = 1, pos = null, wet = null, when = 0, bus = null, dur = 0, bright = 1 } = {}) {
      if (!unlocked || !ctx || ctx.state === 'closed' || !buffers[kind]) return null;
      const list = active.get(kind) || []; active.set(kind, list);
      const evict = l => { const old = l.shift(); if (!old) return; try { old.g.gain.setTargetAtTime(0, now(), 0.02); old.s.stop(now() + 0.08); } catch (e) { } };
      while (list.length >= (limits[kind] || 3)) evict(list);
      if (totalVoices() >= GLOBAL_LIMIT) { let worst = null; active.forEach(l => { if (l.length && (!worst || l.length > worst.length)) worst = l; }); worst && evict(worst); }
      const variants = buffers[kind], s = ctx.createBufferSource(); s.buffer = variants[Math.floor(rand() * variants.length)];
      s.playbackRate.value = rate;
      const sp = spatial(pos), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      f.type = 'lowpass'; f.frequency.value = Math.min(sp.cutoff, 1800 + 13000 * clamp(bright, 0, 1));
      const level = clamp(gain * sp.gain, 0, 1.2); g.gain.value = level;
      s.connect(f).connect(g); let out = g; if (p) { p.pan.value = sp.pan; g.connect(p); out = p; }
      out.connect(bus || sfx);
      const send = ctx.createGain(); send.gain.value = wet ?? sp.wet; out.connect(send).connect(verbSend);
      const t0 = now() + Math.max(0, when);
      s.start(t0);
      if (dur) { g.gain.setValueAtTime(level, t0 + dur); g.gain.linearRampToValueAtTime(0, t0 + dur + 0.12); s.stop(t0 + dur + 0.15); }
      const v = { s, g, kind }; list.push(v);
      s.onended = () => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); try { s.disconnect(); g.disconnect(); f.disconnect(); p && p.disconnect(); send.disconnect(); } catch (e) { } };
      return v;
    }

    /** Scene events -> sounds. data.pos = [x,y,z]. */
    function event(type, data = {}) {
      if (!unlocked) return;
      const pos = data.pos || null;
      switch (type) {
        case 'step': voice('step', { gain: data.soft ? 0.2 : 0.38, rate: 0.95 + rand() * 0.1, pos }); break;
        case 'slide': slideVoice = voice('slide', { gain: 0.22, pos, rate: 0.96 + rand() * 0.08 }); break;
        case 'slideStop': if (slideVoice) { try { slideVoice.g.gain.setTargetAtTime(0, now(), 0.06); slideVoice.s.stop(now() + 0.35); } catch (e) { } slideVoice = null; } break;
        case 'release': voice('release', { gain: 0.28, pos }); break;
        case 'contact': contact(data); break;
        case 'pit': voice('pit', { gain: 0.5, pos }); break;
        case 'sweep': voice('sweep', { gain: 0.3, pos }); voice('setter', { gain: 0.3, pos, when: 1.0 }); break;
        case 'return': voice('ret', { gain: 0.45, pos }); break;
      }
    }
    function contact(e) {
      const pos = e.pos, s = e.speed || 0;
      switch (e.type) {
        case 'ball-pin': voice('pinHit', { gain: clamp(s / 4, 0.35, 1.2), rate: 0.97 + rand() * 0.06, pos, wet: 0.42, bright: clamp(s / 5, 0.35, 1) }); break;
        case 'pin-pin': voice('pinPin', { gain: clamp(s / 3.5, 0.1, 0.85), rate: 0.95 + rand() * 0.1, pos, wet: 0.42, bright: clamp(s / 4, 0.2, 1) }); break;
        case 'deck': case 'tail': case 'capping': case 'edge': if (e.a === 'pin') voice('pinDeck', { gain: clamp(s / 3, 0.1, 0.8), rate: 0.92 + rand() * 0.16, pos, bright: clamp(s / 3, 0.25, 1) }); else if (s > 0.6) voice('land', { gain: clamp(s / 3, 0.2, 0.7), pos }); break;
        case 'lane': if (s > 0.35) voice('land', { gain: clamp(s / 1.6, 0.25, 0.95), pos }); break;
        case 'approach': if (s > 0.35) voice('land', { gain: 0.5, pos }); break;
        case 'gutter': if (e.a === 'pin') voice('gutterHit', { gain: clamp(s / 3, 0.15, 0.7), pos }); else if (s > 0.3) voice('land', { gain: clamp(s / 2, 0.2, 0.6), pos, rate: 1.12 }); break;
        case 'kickback': case 'ceiling': voice('kick', { gain: clamp(s / 4, 0.15, 0.8), pos, bright: clamp(s / 4, 0.3, 1) }); break;
        case 'pit': case 'cushion': voice('pit', { gain: clamp(s / 4, 0.15, 0.7), pos }); break;
      }
    }

    /** Continuous rolling sound: call every frame with the ball state (also drives the ambience). */
    function rolling(st = {}) {
      if (!unlocked || !roll) return;
      const t = now(), on = !st.frozen && !st.airborne && !st.pit && (st.onLane || st.gutter);
      const v = clamp((st.speed || 0) / 8, 0, 1);
      const sp = spatial(st.pos);
      const lane = on && !st.gutter ? (0.2 + 0.6 * v) * sp.gain * 1.25 : 0, gut = on && st.gutter ? (0.3 + 0.45 * v) * sp.gain * 1.4 : 0;
      roll.gLane.gain.setTargetAtTime(lane, t, 0.05); roll.gGut.gain.setTargetAtTime(gut, t, 0.05);
      roll.lp.frequency.setTargetAtTime(Math.min(sp.cutoff, 160 + 620 * v), t, 0.1);
      const hz = clamp((st.spin || 0) / TAU, 0.5, 14);
      roll.lfo.frequency.setTargetAtTime(hz, t, 0.1);
      roll.lfoDepth.gain.setTargetAtTime(on ? (st.phase === 'skid' ? 0.1 : 0.22) : 0, t, 0.12);
      if (roll.pan) roll.pan.pan.setTargetAtTime(sp.pan, t, 0.1);
      roll.send.gain.setTargetAtTime(0.12 + 0.3 * clamp((sp.d || 0) / 20, 0, 1), t, 0.2);
      // distant activity on other lanes, never while a question is open
      if (t >= nextFar) {
        nextFar = t + 11 + rand() * 14;
        if (!quiet) { const sd = rand() < 0.5 ? -1 : 1; voice('far', { gain: 0.07 + rand() * 0.05, pos: [sd * (6 + rand() * 6), 0.5, -17], wet: 0.75, bus: amb, rate: 0.95 + rand() * 0.1, bright: 0.2 }); }
      }
    }

    function crowd(kind) {
      if (!unlocked || !ctx) return;
      const t = now();
      quiet = kind === 'question';
      const bg = bed ? bed.g.gain : { setTargetAtTime() { } };
      if (kind === 'question') bg.setTargetAtTime(0.07, t, 0.8);
      else if (kind === 'strike') { bg.setTargetAtTime(0.14, t, 1.5); voice('applause', { gain: 0.42, wet: 0.45, bus: amb, when: 0.25 }); }
      else if (kind === 'good') { bg.setTargetAtTime(0.13, t, 1.5); voice('applause', { gain: 0.22, wet: 0.5, bus: amb, when: 0.3, rate: 0.95 }); }
      else if (kind === 'support') voice('applause', { gain: 0.1, wet: 0.55, bus: amb, when: 0.9, rate: 0.9 });
      else bg.setTargetAtTime(0.13, t, 1.2);
    }

    function setListener(pos, right) { listener.pos = pos; listener.right = right; }
    function setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : volume, now(), 0.05); }
    function setVolume(v) { volume = clamp(v, 0, 1); if (master && !muted) master.gain.setTargetAtTime(volume, now(), 0.05); }
    function suspend() { if (!offline && ctx && ctx.state === 'running') ctx.suspend().catch(() => { }); }
    function resume() { if (!offline && ctx && unlocked && ctx.state === 'suspended') ctx.resume().catch(() => { }); }
    /** Stop every one-shot (restart / early end); the bed and roll loop stay, silent when idle. */
    function stopAll() {
      if (!ctx) return;
      active.forEach(l => { for (const v of l.splice(0)) { try { v.g.gain.setTargetAtTime(0, now(), 0.03); v.s.stop(now() + 0.1); } catch (e) { } } });
      if (roll) { roll.gLane.gain.setTargetAtTime(0, now(), 0.03); roll.gGut.gain.setTargetAtTime(0, now(), 0.03); }
      slideVoice = null; nextFar = now() + 10;
    }
    function close() {
      closed = true; unlocked = false;
      if (ctx && !offline) { try { stopAll(); bed && bed.s.stop(); roll && (roll.s.stop(), roll.lfo.stop()); } catch (e) { } try { ctx.close(); } catch (e) { } }
      ctx = null; roll = null; bed = null;
    }
    function stats() { return { voices: totalVoices(), state: ctx ? ctx.state : 'none', unlocked, muted, volume, loops: (bed ? 1 : 0) + (roll ? 1 : 0) }; }
    /** Objective checks of every synthesised buffer (also loop seams: the jump across the loop point). */
    function analyse() {
      const out = {};
      for (const [k, list] of Object.entries(buffers)) out[k] = list.map(b => {
        let s = 0, pk = 0, nan = false, n = 0, seam = 0, step = 0;
        for (let c = 0; c < b.numberOfChannels; c++) {
          const d = b.getChannelData(c);
          for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) nan = true; s += v * v; pk = Math.max(pk, Math.abs(v)); n++; if (i) step = Math.max(step, Math.abs(v - d[i - 1])); }
          seam = Math.max(seam, Math.abs(d[0] - d[d.length - 1]));
        }
        return { sec: +b.duration.toFixed(2), rms: +Math.sqrt(s / n).toFixed(4), peak: +pk.toFixed(3), nan, seam: +seam.toFixed(4), maxStep: +step.toFixed(4) };
      });
      return out;
    }

    return {
      unlock, event, rolling, crowd, setListener, setMuted, setVolume, suspend, resume, stopAll, close, stats, analyse,
      at(t) { clock = t; }, get context() { return ctx; }, get built() { return synthesis; },
      get muted() { return muted; }, get volume() { return volume; }, get ready() { return unlocked; }
    };
  }

  root.BowlingAudio = { create };
})(typeof window !== 'undefined' ? window : globalThis);
