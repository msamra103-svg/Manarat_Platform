import * as THREE from 'three';
import { buildHorse } from './horseBuilder.js';
import { HorseAnimator, FOOT_SOLE } from './horseAnimator.js';
import { buildJockey } from './jockey.js';
import { getContactShadowTexture } from '../scene/textures.js';

// كيان حصان واحد في المشهد: النموذج + الحركة + الفارس + العنان + ظلال التماس.
export class Horse {
  constructor({ id, number, coat, clothColor, trimColor, isPlayer = false, seed = 1, quality = 'high' }) {
    this.id = id;
    this.number = number;
    this.isPlayer = isPlayer;
    const cloth = { color: clothColor, trim: trimColor, number, isPlayer };
    this.rig = buildHorse({ coat, cloth, quality, socksSeed: seed });
    this.object = this.rig.group;
    this.object.userData.horseId = id;
    this.animator = new HorseAnimator(this.rig, { seed, variation: ((seed * 7919) % 200) / 100 - 1 });
    this.jockey = buildJockey({ color: clothColor, trim: trimColor, quality, seed });
    this.rig.bones.spine.add(this.jockey.root);

    // العنان: سيران جلديان من يدي الفارس إلى حلقتي الشكيمة (يُحدَّثان كل إطار)
    this.reinMat = new THREE.LineBasicMaterial({ color: 0x2a1a10 });
    this.reinGeo = new THREE.BufferGeometry();
    this.reinGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 2 * 5 * 3), 3));
    this.reins = new THREE.LineSegments(this.reinGeo, this.reinMat);
    this.reins.frustumCulled = false;
    this.object.add(this.reins);

    const shTex = getContactShadowTexture();
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.5 });
    this.bodyShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.0), this.shadowMat);
    this.bodyShadow.rotation.x = -Math.PI / 2;
    this.bodyShadow.position.set(0.0, 0.012, 0);
    this.bodyShadow.renderOrder = 1;
    this.object.add(this.bodyShadow);
    this.footShadows = {};
    const fsGeo = new THREE.PlaneGeometry(0.26, 0.24);
    this.footShadowMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.8 });
    for (const legId of ['FL', 'FR', 'HL', 'HR']) {
      const m = new THREE.Mesh(fsGeo, this.footShadowMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 1;
      this.object.add(m);
      this.footShadows[legId] = m;
    }
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._inv = new THREE.Matrix4();
  }

  setPosition(x, z, yaw = 0) {
    this.object.position.set(x, 0, z);
    this.object.rotation.y = yaw;
  }

  // jump: تقدّم القفزة (null خارجها)
  update(dt, { speed, distanceDelta, frozen, boost = 0, lateralVel = 0, jump = null }) {
    this.animator.update(dt, { speed, distanceDelta, frozen, boost, lateralVel, jump });
    this.jockey.update(dt, { bodyPitchVel: this.animator.pitchVel, speed: frozen ? 0 : speed, frozen, jumpLean: this.animator.jumpLean || 0, phase: this.animator.phase });
    const air = jump !== null ? Math.sin(Math.PI * Math.min(1, Math.max(0, jump))) : 0;
    this.shadowMat.opacity = 0.5 * (1 - air * 0.6);
    this.bodyShadow.scale.setScalar(1 + air * 0.35);
    for (const legId in this.footShadows) {
      const f = this.animator.legState[legId].foot;
      const s = this.footShadows[legId];
      const h = Math.max(0, f.y - FOOT_SOLE);
      s.position.set(f.x + 0.02, 0.014, f.z);
      const k = Math.max(0, 1 - h * 2.2);
      s.scale.setScalar(0.8 + (1 - k) * 0.6);
      s.material.opacity = 0.75 * k;
    }
    this._updateReins();
    return this.animator.footEvents;
  }

  _updateReins() {
    const head = this.rig.bones.head, spine = this.rig.bones.spine;
    this.object.updateMatrixWorld(true);
    this._inv.copy(this.object.matrixWorld).invert();
    const arr = this.reinGeo.attributes.position.array;
    let o = 0;
    for (const side of [1, -1]) {
      const bit = this._a.copy(this.rig.bitLocal); bit.z *= side;
      bit.applyMatrix4(head.matrixWorld).applyMatrix4(this._inv);
      const hand = this.jockey.handLocal(side, this._b).applyMatrix4(this.jockey.root.matrixWorld).applyMatrix4(this._inv);
      void spine;
      // منحنى متدلٍّ قليلًا بخمس قطع
      let px = hand.x, py = hand.y, pz = hand.z;
      for (let i = 1; i <= 5; i++) {
        const t = i / 5;
        const x = hand.x + (bit.x - hand.x) * t, y = hand.y + (bit.y - hand.y) * t - 0.05 * Math.sin(Math.PI * t), z = hand.z + (bit.z - hand.z) * t + side * 0.035 * Math.sin(Math.PI * t);
        arr[o++] = px; arr[o++] = py; arr[o++] = pz; arr[o++] = x; arr[o++] = y; arr[o++] = z;
        px = x; py = y; pz = z;
      }
    }
    this.reinGeo.attributes.position.needsUpdate = true;
  }

  setShadowCasting(on) {
    const skip = new Set([this.bodyShadow, this.reins, ...Object.values(this.footShadows)]);
    this.object.traverse((o) => { if (o.isMesh && !skip.has(o)) o.castShadow = on; });
  }

  dispose() {
    this.rig.dispose();
    this.jockey.dispose();
    this.shadowMat.dispose();
    this.footShadowMat.dispose();
    this.reinGeo.dispose(); this.reinMat.dispose();
    for (const k in this.footShadows) { this.footShadows[k].material.dispose(); }
    this.object.removeFromParent();
  }
}
