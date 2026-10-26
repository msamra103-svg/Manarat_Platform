/* Bowling audio (Web Audio API), bowling-only. Every sound is synthesised locally at start-up —
 * there are no third-party recordings in this package (see ASSETS_AND_LICENSES.md):
 *   hall room tone + distant murmur bed, shoe steps and the slide, release, ball landing, a rolling
 *   loop whose level/brightness follow the ball speed and whose finger-hole thump follows its spin,
 *   gutter rumble, ball–pin and pin–pin "clack" (modal partials), pins on the deck, kickbacks, pit and
 *   cushion, sweep and pinsetter machinery, ball return rumble, and modest applause.
 * Sounds are triggered by physics/choreography events only (one per new contact, never per sub-step),
 * are placed by distance/pan relative to the camera, share a reverb, are voice-limited per kind and
 * globally, and pass through a compressor to prevent clipping. Audio starts only after a user gesture.
 */
(function (root) {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const TAU = Math.PI * 2;

  function create(opts = {}) {
    let ctx = null, master = null, comp = null, sfx = null, amb = null, verbSend = null, verb = null;
    const buffers = {}, active = new Map();
    const limits = { step: 3, slide: 1, release: 1, land: 2, pinHit: 4, pinPin: 6, pinDeck: 6, kick: 3, gutterHit: 3, pit: 3, sweep: 1, setter: 1, ret: 1, applause: 1, clap: 2 };
    const GLOBAL_LIMIT = 26;
    let muted = !!opts.muted, volume = clamp(opts.volume ?? 0.8, 0, 1), unlocked = false, closed = false;
    let listener = { pos: [0, 1.6, 4], right: [1, 0, 0] };
    let roll = null, bed = null, slideVoice = null;

    function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
    function makeBuffer(sec, fn, seed = 7, channels = 1, peakTo = 0.92) {
      const n = Math.max(1, Math.floor(ctx.sampleRate * sec)), b = ctx.createBuffer(channels, n, ctx.sampleRate);
      for (let c = 0; c < channels; c++) { const d = b.getChannelData(c), r = rnd(seed + c * 101); for (let i = 0; i < n; i++) d[i] = fn(i / ctx.sampleRate, r, c); }
      let peak = 0; for (let c = 0; c < channels; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i])); }
      if (peak > 0) for (let c = 0; c < channels; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= peakTo / peak; }
      return b;
    }
    // one-pole filtered noise generator (state per call)
    function brown() { let y = 0; return r => (y = 0.985 * y + 0.12 * (r() * 2 - 1)); }

    function synth() {
      // shoe step on the approach: soft heel thump + short scuff
      buffers.step = [0, 1, 2].map(k => { const b = brown(); return makeBuffer(0.22, (t, r) => Math.sin(TAU * (95 + k * 12) * t) * Math.exp(-t * 34) * 0.9 + b(r) * Math.exp(-t * 28) * 1.6 + (r() * 2 - 1) * Math.exp(-t * 160) * 0.15, 11 + k); });
      // slide: dry friction of a leather sole on the approach boards (band noise, slow decay)
      buffers.slide = [makeBuffer(0.9, (t, r) => { const e = Math.min(1, t / 0.03) * Math.exp(-t * 2.4); return (r() * 2 - 1) * e * (0.7 + 0.3 * Math.sin(TAU * 23 * t)); }, 21)];
      // release: fingers leaving the holes + a soft air movement
      buffers.release = [makeBuffer(0.3, (t, r) => (r() * 2 - 1) * Math.sin(Math.PI * clamp(t / 0.26, 0, 1)) * 0.35 + Math.sin(TAU * 420 * t) * Math.exp(-t * 90) * 0.4, 31)];
      // ball landing on the lane: heavy low thud + wood knock + click
      buffers.land = [0, 1].map(k => makeBuffer(0.5, (t, r) => Math.sin(TAU * (58 + k * 6) * t + 4 * Math.exp(-t * 40)) * Math.exp(-t * 16) + Math.sin(TAU * 236 * t) * Math.exp(-t * 30) * 0.35 + (r() * 2 - 1) * Math.exp(-t * 700) * 0.4, 41 + k));
      // ball -> pin: transient + hollow maple body + bright coated-shell partials
      const pinModes = k => [[620 + k * 23, 1, 38], [1170 + k * 31, 0.75, 46], [1760 + k * 19, 0.55, 55], [2410 + k * 41, 0.38, 70], [3120 + k * 17, 0.22, 90], [230 + k * 9, 0.6, 26]];
      buffers.pinHit = [0, 1, 2, 3].map(k => makeBuffer(0.42, (t, r) => { let s = 0; for (const [f, a, d] of pinModes(k)) s += Math.sin(TAU * f * t) * a * Math.exp(-t * d); return s * 0.7 + Math.sin(TAU * 70 * t) * Math.exp(-t * 30) * 0.7 + (r() * 2 - 1) * Math.exp(-t * 500) * 0.8; }, 51 + k));
      buffers.pinPin = [0, 1, 2, 3, 4].map(k => makeBuffer(0.3, (t, r) => { let s = 0; for (const [f, a, d] of pinModes(k * 1.7 + 2)) s += Math.sin(TAU * f * 1.08 * t) * a * Math.exp(-t * d * 1.25); return s * 0.8 + (r() * 2 - 1) * Math.exp(-t * 650) * 0.55; }, 61 + k));
      // pin falling on the wooden deck
      buffers.pinDeck = [0, 1, 2].map(k => makeBuffer(0.3, (t, r) => Math.sin(TAU * (165 + k * 25) * t) * Math.exp(-t * 32) + Math.sin(TAU * (510 + k * 40) * t) * Math.exp(-t * 48) * 0.45 + (r() * 2 - 1) * Math.exp(-t * 300) * 0.4, 71 + k));
      // kickback board / masking
      buffers.kick = [0, 1].map(k => makeBuffer(0.45, (t, r) => Math.sin(TAU * (118 + k * 14) * t) * Math.exp(-t * 18) + Math.sin(TAU * 347 * t) * Math.exp(-t * 34) * 0.35 + (r() * 2 - 1) * Math.exp(-t * 45) * 0.2, 81 + k));
      // pin rattling in the metal/synthetic gutter
      buffers.gutterHit = [0, 1].map(k => makeBuffer(0.5, (t, r) => { const p = [[410, 1, 14], [935, 0.6, 20], [1610, 0.4, 26], [2290, 0.2, 36]]; let s = 0; for (const [f, a, d] of p) s += Math.sin(TAU * f * (1 + k * 0.03) * t) * a * Math.exp(-t * d); return s * 0.6 + (r() * 2 - 1) * Math.exp(-t * 300) * 0.4; }, 91 + k));
      // pit floor / back cushion: muffled
      buffers.pit = [0, 1].map(k => { const b = brown(); return makeBuffer(0.5, (t, r) => Math.sin(TAU * (64 + k * 8) * t) * Math.exp(-t * 14) + b(r) * Math.exp(-t * 10) * 1.2, 101 + k); });
      // machinery: sweep motor, pinsetter, ball return rumble
      buffers.sweep = [makeBuffer(1.8, (t, r) => { const env = Math.min(1, t / 0.15) * Math.min(1, (1.8 - t) / 0.3); const saw = ((t * 72) % 1) * 2 - 1; return (saw * 0.35 + Math.sin(TAU * 144 * t) * 0.2 + (r() * 2 - 1) * 0.25) * env * (0.8 + 0.2 * Math.sin(TAU * 3 * t)); }, 111)];
      buffers.setter = [makeBuffer(1.4, (t, r) => { const env = Math.min(1, t / 0.1) * Math.min(1, (1.4 - t) / 0.2); const clunk = (t > 1.05 && t < 1.25) ? Math.sin(TAU * 140 * (t - 1.05)) * Math.exp(-(t - 1.05) * 25) * 2.2 : 0; return (Math.sin(TAU * 96 * t) * 0.25 + (r() * 2 - 1) * 0.18) * env + clunk; }, 121)];
      buffers.ret = [(() => { const b = brown(); return makeBuffer(2.2, (t, r) => { const env = Math.sin(Math.PI * clamp(t / 1.9, 0, 1)); const clunk = t > 1.9 ? Math.sin(TAU * 180 * (t - 1.9)) * Math.exp(-(t - 1.9) * 30) * 2 : 0; return b(r) * env * 2 + Math.sin(TAU * 41 * t) * env * 0.3 + clunk; }, 131); })()];
      // modest applause: Poisson claps, each band-limited at a random centre
      buffers.applause = [0, 1].map(k => {
        const sec = 3.4, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate), r = rnd(201 + k);
        for (let ch = 0; ch < 2; ch++) {
          const d = b.getChannelData(ch);
          let t = 0;
          while (t < sec) {
            const rate = 18 + 70 * Math.exp(-Math.pow((t - 0.7) / 1.0, 2));
            t += -Math.log(1 - r()) / rate;
            const i0 = Math.floor(t * ctx.sampleRate), len = Math.floor(ctx.sampleRate * (0.006 + r() * 0.01)), f = 900 + r() * 1800, amp = (0.35 + r() * 0.65) * Math.min(1, (sec - t) / 1.0);
            let y1 = 0, y2 = 0; const w = TAU * f / ctx.sampleRate, q = 2.2, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
            for (let j = 0; j < len && i0 + j < n; j++) { const x = (r() * 2 - 1) * Math.exp(-j / len * 4); const y = (alpha * x + 2 * Math.cos(w) * y1 - (1 - alpha) * y2) / a0; y2 = y1; y1 = y; d[i0 + j] += y * amp * 3; }
          }
          let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] *= 0.8 / (peak || 1);
        }
        return b;
      });
      // rolling loop: brown noise with a little grain
      buffers.roll = [(() => { const b = brown(); return makeBuffer(2.0, (t, r) => b(r) * 1.4 + (r() * 2 - 1) * 0.05, 141); })()];
      // hall bed: room tone + distant murmur (syllabic-rate modulated speech bands)
      buffers.bed = [(() => {
        const sec = 6, r0 = rnd(151), bands = [[320, 3.1], [540, 4.4], [880, 5.2], [1350, 3.7], [2100, 4.9]].map(([f, s]) => ({ f, s, ph: r0() * 6, y1: 0, y2: 0 }));
        const b0 = brown();
        return makeBuffer(sec, (t, r, c) => {
          let s = b0(r) * 0.6;
          for (const bd of bands) {
            const w = TAU * bd.f / ctx.sampleRate, alpha = Math.sin(w) / 6, a0 = 1 + alpha, x = r() * 2 - 1;
            const y = (alpha * x + 2 * Math.cos(w) * bd.y1 - (1 - alpha) * bd.y2) / a0; bd.y2 = bd.y1; bd.y1 = y;
            const env = 0.5 + 0.5 * Math.sin(TAU * bd.s * t + bd.ph + Math.sin(TAU * 0.37 * t + c));
            s += y * env * env * 1.6;
          }
          const edge = Math.min(1, t / 0.2, (sec - t) / 0.2);           // seamless loop edges
          return s * edge;
        }, 161, 2, 0.6);
      })()];
    }
    function impulse(sec = 1.8) { // medium hall
      const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate), r = rnd(401);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; d[i] = (r() * 2 - 1) * Math.pow(1 - t / sec, 2.6) * (t < 0.01 ? t / 0.01 : 1) * 0.42; } }
      return b;
    }

    async function unlock() {
      if (closed) return false;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      try {
        if (!ctx) {
          ctx = new AC({ latencyHint: 'interactive' });
          master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
          comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
          master.connect(comp).connect(ctx.destination);
          sfx = ctx.createGain(); sfx.connect(master);
          amb = ctx.createGain(); amb.gain.value = 1; amb.connect(master);
          verb = ctx.createConvolver(); synth(); verb.buffer = impulse(); verbSend = ctx.createGain(); verbSend.gain.value = 0.42; verbSend.connect(verb).connect(master);
          startBed(); startRoll();
        }
        await ctx.resume();
      } catch (e) { return false; }
      unlocked = ctx && ctx.state === 'running';
      return unlocked;
    }

    function startBed() {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buffers.bed[0]; s.loop = true; f.type = 'lowpass'; f.frequency.value = 2400; g.gain.value = 0;
      s.connect(f).connect(g).connect(amb); s.start();
      g.gain.setTargetAtTime(0.11, ctx.currentTime, 1.5);
      bed = { s, f, g };
    }
    function startRoll() {
      const s = ctx.createBufferSource(); s.buffer = buffers.roll[0]; s.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.8;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4;      // gutter tone
      const gLane = ctx.createGain(), gGut = ctx.createGain(); gLane.gain.value = 0; gGut.gain.value = 0;
      const am = ctx.createGain(); am.gain.value = 1;                                                            // finger-hole thump
      const lfo = ctx.createOscillator(), lfoDepth = ctx.createGain(); lfo.frequency.value = 4; lfoDepth.gain.value = 0; lfo.connect(lfoDepth).connect(am.gain); lfo.start();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      s.connect(lp).connect(gLane).connect(am); s.connect(bp).connect(gGut).connect(am);
      let out = am; if (pan) { am.connect(pan); out = pan; }
      out.connect(sfx); const send = ctx.createGain(); send.gain.value = 0.15; out.connect(send).connect(verbSend);
      s.start();
      roll = { s, lp, bp, gLane, gGut, lfo, lfoDepth, pan, send };
    }

    function spatial(pos) {
      if (!pos) return { gain: 1, pan: 0, wet: 0.25, cutoff: 12000 };
      const dx = pos[0] - listener.pos[0], dy = pos[1] - listener.pos[1], dz = pos[2] - listener.pos[2];
      const d = Math.hypot(dx, dy, dz);
      const pan = clamp((dx * listener.right[0] + dz * listener.right[2]) / Math.max(d, 1), -0.8, 0.8);
      return { gain: 1 / Math.sqrt(1 + (d / 6) ** 2), pan, wet: clamp(0.16 + d / 30, 0.16, 0.7), cutoff: clamp(14000 - d * 420, 2400, 14000), d };
    }
    function totalVoices() { let n = 0; active.forEach(l => { n += l.length; }); return n; }
    function voice(kind, { gain = 1, rate = 1, pos = null, wet = null, when = 0, bus = null, dur = 0 } = {}) {
      if (!unlocked || !ctx || ctx.state === 'closed' || !buffers[kind]) return null;
      const list = active.get(kind) || []; active.set(kind, list);
      const evict = l => { const old = l.shift(); if (!old) return; try { old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.02); old.s.stop(ctx.currentTime + 0.08); } catch (e) { } };
      while (list.length >= (limits[kind] || 3)) evict(list);
      if (totalVoices() >= GLOBAL_LIMIT) { let worst = null; active.forEach(l => { if (l.length && (!worst || l.length > worst.length)) worst = l; }); worst && evict(worst); }
      const variants = buffers[kind], s = ctx.createBufferSource(); s.buffer = variants[Math.floor(Math.random() * variants.length)];
      s.playbackRate.value = rate;
      const sp = spatial(pos), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      f.type = 'lowpass'; f.frequency.value = sp.cutoff;
      const level = clamp(gain * sp.gain, 0, 1.2); g.gain.value = level;
      s.connect(f).connect(g); let out = g; if (p) { p.pan.value = sp.pan; g.connect(p); out = p; }
      out.connect(bus || sfx);
      const send = ctx.createGain(); send.gain.value = wet ?? sp.wet; out.connect(send).connect(verbSend);
      const t0 = ctx.currentTime + Math.max(0, when);
      s.start(t0);
      if (dur) { g.gain.setValueAtTime(level, t0 + dur); g.gain.linearRampToValueAtTime(0, t0 + dur + 0.12); s.stop(t0 + dur + 0.15); }
      const v = { s, g, kind }; list.push(v);
      s.onended = () => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); try { s.disconnect(); g.disconnect(); f.disconnect(); p && p.disconnect(); send.disconnect(); } catch (e) { } };
      return v;
    }

    /** Scene events -> sounds. data.pos = [x,y,z]. */
    function event(type, data = {}) {
      if (!unlocked) return;
      const pos = data.pos || null, sp = data.speed || 1;
      switch (type) {
        case 'step': voice('step', { gain: data.soft ? 0.22 : 0.42, rate: 0.95 + Math.random() * 0.1, pos }); break;
        case 'slide': slideVoice = voice('slide', { gain: 0.32, pos, rate: 1 }); break;
        case 'slideStop': if (slideVoice) { try { slideVoice.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); slideVoice.s.stop(ctx.currentTime + 0.3); } catch (e) { } slideVoice = null; } break;
        case 'release': voice('release', { gain: 0.3, pos }); break;
        case 'contact': contact(data); break;
        case 'pit': voice('pit', { gain: 0.5, pos }); break;
        case 'sweep': voice('sweep', { gain: 0.32, pos }); voice('setter', { gain: 0.3, pos, when: 1.0 }); break;
        case 'return': voice('ret', { gain: 0.45, pos }); break;
      }
      void sp;
    }
    function contact(e) {
      const pos = e.pos, s = e.speed || 0;
      switch (e.type) {
        case 'ball-pin': voice('pinHit', { gain: clamp(s / 5, 0.25, 1), rate: 0.96 + Math.random() * 0.08, pos, wet: 0.45 }); break;
        case 'pin-pin': voice('pinPin', { gain: clamp(s / 4, 0.12, 0.85), rate: 0.95 + Math.random() * 0.12, pos, wet: 0.45 }); break;
        case 'deck': case 'tail': case 'capping': case 'edge': if (e.a === 'pin') voice('pinDeck', { gain: clamp(s / 3.5, 0.1, 0.8), rate: 0.9 + Math.random() * 0.2, pos }); else if (s > 0.6) voice('land', { gain: clamp(s / 3, 0.2, 0.7), pos }); break;
        case 'lane': if (s > 0.35) voice('land', { gain: clamp(s / 1.6, 0.25, 0.95), pos }); break;
        case 'approach': if (s > 0.35) voice('land', { gain: 0.5, pos }); break;
        case 'gutter': if (e.a === 'pin') voice('gutterHit', { gain: clamp(s / 3, 0.15, 0.7), pos }); else if (s > 0.3) voice('land', { gain: clamp(s / 2, 0.2, 0.6), pos, rate: 1.15 }); break;
        case 'kickback': case 'ceiling': voice('kick', { gain: clamp(s / 4, 0.15, 0.8), pos }); break;
        case 'pit': case 'cushion': voice('pit', { gain: clamp(s / 4, 0.15, 0.7), pos }); break;
      }
    }

    /** Continuous rolling sound: call every frame with the ball state. */
    function rolling(st = {}) {
      if (!unlocked || !roll) return;
      const now = ctx.currentTime, on = !st.frozen && !st.airborne && !st.pit && (st.onLane || st.gutter);
      const v = clamp((st.speed || 0) / 8, 0, 1);
      const sp = spatial(st.pos);
      const lane = on && !st.gutter ? (0.18 + 0.55 * v) * sp.gain * 1.5 : 0, gut = on && st.gutter ? (0.25 + 0.4 * v) * sp.gain * 1.5 : 0;
      roll.gLane.gain.setTargetAtTime(lane, now, 0.06); roll.gGut.gain.setTargetAtTime(gut, now, 0.06);
      roll.lp.frequency.setTargetAtTime(180 + 520 * v, now, 0.1);
      const hz = clamp((st.spin || 0) / TAU, 0.5, 14);
      roll.lfo.frequency.setTargetAtTime(hz, now, 0.1); roll.lfoDepth.gain.setTargetAtTime(on ? 0.25 : 0, now, 0.1);
      if (roll.pan) roll.pan.pan.setTargetAtTime(sp.pan, now, 0.1);
    }

    function crowd(kind) {
      if (!unlocked || !ctx) return;
      const now = ctx.currentTime;
      if (kind === 'question') bed.g.gain.setTargetAtTime(0.06, now, 0.8);
      else if (kind === 'strike') { bed.g.gain.setTargetAtTime(0.12, now, 1.5); voice('applause', { gain: 0.42, wet: 0.45, bus: amb, when: 0.25 }); }
      else if (kind === 'good') { bed.g.gain.setTargetAtTime(0.11, now, 1.5); voice('applause', { gain: 0.22, wet: 0.5, bus: amb, when: 0.3, rate: 0.95 }); }
      else if (kind === 'support') voice('applause', { gain: 0.1, wet: 0.55, bus: amb, when: 0.9, rate: 0.9 });
      else bed.g.gain.setTargetAtTime(0.11, now, 1.2);
    }

    function setListener(pos, right) { listener.pos = pos; listener.right = right; }
    function setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05); }
    function setVolume(v) { volume = clamp(v, 0, 1); if (master && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); }
    function suspend() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => { }); }
    function resume() { if (ctx && unlocked && ctx.state === 'suspended') ctx.resume().catch(() => { }); }
    /** Stop every one-shot (restart / early end); the bed and roll loop stay, silent when idle. */
    function stopAll() {
      if (!ctx) return;
      active.forEach(l => { for (const v of l.splice(0)) { try { v.g.gain.setTargetAtTime(0, ctx.currentTime, 0.03); v.s.stop(ctx.currentTime + 0.1); } catch (e) { } } });
      if (roll) { roll.gLane.gain.setTargetAtTime(0, ctx.currentTime, 0.03); roll.gGut.gain.setTargetAtTime(0, ctx.currentTime, 0.03); }
      slideVoice = null;
    }
    function close() {
      closed = true; unlocked = false;
      if (ctx) { try { stopAll(); bed && bed.s.stop(); roll && (roll.s.stop(), roll.lfo.stop()); } catch (e) { } try { ctx.close(); } catch (e) { } }
      ctx = null; roll = null; bed = null;
    }
    function stats() { return { voices: totalVoices(), state: ctx ? ctx.state : 'none', unlocked, muted, volume, loops: (bed ? 1 : 0) + (roll ? 1 : 0) }; }
    function analyse() {
      const out = {};
      for (const [k, list] of Object.entries(buffers)) out[k] = list.map(b => { let s = 0, pk = 0, nan = false, n = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) nan = true; s += v * v; pk = Math.max(pk, Math.abs(v)); n++; } } return { sec: +b.duration.toFixed(2), rms: +Math.sqrt(s / n).toFixed(4), peak: +pk.toFixed(3), nan }; });
      return out;
    }

    return { unlock, event, rolling, crowd, setListener, setMuted, setVolume, suspend, resume, stopAll, close, stats, analyse, get muted() { return muted; }, get volume() { return volume; }, get ready() { return unlocked; } };
  }

  root.BowlingAudio = { create };
})(typeof window !== 'undefined' ? window : globalThis);
