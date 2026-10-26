/* Crowd: Microsoft Rocketbox spectators (MIT) rendered with GPU instancing and
 * baked skeletal animation (one shared int16 texture of skin matrices per group).
 * Each spectator has its own clip, phase, start delay and cross-fade, so reactions
 * are never synchronised. Forked for bowling from games/basketball/crowd.js (V23.1); the
 * reaction vocabulary below is tuned for a bowling hall (short, restrained reactions).
 */
(function (root) {
  'use strict';
  const T = root.THREE;

  async function load(base, manager, onProgress) {
    const url = p => base + 'crowd/' + p;
    const get = async (p, type) => {
      manager && manager.itemStart(url(p));
      try {
        const r = await fetch(url(p)); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + p);
        const out = type === 'json' ? await r.json() : await r.arrayBuffer();
        manager && manager.itemEnd(url(p)); return out;
      } catch (e) { manager && manager.itemError(url(p)); throw e; }
    };
    const meta = await get('crowd.json', 'json');
    const animBuf = await get('crowd_anim.bin');
    const head = new Uint32Array(animBuf, 0, 4), frames = head[0], bones = head[1];
    const q = new Int16Array(animBuf, 16, frames * bones * 12);
    const W = bones * 3, data = new Float32Array(W * frames * 4);
    const sc = meta.quant;
    for (let i = 0; i < frames * bones * 3; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = q[i * 4 + c] / 32767 * sc[c];
    const animTex = new T.DataTexture(data, W, frames, T.RGBAFormat, T.FloatType);
    animTex.minFilter = animTex.magFilter = T.NearestFilter; animTex.generateMipmaps = false; animTex.needsUpdate = true;
    const tl = new T.TextureLoader(manager);
    const avatars = {};
    await Promise.all(Object.entries(meta.avatars).map(async ([id, a]) => {
      const buf = await get('crowd_' + id + '.bin');
      const h = new Uint32Array(buf, 0, 4), nv = h[0], ni = h[1];
      let o = 16;
      const pos = new Float32Array(buf, o, nv * 3); o += nv * 12;
      const nor = new Int8Array(buf, o, nv * 4); o += nv * 4;
      const uv = new Uint16Array(buf, o, nv * 2); o += nv * 4;
      const jn = new Uint8Array(buf, o, nv * 2); o += nv * 2;
      const wt = new Uint8Array(buf, o, nv); o += nv; o += (4 - o % 4) % 4;
      const idx = a.index32 ? new Uint32Array(buf, o, ni) : new Uint16Array(buf, o, ni);
      const g = new T.InstancedBufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3));
      g.setAttribute('normal', new T.InterleavedBufferAttribute(new T.InterleavedBuffer(nor, 4), 3, 0, true));
      g.setAttribute('uv', new T.BufferAttribute(uv, 2, true));
      g.setAttribute('aJoint', new T.BufferAttribute(jn, 2, false));
      g.setAttribute('aWeight', new T.BufferAttribute(wt, 1, true));
      g.setIndex(new T.BufferAttribute(idx, 1));
      g.boundingSphere = new T.Sphere(new T.Vector3(0, 1, 0), 60);
      const tex = await new Promise((res, rej) => { const t = tl.load(url('crowd_' + id + '.jpg'), () => res(t), undefined, () => rej(new Error('crowd texture ' + id))); });
      tex.flipY = false; tex.encoding = T.sRGBEncoding;
      avatars[id] = { geometry: g, texture: tex, meta: a };
    }));
    return { meta, animTex, avatars, bones, frames };
  }

  function material(lib, texture) {
    const m = new T.MeshLambertMaterial({ map: texture });
    m.onBeforeCompile = sh => {
      sh.uniforms.uAnim = { value: lib.animTex };
      sh.uniforms.uTime = lib.uTime;
      sh.uniforms.uSize = { value: new T.Vector2(lib.bones * 3, lib.frames) };
      sh.uniforms.uFps = { value: lib.meta.fps };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        uniform sampler2D uAnim; uniform float uTime; uniform vec2 uSize; uniform float uFps;
        attribute vec2 aJoint; attribute float aWeight;
        attribute vec4 aClipA; attribute vec4 aClipB; attribute vec2 aFade;
        vec4 fetchRow(float x, float row){ return texture2D(uAnim, vec2((x + 0.5) / uSize.x, (row + 0.5) / uSize.y)); }
        mat4 boneAt(float row, float bone){
          float x = bone * 3.0;
          vec4 r0 = fetchRow(x, row), r1 = fetchRow(x + 1.0, row), r2 = fetchRow(x + 2.0, row);
          return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
        }
        void frames(vec4 c, out float f0, out float f1, out float fr){
          float t = max(0.0, uTime - c.z) * uFps * (c.w > 1.5 ? 0.85 : 1.0);
          float n = c.y - 1.0;
          if (c.w > 0.5) { t = mod(t, n); } else { t = min(t, n); }
          f0 = floor(t); fr = t - f0; f1 = min(f0 + 1.0, n);
          f0 += c.x; f1 += c.x;
        }
        mat4 skinFor(vec4 c, float bone){
          float f0; float f1; float fr; frames(c, f0, f1, fr);
          mat4 a = boneAt(f0, bone); mat4 b = boneAt(f1, bone);
          return mat4(mix(a[0], b[0], fr), mix(a[1], b[1], fr), mix(a[2], b[2], fr), mix(a[3], b[3], fr));
        }
        mat4 crowdSkin(){
          float wB = 1.0 - clamp((uTime - aFade.x) / max(aFade.y, 0.001), 0.0, 1.0);
          mat4 m0 = skinFor(aClipA, aJoint.x) * aWeight + skinFor(aClipA, aJoint.y) * (1.0 - aWeight);
          if (wB > 0.001) {
            mat4 m1 = skinFor(aClipB, aJoint.x) * aWeight + skinFor(aClipB, aJoint.y) * (1.0 - aWeight);
            m0 = mat4(mix(m0[0], m1[0], wB), mix(m0[1], m1[1], wB), mix(m0[2], m1[2], wB), mix(m0[3], m1[3], wB));
          }
          return m0;
        }`);
      sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', `mat4 cSkin = crowdSkin();
        vec3 objectNormal = normalize(mat3(cSkin) * normal.xyz);
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
        #endif`);
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = (cSkin * vec4(position, 1.0)).xyz;');
    };
    m.customProgramCacheKey = () => 'crowd-skin-v1';
    return m;
  }

  /**
   * seats: [{x,y,z,yaw,priority}] (y = tread height under the feet; pelvis is placed over the seat)
   * opts: {count, seed, sitOffset}
   */
  function create(lib, seats, opts = {}) {
    const rnd = mulberry(opts.seed || 7);
    lib.uTime = { value: 0 };
    const group = new T.Group(); group.name = 'crowd';
    const ids = Object.keys(lib.avatars);
    const adults = ids.filter(i => lib.avatars[i].meta.group === 'adult');
    const kids = ids.filter(i => lib.avatars[i].meta.group === 'child');
    const want = Math.min(seats.length, opts.count || seats.length);
    // choose seats: highest priority first, with a little randomness, keep some gaps
    const order = seats.map((s, i) => ({ i, k: s.priority + rnd() * 0.35 })).sort((a, b) => b.k - a.k).slice(0, want).map(o => seats[o.i]);
    const per = {}; ids.forEach(id => { per[id] = []; });
    order.forEach(s => {
      const kid = kids.length && rnd() < (opts.kidShare ?? 0.32);
      const pool = kid ? kids : adults;
      per[pool[Math.floor(rnd() * pool.length)]].push(s);
    });
    const clips = lib.meta.clips;
    const people = [];
    const meshes = [];
    const dummy = new T.Object3D();
    for (const id of ids) {
      const list = per[id]; if (!list.length) continue;
      const av = lib.avatars[id], n = list.length, grp = av.meta.group;
      const geo = av.geometry;
      const A = new Float32Array(n * 4), B = new Float32Array(n * 4), F = new Float32Array(n * 2);
      geo.setAttribute('aClipA', new T.InstancedBufferAttribute(A, 4).setUsage(T.DynamicDrawUsage));
      geo.setAttribute('aClipB', new T.InstancedBufferAttribute(B, 4).setUsage(T.DynamicDrawUsage));
      geo.setAttribute('aFade', new T.InstancedBufferAttribute(F, 2).setUsage(T.DynamicDrawUsage));
      const mesh = new T.InstancedMesh(geo, material(lib, av.texture), n);
      mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.name = 'crowd-' + id;
      const lift = grp === 'child' ? (clips.sit_idle.adult.pelvis[1] - clips.sit_idle.child.pelvis[1]) : 0;
      list.forEach((s, k) => {
        dummy.position.set(s.x, s.y + lift, s.z); dummy.rotation.set(0, s.yaw + (rnd() - .5) * 0.25, 0);
        const sc = 0.96 + rnd() * 0.08; dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix(); mesh.setMatrixAt(k, dummy.matrix);
        const p = { mesh, k, A, B, F, grp, kid: grp === 'child', state: 'calm', clip: '', next: 0, queue: [], dist: s.dist || 20, temper: rnd() };
        people.push(p);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh); meshes.push(mesh);
    }
    let time = 0;
    function setClip(p, name, delay = 0, fade = 0.35) {
      const c = clips[name] && clips[name][p.grp]; if (!c) return;
      const o = p.k * 4, t0 = time + delay;
      // previous becomes B
      p.B[o] = p.A[o]; p.B[o + 1] = p.A[o + 1]; p.B[o + 2] = p.A[o + 2]; p.B[o + 3] = p.A[o + 3];
      p.A[o] = c.row; p.A[o + 1] = c.count; p.A[o + 2] = t0 - (c.loop && delay === 0 && !p.clip ? rnd() * c.count / lib.meta.fps : 0);
      p.A[o + 3] = c.loop ? (p.temper > 0.7 ? 2 : 1) : 0;
      p.F[p.k * 2] = t0; p.F[p.k * 2 + 1] = p.clip ? fade : 0;
      p.clip = name; p.clipEnd = t0 + c.count / lib.meta.fps;
      p.mesh.userData.dirty = true;
    }
    const calmClips = ['sit_idle', 'sit_idle', 'sit_look'];
    people.forEach(p => { setClip(p, calmClips[Math.floor(rnd() * calmClips.length)]); p.next = 4 + rnd() * 10; });

    function plan(p, steps) { p.queue = steps; p.next = time + (steps[0] ? steps[0][1] : 0); }

    function react(kind, reduced = false) {
      for (const p of people) {
        const r = rnd(), d = 0.15 + rnd() * 0.9 + (p.dist > 12 ? 0.15 : 0);
        if (kind === 'anticipate') {
          if (r < 0.35) plan(p, [['sit_lean', d * 0.8, 0.5]]);
        } else if (kind === 'strike' && !reduced) {
          if (!p.kid && r < 0.18) plan(p, [['stand_up', d, 0.35], ['stand_clap', 1.6, 0.4], ['sit_down', 2.2 + rnd() * 1.2, 0.45], ['sit_idle', 2.6, 0.5]]);
          else if (r < 0.75) plan(p, [['sit_clap', d, 0.35], ['sit_idle', 2.4 + rnd() * 1.8, 0.6]]);
          else if (r < 0.88) plan(p, [['sit_cheer', d, 0.35], ['sit_idle', 2.4 + rnd() * 1.2, 0.6]]);
          else plan(p, [['sit_idle', d, 0.6]]);
        } else if (kind === 'good' || kind === 'strike') {
          if (r < 0.55) plan(p, [['sit_clap', d, 0.4], ['sit_idle', 1.8 + rnd() * 1.6, 0.6]]);
          else plan(p, [['sit_idle', d, 0.6]]);
        } else if (kind === 'miss') {
          if (r < 0.22) plan(p, [['sit_shrug', d + 0.15, 0.4], ['sit_idle', 2.4, 0.6]]);
          else if (r < 0.40) plan(p, [['sit_clap', d + 0.7, 0.45], ['sit_idle', 1.8, 0.6]]); // supportive applause
          else plan(p, [['sit_idle', d, 0.6]]);
        } else {
          plan(p, [[calmClips[Math.floor(rnd() * 3)], d, 0.7]]);
        }
      }
    }

    function update(dt) {
      time += dt; lib.uTime.value = time;
      for (const p of people) {
        if (p.queue.length && time >= p.next) {
          const [name, , fade] = p.queue.shift();
          setClip(p, name, 0, fade);
          if (p.queue.length) p.next = time + p.queue[0][1];
        } else if (!p.queue.length && time >= p.next && (p.clip === 'sit_idle' || p.clip === 'sit_look')) {
          setClip(p, calmClips[Math.floor(rnd() * 3)], 0, 0.8); p.next = time + 6 + rnd() * 10;
        }
      }
      for (const m of meshes) {
        if (!m.userData.dirty) continue;
        const g = m.geometry; m.userData.dirty = false;
        g.attributes.aClipA.needsUpdate = g.attributes.aClipB.needsUpdate = g.attributes.aFade.needsUpdate = true;
      }
    }

    function dispose() {
      meshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); });
    }
    return { group, update, react, dispose, count: people.length, meshes };
  }

  function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  root.BowlingCrowd = { load, create };
})(typeof window !== 'undefined' ? window : globalThis);
