/* عدّاء قطر — original audio, synthesised in the browser with the Web Audio API (no recordings, no external files).
 * Music: an original running theme in maqam Hijaz on D (plucked-string lead by Karplus–Strong, darbuka-style
 * doum/tak, Gulf-style hand-claps, bass, pad), with menu / run / question / finish arrangements and ducking.
 * SFX are timed by gameplay events (footsteps come from the animator's real foot contacts).
 */
(function (root) {
  'use strict';
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  // MIDI numbers for D Hijaz: D Eb F# G A Bb C
  const D3 = 50, Eb3 = 51, Fs3 = 54, G3 = 55, A3 = 57, Bb3 = 58, C4 = 60, D4 = 62, Eb4 = 63, Fs4 = 66, G4 = 67, A4 = 69, Bb4 = 70, C5 = 72, D5 = 74;
  const A1 = 33, Bb1 = 34, C2 = 36, D2 = 38;

  class QRAudio {
    constructor(prefs = {}) { this.prefs = { music: prefs.music == null ? 0.7 : prefs.music, sfx: prefs.sfx == null ? 0.9 : prefs.sfx, muted: !!prefs.muted }; this.ctx = null; this.mode = 'menu'; this.intensity = 0.4; this.zone = 'corniche'; this.log = []; }
    get ready() { return !!this.ctx; }
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      const ctx = this.ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
      this.master = ctx.createGain(); this.master.gain.value = this.prefs.muted ? 0 : 0.9; this.master.connect(comp); comp.connect(ctx.destination);
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.prefs.music * 0.55; this.duckG = ctx.createGain(); this.musicBus.connect(this.duckG); this.duckG.connect(this.master);
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.prefs.sfx; this.sfxBus.connect(this.master);
      this.ambBus = ctx.createGain(); this.ambBus.gain.value = this.prefs.sfx * 0.55; this.ambBus.connect(this.master);
      // a small room reverb for the music + sfx tails (generated impulse)
      this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(1.6, 2.6); const vg = ctx.createGain(); vg.gain.value = 0.16; this.verb.connect(vg); vg.connect(this.master);
      this.noiseW = this.noiseBuffer('white', 2); this.noiseP = this.noiseBuffer('pink', 4); this.noiseB = this.noiseBuffer('brown', 4);
      this.plucks = {}; for (const n of [D3, Eb3, Fs3, G3, A3, Bb3, C4, D4, Eb4, Fs4, G4, A4, Bb4, C5, D5]) this.plucks[n] = this.pluckBuffer(NOTE(n), 1.5);
      this.startAmbience(); this.step = 0; this.nextT = ctx.currentTime + 0.1; this.bar = 0;
      this.timer = setInterval(() => this.schedule(), 25);
    }
    noiseBuffer(kind, secs) {
      const ctx = this.ctx, n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
        else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      }
      return b;
    }
    pluckBuffer(f, secs) { // Karplus–Strong plucked string (oud-like), rendered once
      const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
      const N = Math.max(2, Math.round(sr / f)); const ring = new Float32Array(N);
      let lp = 0; for (let i = 0; i < N; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; ring[i] = lp; }
      let idx = 0, prev = 0; const decay = 0.996 - Math.min(0.006, f / 120000);
      for (let i = 0; i < n; i++) { const cur = ring[idx]; const nxt = ring[(idx + 1) % N]; const v = (cur + nxt) * 0.5 * decay; ring[idx] = v; d[i] = cur * 0.9 + prev * 0.1; prev = cur; idx = (idx + 1) % N; }
      return b;
    }
    impulse(secs, decay) { const ctx = this.ctx, n = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
    // ---------------------------------------------------------------- prefs
    set(k, v) { this.prefs[k] = v; if (!this.ctx) return; const t = this.ctx.currentTime; if (k === 'music') this.musicBus.gain.setTargetAtTime(v * 0.55, t, 0.05); if (k === 'sfx') { this.sfxBus.gain.setTargetAtTime(v, t, 0.05); this.ambBus.gain.setTargetAtTime(v * 0.55, t, 0.05); } }
    toggleMute(force) { this.prefs.muted = force == null ? !this.prefs.muted : !!force; if (this.ctx) this.master.gain.setTargetAtTime(this.prefs.muted ? 0 : 0.9, this.ctx.currentTime, 0.04); return this.prefs.muted; }
    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    close() { clearInterval(this.timer); if (this.ctx) this.ctx.close(); this.ctx = null; }
    duck(amount = 0.35, hold = 1.2) { if (!this.ctx) return; const g = this.duckG.gain, t = this.ctx.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(amount, t, 0.05); g.setTargetAtTime(1, t + hold, 0.4); }
    note(name) { this.log.push(name); if (this.log.length > 60) this.log.shift(); }
    // ---------------------------------------------------------------- building blocks
    env(g, t, a, peak, d, sustain = 0, rel = 0.05, hold = 0) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(sustain, t + a + hold, d); if (rel) g.gain.setTargetAtTime(0.0001, t + a + hold + d * 3, rel); }
    noise(t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.3, buf = 'W', attack = 0.002, sweep = null, bus = null, pan = 0, rate = 1 } = {}) {
      const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf === 'P' ? this.noiseP : buf === 'B' ? this.noiseB : this.noiseW; s.playbackRate.value = rate;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
      s.connect(f); f.connect(g); out.connect(bus || this.sfxBus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return { s, f, g };
    }
    tone(t, freq, dur, { type = 'sine', gain = 0.2, attack = 0.005, glide = null, bus = null, detune = 0, verb = 0, pan = 0 } = {}) {
      const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune; if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); let out = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
      out.connect(bus || this.sfxBus); if (verb) { const v = ctx.createGain(); v.gain.value = verb; out.connect(v); v.connect(this.verb); }
      o.start(t); o.stop(t + dur + 0.05); return o;
    }
    pluck(t, n, gain = 0.25, bus = null, pan = 0) {
      const ctx = this.ctx, b = this.plucks[n]; if (!b) return; const s = ctx.createBufferSource(); s.buffer = b;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200; const g = ctx.createGain(); g.gain.value = gain;
      s.connect(f); f.connect(g); let out = g; if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
      out.connect(bus || this.musicBus); const v = ctx.createGain(); v.gain.value = 0.35; out.connect(v); v.connect(this.verb);
      s.start(t); s.stop(t + 1.5);
    }
    brass(t, n, dur, gain = 0.12, bus = null) {
      const ctx = this.ctx, f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(2600, t + 0.06); f.frequency.setTargetAtTime(1400, t + 0.08, 0.2);
      const g = ctx.createGain(); this.env(g, t, 0.03, gain, 0.25, gain * 0.7, 0.08, Math.max(0, dur - 0.3)); f.connect(g); g.connect(bus || this.musicBus); const v = ctx.createGain(); v.gain.value = 0.4; g.connect(v); v.connect(this.verb);
      for (const d of [-7, 0, 6]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.5); }
    }
    // ---------------------------------------------------------------- music
    setMode(mode) { if (mode === this.mode) return; this.mode = mode; this.note('music:' + mode); if (mode === 'finish' && this.ctx) this.victory(); }
    schedule() {
      const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
      const bpm = this.mode === 'run' ? 118 + 10 * this.intensity : this.mode === 'question' ? 84 : 96, s16 = 60 / bpm / 4;
      while (this.nextT < ctx.currentTime + 0.14) { this.playStep(this.step, this.nextT, s16); this.nextT += s16; this.step = (this.step + 1) % 16; if (this.step === 0) this.bar++; }
    }
    playStep(st, t, s16) {
      const m = this.mode, bar = this.bar % 8, I = this.intensity, mb = this.musicBus;
      if (m === 'silent' || m === 'finish') return;
      const chord = [[D2, D3], [D2, D3], [C2, C4], [Bb1, Bb3], [D2, D3], [D2, D3], [C2, C4], [A1, A3]][bar];
      if (m === 'question') { // calm pad + soft pulse while thinking
        if (st === 0 && bar % 2 === 0) this.pad(t, [D3, A3, D4, Fs4].map(NOTE), s16 * 32, 0.035);
        if (st % 8 === 0) this.tone(t, 55, 0.25, { gain: 0.08, bus: mb });
        if (st === 6 || st === 14) this.pluck(t, [A4, Fs4, G4, Eb4][(this.bar + (st > 8 ? 1 : 0)) % 4], 0.06, mb, 0.3);
        return;
      }
      const run = m === 'run';
      // percussion: doum / tak / clap / shaker (Gulf-inspired, original pattern)
      if ([0, 6, 10].includes(st)) this.doum(t, run ? 0.5 : 0.32);
      if ([4, 12].includes(st) || (run && st === 14)) this.tak(t, run ? 0.26 : 0.16);
      if (run && I > 0.25 && (st === 4 || st === 12)) this.clap(t, 0.2 + 0.1 * I);
      if (st % 2 === 0) this.noise(t, 0.04, { type: 'highpass', freq: 7000, gain: (st % 4 === 2 ? 0.05 : 0.025) * (run ? 1 : 0.6), bus: mb });
      if (run && I > 0.55 && (st === 0 || st === 8)) this.kick(t, 0.5);
      // bass
      const bassPat = run ? [0, 3, 6, 8, 11, 14] : [0, 8];
      if (bassPat.includes(st)) this.bass(t, NOTE(st === 6 || st === 14 ? chord[0] + 7 : chord[0]), s16 * (run ? 1.6 : 6), run ? 0.2 : 0.14);
      // lead motif (plucked string), call & answer over two bars
      const motifA = { 0: D4, 2: Eb4, 3: Fs4, 4: G4, 6: A4, 8: Bb4, 10: A4, 12: G4, 13: Fs4, 14: Eb4 };
      const motifB = { 0: Fs4, 2: G4, 4: A4, 7: C5, 8: Bb4, 10: A4, 12: G4, 14: Fs4 };
      const motifC = { 0: D5, 3: C5, 4: Bb4, 6: A4, 8: G4, 10: Fs4, 11: G4, 12: Eb4, 14: D4 };
      const motif = bar === 7 ? motifC : bar % 2 ? motifB : motifA;
      if ((run || st % 4 === 0) && motif[st] != null && (run || bar % 2 === 0)) this.pluck(t, motif[st], run ? 0.2 : 0.13, mb, st % 2 ? -0.2 : 0.2);
      if (run && I > 0.7 && st % 2 === 1) this.pluck(t, [D4, Fs4, A4, D5][(st >> 1) % 4], 0.06, mb, 0.4);
      if (st === 0 && bar % 4 === 0) this.pad(t, [chord[1], chord[1] + 7, chord[1] + 12].map(NOTE), s16 * 64, run ? 0.03 : 0.04);
    }
    doum(t, g) { this.tone(t, 110, 0.32, { glide: 52, gain: g, bus: this.musicBus }); this.noise(t, 0.05, { type: 'lowpass', freq: 400, gain: g * 0.3, bus: this.musicBus }); }
    tak(t, g) { this.noise(t, 0.07, { type: 'bandpass', freq: 2600, q: 2, gain: g, bus: this.musicBus }); this.tone(t, 900, 0.05, { glide: 600, gain: g * 0.35, bus: this.musicBus }); }
    clap(t, g) { for (let i = 0; i < 3; i++) this.noise(t + i * 0.011, 0.09, { type: 'bandpass', freq: 1400 + i * 300, q: 1.2, gain: g * (1 - i * 0.2), bus: this.musicBus, pan: (i - 1) * 0.3 }); }
    kick(t, g) { this.tone(t, 150, 0.22, { glide: 42, gain: g, bus: this.musicBus }); }
    bass(t, f, dur, g) {
      const ctx = this.ctx, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(220, t); fl.frequency.linearRampToValueAtTime(700, t + 0.02); fl.frequency.setTargetAtTime(240, t + 0.03, 0.08);
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(g, t + 0.01); gg.gain.setTargetAtTime(0.0001, t + dur * 0.6, dur * 0.2);
      o.connect(fl); fl.connect(gg); gg.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.3);
    }
    pad(t, freqs, dur, g) {
      const ctx = this.ctx, fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900; const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(g, t + dur * 0.25); gg.gain.linearRampToValueAtTime(0.0001, t + dur);
      fl.connect(gg); gg.connect(this.musicBus); const v = ctx.createGain(); v.gain.value = 0.6; gg.connect(v); v.connect(this.verb);
      for (const f of freqs) for (const d of [-9, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(fl); o.start(t); o.stop(t + dur + 0.1); }
    }
    // ---------------------------------------------------------------- ambience (city / sea / souq) + wind
    startAmbience() {
      const ctx = this.ctx;
      const loop = (buf, type, freq, q, gain) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = gain; s.connect(f); f.connect(g); g.connect(this.ambBus); s.start(); return { s, f, g }; };
      this.amb = {
        sea: loop(this.noiseB, 'lowpass', 520, 0.5, 0.0), traffic: loop(this.noiseB, 'lowpass', 180, 0.7, 0.0),
        murmur: loop(this.noiseP, 'bandpass', 700, 0.8, 0.0), wind: loop(this.noiseW, 'bandpass', 900, 0.5, 0.0)
      };
      this.ambT = 0; this.nextGull = 6; this.nextVoice = 3;
    }
    update(dt, s) { // s = {speed, zone, paused}
      if (!this.ctx || this.ctx.state !== 'running') return; const t = this.ctx.currentTime; this.ambT += dt;
      const sea = s.zone === 'corniche' ? 1 : 0, souq = s.zone === 'souq' ? 1 : 0, v = s.paused ? 0 : s.speed;
      this.amb.sea.g.gain.setTargetAtTime(0.22 * sea * (0.65 + 0.35 * Math.sin(this.ambT * 0.7)), t, 0.5);
      this.amb.traffic.g.gain.setTargetAtTime(0.12 * (1 - souq * 0.7), t, 0.8);
      this.amb.murmur.g.gain.setTargetAtTime(0.1 * souq * (0.8 + 0.2 * Math.sin(this.ambT * 2.3)), t, 0.3);
      this.amb.murmur.f.frequency.setTargetAtTime(600 + 300 * Math.sin(this.ambT * 1.7), t, 0.2);
      this.amb.wind.g.gain.setTargetAtTime(Math.min(0.2, 0.0021 * v * v), t, 0.15); this.amb.wind.f.frequency.setTargetAtTime(600 + Math.abs(v) * 70, t, 0.2);
      this.intensity = Math.min(1, Math.max(0, (v - 5) / 6));
      if (sea && (this.nextGull -= dt) < 0) { this.nextGull = 7 + Math.random() * 10; for (let i = 0; i < 2 + (Math.random() * 2 | 0); i++) this.tone(t + i * 0.22, 1900 + Math.random() * 300, 0.18, { type: 'triangle', glide: 1200, gain: 0.025, bus: this.ambBus, pan: 0.6 }); }
      if (souq && (this.nextVoice -= dt) < 0) { this.nextVoice = 1.2 + Math.random() * 2.5; this.noise(t, 0.35, { type: 'bandpass', freq: 500 + Math.random() * 700, q: 6, gain: 0.04, buf: 'P', bus: this.ambBus, pan: Math.random() * 1.6 - 0.8 }); }
    }
    // ---------------------------------------------------------------- SFX
    now() { return this.ctx ? this.ctx.currentTime : 0; }
    footstep(side, speed, surface = 'asphalt') {
      if (!this.ctx) return; const t = this.now(), k = Math.min(1, 0.35 + speed / 10), pan = side === 'L' ? -0.12 : 0.12;
      const f = surface === 'stone' ? 2300 : surface === 'paver' ? 1500 : 1100;
      this.noise(t, 0.05 + 0.02 * Math.random(), { type: 'bandpass', freq: f * (0.85 + Math.random() * 0.3), q: 1.4, gain: 0.16 * k, pan });
      this.tone(t, 85, 0.07, { glide: 48, gain: 0.12 * k, pan });
    }
    jump() { if (!this.ctx) return; const t = this.now(); this.note('jump'); this.noise(t, 0.32, { type: 'bandpass', freq: 500, sweep: 2600, q: 0.8, gain: 0.14 }); this.noise(t + 0.02, 0.22, { type: 'highpass', freq: 2500, gain: 0.05, buf: 'P' }); this.tone(t, 260, 0.12, { glide: 360, gain: 0.04, type: 'triangle' }); }
    land(k = 1) { if (!this.ctx) return; const t = this.now(); this.note('land'); this.tone(t, 95, 0.16, { glide: 45, gain: 0.26 * k }); this.noise(t, 0.12, { type: 'bandpass', freq: 900, q: 0.9, gain: 0.18 * k }); this.noise(t + 0.03, 0.18, { type: 'highpass', freq: 3000, gain: 0.04 * k, buf: 'P' }); }
    slide() { if (!this.ctx) return; const t = this.now(); this.note('slide'); const n = this.noise(t, 0.75, { type: 'bandpass', freq: 1700, q: 0.7, gain: 0.13, attack: 0.04 }); n.f.frequency.linearRampToValueAtTime(900, t + 0.7); this.noise(t, 0.3, { type: 'highpass', freq: 3500, gain: 0.05, buf: 'P' }); }
    lane(dir) { if (!this.ctx) return; const t = this.now(); this.noise(t, 0.16, { type: 'bandpass', freq: 1200, sweep: 2400, q: 1.2, gain: 0.06, pan: dir * 0.5 }); }
    coin(chain = 0) { if (!this.ctx) return; const t = this.now(); const st = [0, 2, 4, 7, 9, 12][Math.min(5, chain % 6)]; const f = 1568 * Math.pow(2, st / 12); this.tone(t, f, 0.18, { gain: 0.07, type: 'triangle', verb: 0.3 }); this.tone(t + 0.045, f * 1.5, 0.25, { gain: 0.05, verb: 0.3 }); }
    hit(kind = 'soft') { if (!this.ctx) return; const t = this.now(); this.note('hit:' + kind); if (kind === 'cone' || kind === 'soft') { this.tone(t, 300, 0.12, { glide: 140, gain: 0.12, type: 'triangle' }); this.noise(t, 0.18, { type: 'bandpass', freq: 700, gain: 0.18 }); } else { this.tone(t, 70, 0.3, { glide: 40, gain: 0.32 }); this.noise(t, 0.25, { type: 'lowpass', freq: 1400, gain: 0.25 }); this.tone(t, 520, 0.25, { glide: 260, gain: 0.05, type: 'square' }); } }
    gateAppear() { if (!this.ctx) return; const t = this.now(); this.note('gate-appear'); [D4, Fs4, A4, D5].forEach((n, i) => this.tone(t + i * 0.09, NOTE(n), 1.4, { type: 'triangle', gain: 0.045, verb: 0.6 })); this.noise(t, 1.2, { type: 'bandpass', freq: 3000, sweep: 6000, q: 3, gain: 0.03 }); }
    questionOpen() { if (!this.ctx) return; const t = this.now(); this.note('question-open'); this.tone(t, NOTE(A4), 0.5, { type: 'sine', gain: 0.07, verb: 0.5 }); this.tone(t + 0.12, NOTE(D5), 0.7, { type: 'sine', gain: 0.07, verb: 0.5 }); }
    select() { if (!this.ctx) return; const t = this.now(); this.note('select'); this.tone(t, 900, 0.06, { type: 'square', gain: 0.04 }); this.tone(t, 1800, 0.05, { gain: 0.03 }); }
    tick(urgent) { if (!this.ctx) return; const t = this.now(); this.tone(t, urgent ? 1320 : 880, 0.06, { type: 'triangle', gain: urgent ? 0.07 : 0.04 }); }
    success() {
      if (!this.ctx) return; const t = this.now(); this.note('success'); this.duck(0.3, 1.6);
      [D4, Fs4, A4, D5].forEach((n, i) => { this.tone(t + i * 0.075, NOTE(n), 0.6, { type: 'triangle', gain: 0.09, verb: 0.6 }); this.tone(t + i * 0.075, NOTE(n + 12), 0.35, { gain: 0.03 }); });
      this.brass(t + 0.3, D4, 0.6, 0.06, this.sfxBus); this.brass(t + 0.3, A4, 0.6, 0.05, this.sfxBus);
      this.noise(t + 0.2, 1.0, { type: 'highpass', freq: 5000, gain: 0.05, attack: 0.3 });
    }
    gateOpen() { if (!this.ctx) return; const t = this.now(); this.note('gate-open'); this.noise(t, 1.1, { type: 'bandpass', freq: 300, sweep: 3200, q: 0.9, gain: 0.12, attack: 0.25 }); this.tone(t, 70, 1.0, { glide: 140, gain: 0.08 }); [D5, A4, Fs4].forEach((n, i) => this.tone(t + 0.4 + i * 0.06, NOTE(n + 12), 0.9, { gain: 0.03, verb: 0.8 })); }
    wrong() { if (!this.ctx) return; const t = this.now(); this.note('wrong'); this.duck(0.35, 1.8); this.tone(t, NOTE(G3), 0.35, { type: 'triangle', gain: 0.12 }); this.tone(t + 0.18, NOTE(Eb3), 0.6, { type: 'triangle', gain: 0.12 }); this.tone(t, 98, 0.8, { gain: 0.06 }); }
    wave() { if (!this.ctx) return; const t = this.now(); this.note('wave'); this.noise(t, 0.6, { type: 'bandpass', freq: 3000, sweep: 260, q: 1.1, gain: 0.2, attack: 0.02 }); this.tone(t + 0.25, 60, 0.5, { glide: 38, gain: 0.25 }); }
    recoil() { if (!this.ctx) return; const t = this.now(); this.note('recoil'); this.noise(t, 0.2, { type: 'bandpass', freq: 800, q: 1, gain: 0.12 }); this.noise(t + 0.1, 0.5, { type: 'highpass', freq: 2500, gain: 0.05, buf: 'P' }); }
    stage() { if (!this.ctx) return; const t = this.now(); this.note('stage'); this.duck(0.4, 1.6); [D4, A4, D5, Fs4 + 12].forEach((n, i) => this.brass(t + i * 0.12, n, 0.35, 0.05, this.sfxBus)); }
    victory() {
      if (!this.ctx) return; const t = this.now() + 0.05; this.note('victory');
      const mel = [[D4, 0, 0.25], [D4, 0.25, 0.25], [Fs4, 0.5, 0.25], [A4, 0.75, 0.5], [G4, 1.25, 0.25], [A4, 1.5, 0.25], [D5, 1.75, 1.2]];
      for (const [n, at, d] of mel) { this.brass(t + at, n, d, 0.09); this.brass(t + at, n - 12, d, 0.05); }
      for (const at of [0, 0.5, 1.0, 1.25, 1.5, 1.75]) this.tone(t + at, 98, 0.5, { glide: 70, gain: 0.25, bus: this.musicBus });
      [D3, A3, D4, Fs4, A4].forEach(n => this.pad(t + 1.75, [NOTE(n)], 2.6, 0.02));
      this.crowd(t + 0.3, 3.2);
    }
    crowd(t, dur) { // synthesised cheering: formant-filtered noise swells, whistles and scattered claps
      if (!this.ctx) return; t = t || this.now(); this.note('crowd');
      for (const [f, g] of [[520, 0.12], [1100, 0.09], [2500, 0.05]]) { const n = this.noise(t, dur, { type: 'bandpass', freq: f, q: 1.6, gain: g, buf: 'P', attack: 0.35 }); n.f.frequency.linearRampToValueAtTime(f * 1.15, t + dur * 0.4); }
      for (let i = 0; i < 26; i++) this.noise(t + Math.random() * dur * 0.8, 0.05, { type: 'bandpass', freq: 1300 + Math.random() * 900, q: 1.5, gain: 0.05 + Math.random() * 0.05, pan: Math.random() * 1.6 - 0.8 });
      for (let i = 0; i < 2; i++) this.tone(t + 0.4 + i * 0.7, 2200, 0.45, { glide: 3000, gain: 0.03, type: 'sine', pan: i ? 0.5 : -0.5 });
    }
    carPass(pan = -0.7) { if (!this.ctx) return; const t = this.now(); const n = this.noise(t, 1.0, { type: 'lowpass', freq: 900, gain: 0.08, attack: 0.35, buf: 'P', pan }); n.f.frequency.linearRampToValueAtTime(400, t + 0.9); this.tone(t, 120, 0.9, { type: 'sawtooth', glide: 80, gain: 0.015, attack: 0.3, pan }); }
  }
  root.QRAudio = QRAudio;
})(typeof window !== 'undefined' ? window : globalThis);
