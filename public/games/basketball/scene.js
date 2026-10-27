/* Basketball scene (basketball-only; football keeps games/sports/scene.js).
 * Renderer, lighting, arena, crowd, seven rigged athletes and their choreography, the ball,
 * a procedural verlet net and the sports camera. Everything is driven by scene.update(dt):
 * one simulation clock positions bodies, hands, ball, contacts and sound events.
 *
 * Interface used by games/basketball/game.js (and the QA harness):
 *   SportScene.detectQuality(override) -> quality object
 *   SportScene.create(canvas, {quality|tier, reducedMotion, assetBase, onEvent, preserveDrawingBuffer})
 *     .load(progress) -> Promise      .update(dt)        .resize()          .dispose()
 *     .shoot() -> bool                .resolve('make'|'miss'|'pending')      .nextRound()
 *     .scoreboard({home,away,label})  .setPixelRatio(r)  .thinCrowd(f)      .snapshot()  .poseCheck()
 *     .state {mode,tau,passPhase,pendingDone}  .people  .camera  .renderer  .scene
 * Events (onEvent): ready, gather, release, land, question, outcome{result}, dribble, contact{type},
 *   squeak, catch, pass — all with a world position for spatial audio where relevant.
 */
(function (root) {
  'use strict';
  const T = root.THREE, M = root.BasketballMotion;
  const C = M.COURT, R = M.R, SHOT = M.SHOT, DR = M.DRIBBLE, G = M.G;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = M.smooth;
  const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
  const UP = new T.Vector3(0, 1, 0);
  const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const fromArr = (a, out = new T.Vector3()) => out.set(a[0], a[1], a[2]);
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  // ------------------------------------------------------------------ quality
  const KITS = ['kit_home_10.jpg', 'kit_home_7.jpg', 'kit_home_4.jpg', 'kit_home_12.jpg', 'kit_away_5.jpg', 'kit_away_8.jpg', 'kit_away_14.jpg'];
  const TIERS = {
    low: { tier: 'low', maxDpr: 1.25, shadow: 1024, crowd: 520, anisotropy: 2, antialias: false, floor: 1024 },
    medium: { tier: 'medium', maxDpr: 1.5, shadow: 2048, crowd: 950, anisotropy: 4, antialias: true, floor: 2048 },
    high: { tier: 'high', maxDpr: 2, shadow: 2048, crowd: 1500, anisotropy: 8, antialias: true, floor: 2048 }
  };
  function gpuName() {
    try {
      const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl');
      if (!g) return 'none';
      const d = g.getExtension('WEBGL_debug_renderer_info');
      const n = String(g.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : g.RENDERER));
      const lose = g.getExtension('WEBGL_lose_context'); lose && lose.loseContext();
      return n;
    } catch (e) { return 'unknown'; }
  }
  function detectQuality(override) {
    let tier = 'high', reason = 'desktop';
    const gpu = gpuName();
    if (override && TIERS[override]) { tier = override; reason = 'override'; }
    else {
      const sw = Math.min(screen.width || 1280, screen.height || 720), coarse = !!(root.matchMedia && matchMedia('(pointer: coarse)').matches);
      const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
      if (/swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(gpu)) { tier = 'low'; reason = 'software renderer'; }
      else if (sw < 600 || (coarse && Math.max(innerWidth, innerHeight) < 1000)) { tier = 'low'; reason = 'phone'; }
      else if (mem < 6 || cores <= 4) { tier = 'medium'; reason = 'memory/cores'; }
      if (tier === 'high' && /intel|mali|adreno|powervr|apple gpu|videocore|vivante/i.test(gpu)) { tier = 'medium'; reason = 'integrated/mobile GPU'; }
    }
    const q = Object.assign({}, TIERS[tier]);
    q.pixelRatio = Math.min(root.devicePixelRatio || 1, q.maxDpr);
    q.kits = KITS.slice(); q.gpu = gpu; q.reason = reason;
    return q;
  }

  // ------------------------------------------------------------------ ball textures
  function ballTextures(size) {
    const W = size, H = size / 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const b = document.createElement('canvas'); b.width = W; b.height = H;
    const x = c.getContext('2d'), y = b.getContext('2d');
    const img = x.createImageData(W, H), bimg = y.createImageData(W, H);
    let seed = 991; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const pebble = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) pebble[i] = rnd();
    const wSeam = 0.016;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const lon = i / W * Math.PI * 2, lat = j / H * Math.PI;
      const vx = Math.sin(lat) * Math.cos(lon), vy = Math.cos(lat), vz = Math.sin(lat) * Math.sin(lon);
      // eight panels: two great circles + two curved seams (circles around the x axis)
      const s1 = Math.abs(vy), s2 = Math.abs(vz), s3 = Math.abs(Math.abs(vx) - 0.7) / 0.72;
      const seam = Math.min(s1, s2, s3);
      const line = seam < wSeam ? 1 : seam < wSeam * 1.7 ? (wSeam * 1.7 - seam) / (wSeam * 0.7) : 0;
      // pebble grain: blurred noise (cheap 3-tap)
      const k = j * W + i, n = (pebble[k] + pebble[(k + 1) % (W * H)] + pebble[(k + W) % (W * H)]) / 3;
      const shade = 0.9 + n * 0.16, warm = 1 + (Math.sin(lon * 3 + lat * 2) * 0.02);
      const base = [205 * shade * warm, 96 * shade, 38 * shade];
      const dark = [28, 20, 16];
      const o = k * 4;
      for (let ch = 0; ch < 3; ch++) img.data[o + ch] = clamp(base[ch] * (1 - line) + dark[ch] * line, 0, 255);
      img.data[o + 3] = 255;
      const hgt = line > 0 ? 40 * (1 - line) : 150 + n * 105; // seams are grooves
      bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = hgt; bimg.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0); y.putImageData(bimg, 0, 0);
    const map = new T.CanvasTexture(c); map.encoding = T.sRGBEncoding; map.anisotropy = 4;
    const bump = new T.CanvasTexture(b);
    return { map, bump };
  }
  function radialTexture(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }

  // ------------------------------------------------------------------ procedural net (verlet)
  function createNet(parent, mat) {
    const K = 6, N = 12, rim = C.rim, P = [], prev = [], rest = [], fixed = [];
    for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) {
      const a = (i + (k % 2) * 0.5) * Math.PI * 2 / N, r = lerp(rim.major - 0.004, 0.14, k / (K - 1)), y = rim.y - 0.012 - k * 0.074;
      const p = V3(rim.x + Math.cos(a) * r, y, rim.z + Math.sin(a) * r);
      P.push(p.clone()); prev.push(p.clone()); rest.push(p.clone()); fixed.push(k === 0);
    }
    const edges = [];
    const id = (k, i) => k * N + ((i % N) + N) % N;
    for (let k = 0; k < K - 1; k++) for (let i = 0; i < N; i++) {
      const a = id(k, i), n1 = id(k + 1, i), n2 = k % 2 === 0 ? id(k + 1, i - 1) : id(k + 1, i + 1);
      edges.push([a, n1, P[a].distanceTo(P[n1])], [a, n2, P[a].distanceTo(P[n2])]);
    }
    for (let i = 0; i < N; i++) { const a = id(K - 1, i), b = id(K - 1, i + 1); edges.push([a, b, P[a].distanceTo(P[b]) * 1.0]); }
    const geo = new T.CylinderGeometry(0.0042, 0.0042, 1, 5, 1, true);
    const mesh = new T.InstancedMesh(geo, mat, edges.length); mesh.name = 'net'; mesh.frustumCulled = false; mesh.castShadow = false;
    parent.add(mesh);
    const dm = new T.Object3D(), dir = V3(), tmp = V3(), g = V3(0, -G, 0);
    let acc = 0;
    function step(h, ball) {
      for (let i = 0; i < P.length; i++) {
        if (fixed[i]) continue;
        const p = P[i], q = prev[i];
        tmp.copy(p); p.x += (p.x - q.x) * 0.97; p.y += (p.y - q.y) * 0.97; p.z += (p.z - q.z) * 0.97;
        p.addScaledVector(g, h * h); q.copy(tmp);
        p.lerp(rest[i], 0.06); // starch: keeps the hanging shape
      }
      for (let it = 0; it < 5; it++) {
        for (const [a, b, L] of edges) {
          dir.subVectors(P[b], P[a]); const d = dir.length() || 1e-6, diff = (d - L) / d;
          if (diff < 0 && it > 1) continue; // strings do not resist compression
          const fa = fixed[a] ? 0 : fixed[b] ? 1 : 0.5, fb = fixed[b] ? 0 : fixed[a] ? 1 : 0.5;
          P[a].addScaledVector(dir, diff * fa); P[b].addScaledVector(dir, -diff * fb);
        }
        if (ball) for (let i = 0; i < P.length; i++) {
          if (fixed[i]) continue;
          dir.subVectors(P[i], ball); const d = dir.length(), m = R + 0.01;
          if (d < m && d > 1e-6) P[i].addScaledVector(dir, (m - d) / d);
        }
      }
    }
    function update(dt, ball) {
      acc = Math.min(acc + dt, 0.05);
      const h = 1 / 120;
      const near = ball && Math.abs(ball.y - (C.rim.y - 0.2)) < 0.9 && Math.hypot(ball.x - C.rim.x, ball.z - C.rim.z) < 0.9 ? ball : null;
      while (acc >= h) { step(h, near); acc -= h; }
      edges.forEach(([a, b], i) => {
        dir.subVectors(P[b], P[a]); const L = dir.length();
        dm.position.addVectors(P[a], P[b]).multiplyScalar(0.5);
        dm.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / (L || 1)));
        dm.scale.set(1, L, 1); dm.updateMatrix(); mesh.setMatrixAt(i, dm.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    update(0.2, null);
    return { mesh, update, dispose() { geo.dispose(); } };
  }

  // ------------------------------------------------------------------ scene
  function create(canvas, opts = {}) {
    const Q = opts.quality || detectQuality(opts.tier);
    if (!Q.kits) Q.kits = KITS.slice();
    const reduced = !!opts.reducedMotion;
    const base = opts.assetBase || 'assets/';
    const emit = (t, d) => { try { opts.onEvent && opts.onEvent(t, d || {}); } catch (e) { console.error(e); } };

    const renderer = new T.WebGLRenderer({ canvas, antialias: Q.antialias, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
    renderer.setPixelRatio(Q.pixelRatio);
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0x0b0809, 1);
    const scene = new T.Scene();
    scene.background = new T.Color(0x0b0809);
    scene.fog = new T.Fog(0x0e0a0c, 34, 78);
    const camera = new T.PerspectiveCamera(46, 16 / 9, 0.1, 140);
    camera.position.set(8, 7, 3); camera.lookAt(0, 1.5, -9);

    const state = { mode: 'loading', tau: 0, passPhase: '', pendingDone: false, outcome: '', round: 0 };
    const people = {};
    let arena = null, crowd = null, crowdLib = null, env = null, net = null, athletesLib = null;
    const disposables = [];
    let time = 0;

    // ---------------- lights ----------------
    const hemi = new T.HemisphereLight(0xfff3e6, 0x2a1418, 0.34); scene.add(hemi);
    const key = new T.DirectionalLight(0xfff1df, 1.85);
    key.position.set(-5, 24, 2); key.target.position.set(0, 0, -9); scene.add(key, key.target);
    key.castShadow = true; key.shadow.mapSize.set(Q.shadow, Q.shadow);
    Object.assign(key.shadow.camera, { left: -13, right: 13, top: 12, bottom: -12, near: 4, far: 50 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 2.5;
    const fill = new T.DirectionalLight(0xffe6d0, 0.55); fill.position.set(6, 9, 14); fill.target.position.set(0, 1, -8); scene.add(fill, fill.target);
    const rimLight = new T.DirectionalLight(0xd9e4ff, 0.5); rimLight.position.set(0, 12, -30); rimLight.target.position.set(0, 1, -6); scene.add(rimLight, rimLight.target);
    const courtSpot = new T.SpotLight(0xfff4e4, 0.8, 40, 0.75, 0.6, 1.2); courtSpot.position.set(0, 19, -6); courtSpot.target.position.set(0, 0, -9); scene.add(courtSpot, courtSpot.target);

    // ---------------- ball ----------------
    const ballGeo = new T.SphereGeometry(R, 48, 32);
    let ballMat = null, ball = null, ghost = null, halo = null, cartBalls = null;

    // ---------------- geometry helpers for characters ----------------
    function basis(a, out) { const y = a.yaw; out.f.set(Math.sin(y), 0, Math.cos(y)); out.r.set(-Math.cos(y), 0, Math.sin(y)); return out; }
    const _B = { f: V3(), r: V3() };
    /** character space (x right, y up, z forward) -> world */
    function cw(a, x, y, z, out = new T.Vector3()) {
      basis(a, _B); return out.copy(a.root.position).addScaledVector(_B.r, x).addScaledVector(UP, y).addScaledVector(_B.f, z);
    }
    function dirW(a, x, y, z, out = new T.Vector3()) { basis(a, _B); return out.set(0, 0, 0).addScaledVector(_B.r, x).addScaledVector(UP, y).addScaledVector(_B.f, z).normalize(); }

    // per-athlete controller state + smoothing of procedural weights
    function rig(a, name) {
      a.ctl = {
        name, state: 'idle', t: 0, hT: { L: 0, R: 0 }, fT: { L: 0, R: 0 }, rate: { h: 9, f: 10, p: 7 },
        pel: V3(), pelT: V3(), tilt: 0, tiltT: 0, bend: 0, bendT: 0, side: 0, sideT: 0, exact: false,
        look: V3(0, 1.6, -12), lookW: 0, lookWT: 0.7, planted: { L: V3(), R: V3() }, clip: '', home: null, react: null
      };
      a.ctl.lookOut = a.ctl.look.clone();
      a.ctl.phase = ''; a.ctl.blendT = 1; a.ctl.lastKey = undefined;
      a.ctl.applied = { hand: { L: snapHand(), R: snapHand() }, foot: { L: V3(), R: V3() }, footW: { L: 0, R: 0 }, pel: V3(), tilt: 0, bend: 0, valid: false };
      a.ctl.wts = { L: { h: 0, f: 0 }, R: { h: 0, f: 0 } }; a.ctl.pelS = {};
      a.ctl.blendFrom = { hand: { L: snapHand(), R: snapHand() }, foot: { L: V3(), R: V3() }, footW: { L: 0, R: 0 }, pel: V3(), tilt: 0, bend: 0 };
      a.pose.look = a.ctl.lookOut;
      return a.ctl;
    }
    function snapHand() { return { pos: V3(), n: V3(0, 0, 1), f: V3(0, 1, 0), pole: V3(), w: 0, vel: V3(), off: V3(), offV: V3(), t: 9, req: V3(), reqV: V3(), reqPole: V3(), hasReq: false }; }
    function hand(a, s, pos, n, f, pole, curl = 0.35, thumb = 0.3, w = 1) {
      const h = a.pose.hand[s]; h.pos.copy(pos); h.ndir.copy(n); h.fdir.copy(f); h.pole.copy(pole); h.curl = curl; h.thumb = thumb;
      a.ctl.hT[s] = w;
    }
    /** palm on the ball surface: d = unit direction from the ball centre to the palm */
    const _g = [V3(), V3(), V3()];
    function grip(a, s, ballPos, d, fingers, pole, w = 1, curl = 0.42) {
      const pos = _g[0].copy(ballPos).addScaledVector(d, R + 0.013);
      const n = _g[1].copy(d).negate();
      const f = _g[2].copy(fingers).addScaledVector(n, -fingers.dot(n)).normalize();
      hand(a, s, pos, n, f, pole, curl, 0.32, w);
    }
    function foot(a, s, pos, pitch = 0, w = 1, toeOut = 0.12) {
      const f = a.pose.foot[s]; f.pos.copy(pos); f.pitch = pitch; f.toeOut = toeOut; a.ctl.fT[s] = w;
    }
    function stanceFeet(a, wide = 0.13, stagger = 0, lift = 0, pitch = 0, w = 1) {
      // planted positions are computed from the current root (callers keep the root still while planted)
      const L = cw(a, -wide, DRIBBLE_ANKLE + lift, -stagger, _g[0]); foot(a, 'L', L, pitch, w, 0.14);
      const Rr = cw(a, wide, DRIBBLE_ANKLE + lift, stagger, _g[0]); foot(a, 'R', Rr, pitch, w, 0.14);
    }
    const DRIBBLE_ANKLE = 0.102;
    function pelvis(a, right, up, fwd, exact) { a.ctl.pelT.set(-right, up, fwd); a.ctl.exact = !!exact; }
    function shoulder(a, s, out) { return cw(a, s === 'R' ? 0.2 : -0.2, 1.43 + a.ctl.pel.y, -0.02, out); }
    /** critically damped spring: starts and stops with zero velocity (first-order easing "pops") */
    function spring(o, k, target, omega, dt) {
      const vk = k + 'V'; let v = o[vk] || 0, x = o[k];
      const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
      for (let i = 0; i < n; i++) { const acc = omega * omega * (target - x) - 2 * omega * v; v += acc * h; x += v * h; }
      o[vk] = v; return x;
    }
    const BLEND = 0.2;
    // inertialization: keep the offset to the new target AND the hand's current velocity, then decay both
    function startHandBlend(h, g, ph) {
      g.pos.copy(h.pos); g.n.copy(h.n); g.f.copy(h.f); g.pole.copy(h.pole); g.w = h.w; g.t = 0;
      g.off.subVectors(h.pos, ph.pos); g.offV.copy(h.vel).multiplyScalar(BLEND); if (g.offV.length() > 0.25) g.offV.setLength(0.25);
    } // s: hand/foot/pelvis targets cross-fade whenever a controller changes phase
    function finishRig(a, dt) {
      const c = a.ctl, p = a.pose, A = c.applied, F = c.blendFrom;
      // ---- phase change -> remember what was applied last frame and blend from it (no pops)
      const key = (c.stateAtStart ?? c.state) + '|' + c.phase;
      if (A.valid && key !== c.lastKey) {
        for (const s of ['L', 'R']) { startHandBlend(A.hand[s], F.hand[s], p.hand[s]); F.foot[s].copy(A.foot[s]); F.footW[s] = A.footW[s]; }
        F.pel.copy(A.pel); F.tilt = A.tilt; F.bend = A.bend; c.blendT = 0;
      }
      c.lastKey = key; c.phase = '';
      const k = c.blendT < BLEND ? smooth(c.blendT / BLEND) : 1; c.blendT += dt;
      for (const s of ['L', 'R']) {
        // never release planted feet while the pelvis is still lowered (prevents legs sinking into the floor)
        if (c.fT[s] === 0 && p.foot[s].w > 0 && c.pel.y < -0.025) c.fT[s] = 1;
        const h = p.hand[s], g = F.hand[s];
        // safety net: a target that jumps while the hand is still IK-driven is blended, never snapped
        // (compared with where the target was heading, so fast but continuous motion is never mistaken for a jump)
        if (g.hasReq && A.hand[s].w > 0.05 && (h.pos.distanceTo(tmp[15].copy(g.req).addScaledVector(g.reqV, dt)) > 0.06 || h.pole.distanceTo(g.reqPole) > 0.08)) startHandBlend(A.hand[s], g, h);
        if (g.hasReq && dt > 0) g.reqV.subVectors(h.pos, g.req).multiplyScalar(1 / dt);
        g.req.copy(h.pos); g.reqPole.copy(h.pole); g.hasReq = true;
        if (g.t < BLEND && g.w > 0.01) {
          const u = clamp(g.t / BLEND, 0, 1), h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, kk = smooth(u);
          h.pos.addScaledVector(g.off, h00).addScaledVector(g.offV, h10); h.pole.lerpVectors(g.pole, h.pole, kk);
          h.ndir.lerpVectors(g.n, h.ndir, kk).normalize(); h.fdir.lerpVectors(g.f, h.fdir, kk).normalize();
        }
        g.t += dt;
        if (k < 1 && F.footW[s] > 0.01) p.foot[s].pos.lerpVectors(F.foot[s], p.foot[s].pos, k);
        const W = c.wts[s];
        W.h = clamp(spring(W, 'h', c.hT[s], 11, dt), 0, 1); h.w = W.h < 0.002 ? 0 : W.h;
        W.f = clamp(spring(W, 'f', c.fT[s], 12, dt), 0, 1); p.foot[s].w = W.f < 0.002 ? 0 : W.f;
        c.hT[s] = 0; c.fT[s] = 0;
        const ah = A.hand[s]; if (dt > 0) ah.vel.subVectors(h.pos, ah.pos).multiplyScalar(1 / dt); ah.pos.copy(h.pos); ah.n.copy(h.ndir); ah.f.copy(h.fdir); ah.pole.copy(h.pole); ah.w = h.w; A.foot[s].copy(p.foot[s].pos); A.footW[s] = p.foot[s].w;
      }
      if (c.exact) {
        c.pelS.xV = c.pelS.yV = c.pelS.zV = c.pelS.tV = c.pelS.bV = 0;
        c.pel.copy(c.pelT); c.tilt = c.tiltT; c.bend = c.bendT;
        if (k < 1) { c.pel.lerpVectors(F.pel, c.pelT, k); c.tilt = lerp(F.tilt, c.tiltT, k); c.bend = lerp(F.bend, c.bendT, k); }
      } else {
        const P = c.pelS; P.x = c.pel.x; P.y = c.pel.y; P.z = c.pel.z; P.t = c.tilt; P.b = c.bend;
        c.pel.set(spring(P, 'x', c.pelT.x, 9, dt), spring(P, 'y', c.pelT.y, 9, dt), spring(P, 'z', c.pelT.z, 9, dt));
        c.tilt = spring(P, 't', c.tiltT, 8, dt); c.bend = spring(P, 'b', c.bendT, 8, dt);
      }
      c.side = damp(c.side, c.sideT, 6, dt);
      c.lookW = damp(c.lookW, c.lookWT, 4, dt);
      // gaze follows its target smoothly (a real head does not snap to a bouncing ball)
      c.lookOut.lerp(c.look, 1 - Math.exp(-6 * dt));
      A.pel.copy(c.pel); A.tilt = c.tilt; A.bend = c.bend; A.valid = true;
      p.pelvis.copy(c.pel); p.tilt = c.tilt; p.bend = c.bend; p.side = c.side; p.lookW = c.lookW;
      c.pelT.set(0, 0, 0); c.tiltT = 0; c.bendT = 0; c.sideT = 0; c.exact = false;
    }
    function playClip(a, name, o = {}) { const r = a.play(name, o); if (r) a.ctl.clip = name; return r; }

    // ---------------- layout ----------------
    const RIMV = V3(C.rim.x, C.rim.y, C.rim.z);
    const SHOOTER = V3(-1.15, 0, -7.5);
    const toRim = V3(RIMV.x - SHOOTER.x, 0, RIMV.z - SHOOTER.z).normalize();
    const lateral = V3(-toRim.z, 0, toRim.x); // shooter's left when facing the rim
    const HOME = {
      shooter: { p: SHOOTER.clone(), yaw: yawTo(SHOOTER, RIMV) },
      closeout: { p: SHOOTER.clone().addScaledVector(toRim, 1.55).addScaledVector(lateral, 0.42) },
      mate7: { p: V3(4.9, 0, -9.3) }, def8: { p: V3(3.55, 0, -10.6) },
      mate4: { p: V3(-6.0, 0, -12.2) }, def14: { p: V3(-4.45, 0, -11.45) },
      rebounder: { p: V3(1.35, 0, -10.55) }
    };
    HOME.closeout.yaw = yawTo(HOME.closeout.p, SHOOTER);
    HOME.mate7.yaw = yawTo(HOME.mate7.p, SHOOTER); HOME.mate4.yaw = yawTo(HOME.mate4.p, SHOOTER);
    HOME.def8.yaw = yawTo(HOME.def8.p, HOME.mate7.p); HOME.def14.yaw = yawTo(HOME.def14.p, HOME.mate4.p);
    HOME.rebounder.yaw = yawTo(HOME.rebounder.p, SHOOTER);
    const ROSTER = [
      { name: 'shooter', number: 10, kit: 'home', variant: 'a' },
      { name: 'closeout', number: 5, kit: 'away', variant: 'b' },
      { name: 'mate7', number: 7, kit: 'home', variant: 'c' },
      { name: 'mate4', number: 4, kit: 'home', variant: 'a' },
      { name: 'def8', number: 8, kit: 'away', variant: 'c' },
      { name: 'def14', number: 14, kit: 'away', variant: 'b' },
      { name: 'rebounder', number: 12, kit: 'home', variant: 'b' }
    ];
    const CART_BALL = V3(4.6, 0.92 + R, -14.9), CART_STAND = V3(4.6, 0, -14.3);
    const FOCUS = V3(0, 1.4, -9); // where onlookers look: the ball, or the dribbler while he dribbles

    // ---------------- ball control ----------------
    const B = {
      mode: 'gone', pos: V3(0, -5, 0), vel: V3(), quat: new T.Quaternion(), spin: V3(), opacity: 1,
      holder: null, plan: null, outcome: '', flight: 0, events: [], evi: 0, pass: null, ghost: null
    };
    function setBallOpacity(o) {
      B.opacity = o;
      if (!ballMat) return;
      const tr = o < 0.999; if (ballMat.transparent !== tr) { ballMat.transparent = tr; ballMat.needsUpdate = true; }
      ballMat.opacity = o; ball.visible = o > 0.004 && B.mode !== 'gone';
    }

    // ---------------- shot planning ----------------
    const REL = { right: 0.12, up: 2.04, fwd: 0.27 };
    let shot = null; // {plan, keys, t0}
    let seedCounter = 1;
    function planShot(a) {
      const pRel = cw(a, REL.right, REL.up + M.pelvisShot(SHOT.release), REL.fwd);
      const p0 = [pRel.x, pRel.y, pRel.z];
      const mk = M.planMake(p0); if (!mk) return null;
      const tq = M.questionTime(mk);
      let ms = null; for (let k = 0; k < 6 && !ms; k++) ms = M.planMiss(p0, mk, seedCounter++);
      const plan = { release: p0, make: mk, tq, miss: ms };
      // ball path in the hands (world), keyed on the shot clock; velocities continuous at every key
      const pel = t => M.pelvisShot(t);
      const k0 = cw(a, DR.side, DR.yCatch, DR.fwd), v0 = V3(0, DR.vUp, 0);
      const k1 = cw(a, 0.07, 1.0 + pel(SHOT.gather), 0.33);
      const k2 = cw(a, 0.08, 1.08 + pel(0.5), 0.35);
      const tSet = 0.71, k3 = cw(a, 0.12, 1.95 + pel(tSet), 0.22);
      const k4 = fromArr(p0), v4 = fromArr(mk.v);
      const vel = (pa, pb, ta, tb, s = 1) => V3().subVectors(pb, pa).multiplyScalar(s / (tb - ta));
      const keys = [
        { t: 0, p: k0, v: v0 },
        { t: SHOT.gather, p: k1, v: vel(k0, k2, 0, 0.5, 0.55) },
        { t: 0.5, p: k2, v: vel(k1, k3, SHOT.gather, tSet, 0.8) },
        { t: tSet, p: k3, v: vel(k2, k4, 0.5, SHOT.release, 0.32) },
        { t: SHOT.release, p: k4, v: v4 }
      ];
      return { plan, keys, tq, tSet };
    }
    function heldShotBall(keys, t, out) {
      let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
      const a = keys[i], b = keys[i + 1], d = b.t - a.t, s = clamp((t - a.t) / d, 0, 1);
      for (const ax of ['x', 'y', 'z']) out[ax] = M.hermite(a.p[ax], a.v[ax] * d, b.p[ax], b.v[ax] * d, s);
      return out;
    }

    // ---------------- per-frame choreography ----------------
    const tmp = Array.from({ length: 16 }, () => V3());
    let shooterDribble = 0, dribbling = false, pendingShoot = false, readyEmitted = false;
    let introT = 0, lastDribbleU = 0, reactAt = -1, passReq = false, fetchReq = false, outcomeAt = -1;
    let anticipationSent = false;

    // ----- shooter -----
    function shooterUpdate(a, dt) {
      const c = a.ctl, bs = basis(a, { f: V3(), r: V3() }), f = bs.f, r = bs.r;
      c.lookWT = 0.85; c.look.copy(RIMV);
      if (c.state === 'receive') {
        // waiting for the pass: relaxed stance, eyes on the ball, hands rise to meet it
        if (B.mode === 'pass') {
          const P = B.pass, left = P.t0 + P.T - time;
          c.look.copy(B.pos); c.lookWT = 0.9;
          if (left < 0.5) {
            const w = smooth((0.5 - left) / 0.38);
            const target = tmp[9].copy(P.to).addScaledVector(tmp[10].subVectors(P.from, P.to).normalize(), 0.1 * clamp(left / 0.5, 0, 1));
            grip(a, 'R', target, tmp[0].copy(r).multiplyScalar(0.92).addScaledVector(f, 0.38).normalize(), tmp[1].copy(UP).addScaledVector(f, 0.6), shoulder(a, 'R', tmp[2]).addScaledVector(r, 0.3).addScaledVector(UP, -0.5), w, 0.3);
            grip(a, 'L', target, tmp[3].copy(r).multiplyScalar(-0.92).addScaledVector(f, 0.38).normalize(), tmp[4].copy(UP).addScaledVector(f, 0.6), shoulder(a, 'L', tmp[5]).addScaledVector(r, -0.3).addScaledVector(UP, -0.5), w, 0.3);
            pelvis(a, 0, -0.04 * w, 0);
          }
        }
        return;
      }
      if (c.state === 'hold' || c.state === 'drop' || c.state === 'dribble' || c.state === 'shot') {
        stanceFeet(a, 0.14, 0.05);
      }
      if (c.state === 'hold') {
        // absorb the catch, ball to the chest
        const s = smooth(c.t / 0.22);
        B.pos.lerpVectors(c.catchAt, cw(a, 0.0, 1.12, 0.36, tmp[0]), s);
        pelvis(a, 0, -0.05 * Math.sin(Math.PI * clamp(c.t / 0.4, 0, 1)), 0);
        holdBoth(a, B.pos, 1, 0.25);
        if (c.t > 0.3) { c.state = 'drop'; c.t = 0; c.dropFrom = B.pos.clone(); }
        return;
      }
      if (c.state === 'drop') {
        // move the ball to the strong side and push it into the first dribble
        const d = 0.36, s = clamp(c.t / d, 0, 1);
        const end = cw(a, DR.side, DR.yCatch, DR.fwd, tmp[1]);
        for (const ax of ['x', 'y', 'z']) B.pos[ax] = M.hermite(c.dropFrom[ax], 0, end[ax], ax === 'y' ? -DR.vPush * d : 0, s);
        const topW = smooth((s - 0.35) / 0.5);
        const dR = tmp[2].copy(r).multiplyScalar(0.9).addScaledVector(f, -0.2).normalize().lerp(UP, topW).normalize();
        grip(a, 'R', B.pos, dR, tmp[3].copy(f).lerp(UP, 1 - topW).normalize(), shoulder(a, 'R', tmp[4]).addScaledVector(r, 0.35).addScaledVector(UP, -0.4).addScaledVector(f, -0.3), 1, 0.3);
        if (s < 0.6) grip(a, 'L', B.pos, tmp[5].copy(r).negate().addScaledVector(f, -0.2).normalize(), tmp[6].copy(f).addScaledVector(UP, 0.5), shoulder(a, 'L', tmp[7]).addScaledVector(r, -0.3).addScaledVector(UP, -0.5), 1 - smooth(s / 0.6), 0.3);
        pelvis(a, 0, -0.05 * smooth(s), 0); c.tiltT = 0.1 * smooth(s);
        if (s >= 1) { c.state = 'dribble'; c.t = 0; shooterDribble = 0; lastDribbleU = 0; dribbling = true; }
        return;
      }
      if (c.state === 'dribble') {
        const u = shooterDribble, b = M.dribbleAt(u), h = M.dribbleHand(u);
        const col = cw(a, DR.side, 0, DR.fwd, tmp[0]);
        B.pos.set(col.x, b.y, col.z);
        // palm over the ball; while free the hand follows the analytic hand curve
        const palm = tmp[1].set(col.x, h.y, col.z);
        const ballTop = tmp[2].copy(palm).addScaledVector(UP, -(R + 0.013));
        grip(a, 'R', ballTop, UP, tmp[3].copy(f).addScaledVector(r, 0.15), shoulder(a, 'R', tmp[4]).addScaledVector(r, 0.4).addScaledVector(UP, -0.35).addScaledVector(f, -0.35), 1, h.contact ? 0.34 : 0.22);
        // guard hand loosely in front, body low and rhythmic
        const bob = Math.sin((u / DR.period) * Math.PI * 2);
        hand(a, 'L', cw(a, -0.3, 1.08 + 0.01 * bob, 0.3, tmp[5]), dirW(a, 0.6, 0, 0.8, tmp[6]), dirW(a, 0.2, 0.75, 0.5, tmp[7]), shoulder(a, 'L', tmp[8]).addScaledVector(r, -0.4).addScaledVector(UP, -0.4).addScaledVector(f, -0.2), 0.14, 0.25, 0.7);
        pelvis(a, 0, -0.07 + 0.012 * bob, 0); c.tiltT = 0.14; c.bendT = 0.05;
        c.look.copy(RIMV);
        return;
      }
      if (c.state === 'shot') {
        const t = state.tau, S = SHOT;
        pelvis(a, 0, M.pelvisShot(t) - 0.07 * (1 - smooth(t / SHOT.gather)), 0, true);
        // torso: lean into the gather/dip, tall through the release
        c.tiltT = t < S.dip ? 0.14 + 0.1 * smooth(t / S.dip) : t < S.takeoff ? 0.24 * (1 - smooth((t - S.dip) / (S.takeoff - S.dip))) : t < S.land ? -0.03 : 0.08 * Math.sin(Math.PI * clamp((t - S.land) / 0.5, 0, 1));
        c.bendT = t < S.takeoff ? 0.06 : 0; c.exact = true;
        // feet: planted, heels rise on the push, toes point while airborne, absorb on landing
        const lift = M.feetLift(t), heel = M.heelRaise(t);
        stanceFeet(a, 0.14, 0.05, heel * 0.9 + lift, -(heel / S.toe) * 0.55 - 0.15 * smooth(lift / 0.06));
        const ballP = B.pos;
        if (t < S.release) {
          heldShotBall(shot.keys, t, ballP);
          // hand placement: top of the dribble -> sides at the gather -> shooting pocket at the set point
          const kTop = 1 - smooth(t / 0.16), kSet = smooth((t - 0.44) / 0.22);
          const dRside = tmp[0].copy(r).multiplyScalar(0.82).addScaledVector(f, -0.34).addScaledVector(UP, 0.16).normalize();
          const dRset = tmp[1].copy(f).multiplyScalar(-0.72).addScaledVector(UP, -0.6).addScaledVector(r, 0.18).normalize();
          const dR = tmp[2].copy(dRside).lerp(dRset, kSet).normalize().lerp(UP, kTop).normalize();
          const fR = tmp[3].copy(f).multiplyScalar(0.55).addScaledVector(UP, 0.8).lerp(tmp[4].copy(UP).addScaledVector(f, 0.25), kSet).normalize();
          const poleR = shoulder(a, 'R', tmp[5]).addScaledVector(UP, -0.55).addScaledVector(r, 0.28 - 0.18 * kSet).addScaledVector(f, -0.1 + 0.35 * kSet);
          grip(a, 'R', ballP, dR, fR, poleR, 1, 0.4);
          const wL = smooth(t / 0.2);
          const dL = tmp[6].copy(r).multiplyScalar(-0.9).addScaledVector(f, -0.22 + 0.12 * kSet).addScaledVector(UP, 0.12).normalize();
          const poleL = shoulder(a, 'L', tmp[7]).addScaledVector(UP, -0.55).addScaledVector(r, -0.35).addScaledVector(f, -0.05);
          grip(a, 'L', ballP, dL, tmp[8].copy(UP).addScaledVector(f, 0.35), poleL, wL, 0.32);
        } else {
          // follow-through, continuous with the release: the wrist keeps moving the way the hand was moving,
          // then settles slightly further along the shooting line while the wrist snaps down ("gooseneck");
          // the guide hand stays up and opens away from the ball. Offsets ride on the shoulders through the jump.
          const shR = shoulder(a, 'R', tmp[0]), shL = shoulder(a, 'L', tmp[9]), A0 = c.applied.hand;
          if (c.followShot !== shot) {
            c.followShot = shot;
            const wr = A0.R.pos.clone().addScaledVector(A0.R.f, -0.044).addScaledVector(A0.R.n, -0.028);
            c.fo = { offR: wr.sub(shR), nR: A0.R.n.clone(), fR: A0.R.f.clone(), vR: A0.R.vel.clone(),
                     offL: A0.L.pos.clone().sub(shL), nL: A0.L.n.clone(), fL: A0.L.f.clone(), vL: A0.L.vel.clone() };
            for (const v of [c.fo.vR, c.fo.vL]) if (v.length() > 2) v.setLength(2);
          }
          const fo = c.fo, D = 0.2, s = clamp((t - S.release) / D, 0, 1), sd = smooth((t - S.release) / 0.14);
          const endR = tmp[1].copy(fo.offR).addScaledVector(f, 0.05).addScaledVector(UP, 0.03);
          const offR = tmp[2]; for (const ax of ['x', 'y', 'z']) offR[ax] = M.hermite(fo.offR[ax], fo.vR[ax] * D, endR[ax], 0, s);
          if (offR.length() > 0.55) offR.setLength(0.55);              // stay inside the arm's reach (no IK clamping)
          const fdir = tmp[3].copy(fo.fR).lerp(tmp[4].copy(f).multiplyScalar(0.78).addScaledVector(UP, -0.62), sd).normalize();
          const ndir = tmp[5].copy(fo.nR).lerp(tmp[6].copy(f).multiplyScalar(-0.62).addScaledVector(UP, -0.78), sd);
          ndir.addScaledVector(fdir, -ndir.dot(fdir)).normalize();
          const palm = tmp[7].copy(shR).add(offR).addScaledVector(fdir, 0.044).addScaledVector(ndir, 0.028);
          const lower = smooth((t - (S.land + 0.85)) / 0.6);
          hand(a, 'R', palm, ndir, fdir, tmp[8].copy(shR).addScaledVector(UP, -0.55).addScaledVector(r, 0.1).addScaledVector(f, 0.25), 0.28 + 0.2 * sd, 0.2, 1 - lower); // same elbow pole as at the set point
          const endL = tmp[10].copy(fo.offL).addScaledVector(r, -0.08).addScaledVector(f, 0.03);
          const offL = tmp[11]; for (const ax of ['x', 'y', 'z']) offL[ax] = M.hermite(fo.offL[ax], fo.vL[ax] * D, endL[ax], 0, s);
          if (offL.length() > 0.6) offL.setLength(0.6);
          const nL = tmp[12].copy(fo.nL).lerp(r, sd).normalize(), fL = tmp[13].copy(fo.fL).lerp(UP, sd).normalize();
          hand(a, 'L', tmp[14].copy(shL).add(offL), nL, fL, tmp[15].copy(shL).addScaledVector(UP, -0.55).addScaledVector(r, -0.35).addScaledVector(f, -0.05), 0.2, 0.2, 1 - lower); // same pole as the guide hand on the ball
        }
        return;
      }
      if (c.state === 'react') return;
    }
    function holdBoth(a, ballP, w, curl = 0.4) {
      const bs = basis(a, { f: V3(), r: V3() });
      grip(a, 'R', ballP, tmp[12].copy(bs.r).multiplyScalar(0.9).addScaledVector(bs.f, -0.3).normalize(), tmp[13].copy(bs.f).addScaledVector(UP, 0.7), shoulder(a, 'R', tmp[14]).addScaledVector(UP, -0.6).addScaledVector(bs.r, 0.35), w, curl);
      grip(a, 'L', ballP, tmp[9].copy(bs.r).multiplyScalar(-0.9).addScaledVector(bs.f, -0.3).normalize(), tmp[10].copy(bs.f).addScaledVector(UP, 0.7), shoulder(a, 'L', tmp[11]).addScaledVector(UP, -0.6).addScaledVector(bs.r, -0.35), w, curl);
    }

    // ----- defenders in stance (close-out + two help defenders) -----
    function stance(a, dt, opts2) {
      const c = a.ctl, bs = basis(a, { f: V3(), r: V3() }), f = bs.f, r = bs.r;
      const s = c.slide;
      // lateral slides: lead foot then trail foot, root follows
      if (s) {
        s.t += dt; const k = clamp(s.t / s.d, 0, 1);
        a.root.position.lerpVectors(s.from, s.to, smooth(k));
        for (const side of ['L', 'R']) {
          const lead = side === s.lead, k0 = lead ? 0 : 0.38, k1 = lead ? 0.62 : 1;
          const kk = smooth((k - k0) / (k1 - k0));
          c.planted[side].lerpVectors(s.fromFeet[side], s.toFeet[side], kk);
          c.planted[side].y = DRIBBLE_ANKLE + 0.05 * Math.sin(Math.PI * clamp((k - k0) / (k1 - k0), 0, 1));
          if (lead && !s.squeaked && k >= k1) { s.squeaked = true; emit('squeak', { pos: c.planted[side].clone(), intensity: 0.55 }); }
        }
        if (k >= 1) c.slide = null;
      } else if (opts2.slides && time > c.nextSlide) {
        c.nextSlide = time + 1.6 + Math.random() * 2.6;
        const off = clamp((Math.random() * 2 - 1) * 0.5, -0.5, 0.5);
        const to = c.home.p.clone().addScaledVector(r, off);
        if (to.distanceTo(a.root.position) > 0.12) {
          const dir = Math.sign(tmp[0].subVectors(to, a.root.position).dot(r)) || 1;
          const delta = tmp[1].subVectors(to, a.root.position);
          c.slide = { t: 0, d: 0.42 + delta.length() * 0.25, from: a.root.position.clone(), to, lead: dir > 0 ? 'R' : 'L', fromFeet: { L: c.planted.L.clone(), R: c.planted.R.clone() }, toFeet: { L: c.planted.L.clone().add(delta), R: c.planted.R.clone().add(delta) }, squeaked: false };
        }
      }
      const low = opts2.low ?? 1;
      const bob = Math.sin(time * 2 * Math.PI * 1.35 + c.phase) * 0.012;
      pelvis(a, 0, (-0.2 + bob) * low, -0.03 * low);
      c.tiltT = 0.34 * low; c.bendT = 0.04 * low;
      for (const side of ['L', 'R']) foot(a, side, c.planted[side], 0, 1, 0.26);
      // active hands: one high, one low and wide (palms toward the ball)
      const hi = opts2.highHand || 'L', lo = hi === 'L' ? 'R' : 'L', sg = hi === 'L' ? -1 : 1;
      const shH = shoulder(a, hi, tmp[2]), shLo = shoulder(a, lo, tmp[3]);
      hand(a, hi, tmp[4].copy(shH).addScaledVector(UP, 0.38 * low + 0.04).addScaledVector(f, 0.28).addScaledVector(r, sg * 0.12), tmp[5].copy(f), tmp[6].copy(UP).addScaledVector(r, sg * 0.25).normalize(), tmp[7].copy(shH).addScaledVector(UP, -0.4).addScaledVector(r, sg * 0.5), 0.12, 0.3, low);
      hand(a, lo, tmp[8].copy(shLo).addScaledVector(UP, -0.28).addScaledVector(f, 0.3).addScaledVector(r, -sg * 0.42), tmp[9].copy(f), tmp[10].copy(UP).addScaledVector(r, -sg * 0.6).normalize(), tmp[11].copy(shLo).addScaledVector(UP, -0.3).addScaledVector(r, -sg * 0.6).addScaledVector(f, -0.3), 0.12, 0.3, low);
    }
    function plantHere(a) { const c = a.ctl; cw(a, -0.3, DRIBBLE_ANKLE, 0.04, c.planted.L); cw(a, 0.3, DRIBBLE_ANKLE, -0.06, c.planted.R); }

    function closeoutUpdate(a, dt) {
      const c = a.ctl, bs = basis(a, { f: V3(), r: V3() }), f = bs.f, r = bs.r;
      c.look.copy(people.shooter.root.position).setY(1.25); c.lookWT = 0.8;
      if (c.state === 'stance') { stance(a, dt, { slides: false, highHand: 'L' }); c.look.copy(FOCUS); return; }
      if (c.state === 'contest') {
        const t = state.tau - 0.1, k = smooth((state.tau - 0.18) / 0.3);
        const jump = 0.72 * M.pelvisShot(t), lift = 0.72 * M.feetLift(t), heel = 0.72 * M.heelRaise(t);
        pelvis(a, 0, lerp(-0.2, jump, k), lerp(-0.03, 0, k), true);
        c.tiltT = lerp(0.34, 0.04, k); c.bendT = 0.02; c.exact = true;
        for (const side of ['L', 'R']) foot(a, side, tmp[0].copy(c.planted[side]).setY(DRIBBLE_ANKLE + lift + heel * 0.9), -(heel / SHOT.toe) * 0.4 * 0.72 - 0.12 * smooth(lift / 0.05), 1, 0.2);
        // contesting hand rises toward the release point without touching the ball
        const sh = shoulder(a, 'L', tmp[1]), toS = tmp[2].subVectors(people.shooter.root.position, a.root.position).setY(0).normalize();
        const up = smooth((state.tau - 0.3) / 0.4), down = smooth((state.tau - (SHOT.land + 0.6)) / 0.6);
        const reach = tmp[3].copy(sh).addScaledVector(UP, lerp(0.36, 0.47, up)).addScaledVector(toS, lerp(0.28, 0.14, up)).addScaledVector(r, -0.06);
        hand(a, 'L', reach, tmp[4].copy(toS), tmp[5].copy(UP), tmp[6].copy(sh).addScaledVector(UP, -0.4).addScaledVector(r, -0.5), 0.1, 0.3, 1 - down);
        const shR = shoulder(a, 'R', tmp[7]);
        hand(a, 'R', tmp[8].copy(shR).addScaledVector(UP, lerp(-0.28, -0.42, up)).addScaledVector(f, 0.25).addScaledVector(r, 0.42), tmp[9].copy(f), tmp[10].copy(UP).addScaledVector(r, 0.6).normalize(), tmp[11].copy(shR).addScaledVector(UP, -0.3).addScaledVector(r, 0.6).addScaledVector(f, -0.3), 0.12, 0.3, 1 - down);
        c.look.copy(FOCUS);
        return;
      }
      // watch: upright, mocap idle, eyes on the ball
      c.look.copy(FOCUS);
    }
    function helpUpdate(a, dt) {
      const c = a.ctl;
      c.look.copy(FOCUS); c.lookWT = 0.75;
      if (c.state === 'stance') stance(a, dt, { slides: true, highHand: c.highHand, low: 0.85 });
    }
    function mateUpdate(a, dt) {
      const c = a.ctl;
      c.look.copy(FOCUS); c.lookWT = 0.72;
      reactUpdate(a);
    }
    function reactUpdate(a) {
      const c = a.ctl;
      if (c.react && time >= c.react.at) { playClip(a, c.react.clip, { fade: 0.4, loop: false, speed: c.react.speed }); c.react.endAt = time + c.react.len; c.react.at = Infinity; }
      if (c.react && c.react.endAt && time >= c.react.endAt) { playClip(a, c.idleClip, { fade: 0.7, offset: Math.random() }); c.react = null; }
    }

    // ----- rebounder -----
    function locomote(a, dt, path) {
      // path: {from, to, t0, t1, face} smooth speed profile; clip matched to speed
      const c = a.ctl, k = clamp((time - path.t0) / (path.t1 - path.t0), 0, 1);
      const s = smooth(k), dist = path.from.distanceTo(path.to);
      a.root.position.lerpVectors(path.from, path.to, s);
      const speed = dist * 6 * k * (1 - k) / (path.t1 - path.t0);
      const cur = a.current, gait = cur && (c.clip === 'walk' || c.clip === 'run') ? (cur.time / cur.getClip().duration) % 1 : Math.random();
      // hysteresis between walk and run; the new gait starts at the same step phase (no foot pop)
      if (speed > (c.clip === 'run' ? 1.55 : 1.85)) { const cl = playClip(a, 'run', { fade: 0.3, offset: gait }); if (cl) cl.timeScale = clamp(speed / 2.41, 0.75, 1.6); }
      else if (speed > (c.clip === 'walk' ? 0.14 : 0.22)) { const cl = playClip(a, 'walk', { fade: 0.3, offset: gait }); if (cl) cl.timeScale = clamp(speed / 1.01, 0.6, 1.8); }
      else playClip(a, 'idle', { fade: 0.35 });
      const moveYaw = yawTo(path.from, path.to);
      const want = (speed > 0.35 && k < 0.85) ? moveYaw : (path.face ? yawTo(a.root.position, path.face) : a.yaw);
      turn(a, want, dt, 7, 5.5);
      if (!c.squeakT || time > c.squeakT) { if (speed > 2.4 && Math.random() < 0.02) { c.squeakT = time + 0.6; emit('squeak', { pos: a.root.position.clone(), intensity: 0.8 }); } }
      return k >= 1;
    }
    /** yaw follows a critically damped spring with a speed cap: turns start and stop gently */
    function turn(a, want, dt, omega = 7, maxRate = 5) {
      const c = a.ctl; let v = c.yawV || 0;
      const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n; let y = a.yaw;
      for (let i = 0; i < n; i++) { v += (omega * omega * angDiff(y, want) - 2 * omega * v) * h; v = clamp(v, -maxRate, maxRate); y += v * h; }
      c.yawV = v; a.setTransform(a.root.position.x, a.root.position.z, y);
    }
    function faceTowards(a, target, dt, rate = 7) { turn(a, yawTo(a.root.position, target), dt, Math.min(9, rate * 1.2), 4.5); }
    function chestPoint(a, out, fwd = 0.34, h = 1.16) { return cw(a, 0, h + a.ctl.pel.y, fwd, out); }

    function planCatch(a) {
      // earliest reachable moment where the simulated ball is between knee and head height
      const P = B.plan, sim = B.outcome === 'miss' ? P.plan.miss.sim : P.plan.make.sim;
      const now = B.flight, start = a.root.position.clone();
      for (let t = now + 0.5; t < sim.tEnd - 0.05; t += 1 / 30) {
        const s = M.sampleSim(sim, t), p = s.p;
        if (p[1] < 0.72 || p[1] > 1.45 || s.v[1] > 1.2) continue;
        if (Math.abs(p[0]) > 7.0 || p[2] < -13.7 || p[2] > 0) continue;
        const bp = V3(p[0], 0, p[2]);
        const dir = bp.clone().sub(start); const dlen = dir.length();
        const stand = dlen > 0.45 ? bp.clone().addScaledVector(dir.normalize(), -0.42) : start.clone();
        const dist = stand.distanceTo(start), avail = (t - now) - 0.32;
        if (avail <= 0.15) continue;
        if (dist / avail * 1.5 > 5.4) continue;
        return { t, stand, ball: V3(p[0], p[1], p[2]), dur: Math.max(0.35, avail) };
      }
      return null;
    }
    function rebounderUpdate(a, dt) {
      const c = a.ctl, bs = basis(a, { f: V3(), r: V3() }), f = bs.f, r = bs.r;
      c.lookWT = 0.75;
      state.passPhase = c.state;
      switch (c.state) {
        case 'home': {
          c.look.copy(FOCUS);
          faceTowards(a, B.mode === 'shot' ? tmp[0].copy(B.pos).setY(0) : people.shooter.root.position, dt, 3);
          if (state.mode === 'shot' || state.mode === 'frozen' || state.mode === 'resolve') {
            // box-out readiness: knees bent, hands up
            pelvis(a, 0, -0.12, -0.02); c.tiltT = 0.18;
            stanceFeet(a, 0.2, 0.02);
            const shL = shoulder(a, 'L', tmp[1]), shR = shoulder(a, 'R', tmp[2]);
            hand(a, 'L', tmp[3].copy(shL).addScaledVector(UP, 0.05).addScaledVector(f, 0.28).addScaledVector(r, -0.22), tmp[4].copy(f), tmp[5].copy(UP), tmp[6].copy(shL).addScaledVector(UP, -0.4).addScaledVector(r, -0.4), 0.15, 0.3, 0.8);
            hand(a, 'R', tmp[7].copy(shR).addScaledVector(UP, 0.05).addScaledVector(f, 0.28).addScaledVector(r, 0.22), tmp[8].copy(f), tmp[9].copy(UP), tmp[10].copy(shR).addScaledVector(UP, -0.4).addScaledVector(r, 0.4), 0.15, 0.3, 0.8);
          }
          break;
        }
        case 'chase': {
          const pl = c.catchPlan;
          c.look.copy(B.pos);
          locomote(a, dt, { from: c.from, to: pl.stand, t0: c.t0, t1: c.t0 + pl.dur, face: pl.ball });
          const left = pl.t - B.flight;
          const near = a.root.position.distanceTo(pl.stand);
          if (left < 0.42 && near < 1.1) { // reach for the ball with both hands once he is there
            const w = smooth((0.42 - left) / 0.32) * (1 - smooth((near - 0.5) / 0.6));
            catchHands(a, pl.ball, w);
            pelvis(a, 0, -0.06 * w, 0);
          }
          if (B.flight >= pl.t) {
            B.mode = 'held'; B.holder = a; c.state = 'caught'; c.t = 0; c.catchFrom = B.pos.clone();
            emit('catch', { pos: B.pos.clone() });
          }
          break;
        }
        case 'caught': {
          playClip(a, 'idle', { fade: 0.4 });
          const s = smooth(c.t / 0.25);
          B.pos.lerpVectors(c.catchFrom, chestPoint(a, tmp[0]), s);
          holdBoth(a, B.pos, 1);
          pelvis(a, 0, -0.06 * (1 - s), 0);
          faceTowards(a, people.shooter.root.position, dt, 3);
          if (c.t > 0.35) { c.state = 'hold'; c.t = 0; }
          break;
        }
        case 'hold': {
          B.pos.copy(chestPoint(a, tmp[0])); holdBoth(a, B.pos, 1);
          c.look.copy(people.shooter.root.position).setY(1.5);
          faceTowards(a, people.shooter.root.position, dt, 4);
          if (passReq && c.t > 0.25) { c.state = 'pass'; c.t = 0; passReq = false; }
          break;
        }
        case 'fetch': {
          c.look.copy(CART_BALL);
          if (locomote(a, dt, { from: c.from, to: CART_STAND, t0: c.t0, t1: c.t0 + c.dur, face: CART_BALL })) { c.state = 'pick'; c.t = 0; }
          break;
        }
        case 'pick': {
          faceTowards(a, CART_BALL, dt, 8);
          const k = Math.sin(Math.PI * clamp(c.t / 0.9, 0, 1));
          pelvis(a, 0, -0.1 * k, 0); c.tiltT = 0.42 * k; c.bendT = 0.12 * k;
          stanceFeet(a, 0.16, 0.02);
          c.look.copy(CART_BALL);
          c.phase = c.t < 0.42 ? 'reach' : 'lift';
          if (c.t < 0.42) catchHands(a, CART_BALL, smooth(c.t / 0.35));
          else {
            if (B.mode !== 'held' || B.holder !== a) {
              retireBall();
              B.mode = 'held'; B.holder = a; setBallOpacity(1); ball.visible = true; B.pos.copy(CART_BALL); cartBalls && (cartBalls.count = 4);
              emit('catch', { pos: CART_BALL.clone() });
            }
            const s = smooth((c.t - 0.42) / 0.45);
            B.pos.lerpVectors(CART_BALL, chestPoint(a, tmp[0]), s);
            holdBoth(a, B.pos, 1);
          }
          if (c.t > 0.95) { c.state = 'return'; c.t = 0; c.from = a.root.position.clone(); c.t0 = time; c.dur = Math.max(1.0, c.from.distanceTo(c.home.p) / 1.9); }
          break;
        }
        case 'return': {
          B.pos.copy(chestPoint(a, tmp[0])); holdBoth(a, B.pos, 1);
          if (passReq && a.root.position.distanceTo(people.shooter.root.position) < 8.6) { c.state = 'pass'; c.t = 0; passReq = false; playClip(a, 'idle', { fade: 0.3 }); break; }
          if (locomote(a, dt, { from: c.from, to: c.home.p, t0: c.t0, t1: c.t0 + c.dur, face: people.shooter.root.position })) { c.state = 'hold'; c.t = 0; }
          break;
        }
        case 'pass': {
          // turn, step into a two-hand chest pass, release, follow through
          playClip(a, 'idle', { fade: 0.3 });
          const S = people.shooter, aim = S.root.position;
          faceTowards(a, aim, dt, 10);
          c.look.copy(aim).setY(1.4);
          const tWind = 0.26, tRel = 0.44;
          c.phase = c.t < tRel ? 'push' : 'follow';
          if (c.t < tRel) {
            const k = c.t < tWind ? 0 : (c.t - tWind) / (tRel - tWind);
            const pull = chestPoint(a, tmp[0], 0.26, 1.15), push = chestPoint(a, tmp[1], 0.47, 1.2);
            if (c.t < tWind) B.pos.lerpVectors(chestPoint(a, tmp[2]), pull, smooth(c.t / tWind));
            else B.pos.lerpVectors(pull, push, k * k);
            holdBoth(a, B.pos, 1, 0.3);
            pelvis(a, 0, -0.05 * Math.sin(Math.PI * clamp(c.t / 0.7, 0, 1)), 0.05 * smooth(k)); c.tiltT = 0.12 * smooth(k);
            stanceFeet(a, 0.15, 0.08);
          } else {
            if (B.mode === 'held' && B.holder === a) launchPass(a);
            const k = clamp((c.t - tRel) / 0.5, 0, 1);
            const shL = shoulder(a, 'L', tmp[3]), shR = shoulder(a, 'R', tmp[4]), toS = tmp[5].subVectors(aim, a.root.position).setY(0).normalize();
            const w = 1 - smooth((k - 0.5) / 0.5);
            // palms out, thumbs down after the push
            hand(a, 'L', tmp[6].copy(shL).addScaledVector(toS, 0.48).addScaledVector(UP, -0.08).addScaledVector(r, 0.05), tmp[7].copy(toS).addScaledVector(r, -0.4).normalize(), tmp[8].copy(UP).addScaledVector(r, 0.3).normalize(), tmp[9].copy(shL).addScaledVector(UP, -0.4).addScaledVector(r, -0.5), 0.1, 0.2, w);
            hand(a, 'R', tmp[10].copy(shR).addScaledVector(toS, 0.48).addScaledVector(UP, -0.08).addScaledVector(r, -0.05), tmp[11].copy(toS).addScaledVector(r, 0.4).normalize(), tmp[12].copy(UP).addScaledVector(r, -0.3).normalize(), tmp[13].copy(shR).addScaledVector(UP, -0.4).addScaledVector(r, 0.5), 0.1, 0.2, w);
            pelvis(a, 0, -0.03 * w, 0.05 * w); c.tiltT = 0.1 * w;
            stanceFeet(a, 0.15, 0.08, 0, 0, w);
            if (k >= 1) { c.state = a.root.position.distanceTo(c.home.p) > 0.6 ? 'gohome' : 'home'; c.t = 0; c.from = a.root.position.clone(); c.t0 = time; c.dur = Math.max(0.9, c.from.distanceTo(c.home.p) / 1.6); }
          }
          break;
        }
        case 'gohome': {
          c.look.copy(B.pos);
          if (locomote(a, dt, { from: c.from, to: c.home.p, t0: c.t0, t1: c.t0 + c.dur, face: people.shooter.root.position })) { c.state = 'home'; c.t = 0; }
          break;
        }
        case 'wait': {
          c.look.copy(FOCUS); faceTowards(a, tmp[0].copy(B.pos).setY(0), dt, 4);
          break;
        }
      }
    }
    function catchHands(a, ballP, w) {
      const toA = tmp[14].subVectors(a.root.position, ballP).setY(0).normalize(); // from ball to the catcher
      const side = tmp[15].set(-toA.z, 0, toA.x);
      grip(a, 'L', ballP, V3().copy(side).multiplyScalar(-0.86).addScaledVector(toA, 0.45).normalize(), V3().copy(toA).negate().addScaledVector(UP, 0.7), shoulder(a, 'L', V3()).addScaledVector(UP, -0.5), w, 0.32);
      grip(a, 'R', ballP, V3().copy(side).multiplyScalar(0.86).addScaledVector(toA, 0.45).normalize(), V3().copy(toA).negate().addScaledVector(UP, 0.7), shoulder(a, 'R', V3()).addScaledVector(UP, -0.5), w, 0.32);
    }
    function launchPass(a) {
      const S = people.shooter, to = cw(S, 0, 1.2, 0.46), from = B.pos.clone();
      const d = from.distanceTo(to), Tt = clamp(d / 10.5 + 0.12, 0.45, 1.15);
      const v = to.clone().sub(from).multiplyScalar(1 / Tt); v.y += 0.5 * G * Tt;
      B.mode = 'pass'; B.holder = null; B.pass = { from, to, v, T: Tt, t0: time };
      B.spin.copy(V3().crossVectors(v.clone().setY(0).normalize(), UP)).multiplyScalar(2 * Math.PI * 1.2);
      emit('pass', { pos: from.clone() });
      S.ctl.state = 'receive';
      if (cartBalls && !B.ghost) cartBalls.count = 5;
    }
    function retireBall() {
      // the previous ball leaves play (fades) when a new one is taken from the cart
      if (!ghost) return;
      if (B.mode === 'shot' && B.opacity > 0.05 && ball.visible) {
        ghost.visible = true; ghost.position.copy(ball.position); ghost.quaternion.copy(ball.quaternion);
        B.ghost = { flight: B.flight, sim: B.outcome === 'miss' ? B.plan.plan.miss.sim : B.plan.plan.make.sim, t: 0 };
        ghost.material.opacity = 1;
      }
    }

    // ----- state transitions -----
    function beginShot() {
      const a = people.shooter;
      shot = planShot(a);
      if (!shot) { console.warn('shot plan failed'); return; }
      B.plan = shot; B.mode = 'held'; B.holder = a; B.outcome = ''; B.flight = 0; B.events = []; B.evi = 0;
      state.mode = 'shot'; state.tau = 0; a.ctl.state = 'shot'; a.ctl.t = 0; dribbling = false;
      const co = people.closeout; co.ctl.state = 'contest';
      emit('gather', { pos: B.pos.clone() });
      if (!anticipationSent) { anticipationSent = true; crowd && crowd.react('anticipate'); }
      state.releaseSent = false; state.landSent = false; state.questionSent = false;
    }
    function startReactions(result) {
      const list = [['mate7', 0.25], ['mate4', 0.55], ['def8', 0.4], ['def14', 0.7], ['closeout', 0.35], ['shooter', 0.3]];
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
      for (const [n, d] of list) {
        const a = people[n]; if (!a) continue;
        const own = a.ctl.kit === 'home';
        let clip = null, len = 3.2, speed = 0.92 + Math.random() * 0.16;
        if (result === 'make') clip = own ? pick(n === 'shooter' ? ['cheer_small', 'cheer_pump'] : ['clap', 'cheer_small', 'clap_alt', 'cheer_pump']) : pick(['shrug', 'look', 'idle_alt']);
        else if (result === 'miss') clip = own ? pick(n === 'shooter' ? ['sad', 'shrug'] : ['clap_alt', 'shrug', 'clap']) : pick(['look', 'idle_alt']);
        if (!clip) continue;
        if (clip === 'sad') len = 2.6;
        if (n === 'def8' || n === 'def14' || n === 'closeout') a.ctl.state = 'watch';
        a.ctl.react = { at: time + d + Math.random() * 0.35, clip, len: len + Math.random() * 0.8, speed };
      }
    }
    function toReadyFormation() {
      for (const n of ['def8', 'def14', 'closeout']) {
        const a = people[n]; if (!a) continue;
        if (a.ctl.state !== 'stance') { a.ctl.state = 'stance'; plantHere(a); a.ctl.nextSlide = time + 1 + Math.random() * 2; }
        if (a.ctl.react) { a.ctl.react = null; playClip(a, a.ctl.idleClip, { fade: 0.6, offset: Math.random() }); }
      }
    }
    function maybeReady() {
      if (state.mode !== 'intro' && state.mode !== 'pass') return;
      if (people.shooter.ctl.state === 'dribble' && shooterDribble > DR.t1 + 0.01) {
        state.mode = 'ready'; state.passPhase = ''; readyEmitted = true; anticipationSent = false; emit('ready', {});
      }
    }

    // ---------------- camera ----------------
    const cam = { pos: V3(), target: V3(), fov: 46, shake: 0 };
    const views = {};
    function computeViews() {
      const S = SHOOTER, back = toRim.clone().negate(), right = V3(-toRim.z, 0, toRim.x).negate();
      views.play = { pos: S.clone().addScaledVector(back, 4.4).addScaledVector(right, 1.3).setY(2.5), target: S.clone().lerp(RIMV, 0.58).addScaledVector(right, -0.15).setY(1.98) };
      views.flight = { pos: views.play.pos.clone().addScaledVector(toRim, 0.9).setY(2.62), target: S.clone().lerp(RIMV, 0.72).setY(2.6) };
      views.celebrate = { pos: S.clone().addScaledVector(back, 2.6).addScaledVector(right, 2.1).setY(2.15), target: S.clone().lerp(RIMV, 0.5).setY(1.85) };
      views.intro = { pos: V3(8.6, 7.4, 2.2), target: V3(0.3, 1.2, -9.6) };
      views.pass = { pos: views.play.pos.clone().addScaledVector(back, 0.4).setY(2.6), target: S.clone().lerp(RIMV, 0.55).setY(1.9) };
    }
    function desiredView(out) {
      if (reduced) { out.pos.copy(views.play.pos); out.target.copy(views.play.target); return 0; }
      const m = state.mode;
      if (m === 'intro') {
        const k = smooth((introT - 0.4) / 3.2);
        out.pos.lerpVectors(views.intro.pos, views.play.pos, k); out.target.lerpVectors(views.intro.target, views.play.target, k);
        return 6;
      }
      if (m === 'shot' || m === 'frozen' || m === 'resolve') {
        const k = smooth((state.tau - 0.55) / 0.7);
        out.pos.lerpVectors(views.play.pos, views.flight.pos, k); out.target.lerpVectors(views.play.target, views.flight.target, k);
        return 2.4;
      }
      if (m === 'post' && state.outcome === 'make' && time - outcomeAt < 2.6) {
        const k = smooth((time - outcomeAt - 0.2) / 0.9) * (1 - smooth((time - outcomeAt - 1.9) / 0.7));
        out.pos.lerpVectors(views.flight.pos, views.celebrate.pos, k * 0.55); out.target.lerpVectors(views.flight.target, views.celebrate.target, k * 0.5);
        return 1.6;
      }
      if (m === 'post') {
        out.pos.copy(views.flight.pos); out.target.copy(views.flight.target);
        if (B.mode === 'shot' || B.mode === 'held') out.target.lerp(tmp[0].copy(B.pos).setY(Math.max(1.6, B.pos.y)), 0.18);
        return 1.4;
      }
      if (m === 'pass') { out.pos.copy(views.pass.pos); out.target.copy(views.pass.target); return 1.6; }
      out.pos.copy(views.play.pos); out.target.copy(views.play.target); return 2.2;
    }
    const _dv = { pos: V3(), target: V3() };
    function updateCamera(dt, snap) {
      const rate = desiredView(_dv);
      if (snap || reduced || !rate) { cam.pos.copy(_dv.pos); cam.target.copy(_dv.target); }
      else {
        const k = 1 - Math.exp(-rate * dt);
        cam.pos.lerp(_dv.pos, k); cam.target.lerp(_dv.target, k);
      }
      camera.position.copy(cam.pos); camera.lookAt(cam.target);
    }

    // ---------------- loading ----------------
    async function load(progress = () => { }) {
      const manager = new T.LoadingManager();
      let frac = 0; const report = f => { frac = Math.max(frac, f); progress(Math.min(1, frac)); };
      manager.onProgress = (url, loaded, total) => report(0.05 + 0.8 * loaded / Math.max(total, 1));
      report(0.02);
      const pm = new T.PMREMGenerator(renderer);
      env = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; pm.dispose();
      scene.environment = env;
      const [lib, clib] = await Promise.all([
        root.BasketballAthletes.load(base, manager, Q),
        root.BasketballCrowd.load(base, manager)
      ]);
      athletesLib = lib; crowdLib = clib;
      report(0.86);
      arena = root.BasketballArena.build(scene, { quality: Q, env });
      // ball + accessories
      const bt = ballTextures(Q.tier === 'low' ? 512 : 1024); disposables.push(bt.map, bt.bump);
      ballMat = new T.MeshStandardMaterial({ map: bt.map, bumpMap: bt.bump, bumpScale: 0.0022, roughness: 0.74, metalness: 0, envMapIntensity: 0.35 });
      disposables.push(ballMat, ballGeo);
      ball = new T.Mesh(ballGeo, ballMat); ball.castShadow = true; ball.receiveShadow = true; ball.name = 'ball'; scene.add(ball);
      const gm = ballMat.clone(); gm.transparent = true; disposables.push(gm);
      ghost = new T.Mesh(ballGeo, gm); ghost.visible = false; ghost.castShadow = true; scene.add(ghost);
      const haloTex = radialTexture([[0, 'rgba(255,240,205,0.9)'], [0.35, 'rgba(255,214,150,0.35)'], [1, 'rgba(255,200,120,0)']]); disposables.push(haloTex);
      const haloMat = new T.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }); disposables.push(haloMat);
      halo = new T.Sprite(haloMat); halo.scale.set(0.7, 0.7, 1); halo.visible = false; scene.add(halo);
      cartBalls = new T.InstancedMesh(ballGeo, ballMat, 5); cartBalls.castShadow = true;
      const dm = new T.Object3D();
      [[4.3, 0.92 + R, -14.9], [4.6, 0.92 + R, -14.9], [4.9, 0.92 + R, -14.9], [4.42, 0.52 + R, -14.85], [4.78, 0.52 + R, -14.95]].forEach((p, i) => { dm.position.set(p[0], p[1], p[2]); dm.rotation.set(i, i * 2, 0); dm.updateMatrix(); cartBalls.setMatrixAt(i, dm.matrix); });
      // keep the middle top ball last so hiding count=4 removes it
      const m1 = new T.Matrix4(), m4 = new T.Matrix4(); cartBalls.getMatrixAt(1, m1); cartBalls.getMatrixAt(4, m4); cartBalls.setMatrixAt(1, m4); cartBalls.setMatrixAt(4, m1);
      scene.add(cartBalls);
      const netMat = new T.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.85, metalness: 0 }); disposables.push(netMat);
      net = createNet(scene, netMat);
      // crowd
      crowd = root.BasketballCrowd.create(crowdLib, arena.seats, { count: Q.crowd, seed: 11 });
      scene.add(crowd.group);
      crowd.meshes.forEach(m => { m.userData.full = m.count; });
      // athletes
      for (const r of ROSTER) {
        const a = lib.create({ variant: r.variant, kit: r.kit, number: r.number, name: r.name });
        const h = HOME[r.name]; a.setTransform(h.p.x, h.p.z, h.yaw);
        const c = rig(a, r.name); c.home = h; c.kit = r.kit; c.phase = Math.random() * 6.28;
        c.idleClip = ['idle', 'idle_alt', 'look'][Math.floor(Math.random() * 3)];
        if (r.name === 'shooter' || r.name === 'rebounder') c.idleClip = 'idle';
        playClip(a, c.idleClip, { fade: 0, offset: Math.random(), speed: 0.9 + Math.random() * 0.2 });
        scene.add(a.root); people[r.name] = a;
      }
      people.def8.ctl.highHand = 'R'; people.def14.ctl.highHand = 'L';
      for (const n of ['def8', 'def14', 'closeout']) { const a = people[n]; a.ctl.state = 'stance'; plantHere(a); a.ctl.nextSlide = 1 + Math.random() * 3; }
      people.shooter.ctl.state = 'receive';
      people.rebounder.ctl.state = 'hold';
      B.mode = 'held'; B.holder = people.rebounder; B.pos.copy(chestPoint(people.rebounder, V3()));
      computeViews(); resize();
      state.mode = 'intro'; introT = 0;
      updateCamera(0, true);
      // first poses + shader warm-up so the first interactive frame does not stall
      for (const a of Object.values(people)) { a.update(0); }
      stepWorld(1 / 60);
      renderer.compile(scene, camera);
      report(1);
      renderer.render(scene, camera);
    }

    // ---------------- per-frame world step ----------------
    function emitBallEvents() {
      while (B.evi < B.events.length && B.events[B.evi].t <= B.flight) {
        const e = B.events[B.evi++];
        emit('contact', { type: e.type, pos: V3(e.p[0], e.p[1], e.p[2]), speed: e.speed });
      }
    }
    function stepWorld(dt) {
      time += dt;
      // ---- clocks / mode logic ----
      if (state.mode === 'intro') {
        introT += dt;
        if (introT > 0.9 && people.rebounder.ctl.state === 'hold' && !passReq && !state.introPassed) { passReq = true; state.introPassed = true; }
      }
      const S = people.shooter;
      if (dribbling) {
        const before = shooterDribble; shooterDribble += dt;
        const k0 = Math.floor((before - DR.t1) / DR.period), k1 = Math.floor((shooterDribble - DR.t1) / DR.period);
        if (k1 > k0) { const col = cw(S, DR.side, R, DR.fwd); emit('dribble', { pos: col }); }
        if (pendingShoot) {
          // start the shot exactly when the ball meets the hand (catch from the dribble)
          const catchU = DR.t1 + DR.t2, pb = ((before % DR.period) + DR.period) % DR.period, pa = ((shooterDribble % DR.period) + DR.period) % DR.period;
          if ((pb < catchU && pa >= catchU) || (pa < pb && catchU >= pb)) {
            const over = (pa - catchU + DR.period) % DR.period;
            pendingShoot = false; beginShot(); state.tau = Math.min(over, 0.03);
          }
        }
      }
      if (state.mode === 'shot') {
        state.tau += dt;
        if (!state.releaseSent && state.tau >= SHOT.release) {
          state.releaseSent = true; B.mode = 'shot'; B.holder = null; B.flight = state.tau - SHOT.release;
          emit('release', { pos: B.pos.clone() });
        }
        if (!state.landSent && state.tau >= SHOT.land) { state.landSent = true; emit('land', { pos: S.root.position.clone().setY(0.05) }); }
        if (B.mode === 'shot') {
          B.flight = state.tau - SHOT.release;
          if (B.flight >= shot.tq) {
            // freeze the decisive moment: shot clock stops, everything tied to it holds
            B.flight = shot.tq; state.tau = SHOT.release + shot.tq; state.mode = 'frozen';
            if (!state.questionSent) { state.questionSent = true; emit('question', {}); }
          }
        }
      } else if (state.mode === 'resolve') {
        state.tau += dt;
        B.flight = state.tau - SHOT.release;
        emitBallEvents();
        const P = shot.plan;
        const done = B.outcome === 'make' ? B.flight >= P.make.sim.scoredAt + 0.03 : B.flight >= P.miss.tc + 0.5;
        if (done) toOutcome(B.outcome);
      } else if (state.mode === 'pendingFade') {
        state.pendingT += dt;
        const k = clamp(state.pendingT / 1.3, 0, 1);
        halo.visible = true; halo.position.copy(B.pos);
        const hs = 0.45 + 0.5 * smooth(k); halo.scale.set(hs, hs, 1); halo.material.opacity = 0.75 * Math.sin(Math.PI * k);
        setBallOpacity(1 - smooth((k - 0.15) / 0.75));
        if (k >= 1) {
          halo.visible = false; setBallOpacity(0); B.mode = 'gone';
          state.pendingDone = true; state.outcome = 'pending'; state.mode = 'post'; outcomeAt = time;
          emit('outcome', { result: 'pending' });
          // nobody chases a ball that is under review: the rebounder fetches a fresh one
          const rb = people.rebounder; if (rb.ctl.state === 'home') startFetch(rb);
          people.closeout.ctl.state = 'watch';
        }
      }
      if (state.mode === 'post' || state.mode === 'pass') {
        if (B.mode === 'shot') {
          state.tau += dt;
          B.flight = state.tau - SHOT.release; emitBallEvents();
          const sim = B.outcome === 'miss' ? shot.plan.miss.sim : shot.plan.make.sim;
          if (B.flight > sim.tEnd + 0.3) {
            const st = M.sampleSim(sim, B.flight);
            if (st.p[1] > R + 0.02 || B.flight > sim.tEnd + 4) { setBallOpacity(Math.max(0, B.opacity - dt * 1.5)); if (B.opacity <= 0) B.mode = 'gone'; }
          }
        } else if (S.ctl.state === 'shot') state.tau += dt;
        if (S.ctl.state === 'shot' && state.tau > SHOT.recover + 0.3 && state.mode === 'post') S.ctl.state = 'react';
      }
      // ---- ball position from its controller ----
      if (B.mode === 'shot') {
        const st = M.shotBall(shot.plan, B.flight, B.outcome === 'miss' ? 'miss' : 'make');
        B.pos.set(st.p[0], st.p[1], st.p[2]); B.vel.set(st.v[0], st.v[1], st.v[2]);
        if (B.flight <= 0.0001) B.spin.copy(fromArr(shot.plan.make.w0));
        else if (st.w) B.spin.set(st.w[0], st.w[1], st.w[2]);
      } else if (B.mode === 'pass') {
        const P = B.pass, t = Math.min(time - P.t0, P.T);
        B.pos.copy(P.from).addScaledVector(P.v, t); B.pos.y -= 0.5 * G * t * t;
        if (time - P.t0 >= P.T) {
          B.mode = 'held'; B.holder = S; S.ctl.state = 'hold'; S.ctl.t = 0; S.ctl.catchAt = B.pos.clone(); B.spin.set(0, 0, 0);
          emit('catch', { pos: B.pos.clone() });
        }
      }
      // ---- athletes ----
      for (const a of Object.values(people)) { a.ctl.t += dt; a.ctl.stateAtStart = a.ctl.state; }
      if (B.mode === 'gone') FOCUS.copy(S.root.position).setY(1.35);
      else if (B.mode === 'held' && B.holder) cw(B.holder, 0.05, 1.2, 0.3, FOCUS);
      else FOCUS.copy(B.pos);
      shooterUpdate(S, dt); reactUpdate(S);
      closeoutUpdate(people.closeout, dt); reactUpdate(people.closeout);
      helpUpdate(people.def8, dt); reactUpdate(people.def8);
      helpUpdate(people.def14, dt); reactUpdate(people.def14);
      mateUpdate(people.mate7, dt); mateUpdate(people.mate4, dt);
      rebounderUpdate(people.rebounder, dt);
      maybeReady();
      for (const a of Object.values(people)) { finishRig(a, dt); a.update(dt); }
      // ---- ball transform ----
      if (ball) {
        ball.position.copy(B.pos);
        if (B.mode === 'shot' || B.mode === 'pass') {
          const w = B.spin.length(); if (w > 1e-4) { tmp[0].copy(B.spin).multiplyScalar(1 / w); B.quat.premultiply(new T.Quaternion().setFromAxisAngle(tmp[0], w * dt * (state.mode === 'frozen' ? 0 : 1))); }
        } else if (B.mode === 'held' && dribbling) {
          // dribble: the ball rolls slightly forward off the fingertips
          const r = basis(S, { f: V3(), r: V3() }).r; B.quat.premultiply(new T.Quaternion().setFromAxisAngle(r, -dt * 2.2));
        }
        ball.quaternion.copy(B.quat);
        ball.visible = B.mode !== 'gone' && B.opacity > 0.004;
      }
      if (ghost && ghost.visible && B.ghost) {
        B.ghost.t += dt; B.ghost.flight += dt;
        const st = M.sampleSim(B.ghost.sim, B.ghost.flight); ghost.position.set(st.p[0], st.p[1], st.p[2]);
        ghost.material.opacity = Math.max(0, 1 - B.ghost.t / 0.8); if (B.ghost.t > 0.8) { ghost.visible = false; B.ghost = null; cartBalls && (cartBalls.count = 5); }
      }
      if (net) net.update(dt, B.mode === 'shot' ? B.pos : null);
      if (crowd) crowd.update(dt);
      if (arena) arena.update(dt);
      if (arena && state.ribbonUntil && time > state.ribbonUntil) { arena.ribbon.set('idle'); state.ribbonUntil = 0; }
    }
    function toOutcome(result) {
      state.mode = 'post'; state.outcome = result; outcomeAt = time;
      emit('outcome', { result });
      crowd && crowd.react(result);
      if (result === 'make' && arena) { arena.ribbon.set('make'); state.ribbonUntil = time + 4.5; }
      startReactions(result);
      // rebounder: catch the live ball if reachable, otherwise a fresh ball from the cart
      const rb = people.rebounder;
      if (rb.ctl.state === 'home') {
        const pl = planCatch(rb);
        if (pl) { rb.ctl.state = 'chase'; rb.ctl.catchPlan = pl; rb.ctl.from = rb.root.position.clone(); rb.ctl.t0 = time + 0.2; emit('squeak', { pos: rb.root.position.clone(), intensity: 0.7 }); }
        else startFetch(rb);
      }
    }
    function startFetch(rb) {
      rb.ctl.state = 'fetch'; rb.ctl.from = rb.root.position.clone(); rb.ctl.t0 = time + 0.15;
      rb.ctl.dur = Math.max(1.1, rb.ctl.from.distanceTo(CART_STAND) / 2.6);
    }

    // ---------------- public API ----------------
    function update(dt) {
      if (state.mode === 'loading' || !arena) return;
      dt = clamp(dt || 0, 0, 0.05);
      stepWorld(dt);
      updateCamera(dt);
      renderer.render(scene, camera);
    }
    function shoot() {
      if (state.mode !== 'ready' || pendingShoot) return false;
      pendingShoot = true; state.mode = 'windup'; state.tau = 0;
      return true;
    }
    function resolve(result) {
      if (state.mode !== 'frozen') return false;
      if (result === 'pending') {
        state.mode = 'pendingFade'; state.pendingT = 0; B.outcome = 'pending';
        return true;
      }
      B.outcome = result === 'make' ? 'make' : 'miss';
      if (B.outcome === 'miss' && !shot.plan.miss) B.outcome = 'make'; // never happens in practice; keep the flow alive
      B.events = M.shotEvents(shot.plan, B.outcome); B.evi = 0; while (B.evi < B.events.length && B.events[B.evi].t < B.flight) B.evi++;
      state.mode = 'resolve';
      return true;
    }
    function nextRound() {
      const m = state.mode;
      if (m === 'ready' || m === 'intro' || m === 'loading') return false;
      if (m === 'pass') return true;
      if (m === 'windup') { pendingShoot = false; state.mode = 'ready'; return true; }
      // abandoned attempt (restart while a question is open): the ball leaves play quietly
      if (m === 'shot' || m === 'frozen' || m === 'resolve' || m === 'pendingFade') {
        halo && (halo.visible = false);
        if (B.mode === 'held' && B.holder === people.shooter || B.mode === 'shot') { setBallOpacity(0); B.mode = 'gone'; }
        const rb = people.rebounder; if (rb.ctl.state === 'home') startFetch(rb);
      }
      state.round++; state.mode = 'pass'; state.outcome = ''; state.pendingDone = false;
      const S = people.shooter;
      S.ctl.state = 'receive'; S.ctl.react = null; dribbling = false; pendingShoot = false;
      if (S.ctl.clip !== 'idle') playClip(S, 'idle', { fade: 0.6 });
      crowd && crowd.react('calm');
      toReadyFormation();
      const rb = people.rebounder;
      if (rb.ctl.state === 'hold' || rb.ctl.state === 'caught' || rb.ctl.state === 'fetch' || rb.ctl.state === 'pick' || rb.ctl.state === 'return' || rb.ctl.state === 'chase') passReq = true;
      else if (rb.ctl.state === 'home' || rb.ctl.state === 'gohome' || rb.ctl.state === 'wait') { passReq = true; startFetch(rb); }
      return true;
    }
    function resize() {
      const w = canvas.clientWidth || canvas.parentElement && canvas.parentElement.clientWidth || 960;
      const h = canvas.clientHeight || canvas.parentElement && canvas.parentElement.clientHeight || 540;
      renderer.setSize(w, h, false);
      const aspect = w / Math.max(1, h);
      camera.aspect = aspect;
      // keep the horizontal coverage of a 16:9 frame on narrow screens (portrait phones)
      const base = 46, hRef = 2 * Math.atan(Math.tan(base * Math.PI / 360) * 1.6);
      camera.fov = aspect >= 1.6 ? base : clamp(2 * Math.atan(Math.tan(hRef / 2) / aspect) * 180 / Math.PI, base, 74);
      camera.updateProjectionMatrix();
    }
    function setPixelRatio(r) { renderer.setPixelRatio(r); resize(); }
    function thinCrowd(f) { if (!crowd) return; crowd.meshes.forEach(m => { m.count = Math.max(1, Math.floor(m.userData.full * f)); }); }
    function scoreboard(s) { arena && arena.scoreboard(s); }
    function snapshot() {
      const info = renderer.info;
      return {
        mode: state.mode, tau: state.tau, round: state.round, passPhase: state.passPhase,
        ball: [B.pos.x, B.pos.y, B.pos.z], ballMode: B.mode, ballOpacity: B.mode === 'gone' ? 0 : B.opacity,
        camera: [camera.position.x, camera.position.y, camera.position.z, cam.target.x, cam.target.y, cam.target.z],
        geometries: info.memory.geometries, textures: info.memory.textures, calls: info.render.calls, triangles: info.render.triangles,
        crowd: crowd ? crowd.count : 0, tier: Q.tier, pixelRatio: renderer.getPixelRatio()
      };
    }
    const _pc = [V3(), V3(), V3(), V3()];
    function poseCheck() {
      const out = {};
      for (const [n, a] of Object.entries(people)) {
        const pel = a.worldOf('Pelvis', _pc[0]), head = a.worldOf('Head', _pc[1]), neck = a.worldOf('Neck', _pc[2]);
        const tilt = Math.acos(clamp(_pc[3].subVectors(neck, pel).normalize().dot(UP), -1, 1)) * 180 / Math.PI;
        const fl = a.worldOf('L_Foot', _pc[2]).y, fr = a.worldOf('R_Foot', _pc[3]).y;
        out[n] = { pelvis: +pel.y.toFixed(3), head: +head.y.toFixed(3), tilt: +tilt.toFixed(1), foot: +Math.min(fl, fr).toFixed(3) };
      }
      return out;
    }
    function dispose() {
      Object.values(people).forEach(a => a.dispose());
      if (athletesLib) athletesLib.textures.forEach(t => t.dispose());
      crowd && crowd.dispose(); if (crowdLib) { crowdLib.animTex.dispose(); Object.values(crowdLib.avatars).forEach(v => v.texture.dispose()); }
      arena && arena.dispose(); net && net.dispose();
      disposables.forEach(d => d && d.dispose && d.dispose());
      env && env.dispose();
      renderer.dispose();
    }

    return {
      load, update, shoot, resolve, nextRound, resize, setPixelRatio, thinCrowd, scoreboard, snapshot, poseCheck, dispose,
      camera, renderer, scene, state, people, quality: Q,
      get ball() { return B; }
    };
  }

  root.SportScene = { create, detectQuality };
})(typeof window !== 'undefined' ? window : globalThis);
