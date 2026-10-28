/* صيد الأسماك V24 — procedural tackle: spinning reel, rod grip, guides, float, sinker, hook, shrimp bait, landing net.
 * Original geometry. Exported to assets/models/tackle.glb by tools/build-assets.cjs (this builder is the fallback).
 * Rod-local frame for grip/reel: +Y = along the rod towards the tip, +Z = "up" side of the blank, +X = angler's right.
 */
(function (root) {
  'use strict';
  const T = root.THREE;
  const M = (o) => new T.MeshStandardMaterial(o);
  function lathe(profile, seg, mat) { return new T.Mesh(new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), seg), mat); }
  function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }

  function buildReel() {
    const reel = new T.Group(); reel.name = 'reel';
    const body = M({ color: '#2a2f35', roughness: 0.35, metalness: 0.55, name: 'reel-body' }), alu = M({ color: '#b9bec3', roughness: 0.25, metalness: 0.85, name: 'reel-alu' }), gold = M({ color: '#b78b3c', roughness: 0.3, metalness: 0.8, name: 'reel-trim' });
    const lineMat = M({ map: tex(64, 64, (g) => { g.fillStyle = '#d8e6e2'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 64; i += 2) { g.fillStyle = i % 4 ? '#c3d6d2' : '#eef6f3'; g.fillRect(0, i, 64, 1); } }), roughness: 0.4, name: 'reel-line' });
    const stem = new T.Mesh(new T.BoxGeometry(0.012, 0.03, 0.062), body); stem.position.set(0, -0.005, -0.031); reel.add(stem);
    const foot = new T.Mesh(new T.BoxGeometry(0.014, 0.07, 0.006), body); foot.position.set(0, 0, -0.002); reel.add(foot);
    const box = new T.Mesh(new T.SphereGeometry(0.03, 20, 14), body); box.scale.set(0.9, 1.15, 1.0); box.position.set(0, -0.012, -0.085); reel.add(box);
    const cap = new T.Mesh(new T.CylinderGeometry(0.021, 0.021, 0.012, 20), gold); cap.rotation.z = Math.PI / 2; cap.position.set(0.027, -0.012, -0.085); reel.add(cap);
    const rotor = new T.Group(); rotor.name = 'reel-rotor'; rotor.position.set(0, 0.022, -0.085); reel.add(rotor);
    const cup = lathe([[0.012, 0], [0.03, 0.004], [0.031, 0.018], [0.024, 0.024]], 22, body); rotor.add(cup);
    [-1, 1].forEach(s => { const arm = new T.Mesh(new T.BoxGeometry(0.006, 0.028, 0.008), alu); arm.position.set(s * 0.03, 0.022, 0); rotor.add(arm); });
    const bail = new T.Group(); bail.name = 'reel-bail'; bail.position.set(0, 0.034, 0); rotor.add(bail);
    const wire = new T.Mesh(new T.TorusGeometry(0.031, 0.0016, 6, 24, Math.PI), alu); wire.rotation.y = Math.PI / 2; wire.rotation.x = Math.PI / 2; wire.position.y = 0.004; bail.add(wire);
    const roller = new T.Mesh(new T.CylinderGeometry(0.0035, 0.0035, 0.008, 8), gold); roller.position.set(0.03, 0.004, 0); bail.add(roller);
    const spool = new T.Group(); spool.name = 'reel-spool'; spool.position.set(0, 0.046, -0.085); reel.add(spool);
    const sp = lathe([[0.012, -0.004], [0.026, -0.002], [0.027, 0.0], [0.024, 0.002], [0.024, 0.026], [0.028, 0.028], [0.028, 0.032], [0.012, 0.034]], 24, alu); spool.add(sp);
    const wrap = new T.Mesh(new T.CylinderGeometry(0.0255, 0.0255, 0.022, 24, 1, true), lineMat); wrap.position.y = 0.015; spool.add(wrap);
    const crank = new T.Group(); crank.name = 'reel-crank'; crank.position.set(-0.072, 0, -0.085); reel.add(crank);
    const axle = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.044, 8), alu); axle.rotation.z = Math.PI / 2; axle.position.x = 0.022; crank.add(axle);
    const arm = new T.Mesh(new T.BoxGeometry(0.006, 0.056, 0.008), alu); arm.position.set(0, 0.026, 0); crank.add(arm);
    const knob = new T.Group(); knob.name = 'reel-knob'; knob.position.set(-0.008, 0.052, 0); crank.add(knob);
    const k = lathe([[0.0, -0.014], [0.009, -0.012], [0.011, 0.0], [0.009, 0.012], [0.0, 0.014]], 14, M({ color: '#1b1d20', roughness: 0.6 })); k.rotation.z = Math.PI / 2; knob.add(k);
    reel.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return reel;
  }
  function buildGrip() { // rigid butt section: butt cap → rear EVA grip → reel seat → cork fore-grip (rod-local +Y)
    const g = new T.Group(); g.name = 'rod-grip';
    const eva = M({ color: '#1d1f22', roughness: 0.85, name: 'grip-eva' }), cork = M({ map: tex(128, 128, (x) => { x.fillStyle = '#b8915f'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { x.fillStyle = ['#8f6a40', '#cfa774', '#a27b4b'][i % 3]; x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3, 1 + Math.random() * 2); } }), roughness: 0.9, name: 'grip-cork' }), seat = M({ color: '#3a4148', roughness: 0.3, metalness: 0.6, name: 'reel-seat' }), cap = M({ color: '#111', roughness: 0.5 });
    const part = (prof, mat) => { const m = lathe(prof, 18, mat); m.castShadow = true; g.add(m); return m; };
    part([[0.0, 0.0], [0.016, 0.002], [0.017, 0.02]], cap);
    part([[0.016, 0.02], [0.0165, 0.12], [0.0155, 0.25], [0.013, 0.3]], eva);
    part([[0.0105, 0.3], [0.0115, 0.31], [0.0115, 0.39], [0.0105, 0.4]], seat);
    part([[0.0125, 0.4], [0.014, 0.44], [0.0135, 0.5], [0.0095, 0.54]], cork);
    part([[0.0072, 0.54], [0.0068, 0.62]], seat);
    return g;
  }
  function buildGuide() { const g = new T.Group(); g.name = 'rod-guide'; const metal = M({ color: '#9aa2a9', roughness: 0.25, metalness: 0.9 }), ring = M({ color: '#2d3a42', roughness: 0.2, metalness: 0.3 }); const r = new T.Mesh(new T.TorusGeometry(1, 0.18, 6, 16), ring); r.rotation.x = Math.PI / 2; r.position.z = -1.6; g.add(r); const f = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 1.6, 5), metal); f.rotation.x = Math.PI / 2; f.position.z = -0.8; g.add(f); return g; }
  function buildFloat() {
    const f = new T.Group(); f.name = 'float';
    const red = M({ color: '#e0321f', roughness: 0.35, name: 'float-red' }), white = M({ color: '#f4f1e6', roughness: 0.4, name: 'float-white' }), dark = M({ color: '#1a1c1e', roughness: 0.5 }), yel = M({ color: '#f0c02c', roughness: 0.35, emissive: '#3a2a00' });
    const lower = lathe([[0.0, -0.045], [0.004, -0.04], [0.012, -0.02], [0.016, 0.0]], 18, white); f.add(lower);
    const upper = lathe([[0.016, 0.0], [0.014, 0.014], [0.009, 0.028], [0.0035, 0.036]], 18, red); f.add(upper);
    const band = new T.Mesh(new T.CylinderGeometry(0.0162, 0.0162, 0.004, 18), dark); f.add(band);
    const ant = new T.Mesh(new T.CylinderGeometry(0.0018, 0.0022, 0.05, 6), yel); ant.position.y = 0.06; f.add(ant);
    const eye = new T.Mesh(new T.TorusGeometry(0.003, 0.0008, 4, 8), dark); eye.position.y = -0.048; f.add(eye);
    f.traverse(o => { if (o.isMesh) o.castShadow = true; }); return f;
  }
  function buildSinker() { const s = new T.Mesh(new T.SphereGeometry(0.0065, 12, 8), M({ color: '#6f757b', roughness: 0.45, metalness: 0.6, name: 'lead' })); s.name = 'sinker'; return s; }
  function buildHook() { // eye at origin, shank down (-Y), bend + barb
    const h = new T.Group(); h.name = 'hook'; const steel = M({ color: '#c5ccd2', roughness: 0.2, metalness: 0.95, name: 'hook-steel' });
    const eye = new T.Mesh(new T.TorusGeometry(0.0022, 0.0006, 5, 10), steel); h.add(eye);
    const shank = new T.Mesh(new T.CylinderGeometry(0.00065, 0.00065, 0.022, 6), steel); shank.position.y = -0.0132; h.add(shank);
    const bend = new T.Mesh(new T.TorusGeometry(0.0055, 0.00065, 5, 14, Math.PI * 1.15), steel); bend.position.set(0.0055, -0.0242, 0); bend.rotation.z = Math.PI; h.add(bend);
    const point = new T.Mesh(new T.ConeGeometry(0.0009, 0.007, 5), steel); point.position.set(0.0118, -0.019, 0); h.add(point);
    const bait = new T.Group(); bait.name = 'bait'; h.add(bait);
    const shrimp = M({ color: '#e9a690', roughness: 0.45, transparent: true, opacity: 0.94, name: 'shrimp' });
    for (let i = 0; i < 7; i++) { const a = -0.3 + i * 0.36, r = 0.012; const seg = new T.Mesh(new T.SphereGeometry(0.0042 - i * 0.00035, 10, 8), shrimp); seg.position.set(0.004 + Math.cos(a) * r, -0.016 + Math.sin(a) * r, 0); seg.scale.set(1.25, 1, 0.9); bait.add(seg); }
    const tail = new T.Mesh(new T.ConeGeometry(0.003, 0.007, 4), shrimp); tail.position.set(-0.007, -0.006, 0); tail.rotation.z = 1.2; bait.add(tail);
    for (let i = 0; i < 2; i++) { const ant = new T.Mesh(new T.CylinderGeometry(0.0003, 0.0003, 0.03, 3), shrimp); ant.position.set(0.016, -0.004, (i - 0.5) * 0.004); ant.rotation.z = -0.9; bait.add(ant); }
    return h;
  }
  function netTexture() { return tex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#2f3b3a'; g.lineWidth = 3; for (let i = -w; i < w * 2; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); } }); }
  function buildNet() { // origin = hoop centre, hoop in local XZ, bag hangs -Y, handle leaves the rim at +Z rising 30°
    const n = new T.Group(); n.name = 'landing-net';
    const alu = M({ color: '#aeb5ba', roughness: 0.3, metalness: 0.85 }), black = M({ color: '#15181b', roughness: 0.7 });
    const hoop = new T.Mesh(new T.TorusGeometry(0.27, 0.008, 6, 40), alu); hoop.rotation.x = Math.PI / 2; n.add(hoop);
    const t = netTexture(); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(4, 2); t.encoding = T.LinearEncoding;
    const bagGeo = new T.LatheGeometry([[0.27, 0], [0.25, -0.12], [0.19, -0.26], [0.1, -0.36], [0.0, -0.39]].map(([r, y]) => new T.Vector2(r, y)), 24);
    const bag = new T.Mesh(bagGeo, M({ map: t, alphaMap: t, color: '#3a4746', transparent: true, alphaTest: 0.2, side: T.DoubleSide, roughness: 0.9, name: 'net-mesh' })); bag.name = 'net-bag'; n.add(bag);
    const handle = new T.Group(); handle.name = 'net-handle'; handle.position.set(0, 0, 0.27); handle.rotation.x = Math.PI / 3; n.add(handle);
    const tube = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 1, 10), alu); tube.position.y = 0.5; tube.name = 'net-tube'; handle.add(tube);
    const yoke = new T.Mesh(new T.CylinderGeometry(0.02, 0.012, 0.08, 8), black); yoke.position.y = 0.03; handle.add(yoke);
    const gripPivot = new T.Group(); gripPivot.name = 'net-grip-pivot'; gripPivot.position.y = 1; handle.add(gripPivot);
    const grip = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.22, 10), black); grip.name = 'net-grip'; grip.position.y = -0.05; gripPivot.add(grip);
    return n;
  }
  function build() { const g = new T.Group(); g.name = 'tackle'; [buildReel(), buildGrip(), buildGuide(), buildFloat(), buildSinker(), buildHook(), buildNet()].forEach(o => g.add(o)); return g; }
  root.FishingTackleModel = { build, buildReel, buildGrip, buildGuide, buildFloat, buildSinker, buildHook, buildNet };
})(typeof window !== 'undefined' ? window : globalThis);
