// الصوت: مؤثرات مولّدة لحظيًا بـ Web Audio (بلا ملفات خارجية)، أجواء صحراوية خفيفة،
// وقراءة آلية اختيارية بمحرّك النطق في الجهاز. ثلاث قنوات مستقلة: المؤثرات، الأجواء، القراءة.
export class GameAudio {
  constructor(prefs) {
    this.prefs = prefs; this.ctx = null; this.ready = false; this.stepFlip = false;
  }

  /** يُستدعى بعد تفاعل صريح من المستخدم (سياسة المتصفحات). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createDynamicsCompressor(); this.master.threshold.value = -14; this.master.ratio.value = 5; this.master.connect(c.destination);
        this.sfx = c.createGain(); this.sfx.connect(this.master);
        this.amb = c.createGain(); this.amb.connect(this.master);
        const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate);
        const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // صدى المكان: ارتدادات عن أسوار الميدان (أطول وألمع في الصحراء، وأقصر وأكتم بين أشجار الغابة)
        this.verb = c.createConvolver(); this.verbGain = c.createGain(); this.verbGain.gain.value = 0.55;
        this.verb.connect(this.verbGain); this.verbGain.connect(this.sfx);
        this._buildIR(this.env || 'desert');
        this._ambience();
        this.ready = true; this.applyPrefs();
      } catch (e) { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  applyPrefs() {
    if (!this.ready) return;
    const p = this.prefs, t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(p.sfxOn ? p.sfxVolume : 0, t, 0.03);
    this.amb.gain.setTargetAtTime(p.ambienceOn ? p.ambienceVolume * 0.5 : 0, t, 0.2);
    if (!p.speechOn) this.stopSpeech();
  }

  setEnvironment(env) { this.env = env; if (this.ready) this._buildIR(env); }

  _buildIR(env) {
    const c = this.ctx, forest = env === 'forest', dur = forest ? 1.1 : 1.7, n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch), a = forest ? 0.12 : 0.3, tau = forest ? 0.2 : 0.42;
      let lp = 0;
      for (let i = 0; i < n; i++) { lp += a * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-(i / c.sampleRate) / tau) * (forest ? 1.7 : 1); }
      for (const [delay, g] of forest ? [[0.07, 0.5], [0.16, 0.3]] : [[0.09, 0.7], [0.21, 0.45], [0.36, 0.25]]) {
        const k = Math.floor((delay + ch * 0.007) * c.sampleRate);
        for (let i = 0; i < 260 && k + i < n; i++) d[k + i] += (Math.random() * 2 - 1) * g * Math.exp(-i / 60);
      }
    }
    this.verb.buffer = buf;
  }

  suspend(on) { if (this.ready) { if (on) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {}); } if (on) this.stopSpeech(); }

  // ---------- لبنات التوليد ----------
  _noise(t, dur, { type = 'lowpass', f0 = 1000, f1 = f0, q = 0.8, gain = 0.5, attack = 0.002, dest = this.sfx, send = false } = {}) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); if (send && this.verb) g.connect(this.verb);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  _tone(t, dur, { type = 'sine', f0 = 440, f1 = f0, gain = 0.3, attack = 0.004, dest = this.sfx } = {}) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  _bell(t, f, gain = 0.22, dur = 0.7) { this._tone(t, dur, { f0: f, gain }); this._tone(t, dur * 0.6, { f0: f * 2.01, gain: gain * 0.35 }); this._tone(t, dur * 0.35, { f0: f * 3.02, gain: gain * 0.15 }); }

  _ambience() {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 420; lp.Q.value = 0.45;
    const g = c.createGain(); g.gain.value = 0.34;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.09; const lg = c.createGain(); lg.gain.value = 0.2; lfo.connect(lg); lg.connect(g.gain);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.053; const lg2 = c.createGain(); lg2.gain.value = 160; lfo2.connect(lg2); lg2.connect(lp.frequency);
    s.connect(lp); lp.connect(g); g.connect(this.amb); s.start(); lfo.start(); lfo2.start();
  }

  // ---------- المؤثرات ----------
  play(name) {
    if (!this.ready || !this.prefs.sfxOn) return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'shot': {
        // طلقة مركّبة من طبقات: فرقعة حادة، جسم الانفجار، ضربة منخفضة، حركة الترباس، رنين الظرف، ثم صدى المكان
        const pv = 0.94 + Math.random() * 0.12;      // تنويع طفيف حتى لا تتطابق الطلقات
        this._noise(t, 0.022, { type: 'highpass', f0: 3200, gain: 1.0, attack: 0.0005, send: true });
        this._noise(t, 0.13, { type: 'lowpass', f0: 2600 * pv, f1: 520, q: 0.7, gain: 1.0, attack: 0.001, send: true });
        this._noise(t + 0.004, 0.09, { type: 'bandpass', f0: 900 * pv, f1: 300, q: 1.2, gain: 0.7 });
        this._tone(t, 0.16, { f0: 150 * pv, f1: 40, gain: 0.95 });
        this._tone(t, 0.05, { type: 'square', f0: 95 * pv, f1: 60, gain: 0.22 });
        this._noise(t + 0.055, 0.018, { type: 'bandpass', f0: 2500, q: 6, gain: 0.16, attack: 0.001 });
        this._noise(t + 0.085, 0.014, { type: 'bandpass', f0: 3400, q: 8, gain: 0.1, attack: 0.001 });
        const tc = t + 0.38 + Math.random() * 0.12;
        [4300, 5750].forEach((f, k) => this._tone(tc + k * 0.045, 0.07, { f0: f * pv, gain: 0.022 }));
        break;
      }
      case 'hitBoard':
        [1870, 2630, 3410].forEach((f, i) => this._tone(t, 0.26 - i * 0.05, { f0: f, gain: 0.11 - i * 0.025 }));
        this._noise(t, 0.03, { type: 'highpass', f0: 3000, gain: 0.25, attack: 0.001 });
        break;
      case 'hitWall':
        this._noise(t, 0.09, { type: 'lowpass', f0: 600, f1: 180, gain: 0.4 });
        this._noise(t + 0.02, 0.2, { type: 'highpass', f0: 2400, gain: 0.07, attack: 0.02 });
        break;
      case 'correct': this._bell(t, 659.3, 0.2); this._bell(t + 0.13, 987.8, 0.22, 0.9); break;
      case 'wrong':
        this._tone(t, 0.26, { type: 'triangle', f0: 196, f1: 138, gain: 0.3 });
        this._tone(t, 0.26, { type: 'sine', f0: 98, f1: 70, gain: 0.3 });
        break;
      case 'gate':
        this._noise(t, 1.25, { type: 'lowpass', f0: 210, f1: 120, gain: 0.5, attack: 0.15 });
        this._tone(t + 0.05, 0.95, { type: 'sawtooth', f0: 62, f1: 88, gain: 0.05, attack: 0.2 });
        this._noise(t + 0.1, 0.9, { type: 'bandpass', f0: 760, f1: 520, q: 9, gain: 0.07, attack: 0.25 });
        this._tone(t + 1.15, 0.2, { f0: 92, f1: 55, gain: 0.5 }); this._noise(t + 1.15, 0.08, { type: 'lowpass', f0: 900, gain: 0.3 });
        break;
      case 'step':
        this.stepFlip = !this.stepFlip;
        this._noise(t, 0.11, { type: 'bandpass', f0: this.stepFlip ? 820 : 640, f1: 380, q: 0.7, gain: 0.2, attack: 0.008 });
        this._tone(t, 0.06, { f0: 95, f1: 60, gain: 0.12 });
        break;
      case 'boardDown':
        this._noise(t, 0.035, { type: 'highpass', f0: 1500, gain: 0.22, attack: 0.001 });
        this._tone(t, 0.09, { f0: 128, f1: 82, gain: 0.3 });
        break;
      case 'boardUp': this._noise(t, 0.2, { type: 'bandpass', f0: 500, f1: 900, q: 2, gain: 0.1, attack: 0.05 }); break;
      case 'complete': [523.3, 659.3, 784, 1046.5].forEach((f, i) => this._bell(t + i * 0.14, f, 0.2, i === 3 ? 1.4 : 0.6)); break;
      case 'fail': this._tone(t, 0.4, { type: 'triangle', f0: 330, f1: 220, gain: 0.25 }); this._tone(t + 0.3, 0.6, { type: 'triangle', f0: 220, f1: 131, gain: 0.25 }); break;
      case 'ui': this._tone(t, 0.05, { f0: 880, f1: 660, gain: 0.08 }); break;
    }
  }

  // ---------- القراءة الآلية (اختيارية) ----------
  speechVoice() {
    try {
      const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      return voices.find(v => /^ar/i.test(v.lang)) || null;
    } catch (e) { return null; }
  }
  speechSupported() { return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined'; }

  speak(parts) {
    if (!this.prefs.speechOn || !this.speechSupported()) return false;
    try {
      this.stopSpeech();
      const voice = this.speechVoice();
      for (const text of parts) {
        if (!text) continue;
        const u = new SpeechSynthesisUtterance(text);
        u.lang = voice ? voice.lang : 'ar-SA'; if (voice) u.voice = voice;
        u.rate = 0.9; u.volume = Math.max(0, Math.min(1, this.prefs.speechVolume));
        window.speechSynthesis.speak(u);
      }
      return true;
    } catch (e) { return false; }      // تعذّر القراءة لا يمنع اللعب
  }
  stopSpeech() { try { if (this.speechSupported()) window.speechSynthesis.cancel(); } catch (e) { /* تجاهل */ } }
}
