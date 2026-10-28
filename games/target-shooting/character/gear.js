/* Target Shooting 3D — archery equipment (original procedural models).
 * Olympic-style recurve: 68" (1.70 m) bow, 25" riser, limbs that flex with the draw, a string built from
 * two segments that always end exactly at the limb tips and at the nocking point, a long stabiliser and a
 * sight. Arrow: 0.74 m carbon shaft, steel point, three vanes, nock. Arm guard on the bow forearm and a hip
 * quiver are parented to bones so they move with the skeleton and never float.
 *
 * Bow local frame: origin at the grip pivot point (where the palm presses), +Y up the bow, −Z toward the
 * target, +Z toward the archer (the string side), +X toward the archer's chest side.
 */
(function (root) {
  'use strict';
  const T = root.THREE, TS = root.TS;
  const BOW = { riserHalf: 0.32, limbLen: 0.53, brace: 0.215, gripToShelf: 0.045, arrowLen: 0.74, grip: [0.021, -0.022, 0.034] };

  function mats(accent) {
    return {
      riser: new T.MeshStandardMaterial({ color: 0x23262b, metalness: 0.75, roughness: 0.32 }),
      riserAccent: new T.MeshStandardMaterial({ color: new T.Color(accent), metalness: 0.55, roughness: 0.35 }),
      grip: new T.MeshStandardMaterial({ color: 0x3a2a20, metalness: 0, roughness: 0.75 }),
      limb: new T.MeshStandardMaterial({ color: 0x15171a, metalness: 0.2, roughness: 0.42 }),
      limbFace: new T.MeshStandardMaterial({ color: 0xe9e6df, metalness: 0.1, roughness: 0.5 }),
      string: new T.MeshStandardMaterial({ color: 0xf2efe8, metalness: 0, roughness: 0.6 }),
      serving: new T.MeshStandardMaterial({ color: 0x111111, metalness: 0, roughness: 0.6 }),
      metal: new T.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.9, roughness: 0.25 }),
      carbon: new T.MeshStandardMaterial({ color: 0x1b1d21, metalness: 0.35, roughness: 0.38 }),
      vane: new T.MeshStandardMaterial({ color: new T.Color(accent), metalness: 0, roughness: 0.55, side: T.DoubleSide }),
      vaneCock: new T.MeshStandardMaterial({ color: 0xf4f1ea, metalness: 0, roughness: 0.55, side: T.DoubleSide }),
      nock: new T.MeshStandardMaterial({ color: 0xff8a1e, metalness: 0, roughness: 0.4 }),
      leather: new T.MeshStandardMaterial({ color: 0x2b211b, metalness: 0, roughness: 0.82, side: T.DoubleSide }),
      leatherLight: new T.MeshStandardMaterial({ color: 0x6b4a33, metalness: 0, roughness: 0.75, side: T.DoubleSide })
    };
  }

  function shadow(o) { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }

  /** Limb: a tapered, recurved strip in the YZ plane, from the limb pocket (local origin) outward. */
  function limbGeometry() {
    const pts = [];
    const N = 22;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // centreline: rises, bows slightly toward the target, then recurves back toward the archer at the tip
      const y = BOW.limbLen * t;
      const z = -0.075 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + (t > 0.78 ? 0.11 * Math.pow((t - 0.78) / 0.22, 2) : 0);
      pts.push(new T.Vector2(y, z));
    }
    const pos = [], idx = [], nrm = [];
    const ring = 4;
    for (let i = 0; i <= N; i++) {
      const t = i / N, w = 0.046 * (1 - t) + 0.017 * t, th = 0.0125 * (1 - t) + 0.007 * t;
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      const ty = b.x - a.x, tz = b.y - a.y, L = Math.hypot(ty, tz) || 1;
      const ny = -tz / L, nz = ty / L;   // normal in the YZ plane
      const c = pts[i];
      const corners = [[-w / 2, -th / 2], [w / 2, -th / 2], [w / 2, th / 2], [-w / 2, th / 2]];
      for (const [x, o] of corners) { pos.push(x, c.x + ny * o, c.y + nz * o); nrm.push(0, 0, 0); }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < ring; k++) {
      const a = i * ring + k, b = i * ring + (k + 1) % ring, c = (i + 1) * ring + (k + 1) % ring, d = (i + 1) * ring + k;
      idx.push(a, b, c, a, c, d);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const tip = pts[N];
    return { geometry: g, tip: new T.Vector3(0, tip.x, tip.y) };
  }

  function riserGeometry() {
    // side profile in (z, y): handle bulges toward the archer, sight window cut above the shelf
    const s = new T.Shape();
    const H = BOW.riserHalf;
    s.moveTo(-0.010, -H);
    s.lineTo(0.030, -H + 0.02);
    s.quadraticCurveTo(0.028, -0.17, 0.040, -0.075);   // lower riser to grip throat
    s.quadraticCurveTo(0.070, -0.02, 0.040, 0.025);    // grip (palm side bulge)
    s.lineTo(0.012, 0.032);                            // arrow shelf
    s.lineTo(0.012, 0.17);                             // sight window (cut toward target)
    s.quadraticCurveTo(0.030, 0.25, 0.030, H - 0.02);
    s.lineTo(-0.010, H);
    s.quadraticCurveTo(-0.048, 0.12, -0.040, 0.0);
    s.quadraticCurveTo(-0.046, -0.14, -0.010, -H);
    const g = new T.ExtrudeGeometry(s, { depth: 0.030, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
    // shape is in XY with extrusion along Z: map shape-x -> bow z, shape-y -> bow y, extrusion -> bow x
    g.applyMatrix4(new T.Matrix4().makeBasis(new T.Vector3(0, 0, 1), new T.Vector3(0, 1, 0), new T.Vector3(1, 0, 0)));
    g.translate(0.006, 0, 0);   // riser body on the chest side (+X); the arrow passes at x = 0
    g.computeVertexNormals();
    return g;
  }

  class Bow {
    constructor(accent) {
      const m = this.m = mats(accent);
      this.group = new T.Group(); this.group.name = 'bow';
      const riser = new T.Mesh(riserGeometry(), m.riser); this.group.add(riser);
      const grip = new T.Mesh(new T.CylinderGeometry(0.021, 0.023, 0.09, 14), m.grip);
      grip.position.set(0.021, -0.022, 0.036); grip.scale.set(1, 1, 0.8); this.group.add(grip);
      // accent bands, sight bar + pin, stabiliser
      for (const y of [0.24, -0.24]) { const band = new T.Mesh(new T.BoxGeometry(0.036, 0.018, 0.05), m.riserAccent); band.position.set(0.021, y, -0.01); this.group.add(band); }
      const sightBar = new T.Mesh(new T.BoxGeometry(0.01, 0.012, 0.24), m.metal); sightBar.position.set(-0.03, 0.2, -0.12); this.group.add(sightBar);
      const sightBlock = new T.Mesh(new T.BoxGeometry(0.014, 0.05, 0.016), m.riser); sightBlock.position.set(-0.03, 0.18, -0.24); this.group.add(sightBlock);
      const pin = new T.Mesh(new T.SphereGeometry(0.006, 10, 8), new T.MeshBasicMaterial({ color: 0x9cff3a })); pin.position.set(-0.03, 0.155, -0.24); this.group.add(pin);
      const rod = new T.Mesh(new T.CylinderGeometry(0.0065, 0.0065, 0.7, 10), m.carbon); rod.rotation.x = Math.PI / 2; rod.position.set(0.021, -0.09, -0.38); this.group.add(rod);
      const weight = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.06, 14), m.metal); weight.rotation.x = Math.PI / 2; weight.position.set(0.021, -0.09, -0.74); this.group.add(weight);
      const rest = new T.Mesh(new T.BoxGeometry(0.03, 0.004, 0.012), m.metal); rest.position.set(0.006, BOW.gripToShelf, 0.0); this.group.add(rest);
      // limbs pivot at the limb pockets
      const lg = limbGeometry();
      this.limbTipLocal = lg.tip;
      this.upper = new T.Group(); this.upper.position.set(0.021, BOW.riserHalf - 0.02, -0.005);
      this.lower = new T.Group(); this.lower.position.set(0.021, -BOW.riserHalf + 0.02, -0.005); this.lower.scale.y = -1;
      for (const g of [this.upper, this.lower]) {
        g.add(new T.Mesh(lg.geometry, m.limb));
        const face = new T.Mesh(new T.BoxGeometry(0.03, 0.18, 0.002), m.limbFace); face.position.set(0, 0.16, 0.002); g.add(face);
        this.group.add(g);
      }
      // string: upper and lower segments + centre serving
      const sg = new T.CylinderGeometry(0.0012, 0.0012, 1, 6); sg.translate(0, 0.5, 0);
      this.strU = new T.Mesh(sg, m.string); this.strL = new T.Mesh(sg, m.string);
      this.serving = new T.Mesh(new T.CylinderGeometry(0.0019, 0.0019, 0.11, 6), m.serving);
      this.nockPoint = new T.Mesh(new T.SphereGeometry(0.003, 8, 6), m.serving);
      for (const o of [this.strU, this.strL, this.serving, this.nockPoint]) this.group.add(o);
      shadow(this.group);
      [this.strU, this.strL, this.serving, this.nockPoint].forEach(o => { o.castShadow = false; });
      this.flex = 0; this.vib = 0; this.vibT = 0;
      this.tipU = new T.Vector3(); this.tipL = new T.Vector3();
      this.nockLocal = new T.Vector3(0, BOW.gripToShelf + 0.004, BOW.brace);
      this.setString(new T.Vector3(0, BOW.gripToShelf + 0.004, BOW.brace));
    }
    /** Limb flex 0..1 (0 = braced, 1 = full draw) — rigid limb rotation about the pocket. */
    setFlex(f) {
      this.flex = f;
      const a = 0.17 * f;
      this.upper.rotation.x = a; this.lower.rotation.x = a;
    }
    /** tips in bow-local space for the current flex */
    tips() {
      this.group.updateMatrixWorld(false);
      this.upper.updateMatrix(); this.lower.updateMatrix();
      this.tipU.copy(this.limbTipLocal).applyMatrix4(this.upper.matrix);
      this.tipL.copy(this.limbTipLocal).applyMatrix4(this.lower.matrix);
      return [this.tipU, this.tipL];
    }
    /** Brace-height nocking point (bow local) for the current flex. */
    restNock(out) { return out.set(0, BOW.gripToShelf + 0.004, BOW.brace); }
    /** Put the string through the nocking point (bow-local). */
    setString(nockLocal) {
      this.nockLocal.copy(nockLocal);
      const [u, l] = this.tips();
      seg(this.strU, nockLocal, u); seg(this.strL, nockLocal, l);
      this.serving.position.copy(nockLocal);
      const dir = new T.Vector3().subVectors(u, l).normalize();
      this.serving.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
      this.nockPoint.position.copy(nockLocal);
    }
    dispose() { this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); Object.values(this.m).forEach(m => m.dispose()); }
  }
  const _y = new T.Vector3(0, 1, 0), _d = new T.Vector3();
  function seg(mesh, a, b) {
    _d.subVectors(b, a); const L = _d.length();
    mesh.position.copy(a); mesh.scale.set(1, Math.max(1e-4, L), 1);
    mesh.quaternion.setFromUnitVectors(_y, _d.multiplyScalar(1 / Math.max(1e-6, L)));
  }

  /** Arrow: local origin at the nock throat, pointing along +Z, tip at +BOW.arrowLen. Shared geometry. */
  let arrowGeo = null;
  function arrowParts() {
    if (arrowGeo) return arrowGeo;
    const L = BOW.arrowLen;
    const shaft = new T.CylinderGeometry(0.0034, 0.0034, L - 0.03, 8); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, (L - 0.03) / 2 + 0.01);
    const point = new T.ConeGeometry(0.0045, 0.03, 10); point.rotateX(Math.PI / 2); point.translate(0, 0, L - 0.015);
    const pointBase = new T.CylinderGeometry(0.0045, 0.0045, 0.012, 10); pointBase.rotateX(Math.PI / 2); pointBase.translate(0, 0, L - 0.035);
    const nock = new T.CylinderGeometry(0.0042, 0.0042, 0.016, 8); nock.rotateX(Math.PI / 2); nock.translate(0, 0, 0.004);
    const vs = new T.Shape(); vs.moveTo(0, 0); vs.lineTo(0.065, 0); vs.quadraticCurveTo(0.03, 0.02, 0.0, 0.016); vs.lineTo(0, 0);
    const vane = new T.ShapeGeometry(vs, 4); // in XY plane: x along arrow, y outward
    vane.applyMatrix4(new T.Matrix4().makeBasis(new T.Vector3(0, 0, 1), new T.Vector3(0, 1, 0), new T.Vector3(1, 0, 0)));
    vane.translate(0, 0.0034, 0.03);
    arrowGeo = { shaft, point, pointBase, nock, vane };
    return arrowGeo;
  }
  function makeArrow(m) {
    const g = arrowParts(), o = new T.Group(); o.name = 'arrow';
    o.add(new T.Mesh(g.shaft, m.carbon), new T.Mesh(g.point, m.metal), new T.Mesh(g.pointBase, m.metal), new T.Mesh(g.nock, m.nock));
    for (let i = 0; i < 3; i++) { const v = new T.Mesh(g.vane, i === 0 ? m.vaneCock : m.vane); v.rotation.z = i * Math.PI * 2 / 3 + Math.PI / 2; o.add(v); }
    o.traverse(x => { if (x.isMesh) x.castShadow = true; });
    return o;
  }

  /** Equipment parented to bones (computed from the bind pose so it sits on the body, not in it). */
  function equip(rig, m) {
    const b = rig.bones, made = [];
    rig.root.updateMatrixWorld(true);
    function attach(bone, obj, worldPos, worldQuat) {
      const inv = new T.Matrix4().copy(bone.matrixWorld).invert();
      const M = new T.Matrix4().compose(worldPos, worldQuat, new T.Vector3(1, 1, 1)).premultiply(inv);
      M.decompose(obj.position, obj.quaternion, obj.scale);
      bone.add(obj); made.push(obj);
    }
    // arm guard: open shell around the bow forearm (inner side, where the string passes)
    {
      const e = rig.rest.L_Forearm.wp, h = rig.rest.L_Hand.wp;
      const dir = new T.Vector3().subVectors(h, e).normalize();
      const len = e.distanceTo(h);
      const g = new T.CylinderGeometry(0.041, 0.035, len * 0.62, 18, 1, true, -Math.PI * 0.72, Math.PI * 1.44);
      const guard = new T.Mesh(g, m.leather);
      const strap1 = new T.Mesh(new T.TorusGeometry(0.039, 0.004, 6, 20), m.leatherLight);
      const strap2 = strap1.clone(); strap1.position.y = len * 0.17; strap2.position.y = -len * 0.2; strap2.scale.setScalar(0.92);
      guard.add(strap1, strap2); strap1.rotation.x = strap2.rotation.x = Math.PI / 2;
      const pos = e.clone().addScaledVector(dir, len * 0.56);
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
      // open side faces away from the inner forearm (bind: palm faces −X/back) — the leather covers the inner face
      q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI));
      attach(b.L_Forearm, shadow(guard), pos, q);
    }
    // hip quiver on the right side, slightly forward, tilted forward/out
    {
      const quiver = new T.Group(); quiver.name = 'quiver';
      const tube = new T.Mesh(new T.CylinderGeometry(0.05, 0.036, 0.42, 16, 1, true), m.leather); tube.position.y = -0.1;
      const bottom = new T.Mesh(new T.CircleGeometry(0.036, 16), m.leather); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.31;
      const rim = new T.Mesh(new T.TorusGeometry(0.05, 0.005, 6, 20), m.leatherLight); rim.rotation.x = Math.PI / 2; rim.position.y = 0.11;
      const pocket = new T.Mesh(new T.BoxGeometry(0.05, 0.18, 0.03), m.leatherLight); pocket.position.set(0, -0.1, 0.05);
      quiver.add(tube, bottom, rim, pocket);
      // arrows in the quiver (fletchings out of the top)
      quiver.userData.arrows = [];
      for (let i = 0; i < 5; i++) {
        const a = makeArrow(m); a.scale.setScalar(1);
        a.position.set(Math.cos(i * 1.3) * 0.022, 0.2 - 0.03 * (i % 2), Math.sin(i * 1.3) * 0.022);
        a.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(0, -1, 0));
        a.position.y += 0.0; quiver.add(a); quiver.userData.arrows.push(a);
      }
      const pos = new T.Vector3(-0.21, 0.79, 0.07);
      const q = new T.Quaternion().setFromEuler(new T.Euler(0.22, 0, -0.16));
      attach(b.Pelvis, shadow(quiver), pos, q);
      rig.quiver = quiver;
    }
    // belt (flat ring hugging the hips under the shirt hem)
    {
      const belt = new T.Mesh(new T.CylinderGeometry(0.168, 0.168, 0.035, 28, 1, true), m.leather);
      belt.scale.set(1, 1, 0.78);
      attach(b.Pelvis, shadow(belt), new T.Vector3(0, 0.93, -0.004), new T.Quaternion());
    }
    return made;
  }

  TS.Gear = { BOW, mats, Bow, makeArrow, equip };
})(typeof window !== 'undefined' ? window : globalThis);
