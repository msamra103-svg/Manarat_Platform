// منظور الشخص الأول: سلاح تدريب أصلي التصميم (مجسّم إجرائيًا) تمسكه ذراعا الشخصية نفسها
// (مستخرجتان من نموذج الشخصية الكامل حتى يبقى المظهر ثابتًا بين الشاشات).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SUN_DIR } from './world.js';
import { makeRig, buildStudent } from './characters.js';

// وضعية الإمساك (إحداثيات محلية للسلاح: ‎-Z للأمام، ‎+Y للأعلى، الأصل أعلى المقبض)
export const POSE = {
  root: { pos: [0.14, -0.178, -0.32], rot: [0.02, 0.05, 0] },
  Right: {
    wrist: [0.05, -0.085, 0.118], finger: [-0.16, 0.3, -1], palm: [-1, -0.1, 0.12],
    fore: [-0.2, 0.3, -1], upper: [0.1, 0.5, -1],
    curls: { Index: [0.5, 0.9, 0.5], Middle: [1.15, 1.35, 0.7], Ring: [1.2, 1.4, 0.7], Pinky: [1.25, 1.4, 0.7] },
    spread: { Index: 0.0, Middle: 0, Ring: 0, Pinky: 0 },
    thumb: [[0.2, 0.9, 0.35], [0, 0, 0.35], [0, 0, 0.3]]
  },
  Left: {
    wrist: [-0.058, -0.022, -0.262], finger: [0.62, 0.16, -0.77], palm: [-0.2, 0.96, 0.05],
    fore: [0.4, 0.4, -0.82], upper: [-0.1, 0.5, -1],
    curls: { Index: [0.95, 1.15, 0.6], Middle: [1.0, 1.2, 0.6], Ring: [1.05, 1.2, 0.6], Pinky: [1.1, 1.2, 0.6] },
    spread: { Index: 0, Middle: 0, Ring: 0, Pinky: 0 },
    thumb: [[-0.1, -0.5, 0.1], [0, 0, 0.2], [0, 0, 0.2]]
  }
};

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function profile(points, width, bevel = 0.003) {
  // مقطع جانبي [للأمام، للأعلى] يُبثق على عرض السلاح
  const s = new THREE.Shape(points.map(([f, y]) => new THREE.Vector2(f, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -(width - 2 * bevel) / 2); g.rotateY(Math.PI / 2);
  return g;
}
const box = (w, h, d, x, y, f, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, -f); return g; };
const tube = (r, len, x, y, f, seg = 14, r2 = r) => { const g = new THREE.CylinderGeometry(r2, r, len, seg); g.rotateX(Math.PI / 2); g.translate(x, y, -f); return g; };
const pinX = (r, len, y, f) => { const g = new THREE.CylinderGeometry(r, r, len, 10); g.rotateZ(Math.PI / 2); g.translate(0, y, -f); return g; };
const merged = list => mergeGeometries(list.map(g => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }));

export function buildWeapon() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2c2d, metalness: 0.6, roughness: 0.5 });
  const poly = new THREE.MeshStandardMaterial({ color: 0x18191b, metalness: 0.0, roughness: 0.66 });
  const tan = new THREE.MeshStandardMaterial({ color: 0xb3966b, metalness: 0.08, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0c0d, metalness: 0.3, roughness: 0.8 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x8fd0c0, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.22, envMapIntensity: 2 });
  const led = new THREE.MeshBasicMaterial({ color: 0x4dff88, toneMapped: false });

  const M = [], P = [], T = [], D = [];
  // الجسم العلوي والسفلي
  M.push(profile([[-0.12, 0.03], [-0.12, 0.066], [-0.095, 0.076], [0.2, 0.076], [0.2, 0.03]], 0.044, 0.004));
  M.push(profile([[-0.11, 0.0], [-0.11, 0.032], [0.2, 0.032], [0.2, 0.008], [0.15, 0.0], [0.15, -0.022], [0.086, -0.022], [0.086, 0.0]], 0.04, 0.003));
  // المقبض وواقي الزناد والزناد
  P.push(profile([[-0.006, 0.004], [-0.042, -0.112], [-0.004, -0.126], [0.012, -0.12], [0.04, -0.022], [0.04, 0.004]], 0.033, 0.007));
  M.push(box(0.012, 0.005, 0.05, 0, -0.044, 0.063), box(0.012, 0.024, 0.005, 0, -0.034, 0.086));
  M.push(box(0.007, 0.026, 0.007, 0, -0.016, 0.06, 0.3));
  // خزان الطاقة (بلون الدرع) بأضلاع
  T.push(box(0.027, 0.108, 0.055, 0, -0.07, 0.121, -0.1));
  for (const y of [-0.05, -0.075, -0.1]) D.push(box(0.0285, 0.005, 0.057, 0, y, 0.121 + (y + 0.07) * 0.1, -0.1));
  P.push(box(0.031, 0.01, 0.06, 0, -0.127, 0.127, -0.1));
  // واقي اليد المثمّن بفتحات تهوية
  const hg = new THREE.CylinderGeometry(0.031, 0.031, 0.25, 8); hg.rotateY(Math.PI / 8); hg.rotateX(Math.PI / 2); hg.scale(1, 1.08, 1); hg.translate(0, 0.047, -0.325); T.push(hg);
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) D.push(box(0.003, 0.011, 0.026, sx * 0.0292, 0.047, 0.225 + k * 0.04));
  M.push(tube(0.033, 0.012, 0, 0.047, 0.205, 8), tube(0.033, 0.01, 0, 0.047, 0.452, 8));
  // السبطانة وكابح الفوهة
  M.push(tube(0.0088, 0.12, 0, 0.047, 0.51), box(0.022, 0.03, 0.022, 0, 0.055, 0.478));
  [[0.014, 0.014, 0.577], [0.0115, 0.006, 0.587], [0.014, 0.012, 0.596], [0.0115, 0.006, 0.605], [0.0145, 0.014, 0.615]].forEach(([r, l, f]) => D.push(tube(r, l, 0, 0.047, f, 16)));
  // السكة العلوية
  M.push(box(0.018, 0.006, 0.5, 0, 0.079, 0.17));
  for (let f = -0.07; f < 0.42; f += 0.0115) M.push(box(0.021, 0.0045, 0.006, 0, 0.0835, f));
  // منظار عاكس
  M.push(box(0.03, 0.012, 0.056, 0, 0.092, 0.03), box(0.03, 0.016, 0.026, 0, 0.104, 0.012));
  const fz = 0.054;
  M.push(box(0.004, 0.036, 0.012, -0.019, 0.116, fz), box(0.004, 0.036, 0.012, 0.019, 0.116, fz), box(0.042, 0.004, 0.012, 0, 0.136, fz), box(0.042, 0.004, 0.012, 0, 0.098, fz));
  // الأخمص
  M.push(tube(0.013, 0.2, 0, 0.05, -0.21));
  P.push(profile([[-0.19, 0.072], [-0.345, 0.072], [-0.345, -0.04], [-0.305, -0.04], [-0.225, 0.02], [-0.19, 0.026]], 0.036, 0.005));
  // تفاصيل: ذراع الشدّ، مسامير، غطاء، فريضة أمامية
  M.push(box(0.052, 0.008, 0.016, 0, 0.068, -0.118), pinX(0.004, 0.047, 0.018, 0.0), pinX(0.004, 0.047, 0.014, 0.16), pinX(0.006, 0.05, 0.05, -0.02));
  D.push(box(0.002, 0.016, 0.06, 0.0222, 0.052, 0.09), box(0.002, 0.02, 0.05, -0.0222, 0.05, 0.1));
  M.push(box(0.012, 0.014, 0.014, 0, 0.09, 0.41));
  T.push(box(0.0025, 0.014, 0.085, -0.0222, 0.05, -0.04));

  const mk = (list, mat) => { const m = new THREE.Mesh(merged(list), mat); group.add(m); return m; };
  mk(M, metal); mk(P, poly); mk(T, tan); mk(D, dark);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.034), lens); glass.position.set(0, 0.117, -fz); group.add(glass);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0016, 12), led); dot.position.set(0, 0.117, -fz + 0.0005); group.add(dot);
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.004, 0.005), led); light.position.set(-0.0228, 0.06, 0.02); group.add(light);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.047, -0.625); group.add(muzzle);
  group.userData = { muzzle, materials: [metal, poly, tan, dark, lens, led] };
  return group;
}

// ---------- الذراعان ----------
const ARM_PARTS = ['Arm', 'ForeArm', 'Hand'];
function isArmBone(name) { return /(Left|Right)(Arm|ForeArm|Hand)/.test(name); }

function frame(along, top) {
  const a = along.clone().normalize();
  const t = top.clone().addScaledVector(a, -top.dot(a)).normalize();
  return new THREE.Matrix4().makeBasis(a, t, new THREE.Vector3().crossVectors(a, t));
}

export function buildArms(gltf, def, assets) {
  const rig = makeRig(gltf), root = rig.root, bones = rig.bones;
  if (def && def.kind === 'student') {
    // الطالب: كُمّا الثوب ويدان مكشوفتان مبنيّة على الهيكل نفسه
    rig.meshes.forEach(m => { m.visible = false; });
    buildStudent(rig, assets, true);
  } else {
    rig.meshes.forEach(m => { if (m !== rig.body) m.visible = false; });
    const mesh = rig.body;
    // إبقاء مثلثات الذراعين واليدين فقط
    const geo = mesh.geometry.clone();
    const armIdx = new Set(bones.map((b, i) => (isArmBone(b.name) ? i : -1)).filter(i => i >= 0));
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const armW = new Float32Array(si.count);
    for (let i = 0; i < si.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (armIdx.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
      armW[i] = w;
    }
    const src = geo.index ? geo.index.array : Array.from({ length: geo.attributes.position.count }, (_, i) => i);
    const keep = [];
    for (let i = 0; i < src.length; i += 3) if (armW[src[i]] > 0.5 && armW[src[i + 1]] > 0.5 && armW[src[i + 2]] > 0.5) keep.push(src[i], src[i + 1], src[i + 2]);
    geo.setIndex(keep);
    for (let i = 0; i < si.count; i++) {
      if (armW[i] <= 0.5) continue;
      for (let k = 0; k < 4; k++) sw.setComponent(i, k, armIdx.has(si.getComponent(i, k)) ? sw.getComponent(i, k) / armW[i] : 0);
    }
    sw.needsUpdate = true;
    mesh.geometry = geo;
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.material = mesh.material.clone();
    mesh.material.metalness = 0.12; mesh.material.roughness = 0.62;
    if (def && def.tint) mesh.material.color.set(def.tint);
  }

  const byName = {}; bones.forEach(b => { byName[b.name.replace('mixamorig', '')] = b; });
  bones.forEach(b => { b.userData.bindLocal = b.quaternion.clone(); b.userData.bindWorld = b.getWorldQuaternion(new THREE.Quaternion()); b.userData.bindPos = b.position.clone(); });
  const wp = n => byName[n].getWorldPosition(new THREE.Vector3());
  const dims = {};
  for (const S of ['Left', 'Right']) dims[S] = { upper: wp(S + 'Arm').distanceTo(wp(S + 'ForeArm')), fore: wp(S + 'ForeArm').distanceTo(wp(S + 'Hand')) };

  const setWorldQuat = (bone, q) => { const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()); bone.quaternion.copy(pq.invert().multiply(q)); bone.updateWorldMatrix(false, true); };
  const setWorldPos = (bone, p) => { bone.parent.updateWorldMatrix(true, false); bone.position.copy(p).applyMatrix4(new THREE.Matrix4().copy(bone.parent.matrixWorld).invert()); bone.updateWorldMatrix(false, true); };

  function apply(pose) {
    bones.forEach(b => { b.quaternion.copy(b.userData.bindLocal); b.position.copy(b.userData.bindPos); });
    root.updateMatrixWorld(true);
    for (const S of ['Left', 'Right']) {
      const P = pose[S], s = S === 'Right' ? 1 : -1;
      const FTinv = frame(new THREE.Vector3(s, 0, 0), new THREE.Vector3(0, 1, 0)).invert();
      const aim = (bone, along, top) => {
        const R = frame(along, top).multiply(FTinv);
        setWorldQuat(bone, new THREE.Quaternion().setFromRotationMatrix(R).multiply(bone.userData.bindWorld));
      };
      const f = V(P.finger).normalize(), n = V(P.palm); n.addScaledVector(f, -n.dot(f)).normalize();
      const back = n.clone().negate();
      const W = V(P.wrist), df = V(P.fore).normalize(), du = V(P.upper).normalize();
      const E = W.clone().addScaledVector(df, -dims[S].fore), Sh = E.clone().addScaledVector(du, -dims[S].upper);
      setWorldPos(byName[S + 'Arm'], Sh);
      aim(byName[S + 'Arm'], du, back);
      aim(byName[S + 'ForeArm'], df, back);
      aim(byName[S + 'Hand'], f, back);
      const e = new THREE.Euler(), q = new THREE.Quaternion();
      for (const F of ['Index', 'Middle', 'Ring', 'Pinky']) {
        for (let j = 0; j < 3; j++) {
          const b = byName[`${S}Hand${F}${j + 1}`]; if (!b) continue;
          e.set(j === 0 ? P.spread[F] : 0, 0, P.curls[F][j]);
          b.quaternion.copy(b.userData.bindLocal).multiply(q.setFromEuler(e));
        }
      }
      for (let j = 0; j < 3; j++) {
        const b = byName[`${S}HandThumb${j + 1}`]; if (!b) continue;
        e.set(P.thumb[j][0], P.thumb[j][1], P.thumb[j][2]);
        b.quaternion.copy(b.userData.bindLocal).multiply(q.setFromEuler(e));
      }
    }
    root.updateMatrixWorld(true);
  }
  return { root, apply, byName };
}

// ---------- المجموعة الكاملة ----------
export class ViewModel {
  constructor(assets, envTexture, def) {
    this.assets = assets;
    this.scene = new THREE.Scene();
    this.scene.environment = envTexture; this.scene.environmentIntensity = 0.45;
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.02, 8);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.weapon = buildWeapon(); this.root.add(this.weapon);
    this.arms = assets.models.soldier ? buildArms(assets.models.soldier, def, assets) : null;
    if (this.arms) this.root.add(this.arms.root);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.6); this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.HemisphereLight(0xcfe0ff, 0xb89a6e, 0.55); this.scene.add(this.fill);
    // وميض الفوهة: مستويان متقاطعان بخامة إضافية
    const flashTex = flashTexture();
    this.flashMat = new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: 0 });
    this.flash = new THREE.Group();
    for (const r of [0, Math.PI / 2]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), this.flashMat); p.rotation.z = r; this.flash.add(p); }
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.1), this.flashMat); side.rotation.y = Math.PI / 2; side.position.z = -0.1; this.flash.add(side);
    this.weapon.userData.muzzle.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffc27a, 0, 1.2); this.weapon.userData.muzzle.add(this.flashLight);
    this.t = 0; this.recoil = 0; this.recoilV = 0; this.kick = 0; this.flashT = 0; this.bob = 0; this.bobAmt = 0;
    this.swayX = 0; this.swayY = 0;
    this.applyPose();
  }

  /** يبدّل ذراعي منظور الشخص الأول بما يطابق الشخصية المختارة. */
  setCharacter(def) {
    if (!this.assets.models.soldier) return;
    if (this.arms) { this.root.remove(this.arms.root); this.arms.root.traverse(o => { if (o.isSkinnedMesh && o.geometry) o.geometry.dispose(); }); }
    this.arms = buildArms(this.assets.models.soldier, def, this.assets);
    this.root.add(this.arms.root);
    this.applyPose();
  }

  setEnvironment(texture, intensity = 0.45) { this.scene.environment = texture; this.scene.environmentIntensity = intensity; }

  applyPose() {
    this.base = { pos: V(POSE.root.pos), rot: new THREE.Euler(...POSE.root.rot) };
    if (this.arms) {
      this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0); this.root.updateMatrixWorld(true);
      this.arms.apply(POSE);
    }
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    // في الشاشات الأضيق من 16:9 نوسّع المجال حتى لا يملأ السلاح الشاشة
    this.camera.fov = aspect >= 1.6 ? 50 : THREE.MathUtils.clamp(50 * (1.6 / aspect) * 0.92, 50, 78);
    this.camera.updateProjectionMatrix();
  }

  fire() { this.recoilV += 9.5; this.flashT = 0.055; this.flash.rotation.z = Math.random() * Math.PI; this.flash.scale.setScalar(0.8 + Math.random() * 0.5); }

  /** موضع الفوهة في فضاء العالم (لبداية خط الطلقة). */
  muzzleWorld(mainCamera, out) {
    this.weapon.userData.muzzle.getWorldPosition(out);        // فضاء كاميرا السلاح = فضاء الكاميرا الرئيسية
    return out.applyMatrix4(mainCamera.matrixWorld);
  }

  update(dt, s) {
    this.t += dt;
    const calm = s.reduceMotion ? 0.25 : 1;
    // ارتداد قصير بنابض مخمّد
    for (let left = dt; left > 1e-5; left -= 0.012) {       // خطوات صغيرة: النابض يبقى مستقرًا مهما انخفض معدل الإطارات
      const h = Math.min(0.012, left);
      this.recoilV += (-260 * this.recoil - 26 * this.recoilV) * h;
      this.recoil += this.recoilV * h;
    }
    const rc = this.recoil * calm;
    // تمايل المشي
    this.bobAmt += ((s.moving ? 1 : 0) - this.bobAmt) * Math.min(1, dt * 8);
    if (s.moving) this.bob += dt * 10.5;
    const bobY = Math.sin(this.bob * 2) * 0.006 * this.bobAmt * calm, bobX = Math.cos(this.bob) * 0.007 * this.bobAmt * calm;
    // تنفّس خفيف وتأخّر بسيط عند تحريك النظر
    const breath = Math.sin(this.t * 1.5) * 0.0018 * calm;
    this.swayX += ((s.lookDX || 0) * -0.00035 - this.swayX) * Math.min(1, dt * 9);
    this.swayY += ((s.lookDY || 0) * 0.00035 - this.swayY) * Math.min(1, dt * 9);
    const sx = THREE.MathUtils.clamp(this.swayX, -0.02, 0.02) * calm, sy = THREE.MathUtils.clamp(this.swayY, -0.02, 0.02) * calm;
    this.root.position.set(this.base.pos.x + bobX + sx, this.base.pos.y + bobY + breath + sy - (s.lowered || 0) * 0.16, this.base.pos.z + rc * 0.016);
    this.root.rotation.set(this.base.rot.x + rc * 0.022 + breath * 1.5 + (s.lowered || 0) * 0.35, this.base.rot.y + sx * 1.2, this.base.rot.z + bobX * 0.8);
    // الوميض
    this.flashT = Math.max(0, this.flashT - dt);
    const fl = this.flashT > 0 ? 1 : 0;
    this.flashMat.opacity = fl * 0.95; this.flash.visible = fl > 0; this.flashLight.intensity = fl * 2.2;
    // اتجاه الشمس في فضاء الكاميرا
    const lit = s.sunlit ?? 1;
    this.sun.intensity = 2.6 * (0.12 + 0.88 * lit); this.fill.intensity = 0.45 + 0.2 * lit;
    if (s.cameraQuat) {
      this.sun.position.copy(SUN_DIR).applyQuaternion(_q.copy(s.cameraQuat).invert()).multiplyScalar(4);
      this.sun.target.position.set(0, 0, 0);
    }
  }
}
const _q = new THREE.Quaternion();

function flashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,250,225,1)'); grd.addColorStop(0.25, 'rgba(255,205,120,0.85)'); grd.addColorStop(0.6, 'rgba(255,140,40,0.25)'); grd.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,230,170,0.7)'; g.lineWidth = 5;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
