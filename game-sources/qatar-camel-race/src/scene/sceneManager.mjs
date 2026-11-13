import * as THREE from "three";
import { competitorName } from "../race/names.mjs";
import { buildEnvironment } from "./environment.mjs";
import { buildTrack, TRACK } from "./track.mjs";
import { buildFlags } from "./flags.mjs";
import { buildCrowd } from "./crowd.mjs";
import { buildRoadAndVehicles } from "./vehicles.mjs";
import { createPostFX } from "./postfx.mjs";
import { buildDust } from "./dust.mjs";
import { CameraDirector } from "./cameraDirector.mjs";
import { buildScoreboard } from "./scoreboard.mjs";
import { Camel } from "../camel/camel.mjs";
import { loadCamelTemplate } from "../camel/camelGLB.mjs";
import { COAT_COLORS } from "../camel/camelAnatomy.mjs";
import { QATAR_MAROON, disposeTextureCache } from "./textures.mjs";
import { createRng } from "../core/random.mjs";
const CLOTH_COLORS = [
  { color: "#1f4fa3", trim: "#ffffff", name: "أزرق" },
  { color: "#1d7a46", trim: "#f2d25a", name: "أخضر" },
  { color: "#e7b42c", trim: "#1b1b1b", name: "ذهبي" },
  { color: "#f2f1ec", trim: "#1b1b1b", name: "أبيض" },
  { color: "#232323", trim: "#d9b45a", name: "أسود" }
];
const PLAYER_CLOTH = { color: QATAR_MAROON, trim: "#ffffff", name: "عنابي" };
const QUALITY = {
  high: { pixelRatio: 2, shadows: true, crowd: "high", camel: "high", farCamel: "medium", antialias: true },
  medium: { pixelRatio: 1.5, shadows: true, crowd: "medium", camel: "high", farCamel: "medium", antialias: true },
  low: { pixelRatio: 1, shadows: false, crowd: "low", camel: "medium", farCamel: "low", antialias: false }
};
class SceneManager {
  constructor(container, config) {
    this.container = container;
    this.config = config;
    this.qualityName = config.graphics.quality === "auto" ? "medium" : config.graphics.quality;
    this.camels = [];
    this.disposed = false;
    this.time = 0;
  }
  async init(onProgress = () => {
  }) {
    const q = QUALITY[this.qualityName];
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: "high-performance", preserveDrawingBuffer: false });
    } catch (e) {
      throw new Error("webgl");
    }
    this.renderer = renderer;
    renderer.info.autoReset = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "game-canvas";
    renderer.domElement.setAttribute("aria-label", "مشهد سباق الهجن");
    this.container.appendChild(renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 3e3);
    this.director = new CameraDirector(this.camera);
    this.director.reduced = this.config.graphics.reducedMotion;
    this.post = createPostFX(renderer, this.scene, this.camera, this.qualityName);
    this.resize();
    onProgress(0.15, "تجهيز البيئة الصحراوية…");
    await tick();
    this.trackLen = Math.max(1400, Number(this.config.trackLength) || 1400);
    this.env = buildEnvironment(this.scene, { trackLength: this.trackLen, quality: this.qualityName, renderer: this.renderer });
    onProgress(0.3, "تمهيد المضمار الرملي…");
    await tick();
    this.track = buildTrack(this.scene, { finishX: 520, quality: this.qualityName, length: this.trackLen });
    onProgress(0.45, "رفع الأعلام وتجهيز المنصات…");
    await tick();
    this._buildStandsAndFlags(520);
    onProgress(0.6, "تجهيز سيارات المتابعة…");
    await tick();
    this.vehicles = buildRoadAndVehicles(this.scene, { x0: -150, x1: this.trackLen + 100, count: 6, quality: this.qualityName });
    this.dust = buildDust(this.scene, { quality: this.qualityName });
    this.dust.setViewportScale(this.renderer.domElement.clientHeight || 720);
    onProgress(0.75, "تجهيز الهجن…");
    await tick();
    this.camelTemplate = null;
    const url = this.config.graphics.camelModelUrl;
    if (url) {
      onProgress(0.8, "تحميل نموذج الهجين…");
      try {
        this.camelTemplate = await loadCamelTemplate(url);
      } catch (e) {
        console.warn("camel model load failed", e);
        this.assetWarning = `تعذر تحميل نموذج الهجين البديل (${url})${location.protocol === "file:" ? " — يتطلب التشغيل من خادم محلي" : ""}. سيُستخدم النموذج المدمج.`;
        onProgress(0.8, this.assetWarning);
        await new Promise((r) => setTimeout(r, 1800));
      }
    }
  }
  // منصتان: عند الانطلاق (ثابتة) وعند النهاية (مجموعة تُحرّك إلى موضع خط النهاية دون إعادة بناء)
  _buildStandsAndFlags(finishX) {
    for (const k of ["crowdStart", "crowdFinish", "flagsStart", "flagsFinish"]) {
      this[k]?.dispose();
      this[k] = null;
    }
    const z0 = TRACK.railZ + 3.2;
    const startStand = { x0: -26, x1: 26, z0, tiers: 6 };
    const finishStand = { x0: -46, x1: 18, z0, tiers: 7 };
    const crowdQ = QUALITY[this.qualityName].crowd;
    this.crowdStart = buildCrowd(this.scene, [startStand], { quality: crowdQ });
    this.crowdFinish = buildCrowd(this.scene, [finishStand], { quality: crowdQ });
    const startFlags = [];
    for (const x of [-30, -12, 8, 28]) startFlags.push({ x, z: TRACK.railZ + 1.4, h: 6.5 });
    startFlags.push({ x: startStand.x0 + 3, z: z0 + startStand.tiers * 1.05 + 0.4, h: startStand.tiers * 0.42 + 8.5 });
    startFlags.push({ x: startStand.x1 - 3, z: z0 + startStand.tiers * 1.05 + 0.4, h: startStand.tiers * 0.42 + 8.5 });
    for (const x of [-8, 10]) startFlags.push({ x, z: -TRACK.railZ - 6.5, h: 6 });
    const finishFlags = [];
    for (const x of [-50, -25, 4, 22]) finishFlags.push({ x, z: TRACK.railZ + 1.4, h: 6.5 });
    finishFlags.push({ x: finishStand.x0 + 3, z: z0 + finishStand.tiers * 1.05 + 0.4, h: finishStand.tiers * 0.42 + 8.5 });
    finishFlags.push({ x: finishStand.x1 - 3, z: z0 + finishStand.tiers * 1.05 + 0.4, h: finishStand.tiers * 0.42 + 8.5 });
    for (const x of [-6, 10]) finishFlags.push({ x, z: -TRACK.railZ - 6.5, h: 6 });
    this.flagsStart = buildFlags(this.scene, startFlags, { quality: this.qualityName });
    this.flagsFinish = buildFlags(this.scene, finishFlags, { quality: this.qualityName });
    if (!this.scoreboard) this.scoreboard = buildScoreboard(this.scene);
    this._finishStandRel = finishStand;
    this._moveFinishArea(finishX);
  }
  _moveFinishArea(finishX) {
    this.crowdFinish.group.position.x = finishX;
    this.flagsFinish.group.position.x = finishX;
    this.scoreboard.setPosition(finishX - 18, TRACK.railZ + 1.9);
    const f = this._finishStandRel;
    this.stands = [{ x0: -26, x1: 26 }, { x0: finishX + f.x0, x1: finishX + f.x1 }];
    this.finishAreaX = finishX;
  }
  updateScoreboard(standings, playerLabel, title) {
    if (!this.scoreboard || !this.identities) return;
    const light = (hex) => {
      const h = hex.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1e3 > 150;
    };
    this.scoreboard.update(standings.map((s) => {
      const idn = this.identities[s.id];
      const num = String(idn.number).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
      return { id: s.id, rank: s.rank, isPlayer: s.isPlayer, color: idn.color, light: light(idn.color), number: idn.number, name: s.isPlayer ? playerLabel : idn.name };
    }), title);
  }
  // إنشاء الهجن لهذا السباق بهوية ثابتة (لون، رقم، قماش) طوال السباق
  setupRace(model, seed) {
    for (const c of this.camels) c.dispose();
    this.camels = [];
    const rng = createRng(seed * 31 + 7);
    const coats = COAT_COLORS.slice().sort(() => rng.next() - 0.5);
    const cloths = CLOTH_COLORS.slice(0, model.racers.length - 1).sort(() => rng.next() - 0.5);
    const numbers = [1, 2, 3, 4, 5, 6].slice(0, model.racers.length).sort(() => rng.next() - 0.5);
    let ci = 0;
    this.identities = {};
    model.racers.forEach((r, i) => {
      const cloth = r.isPlayer ? PLAYER_CLOTH : cloths[ci++];
      const camel = new Camel({
        id: r.id,
        number: numbers[i],
        coat: coats[i % coats.length],
        clothColor: cloth.color,
        trimColor: cloth.trim,
        template: this.camelTemplate,
        referenceCoat: COAT_COLORS[0],
        isPlayer: r.isPlayer,
        seed: i + 1 + seed * 7,
        quality: r.isPlayer || Math.abs(i - model.player.lane) <= 1 ? QUALITY[this.qualityName].camel : QUALITY[this.qualityName].farCamel
      });
      camel.setPosition(r.d, r.z);
      camel.prevD = r.d;
      this.scene.add(camel.object);
      this.camels.push(camel);
      this.identities[r.id] = { name: competitorName(r.id), number: numbers[i], color: cloth.color, trim: cloth.trim, clothName: cloth.name, coat: coats[i % coats.length].name, isPlayer: r.isPlayer };
    });
    this.model = model;
    this.track.setFinishX(model.finishX, model.finishPlaced);
    this._moveFinishArea(model.finishX);
    this.track.hideStageMarkers();
    this.track.clearFootprints();
    this.dust.clear();
    this.vehicles.reset();
    this._updateShadowCasters();
    return this.identities;
  }
  placeFinish(x) {
    this.track.setFinishX(x, true);
    this._moveFinishArea(x);
    this.director.finishX = x;
  }
  _updateShadowCasters() {
    if (!this.model) return;
    const q = QUALITY[this.qualityName];
    const pl = this.model.player;
    for (let i = 0; i < this.camels.length; i++) {
      const r = this.model.racers[i];
      const near = Math.abs(r.d - pl.d) < 14;
      this.camels[i].setShadowCasting(q.shadows && (this.qualityName === "high" || near || r.isPlayer));
    }
  }
  // تحديث المشهد لكل إطار
  update(dt, { frozen, mode, audio, overtake }) {
    this.time += dt;
    const model = this.model;
    if (!model) return;
    const pl = model.player;
    let packX = 0, packZ = 0;
    const camPos = this.camera.position;
    for (let i = 0; i < this.camels.length; i++) {
      const r = model.racers[i];
      const c = this.camels[i];
      const dd = Math.max(0, r.d - c.prevD);
      c.prevD = r.d;
      const yaw = -Math.atan2(r.zVel, Math.max(2, r.v)) * 0.8;
      c.setPosition(r.d, r.z, yaw);
      const events = c.update(dt, { speed: r.v, distanceDelta: dd, frozen, boost: r.isPlayer && r.boostActive ? 1 : 0, lateralVel: r.zVel });
      for (const e of events) {
        const wx = r.d + e.x, wz = r.z + e.z;
        this.dust.puff(wx, wz, r.v, e.front ? 1 : 0.8);
        this.track.addFootprint(wx, wz, e.front ? 1 : 0.9);
        if (audio) {
          const dist = Math.hypot(wx - camPos.x, wz - camPos.z);
          if (dist < 30) audio.footstep(dist * 0.6, r.v);
        }
      }
      packX += r.d;
      packZ += r.z;
    }
    packX /= this.camels.length;
    packZ /= this.camels.length;
    this.dust.update(dt, frozen);
    this.flagsStart.update(this.time, 1);
    this.flagsFinish.update(this.time, 1);
    const reduced = this.config.graphics.reducedMotion;
    const finishing = mode === "finish" || mode === "results";
    if (pl.d < 140 || mode === "menu") this.crowdStart.update(this.time, pl.d, 0.85, reduced);
    if (this.finishAreaX - pl.d < 220) this.crowdFinish.update(this.time, pl.d - this.finishAreaX, finishing ? 1.2 : 0.85, reduced);
    if (!frozen) {
      const targets = model.racers.map((r, i) => r.d + 2 - i % 3 * 3);
      this.vehicles.update(dt, targets, false, this.time);
    }
    if (overtake) this.director.overtake();
    this.director.update(dt, { target: new THREE.Vector3(pl.d, 0, pl.z), speed: pl.v, pack: new THREE.Vector3(packX, 0, packZ) });
    this.env.followShadow(new THREE.Vector3(pl.d + 2, 0, pl.z * 0.5));
    if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) this._updateShadowCasters();
    if (audio) {
      let near = 0;
      for (const st of this.stands) near = Math.max(near, 1 - Math.min(1, Math.max(0, Math.max(st.x0 - pl.d, pl.d - st.x1)) / 60));
      audio.setCrowdLevel(frozen ? near * 0.4 : near);
    }
  }
  render() {
    this.renderer.info.reset();
    if (this.post) this.post.render(this.time ?? 0);
    else this.renderer.render(this.scene, this.camera);
  }
  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const q = QUALITY[this.qualityName];
    const pr = Math.min(window.devicePixelRatio || 1, q.pixelRatio, this.config.graphics.maxPixelRatio || 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.post?.setSize(w, h, pr);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1.3 ? 55 : 42;
    this.camera.updateProjectionMatrix();
    this.dust?.setViewportScale(h * pr);
  }
  setQuality(name) {
    if (!QUALITY[name] || name === this.qualityName) return false;
    this.qualityName = name;
    const q = QUALITY[name];
    this.renderer.shadowMap.enabled = q.shadows;
    this.env.setShadowQuality(name);
    this.post?.dispose();
    this.post = createPostFX(this.renderer, this.scene, this.camera, name);
    this.resize();
    this._buildStandsAndFlags(this.finishAreaX ?? 520);
    this.dust.setEnabled(name !== "low" || true);
    this.scene.traverse((o) => {
      if (o.material) {
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((mm) => {
          mm.needsUpdate = true;
        });
      }
    });
    this._updateShadowCasters();
    return true;
  }
  projectPlayerMarker() {
    if (!this.model) return null;
    const pl = this.model.player;
    const v = new THREE.Vector3(pl.d + 1.3, 2.5, pl.z).project(this.camera);
    if (v.z > 1) return null;
    return { x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5 };
  }
  info() {
    const r = this.renderer.info;
    return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures, quality: this.qualityName };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const c of this.camels) c.dispose();
    this.camels = [];
    this.crowdStart?.dispose();
    this.crowdFinish?.dispose();
    this.flagsStart?.dispose();
    this.flagsFinish?.dispose();
    this.vehicles?.dispose();
    this.dust?.dispose();
    this.scoreboard?.dispose();
    this.track?.dispose();
    this.env?.dispose();
    this.post?.dispose();
    disposeTextureCache();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.renderer?.domElement.remove();
  }
}
function tick() {
  return new Promise((r) => setTimeout(r, 0));
}
export {
  CLOTH_COLORS,
  PLAYER_CLOTH,
  SceneManager
};
