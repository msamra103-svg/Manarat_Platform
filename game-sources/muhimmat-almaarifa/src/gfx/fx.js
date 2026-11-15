// مؤثرات الإطلاق والإصابة: خط طلقة قصير، شرر وغبار، أثر إصابة، ونبضة نجاح. بلا مشاهد دموية.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

function radialTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  stops.forEach(([o, col]) => grd.addColorStop(o, col));
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

class Particles {
  constructor(scene, n, material) {
    this.n = n; this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.cursor = 0;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, material); this.points.frustumCulled = false; scene.add(this.points);
    for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -999;
    this.gravity = 6; this.drag = 1.5;
  }
  emit(p, dir, count, speed, spread, life) {
    for (let k = 0; k < count; k++) {
      const i = this.cursor; this.cursor = (this.cursor + 1) % this.n;
      this.pos.set([p.x, p.y, p.z], i * 3);
      const v = new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread).add(dir).multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.vel.set([v.x, v.y, v.z], i * 3); this.life[i] = life * (0.6 + Math.random() * 0.4);
    }
  }
  update(dt) {
    let alive = false;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt; alive = true;
      const k = i * 3;
      if (this.life[i] <= 0) { this.pos[k + 1] = -999; continue; }
      const d = Math.max(0, 1 - this.drag * dt);
      this.vel[k] *= d; this.vel[k + 2] *= d; this.vel[k + 1] = this.vel[k + 1] * d - this.gravity * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
    }
    if (alive || this.dirty) this.points.geometry.attributes.position.needsUpdate = true;
    this.dirty = alive;
  }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    const tm = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const tg = new THREE.CylinderGeometry(0.011, 0.004, 1, 6, 1, true); tg.rotateX(Math.PI / 2);
    this.tracer = new THREE.Mesh(tg, tm); this.tracer.frustumCulled = false; this.tracer.visible = false; scene.add(this.tracer);
    this.tracerT = 0;
    this.sparks = new Particles(scene, 90, new THREE.PointsMaterial({ size: 0.05, map: radialTexture([[0, 'rgba(255,245,210,1)'], [0.4, 'rgba(255,190,90,0.8)'], [1, 'rgba(255,140,40,0)']]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.dust = new Particles(scene, 90, new THREE.PointsMaterial({ size: 0.34, map: radialTexture([[0, 'rgba(214,196,160,0.55)'], [0.6, 'rgba(210,192,156,0.22)'], [1, 'rgba(210,192,156,0)']]), transparent: true, depthWrite: false }));
    this.dust.gravity = 0.6; this.dust.drag = 2.6;
    const dtex = radialTexture([[0, 'rgba(12,10,8,0.95)'], [0.35, 'rgba(25,20,16,0.8)'], [0.7, 'rgba(60,50,40,0.25)'], [1, 'rgba(60,50,40,0)']]);
    this.decalMat = new THREE.MeshBasicMaterial({ map: dtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decalGeo = new THREE.PlaneGeometry(0.11, 0.11);
    this.decals = [];
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: 0x4dff88, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.ring.visible = false; scene.add(this.ring); this.ringT = 0;
  }

  shot(from, to) {
    const len = from.distanceTo(to);
    this.tracer.position.copy(from).lerp(to, 0.5); this.tracer.lookAt(to); this.tracer.scale.set(1, 1, len);
    this.tracer.visible = true; this.tracer.material.opacity = 0.75; this.tracerT = 0.07;
  }

  /** أثر الإصابة في موضع التصويب. kind: 'board' | 'wall'. parent اختياري ليلتصق الأثر بالهدف المتحرك. */
  impact(point, normal, kind, parent) {
    if (kind === 'board') this.sparks.emit(point, normal, 12, 3.2, 1.4, 0.3);
    else this.dust.emit(point, normal.clone().multiplyScalar(0.6), 9, 1.6, 1.0, 0.7);
    const d = new THREE.Mesh(this.decalGeo, this.decalMat);
    d.position.copy(point).addScaledVector(normal, 0.006);
    d.lookAt(point.clone().add(normal)); d.scale.setScalar(0.8 + Math.random() * 0.5); d.rotation.z = Math.random() * 6.28;
    this.scene.add(d); if (parent) parent.attach(d);
    d.userData.parent = parent || null;
    this.decals.push(d);
    if (this.decals.length > 30) { const old = this.decals.shift(); old.parent && old.parent.remove(old); }
  }

  clearDecals(parent) {
    this.decals = this.decals.filter(d => { if (!parent || d.userData.parent === parent) { d.parent && d.parent.remove(d); return false; } return true; });
  }

  successPulse(object) {
    object.getWorldPosition(this.ring.position); object.getWorldQuaternion(this.ring.quaternion);
    this.ring.translateZ(0.05); this.ring.visible = true; this.ringT = 0.0001;
  }

  update(dt) {
    if (this.tracerT > 0) { this.tracerT -= dt; this.tracer.material.opacity = Math.max(0, this.tracerT / 0.07) * 0.75; if (this.tracerT <= 0) this.tracer.visible = false; }
    this.sparks.update(dt); this.dust.update(dt);
    if (this.ringT > 0) {
      this.ringT += dt; const t = this.ringT / 0.6;
      this.ring.scale.setScalar(0.5 + t * 2.2); this.ring.material.opacity = Math.max(0, 0.85 * (1 - t));
      if (t >= 1) { this.ringT = 0; this.ring.visible = false; }
    }
  }
}

/** الشخصية الكاملة لشاشتَي البداية والنتيجة (حركة وقوف هادئة). */
export class Character {
  constructor(scene, assets) {
    this.ok = false;
    const gltf = assets.models.soldier; if (!gltf) return;
    this.root = cloneSkinned(gltf.scene);
    this.root.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); if (!/visor/i.test(o.name)) { o.material.metalness = 0.12; o.material.roughness = 0.62; } }
    });
    this.mixer = new THREE.AnimationMixer(this.root);
    const idle = gltf.animations.find(a => a.name === 'Idle') || gltf.animations[0];
    if (idle) this.mixer.clipAction(idle).play();
    this.root.visible = false; scene.add(this.root); this.ok = true;
  }
  show(x, z, facing) { if (!this.ok) return; this.root.position.set(x, 0, z); this.root.rotation.y = facing; this.root.visible = true; }
  hide() { if (this.ok) this.root.visible = false; }
  update(dt) { if (this.ok && this.root.visible) this.mixer.update(dt); }
}
