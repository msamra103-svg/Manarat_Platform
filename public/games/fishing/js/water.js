/* صيد الأسماك V24 — sky, Gerstner sea surface, underwater optics, seabed with caustics, light shafts.
 * Original shader code for this project. Wave parameters are taken from FishingPhysics.Sea so the
 * rendered surface and the physics (boat, float, fish clamps) share exactly the same waves.
 */
(function (root) {
  'use strict';
  const T = root.THREE, PH = root.FishingPhysics;
  const SUN_DIR = new T.Vector3(-0.82, 0.34, -0.46).normalize();

  /* ---------- shared uniforms (camera, time, light) ---------- */
  const U = {
    uTime: { value: 0 }, uCamPos: { value: new T.Vector3() }, uSunDir: { value: SUN_DIR.clone() },
    uSunColor: { value: new T.Color('#ffd7a3') }, uWaterLight: { value: 1 }, uCaustics: { value: 1 },
    uSkyZenith: { value: new T.Color('#1d5cb6') }, uSkyHorizon: { value: new T.Color('#bcd5e6') }, uHaze: { value: new T.Color('#d9e4ea') }
  };

  const GLSL_COMMON = `
  float h12(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(h12(i), h12(i+vec2(1.,0.)), u.x), mix(h12(i+vec2(0.,1.)), h12(i+vec2(1.,1.)), u.x), u.y); }
  float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
  vec3 skyColorK(vec3 d, vec3 sunDir, vec3 zen, vec3 hor, vec3 sunCol, float cloudK){
    d = normalize(d); float y = max(d.y, -0.05);
    float g = pow(clamp(1.0 - y, 0.0, 1.0), 5.0);
    vec3 col = mix(zen, hor, g);
    float sd = max(dot(d, sunDir), 0.0);
    col += sunCol * (pow(sd, 8.0) * 0.22 + pow(sd, 64.0) * 0.45) * (0.6 + 0.4 * g);
    col = mix(col, vec3(0.93, 0.88, 0.80), pow(clamp(1.0 - abs(d.y) * 9.0, 0.0, 1.0), 2.0) * 0.35);
    vec2 cp = d.xz / (d.y + 0.18) * 1.6;
    float c = smoothstep(0.56, 0.80, fbm(cp * 0.9 + vec2(3.0, 1.0)));
    c *= smoothstep(0.0, 0.18, d.y) * (1.0 - smoothstep(0.55, 0.95, d.y));
    vec3 cloud = mix(vec3(1.0, 0.93, 0.86), sunCol * 1.15, pow(sd, 3.0)) * (0.82 + 0.25 * fbm(cp * 3.0));
    col = mix(col, cloud, c * 0.55 * cloudK);
    return col;
  }
  vec3 skyColor(vec3 d, vec3 sunDir, vec3 zen, vec3 hor, vec3 sunCol){ return skyColorK(d, sunDir, zen, hor, sunCol, 1.0); }`;

  /* ---------- caustics (two animated Worley layers; cell borders = bright light lines) ---------- */
  const GLSL_CAUSTIC = `
  vec2 cRand(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  float worleyEdge(vec2 p, float t){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
    for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g = vec2(float(x), float(y)); vec2 o = cRand(i + g); o = 0.5 + 0.45 * sin(t + 6.2831 * o); float d = length(g + o - f); if(d < d1){ d2 = d1; d1 = d; } else if(d < d2) d2 = d; }
    return d2 - d1; }
  float caustic(vec2 p, float t){ float a = worleyEdge(p * 0.85, t * 0.9), b = worleyEdge(p * 1.35 + 3.7, t * 1.25 + 2.0);
    return pow(1.0 - smoothstep(0.0, 0.16, a), 3.0) * 0.7 + pow(1.0 - smoothstep(0.0, 0.12, b), 3.0) * 0.5; }`;

  /* ---------- underwater optics patch for MeshStandardMaterial ---------- */
  function patchOptics(material, opts = {}) {
    const key = 'optics' + (opts.swim ? '+swim' : '') + (opts.sway ? '+sway' : '') + (opts.caustics === false ? '-c' : '') + (opts.hull ? '+hull' : '');
    material.customProgramCacheKey = () => key;
    const prior = material.onBeforeCompile && material.onBeforeCompile.__fishing ? null : material.onBeforeCompile;
    const fn = shader => {
      if (prior) prior(shader);
      Object.assign(shader.uniforms, { uCamPos: U.uCamPos, uTime: U.uTime, uSunDir: U.uSunDir, uSunColor: U.uSunColor, uWaterLight: U.uWaterLight, uCaustics: U.uCaustics });
      if (opts.swim) { shader.uniforms.uSwim = opts.swim; }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWaterWorld;\nuniform float uTime;' + (opts.swim ? '\nuniform vec4 uSwim;' : '') + (opts.sway ? '\nattribute float aSway;' : ''))
        .replace('#include <begin_vertex>', '#include <begin_vertex>' + (opts.swim ? `
          { float L = uSwim.w; float s = clamp((L*0.5 - transformed.z) / L, 0.0, 1.0);
            float lat = uSwim.y * L * s * s * sin(uSwim.x - s * 4.2) + uSwim.z * L * s * s;
            transformed.x += lat; }` : '') + (opts.sway ? `
          { float k = position.y * position.y; vec4 ip = instanceMatrix * vec4(0.,0.,0.,1.);
            transformed.x += k * 0.55 * sin(uTime * 1.1 + ip.x * 0.7 + ip.z * 0.4);
            transformed.z += k * 0.35 * sin(uTime * 0.8 + ip.z * 0.9); }` : ''))
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 wwp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wwp = instanceMatrix * wwp;
          #endif
          vWaterWorld = (modelMatrix * wwp).xyz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWaterWorld;\nuniform vec3 uCamPos, uSunDir, uSunColor;\nuniform float uTime, uWaterLight, uCaustics;\n' + GLSL_CAUSTIC)
        .replace('#include <fog_fragment>', `{
          vec3 wpos = vWaterWorld; float camY = uCamPos.y, dist = distance(uCamPos, wpos), path = 0.0;
          if (camY > 0.0) { if (wpos.y < 0.0) path = dist * (-wpos.y) / max(camY - wpos.y, 1e-3); }
          else { path = (wpos.y < 0.0) ? dist : dist * (-camY) / max(wpos.y - camY, 1e-3); }
          float depthB = max(-wpos.y, 0.0);
          vec3 sigma = vec3(0.40, 0.095, 0.072);
          vec3 lightT = exp(-sigma * depthB * 0.8);
          if (wpos.y < 0.02) {
            ${opts.caustics === false ? '' : `vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
            float up = clamp(nW.y * 0.8 + 0.2, 0.0, 1.0);
            float cs = caustic(wpos.xz * 0.9 + uSunDir.xz * depthB * 0.35, uTime * 1.1) * exp(-depthB * 0.18);
            gl_FragColor.rgb += diffuseColor.rgb * uSunColor * cs * up * 0.9 * uCaustics;`}
            gl_FragColor.rgb *= mix(vec3(1.0), lightT, smoothstep(0.02, -0.25, wpos.y));
          }
          vec3 viewT = exp(-sigma * path);
          vec3 scatter = vec3(0.03, 0.235, 0.265) * uWaterLight;
          gl_FragColor.rgb = gl_FragColor.rgb * viewT + scatter * (1.0 - viewT);
        }
        #include <fog_fragment>`);
    };
    fn.__fishing = true; material.onBeforeCompile = fn; material.needsUpdate = true; return material;
  }

  /* ---------- sky dome ---------- */
  function createSky() {
    const mat = new T.ShaderMaterial({
      uniforms: { uSunDir: U.uSunDir, uSkyZenith: U.uSkyZenith, uSkyHorizon: U.uSkyHorizon, uSunColor: U.uSunColor, uUnder: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: GLSL_COMMON + `uniform vec3 uSunDir, uSkyZenith, uSkyHorizon, uSunColor; uniform float uUnder; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); vec3 c = skyColor(d, uSunDir, uSkyZenith, uSkyHorizon, uSunColor);
          float sd = dot(d, uSunDir); c += uSunColor * smoothstep(0.9993, 0.99975, sd) * 6.0;
          if (d.y < 0.0) c = mix(c, vec3(0.06, 0.27, 0.40), smoothstep(0.0, -0.08, d.y));
          if (uUnder > 0.5) c = vec3(0.03, 0.235, 0.265) * mix(0.55, 1.15, smoothstep(-0.6, 0.6, d.y));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`,
      side: T.BackSide, depthWrite: false, depthTest: true
    });
    const sky = new T.Mesh(new T.SphereGeometry(900, 48, 24), mat); sky.userData.uUnder = mat.uniforms.uUnder; sky.renderOrder = -10; sky.frustumCulled = false; sky.name = 'sky'; return sky;
  }

  /* ---------- ocean normal map (assets/textures/water-normals.js, data URI so file:// works) ---------- */
  let nmTex = null;
  function normalMap() {
    if (nmTex) return nmTex;
    nmTex = new T.Texture(); nmTex.wrapS = nmTex.wrapT = T.RepeatWrapping; nmTex.anisotropy = 8; nmTex.minFilter = T.LinearMipmapLinearFilter;
    const src = root.FISHING_WATER_NORMALS;
    if (src) { const img = new Image(); img.onload = () => { nmTex.image = img; nmTex.needsUpdate = true; }; img.src = src; }
    else { const c = document.createElement('canvas'); c.width = c.height = 2; const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 2, 2); nmTex.image = c; nmTex.needsUpdate = true; }
    return nmTex;
  }

  /* ---------- sea surface ---------- */
  function seaGeometry(quality) {
    // polar grid: dense around the boat / casting zone, sparse towards the horizon
    const rings = quality === 'low' ? 70 : quality === 'medium' ? 110 : 150, seg = quality === 'low' ? 96 : quality === 'medium' ? 144 : 200;
    const pos = [], idx = [], centre = [0, 0, -7];
    pos.push(centre[0], 0, centre[2]);
    for (let r = 1; r <= rings; r++) {
      const x = r / rings, rr = 40 * x + 1300 * Math.pow(x, 5);
      for (let s = 0; s < seg; s++) { const a = s / seg * Math.PI * 2; pos.push(centre[0] + Math.cos(a) * rr, 0, centre[2] + Math.sin(a) * rr); }
    }
    for (let s = 0; s < seg; s++) idx.push(0, 1 + (s + 1) % seg, 1 + s);
    for (let r = 1; r < rings; r++) for (let s = 0; s < seg; s++) {
      const a = 1 + (r - 1) * seg + s, b = 1 + (r - 1) * seg + (s + 1) % seg, c = 1 + r * seg + s, d = 1 + r * seg + (s + 1) % seg;
      idx.push(a, b, c, b, d, c);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeBoundingSphere(); g.boundingSphere.radius = 5000; return g;
  }
  function createSea(quality) {
    const W = PH.Sea.waves, N = W.length;
    const uW = W.map(w => new T.Vector4(w.dir[0], w.dir[1], w.k, w.omega)), uA = W.map(w => new T.Vector2(w.amp, w.steep / (w.k * N)));
    const ripples = Array.from({ length: 10 }, () => new T.Vector4(0, 0, -100, 0));
    const uniforms = Object.assign({ uW: { value: uW }, uA: { value: uA }, uScale: { value: PH.Sea.scale }, uRip: { value: ripples }, uBoat: { value: new T.Vector4(0, 0, 0, 0) },
      uDeep: { value: new T.Color('#06304d') }, uShallow: { value: new T.Color('#0f6f86') }, uSSS: { value: new T.Color('#1fa59a') }, uFog: { value: new T.Color('#d4e1ea') }, uFogDensity: { value: 0.0011 }, uDetail: { value: quality === 'low' ? 0.6 : 1 },
      uNormalMap: { value: normalMap() }, uReflect: { value: null }, uReflMat: { value: new T.Matrix4() }, uReflOn: { value: 0 } }, U);
    const mat = new T.ShaderMaterial({
      uniforms, transparent: true, side: T.DoubleSide, depthWrite: true,
      vertexShader: `uniform float uTime, uScale; uniform vec4 uW[${N}]; uniform vec2 uA[${N}];
        varying vec3 vWorld; varying vec3 vN; varying float vH;
        void main(){ vec3 p = position; float fade = 1.0 - smoothstep(90.0, 380.0, length(p.xz - vec2(0.0, -7.0)));
          vec3 disp = vec3(0.0); float nx = 0.0, nz = 0.0, ny = 0.0;
          for (int i = 0; i < ${N}; i++) { vec2 d = uW[i].xy; float k = uW[i].z, w = uW[i].w; float a = uA[i].x * uScale * fade, qa = uA[i].y * fade;
            float ph = k * dot(d, p.xz) - w * uTime; float c = cos(ph), s = sin(ph);
            disp.x += qa * d.x * c; disp.z += qa * d.y * c; disp.y += a * s;
            nx += d.x * k * a * c; nz += d.y * k * a * c; ny += k * qa * s; }
          vec3 wp = p + disp; vWorld = wp; vH = disp.y; vN = normalize(vec3(-nx, 1.0 - ny, -nz));
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
      fragmentShader: GLSL_COMMON + `
        uniform float uTime, uDetail, uFogDensity; uniform vec3 uCamPos, uSunDir, uSunColor, uSkyZenith, uSkyHorizon, uDeep, uShallow, uFog; uniform vec4 uRip[10]; uniform vec4 uBoat;
        varying vec3 vWorld; varying vec3 vN; varying float vH;
        uniform sampler2D uNormalMap, uReflect; uniform mat4 uReflMat; uniform float uReflOn; uniform vec3 uSSS;
        vec2 nmap(vec2 uv){ return texture2D(uNormalMap, uv).rg * 2.0 - 1.0; }
        vec2 detailGrad(vec2 xz, float dist){
          // FFT wind-wave normal map (12 m tile) at three scales scrolling with the breeze; mip-mapping removes far aliasing
          vec2 w1 = vec2(0.9, 0.42) * uTime * 0.045, w2 = vec2(-0.35, 0.94) * uTime * 0.07;
          vec2 g = nmap(xz / 12.0 + w1) * 0.26 + nmap(mat2(0.8, -0.6, 0.6, 0.8) * xz / 4.1 + w2) * 0.24 + nmap(xz / 37.0 - w1 * 0.4) * 0.16;
          return g * mix(1.0, 0.5, smoothstep(20.0, 200.0, dist)) * uDetail; }
        void main(){
          vec3 V = normalize(uCamPos - vWorld); float dist = length(uCamPos - vWorld); vec2 xz = vWorld.xz;
          vec2 g = detailGrad(xz, dist); float foam = 0.0;
          for (int i = 0; i < 10; i++) { vec4 r = uRip[i]; float age = uTime - r.z; if (age < 0.0 || age > 6.0 || r.w <= 0.0) continue;
            vec2 dd = xz - r.xy; float rl = length(dd) + 1e-4; float front = 0.12 + age * (0.55 + r.w * 0.5); float x = rl - front;
            float env = exp(-x * x * 9.0) * exp(-age * 0.75) * r.w; g += (dd / rl) * env * cos(x * 22.0) * 0.32;
            foam += env * exp(-age * 2.6) * smoothstep(0.3, 0.7, r.w) * 0.8; foam += r.w * smoothstep(0.3, 0.0, rl) * exp(-age * 3.5) * smoothstep(0.3, 0.7, r.w) * 0.7; }
          vec3 N = normalize(vN + vec3(g.x, 0.0, -g.y));
          // boat lapping foam
          float cy = cos(uBoat.z), sy = sin(uBoat.z); vec2 bl = xz - uBoat.xy; bl = vec2(bl.x * cy - bl.y * sy, bl.x * sy + bl.y * cy);
          float be = length(bl / vec2(2.82, 1.04)); float lap = smoothstep(1.22, 1.0, be) * smoothstep(0.9, 1.0, be);
          foam += lap * smoothstep(0.45, 0.8, fbm(xz * 5.0 + uTime * 0.5)) * 0.55;
          foam = clamp(min(foam, 1.4) * smoothstep(0.32, 0.72, fbm(xz * 6.5 - uTime * 0.5)) * 1.3 * (0.6 + 0.5 * fbm(xz * 21.0 + uTime * 0.3)), 0.0, 0.92); // broken, bubbly white water
          vec3 col; float alpha;
          if (gl_FrontFacing) {
            float ndv = max(dot(N, V), 0.0); float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
            vec3 R = reflect(-V, N); R.y = abs(R.y) + 0.02;
            vec3 refl = skyColorK(R, uSunDir, uSkyZenith, uSkyHorizon, uSunColor, 0.25);
            if (uReflOn > 0.5) {   // planar mirror of boat, angler and coast, rippled by the surface normal
              vec4 rc = uReflMat * vec4(vWorld.x, 0.0, vWorld.z, 1.0); vec2 ruv = rc.xy / rc.w + (N.xz - vN.xz * 0.6) * vec2(0.05, 0.05) / (1.0 + dist * 0.02);
              vec4 rs = texture2D(uReflect, ruv); refl = mix(refl, rs.rgb, rs.a * smoothstep(0.0, 0.02, min(ruv.y, 1.0 - ruv.y)));
            }
            float sd = max(dot(R, uSunDir), 0.0);
            vec3 spec = uSunColor * (pow(sd, 1400.0) * 40.0 + pow(sd, 160.0) * 1.4 + pow(sd, 22.0) * 0.06);
            float grazing = 1.0 - ndv; float shore = smoothstep(-300.0, -420.0, vWorld.z);
            vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.7, grazing)); body = mix(body, vec3(0.20, 0.60, 0.62), shore * 0.5);
            body *= 0.6 + 0.4 * max(dot(N, uSunDir), 0.0);
            // sub-surface light through the thin wave crests facing away from the sun
            float thin = clamp(vH * 3.0 + 0.35, 0.0, 1.0) * pow(max(dot(-V, uSunDir) * 0.5 + 0.5 + (N.y - 1.0) * 0.0, 0.0), 2.0);
            body += uSSS * thin * 0.35 * (1.0 - smoothstep(30.0, 120.0, dist));
            col = mix(body, refl, F) + spec;
            col = mix(col, vec3(0.94, 0.96, 0.95) * (0.75 + 0.25 * max(dot(N, uSunDir), 0.0)), foam);
            alpha = clamp(mix(0.62, 0.98, F) + foam + smoothstep(18.0, 70.0, dist), 0.0, 1.0);
            float fogF = 1.0 - exp(-pow(uFogDensity * dist, 2.0)); col = mix(col, uFog, fogF);
          } else {
            vec3 Nu = -N; float c = dot(-V, -Nu);
            float window = smoothstep(0.62, 0.70, c);
            vec3 tr = refract(-V, Nu, 1.33);
            vec3 skyc = skyColor(length(tr) > 0.0 ? tr : vec3(0.0, 1.0, 0.0), uSunDir, uSkyZenith, uSkyHorizon, uSunColor) * 1.15;
            skyc += uSunColor * pow(max(dot(tr, uSunDir), 0.0), 40.0) * 2.5;
            vec3 tir = vec3(0.05, 0.27, 0.31) * (0.7 + 0.3 * fbm(xz * 0.5 + uTime * 0.1)) * (0.8 + 1.6 * abs(g.x + g.y) * (1.0 - smoothstep(4.0, 30.0, dist)));
            col = mix(tir, mix(vec3(0.5, 0.85, 0.85), skyc, 0.6), window);
            col = mix(col, vec3(0.03, 0.235, 0.265) * 1.1, 1.0 - exp(-dist * 0.16)); col += foam * 0.2;
            alpha = 0.97;
          }
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    const mesh = new T.Mesh(seaGeometry(quality), mat); mesh.frustumCulled = false; mesh.name = 'sea'; mesh.renderOrder = 2;
    mesh.userData.setRipples = list => { for (let i = 0; i < 10; i++) { const r = list[list.length - 1 - i]; if (r) ripples[i].set(r.x, r.z, r.t0, r.amp); else ripples[i].set(0, 0, -100, 0); } };
    return mesh;
  }

  /* ---------- procedural sand texture ---------- */
  function sandTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#c9b48a'; x.fillRect(0, 0, 512, 512);
    const img = x.getImageData(0, 0, 512, 512), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const p = i / 4, px = p % 512, py = (p / 512) | 0; const r = Math.sin(px * 0.11 + Math.sin(py * 0.03) * 3) * 0.5 + 0.5; const n = (Math.random() - 0.5) * 34 + r * 16; d[i] += n; d[i + 1] += n * 0.95; d[i + 2] += n * 0.8; }
    x.putImageData(img, 0, 0);
    for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? '#a8936a55' : '#efe2c255'; const r = Math.random() * 1.6 + 0.4; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, r, 0, 7); x.fill(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = ['#e9dcc4', '#d6c4a2', '#bfa98a'][i % 3]; x.save(); x.translate(Math.random() * 512, Math.random() * 512); x.rotate(Math.random() * 6); x.beginPath(); x.ellipse(0, 0, 3 + Math.random() * 4, 2 + Math.random() * 2, 0, 0, 7); x.fill(); x.restore(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(26, 26); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function rockTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#7d7466'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1600; i++) { x.fillStyle = ['#5e574c', '#948b7a', '#6f6a55', '#4d5a46', '#8a7f6a'][i % 5] + '66'; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 5, 1 + Math.random() * 4); }
    for (let i = 0; i < 70; i++) { x.fillStyle = '#4f6b45' + '55'; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 12, 0, 7); x.fill(); }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; return t;
  }

  /* ---------- seabed, rocks, corals, seagrass ---------- */
  function createSeabed(quality) {
    const group = new T.Group(); group.name = 'seabed';
    const n = quality === 'low' ? 90 : 150, g = new T.PlaneGeometry(150, 150, n, n); g.rotateX(-Math.PI / 2); g.translate(0, 0, -20);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, PH.seabed(x, z) - 0.04 * Math.sin(x * 3.1) * Math.sin(z * 2.3)); }
    g.computeVertexNormals();
    const sand = patchOptics(new T.MeshStandardMaterial({ map: sandTexture(), roughness: 0.95, color: '#e8dcc0' }));
    const bed = new T.Mesh(g, sand); bed.receiveShadow = false; group.add(bed);
    const rockMat = patchOptics(new T.MeshStandardMaterial({ map: rockTexture(), roughness: 0.92, color: '#b2aa98' }));
    const rand = PH.rng(99);
    for (const r of PH.ROCKS) {
      const geo = new T.IcosahedronGeometry(r.r, 3), pp = geo.attributes.position;
      for (let i = 0; i < pp.count; i++) { const v = new T.Vector3(pp.getX(i), pp.getY(i), pp.getZ(i)), l = v.length(); const k = 1 + 0.22 * Math.sin(v.x * 3.1 + v.z * 1.7) * Math.cos(v.y * 2.3) + 0.12 * Math.sin(v.x * 7 + v.y * 5); v.multiplyScalar(k); v.y *= 0.62; pp.setXYZ(i, v.x, v.y, v.z); void l; }
      geo.computeVertexNormals(); const m = new T.Mesh(geo, rockMat); m.position.set(r.c[0], r.c[1] - r.r * 0.1, r.c[2]); m.rotation.y = rand() * 6; group.add(m);
      // coral colonies on rocks
      for (let k = 0; k < 3; k++) group.add(coral(rand, [r.c[0] + (rand() - 0.5) * r.r * 1.6, r.c[1] + r.r * 0.45, r.c[2] + (rand() - 0.5) * r.r * 1.6], 0.18 + rand() * 0.25));
    }
    // scattered stones & shells
    const stoneGeo = new T.DodecahedronGeometry(0.12, 0), stones = new T.InstancedMesh(stoneGeo, rockMat, 220), M = new T.Matrix4(), Q = new T.Quaternion(), S = new T.Vector3();
    for (let i = 0; i < 220; i++) { const x = (rand() - 0.5) * 60, z = -10 + (rand() - 0.5) * 50, s = 0.3 + rand() * 1.4; S.set(s, s * 0.6, s); Q.setFromEuler(new T.Euler(rand() * 3, rand() * 3, rand() * 3)); M.compose(new T.Vector3(x, PH.seabed(x, z) + 0.03, z), Q, S); stones.setMatrixAt(i, M); }
    group.add(stones);
    // seagrass meadows (instanced swaying blades)
    const blade = new T.PlaneGeometry(0.05, 0.62, 1, 4); blade.translate(0, 0.31, 0); const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 1.2)); }
    const sway = new Float32Array(bp.count).fill(1); blade.setAttribute('aSway', new T.BufferAttribute(sway, 1));
    const grassMat = patchOptics(new T.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.8, side: T.DoubleSide }), { sway: true, caustics: false });
    const count = quality === 'low' ? 900 : 2600, grass = new T.InstancedMesh(blade, grassMat, count); const patches = [[-5, -8], [6, -11], [-1, -14], [9, -4], [-9, -15], [3, -7.5]];
    for (let i = 0; i < count; i++) { const pc = patches[i % patches.length], a = rand() * 6.28, rr = Math.sqrt(rand()) * 2.6, x = pc[0] + Math.cos(a) * rr, z = pc[1] + Math.sin(a) * rr, s = 0.6 + rand() * 0.9; Q.setFromEuler(new T.Euler(0, rand() * 3, (rand() - 0.5) * 0.3)); S.set(1, s, 1); M.compose(new T.Vector3(x, PH.seabed(x, z) - 0.02, z), Q, S); grass.setMatrixAt(i, M); }
    grass.frustumCulled = false; group.add(grass);
    if (root.FishingEnvironment) root.FishingEnvironment.mergeStatic(group, m => m === bed);
    return group;
  }
  const coralMats = {};
  function coral(rand, pos, size) {
    const g = new T.Group(); g.position.set(...pos); const kind = Math.floor(rand() * 3);
    const col = ['#c9805e', '#b9a06a', '#8f6c8e', '#d39a7a', '#a8b47a'][Math.floor(rand() * 5)];
    const mat = coralMats[col] || (coralMats[col] = patchOptics(new T.MeshStandardMaterial({ color: col, roughness: 0.85, name: 'coral' })));
    if (kind === 0) { // brain coral
      const geo = new T.SphereGeometry(size, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = new T.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const k = 1 + 0.06 * Math.sin(v.x * 60 + Math.sin(v.z * 40) * 2); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y * 0.8, v.z); }
      geo.computeVertexNormals(); g.add(new T.Mesh(geo, mat));
    } else if (kind === 1) { // branching
      const br = (parent, len, rad, depth) => { const c = new T.Mesh(new T.CylinderGeometry(rad * 0.7, rad, len, 6), mat); c.position.y = len / 2; const j = new T.Group(); j.add(c); parent.add(j); if (depth > 0) for (let i = 0; i < 2 + (depth > 1 ? 1 : 0); i++) { const k = new T.Group(); k.position.y = len; k.rotation.set((rand() - 0.5) * 1.3, rand() * 6, (rand() - 0.5) * 1.3); j.add(k); br(k, len * 0.75, rad * 0.7, depth - 1); } return j; };
      for (let i = 0; i < 3; i++) { const r = new T.Group(); r.rotation.set((rand() - 0.5) * 0.6, rand() * 6, (rand() - 0.5) * 0.6); g.add(r); br(r, size * 0.8, size * 0.09, 2); }
    } else { // plate / table coral
      const geo = new T.CylinderGeometry(size * 1.2, size * 0.9, size * 0.12, 22); const m = new T.Mesh(geo, mat); m.position.y = size * 0.4; g.add(m); const stem = new T.Mesh(new T.CylinderGeometry(size * 0.12, size * 0.2, size * 0.4, 8), mat); stem.position.y = size * 0.2; g.add(stem);
    }
    return g;
  }

  let dotTex = null;
  function roundDot() { if (dotTex) return dotTex; const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), r = g.createRadialGradient(16, 16, 2, 16, 16, 15); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.75)'); r.addColorStop(0.8, 'rgba(255,255,255,0.25)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); dotTex = new T.CanvasTexture(c); return dotTex; }
  /* ---------- underwater light shafts + suspended particles + bubbles ---------- */
  function createUnderwaterFX(quality) {
    const group = new T.Group(); group.name = 'underwater-fx';
    const shaftMat = new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uOpacity: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uTime, uOpacity; varying vec2 vUv; void main(){ float edge = sin(vUv.x * 3.14159); float fall = pow(vUv.y, 1.6); float flick = 0.65 + 0.35 * sin(uTime * 0.7 + vUv.x * 9.0); gl_FragColor = vec4(vec3(0.75, 0.95, 0.9) * edge * edge * fall * flick * uOpacity, 1.0); }'
    });
    const shafts = [];
    for (let i = 0; i < 12; i++) { const m = new T.Mesh(new T.PlaneGeometry(0.9 + (i % 3) * 0.5, 7.5), shaftMat); m.position.set(-8 + (i * 1.47) % 16, -3.6, -4 - (i * 2.31) % 14); m.rotation.z = -SUN_DIR.x * 0.35; m.rotation.x = SUN_DIR.z * 0.3; m.userData.base = m.position.clone(); shafts.push(m); group.add(m); }
    const pc = quality === 'low' ? 250 : 700, pg = new T.BufferGeometry(), pp = new Float32Array(pc * 3); const rand = PH.rng(5);
    for (let i = 0; i < pc; i++) { pp[i * 3] = (rand() - 0.5) * 16; pp[i * 3 + 1] = -rand() * 6; pp[i * 3 + 2] = (rand() - 0.5) * 16; }
    pg.setAttribute('position', new T.BufferAttribute(pp, 3));
    const motes = new T.Points(pg, new T.PointsMaterial({ color: '#d8efe6', size: 0.03, map: roundDot(), transparent: true, opacity: 0.5, depthWrite: false })); motes.frustumCulled = false; group.add(motes);
    // bubble pool
    const bc = 160, bg = new T.BufferGeometry(), bpos = new Float32Array(bc * 3).fill(-999); bg.setAttribute('position', new T.BufferAttribute(bpos, 3));
    const bubbles = new T.Points(bg, new T.PointsMaterial({ color: '#f2fbff', size: 0.035, map: roundDot(), transparent: true, opacity: 0.85, depthWrite: false })); bubbles.frustumCulled = false; group.add(bubbles);
    const bstate = Array.from({ length: bc }, () => ({ life: 0, v: [0, 0, 0] })); let bi = 0;
    function emitBubbles(pos, n, spread = 0.15) { for (let k = 0; k < n; k++) { const s = bstate[bi]; s.life = 1.6 + Math.random() * 1.6; s.v = [(Math.random() - 0.5) * 0.2, 0.35 + Math.random() * 0.5, (Math.random() - 0.5) * 0.2]; bpos[bi * 3] = pos[0] + (Math.random() - 0.5) * spread; bpos[bi * 3 + 1] = Math.min(pos[1], -0.05) - Math.random() * spread; bpos[bi * 3 + 2] = pos[2] + (Math.random() - 0.5) * spread; bi = (bi + 1) % bc; } }
    function update(dt, camPos, under, t) {
      shaftMat.uniforms.uOpacity.value += ((under ? 0.22 : 0) - shaftMat.uniforms.uOpacity.value) * Math.min(1, dt * 3);
      shafts.forEach((m, i) => { m.visible = shaftMat.uniforms.uOpacity.value > 0.005; m.position.x = m.userData.base.x + Math.sin(t * 0.13 + i) * 0.4; m.lookAt(camPos.x, m.position.y, camPos.z); m.rotateZ(-0.25); });
      motes.visible = under; if (under) { motes.position.set(Math.round(camPos.x / 4) * 4, 0, Math.round(camPos.z / 4) * 4); motes.rotation.y = t * 0.01; }
      for (let i = 0; i < bc; i++) { const s = bstate[i]; if (s.life <= 0) continue; s.life -= dt; bpos[i * 3] += s.v[0] * dt + Math.sin(t * 9 + i) * 0.002; bpos[i * 3 + 1] += s.v[1] * dt; bpos[i * 3 + 2] += s.v[2] * dt; if (bpos[i * 3 + 1] > -0.02 || s.life <= 0) { s.life = 0; bpos[i * 3 + 1] = -999; } }
      bg.attributes.position.needsUpdate = true;
    }
    return { group, update, emitBubbles };
  }

  /* ---------- above-water spray droplets ---------- */
  function createSpray() {
    const n = 220, g = new T.BufferGeometry(), pos = new Float32Array(n * 3).fill(-999); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ color: '#f6fbff', size: 0.04, map: roundDot(), transparent: true, opacity: 0.9, depthWrite: false })); pts.frustumCulled = false; pts.name = 'spray';
    const st = Array.from({ length: n }, () => ({ life: 0, v: [0, 0, 0] })); let i0 = 0;
    function emit(p, strength = 1) { const k = Math.round(18 + strength * 40); for (let j = 0; j < k; j++) { const s = st[i0], a = Math.random() * 6.283, sp = (0.6 + Math.random() * 1.8) * strength; s.life = 0.5 + Math.random() * 0.7; s.v = [Math.cos(a) * sp * 0.6, 1.2 + Math.random() * 2.6 * strength, Math.sin(a) * sp * 0.6]; pos[i0 * 3] = p[0] + Math.cos(a) * 0.05; pos[i0 * 3 + 1] = p[1] + 0.02; pos[i0 * 3 + 2] = p[2] + Math.sin(a) * 0.05; i0 = (i0 + 1) % n; } }
    function update(dt) { for (let i = 0; i < n; i++) { const s = st[i]; if (s.life <= 0) continue; s.life -= dt; s.v[1] -= 9.81 * dt; pos[i * 3] += s.v[0] * dt; pos[i * 3 + 1] += s.v[1] * dt; pos[i * 3 + 2] += s.v[2] * dt; if (s.life <= 0 || pos[i * 3 + 1] < -0.05) { s.life = 0; pos[i * 3 + 1] = -999; } } g.attributes.position.needsUpdate = true; }
    return { points: pts, emit, update };
  }

  root.FishingWater = { U, SUN_DIR, GLSL_COMMON, GLSL_CAUSTIC, patchOptics, createSky, createSea, createSeabed, createUnderwaterFX, createSpray };
})(window);
