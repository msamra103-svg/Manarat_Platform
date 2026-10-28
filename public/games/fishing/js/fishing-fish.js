/* صيد الأسماك V24 — Gulf fish species, swimming AI and the hooked-fish fight model.
 * Pure deterministic code (no THREE). Shared by the renderer, the GLB exporter and Node tests.
 */
(function (root) {
  'use strict';
  const P = (typeof module !== 'undefined' && module.exports) ? require('./fishing-physics.js') : root.FishingPhysics;
  const { V, clamp, lerp, smooth, Sea, seabed, ROCKS, TAU } = P;

  /* Body profiles: [u, depth, width, centreline] as fractions of total length; u = 0 tail tip, 1 snout.
   * Proportions follow published descriptions (body depth / standard length) of each species. */
  const SPECIES = {
    hamour: {
      id: 'hamour', ar: 'هامور', en: 'Orange-spotted grouper', sci: 'Epinephelus coioides',
      lengths: [0.36, 0.5], count: 3, cruise: 0.28, burst: 1.7, turn: 2.2, depth: [-4.6, -2.0], school: 0.05, wary: 1.35, strength: 1.0, dive: -3.6,
      body: [[0.13, 0.1, 0.044, 0], [0.22, 0.15, 0.064, 0], [0.35, 0.215, 0.1, 0], [0.5, 0.255, 0.12, -0.004], [0.62, 0.262, 0.122, -0.008], [0.74, 0.238, 0.114, -0.01], [0.85, 0.19, 0.096, -0.012], [0.93, 0.122, 0.068, -0.016], [0.985, 0.058, 0.037, -0.02], [1, 0.012, 0.01, -0.022]],
      fins: { caudal: 'rounded', dorsal: [[0.3, 0.06], [0.42, 0.075], [0.55, 0.07], [0.72, 0.06], [0.78, 0.035]], anal: [[0.25, 0.055], [0.33, 0.06], [0.38, 0.03]], pectoral: 0.11, pelvic: 0.075, caudalLen: 0.16 },
      look: { base: '#8a7a55', belly: '#d8cfae', spots: '#c8692e', spotSize: 0.011, spotCount: 260, bars: '#4f4430', bars_n: 5, fin: '#6d5a3c', eye: '#d9b55a', mouth: 'large' }
    },
    shaari: {
      id: 'shaari', ar: 'شعري', en: 'Spangled emperor', sci: 'Lethrinus nebulosus',
      lengths: [0.3, 0.44], count: 4, cruise: 0.42, burst: 2.3, turn: 2.8, depth: [-3.8, -1.3], school: 0.45, wary: 1.0, strength: 0.85, dive: -2.8,
      body: [[0.15, 0.09, 0.035, 0], [0.25, 0.16, 0.055, 0], [0.38, 0.26, 0.088, 0.004], [0.52, 0.31, 0.109, 0.01], [0.64, 0.315, 0.113, 0.012], [0.75, 0.28, 0.101, 0.002], [0.85, 0.205, 0.082, -0.018], [0.93, 0.118, 0.059, -0.034], [0.985, 0.048, 0.03, -0.045], [1, 0.012, 0.01, -0.048]],
      fins: { caudal: 'forked', dorsal: [[0.3, 0.05], [0.42, 0.075], [0.6, 0.08], [0.75, 0.07], [0.8, 0.04]], anal: [[0.24, 0.05], [0.32, 0.06], [0.38, 0.03]], pectoral: 0.12, pelvic: 0.07, caudalLen: 0.18 },
      look: { base: '#a99a62', belly: '#e9e2c6', spots: '#5aa7cf', spotSize: 0.007, spotCount: 340, bars: null, fin: '#c9a85e', eye: '#c4a25a', mouth: 'pointed', cheekLines: '#4fa6d8' }
    },
    safi: {
      id: 'safi', ar: 'صافي', en: 'White-spotted rabbitfish', sci: 'Siganus canaliculatus',
      lengths: [0.2, 0.29], count: 7, cruise: 0.48, burst: 2.0, turn: 3.4, depth: [-3.0, -0.9], school: 0.9, wary: 0.8, strength: 0.6, dive: -2.0,
      body: [[0.15, 0.08, 0.03, 0], [0.25, 0.17, 0.05, 0], [0.38, 0.295, 0.082, 0], [0.52, 0.365, 0.1, 0], [0.64, 0.355, 0.1, -0.004], [0.75, 0.3, 0.088, -0.01], [0.85, 0.21, 0.07, -0.02], [0.93, 0.12, 0.046, -0.03], [0.985, 0.05, 0.026, -0.035], [1, 0.012, 0.01, -0.036]],
      fins: { caudal: 'emarginate', dorsal: [[0.2, 0.06], [0.35, 0.09], [0.6, 0.085], [0.82, 0.07], [0.86, 0.03]], anal: [[0.2, 0.06], [0.35, 0.08], [0.55, 0.06], [0.6, 0.03]], pectoral: 0.1, pelvic: 0.06, caudalLen: 0.17 },
      look: { base: '#6f7a5e', belly: '#cfd5c4', spots: '#eef2e6', spotSize: 0.008, spotCount: 220, bars: null, fin: '#7a805e', eye: '#d8c27a', mouth: 'small' }
    }
  };
  const ORDER = ['hamour', 'shaari', 'safi'];

  function catmull(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
  /* body cross-section at u ∈ [u0,1]: {h, w, c} as fractions of total length */
  function profile(sp, u) {
    const pts = sp.body; if (u <= pts[0][0]) return { h: pts[0][1], w: pts[0][2], c: pts[0][3] };
    let i = 0; while (i < pts.length - 2 && u > pts[i + 1][0]) i++;
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(pts.length - 1, i + 2)], t = (u - b[0]) / (c[0] - b[0]);
    return { h: Math.max(0, catmull(a[1], b[1], c[1], d[1], t)), w: Math.max(0, catmull(a[2], b[2], c[2], d[2], t)), c: catmull(a[3], b[3], c[3], d[3], t) };
  }
  /* Volume of the body loft (elliptical sections) — the same surface the 3D model is built from. */
  function volume(sp, length) { const u0 = sp.body[0][0], n = 200; let v = 0; for (let i = 0; i < n; i++) { const u = u0 + (1 - u0) * (i + 0.5) / n, s = profile(sp, u); v += Math.PI / 4 * s.h * s.w * (1 - u0) / n; } return v * length ** 3; }
  const DENSITY = 1050; // kg/m³, typical wet fish tissue
  /* Volume of the shipped 3-D fish models (closed-mesh volume of assets/models/fish-*.glb at unit length,
   * measured by tools/export.html → assets/models/manifest.json). Weight = density × volume. */
  const MODEL_VOLUME_L3 = { hamour: 0.02004, shaari: 0.01914, safi: 0.01809 };
  function weight(sp, length) { return DENSITY * (MODEL_VOLUME_L3[sp.id] ? MODEL_VOLUME_L3[sp.id] * length ** 3 : volume(sp, length)); }

  /* ---------- swimming agents ---------- */
  const HABITAT = { c: [0.4, -2.6, -10.5], r: [11, 2.2, 7.5] };
  class Fish {
    constructor(id, sp, length, pos, yaw, rand) {
      Object.assign(this, { id, sp, length, pos: V.copy(pos), vel: [Math.sin(yaw) * sp.cruise, 0, Math.cos(yaw) * sp.cruise], yaw, pitch: 0, roll: 0, speed: sp.cruise, tail: rand() * TAU, tailAmp: 0.08, bend: 0, mouth: 0, mode: 'wander', modeT: 0, goal: null, face: null, visible: true, landed: false, rand, wander: null, wanderT: 0, yawRate: 0, gill: rand() * TAU, flop: 0 });
      this.weight = weight(sp, length);
      this.fwd = V.norm(this.vel);
    }
    get mouthPos() { return V.add(this.pos, V.mul(this.fwd, this.length * 0.5)); }
  }

  class School {
    constructor(seed) {
      const rand = P.rng(seed >>> 0 || 1); this.rand = rand; this.fish = []; let id = 0;
      for (const key of ORDER) {
        const sp = SPECIES[key];
        for (let i = 0; i < sp.count; i++) {
          const L = lerp(sp.lengths[0], sp.lengths[1], rand());
          const x = HABITAT.c[0] + (rand() * 2 - 1) * HABITAT.r[0] * 0.8, z = HABITAT.c[2] + (rand() * 2 - 1) * HABITAT.r[2] * 0.8;
          const y = clamp(lerp(sp.depth[0], sp.depth[1], rand()), seabed(x, z) + 0.6, -0.8);
          this.fish.push(new Fish(id++, sp, L, [x, y, z], rand() * TAU, rand));
        }
      }
    }
    alive() { return this.fish.filter(f => !f.landed); }
    /* nearest free fish to point p; prefer a species when given */
    pick(p, preferSpecies) {
      let best = null, bd = Infinity;
      for (const f of this.fish) { if (f.landed || f.mode !== 'wander') continue; const d = V.dist(f.pos, p) * (preferSpecies && f.sp.id !== preferSpecies ? 1.6 : 1); if (d < bd) { bd = d; best = f; } }
      return best;
    }
    replenish(seed) { // a new fish swims in from the far edge of the habitat (outside the cinematic frame), never a visible teleport
      const rand = P.rng(seed >>> 0 || 7), key = ORDER[Math.floor(rand() * ORDER.length)], sp = SPECIES[key], side = rand() < 0.5 ? -1 : 1;
      const x = HABITAT.c[0] + side * (HABITAT.r[0] + 4), z = HABITAT.c[2] - HABITAT.r[2] - 3, y = lerp(sp.depth[0], sp.depth[1], 0.5);
      const f = new Fish(this.fish.length, sp, lerp(sp.lengths[0], sp.lengths[1], rand()), [x, Math.max(y, seabed(x, z) + 0.6), z], side < 0 ? Math.PI / 2 : -Math.PI / 2, rand); this.fish.push(f); return f;
    }
    step(dt, t, boat) {
      for (const f of this.fish) {
        if (f.landed) continue;
        f.modeT += dt;
        if (f.mode === 'hooked' || f.mode === 'netted' || f.mode === 'held') { this.animate(f, dt); continue; }
        let desired;
        if (f.goal) desired = this.arrive(f, f.goal.pos, f.goal.speed, f.goal.slow || 0.6);
        else desired = this.wanderVel(f, dt);
        if (!f.goal || f.goal.flock) desired = V.add(desired, this.flock(f));
        desired = V.add(desired, this.avoid(f, t, boat));
        this.integrate(f, desired, dt, f.goal && f.goal.burst ? f.sp.burst : f.goal ? Math.max(f.sp.cruise * 1.8, f.goal.speed) : f.sp.cruise * 1.25);
        this.constrain(f, t, boat, f.goal && f.goal.surface);
        this.animate(f, dt);
      }
    }
    wanderVel(f, dt) {
      f.wanderT -= dt;
      if (!f.wander || f.wanderT <= 0 || V.dist(f.pos, f.wander) < 0.8) {
        const r = f.rand, H = HABITAT; const x = H.c[0] + (r() * 2 - 1) * H.r[0], z = H.c[2] + (r() * 2 - 1) * H.r[2];
        f.wander = [x, clamp(lerp(f.sp.depth[0], f.sp.depth[1], r()), seabed(x, z) + 0.7, -0.9), z]; f.wanderT = 4 + r() * 6;
      }
      return this.arrive(f, f.wander, f.sp.cruise * (0.75 + 0.35 * Math.sin(f.id * 1.7 + f.modeT * 0.3)), 1.2);
    }
    arrive(f, target, speed, slowR) { const d = V.sub(target, f.pos), l = V.len(d); if (l < 1e-6) return [0, 0, 0]; return V.mul(d, Math.min(speed, speed * l / slowR) / l); }
    flock(f) {
      let sep = [0, 0, 0], ali = [0, 0, 0], coh = [0, 0, 0], n = 0;
      for (const o of this.fish) {
        if (o === f || o.landed || o.mode !== 'wander') continue; const d = V.sub(f.pos, o.pos), l = V.len(d), rs = (f.length + o.length) * 1.4;
        if (l < rs && l > 1e-5) sep = V.add(sep, V.mul(d, (rs - l) / (l * rs) * 0.9));
        if (o.sp === f.sp && l < 3.2) { ali = V.add(ali, o.vel); coh = V.add(coh, o.pos); n++; }
      }
      let out = sep; const w = f.sp.school;
      if (n && w > 0) { ali = V.mul(ali, 1 / n); coh = V.sub(V.mul(coh, 1 / n), f.pos); out = V.add(out, V.add(V.mul(V.sub(ali, f.vel), 0.35 * w), V.mul(coh, 0.18 * w))); }
      return out;
    }
    avoid(f, t, boat) {
      let a = [0, 0, 0]; const half = f.length * 0.2;
      const surf = Sea.height(f.pos[0], f.pos[2], t) - 0.45 - half; if (f.pos[1] > surf) a[1] -= (f.pos[1] - surf) * 2.5;
      const bed = seabed(f.pos[0], f.pos[2]) + 0.45 + half; if (f.pos[1] < bed) a[1] += (bed - f.pos[1]) * 2.5;
      for (const r of ROCKS) { const d = V.sub(f.pos, r.c), l = V.len(d), R = r.r + f.length * 0.6 + 0.3; if (l < R && l > 1e-5) a = V.add(a, V.mul(d, (R - l) / l * 1.6)); }
      if (boat) { const L = boat.toLocal(f.pos), e = (L[0] / 3.6) ** 2 + (L[2] / 1.7) ** 2; if (e < 1 && L[1] > -1.4) { const away = boat.dirToWorld(V.norm([L[0] / 3.6, 0, L[2] / 1.7])); a = V.add(a, V.mul(away, (1 - e) * 1.8)); a[1] -= (1 - e) * 0.6; } }
      if (!f.goal) { const H = HABITAT; const q = [(f.pos[0] - H.c[0]) / H.r[0], 0, (f.pos[2] - H.c[2]) / H.r[2]], e = Math.hypot(q[0], q[2]); if (e > 1) a = V.sub(a, V.mul([q[0] * H.r[0], 0, q[2] * H.r[2]], (e - 1) * 0.12 / e)); }
      return a;
    }
    integrate(f, desired, dt, maxSpeed) {
      const steer = V.sub(desired, f.vel), maxAcc = f.sp.burst * 2.6, l = V.len(steer);
      const acc = l > maxAcc ? V.mul(steer, maxAcc / l) : steer;
      let vel = V.add(f.vel, V.mul(acc, dt)); const s = V.len(vel); if (s > maxSpeed) vel = V.mul(vel, maxSpeed / s);
      f.vel = vel; f.speed = V.len(vel); f.pos = V.add(f.pos, V.mul(vel, dt));
      const look = f.face ? f.face : vel; this.orient(f, look, dt);
    }
    orient(f, look, dt) {
      if (V.len(look) < 0.02) return;
      const yaw = Math.atan2(look[0], look[2]); let dy = yaw - f.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
      const maxTurn = f.sp.turn * dt * (f.mode === 'fight' || f.mode === 'escape' ? 2.2 : 1), step = clamp(dy, -maxTurn, maxTurn);
      f.yaw += step; f.yawRate = lerp(f.yawRate, step / Math.max(dt, 1e-4), 0.2);
      const pitch = clamp(Math.atan2(look[1], Math.hypot(look[0], look[2])), -0.6, 0.6); f.pitch = lerp(f.pitch, pitch, clamp(dt * 3));
      f.fwd = [Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch)];
    }
    constrain(f, t, boat, allowSurface) {
      const half = f.length * 0.17, top = Sea.height(f.pos[0], f.pos[2], t) - (allowSurface ? half * 0.4 : 0.22 + half);
      if (f.pos[1] > top) { f.pos[1] = top; if (f.vel[1] > 0) f.vel[1] = 0; }
      const bed = seabed(f.pos[0], f.pos[2]) + 0.2 + half; if (f.pos[1] < bed) { f.pos[1] = bed; if (f.vel[1] < 0) f.vel[1] = 0; }
      for (const r of ROCKS) { const d = V.sub(f.pos, r.c), l = V.len(d), R = r.r + half + 0.08; if (l < R && l > 1e-5) f.pos = V.add(r.c, V.mul(d, R / l)); }
      if (boat) { const L = boat.toLocal(f.pos), e = (L[0] / 2.95) ** 2 + (L[2] / 1.12) ** 2; if (e < 1 && L[1] > -0.75) { if (L[1] > -0.75 + 0.4 * e) { const s = 1 / Math.sqrt(e || 1e-6); L[0] *= s; L[2] *= s; } f.pos = boat.toWorld(L); } }
    }
    animate(f, dt) {
      const bl = f.speed / f.length, freq = clamp(0.85 + 1.05 * bl, 0.85, 9.5) * (f.mode === 'netted' ? 1.8 : 1);
      f.tail += TAU * freq * dt; f.gill += dt * (2.2 + bl);
      const targetAmp = (f.mode === 'netted' || f.mode === 'held') ? 0.22 : 0.055 + 0.03 * Math.min(bl / 3, 1) + Math.min(Math.abs(f.yawRate) * 0.04, 0.08) + (f.mode === 'fight' ? 0.05 : 0);
      f.tailAmp = lerp(f.tailAmp, targetAmp, clamp(dt * 4)); f.bend = lerp(f.bend, clamp(-f.yawRate * 0.18, -0.45, 0.45), clamp(dt * 5));
    }
  }

  /* ---------- deterministic fight model (correct answers only) ----------
   * The landing is guaranteed: retrieve speed has a positive floor, stamina has a hard time cap and the
   * drag slips line instead of breaking it. Player reeling only shortens the fight / changes the drama. */
  class Fight {
    constructor(sp, startLength, seed) {
      this.sp = sp; this.L = startLength; this.L0 = startLength; this.t = 0; this.stamina = 1; this.tension = 0.3; this.slip = 0; this.run = 0; this.runDir = 0; this.retrieve = 0;
      this.rand = P.rng(seed); this.nextRun = 0.6 + this.rand() * 0.6; this.runLeft = 0; this.landLength = 2.45; this.done = false; this.cap = 13; this.slipTotal = 0; this.zone = 'green';
    }
    step(dt, reel) {
      if (this.done) return this;
      this.t += dt; const sp = this.sp; reel = reel ? 1 : 0;
      if (this.runLeft > 0) { this.runLeft -= dt; if (this.runLeft <= 0) { this.nextRun = 1.0 + this.rand() * 1.3; } }
      else { this.nextRun -= dt; if (this.nextRun <= 0 && this.stamina > 0.18) { this.runLeft = 0.7 + this.rand() * 0.6; this.runDir = this.rand() < 0.5 ? -1 : 1; } }
      const running = this.runLeft > 0 ? 1 : 0; this.run = lerp(this.run, running * this.runDir, clamp(dt * 4));
      const capStamina = clamp(1 - this.t / this.cap); // hard cap: the fish is exhausted by `cap` seconds
      const pull = sp.strength * this.stamina * (0.3 + 0.7 * running);
      const target = clamp(0.22 + pull * 0.62 + reel * 0.22 * (0.4 + this.stamina * 0.6));
      this.tension = lerp(this.tension, target, clamp(dt * 6));
      this.zone = this.tension > 0.84 ? 'red' : this.tension > 0.36 ? 'green' : 'low';
      const drain = (0.055 + 0.07 * (this.zone === 'green' ? 1 : 0.4) + 0.03 * reel) * dt;
      this.stamina = Math.min(capStamina, Math.max(0, this.stamina - drain));
      const base = 0.78 + 0.5 * (1 - this.stamina), player = reel * (this.zone === 'red' ? 0.25 : 0.95);
      this.retrieve = (base + player) * (1 - 0.55 * pull * running);
      this.slip = this.zone === 'red' && running ? 0.85 * (this.tension - 0.84) / 0.16 * this.stamina : 0;
      this.slipTotal += this.slip * dt;
      const before = this.L; this.L = Math.max(this.landLength, this.L - (this.retrieve - this.slip) * dt);
      this.delta = this.L - before;
      if (this.L <= this.landLength + 1e-6) this.done = true;
      return this;
    }
  }

  const api = { SPECIES, ORDER, profile, volume, weight, DENSITY, HABITAT, Fish, School, Fight };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FishingFish = api;
})(typeof window !== 'undefined' ? window : globalThis);
