/* Layered match audio. Gesture-gated (init() must be called from a user click), fully usable muted, persistent mute.
 *   ambience : crowd murmur (CC0 sample, filtered) + synthesized noise bed + occasional clap/drum pattern, driven by an excitement value
 *   one-shots: referee whistle, boot/pass contact, first touch, bounce, post/bar ring, net, glove/catch, goal roar, groan (all synthesized except the two CC0 crowd samples)
 * Master chain: gain -> compressor (limits peaks, so stacked events can never clip). Voices are capped. Events are panned by pitch x. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const clamp = FB.math.clamp;
  const KEY = 'footballMuted';
  const store = { get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, v); } catch (e) { } } };

  class Audio {
    constructor(opts = {}) { this.base = opts.base || '../football/assets'; this.ctx = null; this.muted = store.get() === '1'; this.ready = false; this.voices = 0; this.excite = 0.15; this.buffers = {}; this.ambOn = false; this.ducked = false; this.onState = opts.onState || (() => { }); this.failed = false; this.lastStep = 0; }
    get supported() { return !!(root.AudioContext || root.webkitAudioContext); }
    async init() {
      if (this.ctx) { try { await this.ctx.resume(); } catch (e) { } return this.ready; }
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) { this.failed = true; this.onState('unsupported'); return false; }
      try {
        const c = this.ctx = new AC(); this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
        this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.knee.value = 14; this.comp.ratio.value = 5; this.comp.attack.value = 0.004; this.comp.release.value = 0.22;
        this.master.connect(this.comp); this.comp.connect(c.destination);
        this.sfx = c.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master); this.amb = c.createGain(); this.amb.gain.value = 0; this.amb.connect(this.master);
        try { await c.resume(); } catch (e) { }
        this.noise = this.makeNoise(c, 3); this.ready = true;
        await Promise.all(['cheer', 'miss'].map(async k => { try { const r = await fetch(this.base + '/crowd-' + k + '.mp3'); if (!r.ok) throw 0; this.buffers[k] = await c.decodeAudioData(await r.arrayBuffer()); } catch (e) { } }));
        this.startAmbience(); this.onState('ready'); return true;
      } catch (e) { this.failed = true; this.onState('failed'); return false; }
    }
    makeNoise(c, sec) { const n = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = n.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; } return n; }
    get audible() { return !!this.ctx && !this.muted; }
    setMuted(m) { this.muted = !!m; store.set(this.muted ? '1' : '0'); if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.04); this.onState(this.muted ? 'muted' : 'on'); }
    toggle() { this.setMuted(!this.muted); return !this.muted; }
    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => { }); }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => { }); }
    close() { this.stopAmbience(); if (this.ctx) { try { this.ctx.close(); } catch (e) { } } this.ctx = null; this.ready = false; }
    now() { return this.ctx.currentTime; }

    /* ---------- ambience ---------- */
    startAmbience() {
      if (!this.ctx || this.ambOn) return; const c = this.ctx; this.ambOn = true;
      this.nodes = [];
      if (this.buffers.cheer) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.buffers.cheer; s.loop = true; s.playbackRate.value = 0.82; f.type = 'lowpass'; f.frequency.value = 1500; g.gain.value = 0.55; s.connect(f).connect(g).connect(this.amb); s.start(); this.nodes.push(s); this.bedFilter = f; }
      const n = c.createBufferSource(), bp = c.createBiquadFilter(), g2 = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); n.buffer = this.noise; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.5; g2.gain.value = 0.5; lfo.frequency.value = 0.13; lg.gain.value = 0.18; lfo.connect(lg).connect(g2.gain); n.connect(bp).connect(g2).connect(this.amb); n.start(); lfo.start(); this.nodes.push(n, lfo); this.noiseFilter = bp;
      this.applyExcite(); this.schedulePattern();
    }
    stopAmbience() { this.ambOn = false; clearTimeout(this.patT); for (const n of this.nodes || []) { try { n.stop(); } catch (e) { } } this.nodes = []; }
    applyExcite() { if (!this.ctx || !this.amb) return; const t = this.now(), e = this.excite, duck = this.ducked ? 0.4 : 1; this.amb.gain.setTargetAtTime((0.1 + 0.32 * e) * duck, t, 0.35); if (this.bedFilter) this.bedFilter.frequency.setTargetAtTime(1100 + 1800 * e, t, 0.4); if (this.noiseFilter) this.noiseFilter.frequency.setTargetAtTime(520 + 500 * e, t, 0.4); }
    setExcitement(v) { this.excite = clamp(v); this.applyExcite(); }
    duck(on) { this.ducked = !!on; this.applyExcite(); }
    schedulePattern() {
      clearTimeout(this.patT); if (!this.ambOn) return;
      this.patT = setTimeout(() => { if (this.ctx && this.ctx.state === 'running' && !this.muted && !this.ducked) this.pattern(); this.schedulePattern(); }, 9000 + Math.random() * 12000);
    }
    /** a short supporters' clap / drum pattern, quiet and off the main beat of any event */
    pattern() { const c = this.ctx, t0 = c.currentTime + 0.05, beat = 0.46, kind = Math.random() < 0.5 ? 'clap' : 'drum'; const seq = [0, 1, 1.5, 2, 3, 3.5, 4, 5, 5.5, 6]; for (const b of seq) { if (kind === 'clap') this.burst(t0 + b * beat, 1800, 1.4, 0.05, 0.09, this.amb, (Math.random() - 0.5) * 0.4); else this.thump(t0 + b * beat, 95, 0.12, 0.16, this.amb); } }

    /* ---------- primitives ---------- */
    pan(x) { const c = this.ctx; if (!c.createStereoPanner) return null; const p = c.createStereoPanner(); p.pan.value = clamp(x, -1, 1); return p; }
    out(dest, panX) { const p = panX ? this.pan(panX) : null; if (p) { p.connect(dest || this.sfx); return p; } return dest || this.sfx; }
    voice(fn) { if (!this.audible || !this.ready || this.voices > 28) return; this.voices++; const done = () => { this.voices = Math.max(0, this.voices - 1); }; try { fn(done); } catch (e) { done(); } }
    thump(t, f, vol, dur, dest, pan) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f * 0.5), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(this.out(dest, pan)); o.start(t); o.stop(t + dur + 0.02); }
    burst(t, freq, q, vol, dur, dest, pan, type = 'bandpass') { const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.playbackRate.value = 1 + Math.random() * 0.2; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(this.out(dest, pan)); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05); }
    sample(k, vol, fadeAt, fadeLen, rate = 1) { if (!this.buffers[k]) return; try { this._sample(k, vol, fadeAt, fadeLen, rate); } catch (e) { } }
    _sample(k, vol, fadeAt, fadeLen, rate) { const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), t = c.currentTime; s.buffer = this.buffers[k]; s.playbackRate.value = rate; g.gain.setValueAtTime(vol, t); s.connect(g).connect(this.sfx); s.start(); if (fadeAt) { g.gain.setValueAtTime(vol, t + fadeAt); g.gain.linearRampToValueAtTime(0, t + fadeAt + fadeLen); s.stop(t + fadeAt + fadeLen + 0.1); } this.voices++; s.onended = () => { this.voices = Math.max(0, this.voices - 1); }; }

    /* ---------- one-shots ---------- */
    whistle(kind = 'start') {
      this.voice(done => {
        const c = this.ctx, t = c.currentTime, long = kind === 'end', dur = long ? 1.0 : kind === 'shot' ? 0.34 : 0.55, parts = kind === 'shot' ? [0, 0.42] : [0];
        for (const off of parts) for (const f of [2750, 3120]) { const o = c.createOscillator(), g = c.createGain(), tr = c.createOscillator(), tg = c.createGain(); o.type = 'sine'; o.frequency.value = f; tr.frequency.value = 26; tg.gain.value = 0.35; tr.connect(tg).connect(g.gain); g.gain.setValueAtTime(0.0001, t + off); g.gain.exponentialRampToValueAtTime(f < 3000 ? 0.1 : 0.055, t + off + 0.03); g.gain.setValueAtTime(f < 3000 ? 0.1 : 0.055, t + off + dur - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + off + dur); o.connect(g).connect(this.sfx); o.start(t + off); tr.start(t + off); o.stop(t + off + dur + 0.02); tr.stop(t + off + dur + 0.02); }
        this.burst(t, 4200, 0.8, 0.03, dur, this.sfx); setTimeout(done, (dur + 0.6) * 1000);
      });
    }
    kick(power = 0.7, pan = 0) { this.voice(done => { const t = this.ctx.currentTime, p = clamp(power, 0.2, 1); this.thump(t, 150, 0.5 * p + 0.12, 0.14, this.sfx, pan); this.burst(t, 1600, 0.9, 0.22 * p + 0.05, 0.07, this.sfx, pan); setTimeout(done, 400); }); }
    pass(pan = 0) { this.voice(done => { const t = this.ctx.currentTime; this.thump(t, 130, 0.22, 0.1, this.sfx, pan); this.burst(t, 1300, 1, 0.1, 0.05, this.sfx, pan); setTimeout(done, 300); }); }
    touch(s = 1, pan = 0) { this.voice(done => { const t = this.ctx.currentTime; this.thump(t, 100, 0.12 * clamp(s / 3, 0.3, 1), 0.08, this.sfx, pan); setTimeout(done, 250); }); }
    bounce(s = 4, pan = 0) { this.voice(done => { const t = this.ctx.currentTime, k = clamp(s / 12, 0.1, 1); this.thump(t, 85, 0.3 * k, 0.12, this.sfx, pan); setTimeout(done, 300); }); }
    metal(s = 10, pan = 0, bar = false) { this.voice(done => { const c = this.ctx, t = c.currentTime, k = clamp(s / 22, 0.15, 1), base = bar ? 420 : 560; for (const [m, v] of [[1, 1], [2.32, 0.55], [3.9, 0.34], [5.6, 0.2]]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = base * m; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * k * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 / (0.6 + m * 0.4)); o.connect(g).connect(this.out(this.sfx, pan)); o.start(t); o.stop(t + 1.3); } this.thump(t, 120, 0.35 * k, 0.07, this.sfx, pan); setTimeout(done, 1400); }); }
    net(s = 15, pan = 0) { this.voice(done => { const t = this.ctx.currentTime, k = clamp(s / 25, 0.2, 1); this.burst(t, 2600, 0.5, 0.2 * k, 0.34, this.sfx, pan, 'highpass'); this.burst(t + 0.05, 900, 0.7, 0.1 * k, 0.4, this.sfx, pan); setTimeout(done, 700); }); }
    glove(s = 15, pan = 0) { this.voice(done => { const t = this.ctx.currentTime, k = clamp(s / 25, 0.25, 1); this.burst(t, 1900, 1.2, 0.3 * k, 0.06, this.sfx, pan); this.thump(t, 90, 0.28 * k, 0.1, this.sfx, pan); setTimeout(done, 300); }); }
    dive(pan = 0) { this.voice(done => { const t = this.ctx.currentTime; this.burst(t, 700, 0.6, 0.09, 0.35, this.sfx, pan); setTimeout(done, 500); }); }
    landing(pan = 0) { this.voice(done => { const t = this.ctx.currentTime; this.thump(t, 70, 0.3, 0.16, this.sfx, pan); this.burst(t, 500, 0.6, 0.12, 0.2, this.sfx, pan); setTimeout(done, 400); }); }
    step(speed = 4, pan = 0, near = 1) { const n = performance.now(); if (n - this.lastStep < 90 || !this.audible) return; this.lastStep = n; this.voice(done => { const t = this.ctx.currentTime, k = clamp(speed / 7, 0.2, 1) * near; this.burst(t, 420, 0.8, 0.045 * k, 0.05, this.sfx, pan); setTimeout(done, 200); }); }
    cheer() { if (!this.audible) return; this.sample('cheer', 0.95, 3.2, 1.8); this.burst(this.ctx.currentTime, 900, 0.4, 0.0001, 0.01, this.sfx); this.swell(); }
    swell() { this.voice(done => { const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 1000; f.Q.value = 0.4; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6); s.connect(f).connect(g).connect(this.sfx); s.start(t); s.stop(t + 3.8); setTimeout(done, 3900); }); }
    groan() { if (!this.audible) return; this.sample('miss', 0.8, 1.6, 1.2); }
    oooh() { if (!this.audible) return; this.sample('miss', 0.45, 0.9, 0.9, 1.1); }

    /** map a match event to sound. e.x is the pitch x (for panning) */
    onEvent(e) {
      if (!this.audible || !this.ready) return; const pan = clamp((e.x || 0) / 22, -0.8, 0.8);
      switch (e.type) {
        case 'whistle': this.whistle(e.kind === 'shot' ? 'shot' : e.kind === 'end' ? 'end' : 'start'); break;
        case 'kick': if (e.kind === 'pass') this.pass(); else this.kick(e.power || 0.7); break;
        case 'touch': this.touch(e.strength || 2); break;
        case 'dive': this.dive(); break;
        case 'glove': this.glove(e.strength || 15); break;
        case 'catch': break;
        case 'step': { const near = clamp(1.2 - Math.abs((e.z || 0) - (this.focusZ || 0)) / 18, 0.15, 1); this.step(e.speed || 3, pan, near); break; }
        case 'ballHit': {
          if (e.kind === 'post') this.metal(e.strength, pan, false); else if (e.kind === 'bar') this.metal(e.strength, pan, true);
          else if (e.kind === 'net') this.net(e.strength, pan); else if (e.kind === 'bounce') this.bounce(e.strength, pan); break;
        }
        default: break;
      }
    }
  }
  FB.Audio = Audio;
})(typeof window !== 'undefined' ? window : globalThis);
