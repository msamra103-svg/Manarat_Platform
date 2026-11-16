// تحميل الخامات والنماذج مع تقدّم حقيقي وبدائل عند الفشل (لا شاشة سوداء).
// الأصول مقسّمة: مشتركة، وخاصة بكل مكان (صحراء / غابة)، ولا يُحمَّل من الأماكن إلا ما اختاره اللاعب.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = import.meta.env.BASE_URL;   // مسار نسبي، فيعمل النشر داخل مجلد فرعي
// نسخة الملف الواحد (standalone) تضمّن الأصول داخل الصفحة في window.__MM_INLINE
const INLINE = (typeof window !== 'undefined' && window.__MM_INLINE) || null;
const urlOf = key => (INLINE && INLINE[key]) || BASE + key;
const texKey = (name, tier) => { const k = `assets/textures/${tier}/${name}.webp`; return INLINE && !INLINE[k] ? `assets/textures/512/${name}.webp` : k; };

// name -> نوع الخامة (يحدد فضاء اللون والبديل عند الفشل)
const GROUPS = {
  common: {
    concrete_color: 'color', concrete_normal: 'normal', concrete_orm: 'orm',
    metal_color: 'color', metal_normal: 'normal', metal_orm: 'orm',
    rock_color: 'color', rock_normal: 'normal',
    fabric_color: 'color', fabric_normal: 'normal', fabric_orm: 'orm',
    wood_color: 'color', wood_normal: 'normal', wood_orm: 'orm'
  },
  desert: {
    sand_color: 'color', sand_normal: 'normal', sand_orm: 'orm',
    plaster_color: 'color', plaster_normal: 'normal', plaster_orm: 'orm',
    frond: 'color', lattice: 'color'
  },
  forest: {
    grass_color: 'color', grass_normal: 'normal',
    bark_oak_color: 'color', bark_oak_normal: 'normal', bark_pine_color: 'color', bark_pine_normal: 'normal',
    leaves_oak: 'color', leaves_ash: 'color', leaves_pine: 'color'
  }
};
const FALLBACK = { color: [150, 140, 120, 255], normal: [128, 128, 255, 255], orm: [255, 225, 0, 255] };
const TREES = 'assets/models/trees.bin';

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

function inlineBuffer(key) {
  const bin = atob(INLINE[key].slice(INLINE[key].indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** يفكّ ملف الأشجار الثنائي (يُنتجه tools/gen-trees.mjs) إلى هندسات جاهزة. */
function parseTrees(buf) {
  const headLen = new DataView(buf).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen)));
  const base = 4 + headLen;
  const geo = part => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, base + part.position.at, part.position.n), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(buf, base + part.normal.at, part.normal.n), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buf, base + part.uv.at, part.uv.n), 2));
    const Arr = part.wide ? Uint32Array : Uint16Array;
    g.setIndex(new THREE.BufferAttribute(new Arr(buf, base + part.index.at, part.index.n), 1));
    return g;
  };
  return header.trees.map(t => ({ name: t.name, bark: t.bark, leaf: t.leaf, scale: t.scale, branches: geo(t.branches), leaves: geo(t.leaves) }));
}

export class Assets {
  constructor() {
    this.textures = {};
    this.models = {};
    this.trees = null;
    this.failed = [];
    this.tier = '512';
    this.loaded = new Set();          // المجموعات المحمّلة
    for (const group of Object.values(GROUPS)) {
      for (const [name, kind] of Object.entries(group)) {
        const t = new THREE.Texture(fallbackImage(kind));
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        if (kind === 'color') t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true;
        this.textures[name] = t;
      }
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

  async _loadTrees() {
    try {
      const buf = INLINE && INLINE[TREES] ? inlineBuffer(TREES) : await (await fetch(BASE + TREES)).arrayBuffer();
      this.trees = parseTrees(buf);
    } catch (e) { this.trees = []; this.failed.push('trees'); }
  }

  _groupJobs(group, tier, tick) {
    const jobs = Object.keys(GROUPS[group]).map(n => this._loadTexture(n, tier).then(tick));
    if (group === 'forest' && !this.trees) jobs.push(this._loadTrees().then(tick));
    this.loaded.add(group);
    return jobs;
  }

  /** يحمّل ما يلزم للعب في المكان المختار. onProgress(نسبة من 0 إلى 1) تعكس عدد العناصر المكتملة فعلًا. */
  async loadAll(tier, onProgress, env = 'desert') {
    this.tier = tier;
    let done = 0, total = 1;
    const tick = () => { done += 1; onProgress && onProgress(done / total); };
    const jobs = [...this._groupJobs('common', tier, tick), ...this._groupJobs(env, tier, tick)];
    jobs.push(new Promise(resolve => {
      const ok = gltf => { this.models.soldier = gltf; tick(); resolve(); };
      const bad = () => { this.failed.push('soldier'); tick(); resolve(); };
      const key = 'assets/models/soldier.glb';
      try {
        if (INLINE && INLINE[key]) {
          const loader = new GLTFLoader();
          loader.register(parser => { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return { name: 'MM_image_textures' }; });
          loader.parse(inlineBuffer(key), '', ok, bad);
        } else new GLTFLoader().load(BASE + key, ok, undefined, bad);
      } catch (e) { bad(); }
    }));
    total = jobs.length;
    await Promise.all(jobs);
    return this.failed.slice();
  }

  /** يحمّل أصول مكان لم يُحمَّل بعد (عند تبديل المكان من الشاشة الرئيسية). */
  async ensureEnv(env) {
    if (this.loaded.has(env)) return;
    await Promise.all(this._groupJobs(env, this.tier, () => {}));
  }

  /** تبديل دقة الخامات أثناء التشغيل عند تغيير مستوى الجودة. */
  async setTier(tier) {
    if (tier === this.tier) return;
    this.tier = tier;
    const names = [...this.loaded].flatMap(g => Object.keys(GROUPS[g]));
    await Promise.all(names.map(n => this._loadTexture(n, tier)));
  }

  setAnisotropy(a) {
    for (const t of Object.values(this.textures)) {
      if (t.anisotropy !== a) { t.anisotropy = a; t.needsUpdate = true; }
    }
  }
}
