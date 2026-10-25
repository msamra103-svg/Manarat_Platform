/* Lightweight pooled effects: celebration confetti (school colours) and turf dust puffs. No flashes or strobing; confetti is skipped in reduced-motion. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, M = FB.math;
  const COLORS = ['#8a1538', '#f5d481', '#ffffff', '#b43a5c', '#cfa95a'];

  function create(scene, opts = {}) {
    const rng = M.rng(99), N = opts.confetti || 220, D = 18;
    // ---- confetti: instanced quads, CPU-integrated (cheap at this count)
    const geo = new T.PlaneGeometry(0.16, 0.1), mat = new T.MeshBasicMaterial({ side: T.DoubleSide, fog: false, toneMapped: false });
    const im = new T.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.visible = false; im.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(im);
    const P = Array.from({ length: N }, () => ({ p: new T.Vector3(), v: new T.Vector3(), r: new T.Euler(), w: new T.Vector3(), ph: 0, life: 0 }));
    for (let i = 0; i < N; i++) im.setColorAt(i, FB.color(COLORS[i % COLORS.length]));
    im.instanceColor.needsUpdate = true;
    const m4 = new T.Matrix4(), q = new T.Quaternion(), s1 = new T.Vector3(1, 1, 1), s0 = new T.Vector3(0, 0, 0);
    let confettiT = 0;
    // ---- dust
    const dc = document.createElement('canvas'); dc.width = dc.height = 64; const dx = dc.getContext('2d'), gr = dx.createRadialGradient(32, 32, 1, 32, 32, 30);
    gr.addColorStop(0, 'rgba(206,214,170,0.55)'); gr.addColorStop(1, 'rgba(206,214,170,0)'); dx.fillStyle = gr; dx.fillRect(0, 0, 64, 64);
    const dtex = new T.CanvasTexture(dc), dust = [];
    for (let i = 0; i < D; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: dtex, transparent: true, depthWrite: false, opacity: 0, fog: true })); sp.visible = false; scene.add(sp); dust.push({ sp, t: 1, life: 1, v: new T.Vector3(), s0: 0.4 }); }
    let di = 0;
    return {
      reduced: !!opts.reduced,
      setReduced(r) { this.reduced = !!r; if (r) { im.visible = false; confettiT = 0; } },
      confetti(cx = 0, cz = -8) {
        if (this.reduced) return; im.visible = true; confettiT = 6.5;
        for (let i = 0; i < N; i++) { const o = P[i]; o.p.set(cx + (rng() - 0.5) * 22, 9 + rng() * 7, cz + (rng() - 0.5) * 18); o.v.set((rng() - 0.5) * 2.2, -(1.2 + rng() * 2.6), (rng() - 0.5) * 2.2); o.w.set((rng() - 0.5) * 9, (rng() - 0.5) * 9, (rng() - 0.5) * 9); o.r.set(rng() * 6, rng() * 6, rng() * 6); o.ph = rng() * 6.28; o.life = 1; }
      },
      puff(x, z, strength = 1, y = 0.08) {
        const d = dust[di++ % D]; d.t = 0; d.life = 0.7 + 0.4 * strength; d.s0 = 0.35 + 0.3 * strength; d.v.set((rng() - 0.5) * 0.5, 0.35, (rng() - 0.5) * 0.5); d.sp.position.set(x, y + 0.1, z); d.sp.scale.setScalar(d.s0); d.sp.material.opacity = 0.5 * Math.min(1, 0.4 + strength * 0.6); d.sp.visible = true; d.k = d.sp.material.opacity;
      },
      update(dt) {
        if (confettiT > 0) {
          confettiT -= dt; let alive = 0;
          for (let i = 0; i < N; i++) { const o = P[i]; if (o.p.y > 0.04) { o.ph += dt * 3; o.v.x += Math.sin(o.ph) * dt * 2; o.v.z += Math.cos(o.ph * 0.8) * dt * 2; o.v.y = Math.max(o.v.y - 2 * dt, -2.6); o.v.multiplyScalar(1 - dt * 0.4); o.p.addScaledVector(o.v, dt); o.r.x += o.w.x * dt; o.r.y += o.w.y * dt; o.r.z += o.w.z * dt; alive++; }
            q.setFromEuler(o.r); m4.compose(o.p, q, o.p.y > 0.04 ? s1 : s0); im.setMatrixAt(i, m4); }
          im.instanceMatrix.needsUpdate = true; if (confettiT <= 0 || !alive) { im.visible = false; confettiT = 0; }
        }
        for (const d of dust) { if (!d.sp.visible) continue; d.t += dt; const k = d.t / d.life; if (k >= 1) { d.sp.visible = false; continue; } d.sp.position.addScaledVector(d.v, dt); d.sp.scale.setScalar(d.s0 * (1 + k * 2.2)); d.sp.material.opacity = d.k * (1 - k) * (1 - k); }
      },
      dispose() { scene.remove(im); geo.dispose(); mat.dispose(); im.dispose(); for (const d of dust) { scene.remove(d.sp); d.sp.material.dispose(); } dtex.dispose(); }
    };
  }
  FB.Fx = { create };
})(typeof window !== 'undefined' ? window : globalThis);
