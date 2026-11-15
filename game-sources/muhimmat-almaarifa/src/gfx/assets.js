// تحميل الخامات والنماذج مع تقدّم حقيقي وبدائل عند الفشل (لا شاشة سوداء).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = import.meta.env.BASE_URL;   // مسار نسبي، فيعمل النشر داخل مجلد فرعي
// نسخة الملف الواحد (standalone) تضمّن الأصول داخل الصفحة في window.__MM_INLINE
const INLINE = (typeof window !== 'undefined' && window.__MM_INLINE) || null;
const urlOf = key => (INLINE && INLINE[key]) || BASE + key;
const texKey = (name, tier) => { const k = `assets/textures/${tier}/${name}.webp`; return INLINE && !INLINE[k] ? `assets/textures/512/${name}.webp` : k; };

// name -> نوع الخامة (يحدد فضاء اللون والبديل عند الفشل)
const TEXTURES = {
  sand_color: 'color', sand_normal: 'normal', sand_orm: 'orm',
  plaster_color: 'color', plaster_normal: 'normal', plaster_orm: 'orm',
  concrete_color: 'color', concrete_normal: 'normal', concrete_orm: 'orm',
  metal_color: 'color', metal_normal: 'normal', metal_orm: 'orm',
  rock_color: 'color', rock_normal: 'normal',
  dirt_color: 'color', dirt_normal: 'normal',
  fabric_color: 'color', fabric_normal: 'normal', fabric_orm: 'orm',
  wood_color: 'color', wood_normal: 'normal', wood_orm: 'orm',
  frond: 'color', lattice: 'color'
};
const FALLBACK = { color: [178, 164, 140, 255], normal: [128, 128, 255, 255], orm: [255, 225, 0, 255] };

function fallbackImage(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 4;
  const g = c.getContext('2d');
  const [r, gr, b] = FALLBACK[kind];
  g.fillStyle = `rgb(${r},${gr},${b})`;
  g.fillRect(0, 0, 4, 4);
  return c;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

export class Assets {
  constructor() {
    this.textures = {};
    this.models = {};
    this.failed = [];
    this.tier = '512';
    for (const [name, kind] of Object.entries(TEXTURES)) {
      const t = new THREE.Texture(fallbackImage(kind));
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (kind === 'color') t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      t.userData.kind = kind;
      this.textures[name] = t;
    }
  }

  tex(name) { return this.textures[name]; }

  async _loadTexture(name, tier) {
    const t = this.textures[name];
    try {
      const img = await loadImage(urlOf(texKey(name, tier)));
      t.dispose(); t.image = img; t.needsUpdate = true;
    } catch (e) {
      if (!this.failed.includes(name)) this.failed.push(name);
    }
  }

  /** يحمّل كل ما يلزم للعب. onProgress(نسبة من 0 إلى 1) تعكس عدد العناصر المكتملة فعلًا. */
  async loadAll(tier, onProgress) {
    this.tier = tier;
    const names = Object.keys(TEXTURES);
    const total = names.length + 1;
    let done = 0;
    const tick = () => { done += 1; onProgress && onProgress(done / total); };
    const jobs = names.map(n => this._loadTexture(n, tier).then(tick));
    jobs.push(new Promise(resolve => {
      const ok = gltf => { this.models.soldier = gltf; tick(); resolve(); };
      const bad = () => { this.failed.push('soldier'); tick(); resolve(); };
      const key = 'assets/models/soldier.glb';
      try {
        if (INLINE && INLINE[key]) {
          const bin = atob(INLINE[key].slice(INLINE[key].indexOf(',') + 1));
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const loader = new GLTFLoader();
          loader.register(parser => { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return { name: 'MM_image_textures' }; });
          loader.parse(bytes.buffer, '', ok, bad);
        } else new GLTFLoader().load(BASE + key, ok, undefined, bad);
      } catch (e) { bad(); }
    }));
    await Promise.all(jobs);
    return this.failed.slice();
  }

  /** تبديل دقة الخامات أثناء التشغيل عند تغيير مستوى الجودة. */
  async setTier(tier) {
    if (tier === this.tier) return;
    this.tier = tier;
    await Promise.all(Object.keys(TEXTURES).map(n => this._loadTexture(n, tier)));
  }

  setAnisotropy(a) {
    for (const t of Object.values(this.textures)) {
      if (t.anisotropy !== a) { t.anisotropy = a; t.needsUpdate = true; }
    }
  }
}
