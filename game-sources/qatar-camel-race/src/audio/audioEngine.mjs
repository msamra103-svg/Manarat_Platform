class AudioEngine {
  constructor(settings) {
    this.s = JSON.parse(JSON.stringify(settings));
    this.ctx = null;
    this.started = false;
    this.nodes = [];
    this.timers = /* @__PURE__ */ new Set();
    this.footBuffers = [];
    this.voice = null;
    this.voiceAvailable = false;
    this.speechQueue = [];
    this._pickVoice();
  }
  // يُستدعى من حدث نقر/لمس
  unlock() {
    if (this.started) {
      this.ctx?.state === "suspended" && this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.ambientBus = c.createGain();
    this.ambientBus.connect(this.sfxBus);
    this.musicBus = c.createGain();
    this.musicBus.connect(this.master);
    this.voiceBus = c.createGain();
    this.voiceBus.connect(this.master);
    this._noise = this._makeNoiseBuffer(3);
    for (let i = 0; i < 5; i++) this.footBuffers.push(this._makeFootBuffer(i));
    this.started = true;
    this.applySettings();
    this._startAmbience();
  }
  _pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      this.voice = voices.find((v) => /^ar(-|_)?QA/i.test(v.lang)) || voices.find((v) => /^ar/i.test(v.lang)) || null;
      this.voiceAvailable = !!this.voice;
    };
    pick();
    window.speechSynthesis.addEventListener?.("voiceschanged", pick);
  }
  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.s.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.s.effects.enabled ? this.s.effects.volume : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.s.music.enabled ? this.s.music.volume : 0, t, 0.1);
    this.voiceBus.gain.setTargetAtTime(this.s.voice.enabled ? this.s.voice.volume : 0, t, 0.05);
    if (!this.s.voice.enabled) this.cancelSpeech();
    if (this.s.music.enabled) this._startMusic();
    else this._stopMusic();
  }
  set(channel, patch) {
    Object.assign(this.s[channel], patch);
    this.applySettings();
  }
  setMaster(v) {
    this.s.master = v;
    this.applySettings();
  }
  // ---------- أدوات ----------
  _makeNoiseBuffer(seconds) {
    const c = this.ctx;
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = w * 0.5 + last * 3.5;
    }
    return b;
  }
  // وقع خف على رمل: دفعة منخفضة مكتومة + خشخشة رمل قصيرة
  _makeFootBuffer(seed) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * 0.16);
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    let lp = 0, lp2 = 0;
    const f0 = 55 + seed * 6;
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate;
      const env = Math.exp(-t * 38);
      const thump = Math.sin(2 * Math.PI * f0 * t * (1 - t * 2)) * Math.exp(-t * 45);
      const n = Math.random() * 2 - 1;
      lp += (n - lp) * 0.25;
      lp2 += (lp - lp2) * 0.35;
      const sand = (lp - lp2 * 0.6) * Math.exp(-t * 22) * 0.6;
      d[i] = (thump * 0.9 + sand) * env * 0.9 + sand * 0.3;
    }
    return b;
  }
  _tone({ type = "sine", freq, dur, gain = 0.3, attack = 5e-3, at = 0, bus, slideTo = null }) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    const t0 = c.currentTime + at;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  _noiseBurst({ dur = 0.3, gain = 0.2, filter = "bandpass", freq = 1e3, q = 1, at = 0, bus }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this._noise;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    const t0 = c.currentTime + at;
    g.gain.setValueAtTime(1e-4, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus || this.sfxBus);
    src.start(t0, Math.random() * 2);
    src.stop(t0 + dur + 0.05);
  }
  // ---------- الأجواء: رياح + جمهور ----------
  _startAmbience() {
    const c = this.ctx;
    const wind = c.createBufferSource();
    wind.buffer = this._noise;
    wind.loop = true;
    const wf = c.createBiquadFilter();
    wf.type = "lowpass";
    wf.frequency.value = 420;
    wf.Q.value = 0.6;
    const wg = c.createGain();
    wg.gain.value = 0.05;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoG = c.createGain();
    lfoG.gain.value = 160;
    lfo.connect(lfoG);
    lfoG.connect(wf.frequency);
    wind.connect(wf);
    wf.connect(wg);
    wg.connect(this.ambientBus);
    wind.start();
    lfo.start();
    const crowd = c.createBufferSource();
    crowd.buffer = this._noise;
    crowd.loop = true;
    this.crowdGain = c.createGain();
    this.crowdGain.gain.value = 0;
    const merge = c.createGain();
    merge.gain.value = 1;
    for (const [f, q, g] of [[480, 2.2, 0.5], [1150, 3, 0.35], [2500, 4, 0.18], [3300, 5, 0.08]]) {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = q;
      const gg = c.createGain();
      gg.gain.value = g;
      const am = c.createOscillator();
      am.frequency.value = 2 + Math.random() * 3;
      const amG = c.createGain();
      amG.gain.value = g * 0.35;
      am.connect(amG);
      amG.connect(gg.gain);
      am.start();
      crowd.connect(bp);
      bp.connect(gg);
      gg.connect(merge);
      this.nodes.push(am);
    }
    merge.connect(this.crowdGain);
    this.crowdGain.connect(this.ambientBus);
    crowd.start();
    this.nodes.push(wind, lfo, crowd);
    this.windGain = wg;
  }
  // شدة الجمهور 0..1 (تزداد قرب المنصات وعند النهاية)
  setCrowdLevel(level) {
    if (!this.ctx || !this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(0.02 + level * 0.32, this.ctx.currentTime, 0.4);
  }
  // خفض الأجواء أثناء السؤال ليركز الطالب
  duck(on) {
    if (!this.ctx) return;
    this.ambientBus.gain.setTargetAtTime(on ? 0.22 : 1, this.ctx.currentTime, on ? 0.15 : 0.5);
    if (this.musicNodes) this.musicDuck?.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.2);
  }
  // ---------- مؤثرات السباق ----------
  footstep(distance, speed) {
    if (!this.ctx || !this.s.effects.enabled) return;
    const c = this.ctx;
    const vol = Math.min(0.5, 2.2 / (1 + distance * distance * 0.03)) * Math.min(1, speed / 6);
    if (vol < 0.02) return;
    const src = c.createBufferSource();
    src.buffer = this.footBuffers[Math.floor(Math.random() * this.footBuffers.length)];
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.ambientBus);
    src.start();
  }
  countdownBeep(final = false) {
    if (!this.ctx) return;
    this._tone({ type: "square", freq: final ? 880 : 520, dur: final ? 0.6 : 0.18, gain: 0.12 });
    if (final) {
      this._tone({ type: "sawtooth", freq: 330, dur: 0.9, gain: 0.08, at: 0.02 });
      this._tone({ type: "sawtooth", freq: 495, dur: 0.9, gain: 0.06, at: 0.02 });
      this.cheer(0.8);
    }
  }
  cheer(strength = 1) {
    if (!this.ctx) return;
    for (let i = 0; i < 3; i++) this._noiseBurst({ dur: 1.4 + Math.random(), gain: 0.06 * strength, freq: 900 + i * 700, q: 1.2, at: i * 0.12, bus: this.ambientBus });
    if (Math.random() < 0.7) this._tone({ type: "sine", freq: 1800 + Math.random() * 600, dur: 0.5, gain: 0.025 * strength, at: 0.3, slideTo: 2600, bus: this.ambientBus });
  }
  correct() {
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._tone({ type: "triangle", freq: f, dur: 0.35, gain: 0.16, at: i * 0.08 }));
  }
  wrong() {
    if (!this.ctx) return;
    this._tone({ type: "sine", freq: 330, dur: 0.28, gain: 0.14 });
    this._tone({ type: "sine", freq: 247, dur: 0.4, gain: 0.14, at: 0.2 });
  }
  click() {
    if (!this.ctx) return;
    this._tone({ type: "sine", freq: 660, dur: 0.06, gain: 0.05 });
  }
  boost() {
    if (!this.ctx) return;
    this._noiseBurst({ dur: 0.6, gain: 0.06, filter: "highpass", freq: 1500, q: 0.5 });
  }
  finish() {
    if (!this.ctx) return;
    const chord = [392, 523.25, 659.25, 783.99];
    chord.forEach((f, i) => {
      this._tone({ type: "sawtooth", freq: f, dur: 1.1, gain: 0.05, at: i * 0.11 });
      this._tone({ type: "triangle", freq: f * 2, dur: 0.9, gain: 0.04, at: 0.5 + i * 0.05 });
    });
    this.cheer(1.4);
    this.setCrowdLevel(1);
  }
  // ---------- الموسيقى الاختيارية (إيقاع خليجي خفيف) ----------
  _startMusic() {
    if (!this.ctx || this.musicNodes) return;
    const c = this.ctx;
    this.musicDuck = c.createGain();
    this.musicDuck.connect(this.musicBus);
    const bpm = 104, beat = 60 / bpm;
    const pattern = [1, 0, 0.5, 1, 0, 0.6, 0.5, 0];
    const melody = [293.66, 0, 311.13, 293.66, 261.63, 0, 233.08, 261.63, 293.66, 0, 349.23, 311.13, 293.66, 0, 0, 0];
    let step = 0;
    let next = c.currentTime + 0.1;
    const schedule = () => {
      while (next < c.currentTime + 0.4) {
        const p = pattern[step % pattern.length];
        if (p) this._drum(next, p);
        if (step % 2 === 1) this._tap(next);
        const n = melody[step % melody.length];
        if (n) this._pluck(next, n);
        next += beat / 2;
        step++;
      }
    };
    const id = setInterval(schedule, 100);
    this.timers.add(id);
    this.musicNodes = { id };
    schedule();
  }
  _drum(t, v) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    g.gain.setValueAtTime(0.35 * v, t);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 0.3);
    o.connect(g);
    g.connect(this.musicDuck);
    o.start(t);
    o.stop(t + 0.32);
  }
  _tap(t) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this._noise;
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 3e3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 0.06);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicDuck);
    src.start(t, Math.random());
    src.stop(t + 0.08);
  }
  _pluck(t, f0) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f0;
    const o2 = c.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.value = f0 * 1.003;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    const g = c.createGain();
    g.gain.setValueAtTime(1e-4, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 8e-3);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 0.5);
    const g2 = c.createGain();
    g2.gain.value = 0.25;
    o.connect(lp);
    o2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(this.musicDuck);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.55);
    o2.stop(t + 0.55);
  }
  _stopMusic() {
    if (!this.musicNodes) return;
    clearInterval(this.musicNodes.id);
    this.timers.delete(this.musicNodes.id);
    try {
      this.musicDuck.disconnect();
    } catch {
    }
    this.musicNodes = null;
  }
  // ---------- الصوت البشري ----------
  say(text, { priority = false } = {}) {
    if (!this.s.voice.enabled || !this.voiceAvailable || !("speechSynthesis" in window)) return false;
    if (priority) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = this.voice;
    u.lang = this.voice.lang;
    u.rate = 0.95;
    u.pitch = 1;
    u.volume = Math.min(1, this.s.voice.volume * this.s.master);
    window.speechSynthesis.speak(u);
    return true;
  }
  commentary(text) {
    if (this.s.voice.commentary) this.say(text, { priority: true });
  }
  readQuestion(text) {
    if (this.s.voice.readQuestions) this.say(text, { priority: true });
  }
  cancelSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  // ---------- الإيقاف والاستئناف ----------
  suspend() {
    this.ctx?.state === "running" && this.ctx.suspend();
    if ("speechSynthesis" in window) window.speechSynthesis.pause();
  }
  resume() {
    this.ctx?.state === "suspended" && this.ctx.resume();
    if ("speechSynthesis" in window) window.speechSynthesis.resume();
  }
  stats() {
    return { contextState: this.ctx?.state || "none", timers: this.timers.size, music: !!this.musicNodes, persistentNodes: this.nodes.length };
  }
  dispose() {
    this.cancelSpeech();
    this._stopMusic();
    this.timers.forEach((t) => clearInterval(t));
    this.timers.clear();
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
      }
    }
    this.nodes = [];
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
      }
    }
    this.ctx = null;
    this.started = false;
  }
}
export {
  AudioEngine
};
