// أهداف الإجابات: لوحات معلّقة على جسر فولاذي، كل لوحة مرتبطة بمعرّف خيار واحد.
// النص يُرسم على Canvas بمحرّك النصوص في المتصفح (اتجاه RTL واتصال الحروف والتفاف السطور).
import * as THREE from 'three';
import { WORLD, num } from '../core/config.js';

const CW = 1024, CH = 632, HEAD = 96;
const FONT = 'Cairo, "Noto Kufi Arabic", "Segoe UI", Tahoma, Arial, sans-serif';
const STOW = -1.52;
const LAYOUT = { 2: [1.1, -1.1], 3: [2.2, 0, -2.2], 4: [3.3, 1.1, -1.1, -3.3] };   // من اليمين إلى اليسار

function wrapLines(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = []; let line = '';
  for (let w of words) {
    while (ctx.measureText(w).width > maxW && w.length > 1) {     // كلمة أطول من السطر: تُقسَّم
      let cut = w.length - 1;
      while (cut > 1 && ctx.measureText(w.slice(0, cut)).width > maxW) cut--;
      if (line) { lines.push(line); line = ''; }
      lines.push(w.slice(0, cut)); w = w.slice(cut);
    }
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxW) line = test;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** يختار أكبر حجم خط يُبقي النص كاملًا داخل اللوحة. يعيد { size, lines, fits }. */
export function fitText(ctx, text, maxW, maxH, sizes = [132, 116, 100, 88, 78, 70, 62, 56]) {
  let last = null;
  for (const size of sizes) {
    ctx.font = `700 ${size}px ${FONT}`;
    const lines = wrapLines(ctx, text, maxW);
    const lh = size * 1.42;
    last = { size, lines, lh, fits: lines.length * lh <= maxH };
    if (last.fits) return last;
  }
  return last;
}

const THEME = {
  normal: { bg: '#f2ecdf', head: '#22313f', text: '#131c25', badge: '#c69a45' },
  wrong: { bg: '#cfc8bb', head: '#7a2a22', text: '#6a645b', badge: '#a8a196' },
  correct: { bg: '#e2f2dc', head: '#1d6b36', text: '#10301a', badge: '#f2ecdf' }
};

class Board {
  constructor(mats) {
    this.canvas = document.createElement('canvas'); this.canvas.width = CW; this.canvas.height = CH;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 8;
    this.pivot = new THREE.Group(); this.swing = new THREE.Group(); this.pivot.add(this.swing);
    const steel = mats.steelDark;
    const mk = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; this.swing.add(o); return o; };
    for (const x of [-0.78, 0.78]) mk(new THREE.BoxGeometry(0.035, 0.52, 0.035), steel).position.set(x, -0.26, 0);
    this.plate = mk(new THREE.BoxGeometry(2.06, 1.31, 0.04), steel); this.plate.position.set(0, -1.155, 0);
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.21),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.92, metalness: 0, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: 0.16 }));
    this.face.position.set(0, -1.155, 0.022); this.face.receiveShadow = true; this.swing.add(this.face);
    this.plate.userData.board = this; this.face.userData.board = this;
    this.swing.rotation.x = STOW;
    this.optionId = null; this.text = ''; this.badge = 0; this.state = 'blank'; this.hover = false;
    this.angle = STOW; this.vel = 0; this.goal = STOW; this.active = false;
    this.draw();
  }

  set(option, badge) { this.optionId = option.id; this.text = option.text; this.badge = badge; this.state = 'normal'; this.hover = false; this.draw(); }
  clear() { this.optionId = null; this.text = ''; this.state = 'blank'; this.hover = false; this.active = false; this.draw(); }
  setState(s) { if (this.state !== s) { this.state = s; this.draw(); } }
  setHover(h) { if (this.hover !== h && this.state === 'normal') { this.hover = h; this.draw(); } else this.hover = h && this.state === 'normal'; }

  draw() {
    const g = this.ctx, th = THEME[this.state] || THEME.normal;
    g.clearRect(0, 0, CW, CH);
    g.fillStyle = th.bg; g.fillRect(0, 0, CW, CH);
    if (this.state === 'blank') { g.fillStyle = '#bdb6a8'; g.fillRect(0, 0, CW, CH); this.texture.needsUpdate = true; return; }
    g.fillStyle = th.head; g.fillRect(0, 0, CW, HEAD);
    // رقم الخيار (للاختيار بلوحة المفاتيح)
    g.fillStyle = th.badge; g.beginPath(); g.arc(CW - 70, HEAD / 2, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = this.state === 'correct' ? th.head : '#1a1408';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    g.font = `900 50px ${FONT}`; g.fillText(num(this.badge), CW - 70, HEAD / 2 + 4);
    if (this.state !== 'normal') {
      g.fillStyle = '#ffffff'; g.font = `700 46px ${FONT}`; g.textAlign = 'left';
      g.fillText(this.state === 'correct' ? 'إجابة صحيحة' : 'إجابة غير صحيحة', 40, HEAD / 2 + 4);
    }
    const fit = fitText(g, this.text, CW - 112, CH - HEAD - 56);
    this.fits = fit.fits;
    g.fillStyle = th.text; g.textAlign = 'center'; g.direction = 'rtl'; g.font = `700 ${fit.size}px ${FONT}`;
    const top = HEAD + (CH - HEAD - fit.lines.length * fit.lh) / 2 + fit.lh / 2 + 4;
    fit.lines.forEach((ln, i) => g.fillText(ln, CW / 2, top + i * fit.lh));
    if (this.state === 'wrong') {
      g.strokeStyle = 'rgba(150,40,30,0.55)'; g.lineWidth = 22; g.lineCap = 'round';
      g.beginPath(); g.moveTo(CW / 2 - 170, HEAD + 70); g.lineTo(CW / 2 + 170, CH - 70); g.moveTo(CW / 2 + 170, HEAD + 70); g.lineTo(CW / 2 - 170, CH - 70); g.stroke();
    } else if (this.state === 'correct') {
      g.strokeStyle = '#1d6b36'; g.lineWidth = 16; g.strokeRect(8, 8, CW - 16, CH - 16);
    }
    if (this.hover) { g.strokeStyle = '#e0a11a'; g.lineWidth = 14; g.strokeRect(7, 7, CW - 14, CH - 14); }
    this.texture.needsUpdate = true;
  }

  update(dt) {
    if (Math.abs(this.goal - this.angle) < 0.0005 && Math.abs(this.vel) < 0.001) { this.angle = this.goal; return false; }
    const k = 140, c = 17;     // نابض مخمّد: حركة ميكانيكية قصيرة
    this.vel += (k * (this.goal - this.angle) - c * this.vel) * dt;
    this.angle += this.vel * dt;
    if (this.angle > 0.06) { this.angle = 0.06; this.vel *= -0.3; }
    this.swing.rotation.x = this.angle;
    return true;
  }
}

export class TargetSets {
  constructor(scene, mats) {
    this.sets = [0, 1].map(() => [0, 1, 2, 3].map(() => { const b = new Board(mats); b.pivot.visible = false; scene.add(b.pivot); return b; }));
    this.current = null;
  }

  _place(setIndex, stationIndex, count) {
    const xs = LAYOUT[count] || LAYOUT[4];
    const z = -stationIndex * WORLD.pitch + WORLD.targetZ;
    this.sets[setIndex].forEach((b, j) => {
      b.pivot.visible = j < xs.length;
      if (j >= xs.length) return;
      b.pivot.position.set(xs[j], 2.95, z);
      b.pivot.rotation.y = Math.atan2(-xs[j], -WORLD.targetZ);
    });
  }

  /** يجهّز لوحات مرفوعة وفارغة على جسر محطة قادمة. */
  stage(stationIndex, count) {
    const set = this.sets[stationIndex % 2];
    set.forEach(b => { b.clear(); b.goal = b.angle = STOW; b.vel = 0; b.swing.rotation.x = STOW; });
    this._place(stationIndex % 2, stationIndex, count);
  }

  /** ينزّل لوحات المهمة الحالية. options مرتّبة حسب ترتيب العرض. */
  present(stationIndex, options, disabledIds = []) {
    const set = this.sets[stationIndex % 2];
    this._place(stationIndex % 2, stationIndex, options.length);
    set.forEach((b, j) => {
      if (j >= options.length) { b.clear(); return; }
      b.set(options[j], j + 1);
      if (disabledIds.includes(options[j].id)) b.setState('wrong');
      b.active = true; b.goal = 0; b.vel = 0;
    });
    this.current = set.slice(0, options.length);
    return this.current;
  }

  /** يرفع اللوحات ويمسح نصوصها بعد انتهاء المهمة. */
  retract() {
    if (!this.current) return;
    for (const b of this.current) { b.goal = STOW; b.active = false; }
    const done = this.current; this.current = null;
    setTimeout(() => done.forEach(b => { if (!b.active) b.clear(); }), 900);
  }

  hideAll() { this.sets.flat().forEach(b => { b.clear(); b.pivot.visible = false; b.goal = b.angle = STOW; b.swing.rotation.x = STOW; }); this.current = null; }

  /** المجسّمات القابلة للإصابة حاليًا (اللوحات النازلة فقط). */
  hitMeshes() { return this.current ? this.current.filter(b => b.active).map(b => b.plate) : []; }
  byOption(id) { return this.current ? this.current.find(b => b.optionId === id) : null; }
  byBadge(n) { return this.current ? this.current[n - 1] : null; }
  setHover(board) { if (this.current) for (const b of this.current) b.setHover(b === board); }
  allFit() { return !this.current || this.current.every(b => b.fits !== false); }

  update(dt) { let busy = false; for (const b of this.sets.flat()) if (b.pivot.visible && b.update(dt)) busy = true; return busy; }
}
