import * as THREE from "three";
import { buildCamel } from "./camelBuilder.mjs";
import { instantiateCamel } from "./camelGLB.mjs";
import { CamelAnimator, FOOT_SOLE } from "./camelAnimator.mjs";
import { buildRobotJockey } from "./robotJockey.mjs";
import { getContactShadowTexture } from "../scene/textures.mjs";
class Camel {
  constructor({ id, number, coat, clothColor, trimColor, isPlayer = false, seed = 1, quality = "high", template = null, referenceCoat = null }) {
    this.id = id;
    this.number = number;
    this.isPlayer = isPlayer;
    const cloth = { color: clothColor, trim: trimColor, number, isPlayer };
    this.rig = template ? instantiateCamel(template, { coat, cloth, referenceCoat }) : buildCamel({ coat, cloth, quality });
    this.object = this.rig.group;
    this.object.userData.camelId = id;
    this.animator = new CamelAnimator(this.rig, { seed, variation: seed * 7919 % 200 / 100 - 1 });
    this.jockey = buildRobotJockey({ color: clothColor, trim: trimColor });
    const spine = this.rig.bones.spine;
    this.jockey.root.position.set(-0.53, this.rig.saddleY ?? 0.255, 0);
    this.jockey.root.rotation.z = 0.02;
    spine.add(this.jockey.root);
    const shTex = getContactShadowTexture();
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.55 });
    const bodyShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), this.shadowMat);
    bodyShadow.rotation.x = -Math.PI / 2;
    bodyShadow.position.set(0.15, 0.012, 0);
    bodyShadow.renderOrder = 1;
    this.object.add(bodyShadow);
    this.footShadows = {};
    const fsGeo = new THREE.PlaneGeometry(0.34, 0.3);
    this.footShadowMat = new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.8 });
    for (const legId of ["FL", "FR", "HL", "HR"]) {
      const m = new THREE.Mesh(fsGeo, this.footShadowMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 1;
      this.object.add(m);
      this.footShadows[legId] = m;
    }
    this.lateralVel = 0;
  }
  setPosition(x, z, yaw = 0) {
    this.object.position.set(x, 0, z);
    this.object.rotation.y = yaw;
  }
  update(dt, { speed, distanceDelta, frozen, boost = 0, lateralVel = 0 }) {
    this.animator.update(dt, { speed, distanceDelta, frozen, boost, lateralVel });
    this.jockey.update(dt, {
      bodyPitchVel: this.animator.pitchVel,
      bob: this.animator.bob,
      speed: frozen ? 0 : speed,
      boost,
      frozen
    });
    for (const legId in this.footShadows) {
      const f = this.animator.legState[legId].foot;
      const s = this.footShadows[legId];
      const h = Math.max(0, f.y - FOOT_SOLE);
      s.position.set(f.x + 0.02, 0.014, f.z);
      const k = Math.max(0.15, 1 - h * 2.2);
      s.scale.setScalar(0.8 + (1 - k) * 0.6);
      s.material.opacity = 0.75 * k;
    }
    return this.animator.footEvents;
  }
  setShadowCasting(on) {
    this.object.traverse((o) => {
      if (o.isMesh && o.material !== this.shadowMat && !Object.values(this.footShadows).includes(o)) o.castShadow = on;
    });
  }
  dispose() {
    this.rig.dispose();
    this.jockey.dispose();
    this.shadowMat.dispose();
    this.footShadowMat.dispose();
    for (const k in this.footShadows) {
      this.footShadows[k].material.dispose();
    }
    this.object.removeFromParent();
  }
}
export {
  Camel
};
