// خامات PBR مشتركة يُعاد استخدامها في كل المحطات.
import * as THREE from 'three';

export function createMaterials(assets) {
  const T = n => assets.tex(n);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const pbr = (base, o = {}) => {
    const { ao = true, metalMap = false, ...rest } = o;
    const m = std({ map: T(base + '_color'), normalMap: T(base + '_normal'), roughness: 1, metalness: 0, ...rest });
    const ormName = base + '_orm';
    if (assets.textures[ormName]) {
      m.roughnessMap = T(ormName);
      if (ao) m.aoMap = T(ormName);
      if (metalMap) { m.metalnessMap = T(ormName); m.metalness = 1; }
    }
    return m;
  };

  const mats = {};
  mats.sand = pbr('sand', { color: 0xe2c79a, normalScale: new THREE.Vector2(0.8, 0.8) });
  mats.sand.roughnessMap = null; mats.sand.roughness = 1;      // رمل جاف غير لامع
  // ---- بيئة الغابة ----
  mats.grass = std({ map: T('grass_color'), normalMap: T('grass_normal'), color: 0xf2f4e6, roughness: 1, metalness: 0 });
  // انعكاس السماء على العشب يغسله بالرمادي في الظل؛ نخفّضه فيبقى لون العشب ظاهرًا
  mats.grass.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('reflectedLight.directSpecular + reflectedLight.indirectSpecular', 'reflectedLight.directSpecular + reflectedLight.indirectSpecular * 0.3'); };
  mats.grass.customProgramCacheKey = () => 'grass-soft-sky';
  mats.fortStone = ['#a3a796', '#979d8b', '#adad9d', '#929886', '#a6ab98'].map(c => std({ map: T('rock_color'), normalMap: T('rock_normal'), color: new THREE.Color(c), roughness: 0.96, metalness: 0 }));
  mats.bark = {
    oak: std({ map: T('bark_oak_color'), normalMap: T('bark_oak_normal'), roughness: 1, metalness: 0 }),
    pine: std({ map: T('bark_pine_color'), normalMap: T('bark_pine_normal'), roughness: 1, metalness: 0 })
  };
  mats.leaves = {};
  for (const k of ['oak', 'ash', 'pine']) mats.leaves[k] = std({ map: T('leaves_' + k), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, color: 0xe2e8d4 });
  mats.tarp = std({ color: 0x5f6b48, normalMap: T('fabric_normal'), roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  mats.tarpTan = std({ color: 0x8a7a58, normalMap: T('fabric_normal'), roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  // تدرجات جصّ دافئة: كل محطة تأخذ لونًا مختلفًا من المكان نفسه
  mats.plaster = ['#eadcc2', '#e2cba6', '#efe6d4', '#d9c29c', '#e6d5ba'].map(c => pbr('plaster', { color: new THREE.Color(c), ao: false }));
  mats.stone = std({ map: T('rock_color'), normalMap: T('rock_normal'), color: 0xd9c7a6, roughness: 0.95, metalness: 0 });
  mats.concrete = pbr('concrete', { color: 0xdad5cb, ao: false });
  mats.paintYellow = std({ color: 0xd9a514, roughness: 0.8, metalness: 0 });
  mats.steel = pbr('metal', { color: 0x8b8f86, metalMap: true, ao: false, normalScale: new THREE.Vector2(0.5, 0.5) });
  mats.steelDark = std({ color: 0x2c3033, roughness: 0.55, metalness: 0.8 });
  mats.wood = pbr('wood', { color: 0xffffff });
  // أبواب المحطات: خشب طبيعي، جوز داكن، أخضر مزرقّ تراثي، رمادي حديث، بنّي محمرّ
  mats.doors = [0xffffff, 0x8f7052, 0x4f9a90, 0x9aa1a6, 0xb0604a].map(c => pbr('wood', { color: c }));
  mats.brass = std({ color: 0xb08a45, roughness: 0.42, metalness: 0.9 });
  mats.fabric = pbr('fabric', { side: THREE.DoubleSide, color: 0xf2ece0 });
  mats.fabricSand = pbr('fabric', { side: THREE.DoubleSide, color: 0xcfb58a });
  mats.glass = new THREE.MeshStandardMaterial({ color: 0x9fc0cc, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.38, envMapIntensity: 1.6 });
  mats.dark = std({ color: 0x15130f, roughness: 1, metalness: 0 });
  mats.lattice = std({ map: T('lattice'), alphaTest: 0.5, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, color: 0xf0e6d2 });
  mats.frond = std({ map: T('frond'), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.75, metalness: 0, color: 0xdfe8c8 });
  mats.trunk = std({ map: T('rock_color'), normalMap: T('rock_normal'), color: 0x7a5c3c, roughness: 1, metalness: 0 });
  mats.clay = std({ color: 0xb6703f, roughness: 0.82, metalness: 0, normalMap: T('plaster_normal'), normalScale: new THREE.Vector2(0.4, 0.4) });
  mats.lampOff = std({ color: 0x3a2c12, emissive: 0xff9a1c, emissiveIntensity: 1.6, roughness: 0.4 });
  mats.lampOn = std({ color: 0x0f3a16, emissive: 0x2dff66, emissiveIntensity: 2.4, roughness: 0.4 });
  return mats;
}

/**
 * إسقاط UV بالأمتار (مكعّبي حسب اتجاه السطح) حتى تتكرر الخامة بمقياس واقعي
 * مهما كان حجم المجسّم. tile = طول بلاطة الخامة بالمتر.
 */
export function worldUV(geometry, tile = 2) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
