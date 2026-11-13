import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createRng } from "../core/random.mjs";
import { bleedTransparent } from "./textures.mjs";
import { makeTwoSided } from "../core/merge.mjs";
function canvas(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function facadeTexture(base, seed) {
  return canvas(512, 512, (ctx, w, h) => {
    const rng = createRng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9e3; i++) {
      const a = rng.next() * 0.12;
      ctx.fillStyle = rng.next() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(90,70,45,${a})`;
      ctx.fillRect(rng.next() * w, rng.next() * h, 2 + rng.next() * 4, 2 + rng.next() * 4);
    }
    const grad = ctx.createLinearGradient(0, h * 0.75, 0, h);
    grad.addColorStop(0, "rgba(120,95,60,0)");
    grad.addColorStop(1, "rgba(120,95,60,0.25)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.75, w, h * 0.25);
    ctx.fillStyle = "rgba(150,120,85,0.55)";
    ctx.fillRect(0, h * 0.5 - 6, w, 12);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(0, h * 0.5 + 6, w, 3);
    for (const row of [0.08, 0.58]) {
      for (const col of [0.18, 0.62]) {
        const x = col * w, y = row * h, ww = w * 0.2, hh = h * 0.32;
        ctx.fillStyle = "#efe7d6";
        archPath(ctx, x - 8, y - 8, ww + 16, hh + 12);
        ctx.fill();
        const g = ctx.createLinearGradient(0, y, 0, y + hh);
        g.addColorStop(0, "#3b5463");
        g.addColorStop(1, "#1d2a31");
        ctx.fillStyle = g;
        archPath(ctx, x, y, ww, hh);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x + ww * 0.1, y + hh * 0.35, ww * 0.25, hh * 0.5);
        ctx.strokeStyle = "#6d5236";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + ww / 2, y + ww * 0.45);
        ctx.lineTo(x + ww / 2, y + hh);
        ctx.moveTo(x, y + hh * 0.62);
        ctx.lineTo(x + ww, y + hh * 0.62);
        ctx.stroke();
      }
    }
  });
}
function archPath(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y - r * 0.2);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
function towerTexture() {
  return canvas(256, 512, (ctx, w, h) => {
    ctx.fillStyle = "#e4d6bb";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(110,85,55,0.12)";
    for (let i = 0; i < 2500; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    ctx.fillStyle = "#2b2219";
    for (let i = 0; i < 3; i++) ctx.fillRect(w * (0.18 + i * 0.25), h * 0.06, w * 0.12, h * 0.42);
    ctx.fillStyle = "rgba(140,110,75,0.6)";
    ctx.fillRect(0, h * 0.52, w, 10);
  });
}
function corrugatedTexture() {
  return canvas(128, 128, (ctx, w, h) => {
    for (let x = 0; x < w; x += 8) {
      const g = ctx.createLinearGradient(x, 0, x + 8, 0);
      g.addColorStop(0, "#a9adaf");
      g.addColorStop(0.5, "#e3e5e6");
      g.addColorStop(1, "#9aa0a3");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 8, h);
    }
  });
}
function frondTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 128, 512);
  for (let y = 16; y < 505; y += 5) {
    const len = 60 * Math.sin(y / 512 * Math.PI * 0.95 + 0.1) + 4;
    for (const s of [-1, 1]) {
      ctx.fillStyle = y / 5 % 3 === 0 ? "#556a26" : y / 5 % 3 === 1 ? "#6c8132" : "#7c8c3c";
      ctx.beginPath();
      ctx.moveTo(64, y);
      ctx.lineTo(64 + s * len, y - 26);
      ctx.lineTo(64 + s * len * 0.92, y - 20);
      ctx.lineTo(64, y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.strokeStyle = "#8a8445";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(64, 512);
  ctx.lineTo(64, 0);
  ctx.stroke();
  bleedTransparent(c, "#62772e");
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function barkTexture() {
  return canvas(64, 256, (ctx, w, h) => {
    ctx.fillStyle = "#7a6448";
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10) {
      ctx.fillStyle = "#5a4733";
      ctx.fillRect(0, y, w, 4);
      ctx.fillStyle = "rgba(160,135,100,0.4)";
      for (let x = 0; x < w; x += 8) ctx.fillRect(x, y + 4, 5, 3);
    }
  });
}
function worldBox(w, h, d, tile = 6) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const su = ax > 0.5 ? d : w;
    const sv = ay > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * su / tile, uv.getY(i) * sv / tile);
  }
  return g;
}
function buildBuildings(scene, { trackLength, quality }) {
  const group = new THREE.Group();
  group.name = "buildings";
  scene.add(group);
  const rng = createRng(909);
  const keep = [];
  const k = (o) => {
    keep.push(o);
    return o;
  };
  const facadeMats = [
    k(new THREE.MeshStandardMaterial({ map: k(facadeTexture("#e8dcc4", 1)), roughness: 0.9 })),
    k(new THREE.MeshStandardMaterial({ map: k(facadeTexture("#d8c4a1", 2)), roughness: 0.9 })),
    k(new THREE.MeshStandardMaterial({ map: k(facadeTexture("#efe7d8", 3)), roughness: 0.9 }))
  ];
  const trimMat = k(new THREE.MeshStandardMaterial({ color: "#efe6d3", roughness: 0.85 }));
  const towerMat = k(new THREE.MeshStandardMaterial({ map: k(towerTexture()), roughness: 0.9 }));
  const metalMat = k(new THREE.MeshStandardMaterial({ map: k(corrugatedTexture()), roughness: 0.4, metalness: 0.6 }));
  const steelMat = k(new THREE.MeshStandardMaterial({ color: "#cfd2d4", metalness: 0.7, roughness: 0.35 }));
  const geos = /* @__PURE__ */ new Map();
  const push = (mat, g) => {
    if (!geos.has(mat)) geos.set(mat, []);
    geos.get(mat).push(g);
  };
  const addBuilding = (x, z, w, h, d, mat) => {
    const b = worldBox(w, h, d);
    b.translate(x, h / 2, z);
    push(mat, b);
    const cornice = worldBox(w + 0.4, 0.35, d + 0.4);
    cornice.translate(x, h + 0.17, z);
    push(trimMat, cornice);
    const step = 1.1;
    for (const [len, axis, off] of [[w, "x", d / 2], [w, "x", -d / 2], [d, "z", w / 2], [d, "z", -w / 2]]) {
      for (let t = -len / 2 + 0.5; t < len / 2 - 0.3; t += step) {
        const m2 = new THREE.BoxGeometry(0.45, 0.65, 0.25);
        m2.translate(0, 0.32, 0);
        const tip = new THREE.ConeGeometry(0.22, 0.3, 4);
        tip.rotateY(Math.PI / 4);
        tip.translate(0, 0.8, 0);
        const merged = mergeGeometries([m2.toNonIndexed(), tip.toNonIndexed()]);
        m2.dispose();
        tip.dispose();
        if (axis === "z") merged.rotateY(Math.PI / 2);
        merged.translate(axis === "x" ? x + t : x + off, h + 0.35, axis === "x" ? z + off : z + t);
        push(trimMat, merged.index ? merged.toNonIndexed() : merged);
      }
    }
    if (rng.next() < 0.45) {
      const tw = 2.4, th = 5 + rng.next() * 3;
      const tg = worldBox(tw, th, tw, 3);
      tg.translate(x + (rng.next() - 0.5) * (w - tw), h + th / 2, z + (rng.next() - 0.5) * (d - tw));
      push(towerMat, tg);
    }
  };
  const side = (zMin, zMax, count) => {
    for (let i = 0; i < count; i++) {
      const x = -200 + rng.next() * (trackLength + 450);
      const z = zMin + rng.next() * (zMax - zMin);
      const w = 10 + rng.next() * 22, d = 8 + rng.next() * 14, h = rng.next() < 0.6 ? 6.5 : 10;
      addBuilding(x, z, w, h, d, facadeMats[i % 3]);
    }
  };
  side(48, 75, quality === "low" ? 10 : 18);
  side(110, 190, quality === "low" ? 10 : 22);
  side(-190, -95, quality === "low" ? 6 : 14);
  for (let i = 0; i < (quality === "low" ? 4 : 8); i++) {
    const x = 60 + rng.next() * (trackLength - 100), z = -60 - rng.next() * 30;
    const len = 30 + rng.next() * 20;
    const roof = worldBox(len, 0.12, 9, 4);
    roof.rotateX(0.06);
    roof.translate(x, 4.2, z);
    push(metalMat, roof);
    for (let t = -len / 2; t <= len / 2; t += 5) {
      for (const dz of [-4, 4]) {
        const post = new THREE.CylinderGeometry(0.1, 0.1, 4.2, 6);
        post.translate(x + t, 2.1, z + dz);
        push(steelMat, post.toNonIndexed());
      }
    }
    const wall = worldBox(len, 1.4, 0.3);
    wall.translate(x, 0.7, z + 4);
    push(facadeMats[0], wall);
  }
  for (const [mat, list] of geos) {
    const norm = list.map((g) => {
      const gg = g.index ? g.toNonIndexed() : g;
      for (const a of Object.keys(gg.attributes)) if (!["position", "normal", "uv"].includes(a)) gg.deleteAttribute(a);
      return gg;
    });
    const merged = mergeGeometries(norm, false);
    norm.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
    keep.push(merged);
  }
  const poleGeo = k(new THREE.CylinderGeometry(0.22, 0.35, 26, 8));
  const headGeo = k(new THREE.BoxGeometry(3.2, 1.6, 0.4));
  const lampMat = k(new THREE.MeshStandardMaterial({ color: "#f4f2ea", emissive: "#fff7dc", emissiveIntensity: 0.35, roughness: 0.4 }));
  const nPoles = Math.ceil((trackLength + 100) / 130);
  const poles = new THREE.InstancedMesh(poleGeo, steelMat, nPoles);
  const heads = new THREE.InstancedMesh(headGeo, lampMat, nPoles);
  const m = new THREE.Matrix4();
  for (let i = 0; i < nPoles; i++) {
    const x = -40 + i * 130;
    m.makeTranslation(x, 13, 36);
    poles.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 26.5, 35.6), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.35), new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, m);
  }
  group.add(poles, heads);
  const nPalms = quality === "low" ? 30 : 70;
  const trunkGeo = k(new THREE.CylinderGeometry(0.22, 0.32, 1, 8, 4));
  trunkGeo.translate(0, 0.5, 0);
  const barkMat = k(new THREE.MeshStandardMaterial({ map: k(barkTexture()), roughness: 1 }));
  const frondMat = k(new THREE.MeshStandardMaterial({ map: k(frondTexture()), alphaTest: 0.3, roughness: 0.85 }));
  const crownGeo = k(makeTwoSided(makeCrown()));
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, nPalms);
  const crowns = new THREE.InstancedMesh(crownGeo, frondMat, nPalms);
  const tmpQ = new THREE.Quaternion();
  for (let i = 0; i < nPalms; i++) {
    const nearRoad = i < nPalms * 0.45;
    const x = -150 + rng.next() * (trackLength + 350);
    const z = nearRoad ? 33 + rng.next() * 6 : rng.next() < 0.7 ? 45 + rng.next() * 140 : -70 - rng.next() * 120;
    const h = 6 + rng.next() * 6;
    m.compose(new THREE.Vector3(x, 0, z), tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (rng.next() - 0.5) * 0.08), new THREE.Vector3(1, h, 1));
    trunks.setMatrixAt(i, m);
    const s = 0.9 + rng.next() * 0.3;
    m.compose(new THREE.Vector3(x, h, z), tmpQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.next() * 6.28), new THREE.Vector3(s, s, s));
    crowns.setMatrixAt(i, m);
  }
  trunks.castShadow = crowns.castShadow = quality === "high";
  group.add(trunks, crowns);
  const tower = new THREE.Group();
  const tb = new THREE.Mesh(k(worldBox(5, 22, 5, 3)), towerMat);
  tb.position.y = 11;
  const tTop = new THREE.Mesh(k(new THREE.CylinderGeometry(5.2, 4.2, 3.4, 16)), k(new THREE.MeshPhysicalMaterial({ color: "#40606f", roughness: 0.08, metalness: 0.3, clearcoat: 1, envMapIntensity: 2 })));
  tTop.position.y = 23.7;
  const tCap = new THREE.Mesh(k(new THREE.CylinderGeometry(5.6, 5.6, 0.5, 16)), trimMat);
  tCap.position.y = 25.6;
  tower.add(tb, tTop, tCap);
  tower.position.set(trackLength * 0.42, 0, 78);
  group.add(tower);
  return {
    group,
    dispose() {
      keep.forEach((o) => o.dispose && o.dispose());
      poles.dispose();
      heads.dispose();
      trunks.dispose();
      crowns.dispose();
      group.removeFromParent();
    }
  };
}
function makeCrown() {
  const fronds = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(1.2, 4.2, 1, 8);
    g.translate(0, 2.1, 0);
    const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const y = p.getY(j);
      const t = y / 4.2;
      p.setZ(j, -t * t * 1.9 * (1 + i % 3 * 0.2));
    }
    const up = i < 4 ? 0.4 : i < 9 ? 1.05 : 1.45;
    g.rotateX(-Math.PI / 2 + up);
    g.rotateY(i / n * Math.PI * 2 + i % 2 * 0.2);
    fronds.push(g);
  }
  const merged = mergeGeometries(fronds, false);
  fronds.forEach((f) => f.dispose());
  merged.computeVertexNormals();
  return merged;
}
export {
  buildBuildings
};
