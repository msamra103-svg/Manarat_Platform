import * as THREE from "three";
import { makeTwoSided } from "../core/merge.mjs";
import { getSandMaps, addMacroVariation, makeTextBanner, getFootprintTexture, QATAR_MAROON, bleedTransparent } from "./textures.mjs";
const NEAR_POLE_Z = 18.5;
const TRACK = {
  halfWidth: 12.5,
  railZ: 12.8,
  runOff: 180,
  startRunUp: 70
};
function buildTrack(scene, { finishX, quality, length: totalLen = 1400 }) {
  const group = new THREE.Group();
  group.name = "track";
  scene.add(group);
  const disposables = [];
  const keep = (o) => {
    disposables.push(o);
    return o;
  };
  const x0 = -TRACK.startRunUp, x1 = totalLen;
  const length = x1 - x0;
  const sand = getSandMaps("track");
  const map = keep(sand.map.clone());
  map.needsUpdate = true;
  map.repeat.set(length / 9, (TRACK.halfWidth * 2 + 6) / 9);
  const nrm = keep(sand.normalMap.clone());
  nrm.needsUpdate = true;
  nrm.repeat.copy(map.repeat);
  const trackMat = addMacroVariation(keep(new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(1.25, 1.25), roughness: 0.96, color: "#fbf0df" })), 0.9);
  const surf = new THREE.Mesh(keep(new THREE.PlaneGeometry(length, TRACK.halfWidth * 2 + 6)), trackMat);
  surf.rotation.x = -Math.PI / 2;
  surf.position.set((x0 + x1) / 2, 0, 0);
  surf.receiveShadow = true;
  surf.name = "trackSurface";
  group.add(surf);
  const railMat = keep(new THREE.MeshStandardMaterial({ color: "#f4f4f2", roughness: 0.45, metalness: 0.3 }));
  const postGeo = keep(new THREE.CylinderGeometry(0.05, 0.05, 1.25, 8));
  const spacing = quality === "low" ? 6 : 4;
  const nPosts = Math.ceil(length / spacing) + 1;
  const posts = new THREE.InstancedMesh(postGeo, railMat, nPosts * 2);
  const m = new THREE.Matrix4();
  let k = 0;
  for (const s of [1, -1]) {
    for (let i = 0; i < nPosts; i++) {
      m.makeTranslation(x0 + i * spacing, 0.62, s * TRACK.railZ);
      posts.setMatrixAt(k++, m);
    }
  }
  posts.castShadow = quality === "high";
  group.add(posts);
  const railGeo = keep(new THREE.BoxGeometry(length, 0.09, 0.06));
  for (const s of [1, -1]) {
    for (const y of [0.62, 1.2]) {
      const r = new THREE.Mesh(railGeo, railMat);
      r.position.set((x0 + x1) / 2, y, s * TRACK.railZ);
      r.castShadow = quality === "high";
      group.add(r);
    }
  }
  const stripeMat = keep(new THREE.MeshStandardMaterial({ color: QATAR_MAROON, roughness: 0.6 }));
  const stripe = new THREE.Mesh(keep(new THREE.BoxGeometry(length, 0.22, 0.03)), stripeMat);
  stripe.position.set((x0 + x1) / 2, 0.91, TRACK.railZ + 0.04);
  group.add(stripe);
  const stripeNear = stripe.clone();
  stripeNear.position.z = -TRACK.railZ - 0.04;
  group.add(stripeNear);
  const lineMat = keep(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }));
  const lineGeo = keep(new THREE.PlaneGeometry(0.45, TRACK.halfWidth * 2));
  const startLine = new THREE.Mesh(lineGeo, lineMat);
  startLine.rotation.x = -Math.PI / 2;
  startLine.position.set(0, 0.012, 0);
  group.add(startLine);
  const chk = document.createElement("canvas");
  chk.width = 64;
  chk.height = 512;
  const cctx = chk.getContext("2d");
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 2; j++) {
      cctx.fillStyle = (i + j) % 2 ? QATAR_MAROON : "#ffffff";
      cctx.fillRect(j * 32, i * 32, 32, 32);
    }
  }
  const chkTex = keep(new THREE.CanvasTexture(chk));
  chkTex.colorSpace = THREE.SRGBColorSpace;
  const finishLine = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, TRACK.halfWidth * 2)), keep(new THREE.MeshStandardMaterial({ map: chkTex, roughness: 0.8 })));
  finishLine.rotation.x = -Math.PI / 2;
  finishLine.position.set(0, 0.013, 0);
  const finishGroup = new THREE.Group();
  finishGroup.name = "finish";
  finishGroup.position.x = finishX;
  finishGroup.add(finishLine);
  group.add(finishGroup);
  const gantry = (x, text, color) => {
    const g = new THREE.Group();
    const poleMat = keep(new THREE.MeshStandardMaterial({ color: "#d9d9d6", metalness: 0.6, roughness: 0.35 }));
    const poleGeo = keep(new THREE.CylinderGeometry(0.16, 0.2, 7.2, 12));
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(0, 3.6, s > 0 ? TRACK.railZ + 0.6 : -NEAR_POLE_Z);
      p.castShadow = true;
      g.add(p);
    }
    const beamLen = TRACK.railZ + 0.6 + NEAR_POLE_Z;
    const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 0.5, beamLen)), poleMat);
    beam.position.set(0, 7, (TRACK.railZ + 0.6 - NEAR_POLE_Z) / 2);
    g.add(beam);
    const tex = keep(makeTextBanner(text, { bg: color, w: 2048, h: 256, font: '800 170px "QCR Cairo", Arial' }));
    const bannerMat = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    const banner = new THREE.Mesh(keep(new THREE.PlaneGeometry(TRACK.railZ * 2 - 2, 1.6)), bannerMat);
    banner.position.set(0, 6, 0);
    banner.rotation.y = -Math.PI / 2;
    g.add(banner);
    const banner2 = banner.clone();
    banner2.rotation.y = Math.PI / 2;
    banner2.position.x = 0.02;
    g.add(banner2);
    const sideTex = keep(makeTextBanner(text, { bg: color, w: 1024, h: 300, font: '800 150px "QCR Cairo", Arial' }));
    const farSign = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.6, 1.05)), keep(new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.6 })));
    farSign.position.set(-0.4, 5, TRACK.railZ - 0.3);
    farSign.rotation.y = Math.PI;
    g.add(farSign);
    g.position.x = x;
    group.add(g);
    return g;
  };
  gantry(0, "خط الانطلاق", "#5b0f25");
  const finishGantry = gantry(0, "خط النهاية", QATAR_MAROON);
  finishGroup.add(finishGantry);
  const finPostMat = keep(new THREE.MeshStandardMaterial({ color: QATAR_MAROON, roughness: 0.5 }));
  for (const s of [1, -1]) {
    const fp = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10)), finPostMat);
    fp.position.set(0, 1.3, s * (TRACK.railZ - 0.3));
    finishGroup.add(fp);
  }
  const boardGeo = keep(new THREE.PlaneGeometry(2.2, 1));
  for (let d = 100; d < totalLen - 100; d += 100) {
    const tex = keep(makeTextBanner(`${toArabicDigits(d)} م`, { bg: "#ffffff", fg: QATAR_MAROON, w: 512, h: 232, font: '800 150px "QCR Cairo", Arial' }));
    const b = new THREE.Mesh(boardGeo, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })));
    b.position.set(d, 2, TRACK.railZ + 0.5);
    b.rotation.y = Math.PI;
    group.add(b);
    const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6)), railMat);
    pole.position.set(d, 0.8, TRACK.railZ + 0.52);
    group.add(pole);
  }
  const stageMarkers = [];
  const stageGroup = new THREE.Group();
  group.add(stageGroup);
  const markerPoleGeo = keep(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8));
  const markerPoleMat = keep(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }));
  const getStageMarker = (index) => {
    if (stageMarkers[index]) return stageMarkers[index];
    const g = new THREE.Group();
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(markerPoleGeo, markerPoleMat);
      p.position.set(0, 1.7, s * (TRACK.railZ - 0.4));
      g.add(p);
      if (s < 0) continue;
      const tex = keep(makeTextBanner(`المرحلة ${toArabicDigits(index + 1)}`, { bg: QATAR_MAROON, w: 512, h: 200, font: '800 110px "QCR Cairo", Arial' }));
      const sign = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.7, 0.66)), keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide })));
      sign.position.set(0, 3, s * (TRACK.railZ - 0.4) + s * 0.05);
      sign.rotation.y = s > 0 ? Math.PI : 0;
      g.add(sign);
    }
    const strip = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.25, TRACK.halfWidth * 2)), keep(new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false })));
    strip.rotation.x = -Math.PI / 2;
    strip.position.y = 0.011;
    g.add(strip);
    g.visible = false;
    stageGroup.add(g);
    stageMarkers[index] = g;
    return g;
  };
  const maxPrints = quality === "low" ? 300 : 900;
  const printTex = getFootprintTexture();
  const printMat = keep(new THREE.MeshBasicMaterial({ map: printTex, transparent: true, depthWrite: false, opacity: 0.85 }));
  const prints = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(0.27, 0.23)), printMat, maxPrints);
  prints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  prints.frustumCulled = false;
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < maxPrints; i++) prints.setMatrixAt(i, hidden);
  prints.renderOrder = 2;
  group.add(prints);
  let printIdx = 0;
  const pq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const pm = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const bermMat = addMacroVariation(keep(new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(1.2, 1.2), color: "#fdf3e2", roughness: 1 })), 0.9);
  for (const s of [1, -1]) {
    const bg = keep(new THREE.PlaneGeometry(length, 2.6, 1, 12));
    const bp = bg.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const t = (bp.getY(i) + 1.3) / 2.6;
      const prof = s > 0 ? t : 1 - t;
      bp.setZ(i, 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, prof * 1.15)), 1.4) * prof);
    }
    {
      const uvb = bg.attributes.uv;
      for (let i = 0; i < uvb.count; i++) uvb.setY(i, uvb.getY(i) * (2.6 / (TRACK.halfWidth * 2 + 6)));
    }
    bg.computeVertexNormals();
    const berm = new THREE.Mesh(bg, bermMat);
    berm.rotation.x = -Math.PI / 2;
    berm.position.set((x0 + x1) / 2, 3e-3, s * (TRACK.railZ - 1.35));
    berm.receiveShadow = true;
    group.add(berm);
  }
  const lineC = document.createElement("canvas");
  lineC.width = 8;
  lineC.height = 256;
  const lc = lineC.getContext("2d");
  const lg = lc.createLinearGradient(0, 0, 0, 256);
  lg.addColorStop(0, "rgba(0,0,0,0)");
  lg.addColorStop(0.2, "rgba(0,0,0,0.75)");
  lg.addColorStop(0.8, "rgba(0,0,0,0.75)");
  lg.addColorStop(1, "rgba(0,0,0,0)");
  lc.fillStyle = lg;
  lc.fillRect(0, 0, 8, 256);
  const lineTex = keep(new THREE.CanvasTexture(lineC));
  const raceLineMat = keep(new THREE.MeshStandardMaterial({ color: "#7d5c38", transparent: true, opacity: 0.22, alphaMap: lineTex, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
  const racingLine = new THREE.Mesh(keep(new THREE.PlaneGeometry(length, 17)), raceLineMat);
  racingLine.rotation.x = -Math.PI / 2;
  racingLine.position.set((x0 + x1) / 2, 4e-3, 0);
  racingLine.receiveShadow = true;
  racingLine.renderOrder = 1;
  group.add(racingLine);
  const pebbleGeo = keep(new THREE.DodecahedronGeometry(0.06, 0));
  const pebbleMat = keep(new THREE.MeshStandardMaterial({ color: "#a88c68", roughness: 0.95 }));
  const grassGeo = keep(makeTwoSided(makeGrassTuft()));
  const grassMat = keep(new THREE.MeshStandardMaterial({ map: keep(makeGrassTexture()), alphaTest: 0.35, roughness: 1 }));
  const nPeb = quality === "low" ? 500 : 1800, nGrass = quality === "low" ? 150 : 600;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, nPeb);
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, nGrass);
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), ss = new THREE.Vector3(), pp = new THREE.Vector3();
  let seedV = 12345;
  const rnd = () => {
    seedV = seedV * 16807 % 2147483647;
    return seedV / 2147483647;
  };
  const marginZ = () => rnd() < 0.6 ? -(TRACK.railZ + 0.6 + rnd() * 9) : TRACK.railZ + 0.6 + rnd() * 2.2;
  for (let i = 0; i < nPeb; i++) {
    pp.set(x0 + rnd() * length, 0.01, marginZ());
    qq.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
    const sc = 0.4 + rnd() * 1.4;
    ss.set(sc, sc * 0.6, sc);
    pebbles.setMatrixAt(i, mm.compose(pp, qq, ss));
  }
  for (let i = 0; i < nGrass; i++) {
    pp.set(x0 + rnd() * length, 0, marginZ());
    qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    const sc = 0.5 + rnd() * 0.9;
    ss.set(sc, sc * (0.7 + rnd() * 0.6), sc);
    grass.setMatrixAt(i, mm.compose(pp, qq, ss));
  }
  pebbles.receiveShadow = true;
  group.add(pebbles, grass);
  return {
    group,
    get finishX() {
      return finishGroup.position.x;
    },
    setFinishX(x) {
      finishGroup.position.x = x;
    },
    showStageMarker(index, x) {
      const g = getStageMarker(index);
      g.position.x = x;
      g.visible = true;
    },
    hideStageMarkers() {
      stageMarkers.forEach((g) => {
        if (g) g.visible = false;
      });
    },
    addFootprint(x, z, scale = 1) {
      pm.compose(new THREE.Vector3(x, 9e-3, z), pq, one.clone().multiplyScalar(scale));
      prints.setMatrixAt(printIdx, pm);
      printIdx = (printIdx + 1) % maxPrints;
      prints.instanceMatrix.needsUpdate = true;
    },
    clearFootprints() {
      for (let i = 0; i < maxPrints; i++) prints.setMatrixAt(i, hidden);
      prints.instanceMatrix.needsUpdate = true;
      printIdx = 0;
    },
    dispose() {
      disposables.forEach((d) => d.dispose && d.dispose());
      group.removeFromParent();
    }
  };
}
function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
}
function makeGrassTuft() {
  const planes = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(0.5, 0.35);
    g.translate(0, 0.17, 0);
    g.rotateY(i / 3 * Math.PI);
    planes.push(g.toNonIndexed());
  }
  const pos = [], uv = [], nrm = [];
  for (const g of planes) {
    pos.push(...g.attributes.position.array);
    uv.push(...g.attributes.uv.array);
    for (let i = 0; i < g.attributes.position.count; i++) nrm.push(0, 1, 0);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}
function makeGrassTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 128, 96);
  for (let i = 0; i < 60; i++) {
    const x = 20 + Math.random() * 88;
    ctx.strokeStyle = Math.random() < 0.5 ? "#a99260" : "#8d7a4a";
    ctx.lineWidth = 1.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(64 + (x - 64) * 0.3, 96);
    ctx.quadraticCurveTo(x, 60, x + (Math.random() - 0.5) * 30, 10 + Math.random() * 40);
    ctx.stroke();
  }
  bleedTransparent(c, "#a08a5a");
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export {
  TRACK,
  buildTrack,
  toArabicDigits
};
