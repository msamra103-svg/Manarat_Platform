/* Bowling scene V20 (bowling-only). Renderer + quality tiers, lighting and environment, the venue,
 * the rigged bowler, ball and pins driven by the rigid-body physics, spectators, the camera director
 * and the aim indicator. Everything advances in update(dt).
 *
 *   BowlingScene.detectQuality(override) -> quality
 *   BowlingScene.create(canvas, { quality, reducedMotion, assetBase, onEvent, fadeEl, hand, schoolName, platformName })
 *     .load(progress) -> Promise   .update(dt)   .resize()   .setPixelRatio(r)   .dispose()
 *     .setAim({start, angle, power, spin})   .throw() -> bool   .resume() -> bool   .react(kind)
 *     .nextRack() (sweep + fresh rack + bowler back in stance)   .hardReset()   .aimAt(clientX, clientY)
 *     .setMonitor(data)   .state   .world   .camera   .renderer   .snapshot()   .poseCheck()
 * Events (onEvent(type, data)): loaded, ready, approach, step, slide, slideStop, release, question,
 *   contact, roll, settled, cleared, respot, return, sweep.
 * Modes: loading -> ready -> approach -> rolling -> frozen -> resolve -> settled -> resetting -> ready
 */
(function (root) {
  'use strict';
  const T = root.THREE, P = root.BowlingPhysics, M = root.BowlingMotion;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
  const HALFWAY = -P.LENGTH / 2;

  // ------------------------------------------------------------------ quality
  const TIERS = {
    low: { tier: 'low', maxDpr: 1.25, shadow: 1024, deckShadow: 0, crowd: 36, anisotropy: 2, antialias: false, lanes: 2, neighbor: false, pinSeg: 20, ballSeg: 48 },
    medium: { tier: 'medium', maxDpr: 1.5, shadow: 2048, deckShadow: 1024, crowd: 70, anisotropy: 4, antialias: true, lanes: 3, neighbor: true, pinSeg: 32, ballSeg: 72 },
    high: { tier: 'high', maxDpr: 2, shadow: 2048, deckShadow: 2048, crowd: 110, anisotropy: 8, antialias: true, lanes: 3, neighbor: true, pinSeg: 40, ballSeg: 96 }
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
    q.pixelRatio = Math.min(root.devicePixelRatio || 1, q.maxDpr); q.gpu = gpu; q.reason = reason;
    return q;
  }

  // ------------------------------------------------------------------ pins and ball
  const STRIPES = [[0.252, 0.266], [0.279, 0.293]];
  function pinGeometry(seg) {
    // lathe of the USBC-style profile, with extra points at the stripe edges so the red neck stripes are crisp
    const pts = P.PIN_PROFILE.map(p => p.slice());
    for (const [a, b] of STRIPES) for (const y of [a, b]) {
      const i = pts.findIndex(p => p[0] > y), p0 = pts[i - 1], p1 = pts[i], t = (y - p0[0]) / (p1[0] - p0[0]);
      pts.splice(i, 0, [y, p0[1] + (p1[1] - p0[1]) * t], [y + 1e-4, p0[1] + (p1[1] - p0[1]) * t]);
    }
    pts.sort((a, b) => a[0] - b[0]);
    pts.unshift([0, 0]); // closed base
    const g = new T.LatheGeometry(pts.map(([y, r]) => new T.Vector2(r, y)), seg);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), red = STRIPES.some(([a, b]) => y > a + 5e-5 && y < b + 5e-5);
      const base = y < 0.004 ? [0.5, 0.5, 0.5] : [0.96, 0.955, 0.94];
      col.set(red ? [0.72, 0.04, 0.09] : base, i * 3);
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  // finger holes cluster around the ball's local +Z (the side that faces the throwing palm, see bowler.js);
  // local +X points along the fingers: the thumb hole sits toward the wrist (-X), the finger holes toward +X.
  const HOLES = [
    { d: [-Math.sin(0.30), 0, Math.cos(0.30)], r: 0.0128, depth: 0.07 },
    { d: [Math.sin(0.25), -0.105, Math.cos(0.25)], r: 0.0106, depth: 0.055 },
    { d: [Math.sin(0.25), 0.105, Math.cos(0.25)], r: 0.0106, depth: 0.055 }
  ];
  function ballGeometry(seg) {
    const R = P.R, holes = HOLES.map(h => Object.assign({}, h, { v: V(...h.d).normalize() }));
    const sph = new T.SphereGeometry(R, seg, Math.round(seg * 0.66)).toNonIndexed();
    const p = sph.attributes.position, n = sph.attributes.normal, uv = sph.attributes.uv;
    const keepP = [], keepN = [], keepU = [], c = V();
    for (let i = 0; i < p.count; i += 3) {
      c.set((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3).normalize();
      if (holes.some(h => c.angleTo(h.v) < Math.asin(h.r / R))) continue;
      for (let k = 0; k < 3; k++) { keepP.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k)); keepN.push(n.getX(i + k), n.getY(i + k), n.getZ(i + k)); keepU.push(uv.getX(i + k), uv.getY(i + k)); }
    }
    const shell = new T.BufferGeometry();
    shell.setAttribute('position', new T.Float32BufferAttribute(keepP, 3)); shell.setAttribute('normal', new T.Float32BufferAttribute(keepN, 3)); shell.setAttribute('uv', new T.Float32BufferAttribute(keepU, 2));
    sph.dispose();
    const inner = holes.map(h => {
      const cyl = new T.CylinderGeometry(h.r, h.r * 0.96, h.depth, 18, 1, true);
      cyl.translate(0, R - h.depth / 2 + 0.001, 0);
      cyl.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(V(0, 1, 0), h.v)));
      return cyl;
    });
    return { shell, holes: inner };
  }
  function ballTexture(size) {
    // reactive-resin swirl in school maroon with gold veins (procedural)
    const W = size, H = size / 2, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), img = x.createImageData(W, H);
    let seed = 77; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const waves = Array.from({ length: 7 }, () => [rnd() * 6 + 1, rnd() * 6 + 1, rnd() * 6.28, rnd() * 0.6 + 0.2]);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const u = i / W * Math.PI * 2, v = j / H * Math.PI;
      const px = Math.sin(v) * Math.cos(u), py = Math.cos(v), pz = Math.sin(v) * Math.sin(u);
      let f = 0; for (const [a, b, ph, amp] of waves) f += Math.sin(a * px + b * py + ph + 2.2 * Math.sin(b * pz + a * py)) * amp;
      const vein = Math.pow(1 - Math.min(1, Math.abs(Math.sin(f * 2.3)) * 1.25), 6);
      const t = 0.5 + 0.5 * Math.sin(f * 1.3);
      const o = (j * W + i) * 4;
      img.data[o] = clamp(70 + t * 90 + vein * 150, 0, 255);
      img.data[o + 1] = clamp(8 + t * 14 + vein * 115, 0, 255);
      img.data[o + 2] = clamp(28 + t * 30 + vein * 40, 0, 255);
      img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function radialTexture(stops) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }
  function loadTexture(url, manager) {
    return new Promise((res, rej) => { new T.TextureLoader(manager).load(url, t => { t.flipY = false; t.encoding = T.sRGBEncoding; res(t); }, undefined, () => rej(new Error('missing or unreadable file: ' + url))); });
  }

  // ------------------------------------------------------------------ scene
  function create(canvas, opts = {}) {
    const Q = opts.quality || detectQuality();
    let reduced = !!opts.reducedMotion;
    const emit = (t, d) => { try { opts.onEvent && opts.onEvent(t, d || {}); } catch (e) { console.error(e); } };
    const renderer = new T.WebGLRenderer({ canvas, antialias: Q.antialias, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
    renderer.setPixelRatio(Q.pixelRatio);
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = Q.tier === 'low' ? T.PCFShadowMap : T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.background = new T.Color('#141217');
    scene.fog = new T.Fog('#141217', 28, 52);
    const camera = new T.PerspectiveCamera(46, 1, 0.05, 70);

    // lighting: a comfortable sports venue (warm white ceiling light), not a nightclub
    const hemi = new T.HemisphereLight('#fff4e6', '#3a2a22', 0.55); scene.add(hemi);
    const key = new T.DirectionalLight('#fff1dc', 0.95);
    key.position.set(1.8, 8.5, 7.5); key.castShadow = true;
    key.shadow.mapSize.set(Q.shadow, Q.shadow); Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 4.4, bottom: -4.4, near: 2, far: 24 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    scene.add(key, key.target);
    const laneFill = new T.DirectionalLight('#ffe9cf', 0.32); laneFill.position.set(-3, 6, -6); laneFill.target.position.set(0, 0, -12); scene.add(laneFill, laneFill.target);
    const deck = new T.SpotLight('#fff7ea', 1.35, 6.5, 0.85, 0.55, 1.2);
    deck.position.set(0, 1.55, -P.LENGTH + 0.55); deck.target.position.set(0, 0, -P.LENGTH - 0.55);
    if (Q.deckShadow) { deck.castShadow = true; deck.shadow.mapSize.set(Q.deckShadow, Q.deckShadow); deck.shadow.camera.near = 0.3; deck.shadow.camera.far = 4; deck.shadow.bias = -0.0005; deck.shadow.normalBias = 0.01; }
    scene.add(deck, deck.target);
    const approachLight = new T.PointLight('#ffe8cc', 0.42, 9, 1.6); approachLight.position.set(0, 3.6, 2.4); scene.add(approachLight);

    const world = P.create();
    const S = {
      mode: 'loading', input: { start: 0, angle: 0, power: 0.65, spin: 0 }, hand: opts.hand === 'left' ? 'left' : 'right',
      launched: false, acc: 0, settledT: -1, outcomeT: 0, reaction: '', pitT: -1, returned: false, frozenAt: null, footState: {}
    };
    let venue = null, bowler = null, crowd = null, crowdLib = null, athLib = null, ballMesh = null, ballGroup = null, returnBall = null;
    let pinMeshes = [], pinShadows = [], env = null, guide = null, target = null, ballShadow = null, loaded = false, disposed = false;
    const neighbors = [];
    const disposables = [];

    // ---------------------------------------------------------------- loading
    async function load(progress = () => { }) {
      const manager = new T.LoadingManager();
      let total = 1;
      manager.onProgress = (url, a, b) => { total = Math.max(total, b); progress(Math.min(0.96, a / total)); };
      const base = opts.assetBase || 'assets/';
      const pm = new T.PMREMGenerator(renderer);
      env = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; pm.dispose();
      const variants = Q.neighbor ? ['a', 'b', 'c'] : ['b'];
      const [lib, clib, kit, kitAlt] = await Promise.all([
        root.BowlingAthlete.load(base, manager, { anisotropy: Q.anisotropy, kits: [] }, variants),
        Q.crowd > 0 ? root.BowlingCrowd.load(base, manager) : Promise.resolve(null),
        loadTexture(base + 'textures/bowler_kit.jpg', manager),
        Q.neighbor ? loadTexture(base + 'textures/bowler_kit_alt.jpg', manager) : Promise.resolve(null),
        opts.fontReady || Promise.resolve()
      ]);
      if (disposed) return;
      athLib = lib; crowdLib = clib; disposables.push(kit); if (kitAlt) disposables.push(kitAlt);
      build(lib, kit, kitAlt);
      // first poses + shader warm-up so the first interactive frame does not stall
      bowler.update(1 / 60); applyPins(); applyBall(); frame(0, true);
      renderer.compile(scene, camera);
      progress(1); loaded = true;
      S.mode = 'ready';
      emit('loaded', { tier: Q.tier, crowd: crowd ? crowd.count : 0 });
      emit('ready', {});
    }

    function build(lib, kit, kitAlt) {
      const pinGeo = pinGeometry(Q.pinSeg); disposables.push(pinGeo);
      const pinMat = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.22, envMap: env, envMapIntensity: 0.8 });
      disposables.push(pinMat);
      venue = root.BowlingVenue.build(scene, { env, quality: Q, lanes: Q.lanes, font: opts.font, schoolName: opts.schoolName || 'مدرسة أبو عبيدة الإعدادية للبنين', platformName: opts.platformName || 'منصة التعلّم التفاعلي والألعاب التعليمية', pinGeometry: Q.neighbor ? pinGeo : null, pinMaterial: pinMat });
      const shadowTex = radialTexture([[0, 'rgba(0,0,0,0.55)'], [0.5, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]); disposables.push(shadowTex);
      const shadowGeo = new T.PlaneGeometry(1, 1); disposables.push(shadowGeo);
      for (let i = 0; i < 10; i++) {
        const m = new T.Mesh(pinGeo, pinMat); m.castShadow = true; m.receiveShadow = true; m.name = 'pin' + (i + 1);
        scene.add(m); pinMeshes.push(m);
        const sh = new T.Mesh(shadowGeo, new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1; scene.add(sh); pinShadows.push(sh); disposables.push(sh.material);
      }
      // ball
      const bg = ballGeometry(Q.ballSeg); disposables.push(bg.shell, ...bg.holes);
      const btex = ballTexture(Q.tier === 'low' ? 512 : 1024); disposables.push(btex);
      const bmat = Q.tier === 'low'
        ? new T.MeshStandardMaterial({ map: btex, roughness: 0.2, metalness: 0.05, envMap: env, envMapIntensity: 1.0 })
        : new T.MeshPhysicalMaterial({ map: btex, roughness: 0.16, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08, envMap: env, envMapIntensity: 1.0 });
      const hmat = new T.MeshStandardMaterial({ color: '#0d0a0c', roughness: 0.9, side: T.BackSide });
      disposables.push(bmat, hmat);
      ballGroup = new T.Group(); ballGroup.name = 'ball';
      ballMesh = new T.Mesh(bg.shell, bmat); ballMesh.castShadow = true; ballMesh.receiveShadow = true; ballGroup.add(ballMesh);
      for (const h of bg.holes) ballGroup.add(new T.Mesh(h, hmat));
      scene.add(ballGroup);
      ballShadow = new T.Mesh(shadowGeo, new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); ballShadow.rotation.x = -Math.PI / 2; ballShadow.renderOrder = 1; scene.add(ballShadow); disposables.push(ballShadow.material);
      // the returned ball shown on the ball-return rails (visual only)
      returnBall = ballGroup.clone(); returnBall.visible = false; scene.add(returnBall);
      // bowler
      bowler = root.BowlingBowler.create(lib, { variant: 'b', kitTexture: kit, hand: S.hand, shadows: true });
      bowler.setPlan(S.input);
      scene.add(bowler.athlete.root);
      // other bowlers on neighbouring approaches (idle, never intersecting our lane)
      if (Q.neighbor && kitAlt) {
        for (const [variant, lane, z, yaw, clip] of [['a', -2, 3.9, Math.PI + 0.35, 'idle_alt'], ['c', 2, 4.6, Math.PI - 0.5, 'look']]) {
          const a = lib.create({ variant, kitTexture: kitAlt, name: 'neighbour-' + variant });
          a.setTransform(lane * venue.PITCH, z, yaw); a.play(clip, { fade: 0, offset: Math.random(), speed: 0.9 + Math.random() * 0.15 });
          scene.add(a.root); neighbors.push(a);
        }
      }
      if (crowdLib && Q.crowd > 0) { crowd = root.BowlingCrowd.create(crowdLib, venue.seats, { count: Q.crowd, seed: 13, kidShare: 0.45 }); scene.add(crowd.group); }
      // aim guide: launch line to the arrows only — it never shows (or promises) the hook
      const gGeo = new T.BufferGeometry().setFromPoints([V(0, 0.004, 0), V(0, 0.004, -4.9)]);
      guide = new T.Line(gGeo, new T.LineDashedMaterial({ color: '#f0d9a2', dashSize: 0.1, gapSize: 0.08, transparent: true, opacity: 0.7 }));
      guide.computeLineDistances(); scene.add(guide); disposables.push(gGeo, guide.material);
      target = new T.Mesh(new T.RingGeometry(0.035, 0.05, 28), new T.MeshBasicMaterial({ color: '#f0d9a2', transparent: true, opacity: 0.85, depthWrite: false }));
      target.rotation.x = -Math.PI / 2; scene.add(target); disposables.push(target.geometry, target.material);
      resize();
    }

    // ---------------------------------------------------------------- pins/ball from physics
    const _q = new T.Quaternion(), _up = V();
    function applyPins() {
      const pins = world.pins;
      for (let i = 0; i < 10; i++) {
        const s = pins[i], m = pinMeshes[i]; if (!m || !s) continue;
        _q.set(s.q[0], s.q[1], s.q[2], s.q[3]);
        _up.set(0, 1, 0).applyQuaternion(_q);
        m.quaternion.copy(_q);
        m.position.set(s.pos[0] - _up.x * P.PIN_COM, s.pos[1] - _up.y * P.PIN_COM, s.pos[2] - _up.z * P.PIN_COM);
        shadowFor(i, m);
      }
    }
    function shadowFor(i, m) {
      const sh = pinShadows[i]; _up.set(0, 1, 0).applyQuaternion(m.quaternion);
      const upright = clamp(_up.y, 0, 1), h = Math.max(0, m.position.y);
      sh.visible = m.visible && m.position.y > -0.02 && Math.abs(m.position.x) < P.WIDTH / 2 + 0.05 && m.position.z > P.DECK_END;
      sh.position.set(m.position.x + _up.x * 0.12, 0.0015, m.position.z + _up.z * 0.12);
      sh.scale.set(upright > 0.9 ? 0.2 : 0.34, upright > 0.9 ? 0.2 : 0.42, 1); sh.rotation.z = upright > 0.9 ? 0 : Math.atan2(_up.x, _up.z);
      sh.material.opacity = clamp(1 - h * 6, 0, 0.9);
    }
    function applyBall() {
      const b = world.ball;
      if (!S.launched || !b) { ballGroup.position.copy(bowler.ball.pos); ballGroup.quaternion.copy(bowler.ball.quat); }
      else { ballGroup.position.set(b.pos[0], b.pos[1], b.pos[2]); ballGroup.quaternion.set(b.q[0], b.q[1], b.q[2], b.q[3]); }
      const p = ballGroup.position, ax = Math.abs(p.x);
      const floorY = ax > P.WIDTH / 2 && ax < P.WIDTH / 2 + P.GUTTER_W && p.z < 0 ? -P.GUTTER_D + 0.01 : 0;
      ballShadow.position.set(p.x, floorY + 0.002, p.z);
      const hgt = Math.max(0, p.y - P.R - floorY);
      ballShadow.scale.setScalar(0.26 + hgt * 0.5); ballShadow.material.opacity = clamp(0.85 - hgt * 1.4, 0, 0.85);
      ballShadow.visible = ballGroup.visible && p.z > P.DECK_END;
      ballGroup.visible = !(b && b.pit && S.pitT >= 0 && S.clock - S.pitT > 1.2);
    }

    // ---------------------------------------------------------------- aim indicator
    function updateGuide() {
      const show = S.mode === 'ready';
      guide.visible = target.visible = show;
      if (!show) return;
      const a = S.input.angle * Math.PI / 180, x0 = S.input.start, L = 4.9;
      const pos = guide.geometry.attributes.position;
      pos.setXYZ(0, x0, 0.004, -0.25); pos.setXYZ(1, x0 + Math.tan(a) * L, 0.004, -L); pos.needsUpdate = true;
      guide.computeLineDistances(); guide.geometry.computeBoundingSphere();
      target.position.set(x0 + Math.tan(a) * L, 0.004, -L);
    }

    // ---------------------------------------------------------------- camera director
    const cam = { pos: V(0.4, 1.7, 7), look: V(0, 0.4, -9), wantPos: V(), wantLook: V(), fov: 46 };
    let fade = null; // long camera jumps: fade to black, jump, fade back (never a fast fly-through)
    function shotPositions(pos, look) {
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight) || camera.aspect, portrait = aspect < 0.8;
      const b = world.ball, st = S.input.start;
      const stance = bowler ? M.sample(bowler.plan, -0.5).pelvis : [st - 0.3, 0.86, 3.25];
      const side = S.hand === 'left' ? -1 : 1;
      const behind = () => { pos.set(st * 0.6 + side * (portrait ? 0.55 : 0.85), portrait ? 2.25 : 1.95, stance[2] + (portrait ? 3.6 : 3.0)); look.set(st * 0.35 + side * 0.1, 0.25, stance[2] - 11); };
      const follow = () => { // follows the bowler down the approach, from behind the throwing side
        const pel = bowler.athlete.bones.Pelvis.getWorldPosition(V());
        pos.set(st * 0.6 + side * (portrait ? 0.5 : 0.75), portrait ? 2.1 : 1.8, pel.z + (portrait ? 3.3 : 2.8)); look.set(st * 0.35 + side * 0.1, 0.25, pel.z - 10);
      };
      const deckView = () => { pos.set(0.05, portrait ? 1.25 : 1.0, -P.LENGTH + (portrait ? 5.4 : 4.9)); look.set(0, 0.02, -P.LENGTH - 0.45); };
      const reactView = () => { const bx = bowler.athlete.root.position.x, bz = bowler.athlete.root.position.z; pos.set(bx + 1.55, 1.3, bz - 3.1); look.set(bx + 0.1, 0.95, bz + 1.2); };
      let rate = 3.2, jump = false;
      if (reduced) {
        if (['ready', 'approach'].includes(S.mode) || (S.mode === 'rolling' && (!b || b.pos[2] > -1.5))) { pos.set(st * 0.4 + 0.42, portrait ? 2.1 : 1.8, 3.4 + (portrait ? 3.4 : 2.7)); look.set(st * 0.3, 0.3, -6); }
        else if (S.mode === 'settled' && S.reaction && S.outcomeT > 1.8 && S.outcomeT < 4.6) reactView();
        else { pos.set(0.1, portrait ? 2.2 : 1.9, -7.5); look.set(0, 0.15, -P.LENGTH - 0.3); }
        rate = 6; jump = true;
      } else {
        switch (S.mode) {
          case 'ready': behind(); rate = 2.4; break;
          case 'approach': follow(); rate = 4.0; break;
          case 'rolling': case 'frozen': case 'resolve': {
            if (!b || !S.launched) { follow(); break; }
            const z = b.pos[2];
            if (z > -12.4) { pos.set(lerp(st, b.pos[0], 0.6) * 0.8 + 0.12, lerp(1.45, 0.95, smooth(-z / 4)), z + lerp(2.9, 3.3, smooth(-z / 6))); look.set(b.pos[0] * 0.7, 0.18, z - 6.5); rate = z > -1 ? 3.0 : 6.0; }
            else { deckView(); rate = 2.2; }
            break;
          }
          case 'settled': {
            const t = S.outcomeT;
            if (t < 1.8 || !S.reaction) deckView();
            else if (t < 4.8) { reactView(); jump = true; }
            else { deckView(); jump = true; }
            break;
          }
          case 'resetting': deckView(); rate = 2.4; break;
          default: behind();
        }
      }
      return { rate, jump };
    }
    function frame(dt, snap = false) {
      const { rate, jump } = shotPositions(cam.wantPos, cam.wantLook);
      const far = cam.pos.distanceTo(cam.wantPos) > 6 || cam.look.distanceTo(cam.wantLook) > 10;
      if (snap) { cam.pos.copy(cam.wantPos); cam.look.copy(cam.wantLook); }
      else if (jump && far) {
        if (!opts.fadeEl) { cam.pos.copy(cam.wantPos); cam.look.copy(cam.wantLook); }
        else if (!fade) fade = { t: 0, jumped: false };
      }
      if (fade) {
        fade.t += dt;
        const d = reduced ? 0.12 : 0.22;
        if (!fade.jumped && fade.t >= d) { fade.jumped = true; cam.pos.copy(cam.wantPos); cam.look.copy(cam.wantLook); }
        const o = fade.t < d ? fade.t / d : Math.max(0, 1 - (fade.t - d) / d);
        opts.fadeEl.style.opacity = String(o);
        if (fade.t >= 2 * d) { fade = null; opts.fadeEl.style.opacity = '0'; }
      } else if (!snap && !(jump && far)) {
        const k = 1 - Math.exp(-dt * rate);
        cam.pos.lerp(cam.wantPos, k); cam.look.lerp(cam.wantLook, k);
      }
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight) || camera.aspect, fov = aspect < 0.8 ? 58 : aspect < 1.25 ? 52 : 44;
      cam.fov += (fov - cam.fov) * (snap ? 1 : 1 - Math.exp(-dt * 3));
      if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
      camera.position.copy(cam.pos); camera.lookAt(cam.look);
      // the shadow-casting key light follows what the camera looks at (one shadow map, always sharp where needed)
      const focus = S.mode === 'ready' || S.mode === 'approach' || (S.launched && world.ball && world.ball.pos[2] > -3) ? bowler.athlete.root.position : cam.look;
      key.target.position.set(focus.x * 0.6, 0, clamp(focus.z, -P.LENGTH - 0.5, 4));
      key.position.set(key.target.position.x + 1.8, 8.5, key.target.position.z + 10);
    }

    // ---------------------------------------------------------------- physics stepping (fixed sub-steps)
    function stepPhysics(dt, stopAtHalf) {
      S.acc += clamp(dt, 0, 0.1);
      let steps = 0;
      while (S.acc >= P.STEP - 1e-12 && steps < 200) {
        world.step(); S.acc -= P.STEP; steps++;
        if (stopAtHalf && world.ball && world.ball.pos[2] <= HALFWAY) { S.acc = 0; return 'half'; }
      }
      return steps;
    }
    function launchAt(tRel) {
      const rel = bowler.evaluate(tRel - 1e-6);                    // exact rig pose at the release instant
      const st = P.releaseState(Object.assign({}, S.input, { pos: rel.pos.toArray() }));
      world.launch({ pos: st.pos, vel: st.vel, omega: st.omega, q: [rel.quat.x, rel.quat.y, rel.quat.z, rel.quat.w] });
      S.launched = true; S.acc = 0;
      S.release = { pos: rel.pos.toArray(), handVel: bowler.ball.vel.toArray(), vel: st.vel, quat: rel.quat.toArray() };
      emit('release', { pos: rel.pos.toArray(), speed: st.speed });
    }

    // ---------------------------------------------------------------- update loop
    S.clock = 0;
    function update(dt) {
      if (!loaded || disposed) return;
      dt = clamp(dt || 0, 0, 0.1);
      S.clock += dt;
      const frozen = S.mode === 'frozen';
      // bowler (keeps breathing in the finish while everything physical is frozen)
      if (bowler) {
        bowler.update(dt);
        footEvents();
        if (S.mode === 'approach' && !S.launched && bowler.t >= bowler.plan.t.release) {
          launchAt(bowler.plan.t.release);
          S.mode = 'rolling';
          const r = stepPhysics(bowler.t - bowler.plan.t.release, true);
          bowler.evaluate(bowler.t);                                  // back to the pose at the current time
          if (r === 'half') { S.mode = 'frozen'; emit('question', { pos: world.ball.pos.slice() }); }
        } else if (S.mode === 'rolling') {
          if (stepPhysics(dt, true) === 'half') { S.mode = 'frozen'; S.frozenAt = world.snapshot(); emit('question', { pos: world.ball.pos.slice() }); }
        } else if (S.mode === 'resolve') {
          stepPhysics(dt, false);
          if (world.settled && S.settledT < 0) S.settledT = 0;
          if (S.settledT >= 0) { S.settledT += dt; if (S.settledT > 0.5) { S.mode = 'settled'; S.outcomeT = 0; emit('settled', { knocked: world.knocked, standing: world.standingIds, gutter: !!(world.ball && world.ball.gutter) }); } }
        } else if (S.mode === 'settled') { S.outcomeT += dt; stepPhysics(dt, false); }
      }
      // physics events -> audio (one event per new contact, never per sub-step)
      for (const e of world.drainEvents()) emit('contact', e);
      if (world.ball && S.launched && !frozen) {
        const b = world.ball;
        if (b.pit && S.pitT < 0) { S.pitT = S.clock; emit('pit', { pos: b.pos.slice() }); }
        emit('roll', { speed: Math.hypot(b.v[0], b.v[2]), spin: Math.hypot(b.w[0], b.w[1], b.w[2]), onLane: b.onLane, gutter: b.gutter, pit: b.pit, airborne: b.phase === 'flight', phase: b.phase, pos: b.pos.slice() });
        if (S.pitT >= 0 && !S.returned && S.clock - S.pitT > 3.2) { S.returned = true; showReturn(true); emit('return', { pos: [venue.PITCH / 2, 0.6, 3.6] }); }
      } else emit('roll', { speed: 0, frozen });
      // pin reset (sweep + new rack)
      if (S.mode === 'resetting') resetStep(dt); else applyPins();
      applyBall();
      crowd && crowd.update(dt);
      for (const n of neighbors) n.update(dt);
      updateGuide();
      frame(dt);
      renderer.render(scene, camera);
    }

    function footEvents() {
      const r = bowler.request; if (!r || !r.feet) return;
      for (const s of ['L', 'R']) {
        const f = r.feet[s], prev = S.footState[s];
        if (prev && prev !== f.contact) {
          if (f.contact === 'planted' && prev === 'swing') emit('step', { foot: s, pos: f.toe, power: S.input.power });
          if (f.contact === 'slide') emit('slide', { foot: s, pos: f.toe });
          if (prev === 'slide') emit('slideStop', { foot: s, pos: f.toe });
          if (f.contact === 'toe' && prev === 'swing') emit('step', { foot: s, pos: f.toe, soft: true });
        }
        S.footState[s] = f.contact;
      }
    }

    function showReturn(on) {
      if (!returnBall) return;
      returnBall.visible = on;
      if (on) { returnBall.position.set(venue.PITCH / 2, 0.62 + P.R, 3.75); returnBall.rotation.set(0.4, 1.2, 0); }
    }

    // ---------------------------------------------------------------- next rack
    function resetStep(dt) {
      const r = venue.update(dt);
      if (!r) return;
      for (let i = 0; i < 10; i++) {
        const m = pinMeshes[i];
        if (!r.pinsVisible) {
          // the sweep bar carries every pin left on the deck into the pit (visual, after the count)
          if (r.sweepY < 0.3 && m.visible && m.position.z > r.sweepZ - 0.07 && m.position.y > -0.05) {
            m.position.z = r.sweepZ - 0.07;
            if (m.position.z < P.DECK_END + 0.02) m.visible = false;
          }
          shadowFor(i, m);
        } else {
          const spot = P.rack()[i];
          m.visible = true; m.quaternion.identity(); m.position.set(spot.x, Math.max(0, r.pinsDrop + (r.tableY - 0.43)), spot.z);
          shadowFor(i, m);
        }
      }
      if (r.done) { world.reset(); applyPins(); pinMeshes.forEach(m => { m.visible = true; }); S.mode = 'ready'; emit('ready', {}); }
    }
    function nextRack() {
      if (!['settled', 'ready'].includes(S.mode)) return false;
      S.mode = 'resetting'; S.launched = false; S.settledT = -1; S.pitT = -1; S.reaction = '';
      showReturn(false); S.returned = false;
      bowler.setPlan(S.input); bowler.startStance();                // back in stance with the returned ball
      venue.reset(() => emit('cleared', {}), () => emit('respot', {}), reduced);
      emit('sweep', { pos: [0, 0.5, -P.LENGTH - 0.3] });
      return true;
    }
    /** Hard restart (restart / early end / new attempt): no animation, clean state. */
    function hardReset() {
      world.reset(); S.launched = false; S.acc = 0; S.settledT = -1; S.pitT = -1; S.reaction = ''; S.returned = false; showReturn(false);
      if (venue && venue.resetting) venue.update(10);
      pinMeshes.forEach(m => { m.visible = true; }); applyPins();
      if (bowler) { bowler.setPlan(S.input); bowler.startStance(); }
      crowd && crowd.react('calm');
      S.mode = loaded ? 'ready' : 'loading';
      frame(0, true);
      emit('ready', {});
    }

    // ---------------------------------------------------------------- game API
    function setAim(input) {
      if (S.mode !== 'ready' || !bowler) return false;
      S.input = { start: clamp(+input.start || 0, -0.36, 0.36), angle: clamp(+input.angle || 0, -3, 3), power: clamp(+input.power, 0, 1), spin: clamp(+input.spin || 0, -1, 1) };
      bowler.setPlan(S.input);
      return true;
    }
    function throwBall() {
      if (S.mode !== 'ready' || !bowler) return false;
      bowler.setPlan(S.input);
      if (!bowler.startApproach()) return false;
      S.mode = 'approach'; S.launched = false; S.settledT = -1; S.reaction = ''; S.pitT = -1; S.footState = {};
      world.reset();
      crowd && crowd.react('anticipate');
      emit('approach', {});
      return true;
    }
    function resume() { if (S.mode !== 'frozen') return false; S.mode = 'resolve'; return true; }
    function react(kind) {
      S.reaction = kind;
      if (bowler) bowler.startRecover({ strike: 'cheer_pump', good: 'cheer_small', fair: 'clap', miss: 'shrug', wrong: 'shrug', pending: 'look' }[kind] || 'idle');
      if (crowd) crowd.react(kind === 'strike' ? 'strike' : kind === 'good' || kind === 'fair' ? 'good' : kind === 'miss' || kind === 'wrong' ? 'miss' : 'calm', reduced);
    }

    // pointer aiming: a point on the lane sets the launch angle; a point on the approach the start board
    const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(V(0, 1, 0), 0), hit = V();
    function aimAt(clientX, clientY) {
      if (S.mode !== 'ready') return null;
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      if (hit.z < -0.6) return { angle: clamp(Math.atan2(hit.x - S.input.start, -hit.z) * 180 / Math.PI, -3, 3) };
      if (hit.z > 0 && hit.z < 5 && Math.abs(hit.x) < 0.6) return { start: clamp(hit.x, -0.36, 0.36) };
      return null;
    }

    let shiftPx = 0;
    function resize() {
      const w = canvas.clientWidth || canvas.parentElement.clientWidth || innerWidth, h = canvas.clientHeight || canvas.parentElement.clientHeight || innerHeight;
      renderer.setSize(w, h, false);
      // a side panel can cover part of the view: render a wider frame and show its far part, so the
      // action is centred in the visible area instead of under the panel
      const sp = Math.min(shiftPx, w * 0.5);
      camera.aspect = (w + sp) / Math.max(1, h);
      if (sp > 0) camera.setViewOffset(w + sp, h, sp, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    function setShift(px) { px = Math.round(Math.max(0, px || 0)); if (px !== shiftPx) { shiftPx = px; resize(); } }
    function setPixelRatio(r) { renderer.setPixelRatio(r); resize(); }
    function thinCrowd(f) { if (!crowd) return; crowd.meshes.forEach(m => { if (m.userData.full == null) m.userData.full = m.count; m.count = Math.max(1, Math.floor(m.userData.full * f)); }); }

    function snapshot() {
      return {
        mode: S.mode, t: bowler ? bowler.t : 0, bowlerMode: bowler ? bowler.mode : '', attached: !S.launched,
        ball: ballGroup ? ballGroup.position.toArray() : null, ballQuat: ballGroup ? ballGroup.quaternion.toArray() : null,
        physics: world.snapshot(), release: S.release || null, camera: camera.position.toArray(), input: Object.assign({}, S.input), hand: S.hand,
        info: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }
      };
    }
    function poseCheck() { return bowler ? Object.assign(bowler.poseReport(), { clearance: bowler.clearance() }) : null; }

    function dispose() {
      disposed = true;
      try { venue && venue.dispose(); } catch (e) { }
      try { crowd && crowd.dispose(); if (crowdLib) { crowdLib.animTex.dispose(); Object.values(crowdLib.avatars).forEach(v => { v.texture.dispose(); v.geometry.dispose(); }); } } catch (e) { }
      try { bowler && bowler.dispose(); neighbors.forEach(n => n.dispose()); athLib && athLib.dispose(); } catch (e) { }
      disposables.forEach(d => { try { d.dispose(); } catch (e) { } });
      scene.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) o.geometry.dispose(); });
      env && env.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { }
    }

    return {
      load, update, resize, setShift, setPixelRatio, thinCrowd, dispose, setAim, throw: throwBall, resume, react, nextRack, hardReset, aimAt, snapshot, poseCheck,
      setMonitor: d => venue && venue.setMonitor(d),
      setReducedMotion(v) { reduced = !!v; },
      setHand(h) { if (S.mode !== 'ready' || !bowler) return false; S.hand = h === 'left' ? 'left' : 'right'; bowler.setHand(S.hand); bowler.setPlan(S.input); return true; },
      setShadows(on) { renderer.shadowMap.enabled = !!on; scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.needsUpdate = true; }); } }); },
      get state() { return { mode: S.mode, outcomeT: S.outcomeT, launched: S.launched }; }, world, camera, renderer, scene, quality: Q,
      get bowler() { return bowler; }
    };
  }

  root.BowlingScene = { create, detectQuality, TIERS, pinGeometry, ballGeometry, HOLES };
})(typeof window !== 'undefined' ? window : globalThis);
