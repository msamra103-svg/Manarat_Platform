/* Target Shooting 3D — renderer, lighting, sky and shared landscape builders.
 * All scenery is original and procedural (canvas textures, instanced vegetation), so the game needs no
 * remote asset and the offline package stays self-contained. Quality tiers only change resolution, shadow
 * map size and vegetation density — never the simulation or the animation.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS, U = TS.util;

  const TIERS = {
    high: { maxDpr: 1.75, shadow: 2048, grass: 2600, trees: 1, anisotropy: 8 },
    medium: { maxDpr: 1.35, shadow: 1536, grass: 1500, trees: 0.8, anisotropy: 4 },
    low: { maxDpr: 1.0, shadow: 1024, grass: 650, trees: 0.55, anisotropy: 2 }
  };
  function detectQuality(force) {
    if (TIERS[force]) return force;
    const mem = root.navigator && navigator.deviceMemory || 4, cores = root.navigator && navigator.hardwareConcurrency || 4;
    const touch = root.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (touch || mem <= 2 || cores <= 2) return 'low';
    if (mem <= 4 || cores <= 4) return 'medium';
    return 'high';
  }

  // ---------------------------------------------------------------- canvas textures (procedural)
  function canvasTex(w, h, draw, { repeat = 1, srgb = true, aniso = 4 } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat);
    if (srgb) t.encoding = T.sRGBEncoding; t.anisotropy = aniso;
    return t;
  }
  function noiseFill(g, w, h, base, vary, rnd, n = 9000, size = [1, 3]) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const [r, gg, b] = vary(rnd);
      g.fillStyle = `rgba(${r},${gg},${b},${0.08 + rnd() * 0.22})`;
      const s = size[0] + rnd() * (size[1] - size[0]);
      g.fillRect(rnd() * w, rnd() * h, s, s * (0.6 + rnd()));
    }
  }
  function grassTexture(palette, seed, aniso) {
    const r = U.rng(seed);
    return canvasTex(512, 512, (g, w, h) => {
      noiseFill(g, w, h, palette.base, rr => palette.blades[Math.floor(rr() * palette.blades.length)], r, 26000, [1, 2.4]);
      // soft large patches
      for (let i = 0; i < 40; i++) {
        const x = r() * w, y = r() * h, rad = 30 + r() * 90, grd = g.createRadialGradient(x, y, 0, x, y, rad);
        grd.addColorStop(0, palette.patch[i % palette.patch.length]); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }, { repeat: 1, aniso });
  }
  function leafTexture(seed) {
    const key = 'leaf' + seed; if (texCache[key]) return texCache[key];
    const r = U.rng(seed + 900);
    const t = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const x = r() * w, y = r() * h, s = 3 + r() * 7, a = r() * Math.PI, l = 60 + r() * 150;
        g.fillStyle = `rgb(${l | 0},${l | 0},${l | 0})`; g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
    }, { repeat: 1, srgb: false });
    t.repeat.set(3, 3); (t.userData || (t.userData = {})).shared = true;
    return (texCache[key] = t);
  }
  function barkTexture() {
    if (texCache.bark) return texCache.bark;
    const r = U.rng(4321);
    const t = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const x = r() * w; g.strokeStyle = `rgba(30,30,30,${0.2 + r() * 0.4})`; g.lineWidth = 1 + r() * 3; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 20, h * 0.3, x + (r() - 0.5) * 20, h * 0.6, x + (r() - 0.5) * 10, h); g.stroke(); } }, { repeat: 1, srgb: false });
    (t.userData || (t.userData = {})).shared = true;
    return (texCache.bark = t);
  }
  const texCache = {};
  function bladeTexture(seed) {
    const r = U.rng(seed);
    return canvasTex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const x = 8 + r() * (w - 16), top = 10 + r() * 50, lean = (r() - 0.5) * 30;
        const c = [60 + r() * 50, 100 + r() * 60, 30 + r() * 30];
        const grd = g.createLinearGradient(0, h, 0, top);
        grd.addColorStop(0, `rgb(${c[0] * 0.5 | 0},${c[1] * 0.55 | 0},${c[2] * 0.5 | 0})`); grd.addColorStop(1, `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`);
        g.fillStyle = grd; g.beginPath(); g.moveTo(x - 2.4, h); g.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); g.lineTo(x + 2.4, h); g.fill();
      }
    }, { repeat: 1 });
  }

  // ---------------------------------------------------------------- world
  function create(canvas, quality) {
    const tier = TIERS[quality] || TIERS.medium;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, tier.maxDpr));
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(48, 16 / 9, 0.05, 1600);
    const hemi = new T.HemisphereLight(0xdbe9ff, 0x5a5a3a, 0.62); scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff1dc, 2.1); sun.castShadow = true;
    sun.shadow.mapSize.set(tier.shadow, tier.shadow); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025;
    const sc = sun.shadow.camera; sc.near = 1; sc.far = 140; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9;
    scene.add(sun, sun.target);
    const fill = new T.DirectionalLight(0xbcd4ff, 0.35); scene.add(fill);
    // sky dome
    const skyU = { top: { value: new T.Color() }, horizon: { value: new T.Color() }, bottom: { value: new T.Color() }, sunDir: { value: new T.Vector3(0, 1, 0) }, sunColor: { value: new T.Color(1, 0.95, 0.8) }, haze: { value: 1 } };
    const sky = new T.Mesh(new T.SphereGeometry(1400, 32, 16), new T.ShaderMaterial({
      uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float haze; varying vec3 vDir;
        void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, clamp(-h*6.0,0.0,1.0));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          c += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.18 * haze + pow(s, 3.0) * 0.06 * haze);
          gl_FragColor = vec4(c, 1.0); }`
    }));
    sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
    const world = {
      renderer, scene, camera, sun, hemi, fill, sky, skyU, tier, quality, env: null, updaters: [],
      size: { w: 1, h: 1 },
      setSun(dirDeg, elevDeg) {
        const az = dirDeg * Math.PI / 180, el = elevDeg * Math.PI / 180;
        world.sunDir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
        skyU.sunDir.value.copy(world.sunDir);
      },
      /** keep the shadow frustum on the area that matters (archer + near field) */
      focusShadow(center, radius = 9) {
        sun.target.position.copy(center);
        sun.position.copy(center).addScaledVector(world.sunDir, 60);
        sc.left = sc.bottom = -radius; sc.right = sc.top = radius; sc.updateProjectionMatrix();
        sun.target.updateMatrixWorld();
      },
      setShadows(on) { renderer.shadowMap.enabled = on; sun.castShadow = on; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); },
      setPixelRatio(r) { renderer.setPixelRatio(r); world.resize(); },
      resize() {
        const p = canvas.parentElement || canvas; const w = Math.max(1, p.clientWidth), h = Math.max(1, p.clientHeight);
        world.size.w = w; world.size.h = h;
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      },
      render() { renderer.render(scene, camera); },
      setEnvironment(env) {
        if (world.env) { scene.remove(world.env.group); disposeTree(world.env.group); world.env.dispose && world.env.dispose(); }
        world.env = env; world.updaters = env.updaters || [];
        scene.add(env.group);
        const p = env.palette;
        skyU.top.value.set(p.skyTop); skyU.horizon.value.set(p.skyHorizon); skyU.bottom.value.set(p.skyBottom); skyU.haze.value = p.haze ?? 1;
        linearize(env.group);
        scene.fog = new T.Fog(lin(p.fog), p.fogNear, p.fogFar);
        hemi.color.copy(lin(p.hemiSky)); hemi.groundColor.copy(lin(p.hemiGround)); hemi.intensity = p.hemiI;
        sun.color.copy(lin(p.sun)); sun.intensity = p.sunI; fill.intensity = p.fillI ?? 0.35;
        world.setSun(p.sunAz, p.sunEl);
        fill.position.copy(world.sunDir).multiplyScalar(-40).setY(20);
        renderer.toneMappingExposure = p.exposure ?? 1;
      },
      update(dt, t) { for (const f of world.updaters) f(dt, t); },
      dispose() { if (world.env) disposeTree(world.env.group); disposeTree(scene); renderer.dispose(); }
    };
    world.setSun(30, 40);
    world.resize();
    return world;
  }

  /** Colours in this game are authored as sRGB hex values; three r128 treats Color.set() as linear. Convert
   *  every material / instance colour of a subtree exactly once (idempotent), so the scene is not washed out. */
  function linearize(root) {
    root.traverse(o => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (!m || (m.userData && m.userData.lin) || m.isShaderMaterial) continue;
        if (m.color) m.color.convertSRGBToLinear();
        if (m.emissive) m.emissive.convertSRGBToLinear();
        (m.userData || (m.userData = {})).lin = true;
      }
      if (o.isInstancedMesh && o.instanceColor && !o.userData.lin) {
        const a = o.instanceColor.array, c = new T.Color();
        for (let i = 0; i < a.length; i += 3) { c.setRGB(a[i], a[i + 1], a[i + 2]).convertSRGBToLinear(); a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
        o.instanceColor.needsUpdate = true; o.userData.lin = true;
      }
    });
    return root;
  }
  const lin = hex => new T.Color(hex).convertSRGBToLinear();

  function disposeTree(o) {
    o.traverse(x => {
      if (x.geometry && !x.geometry.userData.shared) x.geometry.dispose();
      const ms = Array.isArray(x.material) ? x.material : x.material ? [x.material] : [];
      for (const m of ms) { if (m.userData && m.userData.shared) continue; for (const k of ['map', 'normalMap', 'roughnessMap', 'alphaMap', 'emissiveMap']) if (m[k] && !(m[k].userData && m[k].userData.shared)) m[k].dispose(); m.dispose(); }
    });
  }

  // ---------------------------------------------------------------- landscape builders (used by the modes)
  const B = {
    /** large ground with a procedural grass texture; returns the mesh */
    ground(group, palette, { size = 900, repeat = 140, seed = 11, aniso = 4 } = {}) {
      const tex = grassTexture(palette.grass, seed, aniso); tex.repeat.set(repeat, repeat);
      const g = new T.PlaneGeometry(size, size, 1, 1); g.rotateX(-Math.PI / 2);
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0, color: 0xffffff }));
      m.receiveShadow = true; m.name = 'ground'; group.add(m); return m;
    },
    /** mowed strip / path decal on the ground */
    strip(group, { x = 0, z = 0, w = 4, l = 40, color = 0x6b8f3a, opacity = 0.35, rot = 0 }) {
      const g = new T.PlaneGeometry(w, l); g.rotateX(-Math.PI / 2);
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(x, 0.004, z); m.rotation.y = rot; m.receiveShadow = true; group.add(m); return m;
    },
    /** distant mountain ring (vertex coloured, faded by the fog) */
    mountains(group, { radius = 620, height = 120, seed = 3, colorA = 0x6f7f7a, colorB = 0xb7c3c4, arc = [0, Math.PI * 2], rings = 2 } = {}) {
      const r = U.rng(seed);
      for (let k = 0; k < rings; k++) {
        const segs = 220, rad = radius - k * 90, hh = height * (k ? 0.65 : 1);
        const pos = [], col = [], idx = [];
        const a0 = arc[0], a1 = arc[1];
        const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
        const cA = new T.Color(k ? colorA : colorB), cB = new T.Color(k ? 0x4c5b4c : colorA), top = new T.Color(0xe9eef0);
        for (let i = 0; i <= segs; i++) {
          const a = a0 + (a1 - a0) * i / segs;
          const n = 0.5 + 0.25 * Math.sin(a * 3 + ph[0]) + 0.17 * Math.sin(a * 7.3 + ph[1]) + 0.1 * Math.sin(a * 17.1 + ph[2]) + 0.05 * Math.sin(a * 41 + ph[3]);
          const y = Math.max(0.08, n) * hh;
          const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
          pos.push(x, -2, z, x, y, z);
          const c1 = cB.clone(), c2 = cA.clone().lerp(top, k === 0 && n > 0.78 ? (n - 0.78) * 3 : 0);
          col.push(c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
          if (i < segs) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
        }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
        const m = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }));
        group.add(m);
      }
    },
    /** instanced trees: list of {x,z,s,kind} */
    trees(group, list, { palette, seed = 5 } = {}) {
      if (!list.length) return;
      const r = U.rng(seed);
      const trunkG = new T.CylinderGeometry(0.12, 0.2, 1, 7); trunkG.translate(0, 0.5, 0);
      const crownG = new T.IcosahedronGeometry(1, 2);
      // deterministic lumps on the crown
      const p = crownG.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.16 * Math.abs(Math.sin(p.getX(i) * 5.1 + p.getY(i) * 3.3 + p.getZ(i) * 4.7)) + 0.12 * Math.sin(p.getX(i) * 11.3 - p.getZ(i) * 9.1); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } crownG.computeVertexNormals();
      const coneG = new T.ConeGeometry(1, 1, 8); coneG.translate(0, 0.5, 0);
      const trunkM = new T.MeshStandardMaterial({ color: 0x6a5442, roughness: 1, map: barkTexture() });
      const leafM = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, map: leafTexture(seed) });
      const n = list.length;
      const trunks = new T.InstancedMesh(trunkG, trunkM, n);
      const crowns = new T.InstancedMesh(crownG, leafM, n * 3);
      const cones = new T.InstancedMesh(coneG, leafM.clone(), n * 3);
      let ci = 0, ki = 0; const M = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), pp = new T.Vector3(), col = new T.Color();
      list.forEach((t, i) => {
        const h = 3.2 * t.s;
        M.compose(pp.set(t.x, 0, t.z), q.identity(), s.set(t.s, h * (t.kind === 'pine' ? 0.5 : 1), t.s)); trunks.setMatrixAt(i, M);
        if (t.kind === 'pine') {
          for (let k = 0; k < 3; k++) { M.compose(pp.set(t.x, h * (0.35 + k * 0.28), t.z), q.setFromAxisAngle(new T.Vector3(0, 1, 0), r() * 6), s.set(t.s * (1.9 - k * 0.5), t.s * 2.6, t.s * (1.9 - k * 0.5))); cones.setMatrixAt(ki, M); cones.setColorAt(ki, col.set(palette.pine).offsetHSL(0, 0, (r() - 0.5) * 0.06 - 0.03 - 0.03 * k)); ki++; }
        } else {
          for (let k = 0; k < 3; k++) { M.compose(pp.set(t.x + (r() - 0.5) * t.s, h * (0.95 + k * 0.18) + 0.4, t.z + (r() - 0.5) * t.s), q.setFromAxisAngle(new T.Vector3(0, 1, 0), r() * 6), s.setScalar(t.s * (1.45 - k * 0.25))); crowns.setMatrixAt(ci, M); crowns.setColorAt(ci, col.set(palette.leaf).offsetHSL((r() - 0.5) * 0.03, 0.02, (r() - 0.5) * 0.08 - 0.06 + 0.03 * k)); ci++; }
        }
      });
      crowns.count = ci; cones.count = ki;
      for (const m of [trunks, crowns, cones]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
    },
    /** instanced grass tufts (crossed quads) in a set of rectangles {x0,x1,z0,z1} */
    grass(group, areas, count, seed = 9) {
      if (count <= 0) return;
      const r = U.rng(seed);
      const tex = bladeTexture(seed);
      const g = new T.PlaneGeometry(0.55, 0.32); g.translate(0, 0.16, 0);
      const g2 = g.clone(); g2.rotateY(Math.PI / 2);
      const merged = mergeTwo(g, g2);
      const m = new T.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: T.DoubleSide, roughness: 1 });
      const inst = new T.InstancedMesh(merged, m, count);
      const M = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3(), col = new T.Color();
      const total = areas.reduce((a, b) => a + (b.x1 - b.x0) * (b.z1 - b.z0), 0);
      let i = 0;
      for (const a of areas) {
        const n = Math.round(count * (a.x1 - a.x0) * (a.z1 - a.z0) / total);
        for (let k = 0; k < n && i < count; k++, i++) {
          M.compose(p.set(U.lerp(a.x0, a.x1, r()), 0, U.lerp(a.z0, a.z1, r())), q.setFromAxisAngle(new T.Vector3(0, 1, 0), r() * 3.14), s.setScalar(0.7 + r() * 0.8));
          inst.setMatrixAt(i, M); inst.setColorAt(i, col.setHSL(0.22 + r() * 0.05, 0.35 + r() * 0.2, 0.55 + r() * 0.25));
        }
      }
      inst.count = i; inst.receiveShadow = true; group.add(inst);
      return inst;
    },
    /** canvas sign with dynamic (configurable) text — never a hard-coded school name */
    sign(text, { w = 4, h = 0.8, bg = '#8A1538', fg = '#ffffff', font = 'bold 64px Tajawal, sans-serif', sub = '' } = {}) {
      const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
      const g = c.getContext('2d');
      g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, c.height - 10, c.width, 10);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      g.font = font; fitText(g, text, c.width - 60, sub ? c.height * 0.4 : c.height * 0.52, c.width / 2, font);
      if (sub) { g.globalAlpha = 0.85; g.font = font.replace(/\d+px/, m => Math.round(parseInt(m) * 0.55) + 'px'); fitText(g, sub, c.width - 80, c.height * 0.75, c.width / 2, g.font); }
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
      const mesh = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: t, roughness: 0.6 }));
      mesh.castShadow = true;
      return mesh;
    },
    canvasTex, noiseFill, rng: U.rng
  };
  function fitText(g, text, maxW, y, x, font) {
    let size = parseInt(font.match(/(\d+)px/)[1]);
    while (size > 14) { g.font = font.replace(/\d+px/, size + 'px'); if (g.measureText(text).width <= maxW) break; size -= 4; }
    g.fillText(text, x, y);
  }
  function mergeTwo(a, b) {
    const g = new T.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) {
      const A = a.attributes[k].array, Bb = b.attributes[k].array, out = new Float32Array(A.length + Bb.length);
      out.set(A); out.set(Bb, A.length); g.setAttribute(k, new T.BufferAttribute(out, a.attributes[k].itemSize));
    }
    const ia = a.index.array, ib = b.index.array, off = a.attributes.position.count, idx = new Uint16Array(ia.length + ib.length);
    idx.set(ia); for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + off;
    g.setIndex(new T.BufferAttribute(idx, 1));
    return g;
  }

  TS.World = { create, detectQuality, TIERS, B, disposeTree, linearize, lin };
})(typeof window !== 'undefined' ? window : globalThis);
