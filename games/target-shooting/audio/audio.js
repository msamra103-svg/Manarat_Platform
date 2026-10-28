/* Target Shooting 3D — original synthesised audio (Web Audio API). No sample files, no licensed music.
 * Separate buses for effects and music, a limiter on the master, per-sound voice limits (no stacking of
 * the same effect), and nothing starts before a user gesture (browser autoplay rules): unlock() is called
 * from the first pointer/key event.
 */
(function (root) {
  'use strict';
  const TS = root.TS = root.TS || {};

  function create(opts = {}) {
    const AC = root.AudioContext || root.webkitAudioContext;
    const a = { sfxOn: opts.sfx !== false, musicOn: opts.music !== false, ready: false, ctx: null, voices: {}, loops: {}, timers: [] };
    let ctx, master, sfxBus, musicBus, ambBus, noise, comp;
    function init() {
      if (ctx || !AC) return !!ctx;
      try { ctx = new AC(); } catch (e) { return false; }
      a.ctx = ctx;
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2;
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = a.sfxOn ? 0.9 : 0; sfxBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = a.sfxOn ? 0.5 : 0; ambBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = a.musicOn ? 0.32 : 0; musicBus.connect(master);
      const len = ctx.sampleRate * 2; noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0); let s = 12345; for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
      return true;
    }
    a.unlock = () => { if (!init()) return Promise.resolve(false); a.ready = true; return ctx.state === 'suspended' ? ctx.resume().then(() => true, () => false) : Promise.resolve(true); };
    a.setSfx = on => { a.sfxOn = on; if (ctx) { const t = ctx.currentTime; sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.05); ambBus.gain.setTargetAtTime(on ? 0.5 : 0, t, 0.1); } };
    a.setMusic = on => { a.musicOn = on; if (ctx) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.1); };
    const now = () => ctx.currentTime;
    function voice(name, limit) { const v = a.voices[name] || (a.voices[name] = []); while (v.length >= limit) { const o = v.shift(); try { o.stop(); } catch (e) { } } return v; }
    function track(name, src, limit = 3) { const v = voice(name, limit); v.push(src); src.onended = () => { const i = v.indexOf(src); if (i >= 0) v.splice(i, 1); }; }
    function env(g, t, a1, peak, d1, sus = 0) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a1); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a1 + d1); }
    function out(pan = 0, bus = sfxBus) { const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(bus); return p; } return bus; }
    function noiseSrc(t, dur, f1, f2, q, type = 'bandpass', gain = 0.5, pan = 0, a1 = 0.005, name = 'n', limit = 4) {
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      const g = ctx.createGain(); env(g, t, a1, gain, dur);
      s.connect(f); f.connect(g); g.connect(out(pan));
      s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); track(name, s, limit); return s;
    }
    function tone(t, freq, dur, type = 'sine', gain = 0.3, pan = 0, bus = sfxBus, f2 = null, a1 = 0.004, name = 't', limit = 8) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = ctx.createGain(); env(g, t, a1, gain, dur);
      o.connect(g); g.connect(out(pan, bus)); o.start(t); o.stop(t + dur + 0.05); track(name, o, limit); return o;
    }
    const SFX = {
      draw(o) { const t = now(); noiseSrc(t, 0.65, 300, 900, 6, 'bandpass', 0.05 * (o.level || 1), -0.2, 0.08, 'draw', 1); tone(t, 55, 0.6, 'triangle', 0.025, -0.2, sfxBus, 62, 0.15, 'drawt', 1); },
      release(o) { const t = now(); tone(t, 180, 0.22, 'triangle', 0.28, -0.25, sfxBus, 95, 0.002, 'rel', 2); tone(t, 360, 0.12, 'sine', 0.12, -0.25, sfxBus, 190, 0.002, 'rel2', 2); noiseSrc(t, 0.06, 2400, 900, 1.2, 'bandpass', 0.35, -0.25, 0.001, 'relN', 2); noiseSrc(t + 0.02, 0.32, 1800, 500, 2, 'bandpass', 0.09, 0.1, 0.03, 'whoosh', 3); },
      thud(o) { const t = now(); tone(t, 95, 0.16, 'sine', 0.5, o.pan || 0, sfxBus, 55, 0.002, 'thud', 3); noiseSrc(t, 0.09, 900, 250, 1.5, 'lowpass', 0.4, o.pan || 0, 0.001, 'thudN', 3); },
      ground(o) { const t = now(); tone(t, 70, 0.1, 'sine', 0.25, o.pan || 0, sfxBus, 45, 0.002, 'grd', 2); noiseSrc(t, 0.12, 600, 200, 1, 'lowpass', 0.25, o.pan || 0, 0.002, 'grdN', 2); },
      pop(o) { const t = now(); noiseSrc(t, 0.07, 4000, 1200, 0.8, 'highpass', 0.6, o.pan || 0, 0.0008, 'pop', 3); tone(t, 900, 0.04, 'square', 0.08, o.pan || 0, sfxBus, 300, 0.001, 'popt', 3); },
      shatter(o) { const t = now(); noiseSrc(t, 0.22, 5200, 1800, 1.2, 'bandpass', 0.5, o.pan || 0, 0.001, 'sh', 3); for (let i = 0; i < 5; i++) tone(t + 0.012 * i, 2400 + 700 * i, 0.03, 'triangle', 0.06, o.pan || 0, sfxBus, null, 0.001, 'sht', 10); },
      launch(o) { const t = now(); tone(t, 140, 0.12, 'square', 0.12, o.pan || 0, sfxBus, 60, 0.002, 'lch', 2); noiseSrc(t, 0.18, 1400, 400, 1, 'bandpass', 0.25, o.pan || 0, 0.002, 'lchN', 2); },
      tag(o) { const t = now(); [880, 1175, 1568].forEach((f, i) => tone(t + i * 0.06, f, 0.35, 'sine', 0.13, o.pan || 0, sfxBus, null, 0.003, 'tag', 6)); },
      wings(o) { const t = now(); for (let i = 0; i < 4; i++) noiseSrc(t + i * 0.11, 0.07, 700, 300, 1, 'bandpass', 0.05 * (o.level || 1), o.pan || 0, 0.01, 'wing', 4); },
      bull() { const t = now(); [660, 990, 1320].forEach((f, i) => tone(t + i * 0.07, f, 0.4, 'triangle', 0.1, 0, sfxBus, null, 0.003, 'bull', 6)); },
      cheer(o) { const t = now(); noiseSrc(t, 1.4, 1200, 900, 0.6, 'bandpass', 0.12 * (o.level || 1), 0, 0.2, 'cheer', 1); },
      correct() { const t = now(); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(t + i * 0.09, f, 0.45, 'triangle', 0.16, 0, sfxBus, null, 0.004, 'ok', 8)); },
      wrong() { const t = now(); tone(t, 330, 0.25, 'sine', 0.13, 0, sfxBus, 300, 0.01, 'no', 2); tone(t + 0.2, 262, 0.35, 'sine', 0.12, 0, sfxBus, 247, 0.01, 'no2', 2); },
      neutral() { const t = now(); tone(t, 587, 0.3, 'sine', 0.1, 0, sfxBus, null, 0.01, 'neu', 2); tone(t + 0.15, 698, 0.35, 'sine', 0.1, 0, sfxBus, null, 0.01, 'neu2', 2); },
      complete() { const t = now(); [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(t + i * 0.1, f, 0.5, 'triangle', 0.15, 0, sfxBus, null, 0.004, 'cmp', 10)); },
      click() { const t = now(); tone(t, 1200, 0.03, 'sine', 0.05, 0, sfxBus, 900, 0.001, 'clk', 2); }
    };
    a.play = (name, o = {}) => { if (!ctx || !a.ready || !a.sfxOn || !SFX[name]) return; try { SFX[name](o); } catch (e) { } };

    // ---------------------------------------------------------------- ambience (looped, crossfaded)
    function stopLoop(k, fade = 0.6) { const l = a.loops[k]; if (!l) return; const t = now(); l.g.gain.setTargetAtTime(0.0001, t, fade / 3); l.nodes.forEach(n => { try { n.stop(t + fade + 0.1); } catch (e) { } }); if (l.timer) clearInterval(l.timer); delete a.loops[k]; }
    a.ambience = (kind) => {
      if (!ctx) return;
      stopLoop('amb');
      if (!kind) return;
      const t = now(), g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(1, t, 0.8); g.connect(ambBus);
      const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'carnival' ? 900 : 420; f.Q.value = 0.4;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08; const lg = ctx.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(f.frequency);
      const wg = ctx.createGain(); wg.gain.value = kind === 'carnival' ? 0.05 : 0.07;
      s.connect(f); f.connect(wg); wg.connect(g); s.start(); lfo.start();
      const nodes = [s, lfo];
      // occasional birdsong (meadow/range) or distant fairground chimes (carnival) — scheduled, seeded spacing
      let k = 0;
      const timer = setInterval(() => {
        if (!a.sfxOn || document.hidden) return;
        const tt = now(); k++;
        if (kind === 'carnival') { if (k % 3 === 0) [784, 988, 1175].forEach((fr, i) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = fr; env(og, tt + i * 0.12, 0.01, 0.025, 0.5); o.connect(og); og.connect(g); o.start(tt + i * 0.12); o.stop(tt + i * 0.12 + 0.6); }); }
        else { const base = 2400 + (k * 377 % 1400); for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(base, tt + i * 0.09); o.frequency.exponentialRampToValueAtTime(base * 1.35, tt + i * 0.09 + 0.06); env(og, tt + i * 0.09, 0.005, 0.02, 0.07); o.connect(og); og.connect(g); o.start(tt + i * 0.09); o.stop(tt + i * 0.09 + 0.1); } }
      }, kind === 'carnival' ? 2300 : 3700);
      a.loops.amb = { g, nodes, timer };
    };

    // ---------------------------------------------------------------- music (original, procedural; gentle)
    const SCALE = [0, 2, 3, 5, 7, 8, 11, 12];   // harmonic-minor colour (Arabic-flavoured, original motif)
    a.music = (kind) => {
      if (!ctx) return;
      stopLoop('music', 1.2);
      if (!kind) return;
      const g = ctx.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(kind === 'victory' ? 1.1 : 0.8, now(), 0.6); g.connect(musicBus);
      const root0 = kind === 'menu' ? 220 : kind === 'victory' ? 261.63 : 196;
      const tempo = kind === 'victory' ? 0.22 : 0.42;
      const motif = kind === 'victory' ? [0, 2, 4, 7, 4, 7, 7, 7] : [0, 4, 3, 2, 4, 5, 4, 2, 0, 2, 1, 0, 4, 3, 2, 0];
      let step = 0; const nodes = [];
      const timer = setInterval(() => {
        if (document.hidden) return;
        const t = now() + 0.05;
        const deg = motif[step % motif.length], f = root0 * Math.pow(2, SCALE[deg % SCALE.length] / 12);
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f * 2; env(og, t, 0.01, 0.05, tempo * 1.6); o.connect(og); og.connect(g); o.start(t); o.stop(t + tempo * 1.8);
        if (step % 4 === 0) { const p = ctx.createOscillator(), pg = ctx.createGain(); p.type = 'sine'; p.frequency.value = root0 / 2 * Math.pow(2, SCALE[(deg + 0) % SCALE.length] / 12); env(pg, t, 0.2, 0.06, tempo * 4); p.connect(pg); pg.connect(g); p.start(t); p.stop(t + tempo * 4.2); }
        step++;
        if (kind === 'victory' && step >= motif.length * 2) { clearInterval(timer); g.gain.setTargetAtTime(0.0001, now() + 0.6, 0.4); }
      }, tempo * 1000);
      a.loops.music = { g, nodes, timer };
    };
    a.stopAll = () => { Object.keys(a.loops).forEach(k => stopLoop(k, 0.3)); Object.values(a.voices).forEach(v => v.splice(0).forEach(o => { try { o.stop(); } catch (e) { } })); };
    a.suspend = () => { if (ctx && ctx.state === 'running') ctx.suspend(); };
    a.resume = () => { if (ctx && ctx.state === 'suspended' && a.ready) ctx.resume(); };
    a.close = () => { a.stopAll(); if (ctx) { try { ctx.close(); } catch (e) { } } };
    return a;
  }
  TS.Audio = { create };
})(typeof window !== 'undefined' ? window : globalThis);
