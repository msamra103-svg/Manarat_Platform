/* Basketball audio (Web Audio API). Contact sounds are synthesised locally (no
 * third-party recordings): ball/floor, rim, backboard, net, shoes, hands, whistle,
 * applause. The platform's existing crowd recordings (games/football/assets/crowd-*.mp3,
 * provenance not verified in this package) are used only as optional ambience/reaction
 * layers; everything works without them. Starts only after a user gesture.
 */
(function (root) {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function create(opts = {}) {
    let ctx = null, master = null, comp = null, sfx = null, crowdBus = null, verb = null, verbSend = null;
    const buffers = {}, active = new Map(), limits = { bounce: 3, rim: 3, board: 2, net: 2, squeak: 3, slap: 3, whistle: 1, applause: 2, cheer: 1, groan: 1, thud: 3, whoosh: 2 };
    let muted = !!opts.muted, volume = clamp(opts.volume ?? 0.8, 0, 1), unlocked = false, closed = false;
    let murmur = null, murmurLevel = 0.12, listener = { pos: [0, 1.8, 0], right: [1, 0, 0] };

    function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
    function makeBuffer(sec, fn, seed = 7) {
      const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = rnd(seed);
      for (let i = 0; i < n; i++) d[i] = fn(i / ctx.sampleRate, r);
      let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
      if (peak > 0) for (let i = 0; i < n; i++) d[i] *= 0.92 / peak;
      return b;
    }
    function synth() {
      const TAU = Math.PI * 2;
      // ball on hardwood: low thump + hollow cavity ring + click
      buffers.bounce = [0, 1, 2].map(k => makeBuffer(0.32, (t, r) => {
        const f = 1 + k * 0.03;
        return Math.sin(TAU * 78 * f * t + 6 * Math.exp(-t * 60)) * Math.exp(-t * 38) * 1.0
          + Math.sin(TAU * 236 * f * t) * Math.exp(-t * 26) * 0.42 + Math.sin(TAU * 488 * f * t) * Math.exp(-t * 34) * 0.18
          + Math.sin(TAU * 752 * f * t) * Math.exp(-t * 48) * 0.08 + (r() * 2 - 1) * Math.exp(-t * 900) * 0.5;
      }, 11 + k));
      // steel rim: inharmonic partials
      const partials = [[517, 0.9, 7], [1193, 0.55, 10], [1851, 0.4, 14], [2674, 0.28, 18], [3507, 0.18, 24], [4410, 0.1, 30]];
      buffers.rim = [0, 1].map(k => makeBuffer(1.1, (t, r) => {
        let s = 0; for (const [f, a, d] of partials) s += Math.sin(TAU * f * (1 + k * 0.012) * t) * a * Math.exp(-t * d);
        return s * 0.6 + (r() * 2 - 1) * Math.exp(-t * 400) * 0.6 + Math.sin(TAU * 140 * t) * Math.exp(-t * 30) * 0.4;
      }, 31 + k));
      // backboard: glass/frame thud with short rattle
      buffers.board = [makeBuffer(0.6, (t, r) => Math.sin(TAU * 118 * t) * Math.exp(-t * 22) * 0.9 + Math.sin(TAU * 410 * t) * Math.exp(-t * 30) * 0.3 + (r() * 2 - 1) * Math.exp(-t * 55) * 0.35, 41)];
      // net swish: band noise with a falling brush
      buffers.net = [makeBuffer(0.55, (t, r) => { const env = Math.min(1, t / 0.02) * Math.exp(-t * 7.5); return (r() * 2 - 1) * env * (0.6 + 0.4 * Math.sin(TAU * 13 * t)); }, 51)];
      // shoe squeak: rubber chirp
      buffers.squeak = [0, 1, 2].map(k => makeBuffer(0.2, (t, r) => {
        const f = 1900 + k * 420 + 900 * Math.sin(TAU * (6 + k) * t) + 120 * Math.sin(TAU * 43 * t);
        const env = Math.sin(Math.PI * clamp(t / 0.16, 0, 1)) ** 1.5;
        return (Math.sin(TAU * f * t) * 0.7 + Math.sin(TAU * f * 2.01 * t) * 0.2 + (r() * 2 - 1) * 0.12) * env;
      }, 61 + k));
      // hands on ball (catch/release)
      buffers.slap = [makeBuffer(0.12, (t, r) => (r() * 2 - 1) * Math.exp(-t * 90) * 0.9 + Math.sin(TAU * 180 * t) * Math.exp(-t * 60) * 0.5, 71)];
      buffers.whoosh = [makeBuffer(0.35, (t, r) => (r() * 2 - 1) * Math.sin(Math.PI * clamp(t / 0.3, 0, 1)) * 0.6, 81)];
      buffers.thud = [makeBuffer(0.25, (t, r) => Math.sin(TAU * 62 * t) * Math.exp(-t * 28) + (r() * 2 - 1) * Math.exp(-t * 120) * 0.3, 91)];
      // pea whistle: two close tones with the pea's rattle
      buffers.whistle = [makeBuffer(0.62, t => { const env = Math.min(1, t / 0.03) * (t < 0.48 ? 1 : Math.exp(-(t - 0.48) * 30)); const am = 0.65 + 0.35 * Math.sin(TAU * 34 * t); return (Math.sin(TAU * 2930 * t) + 0.7 * Math.sin(TAU * 3105 * t)) * am * env; }, 101)];
      // applause: many short claps (Poisson), each band-limited at a random centre
      buffers.applause = [0, 1].map(k => {
        const sec = 4.2, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate), r = rnd(201 + k);
        for (let ch = 0; ch < 2; ch++) {
          const d = b.getChannelData(ch);
          let t = 0;
          while (t < sec) {
            const rate = 40 + 170 * Math.exp(-Math.pow((t - 0.9) / 1.3, 2));
            t += -Math.log(1 - r()) / rate;
            const i0 = Math.floor(t * ctx.sampleRate), len = Math.floor(ctx.sampleRate * (0.006 + r() * 0.01)), f = 900 + r() * 1800, amp = (0.35 + r() * 0.65) * Math.min(1, (sec - t) / 1.2);
            let y1 = 0, y2 = 0; const w = 2 * Math.PI * f / ctx.sampleRate, q = 2.2, alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
            for (let j = 0; j < len && i0 + j < n; j++) { const x = (r() * 2 - 1) * Math.exp(-j / len * 4); const y = (alpha * x - 0 + 2 * Math.cos(w) * y1 - (1 - alpha) * y2) / a0; y2 = y1; y1 = y; d[i0 + j] += y * amp * 3; }
          }
          let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] *= 0.8 / (peak || 1);
        }
        return b;
      });
      // arena room tone (very low)
      buffers.room = [makeBuffer(3, (t, r) => { return (r() * 2 - 1) * 0.5; }, 301)];
    }
    function impulse(sec = 2.2) {
      const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate), r = rnd(401);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; d[i] = (r() * 2 - 1) * Math.pow(1 - t / sec, 2.4) * (t < 0.012 ? t / 0.012 : 1) * 0.45; } }
      return b;
    }

    async function loadFile(name, url) {
      try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); buffers[name] = [await ctx.decodeAudioData(await r.arrayBuffer())]; }
      catch (e) { /* optional layer */ }
    }

    async function unlock() {
      if (closed) return false;
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      if (!ctx) {
        ctx = new AC({ latencyHint: 'interactive' });
        master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
        comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
        master.connect(comp).connect(ctx.destination);
        sfx = ctx.createGain(); sfx.connect(master);
        crowdBus = ctx.createGain(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; crowdBus.connect(lp).connect(master);
        verb = ctx.createConvolver(); synth(); verb.buffer = impulse(); verbSend = ctx.createGain(); verbSend.gain.value = 0.5; verbSend.connect(verb).connect(master);
        const base = opts.crowdBase || '../football/assets/';
        loadFile('cheer', base + 'crowd-cheer.mp3').then(startMurmur);
        loadFile('groan', base + 'crowd-miss.mp3');
        startRoom();
      }
      try { await ctx.resume(); } catch (e) { }
      unlocked = true;
      return true;
    }

    function startRoom() {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buffers.room[0]; s.loop = true; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0.05;
      s.connect(f).connect(g).connect(crowdBus); s.start();
    }
    function startMurmur() {
      if (!buffers.cheer || murmur) return;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buffers.cheer[0]; s.loop = true; s.playbackRate.value = 0.82; f.type = 'lowpass'; f.frequency.value = 1500; g.gain.value = 0;
      s.connect(f).connect(g).connect(crowdBus); s.start();
      g.gain.setTargetAtTime(murmurLevel, ctx.currentTime, 1.2);
      murmur = { s, g, f };
    }

    function spatial(pos) {
      if (!pos) return { gain: 1, pan: 0, wet: 0.25, cutoff: 12000 };
      const dx = pos[0] - listener.pos[0], dy = pos[1] - listener.pos[1], dz = pos[2] - listener.pos[2];
      const d = Math.hypot(dx, dy, dz);
      const pan = clamp((dx * listener.right[0] + dz * listener.right[2]) / Math.max(d, 1), -0.8, 0.8);
      return { gain: 1 / Math.sqrt(1 + (d / 5.5) ** 2), pan, wet: clamp(0.18 + d / 25, 0.18, 0.7), cutoff: clamp(14000 - d * 650, 2600, 14000) };
    }

    function voice(kind, { gain = 1, rate = 1, pos = null, wet = null, when = 0, bus = null, fadeOut = 0 } = {}) {
      if (!unlocked || !ctx || ctx.state === 'closed' || !buffers[kind]) return null;
      const list = active.get(kind) || []; active.set(kind, list);
      while (list.length >= (limits[kind] || 3)) { const old = list.shift(); try { old.g.gain.setTargetAtTime(0, ctx.currentTime, 0.03); old.s.stop(ctx.currentTime + 0.12); } catch (e) { } }
      const variants = buffers[kind], s = ctx.createBufferSource(); s.buffer = variants[Math.floor(Math.random() * variants.length)];
      s.playbackRate.value = rate;
      const sp = spatial(pos), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      f.type = 'lowpass'; f.frequency.value = sp.cutoff;
      g.gain.value = gain * sp.gain;
      s.connect(f).connect(g); let out = g; if (p) { p.pan.value = sp.pan; g.connect(p); out = p; }
      out.connect(bus || sfx);
      const send = ctx.createGain(); send.gain.value = wet ?? sp.wet; out.connect(send).connect(verbSend);
      const t0 = ctx.currentTime + Math.max(0, when);
      s.start(t0);
      if (fadeOut) { g.gain.setValueAtTime(gain * sp.gain, t0 + fadeOut[0]); g.gain.linearRampToValueAtTime(0, t0 + fadeOut[0] + fadeOut[1]); s.stop(t0 + fadeOut[0] + fadeOut[1] + 0.05); }
      const v = { s, g }; list.push(v);
      s.onended = () => { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); try { s.disconnect(); g.disconnect(); f.disconnect(); p && p.disconnect(); send.disconnect(); } catch (e) { } };
      return v;
    }

    /** scene events -> sounds; data.pos is a THREE.Vector3 or [x,y,z] */
    function event(type, data = {}) {
      const pos = data.pos ? (data.pos.toArray ? data.pos.toArray() : data.pos) : null;
      const sp = data.speed || 4;
      switch (type) {
        case 'dribble': voice('bounce', { gain: 0.85, rate: 0.97 + Math.random() * 0.06, pos }); break;
        case 'contact':
          if (data.type === 'rim') voice('rim', { gain: clamp(sp / 6, 0.25, 1) * 0.75, rate: 0.98 + Math.random() * 0.04, pos, wet: 0.5 });
          else if (data.type === 'board') voice('board', { gain: clamp(sp / 5, 0.3, 1), pos, wet: 0.5 });
          else if (data.type === 'net') voice('net', { gain: 0.75, rate: 0.95 + Math.random() * 0.1, pos, wet: 0.35 });
          else if (data.type === 'floor') voice('bounce', { gain: clamp(sp / 7, 0.15, 1), rate: 0.95 + Math.random() * 0.05, pos });
          else if (data.type === 'wall') voice('thud', { gain: clamp(sp / 6, 0.15, 0.7), pos });
          break;
        case 'release': voice('whoosh', { gain: 0.35, pos }); voice('slap', { gain: 0.3, pos, rate: 1.2 }); break;
        case 'gather': voice('squeak', { gain: 0.32, pos: data.pos ? pos : null, rate: 1.05 }); break;
        case 'land': voice('thud', { gain: 0.6, pos }); voice('squeak', { gain: 0.45, pos, rate: 0.95 + Math.random() * 0.1, when: 0.03 }); break;
        case 'squeak': voice('squeak', { gain: 0.38 * (data.intensity || 1), pos, rate: 0.9 + Math.random() * 0.2 }); break;
        case 'catch': voice('slap', { gain: 0.6, pos }); break;
        case 'pass': voice('slap', { gain: 0.45, pos, rate: 0.9 }); voice('squeak', { gain: 0.25, pos, rate: 1.1, when: 0.05 }); break;
        case 'whistle': voice('whistle', { gain: 0.32, wet: 0.6 }); break;
      }
    }

    function crowd(state) {
      if (!unlocked || !ctx) return;
      const now = ctx.currentTime;
      const set = (lvl, tc) => { murmurLevel = lvl; if (murmur) murmur.g.gain.setTargetAtTime(lvl, now, tc); };
      if (state === 'anticipate') set(0.2, 0.6);
      else if (state === 'question') set(0.09, 0.8);
      else if (state === 'make') {
        set(0.12, 2.5);
        voice('cheer', { gain: 0.75, bus: crowdBus, wet: 0.35, fadeOut: [2.6, 2.2] });
        voice('applause', { gain: 0.55, bus: crowdBus, wet: 0.4, when: 0.15 });
      } else if (state === 'miss') {
        set(0.11, 2);
        voice('groan', { gain: 0.42, bus: crowdBus, wet: 0.35, fadeOut: [1.6, 1.2] });
        voice('applause', { gain: 0.18, bus: crowdBus, wet: 0.45, when: 1.1, rate: 0.9 });
      } else if (state === 'pending') set(0.1, 1.2);
      else set(0.12, 1.5);
    }

    function setListener(pos, right) { listener.pos = pos; listener.right = right; }
    function setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.05); }
    function setVolume(v) { volume = clamp(v, 0, 1); if (master && !muted) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05); }
    function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
    function resume() { if (ctx && unlocked && ctx.state === 'suspended') ctx.resume(); }
    function stopReactions() { for (const k of ['cheer', 'groan', 'applause']) for (const v of (active.get(k) || [])) { try { v.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15); v.s.stop(ctx.currentTime + 0.6); } catch (e) { } } }
    function close() { closed = true; if (ctx) { try { ctx.close(); } catch (e) { } } ctx = null; }
    function stats() { let n = 0; active.forEach(l => { n += l.length; }); return { voices: n, state: ctx ? ctx.state : 'none', recordings: !!buffers.cheer }; }
    /** QA: level analysis of every generated/loaded buffer (rms, peak, NaN) */
    function analyse() {
      const out = {};
      for (const [k, list] of Object.entries(buffers)) out[k] = list.map(b => { let s = 0, pk = 0, nan = false, n = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i]; if (v !== v) nan = true; s += v * v; pk = Math.max(pk, Math.abs(v)); n++; } } return { sec: +b.duration.toFixed(2), rms: +Math.sqrt(s / n).toFixed(4), peak: +pk.toFixed(3), nan }; });
      return out;
    }

    return { unlock, event, crowd, setListener, setMuted, setVolume, suspend, resume, stopReactions, close, stats, analyse, get muted() { return muted; }, get volume() { return volume; }, get ready() { return unlocked; } };
  }

  root.BasketballAudio = { create };
})(typeof window !== 'undefined' ? window : globalThis);
