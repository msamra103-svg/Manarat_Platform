// الميدان: سماء وشمس، كثبان، وساحات تدريب متتابعة بعمارة خليجية (جص، شرفات مدرّجة، أعمدة خشبية، أقواس، مشبّكات).
// تُبنى المحطات عند الحاجة (المحطة الحالية وما بعدها) ويُتخلّص مما صار خلف اللاعب.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldUV } from './materials.js';
import { WORLD, num } from '../core/config.js';

const L = WORLD.pitch, HW = WORLD.halfWidth, WH = WORLD.wallH;
const GZ = WORLD.gateZ, GT = 0.9, GH = 5.4;
const TILE = { plaster: 3.2, stone: 2.4, concrete: 2.6, wood: 1.0, steel: 1.4, steelDark: 1, brass: 1, clay: 1, dark: 1, paintYellow: 1 };
export const SUN_DIR = new THREE.Vector3(-0.46, 0.78, 0.6).normalize();   // من خلف اللاعب ويساره: تضيء واجهات الأهداف

const bx = (w, h, d, x, y, z, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
const cyl = (r1, r2, h, x, y, z, seg = 10) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.translate(x, y, z); return g; };
const rodX = (r, len, x, y, z) => { const g = new THREE.CylinderGeometry(r, r, len, 6); g.rotateZ(Math.PI / 2); g.translate(x, y, z); return g; };
const rodZ = (r, len, x, y, z) => { const g = new THREE.CylinderGeometry(r, r, len, 6); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };
const newParts = () => ({ plaster: [], plaster2: [], stone: [], concrete: [], wood: [], steel: [], steelDark: [], brass: [], clay: [], dark: [], paintYellow: [] });

function archOutline(shape, half, spring, apex) {
  shape.lineTo(-half, 0); shape.lineTo(-half, spring);
  shape.quadraticCurveTo(-half + 0.05, spring + (apex - spring) * 0.68, 0, apex);
  shape.quadraticCurveTo(half - 0.05, spring + (apex - spring) * 0.68, half, spring);
  shape.lineTo(half, 0);
}

function signTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2118'; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = '#b08a45'; g.lineWidth = 6; g.strokeRect(7, 7, 498, 114);
  g.fillStyle = '#efe2c4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.font = '900 64px "Noto Kufi Arabic", Tahoma, sans-serif';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class World {
  constructor(scene, mats, assets) {
    this.scene = scene; this.mats = mats; this.assets = assets;
    this.stations = new Map();
    this.count = 0;
    this.occluders = [];
    this.root = new THREE.Group(); scene.add(this.root);
    this.anim = [];
  }

  // ---------- السماء والإضاءة ----------
  buildSky(renderer) {
    const sky = new Sky(); sky.scale.setScalar(2400);
    const u = sky.material.uniforms;
    u.turbidity.value = 4.2; u.rayleigh.value = 1.25; u.mieCoefficient.value = 0.0035; u.mieDirectionalG.value = 0.82;
    u.sunPosition.value.copy(SUN_DIR);
    this.scene.add(sky); this.sky = sky;

    // خريطة بيئة من السماء نفسها مع ارتداد رملي من الأسفل (إضاءة محيطة متسقة بلا ملف خارجي)
    const envScene = new THREE.Scene();
    const sky2 = new Sky(); sky2.scale.setScalar(1000); Object.assign(sky2.material.uniforms.sunPosition.value, SUN_DIR);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sky2.material.uniforms[k].value = u[k].value;
    envScene.add(sky2);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb89a6e).multiplyScalar(1.5) }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -2; envScene.add(ground);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = pmrem.fromScene(envScene, 0.02, 1, 2000);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose(); sky2.geometry.dispose(); sky2.material.dispose();

    const sun = new THREE.DirectionalLight(0xfff0d8, 2.5);
    sun.castShadow = true;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
    const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 110;
    this.scene.add(sun, sun.target); this.sun = sun;
    this.scene.fog = new THREE.Fog(0xcdd3d6, 90, 620);
    return this.envTarget.texture;
  }

  followSun(pos) {
    this.sun.target.position.set(pos.x, 0, pos.z - 5);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 55);
  }

  // ---------- الأرض والكثبان والنخيل ----------
  buildTerrain(n) {
    const len = (n + 2) * L + 40;
    const size = 900, seg = 150;
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const cz = -len / 2 + 14;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) + cz;
      const dx = Math.max(0, Math.abs(x) - (HW + 10)), dz = Math.max(0, Math.abs(z - cz) - (len / 2 + 6));
      const d = Math.hypot(dx, dz);
      const mask = THREE.MathUtils.smoothstep(d, 0, 26);
      let h = 3.2 * Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017) + 2.1 * Math.sin((x + z) * 0.043 + 0.4) + 0.9 * Math.sin(x * 0.09 - z * 0.07);
      h = (h + 2.4) * mask + THREE.MathUtils.smoothstep(d, 110, 380) * 34 * (0.6 + 0.4 * Math.sin(x * 0.011 + z * 0.006));
      p.setY(i, h); p.setZ(i, z);
    }
    g.computeVertexNormals();
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 3.1, p.getZ(i) / 3.1);
    const m = new THREE.Mesh(g, this.mats.sand); m.receiveShadow = true;
    this.root.add(m); this.terrain = m; this.occluders.push(m);
  }

  buildPalms(n) {
    const trunk = [], fronds = [];
    let y = 0, x = 0; const H = 6.6, segs = 7;
    for (let i = 0; i < segs; i++) {
      const h = H / segs, r0 = 0.24 - i * 0.012, r1 = r0 - 0.012;
      const s = new THREE.CylinderGeometry(r1 + 0.03, r0, h, 9, 1, true); s.translate(x, y + h / 2, 0); trunk.push(s);
      y += h; x += 0.05 * i * 0.3;
    }
    for (let k = 0; k < 16; k++) {
      const f = new THREE.PlaneGeometry(3.4, 0.9, 7, 1);
      const fp = f.attributes.position;
      const lift = 0.5 - (k % 4) * 0.22;
      for (let i = 0; i < fp.count; i++) {
        const t = (fp.getX(i) + 1.7) / 3.4;
        fp.setXYZ(i, t * 3.2, lift * t * 2.2 - t * t * (2.3 + (k % 3) * 0.4), fp.getY(i));
      }
      f.rotateX((k % 2 ? 1 : -1) * 0.5); f.rotateY((k / 16) * Math.PI * 2 + (k % 3) * 0.12); f.translate(x, y - 0.15, 0);
      f.computeVertexNormals(); fronds.push(f.toNonIndexed());
    }
    const tg = worldUV(mergeGeometries(trunk.map(t => t.toNonIndexed())), 1.2), fg = mergeGeometries(fronds);
    const spots = [];
    for (let i = -1; i <= n + 1; i++) for (const side of [-1, 1]) {
      const r = Math.abs(Math.sin(i * 12.9898 + side * 78.233) * 43758.5453) % 1;
      if (r < 0.2) continue;
      spots.push([side * (HW + 3.2 + r * 5.5), -i * L - r * 7, 0.8 + r * 0.45, r * 6.28]);
    }
    this.palmGeo = { tg, fg };
    const tm = new THREE.InstancedMesh(tg, this.mats.trunk, spots.length), fm = new THREE.InstancedMesh(fg, this.mats.frond, spots.length);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    spots.forEach(([px, pz, sc, rot], i) => {
      M.compose(new THREE.Vector3(px, 0, pz), q.setFromAxisAngle(up, rot), new THREE.Vector3(sc, sc, sc));
      tm.setMatrixAt(i, M); fm.setMatrixAt(i, M);
    });
    tm.castShadow = fm.castShadow = true;
    this.frondDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.assets.tex('frond'), alphaTest: 0.35 });
    fm.customDepthMaterial = this.frondDepth;
    tm.frustumCulled = fm.frustumCulled = false;
    this.root.add(tm, fm);
  }

  // ---------- عناصر البناء ----------
  _merlons(parts, x0, x1, y, z, depth, alongZ = false) {
    const nn = Math.max(1, Math.round(Math.abs(x1 - x0) / 1.05));
    for (let i = 0; i < nn; i++) {
      const t = x0 + (i + 0.5) * (x1 - x0) / nn;
      if (alongZ) { parts.plaster.push(bx(depth, 0.34, 0.62, z, y + 0.17, t), bx(depth, 0.26, 0.3, z, y + 0.47, t)); }
      else { parts.plaster.push(bx(0.62, 0.34, depth, t, y + 0.17, z), bx(0.3, 0.26, depth, t, y + 0.47, z)); }
    }
  }

  _window(parts, extra, x, y, z, w, h, face) {
    // face: 'z+' واجهة نحو اللاعب، 'x+' أو 'x-' للجدران الجانبية
    const mk = (geo) => { const m = geo; return m; };
    const lat = new THREE.PlaneGeometry(w, h); const uv = lat.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.9), uv.getY(i) * (h / 0.9));
    const back = new THREE.PlaneGeometry(w, h);
    const f = 0.07;
    if (face === 'z+') {
      back.translate(x, y, z + 0.012); lat.translate(x, y, z + 0.05);
      parts.plaster.push(bx(w + 2 * f, f, 0.12, x, y + h / 2 + f / 2, z + 0.06), bx(w + 2 * f, f, 0.12, x, y - h / 2 - f / 2, z + 0.06), bx(f, h, 0.12, x - w / 2 - f / 2, y, z + 0.06), bx(f, h, 0.12, x + w / 2 + f / 2, y, z + 0.06));
    } else {
      const s = face === 'x+' ? 1 : -1;
      back.rotateY(s * Math.PI / 2); lat.rotateY(s * Math.PI / 2);
      back.translate(x + s * 0.012, y, z); lat.translate(x + s * 0.05, y, z);
      parts.plaster.push(bx(0.12, f, w + 2 * f, x + s * 0.06, y + h / 2 + f / 2, z), bx(0.12, f, w + 2 * f, x + s * 0.06, y - h / 2 - f / 2, z), bx(0.12, h, f, x + s * 0.06, y, z - w / 2 - f / 2), bx(0.12, h, f, x + s * 0.06, y, z + w / 2 + f / 2));
    }
    extra.dark.push(mk(back)); extra.lattice.push(mk(lat));
  }

  _gateWall(st, parts, extra, z, label, open, theme = -1) {
    const W = 2 * (HW + 0.7), front = z + GT / 2;
    const s = new THREE.Shape(); s.moveTo(-W / 2, 0); archOutline(s, 1.6, 2.5, 3.75); s.lineTo(W / 2, 0); s.lineTo(W / 2, GH); s.lineTo(-W / 2, GH); s.closePath();
    const wall = new THREE.ExtrudeGeometry(s, { depth: GT, bevelEnabled: false, curveSegments: 10 }); wall.translate(0, 0, z - GT / 2);
    parts.plaster.push(wall);
    // بوابة حجرية بارزة حول القوس
    const ps = new THREE.Shape(); ps.moveTo(-2.35, 0); archOutline(ps, 1.6, 2.5, 3.75); ps.lineTo(2.35, 0); ps.lineTo(2.35, 4.5); ps.lineTo(-2.35, 4.5); ps.closePath();
    const portal = new THREE.ExtrudeGeometry(ps, { depth: 0.16, bevelEnabled: false, curveSegments: 10 }); portal.translate(0, 0, front);
    // إطار البوابة يختلف من محطة لأخرى: حجر، جصّ بلون مغاير، أو خرسانة
    const frame = theme === 1 ? parts.plaster2 : theme === 3 ? parts.concrete : parts.stone;
    frame.push(portal, bx(5.0, 0.16, 0.26, 0, 4.58, front + 0.1));
    parts.stone.push(bx(3.5, 0.07, 1.7, 0, 0.035, z));
    this._merlons(parts, -W / 2, W / 2, GH, z, GT);
    for (const sgn of [-1, 1]) {
      for (let x = 2.9; x < HW + 0.5; x += 0.55) parts.wood.push(rodZ(0.045, 0.55, sgn * x, GH - 0.62, front + 0.2));
      parts.stone.push(bx(HW - 1.65, 0.75, 0.08, sgn * (2.35 + (HW - 1.65) / 2), 0.375, front + 0.04));
      this._window(parts, extra, sgn * 4.95, 2.95, front, 1.0, 1.5, 'z+');
    }
    // لافتة المحطة ومصباح الحالة
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshStandardMaterial({ map: signTexture(label), roughness: 0.6, metalness: 0.2 }));
    sign.position.set(0, 5.0, front + 0.012); st.group.add(sign); st.disposables.push(sign.material.map, sign.material, sign.geometry);
    parts.steelDark.push(bx(0.34, 0.34, 0.12, 0, 4.2, front + 0.2));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), open ? this.mats.lampOn : this.mats.lampOff);
    lamp.position.set(0, 4.2, front + 0.3); st.group.add(lamp); st.disposables.push(lamp.geometry);
    // مصراعان خشبيان مقوّسان بمسامير نحاسية
    const leaves = [];
    for (const sgn of [-1, 1]) {
      const ls = new THREE.Shape(); ls.moveTo(0, 0.02); ls.lineTo(1.585, 0.02); ls.lineTo(1.585, 3.72); ls.quadraticCurveTo(0.06, 3.33, 0.015, 2.5); ls.closePath();
      const lg = new THREE.ExtrudeGeometry(ls, { depth: 0.08, bevelEnabled: false, curveSegments: 8 }); lg.translate(0, 0, -0.04);
      const metal = [], studs = [];
      for (const by of [0.45, 1.5, 2.45]) metal.push(bx(1.5, 0.09, 0.1, 0.8, by, 0));
      for (let iy = 0; iy < 6; iy++) for (let ix = 0; ix < 4; ix++) {
        const sx = 0.25 + ix * 0.37, sy = 0.2 + iy * 0.52; if (sy > 2.5 + (1 - sx / 1.585) * 0 && sy > 3.2) continue;
        studs.push(new THREE.SphereGeometry(0.035, 6, 5).translate(sx, sy, 0.05));
      }
      studs.push(new THREE.TorusGeometry(0.09, 0.016, 6, 14).translate(1.3, 1.25, 0.07));
      const pivot = new THREE.Group(); pivot.position.set(sgn * 1.6, 0, z + 0.2);
      const inner = new THREE.Group(); if (sgn > 0) inner.scale.x = -1; pivot.add(inner);
      const wm = new THREE.Mesh(worldUV(lg, TILE.wood), this.mats.doors[theme < 0 ? 0 : theme % this.mats.doors.length]);
      const mm = new THREE.Mesh(mergeGeometries(metal.map(g => g.toNonIndexed())), this.mats.steelDark);
      const sm = new THREE.Mesh(mergeGeometries(studs.map(g => g.toNonIndexed())), this.mats.brass);
      if (sgn > 0) for (const m of [wm, mm, sm]) { m.material = m.material.clone(); m.material.side = THREE.DoubleSide; st.disposables.push(m.material); }
      for (const m of [wm, mm, sm]) { m.castShadow = true; m.receiveShadow = true; inner.add(m); st.disposables.push(m.geometry); }
      st.group.add(pivot); leaves.push({ pivot, sgn });
      st.occluders.push(wm);
    }
    const gate = { leaves, lamp, open: open ? 1 : 0, z: st.group.position.z + z };
    this._applyGate(gate);
    return gate;
  }

  _applyGate(gate) {
    for (const l of gate.leaves) l.pivot.rotation.y = -l.sgn * gate.open * 1.78;
  }

  // ---------- المحطة ----------
  _buildStation(i) {
    const n = this.count, isEnd = i === n;
    const st = { index: i, group: new THREE.Group(), occluders: [], disposables: [], gate: null, entry: null, pivots: [] };
    st.group.position.z = -i * L;
    const parts = newParts(), extra = { dark: [], lattice: [], fabric: [], fabricSand: [], glass: [] };
    const tint = i % this.mats.plaster.length;

    // الجداران الجانبيان بشرفات مدرّجة وأعمدة خشبية وقاعدة حجرية
    const z0 = GZ - (isEnd ? 8 : 0), z1 = 2 - GT / 2, mid = (z0 + z1) / 2, len = z1 - z0;
    for (const sgn of [-1, 1]) {
      const x = sgn * (HW + 0.35);
      parts.plaster.push(bx(0.7, WH, len, x, WH / 2, mid));
      this._merlons(parts, z0, z1, WH, x, 0.7, true);
      parts.stone.push(bx(0.08, 0.75, len, sgn * (HW - 0.04), 0.375, mid));
      for (let z = z0 + 0.4; z < z1; z += 0.55) parts.wood.push(rodX(0.045, 0.5, sgn * (HW - 0.18), WH - 0.55, z));
    }
    if (i === 0) {
      st.entry = this._gateWall(st, parts, extra, 2, 'ميدان المعرفة', true);
      for (const sgn of [-1, 1]) {            // برجان دائريان عند المدخل
        parts.plaster.push(cyl(1.55, 1.75, 6.4, sgn * (HW + 0.9), 3.2, 2.2, 20));
        for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; parts.plaster.push(bx(0.5, 0.5, 0.3, sgn * (HW + 0.9) + Math.cos(a) * 1.4, 6.65, 2.2 + Math.sin(a) * 1.4, -a + Math.PI / 2)); }
      }
    }
    if (!isEnd) {
      st.gate = this._gateWall(st, parts, extra, GZ, `المحطة ${num(i + 1)}`, false, i % 5);
      // منصة الرماية وخط الوقوف
      parts.concrete.push(bx(3.4, 0.06, 2.4, 0, 0.03, 0.1));
      parts.paintYellow.push(bx(3.0, 0.012, 0.09, 0, 0.066, -0.85));
      // جسر الأهداف الفولاذي
      const tz = WORLD.targetZ;
      for (const sgn of [-1, 1]) {
        parts.steel.push(bx(0.16, 3.2, 0.16, sgn * 5.95, 1.6, tz), bx(0.5, 0.04, 0.5, sgn * 5.95, 0.02, tz), bx(0.08, 0.9, 0.08, sgn * 5.55, 2.75, tz, 0));
        const br = bx(0.06, 1.1, 0.06, 0, 0, 0); br.rotateZ(sgn * 0.75); br.translate(sgn * 5.6, 2.72, tz); parts.steel.push(br);
      }
      parts.steel.push(bx(12.06, 0.18, 0.14, 0, 3.1, tz), bx(12.06, 0.06, 0.06, 0, 3.32, tz));
      for (let x = -5.4; x <= 5.4; x += 0.9) parts.steel.push(bx(0.04, 0.2, 0.04, x, 3.22, tz));
      this._theme(i, st, parts, extra);
    } else {
      this._endCourt(st, parts, extra, z0);
    }

    const add = (list, mat, tile, shadow = true) => {
      if (!list.length) return null;
      const m = new THREE.Mesh(mergeGeometries(list.map(g => worldUV(g, tile))), mat);
      m.castShadow = shadow; m.receiveShadow = true; st.group.add(m); st.disposables.push(m.geometry); return m;
    };
    const wallMesh = add(parts.plaster, this.mats.plaster[tint], TILE.plaster);
    st.occluders.push(wallMesh);
    const alt = add(parts.plaster2, this.mats.plaster[(tint + 2) % this.mats.plaster.length], TILE.plaster); if (alt) st.occluders.push(alt);
    for (const k of ['stone', 'concrete', 'wood', 'steel', 'steelDark', 'brass', 'clay', 'paintYellow']) {
      const m = add(parts[k], this.mats[k], TILE[k]); if (m && k !== 'paintYellow' && k !== 'wood' && k !== 'brass') st.occluders.push(m);
    }
    const plain = (list, mat, shadow) => {
      if (!list.length) return;
      const m = new THREE.Mesh(mergeGeometries(list.map(g => g.index ? g.toNonIndexed() : g)), mat);
      m.castShadow = shadow; m.receiveShadow = true; st.group.add(m); st.disposables.push(m.geometry);
    };
    plain(extra.dark, this.mats.dark, false); plain(extra.lattice, this.mats.lattice, false);
    plain(extra.fabric, this.mats.fabric, true); plain(extra.fabricSand, this.mats.fabricSand, true); plain(extra.glass, this.mats.glass, false);
    this.root.add(st.group);
    return st;
  }

  _canopy(parts, list, x0, x1, z0, z1, h) {
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) parts.steel.push(cyl(0.045, 0.045, h + 0.2, x, (h + 0.2) / 2, z, 8));
    const g = new THREE.PlaneGeometry(x1 - x0 + 0.5, z1 - z0 + 0.5, 8, 8); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      p.setY(i, h - 0.32 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) + (u - 0.5) * 0.25);
      uv.setXY(i, u * 3, v * 3);
    }
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); g.computeVertexNormals(); list.push(g);
  }

  _jar(parts, x, z, s = 1) {
    const pts = [[0.0, 0], [0.16, 0], [0.3, 0.22], [0.34, 0.5], [0.26, 0.78], [0.13, 0.9], [0.16, 1.0], [0.12, 1.0]].map(([r, y]) => new THREE.Vector2(r * s, y * s));
    parts.clay.push(new THREE.LatheGeometry(pts, 14).translate(x, 0, z));
  }

  _palm(st, parts, x, z, s) {
    parts.stone.push(bx(1.3, 0.5, 1.3, x, 0.25, z));
    for (const [geo, mat] of [[this.palmGeo.tg, this.mats.trunk], [this.palmGeo.fg, this.mats.frond]]) {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, 0.3, z); m.scale.setScalar(s); m.rotation.y = x * 1.7; m.castShadow = true;
      if (mat === this.mats.frond) m.customDepthMaterial = this.frondDepth;
      st.group.add(m);
    }
  }

  _theme(i, st, parts, extra) {
    const t = i % 5, wallFront = GZ + GT / 2;
    // عناصر تحيط بالبوابة وتُرى من موضع الرماية، مختلفة في كل نمط
    if (t === 0) { for (const sgn of [-1, 1]) this._palm(st, parts, sgn * 6.4, -7.0, 0.55); }
    else if (t === 1) {
      for (const sgn of [-1, 1]) {
        const g = new THREE.PlaneGeometry(0.85, 2.6, 1, 6); const uv = g.attributes.uv, p = g.attributes.position;
        for (let k = 0; k < p.count; k++) { p.setZ(k, 0.03 * Math.sin(p.getY(k) * 3 + sgn)); uv.setXY(k, uv.getX(k) * 0.8, uv.getY(k) * 2.4); }
        g.translate(sgn * 3.36, 2.75, wallFront + 0.07); g.computeVertexNormals(); extra.fabricSand.push(g);
        parts.wood.push(rodX(0.03, 1.05, sgn * 3.36, 4.08, wallFront + 0.08));
      }
    } else if (t === 2) { for (const sgn of [-1, 1]) { this._jar(parts, sgn * 5.5, -6.95, 1.3); this._jar(parts, sgn * 6.35, -6.6, 0.8); } }
    else if (t === 3) {
      for (const sgn of [-1, 1]) {
        parts.concrete.push(bx(2.2, 0.8, 0.45, sgn * 5.6, 0.4, -6.95));
        for (let k = 0; k < 5; k++) parts.paintYellow.push(bx(0.22, 0.5, 0.012, sgn * (4.8 + k * 0.4), 0.45, -6.95 + 0.232));
        parts.steelDark.push(bx(0.5, 0.22, 0.3, sgn * 3.3, 4.3, wallFront + 0.18));
      }
    } else {
      for (const sgn of [-1, 1]) parts.steel.push(bx(1.0, 0.75, 0.8, sgn * 5.6, 0.375, -6.95, sgn * 0.12), bx(0.8, 0.6, 0.7, sgn * 5.65, 1.05, -6.95, -sgn * 0.2));
      parts.steelDark.push(cyl(0.03, 0.03, 2.6, -6.7, GH + 1.3, GZ, 6), cyl(0.02, 0.02, 1.8, 6.7, GH + 0.9, GZ, 6));
    }
    if (t === 0) {            // مظلّة قماشية ومقعد خشبي وجِرار فخارية
      this._canopy(parts, extra.fabric, -6.7, -4.1, -4.6, -1.2, 2.7);
      parts.wood.push(bx(2.0, 0.07, 0.5, -5.4, 0.46, -2.9), bx(0.08, 0.46, 0.45, -6.2, 0.23, -2.9), bx(0.08, 0.46, 0.45, -4.6, 0.23, -2.9));
      this._jar(parts, 6.2, -1.2, 1.0); this._jar(parts, 6.5, -2.1, 0.75); this._jar(parts, 5.7, -1.9, 0.6);
    } else if (t === 1) {     // رواق بأقواس صمّاء وبرج هواء (بارجيل) خلف الجدار
      const s = new THREE.Shape(); s.moveTo(-4.4, 0);
      for (const c of [-2.9, 0, 2.9]) { s.lineTo(c - 1.0, 0); s.lineTo(c - 1.0, 1.7); s.quadraticCurveTo(c - 0.95, 2.5, c, 2.8); s.quadraticCurveTo(c + 0.95, 2.5, c + 1.0, 1.7); s.lineTo(c + 1.0, 0); }
      s.lineTo(4.4, 0); s.lineTo(4.4, 3.5); s.lineTo(-4.4, 3.5); s.closePath();
      const a = new THREE.ExtrudeGeometry(s, { depth: 0.42, bevelEnabled: false, curveSegments: 8 }); a.rotateY(Math.PI / 2); a.translate(-HW, 0, -3.2);
      parts.plaster.push(a, bx(0.5, 0.14, 9.0, -HW + 0.24, 3.57, -3.2));
      const tx = HW + 3.4, tz = -4.5;
      parts.plaster.push(bx(2.6, 9.4, 2.6, tx, 4.7, tz), bx(3.0, 0.3, 3.0, tx, 9.55, tz), bx(2.9, 0.22, 2.9, tx, 6.6, tz));
      for (let k = -1; k <= 1; k++) for (const [ox, oz, ry] of [[-1.31, 0, 0], [0, 1.31, Math.PI / 2]]) {
        extra.dark.push(bx(0.03, 2.3, 0.5, tx + ox + (ry ? k * 0.75 : 0), 8.0, tz + oz + (ry ? 0 : k * 0.75), ry).toNonIndexed());
      }
      this._jar(parts, -5.9, -6.9, 0.9);
    } else if (t === 2) {     // نوافذ بمشبّكات جصّية وأحواض حجرية
      for (const sgn of [-1, 1]) for (const z of [-1.2, -4.4]) this._window(parts, extra, sgn * (HW - 0.001), 2.5, z, 1.1, 1.6, sgn > 0 ? 'x-' : 'x+');
      for (const sgn of [-1, 1]) { parts.stone.push(bx(1.5, 0.55, 1.5, sgn * 6.3, 0.275, -6.6)); extra.dark.push(bx(1.2, 0.02, 1.2, sgn * 6.3, 0.56, -6.6).toNonIndexed()); this._jar(parts, sgn * 6.3, -6.6, 0.9); }
      this._canopy(parts, extra.fabricSand, 4.3, 6.8, -3.4, -0.6, 2.6);
    } else if (t === 3) {     // منطقة تدريب حديثة: حواجز خرسانية وصناديق فولاذية وكشّاف
      const prof = new THREE.Shape(); prof.moveTo(-0.3, 0); prof.lineTo(0.3, 0); prof.lineTo(0.3, 0.18); prof.lineTo(0.1, 0.42); prof.lineTo(0.08, 0.82); prof.lineTo(-0.08, 0.82); prof.lineTo(-0.1, 0.42); prof.lineTo(-0.3, 0.18); prof.closePath();
      for (const [x, z, ry] of [[-5.6, -1.4, 0.25], [-5.2, -3.8, -0.15], [5.7, -5.9, 0.1]]) {
        const b = new THREE.ExtrudeGeometry(prof, { depth: 2.2, bevelEnabled: false }); b.translate(0, 0, -1.1); b.rotateY(ry + Math.PI / 2); b.translate(x, 0, z); parts.concrete.push(b);
      }
      parts.steel.push(bx(1.3, 0.9, 0.9, 5.9, 0.45, -1.3, 0.1), bx(1.3, 0.9, 0.9, 5.95, 0.45, -2.5, -0.05), bx(1.1, 0.8, 0.8, 5.9, 1.3, -1.9, 0.3));
      parts.steelDark.push(cyl(0.07, 0.09, 5.2, -6.6, 2.6, -6.9, 8), bx(0.7, 0.28, 0.2, -6.45, 5.1, -6.8, 0.6));
      parts.paintYellow.push(bx(0.09, 0.012, 5.5, -2.6, 0.012, -3.4), bx(0.09, 0.012, 5.5, 2.6, 0.012, -3.4));
    } else {                  // غرفة مراقبة زجاجية على منصة خرسانية
      const cx = 5.3, cz = -3.6;
      parts.concrete.push(bx(3.2, 0.5, 3.4, cx, 0.25, cz), bx(3.4, 0.14, 3.6, cx, 2.92, cz), bx(0.9, 0.25, 0.5, cx - 2.0, 0.125, cz + 1.0));
      for (const [ox, oz] of [[-1.5, -1.6], [1.5, -1.6], [-1.5, 1.6], [1.5, 1.6]]) parts.steelDark.push(bx(0.1, 2.35, 0.1, cx + ox, 1.68, cz + oz));
      parts.steelDark.push(bx(3.1, 0.08, 0.08, cx, 1.35, cz + 1.6), bx(0.08, 0.08, 3.2, cx - 1.5, 1.35, cz), cyl(0.03, 0.03, 3.0, cx + 1.1, 4.5, cz - 1.2, 6));
      extra.glass.push(bx(2.9, 1.45, 0.03, cx, 2.1, cz + 1.6).toNonIndexed(), bx(0.03, 1.45, 3.1, cx - 1.5, 2.1, cz).toNonIndexed());
      parts.concrete.push(bx(2.9, 0.82, 0.12, cx, 0.92, cz + 1.6), bx(0.12, 0.82, 3.1, cx - 1.5, 0.92, cz));
      this._canopy(parts, extra.fabric, -6.8, -4.6, -3.6, -1.0, 2.6);
    }
  }

  _endCourt(st, parts, extra, z0) {
    // مركز التحكم: منصة، غرفة زجاجية، وسارية إشارة تضيء وحدة لكل مهمة مكتملة
    parts.plaster.push(bx(2 * (HW + 0.7), GH, GT, 0, GH / 2, z0));
    this._merlons(parts, -(HW + 0.7), HW + 0.7, GH, z0, GT);
    parts.concrete.push(bx(7.5, 0.4, 5.0, 0, 0.2, -9.5), bx(3.0, 0.2, 0.7, 0, 0.1, -6.75), bx(4.2, 0.14, 3.2, 0, 3.3, -10.2));
    for (const [ox, oz] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) parts.steelDark.push(bx(0.12, 2.9, 0.12, ox, 1.85, -10.2 + oz));
    extra.glass.push(bx(3.9, 1.7, 0.03, 0, 2.35, -8.7).toNonIndexed(), bx(0.03, 1.7, 2.9, -2, 2.35, -10.2).toNonIndexed(), bx(0.03, 1.7, 2.9, 2, 2.35, -10.2).toNonIndexed());
    parts.concrete.push(bx(3.9, 1.1, 0.12, 0, 0.95, -8.7));
    parts.steelDark.push(cyl(0.09, 0.14, 9, 0, 7.8, -10.2, 10), bx(0.5, 0.06, 0.5, 0, 3.4, -10.2));
    const n = this.count, cols = Math.min(n, 10);
    const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    const M = new THREE.Matrix4();
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / cols), col = k % cols;
      M.makeTranslation((col - (cols - 1) / 2) * 0.42, 5.6 + row * 0.42, -8.62); lamps.setMatrixAt(k, M);
    }
    parts.steelDark.push(bx(cols * 0.42 + 0.4, Math.ceil(n / cols) * 0.42 + 0.4, 0.08, 0, 5.6 + (Math.ceil(n / cols) - 1) * 0.21, -8.7));
    lamps.frustumCulled = false; st.group.add(lamps); st.disposables.push(lamps.geometry, lamps.material);
    this.progressLamps = lamps; this.setProgress(this.solved || 0);
    this._canopy(parts, extra.fabric, -6.9, -4.4, -6.5, -3.5, 2.8); this._canopy(parts, extra.fabricSand, 4.4, 6.9, -6.5, -3.5, 2.8);
    this._jar(parts, -3.4, -6.9, 1); this._jar(parts, 3.4, -6.9, 1);
  }

  // ---------- واجهة يستعملها منطق اللعبة ----------
  build(n, renderer) {
    this.count = n; this.solved = 0;
    const env = this.buildSky(renderer);
    this.buildTerrain(n); this.buildPalms(n);
    this.prepare(0);
    return env;
  }

  /** يعيد ضبط الميدان لجلسة جديدة بعدد مهمات مختلف. */
  reset(n) {
    for (const i of [...this.stations.keys()]) this._drop(i);
    if (n !== this.count) {
      this.count = n;
      this.root.remove(this.terrain); this.occluders = this.occluders.filter(o => o !== this.terrain); this.terrain.geometry.dispose();
      this.buildTerrain(n);
    }
    this.solved = 0; this.progressLamps = null; this.anim.length = 0;
    this.prepare(0);
  }

  _drop(i) {
    const st = this.stations.get(i); if (!st) return;
    this.root.remove(st.group);
    for (const d of st.disposables) d.dispose && d.dispose();
    this.occluders = this.occluders.filter(o => !st.occluders.includes(o));
    this.stations.delete(i);
  }

  /** يضمن وجود المحطة الحالية والتاليتين، ويحذف ما قبل السابقة. */
  prepare(i) {
    for (let k = Math.max(0, i - 1); k <= Math.min(this.count, i + 2); k++) {
      if (!this.stations.has(k)) { const st = this._buildStation(k); this.stations.set(k, st); this.occluders.push(...st.occluders); }
    }
    for (const k of [...this.stations.keys()]) if (k < i - 1 || k > i + 2) this._drop(k);
    // أبواب المحطات المنجزة تبقى مفتوحة
    for (const [k, st] of this.stations) if (st.gate && k < i && st.gate.open < 1) { st.gate.open = 1; st.gate.lamp.material = this.mats.lampOn; this._applyGate(st.gate); }
  }

  stand(i) { return new THREE.Vector3(0, 0, -i * L); }
  station(i) { return this.stations.get(i); }

  /** فتح بوابة المحطة i بعد الإجابة الصحيحة فقط. */
  openGate(i, seconds = 1.2) {
    const st = this.stations.get(i); if (!st || !st.gate) return;
    st.gate.lamp.material = this.mats.lampOn;
    this.anim.push({ gate: st.gate, t: 0, d: seconds });
  }

  setProgress(k) {
    this.solved = k;
    const lamps = this.progressLamps; if (!lamps) return;
    const on = new THREE.Color(0x35ff70), off = new THREE.Color(0x4a3a1c);
    for (let i = 0; i < lamps.count; i++) lamps.setColorAt(i, i < k ? on : off);
    lamps.instanceColor.needsUpdate = true;
  }

  /** يعيد true ما دام هناك شيء يتحرك (لتحديث الظلال عند الحاجة فقط). */
  update(dt) {
    for (const a of this.anim) {
      a.t = Math.min(1, a.t + dt / a.d);
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
      a.gate.open = e; this._applyGate(a.gate);
    }
    const busy = this.anim.length > 0;
    this.anim = this.anim.filter(a => a.t < 1);
    return busy;
  }
}
