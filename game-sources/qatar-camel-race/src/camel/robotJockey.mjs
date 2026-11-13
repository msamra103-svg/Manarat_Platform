import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeSilkTexture } from "../scene/textures.mjs";
import { mergeStaticChildren } from "../core/merge.mjs";
function buildRobotJockey({ color, trim }) {
  const root = new THREE.Group();
  root.name = "robotJockey";
  const silk = makeSilkTexture(color, trim);
  const mats = {
    leather: new THREE.MeshStandardMaterial({ color: 3875862, roughness: 0.7 }),
    pad: new THREE.MeshStandardMaterial({ color: trim, roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: 12172996, roughness: 0.35, metalness: 0.8 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 2829875, roughness: 0.5, metalness: 0.6 }),
    silk: new THREE.MeshStandardMaterial({ map: silk, roughness: 0.55 }),
    cap: new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: 1118481, roughness: 0.6 }),
    led: new THREE.MeshStandardMaterial({ color: 2293606, emissive: 2293606, emissiveIntensity: 1.5 })
  };
  const saddleGeo = new RoundedBoxGeometry(0.38, 0.045, 0.36, 3, 0.02);
  const sp = saddleGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const z = sp.getZ(i);
    sp.setY(i, sp.getY(i) - 2.2 * z * z);
  }
  saddleGeo.computeVertexNormals();
  const saddle = new THREE.Mesh(saddleGeo, mats.leather);
  root.add(saddle);
  const padGeo = new RoundedBoxGeometry(0.44, 0.02, 0.4, 2, 8e-3);
  const pp = padGeo.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const z = pp.getZ(i);
    pp.setY(i, pp.getY(i) - 2.4 * z * z);
  }
  padGeo.computeVertexNormals();
  const pad = new THREE.Mesh(padGeo, mats.pad);
  pad.position.y = -0.025;
  root.add(pad);
  for (const s of [1, -1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.012), mats.leather);
    strap.position.set(0.02, -0.16, s * 0.215);
    strap.rotation.x = s * 0.35;
    root.add(strap);
  }
  const rider = new THREE.Group();
  rider.name = "riderBody";
  rider.position.y = 0.03;
  root.add(rider);
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.04, 0.14, 2, 0.01), mats.darkMetal);
  base.position.y = 0.02;
  rider.add(base);
  for (const x of [-0.05, 0.05]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(8e-3, 8e-3, 0.08, 6), mats.metal);
    post.position.set(x, 0.07, 0);
    rider.add(post);
  }
  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.22, 0.19, 3, 0.035), mats.silk);
  torso.position.y = 0.21;
  torso.rotation.z = -0.12;
  rider.add(torso);
  for (const s of [1, -1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.11, 4, 8), mats.silk);
    arm.position.set(0.03, 0.2, s * 0.115);
    arm.rotation.set(s * 0.15, 0, 0.9);
    rider.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mats.black);
    hand.position.set(0.1, 0.15, s * 0.12);
    rider.add(hand);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), mats.darkMetal);
  head.position.set(0.02, 0.37, 0);
  rider.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.cap);
  cap.position.set(0.02, 0.375, 0);
  rider.add(cap);
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 8e-3, 12, 1, false, -Math.PI / 2, Math.PI), mats.cap);
  visor.position.set(0.05, 0.37, 0);
  rider.add(visor);
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.09, 0.1, 2, 0.01), mats.black);
  box.position.set(-0.1, 0.17, 0);
  rider.add(box);
  const led = new THREE.Mesh(new THREE.SphereGeometry(8e-3, 6, 4), mats.led);
  led.position.set(-0.136, 0.2, 0.03);
  rider.add(led);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(3e-3, 4e-3, 0.32, 5), mats.black);
  antenna.position.set(-0.11, 0.37, -0.03);
  antenna.rotation.z = 0.25;
  rider.add(antenna);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(9e-3, 6, 4), mats.black);
  antTip.position.set(-0.15, 0.53, -0.03);
  rider.add(antTip);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), mats.darkMetal);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0, 0.25, 0.13);
  rider.add(motor);
  const whipPivot = new THREE.Group();
  whipPivot.position.set(0, 0.25, 0.16);
  rider.add(whipPivot);
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(35e-4, 6e-3, 0.55, 5), mats.black);
  whip.position.y = 0.27;
  whipPivot.add(whip);
  const whipTip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 4e-3), mats.black);
  whipTip.position.y = 0.56;
  whipPivot.add(whipTip);
  whipPivot.rotation.z = 0.6;
  mergeStaticChildren(whipPivot);
  mergeStaticChildren(rider, { keep: [whipPivot] });
  mergeStaticChildren(root, { keep: [rider] });
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
    }
  });
  const state = { pitch: 0, pitchVel: 0, y: 0, yVel: 0, whip: 0.6, t: 0 };
  return {
    root,
    update(dt, { bodyPitchVel = 0, bob = 0, speed = 0, boost = 0, frozen = false }) {
      state.t += dt;
      if (!frozen) {
        const vib = Math.sin(state.t * 31) * 4e-3 * Math.min(1, speed / 8);
        const k = 260, c = 18;
        const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
        for (let i = 0; i < n; i++) {
          state.pitchVel += (k * (bodyPitchVel * -0.012 - state.pitch) - c * state.pitchVel) * h;
          state.pitch += state.pitchVel * h;
          state.yVel += (k * (-bob * 0.15 - state.y) - c * state.yVel) * h;
          state.y += state.yVel * h;
        }
        state.pitch = Math.max(-0.3, Math.min(0.3, state.pitch));
        state.y = Math.max(-0.05, Math.min(0.05, state.y));
        rider.rotation.z = state.pitch;
        rider.position.y = 0.03 + state.y + vib;
        const rate = speed > 1 ? 2.2 + boost * 6 : 0;
        state.whip += rate * dt;
        whipPivot.rotation.z = 0.6 + Math.sin(state.whip) * 0.9;
      }
      mats.led.emissiveIntensity = Math.sin(state.t * 6) > 0 ? 1.8 : 0.3;
    },
    dispose() {
      root.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      Object.values(mats).forEach((m) => m.dispose());
      silk.dispose();
    }
  };
}
export {
  buildRobotJockey
};
