/* Target Shooting 3D — pooled visual effects (no allocation per frame after start).
 * Shapes: shard (clay / balloon rubber), spark (celebration, bird tag), dust (impact), confetti.
 * Each shape is one InstancedMesh with a fixed pool; particles are integrated with exact damping and are
 * removed (scale 0) when their life ends. Rings are a small pool of billboard meshes.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util;
  const SHAPES = {
    shard: { n: 420, geo: () => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-1, 0, -0.6, 1, 0, -0.4, 0.2, 0, 1, -1, 0.25, -0.6, 1, 0.25, -0.4, 0.2, 0.25, 1], 3)); g.setIndex([0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]); g.computeVertexNormals(); return g; }, mat: () => new T.MeshStandardMaterial({ roughness: 0.6, metalness: 0, side: T.DoubleSide }) },
    rubber: { n: 300, geo: () => { const g = new T.PlaneGeometry(1, 0.7, 2, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 2) * 0.25); g.computeVertexNormals(); return g; }, mat: () => new T.MeshStandardMaterial({ roughness: 0.35, metalness: 0, side: T.DoubleSide }) },
    spark: { n: 500, geo: () => new T.OctahedronGeometry(1, 0), mat: () => new T.MeshBasicMaterial({ toneMapped: false }) },
    dust: { n: 260, geo: () => new T.IcosahedronGeometry(1, 0), mat: () => new T.MeshStandardMaterial({ roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }) },
    confetti: { n: 500, geo: () => new T.PlaneGeometry(1, 0.55), mat: () => new T.MeshStandardMaterial({ roughness: 0.6, side: T.DoubleSide }) }
  };

  function create(scene) {
    const pools = {};
    for (const [k, s] of Object.entries(SHAPES)) {
      const mesh = new T.InstancedMesh(s.geo(), s.mat(), s.n);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.castShadow = k === 'shard' || k === 'rubber';
      const col = new T.Color(1, 1, 1); for (let i = 0; i < s.n; i++) mesh.setColorAt(i, col);
      mesh.count = s.n;
      const Z = new T.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < s.n; i++) mesh.setMatrixAt(i, Z);
      scene.add(mesh);
      pools[k] = { mesh, parts: Array.from({ length: s.n }, () => ({ life: 0, max: 1, p: new T.Vector3(), v: new T.Vector3(), q: new T.Quaternion(), w: new T.Vector3(), size: 0.01, grav: 9.81, drag: 0.5, shrink: true })), next: 0, dirty: false };
    }
    const rings = [];
    const ringGeo = new T.RingGeometry(0.82, 1, 48);
    for (let i = 0; i < 8; i++) {
      const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
      m.visible = false; scene.add(m); rings.push({ m, t: 0, d: 1, s0: 0.2, s1: 1, follow: null });
    }
    const M = new T.Matrix4(), S = new T.Vector3(), Q = new T.Quaternion(), C = new T.Color();
    const fx = {
      burst(kind, pos, o = {}) {
        const pool = pools[kind]; if (!pool) return;
        const n = Math.min(o.count || 20, pool.parts.length);
        const rnd = o.rng || Math.random;
        for (let i = 0; i < n; i++) {
          const idx = pool.next; pool.next = (pool.next + 1) % pool.parts.length;
          const p = pool.parts[idx];
          p.life = p.max = (o.life || 1) * (0.7 + 0.6 * rnd());
          p.p.copy(pos);
          if (o.spread) p.p.add(new T.Vector3((rnd() - 0.5) * o.spread, (rnd() - 0.5) * o.spread, (rnd() - 0.5) * o.spread));
          const dir = new T.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
          if (o.dir) dir.multiplyScalar(o.cone ?? 0.6).add(o.dir).normalize();
          p.v.copy(dir).multiplyScalar((o.speed || 3) * (0.4 + 0.8 * rnd()));
          if (o.vel) p.v.add(o.vel);
          p.q.setFromEuler(new T.Euler(rnd() * 6, rnd() * 6, rnd() * 6));
          p.w.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(o.spin ?? 18);
          p.size = (o.size || 0.02) * (0.6 + 0.8 * rnd()); p.grav = o.gravity ?? 9.81; p.drag = o.drag ?? 0.6; p.shrink = o.shrink !== false;
          const cs = o.colors || [o.color || 0xffffff];
          pool.mesh.setColorAt(idx, C.set(cs[Math.floor(rnd() * cs.length) % cs.length]).convertSRGBToLinear());
        }
        pool.mesh.instanceColor.needsUpdate = true;
      },
      ring(pos, { color = 0xffd34d, size = 1, time = 0.7, follow = null } = {}) {
        const r = rings.find(x => !x.m.visible) || rings[0];
        r.m.visible = true; r.m.material.color.set(color).convertSRGBToLinear(); r.t = 0; r.d = time; r.s0 = 0.15 * size; r.s1 = size; r.follow = follow; r.m.position.copy(pos);
      },
      update(dt, camera) {
        for (const pool of Object.values(pools)) {
          let any = false;
          pool.parts.forEach((p, i) => {
            if (p.life <= 0) return;
            any = true;
            p.life -= dt;
            if (p.life <= 0) { pool.mesh.setMatrixAt(i, M.makeScale(0, 0, 0)); return; }
            const k = Math.exp(-p.drag * dt);
            p.v.multiplyScalar(k); p.v.y -= p.grav * dt; p.p.addScaledVector(p.v, dt);
            if (p.p.y < 0.01 && p.grav > 0) { p.p.y = 0.01; p.v.multiplyScalar(0.3); p.v.y = Math.abs(p.v.y) * 0.2; p.w.multiplyScalar(0.5); }
            const wl = p.w.length(); if (wl > 0) p.q.multiply(Q.setFromAxisAngle(S.copy(p.w).multiplyScalar(1 / wl), wl * dt));
            const f = p.shrink ? Math.min(1, p.life / Math.min(0.35, p.max)) : 1;
            M.compose(p.p, p.q, S.setScalar(p.size * f));
            pool.mesh.setMatrixAt(i, M);
          });
          if (any || pool.dirty) { pool.mesh.instanceMatrix.needsUpdate = true; pool.dirty = any; }
        }
        for (const r of rings) {
          if (!r.m.visible) continue;
          r.t += dt; const k = r.t / r.d;
          if (k >= 1) { r.m.visible = false; continue; }
          if (r.follow) r.m.position.copy(r.follow);
          r.m.scale.setScalar(U.lerp(r.s0, r.s1, U.smooth(k)));
          r.m.material.opacity = 0.9 * (1 - k);
          if (camera) r.m.quaternion.copy(camera.quaternion);
        }
      },
      clear() { for (const pool of Object.values(pools)) { pool.parts.forEach((p, i) => { p.life = 0; pool.mesh.setMatrixAt(i, M.makeScale(0, 0, 0)); }); pool.mesh.instanceMatrix.needsUpdate = true; } rings.forEach(r => { r.m.visible = false; }); },
      active() { let n = 0; for (const pool of Object.values(pools)) n += pool.parts.filter(p => p.life > 0).length; return n; },
      dispose() { for (const pool of Object.values(pools)) { scene.remove(pool.mesh); pool.mesh.geometry.dispose(); pool.mesh.material.dispose(); } rings.forEach(r => { scene.remove(r.m); r.m.material.dispose(); }); ringGeo.dispose(); }
    };
    return fx;
  }
  TS.FX = { create };
})(typeof window !== 'undefined' ? window : globalThis);
