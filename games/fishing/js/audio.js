/* صيد الأسماك V24 — Web Audio engine: layered ambience (sea, wind, underwater), spatialised effects,
 * reel ratchet driven by the real spool speed, drag scream, tension tone, separate music/effects volume.
 * Starts only after a user gesture. Loads the rendered WAVs from assets/audio; if unavailable (file://)
 * renders the identical sounds locally with FishingAudioDSP.
 */
(function (root) {
  'use strict';
  const DSP = root.FishingAudioDSP;
  const SFX = ['splash', 'plop', 'bubbles', 'lap', 'whoosh', 'click', 'bail', 'twang', 'creak', 'flop', 'bell', 'chime', 'tension', 'success', 'fail', 'neutral', 'victory', 'sea', 'wind', 'underwater'];
  const PREF = 'abu-ubaida-fishing-audio';
  class FishingAudio {
    constructor() {
      this.ctx = null; this.buffers = {}; this.ready = false; this.prefs = { muted: false, music: 0.7, sfx: 0.85, amb: 0.7 };
      try { const p = JSON.parse(localStorage.getItem(PREF) || 'null'); if (p) Object.assign(this.prefs, p); } catch (e) { /* storage unavailable */ }
      this.clickPhase = 0; this.creakT = 2; this.lapT = 1; this.under = 0; this.listener = null; this.source = 'none';
    }
    save() { try { localStorage.setItem(PREF, JSON.stringify(this.prefs)); } catch (e) { /* ignore */ } }
    async init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
      const C = root.AudioContext || root.webkitAudioContext; if (!C) return;
      const ctx = this.ctx = new C();
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      this.music = ctx.createGain(); this.sfx = ctx.createGain(); this.amb = ctx.createGain(); [this.music, this.sfx, this.amb].forEach(g => g.connect(this.master));
      this.applyVolumes();
      await this.load();
      this.loops = {}; ['sea', 'wind', 'underwater'].forEach(n => { const s = ctx.createBufferSource(); s.buffer = this.buffers[n]; s.loop = true; const g = ctx.createGain(); g.gain.value = 0; s.connect(g).connect(this.amb); s.start(); this.loops[n] = g; });
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000; this.sfx.disconnect(); this.sfx.connect(lp).connect(this.master); this.sfxFilter = lp;
      // continuous tension tone (thin line hum) + drag buzz
      this.tone = ctx.createOscillator(); this.tone.type = 'triangle'; this.toneGain = ctx.createGain(); this.toneGain.gain.value = 0; this.tone.connect(this.toneGain).connect(this.sfx); this.tone.start();
      this.ready = true;
    }
    async load() {
      const ctx = this.ctx, sr = ctx.sampleRate; let fetched = 0;
      await Promise.all(SFX.map(async n => {
        try {
          if (location.protocol === 'file:') throw new Error('file');
          const r = await fetch('assets/audio/' + n + '.wav'); if (!r.ok) throw new Error(r.status); const ab = await r.arrayBuffer(); this.buffers[n] = await ctx.decodeAudioData(ab); fetched++;
        } catch (e) { const data = DSP.render(n, sr), b = ctx.createBuffer(1, data.length, sr); b.copyToChannel ? b.copyToChannel(data, 0) : b.getChannelData(0).set(data); this.buffers[n] = b; }
      }));
      this.source = fetched === SFX.length ? 'wav' : fetched ? 'mixed' : 'dsp';
    }
    applyVolumes() { if (!this.ctx) return; const t = this.ctx.currentTime, m = this.prefs.muted ? 0 : 1; this.master.gain.setTargetAtTime(m * 0.9, t, 0.03); this.music.gain.setTargetAtTime(this.prefs.music, t, 0.03); this.sfx.gain.setTargetAtTime(this.prefs.sfx, t, 0.03); this.amb.gain.setTargetAtTime(this.prefs.amb, t, 0.05); }
    set(kind, v) { this.prefs[kind] = v; this.applyVolumes(); this.save(); }
    toggleMute() { this.prefs.muted = !this.prefs.muted; this.applyVolumes(); this.save(); return this.prefs.muted; }
    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
    close() { if (this.ctx) this.ctx.close().catch(() => {}); }
    /* spatial one-shot: pan + distance attenuation relative to the camera */
    play(name, opt = {}) {
      if (!this.ready || !this.buffers[name]) return null; const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.buffers[name]; s.playbackRate.value = opt.rate || 1;
      const g = ctx.createGain(); let gain = opt.gain == null ? 1 : opt.gain, pan = 0;
      if (opt.pos && this.listener) { const L = this.listener, dx = opt.pos[0] - L.pos.x, dy = opt.pos[1] - L.pos.y, dz = opt.pos[2] - L.pos.z, d = Math.hypot(dx, dy, dz); gain *= 1 / (1 + d * 0.07); pan = Math.max(-0.9, Math.min(0.9, (dx * L.right.x + dz * L.right.z) / (d || 1))); }
      g.gain.value = gain; let node = s.connect(g);
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
      node.connect(opt.music ? this.music : this.sfx); s.start(ctx.currentTime + (opt.delay || 0)); return s;
    }
    event(e, sim) {
      const at = e.pos, rnd = (a, b) => a + Math.random() * (b - a);
      switch (e.type) {
        case 'bail': this.play('bail', { gain: 0.5, rate: e.open ? 1 : 0.85 }); break;
        case 'whoosh': this.play('whoosh', { gain: 0.8 }); break;
        case 'release': this.play('click', { gain: 0.3, rate: 0.7 }); break;
        case 'splash': this.play('plop', { pos: at, gain: 1.0 * (e.strength || 1) }); this.play('splash', { pos: at, gain: 0.55 * (e.strength || 1), rate: rnd(0.95, 1.1) }); break;
        case 'nibble': this.play('plop', { pos: at, gain: 0.35, rate: 1.5 }); this.play('bubbles', { pos: at, gain: this.under > 0.5 ? 0.5 : 0.15 }); break;
        case 'notice': if (this.under > 0.5) this.play('bubbles', { gain: 0.3, rate: 0.9 }); break;
        case 'bite': this.play('bell', { gain: 0.7 }); this.play('tension', { gain: 0.45 }); break;
        case 'question': this.play('chime', { gain: 0.65, music: true }); break;
        case 'hookset': this.play('whoosh', { gain: 0.9, rate: 1.4 }); this.play('twang', { gain: e.miss ? 0.6 : 0.8 }); break;
        case 'thrash': this.play('splash', { pos: at, gain: 0.35 * (e.strength || 0.5), rate: rnd(1.1, 1.4) }); break;
        case 'surface': this.play('splash', { pos: at, gain: 0.7, rate: 1.15 }); break;
        case 'netted': this.play('splash', { pos: at, gain: 0.8, rate: 0.9 }); break;
        case 'flop': this.play('flop', { pos: at, gain: 0.8 }); break;
        case 'landed': break;
        case 'celebrate': this.play(e.final ? 'victory' : 'success', { gain: e.final ? 0.85 : 0.75, music: true }); break;
        case 'escape': this.play('bubbles', { pos: at, gain: 0.8 }); this.play('fail', { gain: 0.55, music: true, delay: 0.5 }); break;
        case 'review': this.play('neutral', { gain: 0.6, music: true }); break;
        case 'baited': this.play('click', { gain: 0.3, rate: 0.6 }); break;
        case 'victory': this.play('victory', { gain: 0.85, music: true }); break;
      }
    }
    update(sim, cam, under, dt) {
      if (!this.ready) return; const ctx = this.ctx, t = ctx.currentTime;
      const right = { x: Math.cos(cam.rotation.y), z: -Math.sin(cam.rotation.y) }; this.listener = { pos: cam.position, right };
      this.under += ((under ? 1 : 0) - this.under) * Math.min(1, dt * 4);
      this.loops.sea.gain.setTargetAtTime(0.75 * (1 - this.under), t, 0.1); this.loops.wind.gain.setTargetAtTime(0.32 * (1 - this.under), t, 0.1); this.loops.underwater.gain.setTargetAtTime(0.9 * this.under, t, 0.1);
      this.sfxFilter.frequency.setTargetAtTime(under ? 900 : 18000, t, 0.08);
      // reel ratchet: one click per spool tooth
      const rate = Math.abs(sim.reelSpeed) * 14 + (sim.slip > 0 ? 48 : 0); this.clickPhase += rate * dt;
      while (this.clickPhase >= 1) { this.clickPhase -= 1; this.play('click', { gain: sim.slip > 0 ? 0.32 : 0.22, rate: sim.slip > 0 ? 1.35 : 0.95 + Math.random() * 0.1 }); }
      // line tension hum during bite / fight
      const tens = ['bite', 'question', 'hookset', 'fight', 'surface', 'strike', 'shake'].includes(sim.phase) ? sim.tension : 0;
      this.tone.frequency.setTargetAtTime(160 + tens * 380, t, 0.05); this.toneGain.gain.setTargetAtTime(tens > 0.3 ? (tens - 0.3) * 0.05 : 0, t, 0.08);
      // boat creaks at roll extremes, hull lapping
      this.creakT -= dt; if (this.creakT <= 0 && Math.abs(sim.boat.v[2]) < 0.02) { this.play('creak', { gain: 0.18 + Math.random() * 0.12, rate: 0.85 + Math.random() * 0.3, pos: sim.boat.pos }); this.creakT = 3 + Math.random() * 4; }
      this.lapT -= dt; if (this.lapT <= 0) { this.play('lap', { gain: 0.35 * (1 - this.under), rate: 0.85 + Math.random() * 0.3, pos: sim.boat.pos }); this.lapT = 1.4 + Math.random() * 1.6; }
    }
  }
  root.FishingAudio = FishingAudio;
})(window);
