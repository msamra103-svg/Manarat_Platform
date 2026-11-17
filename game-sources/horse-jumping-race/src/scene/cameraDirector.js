import * as THREE from 'three';

// مخرج الكاميرا: لقطة افتتاحية قصيرة، متابعة جانبية مائلة لحصان اللاعب،
// اقتراب خفيف عند التجاوز، لقطة واضحة عند خط النهاية، ولقطة هادئة للنتائج.
// خيار «تقليل الحركة» يلغي الحركات الاستعراضية والاهتزاز ويجعل الانتقالات قطعًا هادئًا.
export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'idle';
    this.t = 0;
    this.pos = new THREE.Vector3(0, 4, -14);
    this.look = new THREE.Vector3(0, 1.2, 0);
    this.zoom = 0; // 0..1 اقتراب التجاوز
    this.zoomTarget = 0;
    this.reduced = false;
    this.finishX = 500;
    this.shake = 0;
  }

  setMode(mode, opts = {}) {
    this.mode = mode;
    this.t = 0;
    Object.assign(this, opts);
    if (this.reduced && (mode === 'follow' || mode === 'finish')) this._snap = true;
  }

  overtake() { if (!this.reduced) { this.zoomTarget = 1; this.zoomTimer = 2.2; } }

  // target: موضع حصان اللاعب، pack: مركز المجموعة
  update(dt, { target, speed = 0, pack, fenceNear = 0 }) {
    this.fenceLift = (this.fenceLift || 0) + (smooth(fenceNear) - (this.fenceLift || 0)) * Math.min(1, dt * 2.5);
    this.t += dt;
    const desiredPos = new THREE.Vector3();
    const desiredLook = new THREE.Vector3();
    let stiff = 3.2;
    if (this.zoomTimer > 0) { this.zoomTimer -= dt; if (this.zoomTimer <= 0) this.zoomTarget = 0; }
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 1.6);
    switch (this.mode) {
      case 'menu': {
        // دوران بطيء حول الخيل عند خط الانطلاق
        // الخيل عند خط الانطلاق تظهر في النصف الأيسر بينما تشغل لوحة البداية النصف الأيمن
        const sway = this.reduced ? 0 : Math.sin(this.t * 0.15) * 1.6;
        desiredPos.set(pack.x + 7 + sway, 2.6, pack.z - 13.5);
        desiredLook.set(pack.x - 9.5, 1.6, pack.z + 2.5);
        stiff = 1.5;
        break;
      }
      case 'intro': {
        // من أمام الصف نحو زاوية المتابعة الجانبية
        const k = this.reduced ? 1 : smooth(Math.min(1, this.t / (this.introDuration || 2.4)));
        // من أمام الصف بزاوية مائلة (خارج المضمار حتى لا تقترب الكاميرا من رؤوس الخيل) نحو زاوية المتابعة
        const front = new THREE.Vector3(pack.x + 17, 4.2, -17.5);
        const side = followPos(target, 0);
        desiredPos.lerpVectors(front, side, k);
        desiredLook.lerpVectors(new THREE.Vector3(pack.x - 1, 1.3, pack.z), followLook(target), k);
        stiff = 6;
        break;
      }
      case 'follow':
      case 'question': {
        desiredPos.copy(followPos(target, this.zoom));
        desiredLook.copy(followLook(target));
        // ارتفاع وابتعاد بسيطان قرب الحاجز: يُرى الحصان فوق السياج القريب
        desiredPos.y += this.fenceLift * 2.6;
        desiredPos.z -= this.fenceLift * 1.2;
        desiredLook.y -= this.fenceLift * 0.5;
        if (this.mode === 'question') stiff = 4;
        break;
      }
      case 'finish': {
        // لقطة جانبية ثابتة عند خط النهاية تتابع اللاعب حتى العبور ثم تتوقف
        const fx = this.finishX;
        const x = Math.min(target.x, fx + 6);
        desiredPos.set(fx - 3, 3.2, target.z - 9.5);
        desiredLook.set(x + 1.5, 1.4, target.z + 3);
        stiff = 2.2;
        break;
      }
      case 'results': {
        const a = this.reduced ? 0 : this.t * 0.1;
        desiredPos.set(target.x - 6 + Math.sin(a) * 2, 2.8, target.z - 7.5);
        desiredLook.set(target.x + 1.5, 1.4, target.z + 1);
        stiff = 1.2;
        break;
      }
      default:
        desiredPos.copy(this.pos); desiredLook.copy(this.look);
    }
    const k = this._snap ? 1 : 1 - Math.exp(-dt * stiff);
    this._snap = false;
    this.pos.lerp(desiredPos, k);
    this.look.lerp(desiredLook, Math.min(1, k * 1.4));
    this.camera.position.copy(this.pos);
    // اهتزاز خفيف جدًا مرتبط بالسرعة (يُلغى مع تقليل الحركة)
    if (!this.reduced && (this.mode === 'follow')) {
      const s = Math.min(1, speed / 14) * 0.012;
      this.camera.position.y += Math.sin(this.t * 13.1) * s;
      this.camera.position.x += Math.sin(this.t * 9.7) * s * 0.5;
    }
    this.camera.lookAt(this.look);
  }
}

function followPos(target, zoom) {
  // جانبية مائلة: خلف الحصان قليلًا ومن جهة الحاجز القريب ومرتفعة
  return new THREE.Vector3(target.x - 3.6 + zoom * 1.2, 3.3 - zoom * 0.4, target.z - 9.6 + zoom * 2.2);
}
function followLook(target) {
  // ننظر قليلًا إلى الأمام وإلى داخل المضمار ليظهر المنافسون خلف حصان اللاعب
  return new THREE.Vector3(target.x + 2.4, 1.5, target.z + 3.0);
}
function smooth(t) { return t * t * (3 - 2 * t); }
