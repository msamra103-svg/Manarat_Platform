/* Instanced, animated crowd. Thousands of spectators (seated / standing, varied clothing, skin, traditional headwear) animated entirely on the GPU:
 * idle sway, collective excitement (jumping, arms up), a travelling "wave", and waving school pennants. LOD by quality tier. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, M = FB.math, S = FB.Stadium;
  const CZ = FB.PITCH.centerZ;

  function figureGeometry() {
    const parts = [], add = (geo, part, tx, ty, tz) => { geo = geo.toNonIndexed ? geo.toNonIndexed() : geo; geo.translate(tx, ty, tz); const n = geo.attributes.position.count; geo.setAttribute('aPart', new T.BufferAttribute(new Float32Array(n).fill(part), 1)); parts.push(geo); };
    add(new T.BoxGeometry(0.44, 0.56, 0.26), 0, 0, 0.28, 0);
    add(new T.SphereGeometry(0.115, 6, 5), 1, 0, 0.7, 0.01);
    add(new T.BoxGeometry(0.09, 0.5, 0.09), 2, 0.265, 0.5 - 0.25, 0);      // left arm hangs from the shoulder pivot (0.265,0.5)
    add(new T.BoxGeometry(0.09, 0.5, 0.09), 3, -0.265, 0.5 - 0.25, 0);
    let total = 0; for (const g of parts) total += g.attributes.position.count;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), part = new Float32Array(total); let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); part.set(g.attributes.aPart.array, o); o += g.attributes.position.count; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('aPart', new T.BufferAttribute(part, 1)); return g;
  }
  function pennantGeometry() {
    const g = new T.PlaneGeometry(0.5, 0.32, 6, 1); g.translate(0.25, 0.16, 0); const n = g.attributes.position.count; g.setAttribute('aPart', new T.BufferAttribute(new Float32Array(n), 1)); return g;
  }

  const SKIN = ['#f0c4a0', '#dcae86', '#c48f62', '#a56d46', '#7a4b2e'].map(c => FB.color(c));
  const CLOTH = [['#8a1538', 46], ['#f4efe4', 24], ['#a31c46', 6], ['#e9dfc7', 6], ['#1f3b4d', 5], ['#cfa95a', 4], ['#f7f2e8', 5], ['#2a2d31', 4]];

  function build(scene, stadium, opts = {}) {
    const count = opts.count || 5000, reduced = !!opts.reduced;
    const geo = figureGeometry(), mat = new T.MeshLambertMaterial({ color: 0xffffff });
    const uni = { uTime: { value: 0 }, uExcite: { value: 0.1 }, uWave: { value: -1 }, uSkin: { value: SKIN }, uCalm: { value: reduced ? 1 : 0 } };
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute float aPart; attribute vec4 aInst; attribute vec4 aCol;
        uniform float uTime, uExcite, uWave, uCalm; varying float vPart; varying float vSkin; varying float vHw; varying float vLy;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = aInst.x, stand0 = aInst.y, per = aInst.z, wpos = aInst.w;
        float e = uExcite * (0.45 + 0.55 * per) * (1.0 - 0.7 * uCalm);
        float t = uTime;
        float jump = e * abs(sin(t * (4.6 + per * 2.4) + ph * 6.2831)) * 0.20;
        float wv = (uWave >= 0.0) ? smoothstep(0.0, 1.0, 1.0 - abs(fract(wpos - uWave + 0.5) - 0.5) * 9.0) : 0.0;
        wv *= (1.0 - 0.8 * uCalm);
        float up = max(stand0, max(wv, step(0.55, e) * step(0.4, per)));
        vPart = aPart; vSkin = aCol.x; vHw = aCol.y; vLy = position.y;
        vec3 p = transformed;
        if (aPart > 1.5) {
          float sgn = aPart > 2.5 ? -1.0 : 1.0; vec3 pv = vec3(sgn * 0.265, 0.5, 0.0); vec3 d = p - pv;
          float ang = 0.05 + e * (2.45 + 0.55 * sin(t * 8.5 + ph * 6.28)) * step(0.3, per) + wv * 2.7 + 0.08 * sin(t * 1.3 + ph * 9.0);
          float c = cos(ang), s = sin(ang); d = vec3(d.x + sgn * 0.12 * sin(ang), d.y * c + d.z * s, -d.y * s + d.z * c); p = pv + d;
        }
        p.y += jump + up * 0.30 + (aPart > 0.5 && aPart < 1.5 ? 0.006 * sin(t * 1.7 + ph * 7.0) : 0.0);
        p.x += 0.012 * sin(t * 1.1 + ph * 11.0) * (1.0 - uCalm);
        transformed = p;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying float vPart; varying float vSkin; varying float vHw; varying float vLy; uniform vec3 uSkin[5];`)
        .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 skinC = uSkin[int(clamp(vSkin, 0.0, 4.0))];
        if (vPart > 0.5 && vPart < 1.5) {
          diffuseColor.rgb = skinC;
          if (vHw > 0.5 && vLy > 0.69) diffuseColor.rgb = vHw > 1.5 ? vec3(0.62, 0.05, 0.12) : vec3(0.82, 0.8, 0.74);
          else if (vLy > 0.74) diffuseColor.rgb = vec3(0.025, 0.02, 0.018);
        } else if (vPart > 1.5 && vLy < 0.12) diffuseColor.rgb = skinC;`);
    };
    const inst = new T.InstancedMesh(geo, mat, count); inst.frustumCulled = false; inst.name = 'crowd';
    // ---- placement on the stepped tiers (must mirror fb-stadium's tier parameters) ----
    const tiers = [{ ax0: 44, az0: 59.5, rows: 20, depth: 0.78, y0: 1.2, rise: 0.46, fill: 0.92 }, { ax0: 60, az0: 75.5, rows: 26, depth: 0.78, y0: 13.5, rise: 0.62, fill: 0.78 }];
    const rng = M.rng(1234), cand = [];
    const clothTotal = CLOTH.reduce((a, c) => a + c[1], 0), clothCol = CLOTH.map(c => FB.color(c[0]));
    for (let ti = 0; ti < tiers.length; ti++) {
      const t = tiers[ti];
      for (let k = 0; k < t.rows; k++) {
        const ax = t.ax0 + (k + 0.5) * t.depth, az = t.az0 + (k + 0.5) * t.depth, y = t.y0 + k * t.rise + 0.46;
        let u = 0, prev = S.ringXZ(ax, az, 0), arc = 0; const step = 0.0016;
        while (u < Math.PI * 2) {
          u += step; const p = S.ringXZ(ax, az, u); arc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p;
          if (arc < 0.6) continue; arc = 0;
          const dz = p[1] - FB.PITCH.goalZ, near = 1 - M.smooth((dz - 10) / 70);        // heavier on the goal-end half (where the camera looks)
          const lateral = 1 - 0.25 * M.smooth(Math.abs(p[0]) / 60);
          const w = t.fill * (0.35 + 0.65 * near) * lateral;
          cand.push({ x: p[0], y, z: p[1], w, u: u / (Math.PI * 2), tier: ti, row: k });
        }
      }
    }
    // choose `count` seats weighted by w
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    cand.sort((a, b) => (b.w - rng() * 0.55) - (a.w - rng() * 0.55));
    const chosen = cand.slice(0, count);
    const dm = new T.Object3D(), aInst = new Float32Array(count * 4), aCol = new Float32Array(count * 4), col = new T.Color();
    chosen.forEach((c, i) => {
      dm.position.set(c.x, c.y, c.z); const yaw = Math.atan2(-c.x, CZ - c.z) + (rng() - 0.5) * 0.5; dm.rotation.set(0, yaw, 0); const sc = 0.92 + rng() * 0.16; dm.scale.set(sc, sc * (0.95 + rng() * 0.1), sc); dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix);
      let r = rng() * clothTotal, ci = 0; for (; ci < CLOTH.length - 1; ci++) { r -= CLOTH[ci][1]; if (r < 0) break; }
      col.copy(clothCol[ci]).multiplyScalar(0.85 + rng() * 0.3); inst.setColorAt(i, col);
      aInst[i * 4] = rng(); aInst[i * 4 + 1] = rng() < 0.04 ? 1 : 0; aInst[i * 4 + 2] = rng(); aInst[i * 4 + 3] = c.u;
      const white = ci === 1 || ci === 3 || ci === 6, hw = white && rng() < 0.55 ? (rng() < 0.5 ? 1 : 2) : 0;
      aCol[i * 4] = Math.floor(rng() * 5); aCol[i * 4 + 1] = hw;
    });
    inst.count = chosen.length; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    geo.setAttribute('aInst', new T.InstancedBufferAttribute(aInst, 4)); geo.setAttribute('aCol', new T.InstancedBufferAttribute(aCol, 4));
    scene.add(inst);
    // ---- pennants (school colours) held by a subset ----
    const nFlag = Math.min(260, Math.floor(chosen.length / 18));
    const fg = pennantGeometry(), fmat = new T.MeshLambertMaterial({ color: 0xffffff, side: T.DoubleSide });
    const fu = { uTime: uni.uTime, uExcite: uni.uExcite };
    fmat.onBeforeCompile = sh => { Object.assign(sh.uniforms, fu); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aInst; uniform float uTime, uExcite;').replace('#include <begin_vertex>', `#include <begin_vertex>
      float k = position.x / 0.5; float show = step(0.35, uExcite) * step(0.35, aInst.z);
      transformed.y = transformed.y * show + sin(uTime * 7.0 - position.x * 14.0 + aInst.x * 6.28) * 0.04 * k * show + (0.9 + 0.35 * abs(sin(uTime * 3.0 + aInst.x * 6.28)) * uExcite) * show;
      transformed.x *= show; transformed.z = cos(uTime * 6.0 - position.x * 11.0) * 0.03 * k * show;`); };
    const fi = new T.InstancedMesh(fg, fmat, nFlag); fi.frustumCulled = false; const fInst = new Float32Array(nFlag * 4);
    for (let i = 0; i < nFlag; i++) { const c = chosen[Math.floor(rng() * chosen.length)]; dm.position.set(c.x, c.y + 0.3, c.z); dm.rotation.set(0, Math.atan2(-c.x, CZ - c.z) + (rng() - 0.5) * 0.6, 0); dm.scale.set(1, 1, 1); dm.updateMatrix(); fi.setMatrixAt(i, dm.matrix); col.set(i % 3 === 0 ? FB.color('#f7f2e8') : FB.color('#8a1538')); fi.setColorAt(i, col); fInst[i * 4] = rng(); fInst[i * 4 + 2] = rng(); }
    fg.setAttribute('aInst', new T.InstancedBufferAttribute(fInst, 4)); fi.instanceMatrix.needsUpdate = true; if (fi.instanceColor) fi.instanceColor.needsUpdate = true; scene.add(fi);
    const api = {
      mesh: inst, flags: fi, count: chosen.length, excite: 0.1, target: 0.1, wave: -1, waveOn: false, waveT: 0,
      setExcitement(v) { this.target = M.clamp(v); },
      pulse(v, hold = 2.5) { this.target = M.clamp(v); this.hold = hold; },
      startWave() { this.waveOn = true; this.waveT = 0; },
      update(dt, t) {
        if (this.hold > 0) { this.hold -= dt; } else if (this.target > 0.12) this.target = Math.max(0.12, this.target - dt * 0.22);
        this.excite = M.damp(this.excite, this.target, this.target > this.excite ? 4 : 0.8, dt); uni.uExcite.value = this.excite; uni.uTime.value = t;
        if (this.waveOn) { this.waveT += dt; uni.uWave.value = (this.waveT / 7.0) % 1; if (this.waveT > 14) { this.waveOn = false; uni.uWave.value = -1; } }
      },
      setReduced(r) { uni.uCalm.value = r ? 1 : 0; },
      dispose() { scene.remove(inst, fi); geo.dispose(); mat.dispose(); fg.dispose(); fmat.dispose(); inst.dispose(); fi.dispose(); }
    };
    return api;
  }
  FB.Crowd = { build };
})(typeof window !== 'undefined' ? window : globalThis);
