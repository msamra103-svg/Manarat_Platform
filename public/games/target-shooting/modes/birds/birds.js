/* Mode 2 — صيد الطيور (virtual bird challenge).
 * A mountain meadow seen from a wooden hide. Virtual birds fly continuous centripetal Catmull-Rom paths
 * through a flight volume 20–48 m in front of the archer (no trees inside it), in small formations with
 * individual variation. Speed changes smoothly (slower when climbing, faster when descending), the body
 * banks with the turn rate and pitches with the climb, wings alternate flapping and gliding.
 * A hit is a non-graphic "tag": a gold ring and sparkles, then the bird flies smoothly up and away and fades.
 * No blood, no injury, no falling animal — a school-appropriate sports challenge.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util, B = TS.World.B, TG = TS.Targets;
  const UP = new T.Vector3(0, 1, 0);
  const PALETTE = {
    skyTop: '#2f6fc4', skyHorizon: '#dce9f5', skyBottom: '#6f8a5a', haze: 1.2, fog: '#d6e3ec', fogNear: 80, fogFar: 760,
    hemiSky: '#e0ecff', hemiGround: '#5f6b40', hemiI: 0.66, sun: '#fff3dc', sunI: 2.2, sunAz: -30, sunEl: 36, exposure: 1.02,
    grass: { base: '#6a8a3a', blades: [[110, 146, 60], [86, 122, 44], [140, 160, 76], [100, 130, 50]], patch: ['rgba(160,170,80,.2)', 'rgba(60,90,30,.22)', 'rgba(190,170,90,.1)'] },
    leaf: '#4f7d38', pine: '#2f5236'
  };

  function clouds(g, seed) {
    const r = U.rng(seed);
    const tex = B.canvasTex(256, 128, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { const x = 30 + r() * (w - 60), y = 50 + r() * 40, rad = 18 + r() * 34, gr = c.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    }, { repeat: 1 });
    tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping;
    const list = [];
    for (let i = 0; i < 9; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(90, 32), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85, fog: false }));
      m.position.set(U.lerp(-260, 260, r()), U.lerp(70, 120, r()), U.lerp(-420, -220, r())); m.lookAt(0, m.position.y * 0.6, 0); m.scale.setScalar(U.lerp(0.8, 1.6, r()));
      g.add(m); list.push(m);
    }
    return dt => { for (const m of list) { m.position.x += dt * 1.6; if (m.position.x > 300) m.position.x = -300; } };
  }

  function create(ctx) {
    const { cfg, diff, world } = ctx;
    const mode = new TG.Mode(ctx);
    const g = mode.group, mats = TG.commonMats(cfg.accent), tier = world.tier;
    const rnd = U.rng(2202);
    B.ground(g, PALETTE, { repeat: 170, seed: 33, aniso: tier.anisotropy });
    B.mountains(g, { radius: 560, height: 190, seed: 9, colorA: 0x6d7f86, colorB: 0xc9d6dd, rings: 2 });
    // rolling hills
    const hillMat = new T.MeshStandardMaterial({ color: 0x67863d, roughness: 1 });
    for (let i = 0; i < 9; i++) { const h = new T.Mesh(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat); h.scale.set(U.lerp(40, 90, rnd()), U.lerp(6, 18, rnd()), U.lerp(30, 60, rnd())); h.position.set(U.lerp(-200, 200, rnd()), -0.5, U.lerp(-260, -120, rnd())); h.receiveShadow = true; g.add(h); }
    // trees kept outside the flight volume
    const trees = [];
    for (let i = 0; i < Math.round(110 * tier.trees); i++) {
      const band = rnd();
      const x = band < 0.5 ? U.lerp(-90, 90, rnd()) : (rnd() < 0.5 ? -1 : 1) * U.lerp(34, 70, rnd());
      const z = band < 0.5 ? -U.lerp(62, 110, rnd()) : -U.lerp(0, 60, rnd());
      trees.push({ x, z, s: U.lerp(1.0, 1.9, rnd()), kind: rnd() < 0.55 ? 'pine' : 'leaf' });
    }
    B.trees(g, trees, { palette: PALETTE, seed: 12 });
    B.grass(g, [{ x0: -12, x1: 12, z0: -14, z1: 8 }, { x0: -30, x1: 30, z0: -40, z1: -14 }], Math.round(tier.grass * 1.1), 17);
    // wildflowers
    {
      const n = Math.round(700 * tier.trees), geo = new T.SphereGeometry(0.05, 6, 4), m = new T.MeshStandardMaterial({ roughness: 0.8 });
      const inst = new T.InstancedMesh(geo, m, n), M = new T.Matrix4(), c = new T.Color();
      for (let i = 0; i < n; i++) { M.makeTranslation(U.lerp(-30, 30, rnd()), 0.18 + rnd() * 0.1, U.lerp(-45, 6, rnd())); inst.setMatrixAt(i, M); inst.setColorAt(i, c.set([0xffffff, 0xf2d34c, 0xc94bd0, 0xe85a5a][i % 4])); }
      g.add(inst);
    }
    // the hide: wooden platform the archer stands on (surface at ground level for planted feet) + rail
    {
      const deck = new T.Mesh(new T.BoxGeometry(4.2, 0.06, 3.2), mats.wood); deck.position.set(0.4, -0.02, 0.2); deck.receiveShadow = true; g.add(deck);
      for (const [x, z] of [[-1.6, -1.3], [2.4, -1.3], [-1.6, 1.7], [2.4, 1.7]]) { const p = new T.Mesh(new T.BoxGeometry(0.1, 1.1, 0.1), mats.woodDark); p.position.set(x, 0.55, z); p.castShadow = true; g.add(p); }
      const rail = new T.Mesh(new T.BoxGeometry(0.06, 0.06, 3.0), mats.woodDark); rail.position.set(2.4, 1.05, 0.2); g.add(rail);
      const rail2 = new T.Mesh(new T.BoxGeometry(4.0, 0.06, 0.06), mats.woodDark); rail2.position.set(0.4, 1.05, 1.7); g.add(rail2);
    }
    // fence line
    for (let i = -20; i <= 20; i += 2.5) { const p = new T.Mesh(new T.BoxGeometry(0.1, 1.1, 0.1), mats.woodDark); p.position.set(i, 0.55, -16); p.castShadow = true; g.add(p); }
    for (const y of [0.45, 0.9]) { const r2 = new T.Mesh(new T.BoxGeometry(41, 0.07, 0.05), mats.wood); r2.position.set(0, y, -16); r2.castShadow = true; g.add(r2); }
    const brand = new T.Group(); g.add(brand);
    mode.setBranding = (b) => {
      while (brand.children.length) { const c = brand.children.pop(); c.geometry.dispose(); c.material.map.dispose(); c.material.dispose(); }
      const s = B.sign(b.school, { w: 6, h: 0.75, bg: cfg.accent, fg: '#fff', font: 'bold 84px Tajawal, sans-serif', sub: TS.config.GAME_NAME + ' · صيد الطيور الافتراضي' });
      s.position.set(7.5, 1.0, -15.9); brand.add(s);
    };
    const cloudUpd = clouds(g, 5);
    mode.statics.push(TG.plane(new T.Vector3(0, 0, 0), new T.Vector3(0, 1, 0)));

    // ---------------------------------------------------------- birds
    const speedK = diff.speed * cfg.speed, sizeK = diff.size * cfg.size;
    const rr = () => mode.rng ? mode.rng() : rnd();
    function makePath(dir, depth, height, wiggle) {
      const pts = [];
      const x0 = dir * -70, x1 = dir * 70;
      pts.push(new T.Vector3(x0, height + 4, -depth - 6));
      const n = 4;
      for (let i = 1; i <= n; i++) {
        const k = i / (n + 1);
        pts.push(new T.Vector3(U.lerp(x0 * 0.4, x1 * 0.4, k) + (rr() - 0.5) * 6, height + (rr() - 0.5) * 2 * wiggle * 4, -depth + (rr() - 0.5) * 2 * wiggle * 6));
      }
      pts.push(new T.Vector3(x1, height + 6 + rr() * 4, -depth - 10));
      return new T.CatmullRomCurve3(pts, false, 'centripetal');
    }
    let queue = [];
    function spawnWave(round) {
      for (const t of mode.targets) g.remove(t.mesh);
      mode.targets = []; queue = [];
      const total = Math.max(2, cfg.targetsPerQuestion + (diff.key === 'advanced' ? 2 : 1));
      let made = 0, wave = 0;
      while (made < total) {
        const groupN = Math.min(total - made, diff.key === 'beginner' ? 1 + (rr() < 0.3 ? 1 : 0) : 1 + Math.floor(rr() * 3));
        const dir = (round + wave) % 2 ? 1 : -1;
        const depth = U.lerp(15, 27, rr()) * (diff.key === 'beginner' ? 0.85 : 1);
        const height = U.lerp(4.5, 10, rr());
        const wiggle = diff.key === 'beginner' ? 0.4 : diff.key === 'intermediate' ? 0.9 : 1.4;
        const curve = makePath(dir, depth, height, wiggle);
        const len = curve.getLength();
        for (let k = 0; k < groupN; k++) queue.push({ at: wave * U.lerp(3.2, 4.4, rr()) / Math.sqrt(speedK) + k * 0.05, curve, len, slot: k, seed: round * 31 + made + k });
        made += groupN; wave++;
      }
    }
    function launch(q) {
      const size = 1.85 * sizeK;
      const mesh = bird(q.seed, size);
      TS.World.linearize(mesh);
      g.add(mesh);
      const t = { id: 'bird' + q.seed, kind: 'sphere', mesh, alive: true, aimable: true, pos: new T.Vector3(), prev: new T.Vector3(), vel: new T.Vector3(), acc: new T.Vector3(), r: 0.3 * size,
        curve: q.curve, len: q.len, s: 0, speed: 7.2 * speedK * (0.92 + 0.16 * ((q.seed * 0.37) % 1)), slot: q.slot,
        offset: new T.Vector3(q.slot === 0 ? 0 : (q.slot % 2 ? 1 : -1) * 1.3, (q.slot ? -0.35 : 0) * q.slot, -1.4 * q.slot),
        phase: q.seed * 1.7, flapAmt: 1, glide: 0, roll: new U.Spring(0, 6), pitch: new U.Spring(0, 6), heading: null, fwd: new T.Vector3(), state: 'fly', fade: 1, exitT: 0 };
      sample(t, 0, true);
      t.prev.copy(t.pos);
      // exact future position along the bird's own path (formation offset included) for aim assistance
      t.predict = (dt, out) => { if (t.state === 'fly') { frameAt(t, Math.min(t.len, t.s + (t.v || t.speed) * dt), out, tmpP); return out; } return out.copy(t.pos).addScaledVector(t.vel, dt); };
      mode.targets.push(t);
      if (ctx.audio) ctx.audio.play('wings', { level: 0.6 });
    }
    function bird(seed, size) { return TG.bird(seed, size); }
    const tmpT = new T.Vector3(), tmpN = new T.Vector3(), tmpP = new T.Vector3(), side = new T.Vector3(), q1 = new T.Quaternion(), m4 = new T.Matrix4();
    function frameAt(t, s, outPos, outTan) {
      const u = U.clamp(s / t.len, 0, 1);
      t.curve.getPointAt(u, outPos); t.curve.getTangentAt(u, outTan);
      if (t.slot) { // formation offset in the path frame
        const r = side.crossVectors(outTan, UP).normalize();
        outPos.addScaledVector(r, t.offset.x).addScaledVector(UP, t.offset.y).addScaledVector(outTan, t.offset.z);
      }
    }
    function sample(t, h, init) {
      if (t.state === 'fly') {
        frameAt(t, t.s, tmpN, tmpT);
        // speed: smooth variation; slower climbing, faster descending (energy), never jerky
        const target = t.speed * (1 + 0.1 * Math.sin(t.phase * 0.7 + t.s * 0.05)) - 3.0 * tmpT.y;
        t.v = init ? target : U.damp(t.v, target, 1.6, h);
        t.s += t.v * h;
        if (t.s >= t.len) { t.alive = false; t.state = 'gone'; t.mesh.visible = false; return; }
        frameAt(t, t.s, t.pos, tmpT);
        const prevFwd = t.fwd.clone();
        t.fwd.copy(tmpT);
        if (h > 0) {
          t.vel.copy(tmpT).multiplyScalar(t.v);
          // banking from the heading rate (curvature x speed), smoothed
          const yawRate = prevFwd.lengthSq() ? Math.atan2(prevFwd.clone().cross(tmpT).y, prevFwd.dot(tmpT)) / h : 0;
          t.roll.update(U.clamp(-yawRate * 0.35, -0.75, 0.75), h);
          const climb = tmpT.y;
          t.flapAmt = U.damp(t.flapAmt, climb > -0.05 ? 1 : 0.15, 2.5, h);
          t.glide = 1 - t.flapAmt;
          t.phase += h * (9 + 3 * t.flapAmt) * (0.8 + 0.2 * speedK);
          t.acc.set(0, 0, 0);
        } else { t.vel.copy(tmpT).multiplyScalar(t.speed); }
      } else if (t.state === 'exit') {
        // tagged or released: smooth climb away (continuous velocity), then fade out
        t.exitT += h;
        const want = tmpN.copy(t.exitDir).multiplyScalar(t.speed * 1.25);
        t.vel.lerp(want, 1 - Math.exp(-1.4 * h));
        t.pos.addScaledVector(t.vel, h);
        t.fwd.copy(t.vel).normalize();
        t.roll.update(0, h);
        t.flapAmt = U.damp(t.flapAmt, 1, 4, h); t.phase += h * 13;
        if (t.exitT > 1.0) t.fade = Math.max(0, t.fade - h / 0.9);
        if (t.fade <= 0) { t.state = 'gone'; t.mesh.visible = false; }
      }
    }
    function pose(t) {
      if (t.state === 'gone') return;
      const m = t.mesh;
      m.position.copy(t.pos);
      const f = t.fwd.lengthSq() ? t.fwd : tmpT.set(1, 0, 0);
      m4.lookAt(new T.Vector3(), f.clone().negate(), UP); // object +Z along f
      m.quaternion.setFromRotationMatrix(m4);
      m.quaternion.multiply(q1.setFromAxisAngle(tmpN.set(0, 0, 1), t.roll.x));
      TG.poseBird(m, t.phase, t.flapAmt, t.glide);
      const s = m.userData.baseScale || (m.userData.baseScale = m.scale.x);
      m.scale.setScalar(s * (0.25 + 0.75 * t.fade));
      if (t.tagged) { const e = m.userData.mats; const k = 0.5 + 0.5 * Math.sin(t.exitT * 10); e.body.emissive.setRGB(0.55 * k, 0.42 * k, 0.05 * k); e.wing.emissive.setRGB(0.45 * k, 0.33 * k, 0.02 * k); }
    }
    mode.step = function (h) {
      this.time += h;
      while (queue.length && queue[0].at <= this.time && !this.calm) launch(queue.shift());
      for (const t of this.targets) { if (t.state !== 'gone') sample(t, h); }
    };
    mode.preStep = function () { for (const t of this.targets) t.prev.copy(t.pos); };
    mode.env = { group: g, palette: PALETTE, updaters: [(dt) => { cloudUpd(dt); for (const t of mode.targets) pose(t); }] };
    mode.stance = { pos: new T.Vector3(0, 0, 0), dir: new T.Vector3(-Math.sin(0.2), 0, -Math.cos(0.2)) };   // turned 11° so the field is centred in the archer's comfortable range
    mode.framing = { side: 1.05, back: 2.55, height: 1.75, lookDist: 16, lookHeight: 3.2 };
    mode.defaultRange = 32; mode.defaultPitch = 0.18; mode.pitchMax = 0.9; mode.yawLimit = 1.0;
    mode.roundComplete = function () { return !queue.length && !this.targets.some(t => t.alive); };
    mode.remaining = function () { return queue.length + this.targets.filter(t => t.alive).length; };
    mode.startRound = function (round) { this.calm = false; this.time = 0; this.guided = false; this.guidedTarget = null; spawnWave(round); };
    // One visible *real* 3D bird per educational question; no lengthy off-screen wave delay.
    mode.prepareGuidedTarget = function () {
      const next = queue.shift();
      if (!next) return;
      launch(next);
      queue = [];
      const t = this.targets[this.targets.length - 1];
      // Start near the middle of the original curved flight path, where the bird is clearly visible.
      t.s = t.len * 0.50;
      sample(t, 0, true);
      t.prev.copy(t.pos);
      this.guidedTarget = t;
      pose(t);
    };
    mode.guidedVisualStep = function (h) {
      // Wings keep flapping gently, while the collider stays fixed for the graded arrow.
      if (this.guidedTarget && this.guidedTarget.alive) this.guidedTarget.phase += h * 9;
    };
    mode.calmDown = function () { this.calm = true; queue = []; for (const t of this.targets) if (t.alive) { t.alive = false; t.state = 'exit'; t.exitDir = t.fwd.clone().setY(0).normalize().add(new T.Vector3(0, 0.9, 0)).normalize(); } };
    mode.onHit = function (hit) {
      const c = hit.collider;
      if (c.kind === 'plane') return { kind: 'ground', points: 0, stick: true, label: 'لم يُصب' };
      const t = c.ref; t.alive = false; t.tagged = true; t.state = 'exit'; t.exitT = 0;
      t.exitDir = t.fwd.clone().setY(0).normalize().multiplyScalar(0.6).add(new T.Vector3(0, 1, 0)).normalize();
      const dist = t.pos.length();
      const pts = Math.round((60 + dist * 1.5) / 5) * 5;
      return {
        kind: 'bird', target: t, points: pts, consume: true, success: true, label: 'إصابة افتراضية!', bonus: dist > 38,
        fx: (p) => { const fx = ctx.fx; fx.ring(p, { color: 0xffd34d, size: 1.6, time: 0.8, follow: t.pos }); fx.burst('spark', p, { count: 26, colors: [0xffd34d, 0xffffff, 0xfff2a8], speed: 3.2, size: 0.04, life: 0.9, gravity: 0.6, drag: 1.4 }); ctx.audio && ctx.audio.play('tag'); }
      };
    };
    mode.dispose = function () { };
    mode.startRound(0);
    return mode;
  }
  TS.Modes = TS.Modes || {}; TS.Modes.birds = { create, PALETTE };
})(typeof window !== 'undefined' ? window : globalThis);
