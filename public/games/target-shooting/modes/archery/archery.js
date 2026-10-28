/* Mode 1 — رماية الأسهم (archery range).
 * World Archery-style range: shooting line, mowed lanes, distance markers, straw bosses on A-frame stands with
 * 10-ring faces (tilted back 10°), an earth berm and safety net behind the targets, a shaded training area.
 * Beginner: one large 122 cm face at 12 m, stationary.  Intermediate: 80 cm faces at ~22 m, one on a sliding
 * rail.  Advanced: up to three faces at 25–45 m, two moving.  Score = World Archery ring value (1–10).
 * Arrows embed in the boss at the exact contact point and stay attached to the moving target.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util, B = TS.World.B, TG = TS.Targets, PH = TS.Physics;

  const PALETTE = {
    skyTop: '#3b78c9', skyHorizon: '#d4e6f4', skyBottom: '#7f8c62', haze: 1, fog: '#cfdde6', fogNear: 70, fogFar: 650,
    hemiSky: '#dbe8ff', hemiGround: '#6a6b45', hemiI: 0.62, sun: '#fff0d8', sunI: 2.25, sunAz: 38, sunEl: 44, exposure: 1.0,
    grass: { base: '#5f8435', blades: [[96, 136, 54], [74, 112, 40], [126, 156, 70], [88, 120, 46]], patch: ['rgba(130,160,70,.22)', 'rgba(56,86,30,.22)', 'rgba(150,150,80,.12)'] },
    leaf: '#4e7a36', pine: '#35573a'
  };

  function create(ctx) {
    const { cfg, diff, world } = ctx;
    const mode = new TG.Mode(ctx);
    const g = mode.group; const mats = TG.commonMats(cfg.accent); mode.mats = mats;
    const rnd = U.rng(1101);
    const tier = world.tier;
    // ---------------------------------------------------------- landscape
    B.ground(g, PALETTE, { repeat: 160, seed: 21, aniso: tier.anisotropy });
    B.mountains(g, { radius: 640, height: 110, seed: 4, colorA: 0x6c7c72, colorB: 0xa9b8bb });
    const far = 64;
    for (let i = -3; i <= 3; i++) B.strip(g, { x: i * 4.2, z: -far / 2, w: 3.4, l: far, color: i % 2 ? 0x7ea548 : 0x6a9440, opacity: 0.32 });
    B.strip(g, { x: 0, z: -0.42, w: 30, l: 0.08, color: 0xffffff, opacity: 0.95 });       // shooting line
    B.strip(g, { x: 0, z: 4.2, w: 30, l: 0.06, color: 0xffffff, opacity: 0.8 });          // waiting line
    // distance markers
    for (const m of [10, 20, 30, 40, 50]) {
      const post = new T.Mesh(new T.BoxGeometry(0.08, 0.9, 0.08), mats.white); post.position.set(-9.5, 0.45, -m); post.castShadow = true; g.add(post);
      const s = B.sign(TS.util.digits(m) + ' م', { w: 0.7, h: 0.38, bg: '#ffffff', fg: '#222222', font: 'bold 120px Tajawal, sans-serif' }); s.position.set(-9.5, 1.05, -m + 0.05); g.add(s);
    }
    // earth berm + safety net behind the targets
    const backZ = -(56);
    const berm = new T.Mesh(new T.CylinderGeometry(3, 5.5, 3.4, 4, 1, false, Math.PI / 4), mats.earth); berm.scale.set(9, 1, 0.9); berm.position.set(0, 1.0, backZ - 2.5); berm.receiveShadow = true; g.add(berm);
    const bermTop = new T.Mesh(new T.PlaneGeometry(54, 6), new T.MeshStandardMaterial({ color: 0x5c7f34, roughness: 1 })); bermTop.rotation.x = -Math.PI / 2; bermTop.position.set(0, 2.71, backZ - 2.5); g.add(bermTop);
    const net = new T.Mesh(new T.PlaneGeometry(46, 6.5, 1, 1), mats.net); net.position.set(0, 3.25, backZ + 1.2); g.add(net);
    for (let x = -23; x <= 23; x += 5.75) { const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 6.8, 8), mats.metalDark); p.position.set(x, 3.4, backZ + 1.25); p.castShadow = true; g.add(p); }
    mode.statics.push(TG.plane(new T.Vector3(0, 0, backZ + 1.2), new T.Vector3(0, 0, 1)));
    mode.statics.push(TG.plane(new T.Vector3(0, 0, 0), new T.Vector3(0, 1, 0)));
    // trees beyond the berm and along the sides
    const trees = [];
    for (let i = 0; i < Math.round(70 * tier.trees); i++) { const side = rnd() < 0.5; trees.push({ x: side ? U.lerp(-60, 60, rnd()) : (rnd() < 0.5 ? -1 : 1) * U.lerp(17, 40, rnd()), z: side ? backZ - U.lerp(8, 40, rnd()) : U.lerp(-50, 10, rnd()), s: U.lerp(0.9, 1.6, rnd()), kind: rnd() < 0.3 ? 'pine' : 'leaf' }); }
    B.trees(g, trees, { palette: PALETTE, seed: 8 });
    B.grass(g, [{ x0: -14, x1: 14, z0: -4, z1: 9 }, { x0: -16, x1: -10, z0: -50, z1: -4 }, { x0: 10, x1: 16, z0: -50, z1: -4 }], Math.round(tier.grass), 13);
    // training area: shade pavilion, benches, bow rack (to the archer's chest side, visible from the camera)
    {
      const pav = new T.Group(); pav.position.set(9.5, 0, 3.5);
      for (const [x, z] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6], [2.2, 1.6]]) { const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.7, 8), mats.white); p.position.set(x, 1.35, z); p.castShadow = true; pav.add(p); }
      const roofG = new T.PlaneGeometry(5.2, 3.9, 8, 1); const roof = new T.Mesh(roofG, mats.fabric); roof.rotation.x = -Math.PI / 2 + 0.08; roof.position.y = 2.75; roof.castShadow = true; pav.add(roof);
      const valance = new T.Mesh(new T.PlaneGeometry(5.2, 0.3), mats.fabricWhite); valance.position.set(0, 2.55, -1.95); pav.add(valance);
      for (const z of [-0.6, 0.8]) { const bench = new T.Mesh(new T.BoxGeometry(3.4, 0.08, 0.4), mats.wood); bench.position.set(0, 0.46, z); bench.castShadow = true; pav.add(bench); for (const x of [-1.5, 1.5]) { const l = new T.Mesh(new T.BoxGeometry(0.08, 0.46, 0.36), mats.woodDark); l.position.set(x, 0.23, z); pav.add(l); } }
      const rack = new T.Mesh(new T.BoxGeometry(1.6, 0.08, 0.3), mats.woodDark); rack.position.set(-1.0, 1.2, 1.55); pav.add(rack);
      for (let i = 0; i < 4; i++) { const b = new TS.Gear.Bow(cfg.accent); b.group.scale.setScalar(0.98); b.group.position.set(-1.6 + i * 0.4, 0.92, 1.6); b.group.rotation.set(0.12, Math.PI / 2, 0); pav.add(b.group); }
      g.add(pav);
    }
    // wind flags (accent) beside the target lanes
    const flags = [];
    for (const [x, z] of [[-11, -24], [11, -24], [-11, -44], [11, -44]]) { const f = TG.flag(mats.fabric); f.position.set(x, 0, z); g.add(f); flags.push(f); }
    // branding (configurable — never hard coded)
    const brand = new T.Group(); g.add(brand);
    mode.setBranding = (b) => {
      while (brand.children.length) { const c = brand.children.pop(); c.geometry.dispose(); c.material.map.dispose(); c.material.dispose(); }
      const s = B.sign(b.school, { w: 13, h: 1.3, bg: cfg.accent, fg: '#ffffff', font: 'bold 92px Tajawal, sans-serif', sub: b.lesson || 'ميدان الرماية · ' + TS.config.GAME_NAME });
      s.position.set(0, 7.1, backZ + 1.1); brand.add(s);
      const s2 = B.sign(TS.config.GAME_NAME, { w: 4.6, h: 0.7, bg: '#ffffff', fg: cfg.accent, font: 'bold 92px Tajawal, sans-serif' });
      s2.position.set(9.5, 3.15, 1.6); brand.add(s2);
    };

    // ---------------------------------------------------------- targets
    const layouts = {
      beginner: [{ d: 12, x: 0, r: 0.61, move: 0 }],
      intermediate: [{ d: 22, x: 0, r: 0.4, move: 1.6 }, { d: 18, x: -4.2, r: 0.4, move: 0 }, { d: 18, x: 4.2, r: 0.4, move: 0 }],
      advanced: [{ d: 30, x: 0, r: 0.4, move: 2.2 }, { d: 40, x: -5, r: 0.3, move: 1.4 }, { d: 25, x: 5, r: 0.3, move: 0 }]
    };
    const rails = [];
    function spawn(round) {
      for (const t of mode.targets) { g.remove(t.mesh); }
      for (const r of rails) g.remove(r);
      mode.targets = []; rails.length = 0;
      const lay = layouts[diff.key].slice(0, Math.max(1, Math.min(3, cfg.targetsPerQuestion)));
      const distScale = 1, sizeScale = cfg.size;
      lay.forEach((L, i) => {
        const faceR = L.r * sizeScale * (diff.key === 'beginner' ? 1 : 1);
        const mesh = TG.archeryTarget(faceR, mats);
        const z = -L.d * distScale;
        mesh.position.set(L.x, 0, z);
        g.add(mesh);
        const t = { id: 'at' + i, kind: 'disc', mesh, alive: true, pos: new T.Vector3(), prev: new T.Vector3(), vel: new T.Vector3(), n: new T.Vector3(), r: faceR + 0.004,
          base: new T.Vector3(L.x, 0, z), amp: L.move * cfg.speed > 0 ? L.move : 0, w: (2 * Math.PI / 7.5) * diff.speed * cfg.speed, phase: i * 1.7 + round * 0.9, hits: 0 };
        // boss (outside the rings) as a second, larger disc behind the face plane
        t.boss = { kind: 'disc', c0: new T.Vector3(), c1: new T.Vector3(), n: t.n, r: mesh.userData.holder.children[0].geometry.parameters.width * 0.56, ref: t, boss: true };
        if (t.amp > 0) {
          const rail = new T.Mesh(new T.BoxGeometry(t.amp * 2 + 1.6, 0.06, 0.18), mats.metalDark); rail.position.set(L.x, 0.03, z); rail.receiveShadow = true; g.add(rail); rails.push(rail);
        }
        mode.targets.push(t); place(t, 0);
      });
    }
    function place(t, time) {
      const x = t.base.x + (t.amp > 0 ? Math.sin(time * t.w + t.phase) * t.amp : 0);
      t.mesh.position.x = x;
      t.mesh.updateMatrixWorld(true);
      const face = t.mesh.userData.face;
      face.getWorldPosition(t.pos);
      t.n.set(0, 0, 1).applyQuaternion(face.getWorldQuaternion(mode.qTmp || (mode.qTmp = new T.Quaternion())));
      t.vel.set(t.amp > 0 ? Math.cos(time * t.w + t.phase) * t.amp * t.w : 0, 0, 0);
    }
    mode.preStep = function () { for (const t of this.targets) { t.prev.copy(t.pos); t.boss.c0.copy(t.pos); } };
    mode.step = function (h) {
      this.time += h;
      for (const t of this.targets) { if (this.calm) { t.amp = Math.max(0, t.amp - h * 0.6); } place(t, this.time); t.boss.c1.copy(t.pos); }
    };
    mode.colliders = function () {
      const out = [];
      for (const t of this.targets) { out.push({ kind: 'disc', c0: t.prev, c1: t.pos, n: t.n, r: t.r, ref: t }); out.push(t.boss); }
      for (const s of this.statics) out.push(s);
      return out;
    };
    mode.aimTargets = function () { return this.targets.map(t => ({ pos: t.pos, vel: t.vel, r: t.r })); };
    mode.remaining = function () { return this.targets.length; };
    mode.defaultRange = 30;
    mode.framing = { side: 0.9, back: 2.35, height: 1.8, lookDist: 16, lookHeight: 1.45, fovK: 0.95 };
    mode.stance = { pos: new T.Vector3(0, 0, 0), dir: new T.Vector3(0, 0, -1) };
    mode.env = { group: g, palette: PALETTE, updaters: [(dt, t) => flags.forEach(f => f.userData.update(t, 1))] };
    mode.roundKind = 'arrows';   // a round ends when its arrows are used
    mode.startRound = function (round) { this.calm = false; this.time = 0; spawn(round); };
    mode.calmDown = function () { this.calm = true; };
    /** an arrow hit something: returns the outcome for scoring and how to treat the arrow */
    mode.onHit = function (hit, arrowDir) {
      const c = hit.collider;
      if (c.kind === 'plane') return { kind: c.n.y > 0.5 ? 'ground' : 'backstop', points: 0, stick: true, attach: null, label: 'خارج الهدف' };
      const t = c.ref;
      if (c.boss) return { kind: 'boss', target: t, points: 0, ring: 0, stick: true, attach: t.mesh.userData.holder, label: 'خارج الحلقات' };
      const ring = PH.ringScore(hit.radial, t.r - 0.004);
      t.hits++;
      return { kind: 'face', target: t, ring, points: ring * 10, stick: true, attach: t.mesh.userData.holder, label: ring === 10 ? 'إصابة مركز الهدف! ١٠' : 'الحلقة ' + U.digits(ring), success: ring > 0, bull: ring >= 9 };
    };
    mode.startRound(0);
    return mode;
  }
  TS.Modes = TS.Modes || {}; TS.Modes.archery = { create, PALETTE };
})(typeof window !== 'undefined' ? window : globalThis);
