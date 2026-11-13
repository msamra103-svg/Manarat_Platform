import * as THREE from "three";
import { createRng } from "../core/random.mjs";
import { buildGrandstand } from "./grandstand.mjs";
import { PERSON_TYPES, THOBE_TINTS, buildPersonGeometry, buildArmGeometry, makePeopleMaterial, disposePeopleShared } from "./people.mjs";
function buildCrowd(scene, stands, { quality }) {
  const group = new THREE.Group();
  group.name = "crowd";
  scene.add(group);
  const rng = createRng(2024);
  const builtStands = [];
  const density = quality === "low" ? 0.28 : quality === "medium" ? 0.55 : 0.8;
  const people = [];
  const T = (key) => PERSON_TYPES.findIndex((t) => t.key === key);
  const STANDING = [[T("whiteBeard"), 0.3], [T("shemaghBeard"), 0.2], [T("whiteYoung"), 0.18], [T("shemaghYoung"), 0.14], [T("bishtElder"), 0.1], [T("bishtBrown"), 0.08]];
  const SEATED = [[T("seatedWhite"), 0.6], [T("seatedShemagh"), 0.4]];
  const pickW = (list) => {
    let r = rng.next() * list.reduce((a, e) => a + e[1], 0);
    for (const [v, w] of list) {
      r -= w;
      if (r <= 0) return v;
    }
    return list[0][0];
  };
  const pickType = (seatedAllowed) => seatedAllowed && rng.next() < 0.32 ? pickW(SEATED) : pickW(STANDING);
  const lodFor = (tier) => tier <= (quality === "high" ? 2 : quality === "medium" ? 1 : 0) ? 0 : 1;
  for (const st of stands) {
    const gs = buildGrandstand({ x0: st.x0, x1: st.x1, z0: st.z0, tiers: st.tiers || 6, quality });
    group.add(gs.group);
    builtStands.push(gs);
    for (const sp of gs.spots) {
      if (rng.next() > density) continue;
      const type = pickType(true);
      people.push(makePerson(type, sp.x + (rng.next() - 0.5) * 0.08, sp.y, sp.z, lodFor(sp.tier)));
    }
    for (let x = st.x0 + 0.5; x < st.x1; x += 0.55 + rng.next() * 0.9) {
      if (rng.next() > 0.75 * density) continue;
      const type = pickType(false);
      people.push(makePerson(type, x, 0, st.z0 - 1 - rng.next() * 1.6, 0));
    }
  }
  const mat = makePeopleMaterial();
  const meshes = [];
  PERSON_TYPES.forEach((type, ti) => {
    for (const lod of [0, 1]) {
      const list = people.filter((p) => p.type === ti && p.lod === lod);
      if (!list.length) continue;
      const body = new THREE.InstancedMesh(buildPersonGeometry(ti, lod), mat, list.length);
      const arms = new THREE.InstancedMesh(buildArmGeometry(ti, lod), mat, list.length * 2);
      for (const m of [body, arms]) {
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.frustumCulled = false;
        m.castShadow = false;
        m.receiveShadow = true;
        group.add(m);
      }
      const c = new THREE.Color();
      list.forEach((p, i) => {
        c.set(p.tint);
        body.setColorAt(i, c);
        arms.setColorAt(i * 2, c);
        arms.setColorAt(i * 2 + 1, c);
      });
      meshes.push({ type, list, body, arms, shoulderY: type.shoulderY, shoulderX: type.shoulderX });
    }
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0), xAxis = new THREE.Vector3(1, 0, 0), zAxis = new THREE.Vector3(0, 0, 1);
  const armQ = new THREE.Quaternion(), faceQ = new THREE.Quaternion(), tmpQ = new THREE.Quaternion();
  const off = new THREE.Vector3();
  let frame = 0;
  function update(t, packX, intensity = 1, reduced = false) {
    frame++;
    if (quality === "low" && frame % 2) return;
    for (const mm of meshes) {
      const seated = mm.type.seated;
      mm.list.forEach((p, i) => {
        const near = Math.max(0, 1 - Math.abs(packX - p.x) / 60);
        const ex = Math.min(1, p.base * p.enth + near * 0.95 * p.enth) * intensity;
        const e2 = Math.max(0, ex - 0.3) / 0.7;
        const bounce = reduced || seated ? 0 : Math.max(0, Math.sin(t * p.speed + p.phase)) * 0.06 * e2 * p.jumper;
        const s = p.scale;
        faceQ.setFromAxisAngle(yAxis, p.yaw + (packX - p.x) * 6e-3 * near + Math.sin(t * 0.25 + p.phase) * 0.12 * (1 - ex));
        P.set(p.x, p.y + bounce, p.z);
        S.set(s, s, s);
        mm.body.setMatrixAt(i, M.compose(P, faceQ, S));
        for (const side of [-1, 1]) {
          const lift = seated ? e2 * 0.75 : e2;
          let fwd = -0.18, spread = 0.07;
          if (reduced) {
            fwd = -0.18 - lift * 2.3;
            spread = 0.07 + lift * 0.3;
          } else if (p.style === 0) {
            fwd = -0.18 - lift * (2.45 + Math.sin(t * p.speed * 1.3 + p.phase + side) * 0.12);
            spread = 0.07 + lift * 0.42;
          } else if (p.style === 1) {
            if (side > 0) {
              fwd = -0.18 - lift * 2.5;
              spread = 0.07 + lift * (0.35 + Math.sin(t * p.speed * 2 + p.phase) * 0.28);
            } else {
              fwd = -0.18 - lift * 0.25;
              spread = 0.06;
            }
          } else if (p.style === 3) {
            const hold = Math.min(1, near * 2.5 + 0.25);
            if (side > 0) {
              fwd = -0.18 - hold * 1.35;
              spread = -0.05;
            } else {
              fwd = -0.2;
              spread = 0.05;
            }
          } else {
            fwd = -0.18 - lift * 1.2;
            spread = 0.07 - lift * (0.2 + Math.max(0, Math.sin(t * 9 + p.phase)) * 0.07);
          }
          armQ.copy(faceQ).multiply(Q.setFromAxisAngle(xAxis, fwd)).multiply(tmpQ.setFromAxisAngle(zAxis, side * spread));
          off.set(side * mm.shoulderX * s, mm.shoulderY * s + bounce, 0).applyQuaternion(faceQ);
          P.set(p.x + off.x, p.y + off.y, p.z + off.z);
          mm.arms.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), M.compose(P, armQ, S));
        }
      });
      mm.body.instanceMatrix.needsUpdate = true;
      mm.arms.instanceMatrix.needsUpdate = true;
    }
  }
  update(0, -1e3, 0.4);
  for (const mm of meshes) {
    for (const m of [mm.body, mm.arms]) {
      if (!m.count) continue;
      m.computeBoundingSphere();
      m.boundingSphere.radius += 2.5;
      m.frustumCulled = true;
    }
  }
  return {
    group,
    count: people.length,
    update,
    dispose() {
      builtStands.forEach((s) => s.dispose());
      meshes.forEach((m) => {
        m.body.geometry.dispose();
        m.arms.geometry.dispose();
        m.body.dispose();
        m.arms.dispose();
      });
      mat.dispose();
      disposePeopleShared();
      group.removeFromParent();
    }
  };
  function makePerson(type, x, y, z, lod) {
    let r = rng.next() * THOBE_TINTS.reduce((a, e) => a + e[1], 0);
    let tint = THOBE_TINTS[0][0];
    for (const [hexc, w] of THOBE_TINTS) {
      r -= w;
      if (r <= 0) {
        tint = hexc;
        break;
      }
    }
    return {
      type,
      x,
      y,
      z,
      lod,
      tint,
      yaw: Math.PI + (rng.next() - 0.5) * 0.5,
      // الأمام المحلي +Z؛ π يجعله يواجه المضمار (-Z)
      scale: 0.95 + rng.next() * 0.1,
      base: 0.08 + rng.next() * 0.35,
      speed: 4 + rng.next() * 4,
      phase: rng.next() * 6.28,
      jumper: rng.next() < 0.4 ? 1 : 0.3,
      // تفاوت الحماس: متحمسون يقفزون، ومصفقون معتدلون، وهادئون يراقبون أو يصوّرون بهواتفهم
      ...(() => {
        const r2 = rng.next();
        return r2 < 0.3 ? { enth: 1, style: Math.floor(rng.next() * 2) } : r2 < 0.68 ? { enth: 0.72, style: rng.next() < 0.6 ? 2 : 1 } : { enth: 0.3, style: rng.next() < 0.55 ? 3 : 2 };
      })()
    };
  }
}
export {
  buildCrowd
};
