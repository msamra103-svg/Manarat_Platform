/* Ball visual: procedural panel texture (truncated-icosahedron pentagons + seams), orientation from the physics spin, contact shadow blob. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE;

  function ballTexture() {
    const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    const phi = (1 + Math.sqrt(5)) / 2, raw = [];
    for (const a of [-1, 1]) for (const b of [-phi, phi]) { raw.push([0, a, b], [a, b, 0], [b, 0, a]); }
    const verts = raw.map(v => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; });
    for (let j = 0; j < H; j++) {
      const lat = (0.5 - (j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < W; i++) {
        const lon = ((i + 0.5) / W - 0.5) * Math.PI * 2, dx = cl * Math.sin(lon), dy = sl, dz = cl * Math.cos(lon);
        let best = -1, second = -1; for (const v of verts) { const dd = dx * v[0] + dy * v[1] + dz * v[2]; if (dd > best) { second = best; best = dd; } else if (dd > second) second = dd; }
        const ang = Math.acos(Math.min(1, best)), seam = Math.abs(best - second);       // seam: ridge midway between neighbouring pentagon centres
        let r = 244, g = 242, b = 236;
        if (ang < 0.355) { r = 22; g = 22; b = 28; if (ang > 0.318) { r = 70; g = 18; b = 40; } }              // pentagon (maroon edge-piping)
        else if (ang < 0.385) { r = 120; g = 112; b = 112; }
        else if (seam < 0.05) { const k = seam / 0.05; r = g = b = 150 + 94 * k; }
        else { const sh = 1 - 0.05 * (ang / 0.7); r *= sh; g *= sh; b *= sh * 0.98; }
        const o = (j * W + i) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function blobTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
  }

  function create(scene) {
    const R = FB.PITCH.ballR, tex = ballTexture();
    const mat = new T.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.0 });
    const mesh = new T.Mesh(new T.SphereGeometry(R, 40, 28), mat); mesh.castShadow = true; mesh.receiveShadow = false; mesh.name = 'ball'; scene.add(mesh);
    const bt = blobTexture(), blob = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    blob.rotation.x = -Math.PI / 2; blob.renderOrder = 2; scene.add(blob);
    return {
      mesh, blob,
      /** v = {x,y,z,q:[x,y,z,w]} or a FB.Ball */
      set(p, q) { mesh.position.set(p.x, p.y, p.z); if (q.isQuaternion) mesh.quaternion.copy(q); else mesh.quaternion.set(q[0], q[1], q[2], q[3]); const h = Math.max(0, p.y - R), s = 0.34 + h * 0.18; blob.position.set(p.x, 0.012, p.z); blob.scale.set(s, s, 1); blob.material.opacity = Math.max(0.15, 1 - h * 0.32); },
      setBlob(on) { blob.visible = on; },
      dispose() { scene.remove(mesh, blob); mesh.geometry.dispose(); mat.dispose(); tex.dispose(); blob.geometry.dispose(); blob.material.dispose(); bt.dispose(); }
    };
  }
  FB.BallView = { create };
})(typeof window !== 'undefined' ? window : globalThis);
