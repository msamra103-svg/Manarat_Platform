import * as THREE from "three";
import { getSoftParticleTexture } from "./textures.mjs";
function buildDust(scene, { quality }) {
  const max = quality === "low" ? 250 : quality === "medium" ? 900 : 1800;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: getSoftParticleTexture() },
      uColor: { value: new THREE.Color("#e2c9a2") },
      uScale: { value: 600 },
      fogColor: { value: new THREE.Color() },
      fogNear: { value: 1 },
      fogFar: { value: 1e3 }
    },
    vertexShader: `
      attribute float aSize; attribute float aAlpha; varying float vAlpha; uniform float uScale;
      void main(){ vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_PointSize = aSize * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform vec3 uColor; varying float vAlpha;
      void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vAlpha);
        if (gl_FragColor.a < 0.01) discard; }`,
    transparent: true,
    depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);
  const p = [];
  for (let i = 0; i < max; i++) p.push({ life: 0, max: 1, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, s: 0 });
  let cursor = 0;
  let enabled = true;
  return {
    points,
    setEnabled(v) {
      enabled = v;
      points.visible = v;
    },
    setViewportScale(h) {
      mat.uniforms.uScale.value = h * 0.9;
    },
    // نفثة غبار عند ملامسة خف للأرض
    puff(x, z, speed, amount = 1) {
      if (!enabled) return;
      const n = Math.round((3 + speed * 0.55) * amount * (quality === "low" ? 0.4 : 1));
      for (let i = 0; i < n; i++) {
        const q = p[cursor];
        cursor = (cursor + 1) % max;
        q.life = q.max = 1 + Math.random() * 1.6;
        q.x = x + (Math.random() - 0.5) * 0.2;
        q.y = 0.05;
        q.z = z + (Math.random() - 0.5) * 0.2;
        q.vx = -speed * (0.06 + Math.random() * 0.12) + (Math.random() - 0.5) * 0.4;
        q.vy = 0.35 + Math.random() * 0.9 * Math.min(1, speed / 10);
        q.vz = (Math.random() - 0.5) * 0.6;
        q.s = 0.12 + Math.random() * 0.2;
      }
    },
    update(dt, frozen) {
      if (frozen) return;
      for (let i = 0; i < max; i++) {
        const q = p[i];
        if (q.life <= 0) {
          alpha[i] = 0;
          continue;
        }
        q.life -= dt;
        q.vx *= 1 - dt * 1.6;
        q.vz *= 1 - dt * 1.2;
        q.vy = q.vy * (1 - dt * 1.4) + dt * 0.05;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.z += q.vz * dt;
        q.s += dt * (0.55 + q.s * 0.5);
        const k = q.life / q.max;
        pos[i * 3] = q.x;
        pos[i * 3 + 1] = q.y;
        pos[i * 3 + 2] = q.z;
        size[i] = q.s;
        alpha[i] = Math.max(0, Math.min(1, k * 1.6)) * 0.26 * (1 - Math.pow(1 - k, 8));
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    },
    clear() {
      p.forEach((q) => {
        q.life = 0;
      });
      alpha.fill(0);
      geo.attributes.aAlpha.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      points.removeFromParent();
    }
  };
}
export {
  buildDust
};
