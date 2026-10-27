/* الكرة الطائرة V24 — renderer, broadcast camera director, ball, effects and the 2D fallback.
 *
 * The scene never decides anything: it renders whatever rally time the game asks for. Because the
 * rally is a pure function of time, freezes, slow-motion replays and frame-rate changes are exact.
 */
(function () {
  'use strict';
  const T = typeof THREE !== 'undefined' ? THREE : null;
  const VR = typeof VolleyRally !== 'undefined' ? VolleyRally : window.VolleyRally;
  const R = VR.BALL.radius;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

  const TIERS = {
    low: { dpr: 1, shadows: false, detail: false, confetti: 140, crowdEvery: 2, antialias: false },
    medium: { dpr: 1.5, shadows: true, detail: true, confetti: 260, crowdEvery: 1, antialias: true },
    high: { dpr: 2, shadows: true, detail: true, confetti: 420, crowdEvery: 1, antialias: true },
  };
  function detectQuality() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const ua = nav.userAgent || '', mem = nav.deviceMemory || 4, cores = nav.hardwareConcurrency || 4;
    const mobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || ((nav.maxTouchPoints || 0) > 1 && /Mac/.test(nav.platform || ''));
    if (mobile) return mem >= 6 && cores >= 6 ? 'medium' : 'low';
    if (cores >= 8 && mem >= 8) return 'high';
    if (cores <= 2 || mem <= 2) return 'low';
    return 'medium';
  }
  function webglAvailable(canvas) {
    try { return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl'))); } catch (e) { return false; }
  }

  // ───────── ball ─────────
  function ballTexture() {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    if (!x.fillRect) return null;
    // Original 8-panel design in school colours (maroon / white / gold) — not a brand pattern.
    x.fillStyle = '#f6f3ec'; x.fillRect(0, 0, 512, 256);
    const cols = ['#8a1538', '#f6f3ec', '#d9a441', '#f6f3ec'];
    for (let i = 0; i < 8; i++) {
      x.fillStyle = cols[i % 4];
      x.beginPath();
      const x0 = i * 64;
      x.moveTo(x0, 0); x.bezierCurveTo(x0 + 70, 70, x0 - 20, 180, x0 + 40, 256); x.lineTo(x0 + 104, 256); x.bezierCurveTo(x0 + 44, 180, x0 + 134, 70, x0 + 64, 0); x.fill();
    }
    x.strokeStyle = 'rgba(40,20,20,0.35)'; x.lineWidth = 2;
    for (let i = 0; i <= 8; i++) { const x0 = i * 64; x.beginPath(); x.moveTo(x0, 0); x.bezierCurveTo(x0 + 70, 70, x0 - 20, 180, x0 + 40, 256); x.stroke(); }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }

  // ───────── 3D world ─────────
  function create3D(canvas, opts) {
    const quality = opts.quality && TIERS[opts.quality] ? opts.quality : detectQuality();
    const tier = { ...TIERS[quality] };
    const renderer = new T.WebGLRenderer({ canvas, antialias: tier.antialias, powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: !!opts.capture });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.88;
    renderer.shadowMap.enabled = tier.shadows;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = false;
    const scene = new T.Scene();
    scene.background = new T.Color('#0c121a');
    scene.fog = new T.Fog('#0c121a', 38, 80);
    const camera = new T.PerspectiveCamera(45, 1, 0.1, 160);
    camera.position.set(0, 9, 22);
    const arena = window.VolleyArena.create(scene, renderer, { quality });

    // Athletes (12 players + 4 officials), created once and re-bound to each new rally plan.
    let views = [], officials = [];
    function bindPlan(plan) {
      if (!views.length) {
        views = plan.actors.map((a) => new window.VolleyAthletes.AthleteView(a, { detail: tier.detail }));
        officials = plan.officials.map((a) => new window.VolleyAthletes.AthleteView(a, { detail: false }));
        for (const v of views.concat(officials)) { scene.add(v.root); if (v.standMesh) { v.standMesh.position.set(a0(v).pos[0], 0, a0(v).pos[1]); v.standMesh.rotation.y = a0(v).face; scene.add(v.standMesh); } }
        for (const v of views.concat(officials)) v.mesh.castShadow = tier.shadows;
      } else {
        views.forEach((v, i) => { v.actor = plan.actors[i]; });
        officials.forEach((v, i) => { v.actor = plan.officials[i]; });
      }
    }
    const a0 = (v) => VR.actorAt(v.actor, 0);

    // Ball + blob shadow + spike trail.
    const ballMat = new T.MeshStandardMaterial({ map: ballTexture(), color: '#ffffff', roughness: 0.45, metalness: 0 });
    const ball = new T.Mesh(new T.SphereGeometry(R, 32, 24), ballMat);
    ball.castShadow = true; scene.add(ball);
    const blob = new T.Mesh(new T.CircleGeometry(0.2, 24), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.004; blob.renderOrder = 2; scene.add(blob);
    const TRAIL = 18;
    const trailGeo = new T.BufferGeometry();
    trailGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3));
    trailGeo.setAttribute('alpha', new T.BufferAttribute(new Float32Array(TRAIL * 2), 1));
    const tIdx = []; for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    trailGeo.setIndex(tIdx);
    const trailMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(1.0, 0.86, 0.7, vA * 0.55); }',
    });
    const trail = new T.Mesh(trailGeo, trailMat); trail.frustumCulled = false; scene.add(trail);
    // Floor impact rings.
    const rings = Array.from({ length: 3 }, () => {
      const m = new T.Mesh(new T.RingGeometry(0.1, 0.16, 32), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.006; scene.add(m); return m;
    });
    // Confetti.
    const confN = tier.confetti;
    const conf = new T.InstancedMesh(new T.PlaneGeometry(0.07, 0.035), new T.MeshBasicMaterial({ side: T.DoubleSide, toneMapped: false }), confN);
    const confData = [], crnd = VR.rng(99);
    const ccols = ['#8a1538', '#ffffff', '#d9a441', '#c2224f'].map((c) => new T.Color(c));
    for (let i = 0; i < confN; i++) {
      confData.push({ p: [(crnd() - 0.5) * 12, 13 + crnd() * 3, 1 + crnd() * 9], v: [(crnd() - 0.5) * 3, -1 - crnd() * 2, (crnd() - 0.5) * 3], spin: crnd() * 10, ph: crnd() * 6 });
      conf.setColorAt(i, ccols[i % 4]);
    }
    if (conf.instanceColor) conf.instanceColor.needsUpdate = true;
    conf.visible = false; conf.frustumCulled = false; scene.add(conf);
    let confettiAt = -1;

    // Camera director.
    const cam = { pos: camera.position.clone(), look: new T.Vector3(0, 1.2, 0), mode: 'intro', fov: 45, shake: 0 };
    const desired = { pos: new T.Vector3(), look: new T.Vector3() };
    function aspectInfo() {
      const w = canvas.clientWidth || window.innerWidth || 1280, h = canvas.clientHeight || window.innerHeight || 720;
      return { w, h, portrait: h > w * 1.05 };
    }
    function shotFor(mode, v, plan, bp) {
      const { portrait } = aspectInfo();
      const P = desired.pos, L = desired.look;
      const dec = plan?.decisive, C = dec ? new T.Vector3(...dec.p) : new T.Vector3(0, 2.4, 0);
      let fov = portrait ? 60 : 44, stiff = 2.6;
      switch (mode) {
        case 'intro': case 'welcome': {
          const a = 0.6 + v.camT * (opts.reducedMotion ? 0.01 : 0.07);
          P.set(Math.sin(a) * 22, 9.5 + Math.sin(v.camT * 0.25) * 1.5, Math.cos(a) * 22 + 2);
          L.set(0, 1.3, 0); fov = portrait ? 62 : 46; stiff = 1.4; break;
        }
        case 'attack': {
          const sgn = C.x <= 0 ? 1 : -1, dz = Math.sign(C.z || 1);
          P.set(C.x + sgn * 3.6, 3.1, C.z + dz * 5.4); L.set(C.x * 0.6, 2.0, C.z - dz * 1.5);
          fov = portrait ? 58 : 46; stiff = 1.8; break;
        }
        case 'freeze': {
          const th = 0.5 + (opts.reducedMotion ? 0 : Math.sin(v.camT * 0.35) * 0.18);
          const kind = dec?.kind;
          if (kind === 'serve') { P.set(C.x + 2.4 + Math.sin(th) * 0.8, C.y + 0.1, C.z + 2.8); L.copy(C).add(new T.Vector3(-0.5, -0.55, -2)); }
          else if (kind === 'receive') { P.set(C.x + Math.sin(th) * 2.2, C.y + 1.4, C.z - 3.6); L.copy(C).add(new T.Vector3(0, -0.5, 0.4)); }
          else { const dz = C.z >= 0 ? 1 : -1; P.set(C.x + Math.sin(th) * 2.6, C.y - 0.1, C.z + dz * (3.6 + Math.cos(th) * 0.5)); L.copy(C).add(new T.Vector3(-Math.sin(th) * 0.4, -0.5, -dz * 0.6)); }
          fov = portrait ? 56 : 40; stiff = 2.2; break;
        }
        case 'replay': {
          // Low side angle from the first-referee side, offset along the court so the post never blocks it.
          const land = plan?.events?.find((e) => e.type === 'floor' && e.t > plan.tContact);
          const L0 = land ? new T.Vector3(...land.p) : C;
          let cz = (C.z + L0.z) / 2 + (L0.z - C.z) * 0.3;
          if (Math.abs(cz) < 2.6) cz = (cz < 0 ? -1 : 1) * 2.6;
          P.set(8.3, 2.1, Math.max(-11, Math.min(11, cz)));
          L.set(bp.x * 0.7, Math.max(0.8, bp.y * 0.75), bp.z * 0.75 + L0.z * 0.25);
          fov = portrait ? 54 : 36; stiff = 5; break;
        }
        case 'celebrate': {
          const team = plan?.verdict?.pointTo || 'home', z = team === 'home' ? 3.4 : -3.4;
          P.set(5.5, 2.8, z + (team === 'home' ? 5.2 : -5.2)); L.set(0, 1.25, z);
          fov = portrait ? 58 : 40; stiff = 1.6; break;
        }
        default: { // 'play' / 'resolve': elevated broadcast view from behind the student's team
          const b = bp;
          if (portrait) { P.set(b.x * 0.18, 14.5, 22.5); L.set(b.x * 0.3, 0.4, b.z * 0.22 - 1.2); fov = 60; }
          else { P.set(b.x * 0.28, 8.4, 19.5); L.set(b.x * 0.35, 1.3, b.z * 0.26 - 1.3); fov = 43; }
          stiff = mode === 'resolve' ? 2.4 : 2.0;
        }
      }
      return { fov, stiff };
    }
    function updateCamera(v, plan, bp, dt) {
      const { fov, stiff } = shotFor(v.cam, v, plan, bp);
      if (v.cut || cam.mode !== v.cam && (v.cam === 'replay' || cam.mode === 'replay')) { cam.pos.copy(desired.pos); cam.look.copy(desired.look); cam.fov = fov; }
      else {
        const k = 1 - Math.exp(-dt * stiff);
        cam.pos.lerp(desired.pos, k); cam.look.lerp(desired.look, k); cam.fov += (fov - cam.fov) * k;
      }
      cam.mode = v.cam;
      camera.position.copy(cam.pos);
      if (cam.shake > 0 && !opts.reducedMotion) { camera.position.x += (Math.random() - 0.5) * cam.shake; camera.position.y += (Math.random() - 0.5) * cam.shake; cam.shake *= 0.88; }
      camera.fov = cam.fov; camera.updateProjectionMatrix();
      camera.lookAt(cam.look);
    }

    let plan = null, lastT = 0, disposed = false, lastRingCount = 0, frames = 0;
    function setPlan(p) {
      plan = p; bindPlan(p);
      arena.setNetImpacts(p.events.filter((e) => e.type === 'net').map((e) => ({ t: e.t, p: e.p, dir: -Math.sign(e.v[2] || 1), tape: e.tape })));
    }
    function frame(v) {
      if (disposed || !plan) return;
      const t = v.t, dt = clamp(v.dt ?? 0.016, 0, 0.1);
      const b = VR.ballAt(plan, t);
      ball.position.set(b.p[0], b.p[1], b.p[2]);
      ball.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]);
      ball.visible = v.ballVisible !== false;
      blob.position.set(b.p[0], 0.004, b.p[2]);
      const hgt = Math.max(0, b.p[1] - R);
      blob.scale.setScalar(0.6 + hgt * 0.22); blob.material.opacity = 0.34 / (1 + hgt * 0.6);
      // Spike trail sampled from the plan (deterministic, identical in replays).
      const sp = Math.hypot(...b.v);
      const tp = trailGeo.attributes.position.array, ta = trailGeo.attributes.alpha.array;
      const viewDir = new T.Vector3().subVectors(camera.position, ball.position).normalize();
      for (let i = 0; i < TRAIL; i++) {
        const q = VR.ballAt(plan, Math.max(0, t - i * 0.012)).p;
        const nx = i < TRAIL - 1 ? VR.ballAt(plan, Math.max(0, t - (i + 1) * 0.012)).p : q;
        const dir = new T.Vector3(q[0] - nx[0], q[1] - nx[1], q[2] - nx[2]);
        const side = new T.Vector3().crossVectors(dir, viewDir).normalize().multiplyScalar(R * 0.8 * (1 - i / TRAIL));
        tp.set([q[0] + side.x, q[1] + side.y, q[2] + side.z, q[0] - side.x, q[1] - side.y, q[2] - side.z], i * 6);
        const a = sp > 11 && !b.held ? (1 - i / TRAIL) * clamp((sp - 11) / 8) : 0;
        ta[i * 2] = ta[i * 2 + 1] = a;
      }
      trailGeo.attributes.position.needsUpdate = trailGeo.attributes.alpha.needsUpdate = true;
      // Players and officials.
      for (const vw of views.concat(officials)) vw.update(VR.actorAt(vw.actor, t), t, b.p, plan);
      // Impact rings for the most recent floor contacts.
      const floors = plan.events.filter((e) => e.type === 'floor' && e.t <= t && t - e.t < 0.7 && e.speed > 2);
      rings.forEach((m, i) => {
        const e = floors[floors.length - 1 - i];
        if (!e) { m.material.opacity = 0; return; }
        const k = (t - e.t) / 0.7;
        m.position.set(e.p[0], 0.006, e.p[2]); m.scale.setScalar(1 + k * 4); m.material.opacity = (1 - k) * 0.55;
      });
      if (floors.length !== lastRingCount) { if (floors.length > lastRingCount && plan.events.find((e) => e.type === 'floor' && e.first && Math.abs(e.t - t) < 0.05)) cam.shake = 0.05; lastRingCount = floors.length; }
      // Confetti.
      if (confettiAt >= 0) {
        const k = (v.wall ?? 0) - confettiAt;
        conf.visible = k < 6;
        const M = new T.Matrix4(), Q = new T.Quaternion(), E = new T.Euler(), P = new T.Vector3(), S = new T.Vector3(1, 1, 1);
        confData.forEach((c, i) => {
          const tau = Math.max(0, k - (i % 20) * 0.02);
          P.set(c.p[0] + c.v[0] * tau + Math.sin(tau * 3 + c.ph) * 0.4, Math.max(0.02, c.p[1] + c.v[1] * tau - 0.35 * tau * tau), c.p[2] + c.v[2] * tau);
          Q.setFromEuler(E.set(tau * c.spin, tau * c.spin * 0.7, c.ph));
          M.compose(P, Q, S); conf.setMatrixAt(i, M);
        });
        conf.instanceMatrix.needsUpdate = true;
      }
      arena.update(t, v.wallDt ?? dt, { focus: plan.decisive?.p, crowdEvery: tier.crowdEvery });
      updateCamera(v, plan, ball.position, v.wallDt ?? dt);
      renderer.render(scene, camera);
      lastT = t; frames++;
    }
    function cue(type, team, wall) {
      arena.cueLights(type, team);
      if (type === 'point' && team === 'home' && !opts.reducedMotion) confettiAt = wall ?? 0;
      if (type === 'spike') cam.shake = Math.max(cam.shake, 0.04);
    }
    function resize() {
      const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    function degrade() {
      // Adaptive quality: drop resolution first, then shadows, then crowd animation rate.
      const pr = renderer.getPixelRatio();
      if (pr > 1.01) { renderer.setPixelRatio(Math.max(1, pr * 0.75)); resize(); return 'resolution'; }
      if (renderer.shadowMap.enabled) {
        renderer.shadowMap.enabled = false;
        scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
        return 'shadows';
      }
      if (tier.crowdEvery < 3) { tier.crowdEvery++; return 'crowd'; }
      return null;
    }
    function dispose() {
      disposed = true;
      for (const v of views.concat(officials)) { scene.remove(v.root); v.dispose(); }
      arena.dispose();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
      for (const t of window.VolleyAthletes.textureCache.values()) t?.dispose?.();
      window.VolleyAthletes.textureCache.clear();
      renderer.dispose();
    }
    resize();
    return {
      kind: 'webgl', quality, setPlan, frame, cue, resize, dispose, degrade,
      setScore: (s) => arena.setScore(s), renderer, scene, camera,
      views: () => views, officials: () => officials,
      snapshot: () => ({
        kind: 'webgl', quality, frames, t: lastT, ball: ball.position.toArray(), camera: cam.mode,
        players: { home: views.filter((v) => v.actor.team === 'home').length, away: views.filter((v) => v.actor.team === 'away').length }, officials: officials.length,
        pixelRatio: renderer.getPixelRatio(), shadows: renderer.shadowMap.enabled, arena: arena.snapshot(), draws: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      }),
    };
  }

  // ───────── 2D fallback (no WebGL): same rally, broadcast-style projection ─────────
  function create2D(canvas, opts) {
    const g = canvas.getContext('2d');
    let plan = null, lastT = 0, score = {}, frames = 0;
    const camPos = [0, 9, 19], look = [0, 1.2, -1];
    function project(p, w, h) {
      const f = norm([look[0] - camPos[0], look[1] - camPos[1], look[2] - camPos[2]]);
      const r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
      const d = [p[0] - camPos[0], p[1] - camPos[1], p[2] - camPos[2]];
      const z = dot(d, f), k = (h * 0.62) / Math.max(0.1, z) * 1.6;
      return [w / 2 + dot(d, r) * k, h / 2 - dot(d, u) * k, z, k];
    }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
    function poly(pts, w, h, fill, stroke) { g.beginPath(); pts.forEach((p, i) => { const q = project(p, w, h); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } }
    function frame(v) {
      if (!plan) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5), w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
      if (canvas.width !== Math.round(w) || canvas.height !== Math.round(h)) { canvas.width = Math.round(w); canvas.height = Math.round(h); }
      const t = v.t;
      g.fillStyle = '#0c121a'; g.fillRect(0, 0, w, h);
      poly([[-11, 0, -15], [11, 0, -15], [11, 0, 15], [-11, 0, 15]], w, h, '#6a1030');
      poly([[-4.5, 0, -9], [4.5, 0, -9], [4.5, 0, 9], [-4.5, 0, 9]], w, h, '#d8a066', '#ffffff');
      g.lineWidth = 2;
      for (const z of [-3, 0, 3]) poly([[-4.5, 0, z], [4.5, 0, z]], w, h, null, '#ffffff');
      poly([[-4.95, 1.43, 0], [4.95, 1.43, 0], [4.95, 2.43, 0], [-4.95, 2.43, 0]], w, h, 'rgba(20,20,24,0.35)', '#f4f2ec');
      const b = VR.ballAt(plan, t).p;
      const drawables = plan.actors.map((a) => ({ a, s: VR.actorAt(a, t) }));
      drawables.sort((x, y) => x.s.pos[1] - y.s.pos[1]);
      for (const { a, s } of drawables) {
        const base = project([s.pos[0], 0, s.pos[1]], w, h), top = project([s.pos[0], a.height * 0.9 + s.air, s.pos[1]], w, h);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(base[0], base[1], 0.3 * base[3], 0.1 * base[3], 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = a.team === 'home' ? '#8a1538' : '#e9edf2'; g.lineWidth = Math.max(4, 0.32 * base[3]); g.lineCap = 'round';
        g.beginPath(); g.moveTo(base[0], base[1] - (s.air * base[3])); g.lineTo(top[0], top[1]); g.stroke();
        g.fillStyle = '#b07650'; g.beginPath(); g.arc(top[0], top[1] - 0.12 * top[3], 0.11 * top[3], 0, Math.PI * 2); g.fill();
        g.fillStyle = a.team === 'home' ? '#ffffff' : '#1d3f66'; g.font = `bold ${Math.max(9, 0.22 * base[3])}px Arial`; g.textAlign = 'center';
        g.fillText(String(a.number), (base[0] + top[0]) / 2, (base[1] + top[1]) / 2);
      }
      const bs = project([b[0], 0, b[2]], w, h), bb = project(b, w, h);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(bs[0], bs[1], R * 1.6 * bs[3], R * 0.6 * bs[3], 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f6f3ec'; g.strokeStyle = '#8a1538'; g.lineWidth = 2; g.beginPath(); g.arc(bb[0], bb[1], Math.max(4, R * bb[3]), 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffffffb0'; g.font = `${Math.round(12 * dpr)}px Tahoma`; g.textAlign = 'left';
      g.fillText('عرض مبسّط (المتصفح لا يدعم WebGL)', 12 * dpr, h - 12 * dpr);
      lastT = t; frames++;
      void score; void opts;
    }
    return {
      kind: '2d', quality: 'fallback', setPlan: (p) => { plan = p; }, frame, cue() {}, resize() {}, dispose() {}, degrade: () => null,
      setScore: (s) => { score = s; }, views: () => [], officials: () => [],
      snapshot: () => ({ kind: '2d', frames, t: lastT, ball: plan ? VR.ballAt(plan, lastT).p : null, players: { home: 6, away: 6 } }),
    };
  }

  function create(canvas, opts = {}) {
    if (!opts.force2D && T && webglAvailable(canvas)) {
      try { return create3D(canvas, opts); } catch (e) { if (opts.onError) opts.onError(e); }
    }
    // A canvas that already holds a WebGL context cannot give a 2D one, so swap in a fresh canvas.
    let c = canvas;
    if (!c.getContext('2d')) { const n = canvas.cloneNode(false); canvas.parentNode.replaceChild(n, canvas); c = n; }
    return create2D(c, opts);
  }

  window.VolleyScene = { create, detectQuality, TIERS };
})();
