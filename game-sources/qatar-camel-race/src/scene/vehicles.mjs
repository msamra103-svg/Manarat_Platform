import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mergeStaticChildren } from "../core/merge.mjs";
const ROAD = { z: 27.5, halfWidth: 4.2 };
function buildRoadAndVehicles(scene, { x0, x1, count, quality }) {
  const group = new THREE.Group();
  group.name = "roadVehicles";
  scene.add(group);
  const keep = [];
  const k = (o) => {
    keep.push(o);
    return o;
  };
  const asphalt = document.createElement("canvas");
  asphalt.width = 256;
  asphalt.height = 256;
  const ctx = asphalt.getContext("2d");
  ctx.fillStyle = "#5b5852";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5e3; i++) {
    const v = 70 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  const tex = k(new THREE.CanvasTexture(asphalt));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set((x1 - x0) / 8, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  const road = new THREE.Mesh(k(new THREE.PlaneGeometry(x1 - x0, ROAD.halfWidth * 2)), k(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 })));
  road.rotation.x = -Math.PI / 2;
  road.position.set((x0 + x1) / 2, 6e-3, ROAD.z);
  road.receiveShadow = true;
  group.add(road);
  const lineMat = k(new THREE.MeshBasicMaterial({ color: "#e9e6dc" }));
  for (const s of [1, -1]) {
    const edge = new THREE.Mesh(k(new THREE.PlaneGeometry(x1 - x0, 0.15)), lineMat);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set((x0 + x1) / 2, 0.01, ROAD.z + s * (ROAD.halfWidth - 0.3));
    group.add(edge);
  }
  const dashGeo = k(new THREE.PlaneGeometry(3, 0.14));
  const dashes = new THREE.InstancedMesh(dashGeo, lineMat, Math.ceil((x1 - x0) / 9));
  const m = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  for (let i = 0; i < dashes.count; i++) {
    m.setPosition(x0 + i * 9, 0.011, ROAD.z);
    dashes.setMatrixAt(i, m);
  }
  group.add(dashes);
  const curbMat = k(new THREE.MeshStandardMaterial({ color: "#d9d2c3", roughness: 0.9 }));
  const curb = new THREE.Mesh(k(new THREE.BoxGeometry(x1 - x0, 0.3, 0.25)), curbMat);
  curb.position.set((x0 + x1) / 2, 0.15, ROAD.z - ROAD.halfWidth - 0.3);
  group.add(curb);
  const colors = ["#f4f4f2", "#f0efe9", "#c9ccd0", "#1f2124", "#e8dcc5", "#ffffff", "#8c8f93"];
  const bodyGeo = k(new RoundedBoxGeometry(4.9, 1, 1.95, 3, 0.18));
  const cabGeo = k(new RoundedBoxGeometry(3, 0.82, 1.8, 3, 0.16));
  const glassMat = k(new THREE.MeshStandardMaterial({ color: "#1d2a33", roughness: 0.15, metalness: 0.6 }));
  const colorize = (g, hex) => {
    const c = new THREE.Color(hex);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = c.r;
      arr[i + 1] = c.g;
      arr[i + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const tireGeo0 = colorize(new THREE.CylinderGeometry(0.42, 0.42, 0.3, quality === "low" ? 10 : 16), "#1a1a1a");
  const rimGeo0 = colorize(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 10), "#c8c8c8");
  const tireGeo = k(mergeGeometries([tireGeo0, rimGeo0]));
  tireGeo0.dispose();
  rimGeo0.dispose();
  tireGeo.rotateX(Math.PI / 2);
  const tireMat = k(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }));
  const lightMat = k(new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff6d0", emissiveIntensity: 0.6 }));
  const tailMat = k(new THREE.MeshStandardMaterial({ color: "#7a0b0b", emissive: "#550000", emissiveIntensity: 0.4 }));
  const cars = [];
  for (let i = 0; i < count; i++) {
    const car = new THREE.Group();
    const bodyMat = k(new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.35, metalness: 0.45 }));
    const chassis = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.95;
    body.castShadow = true;
    const cab = new THREE.Mesh(cabGeo, bodyMat);
    cab.position.set(-0.35, 1.78, 0);
    cab.castShadow = true;
    const glass = new THREE.Mesh(k(new THREE.BoxGeometry(2.7, 0.55, 1.84)), glassMat);
    glass.position.set(-0.3, 1.8, 0);
    const wind = new THREE.Mesh(k(new THREE.BoxGeometry(0.08, 0.6, 1.6)), glassMat);
    wind.position.set(1.18, 1.78, 0);
    wind.rotation.z = 0.5;
    chassis.add(body, cab, glass, wind);
    for (const z of [-0.65, 0.65]) {
      const hl = new THREE.Mesh(k(new THREE.BoxGeometry(0.05, 0.16, 0.36)), lightMat);
      hl.position.set(2.46, 1.08, z);
      const tl = new THREE.Mesh(k(new THREE.BoxGeometry(0.05, 0.22, 0.2)), tailMat);
      tl.position.set(-2.46, 1.1, z * 1.2);
      chassis.add(hl, tl);
    }
    mergeStaticChildren(chassis, { castShadow: true });
    car.add(chassis);
    const wheels = [];
    for (const x of [1.55, -1.5]) {
      for (const z of [-0.92, 0.92]) {
        const w = new THREE.Group();
        const wm = new THREE.Mesh(tireGeo, tireMat);
        wm.castShadow = quality === "high";
        w.add(wm);
        w.position.set(x, 0.42, z);
        car.add(w);
        wheels.push(w);
      }
    }
    car.position.set(-30 - i * 9, 0, ROAD.z + (i % 2 ? 1.8 : -1.8));
    group.add(car);
    cars.push({ car, chassis, wheels, x: car.position.x, v: 0, lane: i % 2 ? 1.8 : -1.8, phase: i * 1.3 });
  }
  return {
    group,
    // targets: المواضع المستهدفة لكل سيارة (تتبع هجينًا معينًا)، frozen: أثناء السؤال
    update(dt, targets, frozen, t) {
      if (frozen) return;
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        const target = targets[i] ?? c.x;
        const desired = (target - c.x) * 1.4;
        const accel = Math.max(-6, Math.min(4, desired - c.v));
        c.v = Math.max(0, c.v + accel * dt);
      }
      for (const lane of [-1.8, 1.8]) {
        const inLane = cars.filter((c) => c.lane === lane).sort((a, b) => b.x - a.x);
        for (let j = 1; j < inLane.length; j++) {
          const ahead = inLane[j - 1], me = inLane[j];
          const gap = ahead.x + ahead.v * dt - (me.x + me.v * dt);
          if (gap < 8) me.v = Math.min(me.v, ahead.v * 0.9);
        }
      }
      for (const c of cars) {
        c.x += c.v * dt;
        c.car.position.x = c.x;
        c.car.position.z = ROAD.z + c.lane;
        const rot = c.v * dt / 0.42;
        for (const w of c.wheels) w.rotation.z -= rot;
        c.chassis.position.y = Math.sin(t * 9 + c.phase) * 0.012 * Math.min(1, c.v / 8);
        c.chassis.rotation.z = Math.sin(t * 6 + c.phase) * 4e-3 * Math.min(1, c.v / 8);
      }
    },
    reset() {
      cars.forEach((c, i) => {
        c.x = -30 - i * 9;
        c.v = 0;
        c.car.position.x = c.x;
      });
    },
    dispose() {
      keep.forEach((o) => o.dispose && o.dispose());
      group.removeFromParent();
    }
  };
}
export {
  ROAD,
  buildRoadAndVehicles
};
