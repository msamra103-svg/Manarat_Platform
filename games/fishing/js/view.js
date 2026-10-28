/* صيد الأسماك V24 — scene assembly and rendering (renderer, lights, sea, actors, effects, quality presets). */
(function (root) {
  'use strict';
  const T = root.THREE, W = root.FishingWater, E = root.FishingEnvironment, A = root.FishingActors, PH = root.FishingPhysics;
  const PRESETS = {
    high: { pr: 1.75, shadow: 2048, sea: 'high', bed: 'high', reflect: 0.5 },
    medium: { pr: 1.25, shadow: 1024, sea: 'medium', bed: 'high', reflect: 0.35 },
    low: { pr: 1.0, shadow: 0, sea: 'low', bed: 'low', reflect: 0 }
  };
  function autoQuality() { const touch = 'ontouchstart' in root || (navigator.maxTouchPoints || 0) > 0; return (!touch && innerWidth >= 1000) ? 'high' : 'medium'; }

  class FishingView {
    constructor(canvas, opts = {}) {
      this.canvas = canvas; this.qualityName = Object.prototype.hasOwnProperty.call(PRESETS, opts.quality) ? opts.quality : autoQuality(); this.q = PRESETS[this.qualityName];
      const r = this.renderer = new T.WebGLRenderer({ canvas, antialias: this.qualityName !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
      r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.02; r.shadowMap.enabled = this.q.shadow > 0; r.shadowMap.type = T.PCFSoftShadowMap;
      r.setPixelRatio(Math.min(root.devicePixelRatio || 1, this.q.pr));
      const s = this.scene = new T.Scene(); s.fog = new T.FogExp2('#d3dfe6', 0.0012);
      this.camera = new T.PerspectiveCamera(48, 1, 0.05, 2500); this.camera.layers.enable(1);
      s.add(new T.HemisphereLight('#bcd7ee', '#6c6450', 0.72));
      const sun = this.sun = new T.DirectionalLight('#ffd9a8', 2.5); sun.position.copy(W.SUN_DIR).multiplyScalar(30); s.add(sun); s.add(sun.target);
      if (this.q.shadow) { sun.castShadow = true; sun.shadow.mapSize.set(this.q.shadow, this.q.shadow); Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 5, far: 60 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; }
      const fill = new T.DirectionalLight('#9cc8e0', 0.35); fill.position.set(6, 3, 8); s.add(fill);
      this.sky = W.createSky(); s.add(this.sky); this.sky.layers.set(1);
      this.sea = W.createSea(this.q.sea); s.add(this.sea); this.sea.layers.set(1);
      if (this.q.sea === 'low') this.sea.material.uniforms.uDetail.value = 0;
      s.add(W.createSeabed(this.q.bed));
      this.coast = E.createCoast(this.q.sea); s.add(this.coast);
      this.props = E.createSeaProps(); s.add(this.props.group);
      this.fx = W.createUnderwaterFX(this.q.sea); s.add(this.fx.group); this.fx.group.traverse(o => o.layers.set(1));
      this.spray = W.createSpray(); s.add(this.spray.points);
      this.under = false; this.frames = 0; this.fpsT = 0; this.fps = 60; this.escapeTrail = 0;
      this.onCut = () => { const f = document.getElementById('fade'); if (!f || document.body.dataset.qa) return; f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); };
      this.director = new root.FishingCamera.Director(this.camera, this.onCut);
      // planar reflection (mirror camera below y = 0, clip everything under the water, sea and sky excluded via layer 1)
      if (this.q.reflect) {
        this.refl = { rt: new T.WebGLRenderTarget(16, 16, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, generateMipmaps: false }), cam: new T.PerspectiveCamera(), plane: new T.Plane(new T.Vector3(0, 1, 0), 0.03), v: new T.Vector3(), u: new T.Vector3(), clear: new T.Color() };
        this.refl.rt.texture.name = 'sea-reflection'; this.sea.material.uniforms.uReflect.value = this.refl.rt.texture;
      }
      this.resize();
    }
    renderReflection() {
      const R = this.refl, un = this.sea.material.uniforms; if (!R) return;
      const cam = this.camera; if (this.under || cam.position.y < 0.08) { un.uReflOn.value = 0; return; }
      const rc = R.cam, r = this.renderer; cam.updateMatrixWorld();
      rc.position.set(cam.position.x, -cam.position.y, cam.position.z);
      cam.getWorldDirection(R.v); R.v.y = -R.v.y; R.v.add(rc.position);
      R.u.set(0, 1, 0).applyQuaternion(cam.quaternion); R.u.y = -R.u.y; rc.up.copy(R.u); rc.lookAt(R.v);
      rc.projectionMatrix.copy(cam.projectionMatrix); rc.projectionMatrixInverse.copy(cam.projectionMatrixInverse); rc.updateMatrixWorld(); rc.layers.set(0);
      un.uReflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
      const tm = r.toneMapping, ca = r.getClearAlpha(); r.getClearColor(R.clear);
      r.toneMapping = T.NoToneMapping; r.shadowMap.autoUpdate = false; r.clippingPlanes = [R.plane]; r.setClearColor(0x000000, 0);
      try { r.setRenderTarget(R.rt); r.clear(); r.render(this.scene, rc); }
      finally { r.setRenderTarget(null); r.clippingPlanes = []; r.toneMapping = tm; r.shadowMap.autoUpdate = true; r.setClearColor(R.clear, ca); }
      un.uReflOn.value = 1;
    }
    async load(onProgress) {
      const m = this.assets = await root.FishingAssets.loadAll(onProgress);
      this.boat = new A.BoatView(m.boat); this.scene.add(m.boat);
      const man = m.fisherman, S = root.FishingSimulation; man.position.set(S.FEET[0], S.FEET[1], S.FEET[2]); man.rotation.y = Math.PI; m.boat.add(man);
      man.traverse(o => { if (o.isMesh && !o.material.transparent) W.patchOptics(o.material, { caustics: false }); });
      this.angler = man.getObjectByName('upperarm01_L') && root.FishingAnglerRig ? new root.FishingAnglerRig.SkinnedAnglerRig(man) : new A.AnglerRig(man);
      this.tackle = new A.TackleView(this.scene, m.parts);
      Object.values(m.fish).forEach(f => f.traverse(o => { if (o.isMesh) o.castShadow = true; }));
      this.fishView = new A.FishView(this.scene, m.fish, m.boat);
      return m.report;
    }
    setReduced(v) { this.director.reduced = !!v; }
    resize() { const c = this.canvas, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight; this.renderer.setSize(w, h, false); if (this.refl) { const d = this.renderer.getDrawingBufferSize(new T.Vector2()); this.refl.rt.setSize(Math.max(16, Math.round(d.x * this.q.reflect)), Math.max(16, Math.round(d.y * this.q.reflect))); } this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix(); }
    handleEvents(events) {
      for (const e of events) {
        if (e.type === 'splash' && e.pos) { this.spray.emit(e.pos, e.strength || 1); this.fx.emitBubbles([e.pos[0], -0.1, e.pos[2]], 14, 0.2); }
        if (e.type === 'thrash' && e.pos) { if (e.pos[1] > -0.6) this.spray.emit([e.pos[0], 0, e.pos[2]], e.strength || 0.5); this.fx.emitBubbles(e.pos, 8, 0.25); }
        if (e.type === 'nibble' && e.pos) this.fx.emitBubbles([e.pos[0], -0.3, e.pos[2]], 4, 0.1);
        if (e.type === 'netted' && e.pos) this.spray.emit([e.pos[0], 0, e.pos[2]], 0.8);
        if (e.type === 'escape') this.escapeTrail = 1.2;
      }
    }
    update(sim, dt) {
      if (!this.boat) return;
      W.U.uTime.value = sim.t;
      this.boat.update(sim); this.boat.group.updateMatrixWorld(true);
      this.under = this.director.update(sim, dt);
      W.U.uCamPos.value.copy(this.camera.position);
      this.angler.update(sim, dt, this.director.reduced);
      this.tackle.update(sim, this.camera, dt);
      this.fishView.update(sim);
      const b = sim.boat; this.sea.material.uniforms.uBoat.value.set(b.pos[0], b.pos[2], b.yaw, 0); this.sea.userData.setRipples(sim.ripples);
      this.props.update(sim.t); this.spray.update(dt); this.fx.update(dt, this.camera.position, this.under, sim.t);
      if (this.escapeTrail > 0 && sim.target) { this.escapeTrail -= dt; this.fx.emitBubbles(sim.target.pos, 1, 0.08); }
      const bp = b.pos; this.sun.position.set(bp[0] + W.SUN_DIR.x * 30, W.SUN_DIR.y * 30, bp[2] + W.SUN_DIR.z * 30); this.sun.target.position.set(bp[0], 0, bp[2] - 0.5);
      this.scene.fog.density = this.under ? 0.0 : 0.0012; this.coast.visible = this.props.group.visible = !this.under; this.sky.userData.uUnder.value = this.under ? 1 : 0;
      this.renderReflection();
      this.renderer.render(this.scene, this.camera);
      this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    }
    stats() { const i = this.renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, fps: Math.round(this.fps), quality: this.qualityName, pixelRatio: this.renderer.getPixelRatio() }; }
    snapshot(sim) { return { shot: this.director.shot, cameraMode: this.director.mode, under: this.under, camera: this.camera.position.toArray().map(v => +v.toFixed(3)), assets: this.assets && this.assets.source, ...this.stats() }; }
    dispose() { this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); if (this.refl) this.refl.rt.dispose(); if (this.sun.shadow.map) this.sun.shadow.map.dispose(); this.renderer.dispose(); }
  }
  root.FishingView = { FishingView, PRESETS, autoQuality };
})(window);
