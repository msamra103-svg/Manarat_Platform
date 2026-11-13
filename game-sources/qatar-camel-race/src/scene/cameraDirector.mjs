import * as THREE from "three";
class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.mode = "idle";
    this.t = 0;
    this.pos = new THREE.Vector3(0, 4, -14);
    this.look = new THREE.Vector3(0, 1.2, 0);
    this.zoom = 0;
    this.zoomTarget = 0;
    this.reduced = false;
    this.finishX = 500;
    this.shake = 0;
  }
  setMode(mode, opts = {}) {
    this.mode = mode;
    this.t = 0;
    Object.assign(this, opts);
    if (this.reduced && (mode === "follow" || mode === "finish")) this._snap = true;
  }
  overtake() {
    if (!this.reduced) {
      this.zoomTarget = 1;
      this.zoomTimer = 2.2;
    }
  }
  // target: موضع هجين اللاعب، pack: مركز المجموعة
  update(dt, { target, speed = 0, pack }) {
    this.t += dt;
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    let stiff = 3.2;
    if (this.zoomTimer > 0) {
      this.zoomTimer -= dt;
      if (this.zoomTimer <= 0) this.zoomTarget = 0;
    }
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 1.6);
    switch (this.mode) {
      case "menu": {
        const sway = this.reduced ? 0 : Math.sin(this.t * 0.15) * 1.6;
        desiredPos.set(pack.x + 7 + sway, 2.6, pack.z - 13.5);
        desiredLook.set(pack.x - 9.5, 1.6, pack.z + 2.5);
        stiff = 1.5;
        break;
      }
      case "intro": {
        const k2 = this.reduced ? 1 : smooth(Math.min(1, this.t / (this.introDuration || 2.4)));
        const front = new THREE.Vector3(pack.x + 17, 4.2, -17.5);
        const side = followPos(target, 0);
        desiredPos.lerpVectors(front, side, k2);
        desiredLook.lerpVectors(new THREE.Vector3(pack.x - 1, 1.3, pack.z), followLook(target), k2);
        stiff = 6;
        break;
      }
      case "follow":
      case "question": {
        desiredPos.copy(followPos(target, this.zoom));
        desiredLook.copy(followLook(target));
        if (this.mode === "question") stiff = 4;
        break;
      }
      case "finish": {
        const fx = this.finishX;
        const x = Math.min(target.x, fx + 6);
        desiredPos.set(fx - 3, 3.2, target.z - 9.5);
        desiredLook.set(x + 1.5, 1.4, target.z + 3);
        stiff = 2.2;
        break;
      }
      case "results": {
        const a = this.reduced ? 0 : this.t * 0.1;
        desiredPos.set(target.x - 6 + Math.sin(a) * 2, 2.8, target.z - 7.5);
        desiredLook.set(target.x + 1.5, 1.4, target.z + 1);
        stiff = 1.2;
        break;
      }
      default:
        desiredPos.copy(this.pos);
        desiredLook.copy(this.look);
    }
    const k = this._snap ? 1 : 1 - Math.exp(-dt * stiff);
    this._snap = false;
    this.pos.lerp(desiredPos, k);
    this.look.lerp(desiredLook, Math.min(1, k * 1.4));
    this.camera.position.copy(this.pos);
    if (!this.reduced && this.mode === "follow") {
      const s = Math.min(1, speed / 14) * 0.012;
      this.camera.position.y += Math.sin(this.t * 13.1) * s;
      this.camera.position.x += Math.sin(this.t * 9.7) * s * 0.5;
    }
    this.camera.lookAt(this.look);
  }
}
function followPos(target, zoom) {
  return new THREE.Vector3(target.x - 5.6 + zoom * 1.6, 4.1 - zoom * 0.6, target.z - 8.2 + zoom * 2);
}
function followLook(target) {
  return new THREE.Vector3(target.x + 3.4, 1.15, target.z + 3.2);
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}
export {
  CameraDirector
};
