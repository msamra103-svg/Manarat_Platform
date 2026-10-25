/* Goalkeeper: ready stance with lateral footwork (shared stepping locomotion), anticipation, dive / jump / step-save with
 * IK hand reach to the actual intercept point, contact window, landing, and getting up. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE, V = T.Vector3, Q = T.Quaternion, M = FB.math, { clamp, lerp, smooth } = M;
  const _a = new V(), _b = new V(), _q = new Q(), _q2 = new Q(), UP = new V(0, 1, 0), ZAX = new V(0, 0, 1);

  class Keeper extends FB.Player {
    constructor(actor, o = {}) {
      super(actor, Object.assign({ homeX: 0.2, maxSpeed: 3.4, accel: 8, readyArm: { flex: 0.95, abd: 0.55, elbow: 1.25 } }, o));
      this.crouch = 1; this.armsReady = 1; this.homeX = 0.2; this.dv = null; this.ballRef = null; this.holding = false;
      this.reach = 0.0;
    }
    ready() { this.crouch = 1; this.armsReady = 1; this.dv = null; if (this.mode !== 'loco') this.setMode('loco', 0.25); }
    /** Where the palms are right now (world). */
    palmMid(out = new V()) { this.rig.palm('L', _a); this.rig.palm('R', _b); return out.copy(_a).add(_b).multiplyScalar(0.5); }
    /** Plan a dive geometry without moving anything. returns {hipEnd:V3, theta, side, reachable, td} */
    plan(target, tReach) {
      const td = Math.max(0.22, tReach), dx = target.x - this.pos.x, side = dx >= 0 ? 1 : -1, adx = Math.abs(dx);
      const cap = 0.45 + 3.0 * td, sh = Math.min(adx, cap), rem = adx - sh, arm = 0.97;
      let sin = clamp(rem / arm, 0, 0.985); const lowT = target.y < 0.9;
      if (lowT && adx > 0.6) sin = Math.max(sin, clamp((0.9 - target.y) * 0.9 + 0.35, 0, 0.9));
      const th = Math.asin(sin), cos = Math.cos(th);
      const hy = clamp(target.y - cos * arm, 0.2 + 0.74 * cos * 0.0 + 0.0, 1.55);
      const hipEnd = new V(this.pos.x + side * sh, Math.max(hy, 0.18 + 0.75 * cos * (th > 0.9 ? 0 : 1) * 0.3), target.z - 0.1);
      const shortBy = Math.max(0, rem - arm * 0.985);
      return { hipEnd, theta: th, side, td, reachable: shortBy < 0.02 && target.y <= 1.55 + cos * arm + 0.02, shortBy };
    }
    /** spec: {target:V3, tReach:s, hold:s, ball:V3 ref, kind:'dive'|'jump', miss:0..1} — after tReach the hands stay at the target while the body lands. */
    startDive(spec) {
      const pl = this.plan(spec.target, spec.tReach);
      this.dv = { t: 0, td: pl.td, side: pl.side, theta: pl.theta, p0: new V(this.pos.x, this.hipY, this.pos.z), hipEnd: pl.hipEnd, target: spec.target.clone(), hold: spec.hold === undefined ? 0.28 : spec.hold,
        rest: spec.rest === undefined ? 0.7 : spec.rest, riseT: 0.95, phase: 'dive', hopGain: spec.hopGain === undefined ? 1 : spec.hopGain, y1: pl.hipEnd.y, slide: 0, vx: 0, reachable: pl.reachable, kind: spec.kind || 'dive',
        launchLean: clamp(Math.abs(spec.target.x - this.pos.x) / 3, 0, 1), done: false, contactTime: null, held: false, handsAt: spec.target.clone() };
      this.dv.vx0 = pl.side * Math.min(3.4, Math.abs(pl.hipEnd.x - this.pos.x) / Math.max(0.2, pl.td) * 1.5);
      this.setMode('dive', 0.08); this.vel.set(0, 0, 0); this.speed = 0; this.events.push({ type: 'dive', side: pl.side, theta: pl.theta });
      return this.dv;
    }
    diving() { return !!this.dv && !this.dv.done; }
    _gc(theta) { return 0.17 + 0.78 * Math.cos(theta); }       // lowest hip height for a body tilted by theta (lying on its side = 0.17)

    update(dt) {
      if (this.mode === 'dive') { this.t += dt; this.modeT += dt; this._dive(dt); this._blend(dt); this.actor.root.updateMatrixWorld(true); return; }
      super.update(dt);
    }

    _dive(dt) {
      const d = this.dv, r = this.rig; if (!d) { this.setMode('loco', 0.1); return; }
      d.t += dt; const t = d.t, s = clamp(t / d.td);
      let theta, hx, hy, hz, reachW;
      const hipsLocal = _a.set(0, r.hipsRest.y, r.hipsRest.z);
      if (d.phase === 'dive' && t >= d.td + d.hold) { d.phase = 'down'; d.tDown = t; d.landY = d.curY; d.landX = d.curX; d.landTheta = d.curTheta; d.slideV = d.vxEnd || 0; }
      if (d.phase === 'down' && t >= d.tDown + d.rest) { d.phase = 'rise'; d.tRise = t; }
      if (d.phase === 'dive') {
        const e = 1 - Math.pow(1 - s, 2.0);                            // fast launch, decelerating lateral travel
        hx = lerp(d.p0.x, d.hipEnd.x, e); hz = lerp(d.p0.z, d.hipEnd.z, smooth(s));
        const hop = (0.12 + 0.35 * clamp((d.target.y - 1.0) / 1.2)) * (d.theta < 0.8 ? 1 : 0.35) * d.hopGain;
        hy = lerp(d.p0.y - 0.1, d.y1, smooth(s)) + hop * Math.sin(Math.PI * s) * (1 - 0.3 * s);
        theta = d.theta * smooth(clamp(s * 1.15));
        d.vxEnd = (d.hipEnd.x - d.p0.x) * 2 * (1 - s) / d.td * 0.0 + d.side * Math.max(0, 1.6 - 1.2 * s) * (d.theta > 0.5 ? 1 : 0.3);
        if (t >= d.td && d.contactTime === null) { d.contactTime = t; }
        reachW = smooth(clamp(s * 1.3 - 0.05));
        hy = Math.max(hy, this._gc(theta));
        d.curX = hx; d.curY = hy; d.curTheta = theta;
      } else if (d.phase === 'down') {
        const u = t - d.tDown, k = clamp(u / 0.35);
        d.slideV *= Math.exp(-5 * dt); d.landX += d.slideV * dt; hx = d.landX; hz = d.hipEnd.z - 0.0;
        theta = lerp(d.landTheta, d.theta > 0.6 ? Math.min(1.5, d.theta + 0.25) : d.theta * 0.6 + (d.theta < 0.4 ? 0.9 : 0), smooth(k));
        hy = Math.max(this._gc(theta), lerp(d.landY, this._gc(theta), smooth(clamp(u / 0.28))));
        reachW = lerp(1, 0, smooth(clamp(u / 0.4)));
        d.curX = hx; d.curY = hy; d.curTheta = theta;
      } else {
        const u = clamp((t - d.tRise) / d.riseT), k = smooth(u);
        hx = lerp(d.landX, d.landX + d.side * -0.0, k); hz = d.hipEnd.z;
        const th0 = d.curTheta === undefined ? 1 : d.landTh2 || (d.landTh2 = d.curTheta);
        theta = th0 * (1 - smooth(clamp(u * 1.15)));
        hy = Math.max(this._gc(theta), lerp(this._gc(th0), r.hipsRest.y - 0.12, k));
        reachW = 0;
        if (u >= 1) { this._endDive(hx, hz); return; }
      }
      // root transform: pivot at the hips
      const roll = -d.side * theta;
      this.yaw = 0; _q.setFromAxisAngle(UP, this.yaw); _q2.setFromAxisAngle(ZAX, roll); _q.multiply(_q2);
      const hl = _b.set(0, r.hipsRest.y, r.hipsRest.z).applyQuaternion(_q);
      this.root.quaternion.copy(_q); this.root.position.set(hx - hl.x, hy - hl.y, hz - hl.z); this.root.updateMatrixWorld(true);
      this.pos.set(hx, 0, hz); this.rootY = 0;
      // pose --------------------------------------------------------------
      const ex = clamp(theta / 1.3), push = d.phase === 'dive' ? Math.sin(Math.PI * clamp(s * 1.3)) : 0;
      r.hips({ x: 0, y: 0, z: 0 }, 0, 0.0, 0);
      const arch = d.phase === 'rise' ? 0.1 : -0.12 * ex;
      r.spine(arch + (d.phase === 'rise' ? 0.3 * clamp(1 - theta) : 0), -d.side * 0.0, 0);
      if (this.ballRef && d.phase === 'dive') r.lookAt(this.ballRef, 0.9, 0.7, 1); else r.look(0, d.phase === 'rise' ? 0.35 : 0.1, 0);
      // legs: FK, trailing and slightly asymmetric
      const lw = d.phase === 'rise' ? 1 - clamp((t - d.tRise) / d.riseT) : 1;
      const bend = (d.phase === 'down' ? 0.4 : 0.15) + 0.25 * push;
      r.legFK(d.side > 0 ? 'L' : 'R', -0.1 * lw, 0.12, 0.15 + bend * 0.4, 0.5).legFK(d.side > 0 ? 'R' : 'L', 0.25 * lw, 0.1, 0.35 + bend, 0.5);
      // arms: IK to the intercept point (both hands), blending from ready to reach, back to relaxed
      const tgt = d.handsAt, ax = new V(Math.cos(roll) * 1, Math.sin(roll) * 1, 0);
      for (const S of ['L', 'R']) {
        const sg = S === 'L' ? 1 : -1; r.joint('upperarm' + S, _a);
        const rdy = _b.set(sg * 0.2, 0, 0.35).applyQuaternion(this.root.quaternion).add(r.joint('spine3', new V())).add(new V(0, -0.1, 0));
        const goal = new V(tgt.x + ax.x * sg * 0.075, tgt.y + ax.y * sg * 0.075, tgt.z);
        const w = new V().lerpVectors(rdy, goal, reachW);
        r.arm(S, w, { pole: new V(sg * 0.9, -0.3, -0.6).applyQuaternion(this.root.quaternion) });
      }
      r.hand('L', 0.05, 0, 0.1).hand('R', 0.05, 0, 0.1);
      if (reachW < 0.2) { for (const S of ['L', 'R']) { r.armFK(S, 0.3 * (1 - reachW) , 0.14, 0.25, 0); } }
      d.reachW = reachW;
    }
    _endDive(hx, hz) {
      const d = this.dv; d.done = true; this.dv = null;
      this.pos.set(hx, 0, hz); this.yaw = 0; this.rootY = 0; this.root.quaternion.setFromAxisAngle(UP, 0);
      this.teleport(hx, hz, 0); this.crouch = 0.4; this.armsReady = 0.2; this.setMode('loco', 0.2);
      this.events.push({ type: 'diveEnd' });
    }
  }
  FB.Keeper = Keeper;
})(typeof window !== 'undefined' ? window : globalThis);
