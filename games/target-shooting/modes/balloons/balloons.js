/* Mode 3 — فرقعة البالونات (open-air carnival).
 * Glossy clear-coated balloons with knots and simulated strings. Behaviours: tied (anchored, swaying in the
 * wind), rising (buoyancy terminal velocity + wind drift), drifting (horizontal with the wind, gentle bob),
 * bunches (several on one string) and golden bonus balloons. The wind field is continuous in space and time.
 * A balloon bursts at the exact sub-step of contact: the envelope disappears in that same step, rubber
 * fragments of its colour fly off, the string falls. The arrow continues its flight.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util, B = TS.World.B, TG = TS.Targets;
  const PALETTE = {
    skyTop: '#3d7fd6', skyHorizon: '#f2e6d8', skyBottom: '#b8a780', haze: 1.4, fog: '#efe2d3', fogNear: 70, fogFar: 600,
    hemiSky: '#fff0e0', hemiGround: '#7a6a48', hemiI: 0.72, sun: '#ffe6c4', sunI: 2.05, sunAz: 70, sunEl: 30, exposure: 1.03,
    grass: { base: '#7a8f3e', blades: [[130, 150, 70], [104, 128, 52], [160, 160, 90]], patch: ['rgba(200,180,110,.22)', 'rgba(90,110,40,.2)'] },
    leaf: '#5c8a3c', pine: '#365c3c'
  };
  const COLORS = [0xe2252b, 0x1f7bd8, 0x2fae66, 0xf2a71b, 0x9b3fd1, 0xff5fa2, 0x18b5c9, 0xffffff];

  function create(ctx) {
    const { cfg, diff, world } = ctx;
    const mode = new TG.Mode(ctx);
    const g = mode.group, mats = TG.commonMats(cfg.accent), tier = world.tier;
    const rnd = U.rng(3303);
    B.ground(g, PALETTE, { repeat: 150, seed: 41, aniso: tier.anisotropy });
    B.mountains(g, { radius: 600, height: 90, seed: 13, colorA: 0x8d8c7a, colorB: 0xcfc6b4 });
    // fairground path (sand) and booth counter in front of the archer
    B.strip(g, { x: 0, z: -14, w: 10, l: 34, color: 0xd9c49a, opacity: 0.85 });
    B.strip(g, { x: 0, z: 1, w: 40, l: 5, color: 0xd9c49a, opacity: 0.8 });
    {
      const counter = new T.Group(); counter.position.set(0.6, 0, -1.7);
      const top = new T.Mesh(new T.BoxGeometry(5.2, 0.08, 0.7), mats.wood); top.position.y = 1.0; counter.add(top);
      const front = new T.Mesh(new T.BoxGeometry(5.2, 0.95, 0.06), mats.fabricWhite); front.position.set(0, 0.5, -0.33); counter.add(front);
      for (let i = 0; i < 6; i++) { const st = new T.Mesh(new T.BoxGeometry(0.43, 0.95, 0.065), mats.fabric); st.position.set(-2.15 + i * 0.86, 0.5, -0.335); counter.add(st); }
      counter.traverse(x => { if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } });
      g.add(counter);
    }
    // striped tents
    function tent(x, z, s, c1, c2) {
      const t = new T.Group(); t.position.set(x, 0, z); t.scale.setScalar(s);
      const n = 12;
      for (let i = 0; i < n; i++) {
        const seg = new T.Mesh(new T.ConeGeometry(3, 2.4, 1, 1, true, i * Math.PI * 2 / n, Math.PI * 2 / n), new T.MeshStandardMaterial({ color: i % 2 ? c1 : c2, roughness: 0.85, side: T.DoubleSide })); seg.position.y = 3.6; t.add(seg);
        const wall = new T.Mesh(new T.CylinderGeometry(3, 3, 2.4, 1, 1, true, i * Math.PI * 2 / n, Math.PI * 2 / n), new T.MeshStandardMaterial({ color: i % 2 ? c2 : c1, roughness: 0.9, side: T.DoubleSide })); wall.position.y = 1.2; t.add(wall);
      }
      const flagM = new T.MeshStandardMaterial({ color: c1, side: T.DoubleSide }); const fl = new T.Mesh(new T.PlaneGeometry(0.6, 0.35), flagM); fl.position.set(0.3, 5.2, 0); t.add(fl);
      const pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.8, 6), mats.white); pole.position.y = 5.0; t.add(pole);
      t.traverse(o => { if (o.isMesh) o.castShadow = true; });
      g.add(t);
    }
    tent(-17, -36, 1.2, 0xc8213a, 0xffffff); tent(18, -40, 1.4, 0x1f63c8, 0xffffff); tent(-30, -18, 1.0, 0x8A1538, 0xf2c14e); tent(28, -16, 1.0, 0x2fae66, 0xffffff); tent(4, -60, 1.6, 0xf28a1b, 0xffffff);
    // ferris wheel (slow, steady rotation)
    const wheel = new T.Group(); wheel.position.set(-36, 0, -70);
    {
      const ring = new T.Mesh(new T.TorusGeometry(11, 0.18, 8, 64), mats.metal); ring.position.y = 13; const ring2 = ring.clone(); ring.position.z = 0.8; ring2.position.z = -0.8;
      const hub = new T.Group(); hub.position.y = 13; wheel.add(ring, ring2, hub);
      for (let i = 0; i < 16; i++) { const sp = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 11, 5), mats.metal); sp.rotation.z = i * Math.PI / 8; sp.position.set(Math.sin(i * Math.PI / 8) * -5.5, Math.cos(i * Math.PI / 8) * 5.5, 0); hub.add(sp); }
      const cabins = [];
      for (let i = 0; i < 12; i++) { const cb = new T.Mesh(new T.BoxGeometry(1.1, 1.0, 1.1), new T.MeshStandardMaterial({ color: COLORS[i % 7], roughness: 0.5 })); cb.userData.a = i * Math.PI / 6; hub.add(cb); cabins.push(cb); }
      for (const sx of [-1, 1]) { const leg = new T.Mesh(new T.CylinderGeometry(0.25, 0.35, 14, 8), mats.metalDark); leg.position.set(sx * 4, 6.5, 0); leg.rotation.z = sx * 0.3; wheel.add(leg); }
      wheel.userData = { hub, cabins };
      wheel.traverse(o => { if (o.isMesh) o.castShadow = true; });
      g.add(wheel);
    }
    // bunting lines (pennants)
    const buntings = [];
    function bunting(a, b, sag) {
      const n = 22, grp = new T.Group(); const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-0.18, 0, 0, 0.18, 0, 0, 0, -0.34, 0], 3)); tri.computeVertexNormals();
      for (let i = 1; i < n; i++) { const k = i / n, p = new T.Vector3().lerpVectors(a, b, k); p.y -= Math.sin(k * Math.PI) * sag; const m = new T.Mesh(tri, new T.MeshStandardMaterial({ color: COLORS[i % COLORS.length], side: T.DoubleSide, roughness: 0.8 })); m.position.copy(p); m.lookAt(p.x + (b.z - a.z), p.y, p.z - (b.x - a.x)); m.userData.base = m.rotation.x; grp.add(m); }
      g.add(grp); buntings.push(grp);
    }
    for (const [x, z] of [[-9, -10], [9, -10], [-11, -30], [11, -30]]) { const p = new T.Mesh(new T.CylinderGeometry(0.07, 0.09, 6.5, 8), mats.white); p.position.set(x, 3.25, z); p.castShadow = true; g.add(p); }
    bunting(new T.Vector3(-9, 6.2, -10), new T.Vector3(9, 6.2, -10), 1.2);
    bunting(new T.Vector3(-11, 6.2, -30), new T.Vector3(11, 6.2, -30), 1.4);
    bunting(new T.Vector3(-9, 6.2, -10), new T.Vector3(-11, 6.2, -30), 0.8);
    bunting(new T.Vector3(9, 6.2, -10), new T.Vector3(11, 6.2, -30), 0.8);
    // anchor posts for tied balloons
    const posts = [];
    for (let i = 0; i < 7; i++) { const x = -9 + i * 3, z = -13 - (i % 2) * 4; const p = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 1.4, 8), mats.woodDark); p.position.set(x, 0.7, z); p.castShadow = true; g.add(p); posts.push(new T.Vector3(x, 1.4, z)); }
    const trees = [];
    for (let i = 0; i < Math.round(60 * tier.trees); i++) trees.push({ x: (rnd() < 0.5 ? -1 : 1) * U.lerp(40, 90, rnd()), z: -U.lerp(0, 110, rnd()), s: U.lerp(1, 1.7, rnd()), kind: rnd() < 0.35 ? 'pine' : 'leaf' });
    B.trees(g, trees, { palette: PALETTE, seed: 19 });
    B.grass(g, [{ x0: -20, x1: -6, z0: -40, z1: 6 }, { x0: 6, x1: 20, z0: -40, z1: 6 }], Math.round(tier.grass * 0.7), 23);
    const brand = new T.Group(); g.add(brand);
    mode.setBranding = (b) => {
      while (brand.children.length) { const c = brand.children.pop(); c.geometry.dispose(); c.material.map.dispose(); c.material.dispose(); }
      const s = B.sign(TS.config.GAME_NAME + ' · ' + b.school, { w: 16, h: 1.4, bg: cfg.accent, fg: '#fff', font: 'bold 82px Tajawal, sans-serif', sub: 'مهرجان فرقعة البالونات' });
      s.position.set(0, 8.4, -44); s.scale.setScalar(1.1); brand.add(s);
    };
    mode.statics.push(TG.plane(new T.Vector3(0, 0, 0), new T.Vector3(0, 1, 0)));

    // ---------------------------------------------------------- balloons
    const speedK = diff.speed * cfg.speed, sizeK = diff.size * cfg.size;
    const rr = () => (mode.rng ? mode.rng() : rnd());
    const wind = new T.Vector3();
    function windAt(p, t, out) {
      const k = 0.8 + 0.6 * speedK;
      return out.set(Math.sin(t * 0.21 + p.z * 0.05) * 0.9 + 0.5, 0, Math.sin(t * 0.17 + p.x * 0.07) * 0.35).multiplyScalar(k);
    }
    function spawn(round) {
      for (const t of mode.targets) { g.remove(t.mesh); if (t.line) g.remove(t.line); }
      mode.targets = [];
      const n = Math.max(4, cfg.targetsPerQuestion * 2 + (diff.key === 'advanced' ? 2 : 0));
      const kinds = diff.key === 'beginner' ? ['tied', 'tied', 'tied', 'rise', 'drift'] : diff.key === 'intermediate' ? ['tied', 'rise', 'drift', 'drift', 'bunch', 'bonus'] : ['rise', 'drift', 'drift', 'bunch', 'bonus', 'rise'];
      let postIdx = Math.floor(rr() * posts.length);
      for (let i = 0; i < n; i++) {
        const kind = kinds[i % kinds.length];
        if (kind === 'bunch') { const base = new T.Vector3(U.lerp(-6, 6, rr()), 2.2, -U.lerp(12, 19, rr())); for (let k = 0; k < 3 && i < n; k++, i++) add('bunch', base, k); i--; continue; }
        if (kind === 'tied') { add('tied', posts[postIdx++ % posts.length], 0); continue; }
        add(kind, null, 0);
      }
    }
    function add(kind, anchor, k) {
      const bonus = kind === 'bonus';
      const color = bonus ? 0xf2c14e : COLORS[Math.floor(rr() * (COLORS.length - 1))];
      const mesh = TG.balloon(color, bonus);
      const size = 1.55 * sizeK * (bonus ? 0.85 : 1);
      mesh.scale.setScalar(size);
      TS.World.linearize(mesh);
      g.add(mesh); g.add(mesh.userData.line);
      const t = { id: 'b' + mode.targets.length, kind: 'sphere', mesh, line: mesh.userData.line, alive: true, pos: new T.Vector3(), prev: new T.Vector3(), vel: new T.Vector3(), r: 0.215 * size + 0.004,
        type: kind, bonus, anchor: anchor ? anchor.clone() : null, len: 0, phase: rr() * 6, k, state: 'live', gone: false, fall: 0 };
      if (kind === 'tied') { t.len = U.lerp(1.4, 2.8, rr()); t.pos.copy(anchor).add(new T.Vector3(0, t.len, 0)); }
      else if (kind === 'bunch') { t.len = 1.6 + 0.25 * k; t.pos.copy(anchor).add(new T.Vector3((k - 1) * 0.42, t.len, (k % 2) * 0.3)); t.rise = 0.35 * speedK; }
      else if (kind === 'rise') { t.pos.set(U.lerp(-7, 7, rr()), U.lerp(0.6, 3, rr()), -U.lerp(11, 20, rr())); t.rise = U.lerp(0.55, 1.1, rr()) * speedK; }
      else if (kind === 'drift' || bonus) { const fromLeft = rr() < 0.5; t.pos.set(fromLeft ? -14 : 14, U.lerp(2.5, 6.5, rr()), -U.lerp(11, 20, rr())); t.dir = fromLeft ? 1 : -1; t.drift = U.lerp(1.0, 2.2, rr()) * speedK * (bonus ? 1.6 : 1); }
      t.prev.copy(t.pos);
      // string chain init
      const ch = mesh.userData.chain; ch.forEach((c, i) => { c.p.copy(t.pos).add(new T.Vector3(0, -0.27 * size - i * mesh.userData.segLen, 0)); c.q.copy(c.p); });
      mode.targets.push(t);
    }
    const tmp = new T.Vector3();
    mode.step = function (h) {
      this.time += h;
      for (const t of this.targets) {
        if (t.state === 'gone') continue;
        const w = windAt(t.pos, this.time, wind);
        const ex = t.vel.clone();
        if (t.state === 'live') {
          if (t.type === 'tied' || t.type === 'bunch') {
            if (t.type === 'bunch') t.anchor.y += t.rise * h * (this.calm ? 9 : 1);
            if (this.calm && t.type === 'tied') { t.type = 'rise'; t.rise = 1.5; t.anchor = null; }
            if (t.anchor) {
              // pendulum around the anchor driven by the wind (string length t.len), critically damped
              const sway = tmp.copy(w).multiplyScalar(0.35);
              const target = tmp.set(t.anchor.x + sway.x + Math.sin(this.time * 1.3 + t.phase) * 0.08, t.anchor.y + t.len, t.anchor.z + sway.z);
              const np = t.pos.clone().lerp(target, 1 - Math.exp(-2.2 * h));
              t.vel.copy(np).sub(t.pos).multiplyScalar(1 / h); t.pos.copy(np);
            }
          }
          if (t.type === 'rise') { const v = tmp.copy(w).multiplyScalar(0.7); v.y = t.rise * (this.calm ? 2.4 : 1); t.vel.lerp(v, 1 - Math.exp(-1.5 * h)); t.pos.addScaledVector(t.vel, h); }
          if (t.type === 'drift' || t.bonus) {
            const v = tmp.set(t.dir * t.drift + w.x * 0.2, Math.sin(this.time * (t.bonus ? 2.2 : 1.2) + t.phase) * (t.bonus ? 0.9 : 0.35) + (this.calm ? 3.2 : 0), w.z * 0.3);
            t.vel.lerp(v, 1 - Math.exp(-2 * h)); t.pos.addScaledVector(t.vel, h);
          }
          if (t.pos.y > (this.calm ? 15 : 22) || Math.abs(t.pos.x) > 24) { t.alive = false; t.state = 'gone'; t.mesh.visible = false; t.line.visible = false; }
        }
        // string verlet: top fixed to the knot; tied strings fixed at the anchor too
        const ch = t.mesh.userData.chain, seg = t.mesh.userData.segLen * (t.len ? Math.max(1, t.len / (ch.length * t.mesh.userData.segLen)) : 1);
        const knot = tmp.copy(t.pos).add(new T.Vector3(0, -0.27 * t.mesh.scale.y, 0));
        for (let i = 0; i < ch.length; i++) {
          const c = ch[i]; if (i === 0 && t.state === 'live') { c.p.copy(knot); c.q.copy(knot); continue; }
          const vx = (c.p.x - c.q.x) * 0.96, vy = (c.p.y - c.q.y) * 0.96, vz = (c.p.z - c.q.z) * 0.96;
          c.q.copy(c.p); c.p.x += vx + w.x * 0.02 * h; c.p.y += vy - 9.81 * h * h * (t.state === 'live' ? 0.4 : 1); c.p.z += vz + w.z * 0.02 * h;
          if (c.p.y < 0.01) c.p.y = 0.01;
        }
        for (let it = 0; it < 3; it++) for (let i = 1; i < ch.length; i++) {
          const a = ch[i - 1], b = ch[i], d = tmp.subVectors(b.p, a.p), L = d.length() || 1e-6, diffL = (L - seg) / L;
          if (i - 1 === 0 && t.state === 'live') b.p.addScaledVector(d, -diffL); else { a.p.addScaledVector(d, diffL * 0.5); b.p.addScaledVector(d, -diffL * 0.5); }
        }
        if ((t.type === 'tied' || t.type === 'bunch') && t.anchor && t.state === 'live') ch[ch.length - 1].p.copy(t.anchor);
        if (t.state === 'popped') { t.fall += h; if (t.fall > 2.2) { t.state = 'gone'; t.line.visible = false; } }
      }
    };
    function draw() {
      for (const t of mode.targets) {
        if (t.state === 'gone') continue;
        if (t.state === 'live') { t.mesh.position.copy(t.pos); t.mesh.rotation.z = U.clamp(-t.vel.x * 0.05, -0.25, 0.25); t.mesh.rotation.x = U.clamp(t.vel.z * 0.05, -0.2, 0.2); }
        const ch = t.mesh.userData.chain, arr = t.line.geometry.attributes.position.array;
        ch.forEach((c, i) => { arr[i * 3] = c.p.x; arr[i * 3 + 1] = c.p.y; arr[i * 3 + 2] = c.p.z; });
        t.line.geometry.attributes.position.needsUpdate = true;
        if (t.state === 'popped') t.line.material.opacity = Math.max(0, 0.85 * (1 - t.fall / 2.2));
      }
      wheel.userData.hub.rotation.z += 0;
    }
    let wheelA = 0;
    mode.env = { group: g, palette: PALETTE, updaters: [(dt, time) => { draw(); wheelA += dt * 0.06; const hub = wheel.userData.hub; hub.rotation.z = wheelA; wheel.userData.cabins.forEach(cb => { const a = cb.userData.a + wheelA; cb.position.set(Math.sin(cb.userData.a) * 11 * 0 + Math.cos(cb.userData.a) * 0, 0, 0); cb.position.set(Math.cos(cb.userData.a) * 11, Math.sin(cb.userData.a) * 11 - 0.6, 0); cb.rotation.z = -wheelA; }); buntings.forEach((b, i) => b.children.forEach((m, k) => { m.rotation.x = m.userData.base + Math.sin(time * 2.3 + k * 0.6 + i) * 0.18; })); }] };
    mode.stance = { pos: new T.Vector3(0.6, 0, 0), dir: new T.Vector3(-Math.sin(0.2), 0, -Math.cos(0.2)) };   // turned 11° so the field is centred in the archer's comfortable range
    mode.framing = { side: 1.0, back: 2.5, height: 1.8, lookDist: 14, lookHeight: 2.6 };
    mode.defaultRange = 20; mode.defaultPitch = 0.1; mode.pitchMax = 0.8;
    mode.roundComplete = function () { return !this.targets.some(t => t.alive); };
    mode.startRound = function (round) { this.calm = false; this.time = 0; spawn(round); };
    mode.calmDown = function () { this.calm = true; };
    mode.onHit = function (hit) {
      const c = hit.collider;
      if (c.kind === 'plane') return { kind: 'ground', points: 0, stick: true, label: 'لم يُصب' };
      const t = c.ref;
      t.alive = false; t.state = 'popped'; t.mesh.userData.env.visible = false; t.mesh.children.forEach(m => { m.visible = false; });
      const col = t.mesh.userData.mat.color.getHex();
      const pts = t.bonus ? 150 : t.type === 'drift' ? 70 : t.type === 'rise' ? 60 : 50;
      return {
        kind: 'balloon', target: t, points: pts, success: true, consume: false, label: t.bonus ? 'بالون ذهبي!' : 'فرقعة!', bonus: t.bonus,
        fx: (p) => { const fx = ctx.fx; fx.burst('rubber', p, { count: 16, colors: [col], speed: 4.5, size: 0.06, life: 1.1, gravity: 6, drag: 2.5, vel: t.vel }); if (t.bonus) fx.burst('confetti', p, { count: 40, colors: [0xf2c14e, 0xffffff, 0x8A1538], speed: 3, size: 0.035, life: 1.6, gravity: 1.5, drag: 1.4 }); ctx.audio && ctx.audio.play('pop', {}); if (t.bonus) ctx.audio && ctx.audio.play('bull'); }
      };
    };
    mode.startRound(0);
    return mode;
  }
  TS.Modes = TS.Modes || {}; TS.Modes.balloons = { create, PALETTE };
})(typeof window !== 'undefined' ? window : globalThis);
