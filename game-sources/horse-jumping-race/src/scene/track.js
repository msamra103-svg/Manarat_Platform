import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getTurfMaps, addMacroVariation, makeTextBanner, getFootprintTexture, QATAR_MAROON, bleedTransparent } from './textures.js';

// مضمار سباق الخيل العشبي المستقيم: الأرضية، السياج الأبيض، حواجز القفز (أسيجة الأغصان)،
// خطا الانطلاق والنهاية، لوحات المسافة، وآثار الحوافر على العشب.
const NEAR_POLE_Z = 18.5;
export const TRACK = {
  halfWidth: 12.5,
  railZ: 12.8,
  runOff: 180,
  startRunUp: 70,
};

export function buildTrack(scene, { finishX, quality, length: totalLen = 1400 }) {
  const group = new THREE.Group();
  group.name = 'track';
  scene.add(group);
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };
  const x0 = -TRACK.startRunUp, x1 = totalLen;
  const length = x1 - x0;

  // أرضية المضمار
  const sand = getTurfMaps('track');
  const map = keep(sand.map.clone()); map.needsUpdate = true; map.repeat.set(length / 7, (TRACK.halfWidth * 2 + 6) / 7);
  const nrm = keep(sand.normalMap.clone()); nrm.needsUpdate = true; nrm.repeat.copy(map.repeat);
  const trackMat = addMacroVariation(keep(new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, color: '#ffffff' })), 0.6);
  const surf = new THREE.Mesh(keep(new THREE.PlaneGeometry(length, TRACK.halfWidth * 2 + 6)), trackMat);
  surf.rotation.x = -Math.PI / 2;
  surf.position.set((x0 + x1) / 2, 0, 0);
  surf.receiveShadow = true;
  surf.name = 'trackSurface';
  group.add(surf);

  // الحواجز الجانبية: أعمدة بيضاء وقضيبان أفقيان
  const railMat = keep(new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.45, metalness: 0.3 }));
  const postGeo = keep(new THREE.CylinderGeometry(0.05, 0.05, 1.25, 8));
  const spacing = quality === 'low' ? 6 : 4;
  const nPosts = Math.ceil(length / spacing) + 1;
  const posts = new THREE.InstancedMesh(postGeo, railMat, nPosts * 2);
  const m = new THREE.Matrix4();
  let k = 0;
  for (const s of [1, -1]) {
    for (let i = 0; i < nPosts; i++) {
      m.makeTranslation(x0 + i * spacing, 0.62, s * TRACK.railZ);
      posts.setMatrixAt(k++, m);
    }
  }
  posts.castShadow = quality === 'high';
  group.add(posts);
  const railGeo = keep(new THREE.BoxGeometry(length, 0.09, 0.06));
  for (const s of [1, -1]) {
    for (const y of [0.62, 1.2]) {
      const r = new THREE.Mesh(railGeo, railMat);
      r.position.set((x0 + x1) / 2, y, s * TRACK.railZ);
      r.castShadow = quality === 'high';
      group.add(r);
    }
  }
  // شريط عنابي على الحاجز البعيد (هوية بصرية)
  const stripeMat = keep(new THREE.MeshStandardMaterial({ color: QATAR_MAROON, roughness: 0.6 }));
  const stripe = new THREE.Mesh(keep(new THREE.BoxGeometry(length, 0.22, 0.03)), stripeMat);
  stripe.position.set((x0 + x1) / 2, 0.91, TRACK.railZ + 0.04);
  group.add(stripe);
  const stripeNear = stripe.clone();
  stripeNear.position.z = -TRACK.railZ - 0.04;
  group.add(stripeNear);

  // خط الانطلاق وخط النهاية على الأرض
  const lineMat = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }));
  const lineGeo = keep(new THREE.PlaneGeometry(0.45, TRACK.halfWidth * 2));
  const startLine = new THREE.Mesh(lineGeo, lineMat);
  startLine.rotation.x = -Math.PI / 2;
  startLine.position.set(0, 0.012, 0);
  startLine.scale.x = 0.3; // خط جير رفيع على العشب
  group.add(startLine);
  // خط النهاية مقلّم (عنابي/أبيض)
  const chk = document.createElement('canvas');
  chk.width = 64; chk.height = 512;
  const cctx = chk.getContext('2d');
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 2; j++) {
      cctx.fillStyle = (i + j) % 2 ? QATAR_MAROON : '#ffffff';
      cctx.fillRect(j * 32, i * 32, 32, 32);
    }
  }
  const chkTex = keep(new THREE.CanvasTexture(chk));
  chkTex.colorSpace = THREE.SRGBColorSpace;
  const finishLine = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.0, TRACK.halfWidth * 2)), keep(new THREE.MeshStandardMaterial({ map: chkTex, roughness: 0.8 })));
  finishLine.rotation.x = -Math.PI / 2;
  finishLine.position.set(0, 0.013, 0);
  const finishGroup = new THREE.Group();
  finishGroup.name = 'finish';
  finishGroup.position.x = finishX;
  finishGroup.add(finishLine);
  group.add(finishGroup);

  // بوابتا الانطلاق والنهاية
  const gantry = (x, text, color) => {
    const g = new THREE.Group();
    const poleMat = keep(new THREE.MeshStandardMaterial({ color: '#d9d9d6', metalness: 0.6, roughness: 0.35 }));
    const poleGeo = keep(new THREE.CylinderGeometry(0.16, 0.2, 7.2, 12));
    for (const s of [1, -1]) {
      const p = new THREE.Mesh(poleGeo, poleMat);
      // العمود القريب أبعد من مسار الكاميرا الجانبية حتى لا يحجب حصان اللاعب
      p.position.set(0, 3.6, s > 0 ? TRACK.railZ + 0.6 : -NEAR_POLE_Z);
      p.castShadow = true;
      g.add(p);
    }
    const beamLen = TRACK.railZ + 0.6 + NEAR_POLE_Z;
    const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 0.5, beamLen)), poleMat);
    beam.position.set(0, 7.0, (TRACK.railZ + 0.6 - NEAR_POLE_Z) / 2);
    g.add(beam);
    const tex = keep(makeTextBanner(text, { bg: color, w: 2048, h: 256, font: '800 170px "QCR Cairo", Arial' }));
    const bannerMat = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); // وجه واحد لكل لافتة حتى لا يظهر النص معكوسًا
    const banner = new THREE.Mesh(keep(new THREE.PlaneGeometry(TRACK.railZ * 2 - 2, 1.6)), bannerMat);
    banner.position.set(0, 6.0, 0);
    banner.rotation.y = -Math.PI / 2; // يواجه الكاميرا القادمة من الجانب
    g.add(banner);
    // نسخة مقابلة للجهة الأخرى
    const banner2 = banner.clone();
    banner2.rotation.y = Math.PI / 2;
    banner2.position.x = 0.02;
    g.add(banner2);
    // لوحة على الجانب البعيد تواجه كاميرا المتابعة (لا شيء يحجبها)
    const sideTex = keep(makeTextBanner(text, { bg: color, w: 1024, h: 300, font: '800 150px "QCR Cairo", Arial' }));
    const farSign = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.6, 1.05)), keep(new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.6 })));
    farSign.position.set(-0.4, 5.0, TRACK.railZ - 0.3);
    farSign.rotation.y = Math.PI;
    g.add(farSign);
    g.position.x = x;
    group.add(g);
    return g;
  };
  gantry(0, 'خط الانطلاق', '#5b0f25');
  const finishGantry = gantry(0, 'خط النهاية', QATAR_MAROON);
  finishGroup.add(finishGantry);

  // أعمدة النهاية الملونة على الحاجزين
  const finPostMat = keep(new THREE.MeshStandardMaterial({ color: QATAR_MAROON, roughness: 0.5 }));
  for (const s of [1, -1]) {
    const fp = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 10)), finPostMat);
    fp.position.set(0, 1.3, s * (TRACK.railZ - 0.3));
    finishGroup.add(fp);
  }

  // لوحات المسافة من خط الانطلاق كل 100م على الحاجز البعيد
  const boardGeo = keep(new THREE.PlaneGeometry(2.2, 1.0));
  for (let d = 100; d < totalLen - 100; d += 100) {
    const tex = keep(makeTextBanner(`${toArabicDigits(d)} م`, { bg: '#ffffff', fg: QATAR_MAROON, w: 512, h: 232, font: '800 150px "QCR Cairo", Arial' }));
    const b = new THREE.Mesh(boardGeo, keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })));
    b.position.set(d, 2.0, TRACK.railZ + 0.5);
    b.rotation.y = Math.PI;
    group.add(b);
    const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6)), railMat);
    pole.position.set(d, 0.8, TRACK.railZ + 0.52);
    group.add(pole);
  }

  // علامات المراحل: عمودان بعلم عنابي ولوحة رقم المرحلة، تُحرّك إلى موضع المرحلة الحالية
  const stageMarkers = [];
  const stageGroup = new THREE.Group();
  group.add(stageGroup);
  const markerPoleGeo = keep(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8));
  const markerPoleMat = keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }));
  const getStageMarker = (index) => {
    if (stageMarkers[index]) return stageMarkers[index];
    const g = new THREE.Group();
    for (const s of [1, -1]) {
      if (s < 0) continue; // الجانب البعيد فقط حتى لا يحجب شيء الكاميرا
      const p = new THREE.Mesh(markerPoleGeo, markerPoleMat);
      p.position.set(0, 1.7, s * (TRACK.railZ - 0.4));
      g.add(p); // اللوحة على الجانب البعيد فقط حتى لا تحجب الكاميرا
      const tex = keep(makeTextBanner(`الحاجز ${toArabicDigits(index + 1)}`, { bg: QATAR_MAROON, w: 512, h: 200, font: '800 110px "QCR Cairo", Arial' }));
      const sign = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.7, 0.66)), keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide })));
      sign.position.set(0, 3.0, s * (TRACK.railZ - 0.4) + s * 0.05);
      sign.rotation.y = s > 0 ? Math.PI : 0;
      g.add(sign);
    }
    // شريط أرضي خفيف عبر المضمار
    const strip = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.25, TRACK.halfWidth * 2)), keep(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false })));
    strip.rotation.x = -Math.PI / 2;
    strip.position.y = 0.011;
    g.add(strip);
    g.visible = false;
    stageGroup.add(g);
    stageMarkers[index] = g;
    return g;
  };

  // آثار الحوافر: مزج ضربي (multiply) يُغمّق الرمل ويتلاشى تدريجيًا
  const maxPrints = quality === 'low' ? 300 : 900;
  const printTex = getFootprintTexture();
  const printMat = keep(new THREE.MeshBasicMaterial({ map: printTex, transparent: true, depthWrite: false, opacity: 0.85 }));
  const prints = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(0.2, 0.17)), printMat, maxPrints);
  prints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  prints.frustumCulled = false;
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < maxPrints; i++) prints.setMatrixAt(i, hidden);
  prints.renderOrder = 2;
  group.add(prints);
  let printIdx = 0;
  const pq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const pm = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);

  // ---------------- حواجز القفز: أسيجة أغصان (Steeplechase) بعرض المضمار ----------------
  const brushTex = keep(makeBrushTexture());
  brushTex.wrapS = brushTex.wrapT = THREE.RepeatWrapping;
  const brushMat = keep(new THREE.MeshStandardMaterial({ map: brushTex, roughness: 1, color: '#ffffff', emissive: '#1c2a14', emissiveIntensity: 0.6 })); // إضاءة ذاتية خفيفة تحاكي نفاذ الضوء بين الأغصان
  const fringeTex = keep(makeFringeTexture());
  fringeTex.wrapS = THREE.RepeatWrapping;
  const fringeMat = keep(new THREE.MeshStandardMaterial({ map: fringeTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 }));
  const boardMat = keep(new THREE.MeshStandardMaterial({ color: '#e8791c', roughness: 0.6 })); // لوح الارتقاء البرتقالي
  const wingMat = keep(new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.5, side: THREE.DoubleSide }));
  const FW = TRACK.railZ - 0.25; // نصف عرض الحاجز
  const fenceGeos = (() => {
    // مقطع السياج: مريلة مائلة من جهة الاقتراب، قمة بارتفاع 1.35 م، ظهر شبه عمودي
    const shape = new THREE.Shape();
    shape.moveTo(-0.85, 0); shape.lineTo(-0.5, 0.92); shape.lineTo(-0.28, 1.3); shape.lineTo(0.3, 1.3); shape.lineTo(0.42, 0); shape.closePath();
    const body = new THREE.ExtrudeGeometry(shape, { depth: FW * 2, bevelEnabled: false, steps: 24 });
    body.translate(0, 0, -FW);
    // قمة غير منتظمة: إزاحة عشوائية بسيطة لرؤوس القمة
    const bp = body.attributes.position;
    for (let i = 0; i < bp.count; i++) if (bp.getY(i) > 1.2) bp.setY(i, bp.getY(i) + Math.sin(bp.getZ(i) * 3.1) * 0.03 + Math.sin(bp.getZ(i) * 7.7) * 0.02);
    const uv = body.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.9 + bp.getZ(i) * 0.45, uv.getY(i) * 0.9);
    body.computeVertexNormals();
    // هدب الأغصان البارزة فوق القمة (ثلاث صفائح)
    const cards = [];
    for (const [x, tilt] of [[-0.22, -0.25], [0.02, 0], [0.26, 0.2]]) {
      const g = new THREE.PlaneGeometry(FW * 2, 0.34, 1, 1);
      g.rotateY(Math.PI / 2); g.rotateZ(tilt);
      g.translate(x, 1.42, 0);
      const u2 = g.attributes.uv; for (let i = 0; i < u2.count; i++) u2.setX(i, u2.getX(i) * 14);
      cards.push(g);
    }
    const fringe = mergeGeometries(cards);
    cards.forEach((g) => g.dispose());
    // لوح الارتقاء + عارضة أرضية بيضاء
    const board = new THREE.BoxGeometry(0.06, 0.36, FW * 2);
    board.rotateZ(-0.35); board.translate(-0.93, 0.17, 0);
    const rail = new THREE.CylinderGeometry(0.05, 0.05, FW * 2, 8);
    rail.rotateX(Math.PI / 2); rail.translate(-1.15, 0.06, 0);
    // الجناحان الأبيضان عند الطرفين: ألواح مائلة ترتفع نحو الحاجز وتوجّه الخيل
    const wings = [];
    for (const s of [1, -1]) {
      const w = new THREE.Shape();
      w.moveTo(-3.6, 0); w.lineTo(-3.6, 1.25); w.lineTo(0.3, 2.3); w.lineTo(0.3, 0); w.closePath();
      // الجناح القريب من الكاميرا قوائم وعارضة فقط حتى لا يحجب الرؤية
      if (s > 0) { const wg = new THREE.ShapeGeometry(w); wg.translate(0, 0, s * (FW + 0.02)); wings.push(wg); }
      for (let k = 0; k < (s > 0 ? 4 : 0); k++) { // قوائم الجناح البعيد فقط
        const post = new THREE.CylinderGeometry(0.045, 0.045, 1.3 + k * 0.33, 6);
        post.translate(-3.6 + k * 1.3, (1.3 + k * 0.33) / 2, s * (FW + 0.06));
        wings.push(post);
      }
    }
    const wing = mergeGeometries(wings.map((g) => (g.index ? g.toNonIndexed() : g)));
    wings.forEach((g) => g.dispose());
    return { body: keep(body), fringe: keep(fringe), board: keep(board), rail: keep(rail), wing: keep(wing) };
  })();
  const fenceGroup = new THREE.Group();
  fenceGroup.name = 'fences';
  group.add(fenceGroup);
  const numTex = [];
  function setFences(xs) {
    fenceGroup.clear();
    xs.forEach((x, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(fenceGeos.body, brushMat);
      body.castShadow = true; body.receiveShadow = true;
      const fringe = new THREE.Mesh(fenceGeos.fringe, fringeMat);
      const board = new THREE.Mesh(fenceGeos.board, boardMat);
      const rail = new THREE.Mesh(fenceGeos.rail, wingMat);
      const wing = new THREE.Mesh(fenceGeos.wing, wingMat);
      wing.castShadow = true;
      g.add(body, fringe, board, rail, wing);
      // لوحة رقم الحاجز على الجناح البعيد
      if (!numTex[i]) numTex[i] = keep(makeTextBanner(toArabicDigits(i + 1), { bg: QATAR_MAROON, w: 256, h: 256, font: '800 190px "QCR Cairo", Arial' }));
      const sign = new THREE.Mesh(boardGeoSq, keep(new THREE.MeshStandardMaterial({ map: numTex[i], roughness: 0.6 })));
      sign.position.set(-1.6, 2.75, FW - 0.1);
      sign.rotation.y = Math.PI;
      g.add(sign);
      g.position.x = x;
      fenceGroup.add(g);
    });
  }
  const boardGeoSq = keep(new THREE.PlaneGeometry(0.9, 0.9));

  return {
    group,
    get finishX() { return finishGroup.position.x; },
    setFinishX(x) { finishGroup.position.x = x; },
    setFences,
    showStageMarker(index, x) {
      const g = getStageMarker(index);
      g.position.x = x;
      g.visible = true;
    },
    hideStageMarkers() { stageMarkers.forEach((g) => { if (g) g.visible = false; }); },
    addFootprint(x, z, scale = 1) {
      pm.compose(new THREE.Vector3(x, 0.009, z), pq, one.clone().multiplyScalar(scale));
      prints.setMatrixAt(printIdx, pm);
      printIdx = (printIdx + 1) % maxPrints;
      prints.instanceMatrix.needsUpdate = true;
    },
    clearFootprints() {
      for (let i = 0; i < maxPrints; i++) prints.setMatrixAt(i, hidden);
      prints.instanceMatrix.needsUpdate = true;
      printIdx = 0;
    },
    dispose() {
      disposables.forEach((d) => d.dispose && d.dispose());
      group.removeFromParent();
    },
  };
}

export function toArabicDigits(n) {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// خامة سياج الأغصان: أخضر داكن بأغصان وإبر متشابكة
function makeBrushTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4c6b3a';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 99;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 256, y = rnd() * 256, l = 6 + rnd() * 16, a = -Math.PI / 2 + (rnd() - 0.5) * 1.3;
    const g = 95 + rnd() * 110;
    ctx.strokeStyle = rnd() < 0.18 ? `rgb(${120 + rnd() * 50 | 0},${92 + rnd() * 35 | 0},58)` : `rgb(${g * 0.62 | 0},${g | 0},${g * 0.45 | 0})`;
    ctx.lineWidth = 0.8 + rnd() * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// هدب الأغصان البارزة فوق قمة السياج (شفافة الأطراف)
function makeFringeTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 520; i++) {
    const x = rnd() * 256, h = 18 + rnd() * 44;
    const g = 95 + rnd() * 100;
    ctx.strokeStyle = `rgb(${g * 0.62 | 0},${g | 0},${g * 0.45 | 0})`;
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + (rnd() - 0.5) * 14, 64 - h); ctx.stroke();
  }
  bleedTransparent(c, '#5a7a45');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
