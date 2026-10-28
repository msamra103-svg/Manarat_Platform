/* Mode 4 — الطبق الطائر (clay disc range).
 * Discs leave clearly visible trap machines (a front trap house, a high house on the left, a low house on the
 * right and a pit for high arcs). Flight: gravity reduced by aerodynamic lift (0.62 g) and linear drag
 * (k = 0.08 /s), integrated in closed form per sub-step (exact, deterministic, no random forces). Each disc
 * spins about its axis and keeps a stable attitude tilted with its velocity. Patterns: outgoing (horizontal),
 * diagonal, high arc, crossing, and doubles. Speeds are scaled down from competition clays for playability.
 * A hit shatters the disc at the contact sub-step into fragments that inherit its velocity; a missed disc lands.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util, B = TS.World.B, TG = TS.Targets;
  const PALETTE = {
    skyTop: '#3474c8', skyHorizon: '#dfe9ef', skyBottom: '#857f62', haze: 1.1, fog: '#d8e1e6', fogNear: 90, fogFar: 700,
    hemiSky: '#e2edff', hemiGround: '#6b6646', hemiI: 0.62, sun: '#fff2dc', sunI: 2.3, sunAz: 20, sunEl: 48, exposure: 1.0,
    grass: { base: '#73883e', blades: [[120, 140, 66], [96, 120, 50], [150, 150, 84]], patch: ['rgba(170,160,90,.22)', 'rgba(70,90,36,.2)'] },
    leaf: '#567e39', pine: '#33573a'
  };
  const G_EFF = 9.81 * 0.62, K = 0.08;

  function create(ctx) {
    const { cfg, diff, world } = ctx;
    const mode = new TG.Mode(ctx);
    const g = mode.group, mats = TG.commonMats(cfg.accent), tier = world.tier;
    const rnd = U.rng(4404);
    B.ground(g, PALETTE, { repeat: 160, seed: 51, aniso: tier.anisotropy });
    B.mountains(g, { radius: 600, height: 140, seed: 17, colorA: 0x737f78, colorB: 0xbcc6c8 });
    // shooting station: concrete pad + roof
    {
      const pad = new T.Mesh(new T.BoxGeometry(3.4, 0.04, 3.0), new T.MeshStandardMaterial({ color: 0xb9b6ad, roughness: 0.95 })); pad.position.set(0.4, -0.015, 0.3); pad.receiveShadow = true; g.add(pad);
      for (const [x, z] of [[-1.2, 1.7], [2.0, 1.7]]) { const p = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.8, 8), mats.white); p.position.set(x, 1.4, z); p.castShadow = true; g.add(p); }
      const roof = new T.Mesh(new T.BoxGeometry(3.6, 0.08, 1.4), mats.accent); roof.position.set(0.4, 2.85, 1.25); roof.rotation.x = 0.1; roof.castShadow = true; g.add(roof);
    }
    // trap houses
    const houses = {
      front: { pos: new T.Vector3(0, 0, -15), dir: new T.Vector3(0, 0, -1) },
      left: { pos: new T.Vector3(-17, 0, -24), dir: new T.Vector3(1, 0, -0.25).normalize() },
      right: { pos: new T.Vector3(17, 0, -22), dir: new T.Vector3(-1, 0, -0.3).normalize() },
      pit: { pos: new T.Vector3(-4, 0, -28), dir: new T.Vector3(0.3, 0, -0.2).normalize() }
    };
    const traps = {};
    for (const [k, h] of Object.entries(houses)) {
      const grp = new T.Group(); grp.position.copy(h.pos); grp.rotation.y = Math.atan2(h.dir.x, h.dir.z);
      if (k === 'left') { const tower = new T.Mesh(new T.BoxGeometry(2.6, 4.2, 2.6), new T.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.9 })); tower.position.y = 2.1; tower.castShadow = tower.receiveShadow = true; grp.add(tower); const w = new T.Mesh(new T.BoxGeometry(1.2, 0.5, 0.05), mats.metalDark); w.position.set(0, 3.6, 1.31); grp.add(w); }
      if (k === 'front') { const bunker = new T.Mesh(new T.BoxGeometry(3.0, 0.9, 2.2), new T.MeshStandardMaterial({ color: 0x9a9a92, roughness: 1 })); bunker.position.y = 0.45; bunker.castShadow = bunker.receiveShadow = true; grp.add(bunker); }
      if (k === 'right') { const hut = new T.Mesh(new T.BoxGeometry(2.4, 1.4, 2.4), new T.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.9 })); hut.position.y = 0.7; hut.castShadow = hut.receiveShadow = true; grp.add(hut); }
      const l = TG.launcher(mats); l.position.y = k === 'left' ? 4.2 : k === 'front' ? 0.9 : k === 'right' ? 1.4 : 0; if (k === 'pit') l.position.y = 0; grp.add(l);
      g.add(grp); traps[k] = { grp, launcher: l, swing: 0 };
    }
    // safety fence + trees + flags
    for (let x = -40; x <= 40; x += 4) { const p = new T.Mesh(new T.BoxGeometry(0.08, 1.2, 0.08), mats.metal); p.position.set(x, 0.6, 6); g.add(p); }
    const wire = new T.Mesh(new T.BoxGeometry(80, 0.03, 0.03), mats.metal); wire.position.set(0, 1.1, 6); g.add(wire);
    const trees = [];
    for (let i = 0; i < Math.round(90 * tier.trees); i++) trees.push({ x: U.lerp(-120, 120, rnd()), z: -U.lerp(75, 140, rnd()), s: U.lerp(1, 2, rnd()), kind: rnd() < 0.5 ? 'pine' : 'leaf' });
    B.trees(g, trees, { palette: PALETTE, seed: 29 });
    B.grass(g, [{ x0: -12, x1: 12, z0: -12, z1: 5 }, { x0: -30, x1: 30, z0: -60, z1: -12 }], Math.round(tier.grass), 31);
    const flags = []; for (const [x, z] of [[-8, -12], [8, -12]]) { const f = TG.flag(mats.fabric); f.position.set(x, 0, z); g.add(f); flags.push(f); }
    const brand = new T.Group(); g.add(brand);
    mode.setBranding = (b) => {
      while (brand.children.length) { const c = brand.children.pop(); c.geometry.dispose(); c.material.map.dispose(); c.material.dispose(); }
      const s = B.sign(b.school, { w: 2.6, h: 1.0, bg: cfg.accent, fg: '#fff', font: 'bold 80px Tajawal, sans-serif', sub: TS.config.GAME_NAME });
      s.position.set(-17, 2.3, -22.65); s.rotation.y = Math.atan2(1, -0.25) - Math.PI; brand.add(s);
      const s2 = B.sign('ميدان الطبق الطائر', { w: 3.6, h: 0.5, bg: '#ffffff', fg: cfg.accent, font: 'bold 80px Tajawal, sans-serif' });
      s2.position.set(0.4, 2.62, 1.92); s2.rotation.y = Math.PI; brand.add(s2);
    };
    mode.statics.push(TG.plane(new T.Vector3(0, 0, 0), new T.Vector3(0, 1, 0)));

    // ---------------------------------------------------------- discs
    const speedK = diff.speed * cfg.speed, sizeK = diff.size * cfg.size;
    const rr = () => (mode.rng ? mode.rng() : rnd());
    const discMat = new T.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.55 }), ringMat = new T.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7 });
    let schedule = [];
    const PATTERNS = {
      beginner: ['outgoing', 'diagonal', 'outgoing', 'high'],
      intermediate: ['outgoing', 'crossL', 'diagonal', 'crossR', 'high'],
      advanced: ['crossL', 'double', 'high', 'crossR', 'diagonal', 'double']
    };
    function launchSpec(p) {
      const s = 12.5 * speedK;
      switch (p) {
        case 'outgoing': return [{ house: 'front', v: new T.Vector3((rr() - 0.5) * 3, 6.5, -s), }];
        case 'diagonal': { const sx = rr() < 0.5 ? -1 : 1; return [{ house: 'front', v: new T.Vector3(sx * s * 0.55, 7.5, -s * 0.8) }]; }
        case 'high': return [{ house: 'pit', v: new T.Vector3(s * 0.25 * (rr() < 0.5 ? -1 : 1), s * 1.05 + 4, -s * 0.15) }];
        case 'crossL': return [{ house: 'left', v: new T.Vector3(s * 1.0, 3.8, -s * 0.12) }];
        case 'crossR': return [{ house: 'right', v: new T.Vector3(-s * 1.0, 5.5, -s * 0.18) }];
        case 'double': return [{ house: 'left', v: new T.Vector3(s * 0.95, 4.2, -s * 0.1) }, { house: 'right', v: new T.Vector3(-s * 0.95, 5.0, -s * 0.15) }];
      }
      return [];
    }
    function spawnRound(round) {
      for (const t of mode.targets) g.remove(t.mesh);
      mode.targets = []; schedule = [];
      const n = Math.max(2, cfg.targetsPerQuestion + 1);
      const pats = PATTERNS[diff.key];
      let at = 1.0, count = 0, i = round;
      while (count < n) {
        const p = pats[i++ % pats.length];
        const specs = launchSpec(p);
        for (const sp of specs) { if (count >= n) break; schedule.push({ at, ...sp }); count++; }
        at += U.lerp(3.0, 3.8, rr()) / Math.sqrt(speedK);
      }
    }
    function launch(sp) {
      const tr = traps[sp.house];
      const mesh = TG.clayDisc(discMat, ringMat); const size = 1.25 * sizeK; mesh.scale.setScalar(size);
      TS.World.linearize(mesh);
      g.add(mesh);
      tr.launcher.updateMatrixWorld(true);
      const start = new T.Vector3(0, 0.7, 0.3).applyMatrix4(tr.launcher.matrixWorld);
      const t = { id: 'clay' + mode.targets.length, kind: 'sphere', mesh, alive: true, pos: start.clone(), prev: start.clone(), vel: sp.v.clone(), acc: new T.Vector3(0, -G_EFF, 0), r: 0.11 * size + 0.03,
        spin: 0, spinRate: 26 + rr() * 10, state: 'fly', rest: 0 };
      // exact future position (same closed form as the simulation) for aim assistance
      t.predict = (dt, out) => { const e0 = new T.Vector3().copy(t.vel).sub(vInf); return out.copy(t.pos).addScaledVector(vInf, dt).addScaledVector(e0, (1 - Math.exp(-K * dt)) / K); };
      mode.targets.push(t);
      tr.swing = 1;
      ctx.audio && ctx.audio.play('launch', {});
    }
    const vInf = new T.Vector3(0, -G_EFF / K, 0), e = new T.Vector3(), up = new T.Vector3(0, 1, 0), q = new T.Quaternion(), q2 = new T.Quaternion(), nrm = new T.Vector3();
    // "Pull!": like a real shooter, the disc is released only when the archer is ready (bow at full draw), after a
    // short human delay — never while he is still nocking. Discs of a double leave together.
    let readyFor = 0;
    mode.step = function (h, phase, ready) {
      this.time += h;
      readyFor = ready ? readyFor + h : 0;
      if (schedule.length && !this.calm && readyFor >= 0.45 && (!this.lastLaunch || this.time - this.lastLaunch > 0.3)) {
        const at = schedule[0].at; this.lastLaunch = this.time;
        while (schedule.length && schedule[0].at === at) launch(schedule.shift());
        readyFor = -99;   // one pull per readiness
      }
      const ek = Math.exp(-K * h);
      for (const t of this.targets) {
        if (t.state !== 'fly') { if (t.state === 'landed') { t.rest += h; } continue; }
        // exact solution of v' = -K v + g_eff (vector): v(h) = vInf + (v0 - vInf) e^{-Kh}; x(h) = x0 + vInf h + (v0 - vInf)(1 - e^{-Kh})/K
        e.copy(t.vel).sub(vInf);
        t.pos.addScaledVector(vInf, h).addScaledVector(e, (1 - ek) / K);
        t.vel.copy(vInf).addScaledVector(e, ek);
        t.acc.copy(t.vel).multiplyScalar(-K).add(new T.Vector3(0, -G_EFF, 0));
        t.spin += t.spinRate * h;
        if (t.pos.y <= 0.03) { t.pos.y = 0.03; t.state = 'landed'; t.alive = false; t.vel.set(0, 0, 0); }
      }
    };
    function draw(dt) {
      for (const t of mode.targets) {
        if (!t.mesh.visible) continue;
        t.mesh.position.copy(t.pos);
        // attitude: disc normal between up and the reverse of the velocity (stable, no wobble), plus spin
        nrm.copy(up).addScaledVector(t.vel.clone().normalize(), -0.25).normalize();
        q.setFromUnitVectors(up, nrm); q2.setFromAxisAngle(up, t.spin);
        t.mesh.quaternion.copy(q).multiply(q2);
        if (t.state === 'landed') { t.mesh.quaternion.setFromAxisAngle(new T.Vector3(1, 0, 0), 0.15); if (t.rest > 6) t.mesh.visible = false; }
      }
      for (const tr of Object.values(traps)) { if (tr.swing > 0) { tr.swing = Math.max(0, tr.swing - dt * 2.5); } tr.launcher.userData.arm.rotation.y = Math.sin((1 - tr.swing) * Math.PI) * 1.2 * (tr.swing > 0 ? 1 : 0); }
    }
    mode.env = { group: g, palette: PALETTE, updaters: [(dt, time) => { draw(dt); flags.forEach(f => f.userData.update(time, 1.3)); }] };
    mode.stance = { pos: new T.Vector3(0.2, 0, 0.2), dir: new T.Vector3(-Math.sin(0.2), 0, -Math.cos(0.2)) };   // turned 11° so the field is centred in the archer's comfortable range
    mode.framing = { side: 1.05, back: 2.55, height: 1.78, lookDist: 15, lookHeight: 3.0, orbitArc: 1.15 };   // menu/results orbit stays in front of the station roof and posts
    mode.defaultRange = 25; mode.defaultPitch = 0.2; mode.pitchMax = 0.95; mode.yawLimit = 1.0;
    mode.aimTargets = function () { return this.targets.filter(t => t.alive).map(t => ({ pos: t.pos, vel: t.vel, acc: t.acc, r: t.r, predict: t.predict })); };
    mode.roundComplete = function () { return !schedule.length && !this.targets.some(t => t.alive); };
    mode.remaining = function () { return schedule.length + this.targets.filter(t => t.alive).length; };
    mode.startRound = function (round) { this.calm = false; this.time = 0; this.lastLaunch = 0; readyFor = 0; this.guided = false; this.guidedTarget = null; spawnRound(round); };
    mode.prepareGuidedTarget = function () {
      // Show an actual launched spinning clay disc in the field, with no waiting for the trap timer.
      schedule = [];
      launch({ house: 'front', v: new T.Vector3(0, 6.5, -12.5 * speedK) });
      const t = this.targets[this.targets.length - 1];
      t.pos.set(0.3, 5.0, -15.0);
      t.prev.copy(t.pos);
      t.vel.set(0, 0, -12.5 * speedK);
      this.guidedTarget = t;
      t.mesh.position.copy(t.pos);
    };
    mode.guidedVisualStep = function (h) {
      if (this.guidedTarget && this.guidedTarget.alive) this.guidedTarget.spin += this.guidedTarget.spinRate * h;
    };
    mode.hint = 'اشدد القوس — يُطلق الطبق عندما تكون جاهزًا';
    mode.calmDown = function () { this.calm = true; schedule = []; };
    mode.onHit = function (hit) {
      const c = hit.collider;
      if (c.kind === 'plane') return { kind: 'ground', points: 0, stick: true, label: 'لم يُصب' };
      const t = c.ref; t.alive = false; t.state = 'broken'; t.mesh.visible = false;
      const height = t.pos.y;
      const pts = Math.round((70 + height * 4 + t.vel.length() * 2) / 5) * 5;
      return {
        kind: 'clay', target: t, points: pts, success: true, consume: false, label: 'تحطّم الطبق!', bonus: height > 9,
        fx: (p) => { const fx = ctx.fx; fx.burst('shard', p, { count: 26, colors: [0xff6a1a, 0xff8a3d, 0x1b1b1b], speed: 3.2, size: 0.035, life: 1.4, gravity: 9.81, drag: 0.4, vel: t.vel.clone().multiplyScalar(0.6), spin: 24 }); fx.burst('dust', p, { count: 10, colors: [0xff9a5a, 0x5a4a3a], speed: 1.2, size: 0.06, life: 0.6, gravity: -0.3, drag: 2 }); ctx.audio && ctx.audio.play('shatter', {}); }
      };
    };
    mode.dispose = function () { discMat.dispose(); ringMat.dispose(); };
    mode.startRound(0);
    return mode;
  }
  TS.Modes = TS.Modes || {}; TS.Modes.clay = { create, PALETTE };
})(typeof window !== 'undefined' ? window : globalThis);
