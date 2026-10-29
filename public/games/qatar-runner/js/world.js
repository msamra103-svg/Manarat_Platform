/* عدّاء قطر — the Doha world: sky + time of day, West Bay skyline, Corniche (road, promenade, bay, dhows, palms,
 * lamps, Qatar flags, traffic) and a Souq Waqif–inspired heritage street, streamed in 20 m segments.
 * Everything that scrolls lives in `track` (track coordinate z = −s); the player stays near the origin.
 * Two render passes: background (sky + distant skyline with its own long-range haze) then the near world.
 */
(function (root) {
  'use strict';
  const T = root.THREE, X = root.QRTex, P = root.QRProps, C = P.C;
  const SEG = 20, AHEAD = 16, BEHIND = 3;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const M4 = () => new T.Matrix4();
  const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(), tmpP = new T.Vector3(), tmpE = new T.Euler();
  function mtx(x, y, z, ry = 0, s = 1, sy = null, sz = null) { tmpQ.setFromEuler(tmpE.set(0, ry, 0)); tmpS.set(s, sy == null ? s : sy, sz == null ? s : sz); tmpP.set(x, y, z); return tmpM.compose(tmpP, tmpQ, tmpS); }

  // ------------------------------------------------------------------ instancing pools
  class Pool {
    constructor(parent, geo, mat, cap, o = {}) {
      const m = this.mesh = new T.InstancedMesh(geo, mat, cap); m.frustumCulled = false; m.castShadow = o.shadow !== false; m.receiveShadow = o.receive !== false; m.name = o.name || '';
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.zero = new T.Matrix4().makeScale(0, 0, 0); this.free = []; for (let i = cap - 1; i >= 0; i--) { this.free.push(i); m.setMatrixAt(i, this.zero); }
      if (o.colors) { const w = new T.Color(1, 1, 1); for (let i = 0; i < cap; i++) m.setColorAt(i, w); }
      this.used = new Uint8Array(cap); m.count = 0; // only the used prefix is drawn (lowest free index is reused first)
      parent.add(m); this.cap = cap;
    }
    add(mat, color) { const i = this.free.pop(); if (i === undefined) return -1; this.used[i] = 1; if (i + 1 > this.mesh.count) this.mesh.count = i + 1; this.mesh.setMatrixAt(i, mat); this.mesh.instanceMatrix.needsUpdate = true; if (color && this.mesh.instanceColor) { this.mesh.setColorAt(i, color); this.mesh.instanceColor.needsUpdate = true; } return i; }
    set(i, mat) { if (i < 0) return; this.mesh.setMatrixAt(i, mat); this.mesh.instanceMatrix.needsUpdate = true; }
    remove(i) { if (i < 0 || !this.used[i]) return; this.used[i] = 0; this.mesh.setMatrixAt(i, this.zero); this.free.push(i); this.free.sort((a, b) => b - a); let c = this.mesh.count; while (c > 0 && !this.used[c - 1]) c--; this.mesh.count = c; this.mesh.instanceMatrix.needsUpdate = true; }
  }
  class PropType {
    constructor(parent, def, cap, o = {}) { this.def = def; this.pools = def.parts.map(p => new Pool(parent, p.geo, p.mat, cap, { shadow: o.shadow !== false && p.shadow !== false && !p.glow, receive: o.receive !== false, colors: p.name === (o.colorPart || 'body'), name: (o.name || '') + ':' + p.name })); }
    add(mat, color) { return this.pools.map(pl => pl.add(mat, color)); }
    set(ids, mat) { ids.forEach((id, k) => this.pools[k].set(id, mat)); }
    remove(ids) { ids.forEach((id, k) => this.pools[k].remove(id)); }
  }

  // ------------------------------------------------------------------ shader tweaks
  const U = { time: { value: 0 }, night: { value: 0 } };
  function swayMat(m, crownY = 7.2, amt = 0.055) {
    m.onBeforeCompile = s => { s.uniforms.uTime = U.time; s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float hh = max(0.0, transformed.y - ${crownY.toFixed(2)}); vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      float ph = ip.x * 0.37 + ip.z * 0.21;
      transformed.x += (sin(uTime * 1.5 + ph) * ${amt.toFixed(3)} + sin(uTime * 3.3 + ph * 2.0) * 0.018) * hh * (1.0 + 0.2 * abs(transformed.x - 0.35));
      transformed.z += cos(uTime * 1.2 + ph) * ${(amt * 0.8).toFixed(3)} * hh;`); };
    m.customProgramCacheKey = () => 'sway' + crownY;
  }
  function waveMat(m) {
    m.onBeforeCompile = s => { s.uniforms.uTime = U.time; s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float d = max(0.0, transformed.z - 0.07); vec3 ip = vec3(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xyz;
      #endif
      transformed.x += sin(uTime * 4.2 + transformed.z * 5.0 + ip.z * 0.3) * 0.09 * d + sin(uTime * 7.1 + transformed.y * 3.0) * 0.02 * d;`); };
    m.customProgramCacheKey = () => 'wave';
  }
  // facade material: UVs in world units taken from the instance scale (one texture tile = panel × floor),
  // per-window random night lighting
  function facadeMat(maps, panel, floor, o = {}) {
    const m = new T.MeshStandardMaterial(Object.assign({}, maps, { emissive: new T.Color(1, 1, 1), emissiveIntensity: 0, roughness: 1, metalness: o.metal || 0, envMapIntensity: o.env || 1, normalScale: new T.Vector2(1, 1) }));
    m.onBeforeCompile = s => {
      s.uniforms.uNight = U.night;
      s.vertexShader = s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec3 isc = vec3(1.0);
        #ifdef USE_INSTANCING
          isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        #endif
        vec3 wp = position * isc;
        vUv = (abs(normal.x) > 0.5 ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y)) / vec2(${panel.toFixed(2)}, ${floor.toFixed(2)});
        if (abs(normal.y) > 0.5) vUv = vec2(0.03, 0.03);`);
      s.fragmentShader = 'uniform float uNight;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float lit = step(0.42, fract(sin(dot(floor(vUv), vec2(12.9898, 78.233))) * 43758.5453));
        totalEmissiveRadiance *= lit * uNight * 1.6;`);
    };
    m.customProgramCacheKey = () => 'facade' + panel + floor;
    return m;
  }

  // ------------------------------------------------------------------ time of day presets
  const TOD = [
    { skyEl: 52, sunEl: 52, sunAz: 140, sun: '#fff0d8', sunI: 3.3, hemiS: '#cfe6ff', hemiG: '#ad9472', hemiI: 0.28, top: '#1b5fc0', hor: '#9cc9ea', fog: '#b9d6ea', exp: 0.66, night: 0 },
    { skyEl: 17, sunEl: 17, sunAz: 205, sun: '#ffcf8c', sunI: 2.3, hemiS: '#f0d9bd', hemiG: '#8a6c52', hemiI: 0.62, top: '#4777b2', hor: '#f4c891', fog: '#e9d0ac', exp: 0.98, night: 0.08 },
    { skyEl: 2.5, sunEl: 3.5, sunAz: 215, sun: '#ff8d4f', sunI: 1.5, hemiS: '#e6a681', hemiG: '#4b3a3c', hemiI: 0.5, top: '#26386a', hor: '#ff9b5c', fog: '#c88f73', exp: 1.05, night: 0.55 },
    { skyEl: -9, sunEl: 38, sunAz: 120, sun: '#9db5e3', sunI: 0.42, hemiS: '#3b4c74', hemiG: '#16161d', hemiI: 0.45, top: '#040a1b', hor: '#1b2a4a', fog: '#1c2944', exp: 1.25, night: 1 }
  ];
  function lerpTod(t) { const i = clamp(Math.floor(t), 0, TOD.length - 2), f = clamp(t - i, 0, 1), a = TOD[i], b = TOD[i + 1], o = {}; for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], f) : new T.Color(a[k]).lerp(new T.Color(b[k]), f); return o; }

  class World {
    constructor(renderer, opts = {}) {
      this.renderer = renderer; this.q = opts.quality || 'high';
      this.scene = new T.Scene(); this.bg = new T.Scene();
      this.track = new T.Group(); this.track.name = 'track'; this.scene.add(this.track);
      this.segments = new Map(); this.plan = { env: 'tour', bounds: [] }; this.tod = 0; this.todApplied = -1; this.time = 0; this.distance = 0;
      this.buildSkyAndLights(); this.buildMaterials(); this.buildPools(); this.buildFar(); this.buildSkyline();
      this.traffic = []; this.nextCar = 0; this.dhows = [];
      this.onCarPass = null;
      this.setTimeOfDay(0, true);
    }
    // ---------------------------------------------------------------- sky, lights, fog, environment map
    buildSkyAndLights() {
      // physically based daylight sky (Preetham / Hosek-style analytic model, as in three.js examples/Sky.js, MIT)
      // with Doha haze (high turbidity), blended into a starry night gradient after sunset
      const skyMat = this.skyMat = new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new T.Color() }, hor: { value: new T.Color() }, sunDir: { value: new T.Vector3(0, 1, 0) }, sunCol: { value: new T.Color() }, night: { value: 0 },
          turbidity: { value: 3.2 }, rayleigh: { value: 1.25 }, mieC: { value: 0.005 }, mieG: { value: 0.8 }, gain: { value: 0.62 }, sat: { value: 1.75 } },
        vertexShader: `uniform vec3 sunDir; uniform float turbidity, rayleigh, mieC;
          varying vec3 vDir; varying vec3 vBetaR, vBetaM; varying float vSunE;
          const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
          const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
          float sunIntensity(float c) { c = clamp(c, -1.0, 1.0); return 1000.0 * max(0.0, 1.0 - exp(-((1.6110731556870734 - acos(c)) / 1.5))); }
          void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww;
            vSunE = sunIntensity(normalize(sunDir).y);
            vBetaR = totalRayleigh * rayleigh;
            vBetaM = 0.434 * (0.2 * turbidity) * 10E-18 * MieConst * mieC; }`,
        fragmentShader: `uniform vec3 top, hor, sunDir, sunCol; uniform float night, mieG, gain, sat; varying vec3 vDir; varying vec3 vBetaR, vBetaM; varying float vSunE;
          const float pi = 3.141592653589793;
          float h21(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
          float rPhase(float c){ return 0.05968310365946075 * (1.0 + c * c); }
          float hgPhase(float c, float g){ float g2 = g * g; return 0.07957747154594767 * (1.0 - g2) / pow(1.0 - 2.0 * g * c + g2, 1.5); }
          void main(){ vec3 d = normalize(vDir); vec3 sd = normalize(sunDir); vec3 up = vec3(0.0, 1.0, 0.0);
            float dy = max(d.y, 0.0);
            float zen = acos(dy);
            float inv = 1.0 / (cos(zen) + 0.15 * pow(93.885 - zen * 180.0 / pi, -1.253));
            vec3 Fex = exp(-(vBetaR * 8.4E3 * inv + vBetaM * 1.25E3 * inv));
            float ct = dot(d, sd);
            vec3 bR = vBetaR * rPhase(ct * 0.5 + 0.5), bM = vBetaM * hgPhase(ct, mieG);
            vec3 Lin = pow(vSunE * ((bR + bM) / (vBetaR + vBetaM)) * (1.0 - Fex), vec3(1.5));
            Lin *= mix(vec3(1.0), pow(vSunE * ((bR + bM) / (vBetaR + vBetaM)) * Fex, vec3(0.5)), clamp(pow(1.0 - dot(up, sd), 5.0), 0.0, 1.0));
            vec3 L0 = vec3(0.1) * Fex + vSunE * 19000.0 * Fex * smoothstep(0.99995, 0.99997, ct);
            vec3 day = pow((Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075), vec3(1.0 / 2.4)) * gain;
            { float l = dot(day, vec3(0.2126, 0.7152, 0.0722)); day = max(vec3(l) + (day - l) * sat, 0.0) * mix(0.82, 1.0, smoothstep(0.0, 0.5, 1.0 - d.y)); } // polariser-like depth of the Gulf sky
            // below the horizon: hazy ground glow so the far bay never shows a hard line
            day = mix(day, hor * 0.85, smoothstep(0.0, -0.08, d.y));
            vec3 nightCol = mix(hor, top, pow(clamp(d.y, 0.0, 1.0), 0.5));
            nightCol = mix(nightCol, hor * 0.8, smoothstep(0.0, -0.12, d.y));
            if (d.y > 0.04) { vec3 q = floor(d * 380.0); float st = step(0.9965, h21(q)); nightCol += vec3(st) * 1.2 * (0.6 + 0.4 * sin(h21(q + 1.0) * 30.0)) * smoothstep(0.3, 1.0, night); }
            float s = max(dot(d, normalize(vec3(-0.3, 0.6, -0.7))), 0.0); nightCol += vec3(0.75, 0.8, 0.9) * pow(s, 2500.0) * 4.0 * smoothstep(0.6, 1.0, night);
            vec3 col = mix(day, nightCol, smoothstep(0.55, 1.0, night));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
          }`
      });
      this.sky = new T.Mesh(new T.SphereGeometry(4000, 32, 16), skyMat); this.sky.renderOrder = -10; this.bg.add(this.sky);
      this.envScene = new T.Scene(); this.envSky = new T.Mesh(new T.SphereGeometry(100, 32, 16), skyMat); this.envScene.add(this.envSky);
      this.pmrem = new T.PMREMGenerator(this.renderer);
      this.scene.fog = new T.Fog(0xcfe4f0, 110, 360); this.bg.fog = new T.Fog(0xcfe4f0, 120, 3400);
      this.hemi = new T.HemisphereLight(0xffffff, 0x888888, 0.8); this.scene.add(this.hemi); this.bgHemi = new T.HemisphereLight(0xffffff, 0x888888, 0.8); this.bg.add(this.bgHemi);
      const sun = this.sun = new T.DirectionalLight(0xffffff, 2.5); this.scene.add(sun); this.scene.add(sun.target);
      this.bgSun = new T.DirectionalLight(0xffffff, 2.0); this.bg.add(this.bgSun);
      if (this.q !== 'low') {
        sun.castShadow = true; const s = this.q === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(s, s);
        Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 22, bottom: -22, near: 1, far: 120 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
      }
    }
    setTimeOfDay(t, force) {
      this.tod = t; if (!force && Math.abs(t - this.todApplied) < 0.004) return; this.todApplied = t;
      const o = lerpTod(t); this.todNow = o;
      const el = o.sunEl * Math.PI / 180, az = o.sunAz * Math.PI / 180;
      this.sunDir = new T.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
      this.skyMat.uniforms.top.value.copy(o.top); this.skyMat.uniforms.hor.value.copy(o.hor); this.skyMat.uniforms.sunCol.value.copy(o.sun).multiplyScalar(Math.min(1, o.sunI / 2)); this.skyMat.uniforms.night.value = o.night;
      { const se = o.skyEl * Math.PI / 180; this.skyMat.uniforms.sunDir.value.set(Math.cos(se) * Math.sin(az), Math.sin(se), Math.cos(se) * Math.cos(az)).normalize(); }
      this.sun.color.copy(o.sun); this.sun.intensity = o.sunI; this.bgSun.color.copy(o.sun); this.bgSun.intensity = o.sunI * 0.9; this.bgSun.position.copy(this.sunDir).multiplyScalar(100);
      this.hemi.color.copy(o.hemiS); this.hemi.groundColor.copy(o.hemiG); this.hemi.intensity = o.hemiI; this.bgHemi.color.copy(o.hemiS); this.bgHemi.groundColor.copy(o.hemiG); this.bgHemi.intensity = o.hemiI;
      this.scene.fog.color.copy(o.fog); this.bg.fog.color.copy(o.fog).lerp(o.hor, 0.5);
      this.renderer.toneMappingExposure = o.exp; U.night.value = o.night;
      for (const m of this.glowMats) m.emissiveIntensity = m.userData.base + m.userData.night * o.night;
      if (this.decalMat) this.decalMat.opacity = 0.75 * Math.max(0, o.night - 0.2);
      if (this.points) this.points.material.opacity = Math.max(0, o.night - 0.15);
      for (const tw of this.towerNight || []) tw.emissiveIntensity = o.night * tw.userData.k;
      // environment reflections: regenerate when the light has changed enough
      if (force || Math.abs(t - (this.envT == null ? -9 : this.envT)) > 0.18) { this.envT = t; this.skyMat.uniforms.sat.value = 1.2; const rt = this.pmrem.fromScene(this.envScene, 0.02); this.skyMat.uniforms.sat.value = 1.75; if (this.envRT) this.envRT.dispose(); this.envRT = rt; this.scene.environment = rt.texture; this.bg.environment = rt.texture; }
    }
    // ---------------------------------------------------------------- shared materials
    buildMaterials() {
      // photo-like PBR maps (tools/textures/build_env.py): colour + normal + roughness
      this.mRoad = new T.MeshStandardMaterial(Object.assign(X.pbr('road'), { roughness: 1, metalness: 0, normalScale: new T.Vector2(0.7, 0.7) }));
      this.mCurb = new T.MeshStandardMaterial({ map: X.photo('curb_c'), roughness: 0.75 });
      this.mPaver = new T.MeshStandardMaterial(Object.assign(X.pbr('paver'), { color: C('#c4bcb0'), roughness: 1, normalScale: new T.Vector2(0.8, 0.8) }));
      this.mStone = new T.MeshStandardMaterial(Object.assign(X.pbr('souqfloor'), { color: C('#9d9b97'), roughness: 1, metalness: 0, normalScale: new T.Vector2(0.7, 0.7) }));
      this.mGrass = new T.MeshStandardMaterial({ map: X.photo('grass_c'), normalMap: X.photo('grass_n', { srgb: false }), normalScale: new T.Vector2(0.9, 0.9), roughness: 0.97 });
      this.mSeawall = new T.MeshStandardMaterial({ map: X.photo('souqfloor_c', { repeat: [0.4, 0.4] }), color: C('#e6dccb'), roughness: 0.9 });
      this.mRail = new T.MeshStandardMaterial({ color: C('#f2f2ef'), roughness: 0.4, metalness: 0.3 });
      this.mPlaster = new T.MeshStandardMaterial({ map: X.photo('plaster_c', { repeat: [0.34, 0.34] }), normalMap: X.photo('plaster_n', { srgb: false, repeat: [0.34, 0.34] }), normalScale: new T.Vector2(1.1, 1.1), roughness: 0.96 });
      this.mWoodDark = new T.MeshStandardMaterial({ map: X.photo('wood_c'), normalMap: X.photo('wood_n', { srgb: false }), color: C('#9a8a7a'), roughness: 0.85 });
      this.mIron = new T.MeshStandardMaterial({ color: C('#151515'), roughness: 0.5, metalness: 0.6 });
      this.mShop = new T.MeshStandardMaterial({ map: shopTexture(), emissive: new T.Color(1, 0.8, 0.55), emissiveMap: shopTexture(true), emissiveIntensity: 0.35, roughness: 0.9 });
      this.glowMats = [];
      this.glowMat = (m, base, night) => { if (!m || this.glowMats.includes(m)) return; m.userData.base = base; m.userData.night = night; this.glowMats.push(m); };
    }
    // ---------------------------------------------------------------- pools
    buildPools() {
      const tr = this.track, box = (w, h, d, uvx = 1, uvy = 1) => { const g = new T.BoxGeometry(w, h, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvx, uv.getY(i) * uvy); return g; };
      const plane = (w, d, rx, ry) => { const g = new T.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry); return g; };
      const N = AHEAD + BEHIND + 3, sh = this.q === 'high';
      this.pRoad = new Pool(tr, plane(7.8, SEG, 1, 1), this.mRoad, N * 2, { shadow: false, name: 'road' });
      this.pCurb = new Pool(tr, curbGeometry(0.3, 0.17, SEG), this.mCurb, N * 5, { shadow: false, name: 'curb' });
      this.pPromenade = new Pool(tr, box(9, 0.16, SEG, 9 / 2.4, SEG / 2.4), this.mPaver, N, { shadow: false, name: 'promenade' });
      this.pSidewalk = new Pool(tr, box(4.6, 0.16, SEG, 4.6 / 2.4, SEG / 2.4), this.mPaver, N, { shadow: false, name: 'sidewalk' });
      this.pMedian = new Pool(tr, box(3.1, 0.2, SEG, 3.1 / 2, SEG / 2), this.mGrass, N, { shadow: false, name: 'median' });
      this.pSeawall = new Pool(tr, box(0.7, 1.3, SEG), this.mSeawall, N, { shadow: false, name: 'seawall' });
      this.pRail = new Pool(tr, box(0.05, 0.05, SEG), this.mRail, N * 2, { shadow: false, name: 'rail' });
      this.pPost = new PropType(tr, P.railPost(), N * 9, { name: 'post', shadow: false });
      this.pStone = new Pool(tr, plane(14.4, SEG, 4.8, 6.67), this.mStone, N, { shadow: false, name: 'stone' });
      // nature & furniture
      const palmDef = P.palm(7.5); palmDef.parts.forEach(p => { if (p.sway) swayMat(p.mat, 7.2); });
      this.pPalm = new PropType(tr, palmDef, N * 6, { name: 'palm', shadow: sh });
      this.pShrub = new PropType(tr, P.shrub(), N * 6, { name: 'shrub', shadow: false });
      const lamp2 = P.lamp(2), lamp1 = P.lamp(1);
      this.pLamp2 = new PropType(tr, lamp2, N + 2, { name: 'lamp2', shadow: sh }); this.pLamp1 = new PropType(tr, lamp1, N + 2, { name: 'lamp1', shadow: false });
      const flag = P.flagBanner(); flag.parts.forEach(p => { if (p.wave) waveMat(p.mat); });
      this.pFlag = new PropType(tr, flag, N + 2, { name: 'flag', shadow: false });
      this.pBench = new PropType(tr, P.bench(), N, { name: 'bench', shadow: false });
      this.pUmb = new PropType(tr, P.umbrella(), N * 2, { name: 'umbrella', shadow: sh });
      this.pLantern = new PropType(tr, P.lantern(), N * 8, { name: 'lantern', shadow: false });
      this.pDhow = new PropType(tr, P.dhow(), 10, { name: 'dhow', shadow: false });
      this.glowMat(P.materials.lampGlow, 0.15, 2.6); this.glowMat(P.materials.lanternGlow, 0.5, 2.2); this.glowMat(P.materials.headL, 0.3, 2.0); this.glowMat(P.materials.tailL, 0.4, 1.6); this.glowMat(this.mShop, 0.35, 1.1);
      // buildings (city side of the Corniche)
      const fac = n => X.pbr(n, { emissive: true });
      const bgeo = new T.BoxGeometry(1, 1, 1); bgeo.translate(0, 0.5, 0);
      this.pBld = {
        stone: new Pool(tr, bgeo, facadeMat(fac('stonefac'), 2.6, 3.8), N * 2, { shadow: sh, colors: true, name: 'bld-stone' }),
        glass: new Pool(tr, bgeo, facadeMat(fac('glassfac'), 3.0, 3.8, { metal: 0.85, env: 1.5 }), N * 2, { shadow: sh, colors: true, name: 'bld-glass' }),
        mash: new Pool(tr, bgeo, facadeMat(fac('mashfac'), 3.4, 4.2), N * 2, { shadow: sh, colors: true, name: 'bld-mash' })
      };
      this.pPodium = new Pool(tr, bgeo, facadeMat(fac('shopfac'), 4.0, 4.5, { env: 1.2 }), N * 2, { shadow: sh, colors: true, name: 'bld-podium' });
      this.pRoof = new Pool(tr, new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new T.MeshStandardMaterial({ color: C('#d9d1c2'), roughness: 0.8 }), N * 4, { shadow: false, colors: true, name: 'roof' });
      // souq facade modules (two variants) and the heritage gate
      this.souqMods = [this.souqModule(0), this.souqModule(1)].map((def, k) => new PropType(tr, def, N * 7, { name: 'souq' + k, colorPart: 'wall', shadow: sh }));
      this.pGate = new PropType(tr, this.heritageGate(), 4, { name: 'hgate', shadow: sh });
      this.signTex = ['توابل وبهارات', 'عطور ودهن عود', 'مقهى السوق', 'حلويات قطرية', 'تحف وهدايا', 'أقمشة'].map(t => X.sign(t, { w: 512, h: 128, size: 58 }));
      this.pSigns = this.signTex.map((t, k) => new Pool(tr, new T.PlaneGeometry(2.2, 0.55), new T.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: new T.Color(0.9, 0.7, 0.4), emissiveMap: t, emissiveIntensity: 0.1 }), N * 2, { shadow: false, name: 'sign' + k }));
      this.pSigns.forEach(p => this.glowMat(p.mesh.material, 0.08, 0.6));
      // night light pools on the ground + glow points
      const dm = this.decalMat = new T.MeshBasicMaterial({ map: X.glow('rgba(255,214,150,1)'), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: true });
      const dg = new T.PlaneGeometry(1, 1); dg.rotateX(-Math.PI / 2);
      this.pDecal = new Pool(tr, dg, dm, N * 6, { shadow: false, receive: false, name: 'decal' });
      const gp = new T.BufferGeometry(); this.glowPos = new Float32Array(900 * 3).fill(0); this.glowUsed = new Uint8Array(900); gp.setAttribute('position', new T.BufferAttribute(this.glowPos, 3)); gp.setDrawRange(0, 900);
      this.points = new T.Points(gp, new T.PointsMaterial({ map: X.glow('rgba(255,226,170,1)'), size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, color: 0xffe2b0 })); this.points.frustumCulled = false; tr.add(this.points);
      // ambient traffic (opposite carriageway)
      const suv = P.car('suv'), sedan = P.car('sedan');
      this.pTrafficSUV = new PropType(this.scene, suv, 12, { name: 'trafficSUV', shadow: false }); this.pTrafficSedan = new PropType(this.scene, sedan, 10, { name: 'trafficSedan', shadow: false });
    }
    addGlow(x, y, z) { for (let i = 0; i < this.glowUsed.length; i++) if (!this.glowUsed[i]) { this.glowUsed[i] = 1; this.glowPos.set([x, y, z], i * 3); this.points.geometry.attributes.position.needsUpdate = true; return i; } return -1; }
    removeGlow(i) { if (i < 0) return; this.glowUsed[i] = 0; this.glowPos.set([0, -999, 0], i * 3); this.points.geometry.attributes.position.needsUpdate = true; }
    // Souq Waqif–style two-storey module, 6.6 m along the street; facade at local x = 0 facing +X
    souqModule(variant) {
      const Lm = 6.6, H = 7.4, sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(Lm, 0); sh.lineTo(Lm, H); sh.lineTo(0, H); sh.closePath();
      const arch = (cz, w, h, spring) => { const p = new T.Path(); p.moveTo(cz - w / 2, 0); p.lineTo(cz - w / 2, spring); p.quadraticCurveTo(cz - w / 2, h - 0.1, cz, h); p.quadraticCurveTo(cz + w / 2, h - 0.1, cz + w / 2, spring); p.lineTo(cz + w / 2, 0); p.closePath(); return p; };
      const win = (cz, y, w, h) => { const p = new T.Path(); p.moveTo(cz - w / 2, y); p.lineTo(cz + w / 2, y); p.lineTo(cz + w / 2, y + h); p.lineTo(cz - w / 2, y + h); p.closePath(); return p; };
      if (variant === 0) { sh.holes.push(arch(1.65, 2.3, 3.5, 2.3), arch(4.95, 2.3, 3.5, 2.3), win(1.65, 4.7, 0.9, 1.35), win(4.95, 4.7, 0.9, 1.35)); }
      else { sh.holes.push(arch(3.3, 3.6, 3.7, 2.4), win(3.3, 4.3, 1.5, 2.1)); }
      const wall = new T.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: false }); wall.rotateY(-Math.PI / 2);
      const parts = [wall];
      // parapet with stepped crenellations
      const par = new T.BoxGeometry(0.5, 0.35, Lm); P.tr(par, -0.25, H + 0.17, Lm / 2); parts.push(par);
      for (let k = 0; k < 6; k++) { const c = new T.BoxGeometry(0.5, 0.45, 0.55); P.tr(c, -0.25, H + 0.55, 0.55 + k * 1.1); parts.push(c); }
      const back = new T.BoxGeometry(0.2, 3.6, Lm); P.tr(back, -2.5, 1.8, Lm / 2);
      const ceil = new T.BoxGeometry(2.0, 0.15, Lm); P.tr(ceil, -1.5, 3.65, Lm / 2); parts.push(ceil);
      for (const z of [0.1, Lm - 0.1]) { const sp = new T.BoxGeometry(2.0, 3.6, 0.2); P.tr(sp, -1.5, 1.8, z); parts.push(sp); }
      const wood = []; for (let k = 0; k < 11; k++) { const b = new T.CylinderGeometry(0.06, 0.07, 0.6, 6); b.rotateZ(Math.PI / 2); P.tr(b, 0.25, H - 0.35, 0.3 + k * 0.6); wood.push(b); }
      const shutters = [];
      if (variant === 0) for (const cz of [1.65, 4.95]) { const f = new T.BoxGeometry(0.12, 1.35, 0.9); P.tr(f, -0.3, 4.7 + 0.675, cz); shutters.push(f); }
      else { const f = new T.BoxGeometry(0.12, 2.1, 1.5); P.tr(f, -0.35, 4.3 + 1.05, 3.3); shutters.push(f); }
      const iron = [];
      if (variant === 1) { // balcony
        const slab = new T.BoxGeometry(0.75, 0.12, 2.6); P.tr(slab, 0.37, 4.25, 3.3); parts.push(slab);
        const r1 = new T.BoxGeometry(0.04, 0.04, 2.6); P.tr(r1, 0.72, 5.25, 3.3); iron.push(r1); const r2 = new T.BoxGeometry(0.04, 0.04, 2.6); P.tr(r2, 0.72, 4.75, 3.3); iron.push(r2);
        for (let k = 0; k <= 12; k++) { const p = new T.BoxGeometry(0.03, 0.95, 0.03); P.tr(p, 0.72, 4.78, 2.0 + k * 2.6 / 12); iron.push(p); }
        for (const z of [2.0, 4.6]) { const s = new T.BoxGeometry(0.75, 0.04, 0.04); P.tr(s, 0.37, 5.25, z); iron.push(s); }
      } else { // small iron grilles on the windows
        for (const cz of [1.65, 4.95]) for (let k = 0; k < 4; k++) { const p = new T.BoxGeometry(0.03, 1.3, 0.03); P.tr(p, 0.02, 5.37, cz - 0.33 + k * 0.22); iron.push(p); }
      }
      const out = [{ name: 'wall', geo: P.merge(parts), mat: this.mPlaster }, { name: 'shop', geo: back, mat: this.mShop, shadow: false }, { name: 'wood', geo: P.merge([...wood, ...shutters]), mat: this.mWoodDark }];
      if (iron.length) out.push({ name: 'iron', geo: P.merge(iron), mat: this.mIron });
      return { parts: out };
    }
    heritageGate() { // monumental plaster gateway spanning the street (zone transition)
      const parts = [], H = 11.5;
      for (const s of [-1, 1]) { const tw = new T.BoxGeometry(4.2, H, 4.2); P.tr(tw, s * 9.4, H / 2, 0); parts.push(tw); for (let k = 0; k < 4; k++) { const c = new T.BoxGeometry(0.8, 0.7, 4.3); P.tr(c, s * 9.4 - 1.6 + k * 1.07, H + 0.35, 0); parts.push(c); } }
      const sh = new T.Shape(); sh.moveTo(-7.3, 0); sh.lineTo(7.3, 0); sh.lineTo(7.3, 4.0); sh.lineTo(-7.3, 4.0); sh.closePath();
      const hole = new T.Path(); hole.moveTo(-6.5, 0); hole.lineTo(-6.5, 1.5); hole.quadraticCurveTo(-6.5, 3.6, 0, 3.7); hole.quadraticCurveTo(6.5, 3.6, 6.5, 1.5); hole.lineTo(6.5, 0); hole.closePath(); sh.holes.push(hole);
      const top = new T.ExtrudeGeometry(sh, { depth: 3.2, bevelEnabled: false }); P.tr(top, 0, 6.6, -1.6); parts.push(top);
      const beam = new T.BoxGeometry(15, 0.6, 3.3); P.tr(beam, 0, 10.9, 0); parts.push(beam);
      const wood = []; for (let k = 0; k < 18; k++) { const b = new T.CylinderGeometry(0.08, 0.09, 0.7, 6); b.rotateX(Math.PI / 2); P.tr(b, -7 + k * 0.82, 10.2, 1.9); wood.push(b); }
      const sign = new T.PlaneGeometry(6.0, 1.4); P.tr(sign, 0, 9.0, 1.62);
      const signMat = new T.MeshStandardMaterial({ map: X.sign('سوق واقف', { w: 1024, h: 240, size: 150, bg: '#3a2a1a', fg: '#f3dca5' }), roughness: 0.7 });
      return { parts: [{ name: 'wall', geo: P.merge(parts), mat: this.mPlaster.clone() }, { name: 'wood', geo: P.merge(wood), mat: this.mWoodDark }, { name: 'sign', geo: sign, mat: signMat }] };
    }
    // ---------------------------------------------------------------- far: water + ground (follow the camera)
    buildFar() {
      const wn = X.photo('water_n', { srgb: false, repeat: [260, 260] });
      this.mWater = new T.MeshPhysicalMaterial({ color: C('#0f4d5c'), roughness: 0.07, metalness: 0.0, reflectivity: 0.5, normalMap: wn, normalScale: new T.Vector2(0.35, 0.35), envMapIntensity: 0.75 });
      this.water = new T.Mesh(new T.PlaneGeometry(4000, 4000), this.mWater); this.water.rotation.x = -Math.PI / 2; this.water.position.set(13.8 + 2000, -0.75, -1600); this.water.receiveShadow = false; this.scene.add(this.water);
      const sand = X.photo('sand_c', { repeat: [900, 900] }); this.ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.MeshStandardMaterial({ map: sand, roughness: 1 })); this.ground.rotation.x = -Math.PI / 2; this.ground.position.set(13.8 - 2000, -0.12, -1600); this.ground.receiveShadow = true; this.scene.add(this.ground);
      // distant bay water in the background pass, so the skyline stands on water
      this.bgWater = new T.Mesh(new T.PlaneGeometry(9000, 9000), new T.MeshStandardMaterial({ color: C('#175e70'), roughness: 0.12, metalness: 0.1, envMapIntensity: 0.7 })); this.bgWater.rotation.x = -Math.PI / 2; this.bgWater.position.set(0, -1.0, -2000); this.bg.add(this.bgWater);
    }
    // ---------------------------------------------------------------- West Bay skyline + Fanar spiral minaret (background pass)
    buildSkyline() {
      const g = this.skyline = new T.Group(); this.bg.add(g); this.towerNight = []; this.skylineInner = g;
      const night = (m, col, k = 1) => { m.emissive = new T.Color(col); m.userData.k = k; this.towerNight.push(m); return m; };
      const glass = (top, bottom, rep) => { const light = new T.Color(top).getHSL({}).l > 0.45; const maps = X.pbr(light ? 'glassfac2' : 'glassfac', { repeat: [rep[0] / 2, rep[1]], emissive: true }); const tint = new T.Color(top).lerp(new T.Color('#ffffff'), 0.55); return night(new T.MeshStandardMaterial(Object.assign(maps, { color: tint, roughness: 1, metalness: 0.88, envMapIntensity: 1.6 })), '#fff1d0', 0.9); };
      const add = (mesh, x, z, ry = 0) => { mesh.position.set(x, 0, z); mesh.rotation.y = ry; g.add(mesh); return mesh; };
      // 1. hyperboloid "tornado" tower (glass diagrid; colour-changing at night)
      { const pts = []; for (let i = 0; i <= 30; i++) { const y = i / 30 * 195; pts.push(new T.Vector2(14 * Math.sqrt(1 + ((y - 118) / 72) ** 2) * 0.92, y)); } const geo = new T.LatheGeometry(pts, 48); const tx = X.diagrid(); tx.repeat.set(16, 22); const m = night(new T.MeshStandardMaterial({ map: tx, roughness: 0.15, metalness: 0.6, envMapIntensity: 1.2 }), '#c04cff', 0.7); this.tornado = m; add(new T.Mesh(geo, m), 420, -1200); }
      // 2. cylindrical tower with a mashrabiya skin, domed top and spire
      { const grp = new T.Group(); const sk = X.mashrabiyaSkin(); sk.repeat.set(14, 40); const m = night(new T.MeshStandardMaterial({ map: sk, roughness: 0.4, metalness: 0.5 }), '#ffc77a', 0.6); const body = new T.Mesh(new T.CylinderGeometry(20, 23, 215, 40, 1, true), m); body.position.y = 107; grp.add(body); const dome = new T.Mesh(new T.SphereGeometry(20, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: C('#9fb4c4'), roughness: 0.25, metalness: 0.8 })); dome.scale.y = 1.4; dome.position.y = 215; grp.add(dome); const sp = new T.Mesh(new T.CylinderGeometry(0.6, 1.6, 34, 8), new T.MeshStandardMaterial({ color: C('#d8dde0'), metalness: 0.8, roughness: 0.3 })); sp.position.y = 258; grp.add(sp); add(grp, 560, -1460); }
      // 3. faceted blue tower with a gentle bulge and twist (+ crown and spire)
      { const geo = new T.CylinderGeometry(1, 1, 1, 8, 24, false); const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.5, r = 17 + 4.5 * Math.sin(Math.PI * Math.min(1, y * 1.05)) - 6 * Math.max(0, y - 0.88) / 0.12, a = Math.atan2(p.getZ(i), p.getX(i)) + y * 0.35; const rr = Math.hypot(p.getX(i), p.getZ(i)) > 0.01 ? r : 0; p.setXYZ(i, Math.cos(a) * rr, y * 205, Math.sin(a) * rr); } geo.computeVertexNormals(); const m = glass('#69a9e0', '#1e4f86', [10, 50]); const mesh = add(new T.Mesh(geo, m), 340, -1520); const sp = new T.Mesh(new T.CylinderGeometry(0.5, 1.2, 40, 6), new T.MeshStandardMaterial({ color: C('#d8dde0'), metalness: 0.8, roughness: 0.3 })); sp.position.y = 222; mesh.add(sp); }
      // 4. tower with a saucer near the top
      { const grp = new T.Group(); const m = glass('#4f86c0', '#1d3f66', [8, 46]); const b = new T.Mesh(new T.BoxGeometry(30, 170, 30), m); b.position.y = 85; grp.add(b); const disc = new T.Mesh(new T.CylinderGeometry(24, 18, 9, 40), new T.MeshStandardMaterial({ color: C('#c6d1d9'), metalness: 0.7, roughness: 0.3 })); disc.position.y = 168; grp.add(disc); const up = new T.Mesh(new T.CylinderGeometry(8, 10, 26, 24), m); up.position.y = 185; grp.add(up); add(grp, 470, -1700, 0.4); }
      // 5. twin towers with pointed hexagonal tops
      for (const [x, z, h] of [[640, -1100, 205], [690, -1150, 188]]) { const grp = new T.Group(); const m = glass('#5c7d96', '#23394d', [8, 48]); const b = new T.Mesh(new T.CylinderGeometry(15, 16, h, 6), m); b.position.y = h / 2; grp.add(b); const tip = new T.Mesh(new T.ConeGeometry(15, 34, 6), m); tip.position.y = h + 17; grp.add(tip); add(grp, x, z); }
      // 6. beige stepped tower with a spire
      { const grp = new T.Group(); const m = night(new T.MeshStandardMaterial(Object.assign(X.pbr('stonefac', { repeat: [10, 22], emissive: true }), { color: C('#efe4cf'), roughness: 1 })), '#ffd59a', 0.7); let y = 0; for (const [w, hh] of [[34, 90], [28, 40], [22, 25], [14, 18]]) { const b = new T.Mesh(new T.BoxGeometry(w, hh, w), m); b.position.y = y + hh / 2; y += hh; grp.add(b); } const sp = new T.Mesh(new T.ConeGeometry(4, 40, 4), m); sp.position.y = y + 20; grp.add(sp); add(grp, 250, -1350); }
      // 7. supporting glass towers to make the cluster
      const rnd = mulberry(77);
      for (let i = 0; i < 22; i++) { const h = 70 + rnd() * 130, w = 18 + rnd() * 16; const m = glass(['#6b9cc9', '#7aa6b9', '#5c87a8', '#8fb3c6'][i % 4], '#203a54', [w / 3 | 0, h / 3.8 | 0]); const b = new T.Mesh(new T.BoxGeometry(w, h, w * (0.7 + rnd() * 0.5)), m); b.position.y = h / 2; const mm = new T.Group(); mm.add(b); add(mm, 300 + rnd() * 520, -1000 - rnd() * 900, rnd()); }
      // aircraft warning lights on top of the tallest towers (visible at night)
      // 8. the spiral minaret (inspired by the Fanar cultural centre near Souq Waqif)
      { const grp = new T.Group(); const white = new T.MeshStandardMaterial({ color: C('#f1ece2'), roughness: 0.75 }); const core = new T.Mesh(new T.CylinderGeometry(3.2, 9.0, 36, 32), white); core.position.y = 18; grp.add(core);
        const pts = []; for (let i = 0; i <= 220; i++) { const t = i / 220, a = t * Math.PI * 2 * 6.5, r = lerp(9.6, 3.8, t); pts.push(new T.Vector3(Math.cos(a) * r, t * 34 + 0.8, Math.sin(a) * r)); }
        const ramp = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 600, 0.9, 5), white); grp.add(ramp);
        const top = new T.Mesh(new T.CylinderGeometry(2.2, 2.8, 9, 16), white); top.position.y = 40.5; grp.add(top); const band = new T.Mesh(new T.CylinderGeometry(2.35, 2.35, 1.4, 16), new T.MeshStandardMaterial({ color: C('#4d8fb0'), roughness: 0.5 })); band.position.y = 42; grp.add(band);
        const dome = new T.Mesh(new T.SphereGeometry(2.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), white); dome.position.y = 45; grp.add(dome); const fin = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, 3, 6), new T.MeshStandardMaterial({ color: C('#c9a44c'), metalness: 0.9, roughness: 0.3 })); fin.position.y = 48.5; grp.add(fin);
        const mosque = new T.Mesh(new T.BoxGeometry(34, 9, 22), white); mosque.position.set(-20, 4.5, 6); grp.add(mosque);
        grp.scale.setScalar(1.15); add(grp, -70, -520); this.fanar = grp; }
      for (const c of g.children) if (c !== this.fanar) { c.position.x = 150 + (c.position.x - 250) * 0.62; c.position.z = -420 + (c.position.z + 1000) * 0.55; c.scale.multiplyScalar(0.85); }
      // low distant city silhouettes on the left
      const cityM = new T.MeshStandardMaterial({ color: C('#cfc3ad'), roughness: 0.9 });
      for (let i = 0; i < 40; i++) { const h = 8 + rnd() * 28, w = 20 + rnd() * 40; const b = new T.Mesh(new T.BoxGeometry(w, h, w), cityM); b.position.set(-200 - rnd() * 600, h / 2, -200 - rnd() * 1800); g.add(b); }
    }
    // ---------------------------------------------------------------- zone plan
    setPlan(env, gateS) {
      this.plan.env = env; const b = [];
      if (env === 'tour') for (let k = 1; k + 1 < gateS.length; k += 2) b.push(Math.round(((gateS[k] + gateS[k + 1]) / 2) / SEG) * SEG);
      this.plan.bounds = b; this.plan.start = env === 'souq' ? 'souq' : 'corniche';
      for (const seg of this.segments.values()) this.freeSegment(seg); this.segments.clear();
    }
    zoneAt(s) { if (this.plan.env !== 'tour') return this.plan.start; let z = 0; for (const b of this.plan.bounds) if (s >= b) z++; return z % 2 ? 'souq' : 'corniche'; }
    isBoundary(i) { return this.plan.env === 'tour' && this.plan.bounds.includes(i * SEG); }
    surfaceAt(s) { return this.zoneAt(s) === 'souq' ? 'stone' : 'asphalt'; }
    // ---------------------------------------------------------------- segment streaming
    update(dt, distance, camera) {
      this.time += dt; U.time.value = this.time; this.distance = distance;
      this.track.position.z = distance;
      const i0 = Math.floor(distance / SEG) - BEHIND, i1 = Math.floor(distance / SEG) + AHEAD;
      for (const [i, seg] of this.segments) if (i < i0 || i > i1) { this.freeSegment(seg); this.segments.delete(i); }
      for (let i = i0; i <= i1; i++) if (!this.segments.has(i)) this.segments.set(i, this.buildSegment(i));
      // far planes follow the camera; water normals drift with the run
      this.water.position.z = camera.position.z - 1600; this.ground.position.z = camera.position.z - 1600; this.ground.position.y = -0.12;
      const wn = this.mWater.normalMap; wn.offset.set(this.time * 0.004, (this.time * 0.006 + distance / 30) % 1);
      this.skyline.position.z = distance * 0.28; this.sky.position.copy(camera.position);
      if (this.tornado) this.tornado.emissive.setHSL((this.time * 0.05) % 1, 0.7, 0.55);
      this.updateTraffic(dt, distance);
      for (const d of this.dhows) { const s = d.s; this.pDhow.set(d.ids, mtx(d.x, -0.45 + Math.sin(this.time * 0.9 + d.ph) * 0.12, -s, d.ry + Math.sin(this.time * 0.5 + d.ph) * 0.02, 1)); }
    }
    freeSegment(seg) { for (const [pool, id] of seg.items) pool.remove(id); for (const g of seg.glows) this.removeGlow(g); if (seg.dhow) { this.dhows = this.dhows.filter(d => d !== seg.dhow); } }
    buildSegment(i) {
      const s0 = i * SEG, zc = -(s0 + SEG / 2), rnd = mulberry(i * 9973 + 17), seg = { i, items: [], glows: [], zone: this.zoneAt(s0 + 1) };
      const put = (pool, m, color) => { const id = pool.add(m, color); if (Array.isArray(id)) seg.items.push(...id.map((x, k) => [pool.pools[k], x])); else seg.items.push([pool, id]); };
      if (this.isBoundary(i)) { put(this.pGate, mtx(0, 0, -(s0 + 2))); }
      if (seg.zone === 'corniche') this.buildCorniche(seg, s0, zc, rnd, put); else this.buildSouq(seg, s0, zc, rnd, put);
      return seg;
    }
    buildCorniche(seg, s0, zc, rnd, put) {
      put(this.pRoad, mtx(0, 0.005, zc)); put(this.pRoad, mtx(-11.5, 0.005, zc));
      for (const x of [4.05, -4.05, -7.55, -15.55]) put(this.pCurb, mtx(x, 0.085, zc));
      put(this.pPromenade, mtx(8.7, 0.08, zc)); put(this.pMedian, mtx(-5.8, 0.1, zc)); put(this.pSidewalk, mtx(-17.9, 0.08, zc));
      put(this.pSeawall, mtx(13.55, -0.49, zc)); put(this.pRail, mtx(13.25, 1.16, zc)); put(this.pRail, mtx(13.25, 0.72, zc));
      for (let k = 0; k < 8; k++) put(this.pPost, mtx(13.25, 0.16, -(s0 + k * 2.5 + 0.5)));
      // palms: promenade (white-painted bases), median, city sidewalk
      for (const [x, off] of (this.q === 'low' ? [[6.3, 5], [6.3, 15], [-5.8, 7], [-17.6, 12]] : [[6.3, 5], [6.3, 15], [11.4, 10], [-5.8, 2], [-5.8, 12], [-17.6, 7]])) { const s = 0.88 + rnd() * 0.25; put(this.pPalm, mtx(x + (rnd() - 0.5) * 0.4, x > -10 && x < -4 ? 0.2 : 0.16, -(s0 + off + rnd() * 2), rnd() * 6.28, s)); }
      for (const off of [7, 17]) put(this.pShrub, mtx(-5.8 + (rnd() - 0.5), 0.2, -(s0 + off), rnd() * 6, 0.8 + rnd() * 0.5));
      // lamps (double-arm on the promenade edge, single-arm on the far sidewalk) + Qatar flags + night light pools
      const lz = -(s0 + 10); put(this.pLamp2, mtx(4.55, 0.16, lz)); seg.glows.push(this.addGlow(4.55 - 1.75, 8.75, lz), this.addGlow(4.55 + 1.75, 8.75, lz));
      put(this.pDecal, mtx(2.8, 0.03, lz, 0, 9, 1, 9)); put(this.pDecal, mtx(6.3, 0.2, lz, 0, 8, 1, 8));
      if (Math.floor(s0 / SEG) % 2 === 0) put(this.pFlag, mtx(4.55, 0.16, lz));
      put(this.pLamp1, mtx(-15.9, 0.16, -(s0 + 0))); seg.glows.push(this.addGlow(-15.9 + 1.75, 8.75, -(s0)));
      put(this.pLamp1, mtx(-7.6, 0.2, -(s0 + 10), Math.PI)); seg.glows.push(this.addGlow(-7.6 - 1.75, 8.75, -(s0 + 10)));
      if (rnd() < 0.35) put(this.pBench, mtx(10.2, 0.16, -(s0 + 4 + rnd() * 10), -Math.PI / 2));
      // city buildings (left)
      const kinds = ['stone', 'glass', 'mash'], k = kinds[(rnd() * 3) | 0], h = k === 'glass' ? 30 + rnd() * 45 : 12 + rnd() * 20, d = 16 + rnd() * 12;
      const tint = new T.Color().setHSL(0.09 + rnd() * 0.04, 0.12 + rnd() * 0.15, 0.82 + rnd() * 0.12);
      // podium with shopfronts, the tower body above it, a cornice band and rooftop plant
      const bz = zc, bw = SEG - 2.5 - rnd() * 5, bx = -21 - d / 2, pod = 4.5;
      put(this.pPodium, mtx(bx + 0.35, 0, bz, 0, d + 0.7, pod, bw + 0.5), new T.Color(1, 1, 1));
      put(this.pBld[k], mtx(bx, pod, bz, 0, d, h - pod, bw), k === 'glass' ? new T.Color(1, 1, 1) : tint);
      put(this.pRoof, mtx(bx, h, bz, 0, d + 0.3, 0.55, bw + 0.3), tint);
      put(this.pRoof, mtx(bx, pod, bz, 0, d + 0.9, 0.35, bw + 0.7), tint);
      if (k === 'glass' && rnd() < 0.5) put(this.pBld.glass, mtx(bx - 1.5, h, bz, 0, d - 4, 8 + rnd() * 10, bw - 5), new T.Color(1, 1, 1));
      else { put(this.pRoof, mtx(bx - 2, h + 0.55, bz + 2, 0, 4, 2.4, 4.5), tint); put(this.pRoof, mtx(bx + 3, h + 0.55, bz - 3, 0, 2.2, 1.4, 2.6), tint); }
      // a dhow on the bay now and then
      if (rnd() < 0.28) { const d0 = { s: s0 + rnd() * SEG, x: 30 + rnd() * 70, ry: rnd() * 6.28, ph: rnd() * 6 }; d0.ids = this.pDhow.add(mtx(d0.x, -0.45, -d0.s, d0.ry)); seg.items.push(...d0.ids.map((x, q) => [this.pDhow.pools[q], x])); seg.dhow = d0; this.dhows.push(d0); }
    }
    buildSouq(seg, s0, zc, rnd, put) {
      put(this.pStone, mtx(0, 0.004, zc));
      const Lm = 6.6;
      for (const side of [-1, 1]) {
        for (let m = 0; m < 3; m++) {
          const z0 = s0 + m * Lm + 0.1, v = (rnd() < 0.55 ? 0 : 1), tone = new T.Color().setHSL(0.085 + rnd() * 0.02, 0.28 + rnd() * 0.12, 0.62 + rnd() * 0.12);
          // left side: facade at x = −7.2 facing +X; right side: rotated to face −X
          const x = side * 7.2, ry = side < 0 ? 0 : Math.PI, zz = side < 0 ? -(z0 + Lm) : -z0;
          put(this.souqMods[v], mtx(x, 0, zz, ry, 1, 0.95 + rnd() * 0.12, 1), tone);
          // lanterns hang in the arches, signs above them
          const cz = v === 0 ? [1.65, 4.95] : [3.3];
          for (const c of cz) { const lz = -(z0 + c); put(this.pLantern, mtx(side * 6.95, 3.05, lz)); seg.glows.push(this.addGlow(side * 6.95, 3.15, lz)); put(this.pDecal, mtx(side * 5.6, 0.02, lz, 0, 4.5, 1, 4.5)); }
          if (rnd() < 0.7) { const sk = (rnd() * this.pSigns.length) | 0; put(this.pSigns[sk], mtx(side * 6.98, 4.05, -(z0 + cz[0]), side < 0 ? Math.PI / 2 : -Math.PI / 2)); }
        }
        if (rnd() < 0.45) put(this.pUmb, mtx(side * 5.3, 0, -(s0 + 4 + rnd() * 12), rnd() * 6));
      }
      if (rnd() < 0.25) put(this.pPalm, mtx((rnd() < 0.5 ? -1 : 1) * 5.4, 0, -(s0 + rnd() * SEG), rnd() * 6, 0.7));
    }
    // ---------------------------------------------------------------- traffic on the opposite carriageway (Corniche only)
    updateTraffic(dt, distance) {
      this.nextCar -= dt;
      const sAhead = distance + 260;
      if (this.nextCar <= 0 && this.zoneAt(sAhead) === 'corniche' && this.zoneAt(distance) === 'corniche') {
        this.nextCar = 1.2 + Math.random() * 2.4;
        const suv = Math.random() < 0.6, pool = suv ? this.pTrafficSUV : this.pTrafficSedan;
        const colors = ['#e4e4e1', '#e4e4e1', '#e4e4e1', '#b9bdc2', '#1c1d20', '#2c3e57', '#6e1029', '#7a7f85'];
        const col = C(colors[(Math.random() * colors.length) | 0]);
        const lane = [-9.0, -11.5, -14.0][(Math.random() * 3) | 0];
        const car = { pool, s: sAhead, x: lane, v: 13 + Math.random() * 5, passed: false };
        car.ids = pool.add(this._carMtx(car, distance), col); if (car.ids[0] >= 0) this.traffic.push(car);
      }
      for (let k = this.traffic.length - 1; k >= 0; k--) {
        const c = this.traffic[k]; c.s -= c.v * dt;
        if (!c.passed && c.s < distance + 3) { c.passed = true; if (this.onCarPass) this.onCarPass(c); }
        if (c.s < distance - 40 || this.zoneAt(c.s) !== 'corniche') { c.pool.remove(c.ids); this.traffic.splice(k, 1); continue; }
        c.pool.set(c.ids, this._carMtx(c, distance));
      }
    }
    _carMtx(c, distance) { return mtx(c.x, 0, -(c.s - distance), 0, 1); } // models face +Z: oncoming cars drive towards the camera, headlights first
    clearTraffic() { for (const c of this.traffic) c.pool.remove(c.ids); this.traffic = []; }
    render(camera) { // far pass with its own camera range (depth precision), then the near world; optional photo grade
      const r = this.renderer, bc = this.bgCam || (this.bgCam = new T.PerspectiveCamera(60, 1, 2, 9000));
      bc.position.copy(camera.position); bc.quaternion.copy(camera.quaternion); if (bc.fov !== camera.fov || bc.aspect !== camera.aspect) { bc.fov = camera.fov; bc.aspect = camera.aspect; bc.updateProjectionMatrix(); }
      const post = this.q !== 'low' && this.postOK !== false && this.ensurePost();
      r.setRenderTarget(post ? this.post.rt : null);
      r.autoClear = false; r.clear(); r.render(this.bg, bc); r.clearDepth(); r.render(this.scene, camera);
      if (!post) return;
      const P = this.post;
      if (P.bloom) { // bright pass → quarter res, separable blur
        P.quad.material = P.mBright; P.mBright.uniforms.tex.value = P.rt.texture; r.setRenderTarget(P.q1); r.render(P.scene, P.cam);
        P.quad.material = P.mBlur; P.mBlur.uniforms.tex.value = P.q1.texture; P.mBlur.uniforms.dir.value.set(1.6 / P.q1.width, 0); r.setRenderTarget(P.q2); r.render(P.scene, P.cam);
        P.mBlur.uniforms.tex.value = P.q2.texture; P.mBlur.uniforms.dir.value.set(0, 1.6 / P.q1.height); r.setRenderTarget(P.q1); r.render(P.scene, P.cam);
      }
      P.quad.material = P.mGrade; P.mGrade.uniforms.tex.value = P.rt.texture; P.mGrade.uniforms.bloom.value = P.q1.texture; P.mGrade.uniforms.bloomK.value = P.bloom ? 0.22 : 0;
      P.mGrade.uniforms.night.value = U.night.value; P.mGrade.uniforms.time.value = this.time;
      r.setRenderTarget(null); r.render(P.scene, P.cam);
    }
    // display-referred photographic grade: gentle S-curve, warm/cool split toning, saturation, vignette, bloom, dither
    ensurePost() {
      const r = this.renderer, gl = r.getContext(), sz = r.getDrawingBufferSize(this._sz || (this._sz = new T.Vector2()));
      if (!this.post) {
        if (!r.capabilities.isWebGL2 && this.q !== 'high') { this.postOK = false; return false; }
        const quadV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
        const mk = (frag, uniforms) => new T.ShaderMaterial({ uniforms, vertexShader: quadV, fragmentShader: frag, depthTest: false, depthWrite: false });
        const P = this.post = { scene: new T.Scene(), cam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), bloom: this.q === 'high' };
        P.quad = new T.Mesh(new T.PlaneGeometry(2, 2)); P.quad.frustumCulled = false; P.scene.add(P.quad);
        P.mBright = mk('uniform sampler2D tex; varying vec2 vUv; void main(){ vec3 c = texture2D(tex, vUv).rgb; float l = dot(c, vec3(0.299, 0.587, 0.114)); gl_FragColor = vec4(c * smoothstep(0.86, 1.0, l), 1.0); }', { tex: { value: null } });
        P.mBlur = mk(`uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
          void main(){ vec3 s = texture2D(tex, vUv).rgb * 0.227027;
            s += (texture2D(tex, vUv + dir * 1.3846).rgb + texture2D(tex, vUv - dir * 1.3846).rgb) * 0.3162162;
            s += (texture2D(tex, vUv + dir * 3.2308).rgb + texture2D(tex, vUv - dir * 3.2308).rgb) * 0.0702703;
            gl_FragColor = vec4(s, 1.0); }`, { tex: { value: null }, dir: { value: new T.Vector2() } });
        P.mGrade = mk(`uniform sampler2D tex, bloom; uniform float bloomK, night, time; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
          void main(){
            vec3 c = texture2D(tex, vUv).rgb + texture2D(bloom, vUv).rgb * bloomK;
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, mix(1.1, 1.02, night));                       // saturation
            c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);                         // soft S-curve (contrast)
            vec3 warm = vec3(1.03, 1.0, 0.95), cool = vec3(0.96, 0.99, 1.05);
            c *= mix(cool, warm, smoothstep(0.15, 0.75, l)) * 0.5 + 0.5;     // split toning
            vec2 q = vUv - 0.5; c *= 1.0 - 0.28 * dot(q, q) * 2.0;              // vignette
            c += (h(gl_FragCoord.xy) - 0.5) / 255.0;                           // dither (no banding in the sky)
            gl_FragColor = vec4(c, 1.0); }`, { tex: { value: null }, bloom: { value: null }, bloomK: { value: 0 }, night: { value: 0 }, time: { value: 0 } });
        const opt = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, encoding: T.sRGBEncoding, depthBuffer: true, stencilBuffer: false };
        P.rt = r.capabilities.isWebGL2 ? new T.WebGLMultisampleRenderTarget(sz.x, sz.y, opt) : new T.WebGLRenderTarget(sz.x, sz.y, opt);
        if (P.rt.samples !== undefined) P.rt.samples = this.q === 'high' ? 4 : 2;
        const qo = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: false, stencilBuffer: false };
        P.q1 = new T.WebGLRenderTarget(4, 4, qo); P.q2 = new T.WebGLRenderTarget(4, 4, qo); P.w = 0; P.h = 0;
      }
      const P = this.post;
      if (P.w !== sz.x || P.h !== sz.y) { P.w = sz.x; P.h = sz.y; P.rt.setSize(sz.x, sz.y); const qw = Math.max(4, sz.x >> 2), qh = Math.max(4, sz.y >> 2); P.q1.setSize(qw, qh); P.q2.setSize(qw, qh); }
      return true;
    }
  }
  function curbGeometry(w, h, L) { // top + both vertical faces, v runs along the curb (1 m black / 1 m white)
    const pos = [], uv = [], idx = []; const q = (a, b, c, d, ua, ub, uc, ud) => { const n = pos.length / 3; pos.push(...a, ...b, ...c, ...d); uv.push(...ua, ...ub, ...uc, ...ud); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); };
    const x0 = -w / 2, x1 = w / 2, z0 = -L / 2, z1 = L / 2, V = L / 2;
    q([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 0], [1, 0], [1, V], [0, V]);
    q([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [0, 0], [0, V], [1, V], [1, 0]);
    q([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [0, V], [0, 0], [1, 0], [1, V]);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function shopTexture(emissive) { // shop interior seen through the arcades: shelves with goods in deep shade, warm lamp light
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = emissive ? '#1c1206' : '#2e2216'; x.fillRect(0, 0, 256, 128);
    const g = x.createRadialGradient(128, 30, 5, 128, 40, 160); g.addColorStop(0, emissive ? '#ffcf8a' : '#7a5a3a'); g.addColorStop(1, emissive ? '#1c1206' : '#2e2216'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    for (let r = 0; r < 4; r++) { x.fillStyle = emissive ? 'rgba(0,0,0,0.5)' : '#1e150c'; x.fillRect(0, 30 + r * 24, 256, 4); for (let k = 0; k < 22; k++) { x.fillStyle = ['#7a4a2a', '#8c6a3a', '#5a2a1a', '#9a8a68', '#4a5a2a', '#6a3a4a'][(k * 7 + r * 3) % 6]; x.globalAlpha = emissive ? 0.25 : 0.85; const w = 6 + ((k * 13 + r * 5) % 7); x.fillRect(4 + k * 11.5, 14 + r * 24 + ((k * 3) % 5), w, 14 - ((k * 3) % 5)); x.globalAlpha = 1; } }
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  root.QRWorld = { World, SEG, mtx, PropType, Pool };
})(typeof window !== 'undefined' ? window : globalThis);
