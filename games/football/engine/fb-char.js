/* Football character loader: builds skinned, rigged players from the baked CC0-derived body assets (see tools/football-assets). */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const M = FB.math;

  const BONES = ['hips', 'spine1', 'spine2', 'spine3', 'neck', 'head', 'clavicleL', 'upperarmL', 'lowerarmL', 'handL', 'fingersL', 'thumbL', 'clavicleR', 'upperarmR', 'lowerarmR', 'handR', 'fingersR', 'thumbR', 'thighL', 'shinL', 'footL', 'toesL', 'thighR', 'shinR', 'footR', 'toesR'];

  function typed(buf, a, count) {
    const size = a.size * count;
    switch (a.type) {
      case 'f32': return { arr: new Float32Array(buf, a.offset, size), norm: false };
      case 'i8n': return { arr: new Int8Array(buf, a.offset, size), norm: true };
      case 'u8': return { arr: new Uint8Array(buf, a.offset, size), norm: false };
      case 'u8n': return { arr: new Uint8Array(buf, a.offset, size), norm: true };
    }
    throw new Error('attr type ' + a.type);
  }

  /** Parse a manifest+binary pair into shared BufferGeometries. */
  function parse(man, buf) {
    const T = THREE, geoms = {};
    for (const [name, m] of Object.entries(man.meshes)) {
      const g = new T.BufferGeometry();
      for (const [k, a] of Object.entries(m.attributes)) {
        if (k === 'color') {
          const ao = typed(buf, a, m.count).arr, rgb = new Uint8Array(m.count * 3);
          for (let i = 0; i < m.count; i++) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = ao[i];
          g.setAttribute('color', new T.BufferAttribute(rgb, 3, true));
          continue;
        }
        const t = typed(buf, a, m.count);
        const attr = k === 'skinIndex' ? new T.BufferAttribute(new Uint16Array(t.arr), 4) : new T.BufferAttribute(t.arr, a.size, t.norm);
        g.setAttribute(k === 'normal' ? 'normal' : k, attr);
      }
      const ia = m.index, I = ia.type === 'u32' ? new Uint32Array(buf, ia.offset, ia.count) : new Uint16Array(buf, ia.offset, ia.count);
      g.setIndex(new T.BufferAttribute(I, 1));
      if (m.groups) for (const [start, count, mat] of m.groups) g.addGroup(start, count, mat);
      g.computeBoundingSphere();
      geoms[name] = g;
    }
    return geoms;
  }

  async function load(base, name) {
    const [man, buf] = await Promise.all([fetch(`${base}/${name}.json`).then(r => { if (!r.ok) throw new Error(name + '.json'); return r.json(); }),
      fetch(`${base}/${name}.bin`).then(r => { if (!r.ok) throw new Error(name + '.bin'); return r.arrayBuffer(); })]);
    return { name, man, geoms: parse(man, buf), base };
  }

  function loadTexture(url, opts = {}) {
    return new Promise((res, rej) => {
      const t = new THREE.TextureLoader().load(url, tex => { tex.encoding = THREE.sRGBEncoding; tex.anisotropy = opts.anisotropy || 4; if (opts.repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; } res(tex); }, undefined, rej);
    });
  }

  FB.Char = { BONES, parse, load, loadTexture };

  /** Bone hierarchy in the baked rest pose (all bone axes world-aligned). Usable without any GPU resources (tests, AI-only characters). */
  function buildSkeleton(man) {
    const T = THREE, bones = man.bones.map(b => { const bone = new T.Bone(); bone.name = b.name; return bone; }), byName = {}, holder = new T.Group();
    let hips = null;
    man.bones.forEach((b, i) => {
      byName[b.name] = bones[i];
      if (b.parent < 0) { bones[i].position.set(b.pos[0], b.pos[1], b.pos[2]); hips = bones[i]; holder.add(bones[i]); }
      else { const pp = man.bones[b.parent].pos; bones[i].position.set(b.pos[0] - pp[0], b.pos[1] - pp[1], b.pos[2] - pp[2]); bones[b.parent].add(bones[i]); }
    });
    holder.updateMatrixWorld(true);
    return { bones, byName, hips, holder, skeleton: new T.Skeleton(bones) };
  }

  const SKIN_TONES = ['#f0c4a0', '#e2b088', '#cf9a6c', '#b9794f', '#98603b', '#744628'];
  const HAIR_COLORS = ['#15110f', '#1c1612', '#2a1d14', '#3a281b', '#5a4030', '#0d0d0d'];

  function hairGeometry(scalp, style, seed) {
    const T = THREE, g = new T.BufferGeometry(), r = M.rng(seed), pos = scalp.getAttribute('position'), nor = scalp.getAttribute('normal'), n = pos.count;
    const idx = scalp.index.array;
    // boundary vertices (edges used by one triangle) taper to a thin hairline
    const edge = new Map(), key = (a, b) => a < b ? a * 65536 + b : b * 65536 + a;
    for (let i = 0; i < idx.length; i += 3) for (let k = 0; k < 3; k++) { const q = key(idx[i + k], idx[i + (k + 1) % 3]); edge.set(q, (edge.get(q) || 0) + 1); }
    const bnd = new Uint8Array(n); for (const [q, c] of edge) if (c === 1) { bnd[q % 65536] = 1; bnd[Math.floor(q / 65536)] = 1; }
    const th = { buzz: 0.0045, crop: 0.011, short: 0.016, curly: 0.026, long: 0.022 }[style] || 0.012;
    const noise = { buzz: 0.001, crop: 0.002, short: 0.004, curly: 0.012, long: 0.006 }[style] || 0.002;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      // V23: smooth (position-based) noise instead of per-vertex random offsets, which made the hair a faceted, jagged shell
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i), fq = style === 'curly' ? 90 : 38, sd = (seed % 7) * 1.7;
      const sn = Math.sin(px * fq + sd) * Math.sin(py * fq * 0.83 + 1.3 + sd) * Math.sin(pz * fq * 1.11 + 2.1) + 0.5 * Math.sin(px * fq * 2.1 - pz * fq * 1.7 + sd);
      const o = (bnd[i] ? 0.3 : 1) * (th + sn * noise * 0.9);
      const ns = nor.normalized ? 1 / 127 : 1, nx = nor.getX(i) * ns, ny = nor.getY(i) * ns, nz = nor.getZ(i) * ns;
      P[i * 3] = pos.getX(i) + nx * o; P[i * 3 + 1] = pos.getY(i) + ny * o + (style === 'curly' || style === 'long' ? 0.004 : 0); P[i * 3 + 2] = pos.getZ(i) + nz * o;
      N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz; uvs[i * 2] = pos.getX(i) * 9; uvs[i * 2 + 1] = pos.getY(i) * 9 + pos.getZ(i) * 5;
    }
    g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(N, 3)); g.setAttribute('uv', new T.BufferAttribute(uvs, 2)); g.setIndex(new T.BufferAttribute(idx.slice(), 1));
    return g;
  }
  /** V23: strand texture (512 px): many fine strands in three tones, darker roots, plus a grey-scale copy used as a bump map. */
  function hairTexture(color, bump) {
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), rnd = M.rng(97);
    const base = new THREE.Color(color), hi = base.clone().lerp(new THREE.Color('#8a6a52'), 0.25), lo = base.clone().multiplyScalar(0.45);
    x.fillStyle = bump ? '#7f7f7f' : '#' + base.getHexString(); x.fillRect(0, 0, N, N);
    for (let i = 0; i < 9000; i++) {
      const t = rnd(), col = bump ? (t < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)') : (t < 0.45 ? 'rgba(' + [lo.r, lo.g, lo.b].map(v => Math.round(v * 255)).join(',') + ',0.4)' : t < 0.8 ? 'rgba(' + [hi.r, hi.g, hi.b].map(v => Math.round(v * 255)).join(',') + ',0.12)' : 'rgba(0,0,0,0.22)');
      x.strokeStyle = col; x.lineWidth = 0.6 + rnd() * 0.8; const a = rnd() * N, b = rnd() * N, L = 10 + rnd() * 26, bend = (rnd() - 0.5) * 8;
      x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + bend, b + L * 0.5, a + bend * 0.4 + (rnd() - 0.5) * 4, b + L); x.stroke();
    }
    const t = new THREE.CanvasTexture(c); if (!bump) t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  const shared = { skin: {}, eye: null, hair: {} };
  /** Create one player. asset = result of load(); opts: {kit, tone, stubble, hair:{style,color}, number, name, keeper, scale, textures:{skin_clean, skin_stubble, eye}} */
  function create(asset, o = {}) {
    const T = THREE, man = asset.man, G = asset.geoms, root = new T.Group(); root.name = o.name || 'player';
    const sk = buildSkeleton(man); const { bones, byName, skeleton } = sk; root.add(sk.hips);
    const lm = Object.assign({ stature: man.stature }, man.landmarks);
    const kit = FB.Kit.materials(o.kit || 'home', lm);
    const tx = o.textures || {};
    const skinKey = (o.stubble ? 'st' : 'cl') + (o.tone || '') + asset.name;
    const tone = FB.color(o.tone || SKIN_TONES[2]);
    let skinMat = shared.skin[skinKey];
    if (!skinMat) skinMat = shared.skin[skinKey] = new T.MeshStandardMaterial({ map: o.stubble ? tx.skinStubble : tx.skinClean, color: tone, roughness: 0.62, metalness: 0, vertexColors: true });
    const gloveMat = o.keeper ? kit.glove : skinMat;
    const mk = (geom, mats) => { for (const mt of (Array.isArray(mats) ? mats : [mats])) { if (mt && !mt.skinning) { mt.skinning = true; mt.needsUpdate = true; } } const m = new T.SkinnedMesh(geom, mats); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; root.add(m); m.bind(skeleton, new T.Matrix4()); return m; };
    const parts = {};
    parts.skin = mk(G.skin, [skinMat, gloveMat]);
    parts.kit = mk(G.kit, [kit.jersey, kit.sleeve, kit.shorts, kit.socks, kit.boots]);
    const flat = kit.flat;
    parts.lod = mk(G.lod, [skinMat.userData.flat || (skinMat.userData.flat = new T.MeshStandardMaterial({ color: tone, roughness: 0.65, vertexColors: true })), flat.jersey, flat.shorts, flat.socks, flat.boots, o.keeper ? flat.glove : skinMat.userData.flat]);
    parts.lod.visible = false;
    // eyes (rigid, parented to the head bone)
    if (!shared.eye && tx.eye) shared.eye = new T.MeshStandardMaterial({ map: tx.eye, color: FB.color(0xb9a79a), roughness: 0.12, metalness: 0, alphaTest: 0.5 });
    const eyes = new T.Mesh(G.eyes, shared.eye || new T.MeshStandardMaterial({ color: FB.color('#ffffff') })); eyes.castShadow = false; byName.head.add(eyes); parts.eyes = eyes;
    // hair
    const hs = (o.hair && o.hair.style) || 'crop';
    if (hs !== 'none') {
      const hk = hs + (o.hair && o.hair.color);
      const hairMat = shared.hair[(o.hair && o.hair.color)] || (shared.hair[o.hair && o.hair.color] = new T.MeshStandardMaterial({ map: hairTexture((o.hair && o.hair.color) || '#1c1612'), bumpMap: hairTexture('#808080', true), bumpScale: 0.006, roughness: 0.7, metalness: 0, side: T.DoubleSide }));
      const hair = new T.Mesh(hairGeometry(G.scalp, hs, o.seed || 1), hairMat); hair.castShadow = true; byName.head.add(hair); parts.hair = hair;
    }
    // number / crest decals (skinned, share the skeleton)
    const k = FB.Kit.KITS[o.kit || 'home'];
    const decal = (geom, tex, off) => { const m = new T.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.04, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.7 }); const d = mk(geom, m); d.castShadow = false; return d; };
    if (o.number != null && !o.keeperNoNumber) parts.backNumber = decal(G.backNumber, FB.Kit.numberTexture(k, o.number, 'number'));
    if (o.label) parts.backName = decal(G.backName, FB.Kit.numberTexture(k, o.label, 'name'));
    parts.chest = decal(G.chest, FB.Kit.numberTexture(k, '', 'crest'));
    const actor = { root, bones: byName, boneList: bones, skeleton, parts, man, kit: o.kit || 'home', setLOD(level) { parts.lod.visible = level > 0; parts.skin.visible = parts.kit.visible = level === 0; for (const n of ['eyes', 'backName']) if (parts[n]) parts[n].visible = level === 0; if (parts.hair) parts.hair.visible = true; if (parts.backNumber) parts.backNumber.visible = true; if (parts.chest) parts.chest.visible = level === 0; },
      dispose() { for (const key of Object.keys(parts)) { const p = parts[key]; if (p && p.material && p.material.map && ['backNumber', 'backName', 'chest'].includes(key)) { p.material.map.dispose(); p.material.dispose(); } } skeleton.dispose && skeleton.dispose(); } };
    if (o.scale && o.scale !== 1) root.scale.setScalar(o.scale);
    return actor;
  }

  FB.Char.create = create; FB.Char.buildSkeleton = buildSkeleton; FB.Char.SKIN_TONES = SKIN_TONES; FB.Char.HAIR_COLORS = HAIR_COLORS; FB.Char.hairGeometry = hairGeometry;

})(typeof window !== 'undefined' ? window : globalThis);
