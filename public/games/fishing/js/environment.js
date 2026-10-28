/* صيد الأسماك V24 — Gulf coastline scenery: beach, dunes, a generic modern skyline, mangroves,
 * distant traditional boats and channel buoys. All geometry is generated procedurally (no logos,
 * no replicas of specific landmarks).
 */
(function (root) {
  'use strict';
  const T = root.THREE, PH = root.FishingPhysics;
  function canvasTex(w, h, draw, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat); } return t; }

  /* merge static meshes that share a material into one draw call (keeps far scenery cheap) */
  function mergeStatic(group, keep = () => false) {
    group.updateMatrixWorld(true); const inv = group.matrixWorld.clone().invert(), buckets = new Map();
    group.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !keep(o)) { const k = o.material.uuid; if (!buckets.has(k)) buckets.set(k, { mat: o.material, list: [] }); buckets.get(k).list.push(o); } });
    let merged = 0;
    for (const { mat, list } of buckets.values()) {
      if (list.length < 2) continue; const pos = [], nor = [], uv = [];
      for (const m of list) { const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()); g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld)); if (!g.attributes.normal) g.computeVertexNormals();
        pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); const n = g.attributes.position.count; if (g.attributes.uv) uv.push(...g.attributes.uv.array); else for (let i = 0; i < n; i++) uv.push(0, 0); g.dispose(); m.parent.remove(m); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      const mesh = new T.Mesh(geo, mat); mesh.name = 'merged-' + (mat.name || 'static'); group.add(mesh); merged += list.length;
    }
    return merged;
  }
  function createCoast(quality) {
    const g = new T.Group(); g.name = 'coast'; const rand = PH.rng(2026);
    // beach + dunes: one displaced strip running across the horizon
    const W = 2200, D = 520, geo = new T.PlaneGeometry(W, D, quality === 'low' ? 120 : 220, 60); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -400 - D / 2);
    const p = geo.attributes.position, colors = [];
    const sandC = new T.Color('#e2c79a'), duneC = new T.Color('#d8b47c'), wetC = new T.Color('#a99472'), scrubC = new T.Color('#9a9465');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), inland = -(z + 410) + 18 * Math.sin(x * 0.006) + 10 * Math.sin(x * 0.017 + 1);
      let y = inland < 0 ? inland * 0.08 : Math.min(inland * 0.045, 1.4);
      if (inland > 25) y += (inland - 25) * 0.05 * (0.6 + 0.4 * Math.sin(x * 0.004));
      y += Math.max(0, inland - 30) * 0.0 + (inland > 30 ? (Math.sin(x * 0.011) * Math.cos(z * 0.02) * 0.5 + 0.5) * 16 * Math.min(1, (inland - 30) / 80) : 0);
      p.setY(i, y);
      const c = inland < 3 ? wetC.clone().lerp(sandC, Math.max(0, inland / 3)) : inland < 40 ? sandC.clone() : duneC.clone().lerp(scrubC, (Math.sin(x * 0.05) * 0.5 + 0.5) * 0.25);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const land = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 })); g.add(land);

    // generic skyline (left of the casting direction), hazy glass towers
    const glass = canvasTex(64, 256, (x, w, h) => { x.fillStyle = '#7e95a6'; x.fillRect(0, 0, w, h); for (let yy = 0; yy < h; yy += 6) for (let xx = 0; xx < w; xx += 8) { x.fillStyle = Math.random() < 0.12 ? '#e9d6a8' : (Math.random() < 0.5 ? '#6d8496' : '#91a8b8'); x.fillRect(xx + 1, yy + 1, 6, 4); } }, [1, 1]);
    const towerMat = new T.MeshStandardMaterial({ map: glass, roughness: 0.25, metalness: 0.55, color: '#c9d6de' }), stoneMat = new T.MeshStandardMaterial({ color: '#d8ccb5', roughness: 0.8 });
    for (let i = 0; i < 26; i++) {
      const x = -760 + i * 24 + rand() * 12, z = -940 - rand() * 140, h = 22 + rand() * 55 + (i % 7 === 3 ? 40 : 0), w = 12 + rand() * 16, kind = i % 5;
      let m;
      if (kind === 0) m = new T.Mesh(new T.CylinderGeometry(w * 0.45, w * 0.55, h, 18), towerMat);
      else if (kind === 1) { m = new T.Mesh(new T.CylinderGeometry(w * 0.15, w * 0.6, h, 4), towerMat); m.rotation.y = 0.78; }
      else if (kind === 2) m = new T.Mesh(new T.BoxGeometry(w, h, w * 0.8), stoneMat);
      else m = new T.Mesh(new T.BoxGeometry(w, h, w), towerMat);
      m.position.set(x, h / 2 + 1, z); g.add(m);
    }
    // mangrove / shrub clumps along the shore (right side)
    const shrub = new T.MeshStandardMaterial({ color: '#3f5a33', roughness: 0.9 }), blob = new T.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 70; i++) { const x = 60 + rand() * 700, z = -412 - rand() * 18, s = 3 + rand() * 6; const m = new T.Mesh(blob, shrub); m.position.set(x, s * 0.35, z); m.scale.set(s * 1.6, s * 0.7, s); g.add(m); }
    // palms near a beach pavilion
    const trunk = new T.MeshStandardMaterial({ color: '#7d6448', roughness: 0.9 }), frond = new T.MeshStandardMaterial({ color: '#4e6b37', roughness: 0.85, side: T.DoubleSide });
    for (let i = 0; i < 14; i++) { const x = -120 + i * 13 + rand() * 6, z = -440 - rand() * 20, h = 9 + rand() * 6; const tr = new T.Mesh(new T.CylinderGeometry(0.3, 0.45, h, 6), trunk); tr.position.set(x, h / 2, z); tr.rotation.z = (rand() - 0.5) * 0.2; g.add(tr); for (let k = 0; k < 7; k++) { const f = new T.Mesh(new T.PlaneGeometry(1.1, 5), frond); f.position.set(x, h, z); f.rotation.set(-1.0, k * 0.9, 0); f.translateY(2.2); g.add(f); } }
    mergeStatic(g, m => m === land);
    return g;
  }

  /* distant traditional wooden boats (generic dhow silhouettes) and channel buoys */
  function createSeaProps() {
    const g = new T.Group(); g.name = 'sea-props'; const props = [];
    const wood = new T.MeshStandardMaterial({ color: '#8a6440', roughness: 0.8 }), sail = new T.MeshStandardMaterial({ color: '#efe5d0', roughness: 0.9, side: T.DoubleSide });
    [[-160, -230, 0.6], [210, -300, -0.4], [60, -520, 1.2]].forEach(([x, z, yaw], i) => {
      const b = new T.Group(); const hull = new T.Mesh(new T.CylinderGeometry(1.4, 0.6, 11, 10, 1, false, 0, Math.PI), wood); hull.rotation.set(Math.PI / 2, 0, Math.PI / 2); hull.scale.set(1, 1, 0.9); hull.position.y = 0.6; b.add(hull);
      const mast = new T.Mesh(new T.CylinderGeometry(0.12, 0.15, 9, 6), wood); mast.position.set(0.6, 5, 0); mast.rotation.z = 0.12; b.add(mast);
      if (i !== 1) { const s = new T.Mesh(new T.ConeGeometry(3.6, 7.5, 3, 1, true), sail); s.scale.set(1, 1, 0.05); s.position.set(0.2, 5.2, 0); s.rotation.z = 0.35; b.add(s); }
      b.position.set(x, 0, z); b.rotation.y = yaw; g.add(b); props.push({ obj: b, x, z, yaw, k: 0.4 });
    });
    const red = new T.MeshStandardMaterial({ color: '#b8352a', roughness: 0.6 }), green = new T.MeshStandardMaterial({ color: '#2f7a46', roughness: 0.6 });
    [[-22, -34, red], [26, -40, green], [-60, -95, red], [70, -110, green]].forEach(([x, z, m]) => {
      const b = new T.Group(); const body = new T.Mesh(new T.CylinderGeometry(0.42, 0.55, 1.2, 14), m); body.position.y = 0.3; b.add(body); const top = new T.Mesh(new T.ConeGeometry(0.4, 0.8, 14), m); top.position.y = 1.3; b.add(top); b.position.set(x, 0, z); g.add(b); props.push({ obj: b, x, z, yaw: 0, k: 1 });
    });
    function update(t) { for (const p of props) { const h = PH.Sea.height(p.x, p.z, t), n = PH.Sea.normal(p.x, p.z, t); p.obj.position.y = h - 0.15; p.obj.rotation.set(n[2] * p.k * 0.8, p.yaw, -n[0] * p.k * 0.8); } }
    return { group: g, update };
  }

  root.FishingEnvironment = { createCoast, createSeaProps, canvasTex, mergeStatic };
})(window);
