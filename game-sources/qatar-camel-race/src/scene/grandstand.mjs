import * as THREE from "three";
import { QATAR_MAROON } from "./textures.mjs";
import { createRng } from "../core/random.mjs";
const texCache = /* @__PURE__ */ new Map();
function canvasTex(key, w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  if (!texCache.has(key)) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t2 = new THREE.CanvasTexture(c);
    t2.wrapS = t2.wrapT = THREE.RepeatWrapping;
    t2.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t2.anisotropy = 8;
    texCache.set(key, t2);
  }
  const t = texCache.get(key).clone();
  t.needsUpdate = true;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}
function stoneDraw(ctx, w, h) {
  const rng = createRng(77);
  ctx.fillStyle = "#e6dac4";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 3e3; i++) {
    const v = 200 + rng.next() * 40;
    ctx.fillStyle = `rgba(${v},${v - 12},${v - 30},0.25)`;
    ctx.fillRect(rng.next() * w, rng.next() * h, 2 + rng.next() * 3, 2 + rng.next() * 3);
  }
  ctx.strokeStyle = "rgba(120,100,75,0.45)";
  ctx.lineWidth = 2;
  const rowH = h / 4;
  for (let r = 0; r <= 4; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * rowH);
    ctx.lineTo(w, r * rowH);
    ctx.stroke();
    const off = r % 2 ? w / 4 : 0;
    for (let x = off; x < w; x += w / 2) {
      ctx.beginPath();
      ctx.moveTo(x, r * rowH);
      ctx.lineTo(x, (r + 1) * rowH);
      ctx.stroke();
    }
  }
}
function concreteDraw(ctx, w, h) {
  const rng = createRng(31);
  ctx.fillStyle = "#cfc8bb";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4e3; i++) {
    const v = 175 + rng.next() * 50;
    ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},0.3)`;
    ctx.fillRect(rng.next() * w, rng.next() * h, 1 + rng.next() * 2, 1 + rng.next() * 2);
  }
  ctx.fillStyle = "rgba(90,80,65,0.12)";
  for (let i = 0; i < 6; i++) ctx.fillRect(0, rng.next() * h, w, 1);
}
function mashrabiyaDraw(ctx, w, h) {
  ctx.fillStyle = "#e9dfcc";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#8f7556";
  ctx.lineWidth = 3;
  const s = w / 4;
  for (let y = s / 2; y < h; y += s) {
    for (let x = s / 2; x < w; x += s) {
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2;
        const r = k % 2 ? s * 0.22 : s * 0.42;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(60,40,25,0.55)";
      ctx.fill();
      ctx.stroke();
    }
  }
}
function glassDraw(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#4f6f80");
  g.addColorStop(0.6, "#2c4250");
  g.addColorStop(1, "#22323c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, h * 0.1, w, h * 0.15);
  ctx.fillStyle = "#d9d7d0";
  for (let x = 0; x <= w; x += w / 4) ctx.fillRect(x - 3, 0, 6, h);
  ctx.fillRect(0, 0, w, 6);
  ctx.fillRect(0, h * 0.62, w, 5);
  ctx.fillRect(0, h - 6, w, 6);
}
function buildGrandstand({ x0, x1, z0, tiers = 6, quality = "medium", rng = createRng(5) }) {
  const g = new THREE.Group();
  g.name = "grandstand";
  const len = x1 - x0, cx = (x0 + x1) / 2;
  const stepH = 0.42, stepD = 0.95;
  const depth = tiers * stepD;
  const podium = 1.1;
  const disposables = [];
  const keep = (o) => {
    disposables.push(o);
    return o;
  };
  const stoneMat = keep(new THREE.MeshStandardMaterial({ map: keep(canvasTex("stone", 512, 256, stoneDraw, { repeat: [len / 4, 1] })), roughness: 0.85 }));
  const concreteMat = keep(new THREE.MeshStandardMaterial({ map: keep(canvasTex("concrete", 256, 256, concreteDraw, { repeat: [len / 6, 1] })), roughness: 0.92 }));
  const maroonMat = keep(new THREE.MeshStandardMaterial({ color: QATAR_MAROON, roughness: 0.6 }));
  const steelMat = keep(new THREE.MeshStandardMaterial({ color: "#e8e8e4", metalness: 0.7, roughness: 0.32 }));
  const roofMat = keep(new THREE.MeshStandardMaterial({ color: "#f7f6f2", roughness: 0.55, side: THREE.DoubleSide, emissive: "#6d665c", emissiveIntensity: 0.55 }));
  const glassMat = keep(new THREE.MeshPhysicalMaterial({ map: keep(canvasTex("glass", 256, 128, glassDraw, { repeat: [len / 7, 1] })), roughness: 0.08, metalness: 0.2, clearcoat: 1, envMapIntensity: 2.5 }));
  const mashMat = keep(new THREE.MeshStandardMaterial({ map: keep(canvasTex("mash", 256, 256, mashrabiyaDraw, { repeat: [depth / 3, 2.2] })), roughness: 0.8 }));
  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const add = (mat, sx, sy, sz, x, y, z, cast = false) => {
    const m2 = new THREE.Mesh(box, mat);
    m2.scale.set(sx, sy, sz);
    m2.position.set(x, y, z);
    m2.castShadow = cast;
    m2.receiveShadow = true;
    g.add(m2);
    return m2;
  };
  add(stoneMat, len, podium, 0.4, cx, podium / 2, z0 + 0.2, true);
  add(maroonMat, len, 0.12, 0.42, cx, podium - 0.12, z0 + 0.2);
  const rail = add(steelMat, len, 0.05, 0.05, cx, podium + 0.95, z0 + 0.25);
  void rail;
  const glassRail = new THREE.Mesh(box, keep(new THREE.MeshPhysicalMaterial({ color: "#cfe3ea", transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false })));
  glassRail.scale.set(len, 0.9, 0.02);
  glassRail.position.set(cx, podium + 0.47, z0 + 0.25);
  g.add(glassRail);
  const spots = [];
  const aisleEvery = 13;
  for (let i = 0; i < tiers; i++) {
    const y = podium + stepH * i;
    const z = z0 + 0.4 + i * stepD;
    add(concreteMat, len, y + stepH, stepD, cx, (y + stepH) / 2, z + stepD / 2, i === tiers - 1);
    add(maroonMat, len, 0.03, 0.04, cx, y + stepH + 5e-3, z + 0.02);
    for (let x = x0 + 0.7; x < x1 - 0.5; x += 0.62) {
      const rel = (x - x0) % aisleEvery;
      if (rel < 1.2) continue;
      spots.push({ x, y: y + stepH, z: z + stepD * 0.55, tier: i });
    }
  }
  const stairMat = concreteMat;
  for (let ax = x0; ax < x1 - 1; ax += aisleEvery) {
    for (let i = 0; i < tiers * 2; i++) {
      add(stairMat, 1.1, 0.21, stepD / 2, ax + 0.6, podium + 0.105 + i * 0.21, z0 + 0.4 + (i + 0.5) * stepD / 2);
    }
  }
  const seatGeo = keep(makeSeatGeometry());
  const seatMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
  const seats = new THREE.InstancedMesh(seatGeo, seatMat, spots.length);
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    m.makeTranslation(s.x, s.y, s.z + 0.12);
    seats.setMatrixAt(i, m);
    seats.setColorAt(i, col.set((Math.floor(s.x / 6) + s.tier) % 5 === 0 ? "#f1efe9" : QATAR_MAROON));
  });
  seats.receiveShadow = true;
  g.add(seats);
  const topY = podium + stepH * tiers;
  const backZ = z0 + 0.4 + depth;
  const vipH = 3, vipD = 3.2;
  add(glassMat, len - 2, vipH, vipD, cx, topY + vipH / 2, backZ + vipD / 2);
  add(stoneMat, len, 0.5, vipD + 0.4, cx, topY + vipH + 0.25, backZ + vipD / 2, true);
  add(stoneMat, len, topY, vipD + 0.6, cx, topY / 2, backZ + vipD / 2);
  for (const x of [x0 - 0.25, x1 + 0.25]) {
    const wall = add(mashMat, 0.5, topY + vipH + 0.5, depth + vipD + 0.8, x, (topY + vipH + 0.5) / 2, z0 + (depth + vipD) / 2 + 0.2, true);
    void wall;
  }
  const roofY = topY + vipH + 1.6;
  const roofD = depth + vipD + 4.2;
  const roofGeo = keep(new THREE.PlaneGeometry(len + 3, roofD, 8, 10));
  const rp = roofGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const yy = rp.getY(i);
    const t = (yy + roofD / 2) / roofD;
    rp.setZ(i, Math.sin(t * Math.PI) * 0.35 + t * 1.1);
  }
  roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.x = -Math.PI / 2;
  roof.position.set(cx, roofY, z0 + (depth + vipD) / 2 - 1.9);
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);
  const frontEdgeZ = z0 + (depth + vipD) / 2 - 1.9 - roofD / 2;
  const fascia = add(maroonMat, len + 3, 0.45, 0.15, cx, roofY + 1.1, frontEdgeZ, true);
  void fascia;
  const colGeo = keep(new THREE.CylinderGeometry(0.16, 0.2, 1, 12));
  for (let x = x0; x <= x1 + 0.01; x += len / Math.max(2, Math.round(len / 12))) {
    const c = new THREE.Mesh(colGeo, steelMat);
    c.scale.y = roofY;
    c.position.set(x, roofY / 2, backZ + vipD + 0.3);
    c.castShadow = quality === "high";
    g.add(c);
    const armLen = roofD - 0.5;
    const arm = new THREE.Mesh(colGeo, steelMat);
    arm.scale.set(0.45, armLen, 0.45);
    arm.rotation.x = Math.PI / 2 + 0.08;
    arm.position.set(x, roofY + 0.45, backZ + vipD + 0.3 - armLen / 2);
    g.add(arm);
  }
  return {
    group: g,
    spots,
    frontZ: z0,
    dispose() {
      disposables.forEach((d) => d.dispose && d.dispose());
      seats.dispose();
      g.removeFromParent();
    }
  };
}
function makeSeatGeometry() {
  const parts = [];
  const pan = new THREE.BoxGeometry(0.46, 0.06, 0.4);
  pan.translate(0, 0.42, 0);
  const back = new THREE.BoxGeometry(0.46, 0.42, 0.05);
  back.rotateX(-0.12);
  back.translate(0, 0.66, 0.2);
  const leg = new THREE.BoxGeometry(0.05, 0.4, 0.3);
  leg.translate(0, 0.2, 0.02);
  for (const p of [pan, back, leg]) {
    const n = p.attributes.position.count;
    const c = new Float32Array(n * 3).fill(1);
    if (p === leg) for (let i = 0; i < c.length; i++) c[i] = 0.25;
    p.setAttribute("color", new THREE.BufferAttribute(c, 3));
    parts.push(p);
  }
  const pos = [], nrm = [], col = [], idx = [];
  let off = 0;
  for (const p of parts) {
    const a = p.attributes;
    for (let i = 0; i < a.position.count; i++) {
      pos.push(a.position.getX(i), a.position.getY(i), a.position.getZ(i));
      nrm.push(a.normal.getX(i), a.normal.getY(i), a.normal.getZ(i));
      col.push(a.color.getX(i), a.color.getY(i), a.color.getZ(i));
    }
    for (let i = 0; i < p.index.count; i++) idx.push(p.index.getX(i) + off);
    off += a.position.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
export {
  buildGrandstand
};
