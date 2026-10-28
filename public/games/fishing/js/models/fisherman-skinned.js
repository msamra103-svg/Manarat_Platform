/* صيد الأسماك V24.1 — assembles the realistic skinned angler from the MakeHuman-derived build data
 * (tools/makehuman/build_fisherman.py → fisherman.json + textures). Used at build time by tools/export.html
 * to write assets/models/fisherman.glb. Bones are created with identity rest rotations (world-aligned);
 * each bone keeps its rest head→tail direction in userData.restDir for the runtime IK.
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  function geometry(m) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(m.pos.flat(), 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(m.nrm.flat(), 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(m.uv.flat(), 2));
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(m.skinIndex.flat(), 4));
    g.setAttribute('skinWeight', new T.Float32BufferAttribute(m.skinWeight.flat(), 4));
    g.setIndex(m.index); g.computeVertexNormals(); return g;
  }
  function build(data, images) {
    const man = new T.Group(); man.name = 'fisherman';
    const bones = {}, list = [];
    for (const b of data.bones) { const bone = new T.Bone(); bone.name = b.name; bone.userData.head = b.head; bone.userData.restDir = new T.Vector3(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]).toArray(); bones[b.name] = bone; list.push(bone); }
    for (const b of data.bones) { const bone = bones[b.name]; if (b.parent) { const p = data.bones.find(x => x.name === b.parent); bone.position.set(b.head[0] - p.head[0], b.head[1] - p.head[1], b.head[2] - p.head[2]); bones[b.parent].add(bone); } else { bone.position.set(b.head[0], b.head[1], b.head[2]); man.add(bone); } }
    man.updateMatrixWorld(true);
    const skeleton = new T.Skeleton(list);
    const tex = name => { const t = new T.Texture(images[name]); t.encoding = T.sRGBEncoding; t.needsUpdate = true; t.anisotropy = 4; return t; };
    const cloth = (name, map, rough) => new T.MeshStandardMaterial({ map: tex(map), roughness: rough, alphaTest: 0.5, side: T.DoubleSide, name });
    const mats = {
      skin: new T.MeshStandardMaterial({ map: tex('skin'), roughness: 0.5, metalness: 0, name: 'angler-skin' }),
      shirt: cloth('angler-shirt', 'shirt', 0.9), trousers: cloth('angler-trousers', 'trousers', 0.92), vest: cloth('angler-lifejacket', 'vest', 0.6),
      eyes: new T.MeshStandardMaterial({ map: tex('eyes'), roughness: 0.25, name: 'angler-eyes' }),
      cornea: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false, name: 'angler-cornea' })
    };
    for (const [name, m] of Object.entries(data.meshes)) {
      const mesh = new T.SkinnedMesh(geometry(m), mats[name]); mesh.name = 'angler-' + name; mesh.castShadow = !['eyes', 'cornea'].includes(name); mesh.receiveShadow = true; mesh.frustumCulled = false;
      man.add(mesh); mesh.bind(skeleton);
    }
    // deck shoes: parametric leather upper + rubber sole, rigidly attached to each foot bone
    const leather = new T.MeshStandardMaterial({ color: '#5b3d27', roughness: 0.45, name: 'shoe-leather' }), rubber = new T.MeshStandardMaterial({ color: '#e8e4da', roughness: 0.8, name: 'shoe-sole' }), lace = new T.MeshStandardMaterial({ color: '#c9b48c', roughness: 0.8, name: 'shoe-lace' });
    for (const sd of ['L', 'R']) {
      const f = data.feet[sd], foot = bones['foot_' + sd], a = foot.userData.head; if (!foot) continue;
      const z0 = f.min[2] - 0.014, z1 = f.max[2] + 0.016, cx = (f.min[0] + f.max[0]) / 2, W = (f.max[0] - f.min[0]) / 2 + 0.012, NS = 28, NR = 20, pos = [], idx = [];
      const width = u => W * (0.72 + 0.28 * Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.1))) * (u > 0.86 ? Math.sqrt(Math.max(0.02, 1 - ((u - 0.86) / 0.15) ** 2)) : 1) * (u < 0.08 ? Math.sqrt(Math.max(0.15, u / 0.08)) : 1);
      const height = u => 0.016 + (u < 0.3 ? 0.062 : u < 0.6 ? 0.062 + 0.012 * Math.sin((u - 0.3) / 0.3 * Math.PI) : 0.062 * (1 - (u - 0.6) / 0.4) + 0.03 * ((u - 0.6) / 0.4)) * (u > 0.96 ? Math.max(0.3, (1 - u) / 0.04) : 1);
      for (let i = 0; i <= NS; i++) { const u = i / NS, w = width(u), h = height(u), z = z0 + (z1 - z0) * u, xo = cx + (sd === 'L' ? -1 : 1) * 0.006 * Math.sin(u * Math.PI);
        for (let j = 0; j <= NR; j++) { const th = j / NR * Math.PI; pos.push(xo + Math.cos(th) * w - a[0], 0.016 + (h - 0.016) * Math.pow(Math.sin(th), 0.6) - a[1], z - a[2]); } }
      for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const p0 = i * (NR + 1) + j, p1 = p0 + 1, p2 = p0 + NR + 1, p3 = p2 + 1; idx.push(p0, p1, p2, p1, p3, p2); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const upper = new T.Mesh(g, leather); upper.name = 'shoe-upper-' + sd; upper.castShadow = true; foot.add(upper);
      const outline = new T.Shape(); for (let i = 0; i <= 40; i++) { const u = i / 40; const w = width(u) + 0.004; const z = z0 - 0.004 + (z1 - z0 + 0.008) * u; i ? outline.lineTo(cx + w, z) : outline.moveTo(cx + w, z); } for (let i = 40; i >= 0; i--) { const u = i / 40; const w = width(u) + 0.004; outline.lineTo(cx - w, z0 - 0.004 + (z1 - z0 + 0.008) * u); }
      const sg = new T.ExtrudeGeometry(outline, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2, curveSegments: 4 }); sg.rotateX(Math.PI / 2); sg.translate(-a[0], 0.022 - a[1], -a[2]);
      const sole = new T.Mesh(sg, rubber); sole.name = 'shoe-sole-' + sd; sole.castShadow = true; foot.add(sole);
      for (let k = 0; k < 3; k++) { const u = 0.42 + k * 0.08, z = z0 + (z1 - z0) * u; const l = new T.Mesh(new T.BoxGeometry(width(u) * 0.9, 0.004, 0.006), lace); l.position.set(cx - a[0], height(u) + 0.002 - a[1], z - a[2]); foot.add(l); }
    }
    man.userData = { rig: 'makehuman-default-reduced', height: data.height };
    return man;
  }
  root.FishingSkinnedAngler = { build };
})(typeof window !== 'undefined' ? window : globalThis);
