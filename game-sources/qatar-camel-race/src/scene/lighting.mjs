import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
function createSkyLighting(renderer, scene, { elevation = 38, azimuth = 215, size = 4e3 } = {}) {
  const sky = new Sky();
  sky.name = "physicalSky";
  sky.scale.setScalar(size);
  const u = sky.material.uniforms;
  u.turbidity.value = 5.2;
  u.rayleigh.value = 1.9;
  u.mieCoefficient.value = 9e-3;
  u.mieDirectionalG.value = 0.82;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
  u.sunPosition.value.copy(sunDir);
  const dome = buildSkyDome(sunDir, size);
  scene.add(dome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(1e3);
  Object.keys(u).forEach((k) => {
    envSky.material.uniforms[k].value = u[k].value;
  });
  envScene.add(envSky);
  const groundMat = new THREE.MeshBasicMaterial({ color: "#b08856", side: THREE.DoubleSide });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 32), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  envScene.add(ground);
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.2;
  envSky.material.dispose();
  envSky.geometry.dispose();
  groundMat.dispose();
  ground.geometry.dispose();
  pmrem.dispose();
  return {
    sky: dome,
    sunDir,
    follow(target) {
      dome.position.set(target.x, 0, target.z);
    },
    dispose() {
      envRT.dispose();
      sky.material.dispose();
      sky.geometry.dispose();
      dome.material.dispose();
      dome.geometry.dispose();
      dome.removeFromParent();
      scene.environment = null;
    }
  };
}
function buildSkyDome(sunDir, size) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uSun: { value: sunDir.clone().normalize() } },
    vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * noise(p); p = p * 2.03 + 11.3; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 zenith = vec3(0.13, 0.32, 0.72);
        vec3 mid = vec3(0.36, 0.56, 0.86);
        vec3 horizon = vec3(0.70, 0.75, 0.80);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.11, h));
        c = mix(c, zenith, smoothstep(0.1, 0.8, h));
        // وهج الشمس والهالة المغبرّة حولها
        float sd = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.82, 0.55) * (pow(sd, 6.0) * 0.22 + pow(sd, 48.0) * 0.5 + pow(sd, 900.0) * 6.0);
        // غيوم سمحاقية رقيقة ممتدة
        vec2 uv = d.xz / (d.y + 0.18) * vec2(0.55, 1.5);
        float cl = smoothstep(0.52, 0.86, fbm(uv + vec2(3.1, 0.0)) * 0.75 + fbm(uv * 3.1) * 0.3);
        cl *= smoothstep(0.015, 0.14, h) * 0.55;
        c = mix(c, vec3(1.0, 0.98, 0.95), cl);
        // تحت الأفق: لون الرمل البعيد
        c = mix(vec3(0.74, 0.66, 0.53), c, smoothstep(-0.04, 0.0, d.y));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(size * 0.45, 32, 16), mat);
  dome.name = "skyDome";
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}
export {
  createSkyLighting
};
