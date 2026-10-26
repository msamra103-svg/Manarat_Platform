/* Bowling V20 choreography — pure timing/geometry for the human bowler (runs in Node too).
 *
 * Conventions (documented in DEVELOPMENT.md):
 *   World: metres, +Y up, foul line z = 0, pins toward -Z, +X = bowler's right when facing the pins.
 *   Approach frame: origin O = (start, 0, 0) (release line on the foul line), unit heading
 *   d = (sin a, 0, -cos a) toward the pins (a = aim angle), lateral r = (cos a, 0, sin a).
 *   A local point (s, l, y) maps to O + d*s + r*(hs*l) + up*y, where hs = +1 for a right-handed
 *   bowler and -1 for a left-handed bowler (mirroring is done here, deliberately, once).
 *   Local l > 0 is toward the throwing side. The ball swing plane is l = 0; the body centre
 *   line is l = BODY_L (the ball swings beside — not through — the throwing-side leg).
 *   Character yaw (rig faces +Z in its bind pose) = PI - a, so the bowler always faces d.
 *
 * The right-handed delivery (mirrored for left-handed):
 *   stance (ball in both hands) -> step 1 trail foot + pushaway -> step 2 slide foot + downswing
 *   (non-throwing hand separates) -> step 3 trail foot + backswing -> step 4 slide foot plants and
 *   slides while the ball swings forward -> low release beside the sliding ankle -> follow-through
 *   -> balanced finish (trailing leg behind and across, toe on the floor) -> recovery.
 * Feet are described by the ball-of-foot (toe joint) ground point plus a heel-raise angle; while a
 * foot is planted that point never moves (no skating) — only the slide foot slides, on purpose.
 */
(function (root) {
  'use strict';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const smoother = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

  // Rig dimensions measured from the Rocketbox bind pose (games/bowling/assets/models/athlete_*.glb)
  const DIMS = {
    legLength: 0.794,       // hip joint -> ankle (thigh 0.398 + shank 0.396)
    hipHalf: 0.088,         // lateral offset of each hip joint from the pelvis centre
    ankleUp: 0.099,         // ankle above the toe joint with the foot flat
    ankleBack: 0.134,       // ankle behind the toe joint with the foot flat
    pelvisStand: 0.895
  };
  const BODY_L = -0.30;     // body centre line relative to the ball swing plane (local l)
  const FOOT_HALF = 0.09;

  /** Monotone-safe cubic Hermite through keys [t, value, slope]. */
  function hermite(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    const last = keys[keys.length - 1]; if (t >= last[0]) return last[1] + (last[2] || 0) * 0;
    let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
    const [t0, p0, m0r] = keys[i], [t1, p1, m1r] = keys[i + 1], h = t1 - t0, u = (t - t0) / h;
    let m0 = m0r * h, m1 = m1r * h; const dp = p1 - p0;
    if (Math.abs(dp) > 1e-9) { // Fritsch–Carlson limit keeps monotone segments monotone
      const a = m0 / dp, b = m1 / dp, s = a * a + b * b;
      if (a < 0) m0 = 0; if (b < 0) m1 = 0;
      if (s > 9) { const k = 3 / Math.sqrt(s); m0 *= k; m1 *= k; }
    }
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
  }
  function hermiteSlope(keys, t, e = 1e-3) { return (hermite(keys, t + e) - hermite(keys, t - e)) / (2 * e); }

  /** Ankle position relative to the toe joint for a heel-raise angle phi (rad, heel up > 0). */
  function ankleFromToe(phi) {
    const c = Math.cos(phi), s = Math.sin(phi);
    return { f: -DIMS.ankleBack * c + DIMS.ankleUp * s, y: DIMS.ankleBack * s + DIMS.ankleUp * c };
  }

  function plan(opts = {}) {
    const hs = opts.hand === 'left' ? -1 : 1;
    const a = clamp(opts.angle || 0, -3, 3) * Math.PI / 180;
    const power = clamp(opts.power ?? 0.65, 0, 1);
    const k = 1.06 - 0.12 * power;                     // tempo: a stronger shot is a slightly quicker approach
    const T = x => x * k;
    const O = [clamp(opts.start || 0, -0.4, 0.4), 0, 0];
    const d = [Math.sin(a), 0, -Math.cos(a)], r = [Math.cos(a), 0, Math.sin(a)];
    const releaseSpeed = 5.0 + power * 4.0;
    const P = {
      hs, angle: a, power, k, O, d, r, yaw: Math.PI - a, releaseSpeed,
      slide: hs > 0 ? 'L' : 'R', trail: hs > 0 ? 'R' : 'L', throwHand: hs > 0 ? 'R' : 'L', otherHand: hs > 0 ? 'L' : 'R',
      t: {
        step1: [T(0.10), T(0.48)], step2: [T(0.52), T(0.92)], step3: [T(0.96), T(1.32)], step4: [T(1.36), T(1.62)],
        slideEnd: T(2.02), trailPush: T(1.44), trailOff: T(1.70), trailSet: T(2.08),
        pushaway: [T(0.08), T(0.52)], downswing: [T(0.52), T(0.92)], backswing: [T(0.92), T(1.32)], forward: [T(1.32), T(1.96)],
        release: T(1.96), follow: T(2.42), finish: T(2.62)
      },
      backswingTop: -(1.22 + 0.42 * power),
      thetaRelease: 0.02
    };
    // ball-of-foot (toe joint) ground points, local (s, l)
    const lc = BODY_L;
    P.foot = {
      slide: { stance: [-3.10, lc - FOOT_HALF], p2: [-2.04, lc - FOOT_HALF + 0.01], contact: [-0.59, lc - 0.02], end: [-0.09, lc + 0.03] },
      trail: { stance: [-3.14, lc + FOOT_HALF], p1: [-2.66, lc + FOOT_HALF], p3: [-1.34, lc + FOOT_HALF - 0.01], finish: [-0.87, lc - 0.21] }
    };
    // pelvis keys [t, value, slope]
    P.pelvisS = [[0, -3.25, 0], [T(0.48), -2.99, 1.0 / k], [T(0.92), -2.43, 1.55 / k], [T(1.32), -1.72, 1.9 / k], [T(1.62), -1.10, 2.0 / k], [T(1.96), -0.47, 0.7 / k], [T(2.30), -0.37, 0.08 / k], [T(2.62), -0.36, 0]];
    P.pelvisY = [[0, 0.865, 0], [T(0.25), 0.858, 0], [T(0.48), 0.84, 0], [T(0.71), 0.85, 0], [T(0.92), 0.815, 0], [T(1.12), 0.83, 0], [T(1.32), 0.785, -0.2], [T(1.47), 0.76, -0.3], [T(1.62), 0.69, -0.45], [T(1.82), 0.575, -0.28], [T(1.96), 0.52, -0.08], [T(2.30), 0.525, 0], [T(2.62), 0.54, 0]];
    P.pelvisL = [[0, lc, 0], [T(0.48), lc + 0.012, 0], [T(0.92), lc - 0.012, 0], [T(1.32), lc + 0.01, 0], [T(1.62), lc - 0.01, 0], [T(1.96), lc + 0.01, 0], [T(2.62), lc + 0.01, 0]];
    // torso: forward lean of the pelvis (tilt) and of the spine (bend), side bend and twist
    P.tilt = [[0, 0.06, 0], [T(0.5), 0.08, 0], [T(1.32), 0.14, 0], [T(1.62), 0.2, 0], [T(1.96), 0.30, 0], [T(2.62), 0.28, 0]];
    P.bend = [[0, 0.14, 0], [T(0.5), 0.20, 0], [T(0.92), 0.24, 0], [T(1.32), 0.30, 0], [T(1.62), 0.50, 0], [T(1.96), 0.90, 0], [T(2.3), 0.84, 0], [T(2.62), 0.78, 0]];
    P.side = [[0, 0, 0], [T(0.92), 0.03, 0], [T(1.32), 0.06, 0], [T(1.96), 0.26, 0], [T(2.62), 0.18, 0]];
    P.twist = [[0, 0, 0], [T(0.92), -0.06, 0], [T(1.32), -0.16, 0], [T(1.72), -0.04, 0], [T(1.96), 0.03, 0], [T(2.62), 0.06, 0]];
    // ball swing angle (0 = hanging, + forward) from the end of the pushaway
    const tf0 = P.t.forward[0], tr = P.t.release, wRel = (releaseSpeed - 1.25) / 0.66; // arm angular speed at release (hand speed ≈ launch speed)
    P.wRelease = wRel;
    P.theta = [[P.t.pushaway[1], 0.78, -1.6 / k], [P.t.downswing[1], -0.45, -3.6 / k], [P.t.backswing[1] - T(0.05), P.backswingTop, 0], [P.t.backswing[1], P.backswingTop, 0]];
    P.forwardSwing = { t0: P.t.backswing[1], t1: tr, th0: P.backswingTop, th1: P.thetaRelease, w1: wRel };
    P.follow = { t0: tr, t1: P.t.follow, th0: P.thetaRelease, th1: 2.35, w0: wRel };
    P.end = P.t.finish;
    return P;
  }

  function world(P, s, l, y = 0) {
    const L = l * P.hs;
    return [P.O[0] + P.d[0] * s + P.r[0] * L, y, P.O[2] + P.d[2] * s + P.r[2] * L];
  }

  /** Swing angle of the throwing arm at time t (null while the ball is held against the body). */
  function swingTheta(P, t) {
    const pa = P.t.pushaway;
    if (t < pa[1]) return null;
    if (t <= P.t.backswing[1]) return hermite(P.theta, t);
    const f = P.forwardSwing;
    if (t <= f.t1) { // cubic: zero speed at the top, w1 at release
      const h = f.t1 - f.t0, u = (t - f.t0) / h, u2 = u * u, u3 = u2 * u, d = f.th1 - f.th0;
      return f.th0 + d * (3 * u2 - 2 * u3) + f.w1 * h * (u3 - u2);
    }
    const g = P.follow;
    if (t <= g.t1) { const h = g.t1 - g.t0, u = (t - g.t0) / h, u2 = u * u, u3 = u2 * u, d = g.th1 - g.th0; return g.th0 + (u3 - 2 * u2 + u) * g.w0 * h + (-2 * u3 + 3 * u2) * d; }
    return g.th1 - 0.12 * smooth((t - g.t1) / 0.6);
  }

  /** Foot state: toe-joint ground point (world), heel raise, lift, heading offset, contact. */
  function footState(P, which, t) {
    const F = P.foot[which], T = P.t;
    let s, l, lift = 0, heel = 0, turn = 0.1, contact = 'planted';
    const swing = (a, b, t0, t1, peak = 0.075) => {
      const u = clamp((t - t0) / (t1 - t0), 0, 1), e = smoother(u);
      s = lerp(a[0], b[0], e); l = lerp(a[1], b[1], e);
      lift = peak * Math.sin(Math.PI * clamp(u * 1.06, 0, 1));
      heel = u < 0.5 ? lerp(0.55, 0.05, u / 0.5) : lerp(0.05, -0.12, (u - 0.5) / 0.4);
      if (u > 0.9) heel = lerp(-0.12, 0, (u - 0.9) / 0.1);
      contact = 'swing';
    };
    const preLift = (pt, tl, amount = 0.55, dur = 0.2 * P.k) => { s = pt[0]; l = pt[1]; heel = amount * smooth((t - (tl - dur)) / dur); };
    if (which === 'trail') {
      const [a1, b1] = T.step1, [a3, b3] = T.step3;
      if (t < a1) preLift(F.stance, a1, 0.35, 0.12 * P.k);
      else if (t < b1) swing(F.stance, F.p1, a1, b1);
      else if (t < a3) preLift(F.p1, a3);
      else if (t < b3) swing(F.p1, F.p3, a3, b3);
      else if (t < T.trailOff) { s = F.p3[0]; l = F.p3[1]; heel = 0.95 * smooth((t - T.trailPush) / (T.trailOff - T.trailPush)); }
      else if (t < T.trailSet) {
        const u = (t - T.trailOff) / (T.trailSet - T.trailOff), e = smooth(u);
        s = lerp(F.p3[0], F.finish[0], e); l = lerp(F.p3[1], F.finish[1], smoother(u));
        lift = 0.06 * Math.sin(Math.PI * clamp(u * 1.15, 0, 1));
        heel = lerp(0.95, 1.08, e); turn = lerp(0.1, -0.55, e); contact = u > 0.85 ? 'toe' : 'swing';
      } else { s = F.finish[0]; l = F.finish[1]; heel = 1.08; turn = -0.55; contact = 'toe'; }
    } else {
      const [a2, b2] = T.step2, [a4, b4] = T.step4;
      if (t < a2) { s = F.stance[0]; l = F.stance[1]; heel = 0; preLift(F.stance, a2); }
      else if (t < b2) swing(F.stance, F.p2, a2, b2);
      else if (t < a4) preLift(F.p2, a4, 0.5);
      else if (t < b4) { swing(F.p2, F.contact, a4, b4, 0.06); if ((t - a4) / (b4 - a4) > 0.75) heel = lerp(-0.06, 0, ((t - a4) / (b4 - a4) - 0.75) / 0.25); }
      else if (t < T.slideEnd) { const u = (t - b4) / (T.slideEnd - b4), e = 1 - (1 - u) * (1 - u); s = lerp(F.contact[0], F.end[0], e); l = lerp(F.contact[1], F.end[1], e); contact = 'slide'; turn = 0.04; }
      else { s = F.end[0]; l = F.end[1]; contact = 'planted'; turn = 0.04; }
      if (t >= b4) turn = 0.04;
    }
    const an = ankleFromToe(heel);
    return { toe: world(P, s, l, 0), s, l, lift, heel, turn: turn, contact, ankleLocal: an };
  }

  /** Recovery after the finish: the trailing foot steps up beside the slide foot and the bowler stands. */
  function recoverState(P, tr) {
    const F = P.foot, u = clamp(tr / 0.9, 0, 1), fin = sample(P, P.end);
    const rise = smooth(u);
    const slideToe = F.slide.end, trailFrom = F.trail.finish, trailTo = [slideToe[0] - 0.03, BODY_L + FOOT_HALF];
    const st = clamp((tr - 0.15) / 0.55, 0, 1), e = smoother(st);
    const trail = {
      toe: world(P, lerp(trailFrom[0], trailTo[0], e), lerp(trailFrom[1], trailTo[1], e), 0),
      lift: 0.05 * Math.sin(Math.PI * st), heel: st < 1 ? lerp(1.08, 0, smooth(st * 1.3)) : 0, turn: lerp(-0.55, 0.1, e), contact: st > 0 && st < 1 ? 'swing' : 'planted'
    };
    trail.ankleLocal = ankleFromToe(trail.heel);
    const slide = { toe: world(P, slideToe[0], slideToe[1], 0), lift: 0, heel: 0, turn: lerp(0.04, -0.1, rise), contact: 'planted' };
    slide.ankleLocal = ankleFromToe(0);
    const ps = lerp(hermite(P.pelvisS, P.end), slideToe[0] - 0.16, rise), py = lerp(fin.pelvis[1], 0.865, rise), pl = lerp(hermite(P.pelvisL, P.end), BODY_L + 0.03, rise);
    return {
      pelvis: world(P, ps, pl, py), tilt: lerp(fin.tilt, 0.05, rise), bend: lerp(fin.bend, 0.1, rise), side: lerp(fin.side, 0, rise), twist: lerp(fin.twist, 0, rise),
      feet: { [P.slide]: slide, [P.trail]: trail }, rise, done: u >= 1
    };
  }

  /** Full pose request at approach time t (t < 0 = stance). */
  function sample(P, t) {
    const tc = Math.max(0, Math.min(t, P.end + 2));
    const ps = hermite(P.pelvisS, tc), py = hermite(P.pelvisY, tc), pl = hermite(P.pelvisL, tc);
    const breathe = t < 0 ? 0.006 * Math.sin(t * 2.4) : 0;
    const feet = { [P.slide]: footState(P, 'slide', tc), [P.trail]: footState(P, 'trail', tc) };
    const theta = swingTheta(P, tc);
    // the ball is held against the body until the end of the pushaway; then it hangs from the throwing arm
    const pa = P.t.pushaway, u = clamp((tc - pa[0]) / (pa[1] - pa[0]), 0, 1), e = smooth(u);
    const held = { forward: lerp(0.29, 0.34, e), down: lerp(0.21, 0.25, e), lateral: lerp(0.09, 0.11, e) }; // in the chest frame
    const pend = clamp((tc - (pa[1] - 0.10 * P.k)) / (0.16 * P.k), 0, 1);   // blend held -> pendulum
    const supportOff = smooth((tc - (P.t.downswing[0] - 0.08 * P.k)) / (0.2 * P.k)); // non-throwing hand leaves the ball
    const released = t >= P.t.release;
    const vel = hermiteSlope(P.pelvisS, tc);
    let phase = 'stance';
    if (t >= 0) phase = tc < pa[1] ? 'pushaway' : tc < P.t.downswing[1] ? 'downswing' : tc < P.t.backswing[1] ? 'backswing' : tc < P.t.release ? 'forward' : tc < P.t.follow ? 'follow' : 'finish';
    return {
      t, phase, released,
      pelvis: world(P, ps, pl, py + breathe), pelvisVel: vel,
      tilt: hermite(P.tilt, tc), bend: hermite(P.bend, tc) + breathe * 2, side: hermite(P.side, tc), twist: hermite(P.twist, tc),
      feet, theta, held, pendulum: theta === null ? 0 : smooth(pend), support: 1 - supportOff,
      reach: theta === null ? 0.9 : lerp(0.94, 0.99, smooth((tc - P.t.downswing[0]) / (0.3 * P.k))),
      palmRoll: released ? 0 : 0,
      look: world(P, 6.0, 0.0, 0.05) // past the arrows along the target line
    };
  }

  /** Spot check helpers used by the tests. */
  function hipAnkleReach(P, t) {
    const s = sample(P, t), out = {};
    for (const side of ['L', 'R']) {
      const f = s.feet[side];
      const sgn = (side === 'L' ? -1 : 1);                  // character's left is -r in world
      const hip = [s.pelvis[0] + P.r[0] * DIMS.hipHalf * sgn, s.pelvis[1], s.pelvis[2] + P.r[2] * DIMS.hipHalf * sgn];
      const an = f.ankleLocal, heading = P.d;
      const ankle = [f.toe[0] + heading[0] * an.f, an.y + f.lift, f.toe[2] + heading[2] * an.f];
      out[side] = Math.hypot(hip[0] - ankle[0], hip[1] - ankle[1], hip[2] - ankle[2]) / DIMS.legLength;
    }
    return out;
  }

  const api = { plan, sample, world, swingTheta, footState, recoverState, hermite, ankleFromToe, hipAnkleReach, DIMS, BODY_L, smooth, smoother, clamp, lerp };
  if (typeof module !== 'undefined') module.exports = api;
  root.BowlingMotion = api;
})(typeof window !== 'undefined' ? window : globalThis);
