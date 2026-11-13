import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.022 }, uVignette: { value: 0.26 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // منحنى S خفيف
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.32);
      // تلوين منفصل: ظلال مائلة للأزرق وإضاءات دافئة
      c += mix(vec3(-0.012, 0.0, 0.02), vec3(0.022, 0.008, -0.02), smoothstep(0.15, 0.85, l));
      // تشبّع أغنى قليلًا
      c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, 1.1);
      vec2 d = vUv - 0.5;
      c *= 1.0 - uVignette * smoothstep(0.25, 0.9, dot(d, d) * 2.2);
      c += (hash(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`
};
function createPostFX(renderer, scene, camera, quality) {
  if (quality === "low") return null;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality === "high" ? 4 : 2 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  return {
    render(t = 0) {
      grade.uniforms.uTime.value = t * 7.13 % 100;
      composer.render();
    },
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
    },
    dispose() {
      composer.dispose();
      rt.dispose();
      grade.material.dispose();
    }
  };
}
export {
  createPostFX
};
