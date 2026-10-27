/* الكرة الطائرة V24 — procedural audio.
 *
 * Every sound is synthesised at run time with the Web Audio API: ball contacts, net, floor, sneaker
 * squeaks, whistles, crowd ambience/roar/chants, anticipation, countdown ticks, stingers and a music
 * loop. Nothing is downloaded, so there is no licensing question and the game works offline.
 * Three independent buses (SFX, crowd, music) with their own volume; one master mute.
 * The context is created only after a user gesture (browser autoplay rules).
 */
(function () {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

  function create(prefs = {}) {
    const state = {
      enabled: prefs.enabled !== false, sfx: prefs.sfx ?? 0.9, crowd: prefs.crowd ?? 0.6, music: prefs.music ?? 0.35, announcer: prefs.announcer !== false,
      unlocked: false, musicOn: false, crowdLevel: 0.25, ticking: false,
    };
    let ctx = null, master, buses = {}, noiseBuf = null, crowdNodes = null, musicTimer = null, tickTimer = null, nextBeat = 0, beat = 0;
    let comp;

    function unlock() {
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          ctx = new AC();
          comp = ctx.createDynamicsCompressor();
          comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
          master = ctx.createGain(); master.gain.value = state.enabled ? 0.9 : 0;
          master.connect(comp).connect(ctx.destination);
          for (const k of ['sfx', 'crowd', 'music']) { buses[k] = ctx.createGain(); buses[k].gain.value = state[k]; buses[k].connect(master); }
          const n = ctx.sampleRate * 2;
          noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
          const d = noiseBuf.getChannelData(0);
          let seed = 12345;
          for (let i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
          startCrowd();
        }
        if (ctx.state === 'suspended') ctx.resume();
        state.unlocked = true;
        return true;
      } catch (e) { return false; }
    }
    const now = () => (ctx ? ctx.currentTime : 0);
    function env(g, t, a, peak, d, end = 0.0001) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      g.gain.exponentialRampToValueAtTime(end, t + a + d);
    }
    function noise(bus, { t = now(), dur = 0.1, type = 'bandpass', f = 2000, q = 1, peak = 0.3, attack = 0.002, f2 = null, rate = 1 } = {}) {
      if (!ctx) return;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rate;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
      const g = ctx.createGain();
      s.connect(fl).connect(g).connect(buses[bus]);
      env(g, t, attack, peak, dur);
      s.start(t, Math.random() * 1.5); s.stop(t + attack + dur + 0.05);
    }
    function tone(bus, { t = now(), f = 440, f2 = null, dur = 0.2, type = 'sine', peak = 0.2, attack = 0.005, detune = 0 } = {}) {
      if (!ctx) return;
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
      if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      const g = ctx.createGain();
      o.connect(g).connect(buses[bus]);
      env(g, t, attack, peak, dur);
      o.start(t); o.stop(t + attack + dur + 0.05);
    }

    // ── ball and court sounds ──
    function contact(kind, power = 1) {
      if (!ctx || !state.enabled) return;
      const t = now(), p = clamp(power, 0.2, 1.4);
      if (kind === 'spike' || kind === 'serve') {
        noise('sfx', { t, dur: 0.07, f: 2600, q: 0.8, peak: 0.55 * p });
        noise('sfx', { t, dur: 0.03, type: 'highpass', f: 5000, peak: 0.25 * p });
        tone('sfx', { t, f: 140, f2: 55, dur: 0.14, peak: 0.5 * p });
      } else if (kind === 'block') {
        noise('sfx', { t, dur: 0.06, f: 1700, q: 0.9, peak: 0.45 });
        tone('sfx', { t, f: 110, f2: 60, dur: 0.12, peak: 0.45 });
      } else if (kind === 'set') {
        noise('sfx', { t, dur: 0.025, type: 'highpass', f: 1800, peak: 0.22 });
        noise('sfx', { t: t + 0.018, dur: 0.025, type: 'highpass', f: 2100, peak: 0.18 });
      } else if (kind === 'tip') {
        noise('sfx', { t, dur: 0.03, type: 'highpass', f: 1500, peak: 0.18 });
      } else { // pass / dig / bump
        noise('sfx', { t, dur: 0.06, type: 'lowpass', f: 900, peak: 0.5 * p });
        tone('sfx', { t, f: 95, f2: 60, dur: 0.11, peak: 0.42 * p });
      }
    }
    function floor(speed = 6) {
      if (!ctx || !state.enabled) return;
      const t = now(), p = clamp(speed / 12, 0.08, 1);
      tone('sfx', { t, f: 160, f2: 52, dur: 0.12, peak: 0.55 * p });
      noise('sfx', { t, dur: 0.05, type: 'lowpass', f: 1400, peak: 0.3 * p });
    }
    function net() {
      if (!ctx || !state.enabled) return;
      const t = now();
      noise('sfx', { t, dur: 0.45, type: 'bandpass', f: 1200, q: 0.6, peak: 0.28, f2: 500 });
      noise('sfx', { t: t + 0.03, dur: 0.25, type: 'highpass', f: 3500, peak: 0.08 });
      tone('sfx', { t, f: 70, f2: 45, dur: 0.2, peak: 0.25 });
    }
    function squeak(k = 0) {
      if (!ctx || !state.enabled) return;
      const t = now(), f = 2100 + (k % 7) * 160;
      tone('sfx', { t, f, f2: f * 1.35, dur: 0.07 + (k % 3) * 0.025, type: 'sine', peak: 0.05 });
      tone('sfx', { t, f: f * 2.02, f2: f * 2.6, dur: 0.05, type: 'sine', peak: 0.02 });
    }
    function thud() { if (ctx && state.enabled) { const t = now(); tone('sfx', { t, f: 90, f2: 45, dur: 0.12, peak: 0.25 }); noise('sfx', { t, dur: 0.04, type: 'lowpass', f: 600, peak: 0.12 }); } }
    function whistle(long = false) {
      if (!ctx || !state.enabled) return;
      const t = now(), dur = long ? 0.85 : 0.32;
      for (const f of [2650, 2790]) {
        const o = ctx.createOscillator(); o.frequency.value = f; o.type = 'sine';
        const am = ctx.createOscillator(); am.frequency.value = 26; const amg = ctx.createGain(); amg.gain.value = 0.35;
        const g = ctx.createGain(); g.gain.value = 0;
        am.connect(amg).connect(g.gain);
        o.connect(g).connect(buses.sfx);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + dur - 0.06); g.gain.linearRampToValueAtTime(0, t + dur);
        o.start(t); am.start(t); o.stop(t + dur + 0.05); am.stop(t + dur + 0.05);
      }
      noise('sfx', { t, dur, type: 'bandpass', f: 2700, q: 3, peak: 0.05 });
    }
    function whoosh() { if (ctx && state.enabled) noise('sfx', { t: now(), dur: 0.25, type: 'bandpass', f: 600, q: 1.2, f2: 1800, peak: 0.07 }); }

    // ── crowd ──
    function startCrowd() {
      if (!ctx || crowdNodes) return;
      const mk = (f, q, lfoRate) => {
        const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
        const g = ctx.createGain(); g.gain.value = 0.0;
        const lfo = ctx.createOscillator(); lfo.frequency.value = lfoRate; const lg = ctx.createGain(); lg.gain.value = 0.04;
        lfo.connect(lg).connect(g.gain);
        s.connect(fl).connect(g).connect(buses.crowd);
        s.start(0, Math.random()); lfo.start();
        return { s, fl, g, lfo, base: f };
      };
      crowdNodes = [mk(320, 0.7, 0.17), mk(850, 0.8, 0.23), mk(1900, 0.9, 0.31)];
      setCrowd(state.crowdLevel);
    }
    function setCrowd(level, bright = 0) {
      state.crowdLevel = level;
      if (!crowdNodes) return;
      const t = now();
      crowdNodes.forEach((n, i) => {
        n.g.gain.setTargetAtTime(level * [0.22, 0.14, 0.07][i] * (1 + bright * 0.6), t, 0.35);
        n.fl.frequency.setTargetAtTime(n.base * (1 + bright * 0.35), t, 0.4);
      });
    }
    function roar(strength = 1) {
      if (!ctx || !state.enabled) return;
      const t = now();
      noise('crowd', { t, dur: 2.6, type: 'bandpass', f: 900, q: 0.5, peak: 0.42 * strength, attack: 0.25 });
      noise('crowd', { t: t + 0.05, dur: 2.2, type: 'bandpass', f: 2200, q: 0.6, peak: 0.18 * strength, attack: 0.3 });
      // Scattered applause.
      for (let i = 0; i < 26; i++) noise('crowd', { t: t + 0.3 + i * 0.09 + Math.random() * 0.05, dur: 0.03, type: 'highpass', f: 1800 + Math.random() * 1500, peak: 0.07 * strength });
    }
    function groan() { if (ctx && state.enabled) noise('crowd', { t: now(), dur: 1.6, type: 'bandpass', f: 380, q: 0.9, f2: 240, peak: 0.28, attack: 0.15 }); }
    function chant() {
      // Rhythmic "clap clap · clap clap clap" with a low vocal hum, like a supporters' chant.
      if (!ctx || !state.enabled) return;
      const t = now(), pat = [0, 0.32, 0.8, 1.04, 1.28];
      for (let r = 0; r < 2; r++) pat.forEach((d) => {
        const tt = t + r * 1.9 + d;
        noise('crowd', { t: tt, dur: 0.05, type: 'highpass', f: 1500, peak: 0.22 });
        tone('crowd', { t: tt, f: 196, dur: 0.18, type: 'sawtooth', peak: 0.03 });
      });
    }
    function anticipation(on) {
      if (!ctx || !state.enabled) return;
      if (on) { noise('sfx', { t: now(), dur: 1.4, type: 'bandpass', f: 300, q: 2, f2: 2400, peak: 0.1, attack: 0.5 }); setCrowd(0.55, 0.6); }
      else setCrowd(0.3, 0);
    }

    // ── stingers and countdown ──
    function chord(notes, { t = now(), dur = 0.6, type = 'sawtooth', peak = 0.08, step = 0 } = {}) {
      if (!ctx) return;
      notes.forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t + i * step); fl.frequency.exponentialRampToValueAtTime(3200, t + i * step + 0.12);
        const g = ctx.createGain();
        o.connect(fl).connect(g).connect(buses.music);
        env(g, t + i * step, 0.02, peak, dur);
        o.start(t + i * step); o.stop(t + i * step + dur + 0.1);
      });
    }
    function success() { if (ctx && state.enabled) { chord([523.25, 659.25, 783.99, 1046.5], { step: 0.09, dur: 0.7, peak: 0.07 }); } }
    function failure() { if (ctx && state.enabled) { chord([392, 369.99], { step: 0.18, dur: 0.6, type: 'triangle', peak: 0.09 }); } }
    function neutral() { if (ctx && state.enabled) chord([440, 554.37], { step: 0.12, dur: 0.6, type: 'triangle', peak: 0.06 }); }
    function questionStart() { if (ctx && state.enabled) { chord([329.63, 415.3, 493.88], { step: 0.07, dur: 0.5, type: 'square', peak: 0.03 }); } }
    function startTicking(seconds) {
      stopTicking();
      if (!ctx) return;
      state.ticking = true;
      let left = seconds;
      const tick = () => {
        if (!state.ticking) return;
        if (state.enabled) {
          const t = now(), hi = left <= 5;
          tone('sfx', { t, f: hi ? 1480 : 1100, dur: 0.035, type: 'sine', peak: hi ? 0.14 : 0.08 });
          tone('sfx', { t, f: hi ? 2200 : 1650, dur: 0.02, type: 'triangle', peak: 0.04 });
        }
        left--;
        if (left === 0) deadline();
        if (left < -600) return stopTicking();
        tickTimer = setTimeout(tick, left < 0 ? 2000 : 1000);
      };
      tick();
    }
    function stopTicking() { state.ticking = false; if (tickTimer) clearTimeout(tickTimer); tickTimer = null; }
    function deadline() { if (ctx && state.enabled) { const t = now(); [880, 1318.5].forEach((f, i) => tone('sfx', { t: t + i * 0.15, f, dur: 0.8, type: 'sine', peak: 0.08 })); } }

    // ── music: a light 110 BPM loop scheduled ahead of time ──
    const PROG = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
    function scheduleMusic() {
      if (!ctx || !state.musicOn) return;
      const spb = 60 / 110 / 2;
      while (nextBeat < ctx.currentTime + 0.2) {
        const t = nextBeat, b = beat % 32, bar = Math.floor(beat / 8) % 4;
        if (b % 4 === 0) tone('music', { t, f: 120, f2: 45, dur: 0.18, peak: 0.32 });
        if (b % 8 === 4) noise('music', { t, dur: 0.12, type: 'bandpass', f: 1800, q: 0.7, peak: 0.16 });
        noise('music', { t, dur: 0.03, type: 'highpass', f: 7000, peak: b % 2 ? 0.035 : 0.06 });
        if (b % 2 === 0) tone('music', { t, f: PROG[bar][0] / 2, dur: spb * 1.6, type: 'sawtooth', peak: 0.05 });
        if (b % 8 === 0) chord(PROG[bar], { t, dur: spb * 7, type: 'triangle', peak: 0.018 });
        nextBeat += spb; beat++;
      }
    }
    function music(on) {
      state.musicOn = !!on;
      if (!ctx) return;
      if (on && !musicTimer) { nextBeat = ctx.currentTime + 0.05; musicTimer = setInterval(scheduleMusic, 50); }
      if (!on && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    }
    function duckMusic(level) { if (ctx) buses.music.gain.setTargetAtTime(state.music * level, now(), 0.3); }

    // ── announcer (device speech synthesis, only if an Arabic voice exists) ──
    function announce(text) {
      if (!state.announcer || !state.enabled || typeof speechSynthesis === 'undefined') return;
      try {
        const v = speechSynthesis.getVoices().find((x) => /^ar/i.test(x.lang));
        if (!v) return;
        const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 1.05; u.volume = clamp(state.sfx);
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch (e) { /* optional */ }
    }

    function setVolume(bus, v) { state[bus] = clamp(v); if (ctx && buses[bus]) buses[bus].gain.setTargetAtTime(state[bus], now(), 0.05); }
    function setEnabled(on) {
      state.enabled = !!on;
      if (ctx) master.gain.setTargetAtTime(on ? 0.9 : 0, now(), 0.04);
      if (!on) { stopTicking(); try { speechSynthesis?.cancel(); } catch (e) { /* */ } }
    }
    function suspend(yes) { if (!ctx) return; if (yes) ctx.suspend(); else ctx.resume(); }
    function dispose() { stopTicking(); music(false); try { ctx?.close(); } catch (e) { /* */ } ctx = null; }

    return {
      state, unlock, contact, floor, net, squeak, thud, whistle, whoosh, roar, groan, chant, anticipation, setCrowd,
      success, failure, neutral, questionStart, startTicking, stopTicking, deadline, music, duckMusic, announce,
      setVolume, setEnabled, suspend, dispose, get context() { return ctx; },
    };
  }

  window.VolleyAudio = { create };
})();
