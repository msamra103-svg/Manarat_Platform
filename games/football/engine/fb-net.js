/* Goal net: four deformable panels (back, roof, two sides). A damped membrane model: every vertex has a displacement + velocity, coupled to its
 * neighbours and pulled back to rest. Ball impacts (reported by FB.Ball) inject momentum at the correct place, so the net bulges and ripples
 * exactly where the ball hit it. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3;

  function netTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.clearRect(0, 0, 128, 128);
    x.strokeStyle = '#f4f4ee'; x.lineWidth = 9; x.lineCap = 'round';
    // hex-ish diamond mesh
    x.beginPath(); x.moveTo(0, 64); x.lineTo(64, 0); x.lineTo(128, 64); x.lineTo(64, 128); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(-64, 0); x.lineTo(0, -64); x.stroke(); x.beginPath(); x.moveTo(128, 0); x.lineTo(192, 64); x.stroke();
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.encoding = T.sRGBEncoding; return t;
  }

  class Panel {
    constructor(c00, c10, c01, c11, nu, nv, tile) {            // corners: u along x, v along the other direction
      this.nu = nu; this.nv = nv; const n = (nu + 1) * (nv + 1);
      this.rest = new Float32Array(n * 3); this.pos = new Float32Array(n * 3); this.d = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
      const uv = new Float32Array(n * 2), idx = [];
      const a = new V();
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = i / nu, v = j / nv, k = j * (nu + 1) + i;
        a.copy(c00).lerp(c10, u); const b = new V().copy(c01).lerp(c11, u); a.lerp(b, v);
        this.rest[k * 3] = a.x; this.rest[k * 3 + 1] = a.y; this.rest[k * 3 + 2] = a.z; uv[k * 2] = u * tile[0]; uv[k * 2 + 1] = v * tile[1];
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = j * (nu + 1) + i; idx.push(k, k + 1, k + nu + 1, k + 1, k + nu + 2, k + nu + 1); }
      this.pos.set(this.rest);
      const g = this.geom = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(this.pos, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(idx);
      g.setAttribute('normal', new T.BufferAttribute(new Float32Array(n * 3), 3)); g.boundingSphere = new T.Sphere(new V(0, 1.2, FB.PITCH.goalZ - 1), 5);
      this.n = n;
    }
    impulse(x, y, z, dx, dy, dz, radius, amt) {
      const r2 = radius * radius, { rest, vel } = this;
      for (let k = 0; k < this.n; k++) {
        const px = rest[k * 3] - x, py = rest[k * 3 + 1] - y, pz = rest[k * 3 + 2] - z, q = (px * px + py * py + pz * pz) / r2; if (q > 4) continue;
        const w = Math.exp(-q * 1.6) * amt; vel[k * 3] += dx * w; vel[k * 3 + 1] += dy * w; vel[k * 3 + 2] += dz * w;
      }
    }
    step(dt, pinned) {
      const { nu, nv, d, vel, rest, pos } = this, stiff = 260, couple = 520, damp = 3.2;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const k = (j * (nu + 1) + i) * 3, edge = i === 0 || j === 0 || i === nu || j === nv;
        if (edge && pinned) { vel[k] = vel[k + 1] = vel[k + 2] = 0; d[k] = d[k + 1] = d[k + 2] = 0; continue; }
        for (let c = 0; c < 3; c++) {
          let s = 0, cnt = 0;
          if (i > 0) { s += d[k - 3 + c]; cnt++; } if (i < nu) { s += d[k + 3 + c]; cnt++; }
          if (j > 0) { s += d[k - (nu + 1) * 3 + c]; cnt++; } if (j < nv) { s += d[k + (nu + 1) * 3 + c]; cnt++; }
          const acc = couple * (s / cnt - d[k + c]) - stiff * d[k + c] - damp * vel[k + c];
          vel[k + c] += acc * dt;
        }
      }
      let any = false;
      for (let k = 0; k < this.n * 3; k++) { d[k] += vel[k] * dt; pos[k] = rest[k] + d[k]; if (!any && (Math.abs(d[k]) > 1e-4 || Math.abs(vel[k]) > 1e-3)) any = true; }
      this.active = any;
    }
  }

  class Net {
    constructor(opts = {}) {
      const g = FB.PITCH, hw = g.goalHalf, H = g.goalHeight, z0 = g.goalZ, nT = g.netDepthTop, nB = g.netDepthBottom, q = opts.q || 1;
      const nuB = Math.round(26 * q), nvB = Math.round(14 * q), nvT = Math.round(8 * q), nvS = Math.round(14 * q), nuS = Math.round(10 * q);
      const P = (x, y, z) => new V(x, y, z);
      this.panels = [
        new Panel(P(-hw, H, z0 - nT), P(hw, H, z0 - nT), P(-hw, 0, z0 - nB), P(hw, 0, z0 - nB), nuB, nvB, [hw * 2 / 0.12, H / 0.12]),        // back
        new Panel(P(-hw, H, z0), P(hw, H, z0), P(-hw, H, z0 - nT), P(hw, H, z0 - nT), nuB, nvT, [hw * 2 / 0.12, nT / 0.12]),                  // roof
        new Panel(P(-hw, 0, z0), P(-hw, H, z0), P(-hw, 0, z0 - nB), P(-hw, H, z0 - nT), nuS, nvS, [H / 0.12, nB / 0.12]),                     // left side (+x is the keeper's left)
        new Panel(P(hw, 0, z0), P(hw, H, z0), P(hw, 0, z0 - nB), P(hw, H, z0 - nT), nuS, nvS, [H / 0.12, nB / 0.12])
      ];
      this.tex = netTexture();
      this.mat = new T.MeshLambertMaterial({ map: this.tex, color: 0xf4f4ee, alphaTest: 0.35, side: T.DoubleSide, transparent: false });
      this.group = new T.Group(); this.group.name = 'goal-net';
      for (const p of this.panels) { const m = new T.Mesh(p.geom, this.mat); m.frustumCulled = false; m.receiveShadow = false; this.group.add(m); }
      this.acc = 0; this.shake = 0;
    }
    /** register an impact from the ball: world position, velocity vector, speed */
    hit(x, y, z, vx, vy, vz) {
      const sp = Math.hypot(vx, vy, vz); if (sp < 0.5) return; const k = 1 / sp, amt = Math.min(7.5, 0.7 + sp * 0.34);
      for (const p of this.panels) p.impulse(x, y, z, vx * k, vy * k, vz * k, 0.85 + Math.min(0.7, sp * 0.02), amt);
    }
    update(dt) {
      this.acc += dt; let n = 0;
      while (this.acc >= 1 / 120 && n++ < 6) { this.acc -= 1 / 120; for (const p of this.panels) p.step(1 / 120, true); }
      for (const p of this.panels) if (p.active || p.dirty) { p.geom.attributes.position.needsUpdate = true; p.geom.computeVertexNormals(); p.dirty = p.active; }
    }
    reset() { for (const p of this.panels) { p.d.fill(0); p.vel.fill(0); p.pos.set(p.rest); p.geom.attributes.position.needsUpdate = true; p.active = false; } }
    maxDisplacement() { let m = 0; for (const p of this.panels) for (let k = 0; k < p.n * 3; k++) m = Math.max(m, Math.abs(p.d[k])); return m; }
    dispose() { for (const p of this.panels) p.geom.dispose(); this.mat.dispose(); this.tex.dispose(); }
  }
  FB.Net = Net;
})(typeof window !== 'undefined' ? window : globalThis);
