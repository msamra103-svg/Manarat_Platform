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

  /* ---------------------------------------------------------------------------------------------------------------
   * V23: spectator impostors baked at load time from the game's own 3D characters (MakeHuman CC0-derived meshes, the same
   * skin/hair/kit pipeline as the players). Each variant (body, skin tone, hair or ghutra/agal, fan shirt) is posed in
   * 8 frames (seated idle / clap open / clap closed / lean, standing idle / arms up / fists pump / clap overhead) and
   * rendered from up to 3 yaw angles into one texture atlas. The crowd then draws one instanced camera-facing quad per
   * seat that picks its frame and view on the GPU, so thousands of fans cost one draw call.
   * --------------------------------------------------------------------------------------------------------------- */
  const FAN_KITS = {
    fanHome: Object.assign({}, null, { id: 'fanHome', name: '', jersey: '#8a1538', jersey2: '#6a0f29', trim: '#ffffff', accent: '#ffffff', serrate: true, shorts: '#2a2a2e', shortsStripe: '#2a2a2e', socks: '#2a2a2e', sockBand: '#2a2a2e', boots: '#2a2523', numberColor: '#f7f2e8', numberOutline: '#cfa95a', crestA: '#8a1538' }),
    fanWhite: { id: 'fanWhite', name: '', jersey: '#f2efe7', jersey2: '#e7e2d6', trim: '#f2efe7', accent: '#e2ddd0', shorts: '#efebe3', shortsStripe: '#efebe3', socks: '#efebe3', sockBand: '#efebe3', boots: '#4a4440', numberColor: '#f2efe7', numberOutline: 'rgba(0,0,0,0)', crestA: '#f2efe7', plain: true },
    fanMaroon: { id: 'fanMaroon', name: '', jersey: '#7c1432', jersey2: '#7c1432', trim: '#7c1432', accent: '#7c1432', shorts: '#26282c', shortsStripe: '#26282c', socks: '#26282c', sockBand: '#26282c', boots: '#2a2523', numberColor: '#7c1432', numberOutline: 'rgba(0,0,0,0)', crestA: '#7c1432', plain: true },
    fanNavy: { id: 'fanNavy', name: '', jersey: '#1f3347', jersey2: '#1f3347', trim: '#2c4660', accent: '#2c4660', shorts: '#3a3f45', shortsStripe: '#3a3f45', socks: '#3a3f45', sockBand: '#3a3f45', boots: '#2a2523', numberColor: '#1f3347', numberOutline: 'rgba(0,0,0,0)', crestA: '#1f3347', plain: true },
    fanGrey: { id: 'fanGrey', name: '', jersey: '#8d9096', jersey2: '#8d9096', trim: '#7d8086', accent: '#7d8086', shorts: '#2c3036', shortsStripe: '#2c3036', socks: '#2c3036', sockBand: '#2c3036', boots: '#2a2523', numberColor: '#8d9096', numberOutline: 'rgba(0,0,0,0)', crestA: '#8d9096', plain: true },
    fanGold: { id: 'fanGold', name: '', jersey: '#cfa95a', jersey2: '#cfa95a', trim: '#b8934a', accent: '#b8934a', shorts: '#3a3530', shortsStripe: '#3a3530', socks: '#3a3530', sockBand: '#3a3530', boots: '#2a2523', numberColor: '#cfa95a', numberOutline: 'rgba(0,0,0,0)', crestA: '#cfa95a', plain: true },
    fanAway: { id: 'fanAway', name: '', jersey: '#ece6d6', jersey2: '#d9d1bd', trim: '#16505b', accent: '#c9a24f', shorts: '#2a2a2e', shortsStripe: '#2a2a2e', socks: '#2a2a2e', sockBand: '#2a2a2e', boots: '#2a2523', numberColor: '#16505b', numberOutline: '#c9a24f', crestA: '#16505b' }
  };
  // variant table: [build, skin tone idx, hair style | 'ghutra' | 'ghutraRed', kit, hair colour idx]
  const VARIANTS = [
    ['athlete', 2, 'ghutra', 'fanWhite', 0], ['runner', 1, 'short', 'fanHome', 1], ['keeper', 4, 'buzz', 'fanMaroon', 0], ['athlete', 0, 'crop', 'fanNavy', 3],
    ['runner', 3, 'ghutraRed', 'fanWhite', 0], ['keeper', 2, 'curly', 'fanHome', 2], ['athlete', 5, 'buzz', 'fanGrey', 5], ['runner', 2, 'ghutra', 'fanWhite', 1],
    ['keeper', 1, 'short', 'fanGold', 4], ['athlete', 3, 'crop', 'fanHome', 0], ['runner', 4, 'curly', 'fanAway', 5], ['athlete', 1, 'long', 'fanMaroon', 2]
  ];
  const FRAMES = 8;
  function clothTexture(red) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, 128, 128);
    if (red) { x.fillStyle = '#b3122e'; for (let i = 0; i < 128; i += 16) for (let j = 0; j < 128; j += 16) if (((i + j) / 16) % 2 === 0) x.fillRect(i, j, 9, 9); }
    x.globalAlpha = 0.08; x.fillStyle = '#000'; for (let i = 0; i < 128; i += 3) x.fillRect(0, i, 128, 1);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; return t;
  }
  /** Ghutra + agal head-dress built around the character's own scalp mesh (head-bone space). */
  function headdress(scalp, red) {
    const g = new T.Group(); scalp.computeBoundingBox(); const bb = scalp.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
    const rx = (bb.max.x - bb.min.x) / 2 + 0.016, rz = (bb.max.z - bb.min.z) / 2 + 0.016, top = bb.max.y + 0.012, band = bb.min.y + (bb.max.y - bb.min.y) * 0.35;
    const mat = new T.MeshStandardMaterial({ map: clothTexture(red), roughness: 0.9, side: T.DoubleSide });
    const cap = new T.Mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat); cap.scale.set(rx, top - band, rz); cap.position.set(cx, band, cz); g.add(cap);
    // drape: open cone shell over the sides and back of the head down to the shoulders
    const drop = 0.24, cone = new T.CylinderGeometry(1, 1.45, 1, 22, 3, true, Math.PI * 0.22, Math.PI * 1.56);
    const dr = new T.Mesh(cone, mat); dr.scale.set(rx, drop, rz); dr.position.set(cx, band - drop / 2, cz - 0.004); g.add(dr);
    const agal = new T.Mesh(new T.TorusGeometry(1, 0.13, 6, 24), new T.MeshStandardMaterial({ color: FB.color('#111111'), roughness: 0.6 }));
    agal.rotation.x = Math.PI / 2; agal.scale.set(rx + 0.004, rz + 0.004, 0.09); agal.position.set(cx, band + (top - band) * 0.3, cz); g.add(agal);
    return g;
  }
  function posePlayer(r, f) {
    r.reset(); const seated = f < 4, L = (x, y, z) => new V(x, y, z);
    if (seated) {
      const drop = r.hipsRest.y - 0.5; r.hips({ x: 0, y: -drop, z: -0.02 }, 0, 0, 0);
      r.legFK('L', 1.5, 0.08, 1.45, 0.05).legFK('R', 1.5, 0.1, 1.5, 0.05);
      r.spine(f === 3 ? 0.4 : 0.08, 0, 0); r.look(0, f === 3 ? -0.15 : 0.05, 0);
    } else {
      r.hips({ x: 0, y: f === 6 ? -0.02 : 0, z: 0 }, 0, 0, 0); r.legFK('L', 0.05, 0.06, 0.1, 0).legFK('R', 0.02, 0.07, 0.05, 0);
      r.spine(f === 4 ? 0.02 : -0.06, 0, 0); r.look(0, f === 4 ? 0.0 : -0.25, 0);
    }
    r.root.updateMatrixWorld(true);
    const tg = {
      0: [L(0.13, 0.58, 0.36), L(-0.13, 0.58, 0.38), 0.4], 1: [L(0.16, 0.88, 0.34), L(-0.16, 0.88, 0.34), 0.1], 2: [L(0.025, 0.9, 0.36), L(-0.025, 0.9, 0.36), 0.05],
      3: [L(0.04, 0.74, 0.42), L(-0.04, 0.74, 0.42), 0.7], 4: [L(0.22, 0.86, 0.06), L(-0.22, 0.86, 0.06), 0.45], 5: [L(0.42, 2.0, 0.12), L(-0.42, 2.0, 0.12), 0.15],
      6: [L(0.36, 2.0, 0.16), L(-0.24, 0.88, 0.08), 0.9], 7: [L(0.04, 1.98, 0.18), L(-0.04, 1.98, 0.18), 0.05]
    }[f];
    // elbows out and down (a real clap / lean), never folded across the chest
    const pole = S => new V(S === 'L' ? 1 : -1, f >= 5 ? 0.2 : -0.7, f >= 5 ? 0.1 : -0.25).normalize();
    r.armClear('L', tg[0], { torsoR: 0.12, pole: pole('L') }); r.armClear('R', tg[1], { torsoR: 0.12, pole: pole('R') }); r.hand('L', tg[2], 0, 0.3).hand('R', tg[2], 0, 0.3);
    r.root.updateMatrixWorld(true);
  }
  /** Bake the spectator atlas. ctx: { assets, tex, level 0..2 }. Returns null when it cannot (no renderer / no assets). */
  function bake(renderer, ctx) {
    if (!renderer || !ctx || !ctx.assets || !FB.Rig || !FB.Char) return null;
    const level = ctx.level === undefined ? 2 : ctx.level;
    const variants = VARIANTS.slice(0, level === 0 ? 8 : level === 1 ? 10 : 12), views = level === 0 ? [0] : [0, 0.62, -0.62];
    const cw = level === 0 ? 56 : level === 1 ? 72 : 80, ch = cw * 2, n = variants.length * FRAMES * views.length;
    const W = level === 0 ? 2048 : 4096, cols = Math.floor(W / cw), rows = Math.ceil(n / cols); let H = 1; while (H < rows * ch) H *= 2;
    const rt = new T.WebGLRenderTarget(W, H, { minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: true });
    rt.texture.generateMipmaps = false; rt.texture.encoding = T.sRGBEncoding; rt.texture.anisotropy = 4;
    const sc = new T.Scene(); sc.add(new T.HemisphereLight(FB.color('#dfe8ff'), FB.color('#6a5a48'), 0.85));
    const key = new T.DirectionalLight(FB.color('#fff2df'), 1.55); key.position.set(-2.5, 4, 6); sc.add(key);
    const rim = new T.DirectionalLight(FB.color('#bcd2ff'), 0.45); rim.position.set(3, 3, -4); sc.add(rim);
    // fixed framing for every cell: 1.1 m x 2.2 m from the floor, camera ~14 degrees above (the stands are seen from below/level)
    const cam = new T.OrthographicCamera(-0.55, 0.55, 2.2, 0, 0.1, 40); cam.position.set(0, 2.4, 10); cam.lookAt(0, 2.4 - 10 * Math.tan(0.0), 0);
    cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    const prev = { tm: renderer.toneMapping, ac: renderer.autoClear, cc: renderer.getClearColor(new T.Color()).clone(), ca: renderer.getClearAlpha(), vp: renderer.getViewport(new T.Vector4()), sc: renderer.getScissor(new T.Vector4()), st: renderer.getScissorTest(), sm: renderer.shadowMap.enabled, rt: renderer.getRenderTarget() };
    renderer.toneMapping = T.NoToneMapping; renderer.autoClear = false; renderer.setRenderTarget(rt); renderer.setClearColor(FB.color('#3c3a3c'), 0); renderer.setScissorTest(true);
    renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H); renderer.clear(true, true, true);
    let cell = 0;
    try {
      for (const [build, tone, hair, kit, hc] of variants) {
        if (!FB.Kit.KITS[kit]) FB.Kit.KITS[kit] = FAN_KITS[kit];
        const asset = ctx.assets[build]; if (!asset) { cell += FRAMES * views.length; continue; }
        const isHd = hair === 'ghutra' || hair === 'ghutraRed';
        const a = FB.Char.create(asset, { kit, tone: FB.Char.SKIN_TONES[tone], stubble: tone % 2 === 0, hair: { style: isHd ? 'none' : hair, color: FB.Char.HAIR_COLORS[hc] }, number: null, textures: ctx.tex && ctx.tex[build], seed: 11 + cell });
        if (FAN_KITS[kit].plain && a.parts.chest) a.parts.chest.visible = false;
        if (isHd) a.bones.head.add(headdress(asset.geoms.scalp, hair === 'ghutraRed'));
        a.setLOD && a.setLOD(0); sc.add(a.root); const r = new FB.Rig(a);
        // body cheat: the camera sees spectators from distance; keep the silhouette slightly fuller
        a.root.scale.set(1.04, 1, 1.04);
        for (let f = 0; f < FRAMES; f++) {
          posePlayer(r, f);
          for (const yaw of views) {
            a.root.rotation.y = yaw; a.root.updateMatrixWorld(true);
            const cx = (cell % cols) * cw, cy = Math.floor(cell / cols) * ch;
            renderer.setViewport(cx, cy, cw, ch); renderer.setScissor(cx, cy, cw, ch); renderer.clear(true, true, true);
            renderer.render(sc, cam); cell++;
          }
          a.root.rotation.y = 0;
        }
        sc.remove(a.root); a.dispose && a.dispose();
      }
      rt.texture.generateMipmaps = true; renderer.setViewport(0, 0, 1, 1); renderer.setScissor(0, 0, 1, 1); renderer.render(new T.Scene(), cam);
    } finally {
      renderer.setRenderTarget(prev.rt); renderer.toneMapping = prev.tm; renderer.autoClear = prev.ac; renderer.setClearColor(prev.cc, prev.ca);
      renderer.setScissorTest(prev.st); renderer.setViewport(prev.vp); renderer.setScissor(prev.sc);
    }
    return { rt, texture: rt.texture, cols, rows: H / ch, cw, ch, W, H, variants: variants.length, frames: FRAMES, views, dispose() { rt.dispose(); } };
  }

  /** One camera-facing quad per seat, textured from the baked atlas. Frame (pose) and view (yaw) are chosen in the vertex shader. */
  function impostorMesh(SP, uni, count) {
    const g = new T.PlaneGeometry(1.1, 2.2); g.translate(0, 1.1, 0);
    const m = new T.MeshBasicMaterial({ map: SP.texture, alphaTest: 0.42, color: 0xffffff });
    const u = { uGrid: { value: new T.Vector4(SP.cols, SP.rows, SP.cw * SP.cols / SP.W, SP.ch * SP.rows / SP.H) }, uNV: { value: SP.views.length }, uNF: { value: SP.frames }, uViewA: { value: SP.views.length > 1 ? SP.views[1] : 1 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uni, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute vec4 aInst; attribute vec4 aCol; uniform float uTime, uExcite, uWave, uCalm, uNV, uNF, uViewA; uniform vec4 uGrid;`)
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vec2 cellUv = uv;')
        .replace('#include <project_vertex>', `
        vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float sc = length(instanceMatrix[0].xyz);
        vec3 fwd = normalize(vec3(instanceMatrix[2].x, 0.0, instanceMatrix[2].z));
        vec3 toC = cameraPosition - base; toC.y = 0.0; toC = normalize(toC);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toC));
        float ph = aInst.x, stand0 = aInst.y, per = aInst.z, wpos = aInst.w, t = uTime;
        float e = uExcite * (0.45 + 0.55 * per) * (1.0 - 0.7 * uCalm);
        float wv = (uWave >= 0.0) ? smoothstep(0.0, 1.0, 1.0 - abs(fract(wpos - uWave + 0.5) - 0.5) * 9.0) : 0.0; wv *= (1.0 - 0.8 * uCalm);
        float standing = max(step(0.5, stand0), max(step(0.5, wv), step(0.55, e) * step(0.4, per)));
        float beat = step(0.5, fract(t * (1.9 + per * 1.3) + ph));
        float fr;
        if (standing > 0.5) {
          if (wv > 0.5) fr = 5.0;
          else if (e > 0.55) fr = per > 0.75 ? (beat > 0.5 ? 7.0 : 5.0) : (per > 0.55 ? (beat > 0.5 ? 6.0 : 5.0) : 5.0);
          else fr = e > 0.28 ? (beat > 0.5 ? 7.0 : 4.0) : 4.0;
        } else {
          if (e > 0.3 && per > 0.22) fr = 1.0 + beat;
          else fr = (per < 0.12 && e < 0.2) ? 3.0 : 0.0;
        }
        // view: angle from the camera direction to the spectator's facing, nearest baked yaw
        float rel = atan(cross(toC, fwd).y, dot(toC, fwd)); float vi = 0.0;
        if (uNV > 1.5) vi = rel > uViewA * 0.5 ? 1.0 : (rel < -uViewA * 0.5 ? 2.0 : 0.0);
        float cell = aCol.x * uNF * uNV + fr * uNV + vi;
        float cx = mod(cell, uGrid.x), cy = floor(cell / uGrid.x);
        vUv = vec2((cx + cellUv.x) * uGrid.z / uGrid.x, (cy + cellUv.y) * uGrid.w / uGrid.y);
        float bob = standing * (e * abs(sin(t * (4.2 + per * 2.0) + ph * 6.2831)) * 0.12) + (1.0 - uCalm) * 0.006 * sin(t * 1.3 + ph * 9.0);
        vec3 wp = base + right * (position.x * sc) + vec3(0.0, (position.y + bob) * sc, 0.0) + toC * 0.12;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;`);
    };
    const im = new T.InstancedMesh(g, m, count); im.renderOrder = 1; return im;
  }
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
    const SP = opts.sprites || null;
    const spriteMesh = SP ? impostorMesh(SP, uni, count) : null;
    const inst = spriteMesh || new T.InstancedMesh(geo, mat, count); inst.frustumCulled = false; inst.name = 'crowd';
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
          const w = opts.sprites ? t.fill * (0.72 + 0.28 * near) * (0.92 + 0.08 * lateral) : t.fill * (0.35 + 0.65 * near) * lateral;
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
      dm.position.set(c.x, SP ? c.y - 0.46 : c.y, c.z); const yaw = Math.atan2(-c.x, CZ - c.z) + (rng() - 0.5) * (SP ? 0.3 : 0.5); dm.rotation.set(0, yaw, 0); const sc = SP ? 0.94 + rng() * 0.12 : 0.92 + rng() * 0.16; dm.scale.set(sc, SP ? sc : sc * (0.95 + rng() * 0.1), sc); dm.updateMatrix(); inst.setMatrixAt(i, dm.matrix);
      let r = rng() * clothTotal, ci = 0; for (; ci < CLOTH.length - 1; ci++) { r -= CLOTH[ci][1]; if (r < 0) break; }
      if (SP) { const lit = (0.76 + rng() * 0.2) * (c.tier === 1 ? 0.86 - 0.1 * c.row / 26 : 1 - 0.06 * c.row / 20); col.setRGB(lit, lit, lit); } else col.copy(clothCol[ci]).multiplyScalar(0.85 + rng() * 0.3);
      inst.setColorAt(i, col);
      aInst[i * 4] = rng(); aInst[i * 4 + 1] = rng() < 0.04 ? 1 : 0; aInst[i * 4 + 2] = rng(); aInst[i * 4 + 3] = c.u;
      const white = ci === 1 || ci === 3 || ci === 6, hw = white && rng() < 0.55 ? (rng() < 0.5 ? 1 : 2) : 0;
      aCol[i * 4] = Math.floor(rng() * 5); aCol[i * 4 + 1] = hw;
      if (SP) { aCol[i * 4] = Math.floor(rng() * SP.variants); aCol[i * 4 + 1] = 0; aInst[i * 4 + 1] = rng() < 0.05 ? 1 : 0; }
    });
    inst.count = chosen.length; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    const ig = inst.geometry; ig.setAttribute('aInst', new T.InstancedBufferAttribute(aInst, 4)); ig.setAttribute('aCol', new T.InstancedBufferAttribute(aCol, 4));
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
      mesh: inst, flags: fi, count: chosen.length, impostors: !!SP, excite: 0.1, target: 0.1, wave: -1, waveOn: false, waveT: 0,
      setExcitement(v) { this.target = M.clamp(v); },
      pulse(v, hold = 2.5) { this.target = M.clamp(v); this.hold = hold; },
      startWave() { this.waveOn = true; this.waveT = 0; },
      update(dt, t) {
        if (this.hold > 0) { this.hold -= dt; } else if (this.target > 0.12) this.target = Math.max(0.12, this.target - dt * 0.22);
        this.excite = M.damp(this.excite, this.target, this.target > this.excite ? 4 : 0.8, dt); uni.uExcite.value = this.excite; uni.uTime.value = t;
        if (this.waveOn) { this.waveT += dt; uni.uWave.value = (this.waveT / 7.0) % 1; if (this.waveT > 14) { this.waveOn = false; uni.uWave.value = -1; } }
      },
      setReduced(r) { uni.uCalm.value = r ? 1 : 0; },
      dispose() { scene.remove(inst, fi); geo.dispose(); mat.dispose(); if (spriteMesh) { spriteMesh.geometry.dispose(); spriteMesh.material.dispose(); } fg.dispose(); fmat.dispose(); inst.dispose(); fi.dispose(); }
    };
    return api;
  }
  FB.Crowd = { build, bake, VARIANTS, FRAMES };
})(typeof window !== 'undefined' ? window : globalThis);
