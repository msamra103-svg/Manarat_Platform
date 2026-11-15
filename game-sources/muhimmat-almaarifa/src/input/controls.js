// التحكم: فأرة (مع قفل المؤشر إن توفّر، وبديل بالمؤشر الحر)، لمس (سحب للنظر، لمسة للتصويب والإطلاق)، ولوحة مفاتيح.
// هذه الوحدة لا تقيّم الإجابات؛ ترسل أحداثًا فقط، والتقييم يمر كله عبر منطق واحد في main.js.
export class Controls {
  constructor(canvas, handlers) {
    this.canvas = canvas; this.h = handlers;
    this.yaw = 0; this.pitch = 0; this.enabled = false; this.sensitivity = 1;
    this.wantLock = !matchMedia('(pointer: coarse)').matches && 'requestPointerLock' in canvas;
    this.locked = false; this.keys = new Set(); this.dx = 0; this.dy = 0;
    this.pointer = null; this.tween = null;
    this.maxYaw = 1.5; this.maxPitch = 0.62;

    canvas.addEventListener('pointerdown', e => this._down(e));
    canvas.addEventListener('pointermove', e => this._move(e));
    canvas.addEventListener('pointerup', e => this._up(e));
    canvas.addEventListener('pointercancel', () => { this.pointer = null; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });   // منع تمرير الصفحة
    document.addEventListener('mousemove', e => { if (this.locked && this.enabled && !this.tween) this._look(e.movementX, e.movementY, 0.0021); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.lastUnlock = performance.now();
      this.h.onLockChange && this.h.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => this._lockFailed());
    window.addEventListener('keydown', e => this._key(e, true));
    window.addEventListener('keyup', e => this._key(e, false));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** يُستدعى من داخل معالج نقرة المستخدم (زر البدء أو المتابعة). لا يُعدّ طلقة. */
  requestLock() {
    if (!this.wantLock || this.locked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => this._lockFailed());
    } catch (e) { this.wantLock = false; }
  }
  /**
   * فشل قفل المؤشر: إن حدث مباشرة بعد خروج المستخدم بزر Esc فهو رفض مؤقت من المتصفح ونحاول لاحقًا.
   * غير ذلك (إطار مقيَّد أو متصفح لا يسمح) ننتقل فورًا إلى المؤشر الحر حتى لا تضيع نقرات اللاعب.
   */
  _lockFailed() {
    this.locked = false;
    if (performance.now() - (this.lastUnlock ?? -1e9) < 1600) return;
    this.wantLock = false;
  }
  releaseLock() { if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }

  _look(dx, dy, k) {
    const s = k * this.sensitivity;
    this.yaw = Math.max(-this.maxYaw, Math.min(this.maxYaw, this.yaw - dx * s));
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch - dy * s));
    this.dx += dx; this.dy += dy;
  }

  _down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      if (this.locked) { this.h.onFire(null); return; }
      if (this.wantLock) { this.requestLock(); return; }      // نقرة العودة إلى قفل المؤشر ليست طلقة
    }
    this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: e.timeStamp, moved: 0, touch: e.pointerType !== 'mouse' };
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* تجاهل */ }
  }
  _move(e) {
    const p = this.pointer; if (!p || p.id !== e.pointerId || !this.enabled) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.sx, e.clientY - p.sy));
    if (p.moved > 9 && !this.tween) this._look(dx, dy, p.touch ? 0.0036 : 0.0034);   // السحب يدير النظر في اتجاه الإصبع
  }
  _up(e) {
    const p = this.pointer; if (!p || p.id !== e.pointerId) return;
    this.pointer = null;
    if (!this.enabled) return;
    if (p.moved <= 9 && e.timeStamp - p.t < 600) {      // طوابع الأحداث لا تتأثر بتأخّر الإطارات على الأجهزة البطيئة
      const r = this.canvas.getBoundingClientRect();
      this.h.onFire({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 });
    }
  }

  _key(e, down) {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    const c = e.code;
    if (down && (c === 'Escape' || c === 'KeyP')) { this.h.onPause && this.h.onPause(); return; }
    if (!this.enabled) return;
    if (c.startsWith('Arrow')) { e.preventDefault(); down ? this.keys.add(c) : this.keys.delete(c); return; }
    if (!down || e.repeat) return;
    const m = /^(?:Digit|Numpad)([1-4])$/.exec(c);
    if (m) { e.preventDefault(); this.h.onSelect(Number(m[1])); }
    else if (c === 'Space' || c === 'Enter' || c === 'NumpadEnter') { e.preventDefault(); this.h.onFire(null); }
  }

  /** يوجّه النظر بسلاسة إلى زاوية محددة ثم ينفّذ done (للّمس ولوحة المفاتيح). */
  aimTo(yaw, pitch, seconds, done) {
    this.tween = { y0: this.yaw, p0: this.pitch, y1: Math.max(-this.maxYaw, Math.min(this.maxYaw, yaw)), p1: Math.max(-this.maxPitch, Math.min(this.maxPitch, pitch)), t: 0, d: Math.max(0.01, seconds), done };
  }

  reset() { this.yaw = 0; this.pitch = 0; this.tween = null; this.pointer = null; this.keys.clear(); }

  update(dt) {
    if (this.tween) {
      const w = this.tween; w.t = Math.min(1, w.t + dt / w.d);
      const e = 1 - Math.pow(1 - w.t, 3);
      this.yaw = w.y0 + (w.y1 - w.y0) * e; this.pitch = w.p0 + (w.p1 - w.p0) * e;
      if (w.t >= 1) { this.tween = null; w.done && w.done(); }
    } else if (this.enabled && this.keys.size) {
      const r = 1.5 * dt / 0.0021;
      this._look((this.keys.has('ArrowRight') ? r : 0) - (this.keys.has('ArrowLeft') ? r : 0), (this.keys.has('ArrowDown') ? r : 0) - (this.keys.has('ArrowUp') ? r : 0), 0.0021 / this.sensitivity);
    }
    const out = { dx: this.dx, dy: this.dy }; this.dx = 0; this.dy = 0;
    return out;
  }
}
