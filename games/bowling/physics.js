/* Bowling V20 physics — metre/second/kilogram, right-handed, +Y up.
 *
 * World layout (shared with scene.js and motion.js):
 *   foul line at z = 0, the lane runs toward -Z, head pin centre at z = -LENGTH,
 *   lane centre x = 0, lane surface y = 0, +X is the bowler's right when facing the pins.
 *
 * Solver: fixed 1/600 s sub-step, sequential impulses (normal + Coulomb friction with an
 * accumulated-impulse clamp), Baumgarte position bias with slop, per-body sleeping.
 * Bodies are 3D rigid bodies (position, quaternion, linear and angular velocity, full
 * world inverse-inertia tensor). The ball is one sphere; each pin is a compound of seven
 * spheres fitted inside the USBC pin profile plus an eight-point flat base ring, so a pin
 * can stand, rock on its base edge, tip, tumble, slide and roll. Environment: lane and
 * pin deck plane, rounded gutters (inside-cylinder contacts), lane/gutter edges, deck tail
 * edge, pit floor, back cushion, kickbacks and the masking ceiling.
 *
 * Ball–lane friction follows an oil pattern: low friction (skid) on the oiled front part
 * and higher friction on the dry back end. Side rotation therefore produces a hook only
 * through the friction force at the contact point, and the ball converts to a pure roll
 * when the contact-point slip vanishes. This is a bounded, documented approximation —
 * not a laboratory-accurate bowling model.
 *
 * No random numbers are used: identical inputs give identical results at any frame rate
 * (update() accumulates real time into the same fixed steps).
 */
(function (root) {
  'use strict';
  const LENGTH = 18.288, WIDTH = 1.0541, HALF = WIDTH / 2;
  const R = 0.1085, BALL_MASS = 6.4, BALL_RG = 0.0635;
  const PIN_MASS = 1.53, PIN_H = 0.381, PIN_COM = 0.145, PIN_SPACING = 0.3048, ROW = 0.26396;
  const STEP = 1 / 600, G = 9.81;
  const GUTTER_W = 0.235, GUTTER_DEPTH = 0.0476;
  const GUTTER_R = (GUTTER_DEPTH * GUTTER_DEPTH + (GUTTER_W / 2) ** 2) / (2 * GUTTER_DEPTH); // 0.169 m
  const GUTTER_AXIS_Y = GUTTER_R - GUTTER_DEPTH;
  const GUTTER_X = HALF + GUTTER_W / 2;
  const DECK_END = -LENGTH - 0.868;          // tail plank (34 3/16 in behind the head pin)
  const PIT_Y = -0.26, CUSHION_Z = -19.95, KICKBACK_X = HALF + GUTTER_W + 0.012, CEILING_Y = 0.95, CEILING_Z = -17.6;
  const OIL = { length: 12.2, ramp: 1.8, mu: 0.025, muEdge: 0.035, dry: 0.18 };
  const VMAX = 14, WMAX = 140;

  // ---------- small vector helpers on [x,y,z] arrays ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b, o = [0, 0, 0]) => { const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0]; o[0] = x; o[1] = y; o[2] = z; return o; };
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function qrot(q, v, o = [0, 0, 0]) { // rotate v by unit quaternion q=[x,y,z,w]
    const [qx, qy, qz, qw] = q, [x, y, z] = v;
    const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    o[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy; o[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz; o[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx; return o;
  }
  function qrotInv(q, v, o) { return qrot([-q[0], -q[1], -q[2], q[3]], v, o); }
  function qnorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l; return q; }

  // ---------- pin geometry (shared with the renderer) ----------
  // USBC-style profile: [height from base (m), radius (m)]
  const PIN_PROFILE = [[0, 0.0258], [0.006, 0.030], [0.019, 0.036], [0.038, 0.0430], [0.057, 0.0476], [0.086, 0.0549], [0.114, 0.0605], [0.132, 0.0598], [0.149, 0.0572], [0.167, 0.0538], [0.184, 0.0495], [0.202, 0.0423], [0.219, 0.0343], [0.238, 0.0267], [0.254, 0.0228], [0.266, 0.0230], [0.276, 0.0241], [0.298, 0.0280], [0.318, 0.0311], [0.333, 0.0322], [0.343, 0.0323], [0.356, 0.0306], [0.368, 0.0258], [0.376, 0.0175], [0.381, 0.0]];
  const PIN_SPHERES = [[0.048, 0.044], [0.105, 0.0595], [0.158, 0.054], [0.205, 0.040], [0.252, 0.0235], [0.300, 0.028], [0.340, 0.032]];
  const PIN_BASE_R = 0.0245;

  // Inertia of the pin from the profile as a stack of uniform discs (then scaled to the
  // official mass), taken about the official centre of mass height PIN_COM.
  const PIN_INERTIA = (() => {
    let vol = 0, Iax = 0, Ilat = 0, my = 0; const n = 400;
    const rAt = h => { for (let i = 1; i < PIN_PROFILE.length; i++) { const [h1, r1] = PIN_PROFILE[i], [h0, r0] = PIN_PROFILE[i - 1]; if (h <= h1) return r0 + (r1 - r0) * (h - h0) / (h1 - h0); } return 0; };
    const disc = [];
    for (let i = 0; i < n; i++) { const h = (i + 0.5) * PIN_H / n, r = rAt(h), dv = Math.PI * r * r * PIN_H / n; disc.push([h, r, dv]); vol += dv; my += dv * h; }
    const rho = PIN_MASS / vol;
    for (const [h, r, dv] of disc) { const dm = rho * dv, y = h - PIN_COM; Iax += 0.5 * dm * r * r; Ilat += dm * (r * r / 4 + y * y); }
    return { axial: Iax, lateral: Ilat, uniformCom: my / vol };
  })();

  function pinSpots() {
    const spots = []; let id = 1;
    for (let row = 0; row < 4; row++) for (let col = 0; col <= row; col++) spots.push({ id: id++, x: (col - row / 2) * PIN_SPACING, z: -LENGTH - row * ROW });
    return spots;
  }

  function makeBody(kind, mass, inertiaDiag, spheres, base) {
    return {
      kind, invMass: 1 / mass, mass,
      invIb: inertiaDiag.map(i => 1 / i), // body-space diagonal inverse inertia
      pos: [0, 0, 0], q: [0, 0, 0, 1], v: [0, 0, 0], w: [0, 0, 0],
      spheres, base, bound: Math.max(...spheres.map(s => len(s.c) + s.r)),
      asleep: false, still: 0, invIw: [1, 0, 0, 0, 1, 0, 0, 0, 1]
    };
  }
  function updateInertia(b) { // invIw = R * invIb * R^T
    const q = b.q, ex = qrot(q, [1, 0, 0]), ey = qrot(q, [0, 1, 0]), ez = qrot(q, [0, 0, 1]), d = b.invIb, m = b.invIw;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] = ex[i] * d[0] * ex[j] + ey[i] * d[1] * ey[j] + ez[i] * d[2] * ez[j];
  }
  const mulM = (m, v, o = [0, 0, 0]) => { o[0] = m[0] * v[0] + m[1] * v[1] + m[2] * v[2]; o[1] = m[3] * v[0] + m[4] * v[1] + m[5] * v[2]; o[2] = m[6] * v[0] + m[7] * v[1] + m[8] * v[2]; return o; };

  /** Oil-pattern friction for the ball (distance from the foul line d = -z, lateral x). */
  function laneFriction(x, z) {
    const d = -z;
    if (d < 0) return 0.25;                             // approach (only touched if dropped early)
    const edge = clamp((Math.abs(x) - 0.18) / 0.3, 0, 1);  // a lighter oil line on the outside boards
    const oiled = OIL.mu + (OIL.muEdge - OIL.mu) * edge;
    const k = clamp((d - OIL.length) / OIL.ramp, 0, 1), s = k * k * (3 - 2 * k);
    return oiled + (OIL.dry - oiled) * s;
  }

  /**
   * Map the player's inputs to a physical release state.
   * start (m, lateral release line), angle (deg, + toward +X), power 0..1, spin -1..1 (+ hooks toward +X).
   */
  function releaseState({ start = 0, angle = 0, power = 0.65, spin = 0, pos = null } = {}) {
    const a = clamp(angle, -3, 3) * Math.PI / 180, speed = 5.0 + clamp(power, 0, 1) * 4.0; // 18–32 km/h
    const d = [Math.sin(a), 0, -Math.cos(a)];
    const s = clamp(spin, -1, 1);
    const vel = [d[0] * speed, 0.22, d[2] * speed];               // small upward loft at the bottom of the arc
    const rollAxis = cross([0, 1, 0], d);                          // pure roll along d: w = (up x d) v / R
    const roll = 0.28 * speed / R;                                 // partial forward roll at release
    const side = 18 * s;                                           // side rotation (rad/s) about the travel axis
    const omega = [rollAxis[0] * roll + d[0] * side, 0, rollAxis[2] * roll + d[2] * side];
    const p = pos ? pos.slice() : [clamp(start, -0.4, 0.4), 0.17, -0.12];
    return { pos: p, vel, omega, speed, dir: d };
  }

  function create(opts = {}) {
    const oil = Object.assign({}, OIL, opts.oil || {});
    const ballInertia = BALL_MASS * BALL_RG * BALL_RG;
    let ball = null, pins = [], bodies = [], time = 0, acc = 0, events = [], pairState = new Map(), stats = { contacts: 0, steps: 0, maxPen: 0 };
    let headTime = -1, settledFlag = false, frozenCount = null;
    const spots = pinSpots();

    function newPin(spot) {
      const sph = PIN_SPHERES.map(([h, r]) => ({ c: [0, h - PIN_COM, 0], r }));
      const base = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; base.push([Math.cos(a) * PIN_BASE_R, -PIN_COM, Math.sin(a) * PIN_BASE_R]); }
      const b = makeBody('pin', PIN_MASS, [PIN_INERTIA.lateral, PIN_INERTIA.axial, PIN_INERTIA.lateral], sph, base);
      b.id = spot.id; b.spot = spot; b.pos = [spot.x, PIN_COM, spot.z]; b.asleep = true; b.restitution = 0.5; updateInertia(b);
      return b;
    }
    function reset() {
      pins = spots.map(newPin); ball = null; bodies = pins.slice(); time = 0; acc = 0; events = []; pairState.clear();
      headTime = -1; settledFlag = false; frozenCount = null; stats = { contacts: 0, steps: 0, maxPen: 0 };
    }
    /** Put the ball into the simulation with an exact physical state (continuity from the hand). */
    function launch(state) {
      if (!pins.length) reset();
      const b = makeBody('ball', BALL_MASS, [ballInertia, ballInertia, ballInertia], [{ c: [0, 0, 0], r: R }], null);
      b.pos = state.pos.slice(); b.v = state.vel.slice(); b.w = state.omega.slice(); b.q = state.q ? qnorm(state.q.slice()) : [0, 0, 0, 1];
      b.restitution = 0.15; b.phase = 'flight'; b.onLane = false; b.travel = 0; b.hookStart = null; b.rollStart = null; b.gutter = false; b.pit = false; b.releaseZ = b.pos[2]; b.landZ = null;
      updateInertia(b); ball = b; bodies = [b, ...pins];
      for (const p of pins) { p.asleep = true; }
      time = 0; acc = 0;
      return b;
    }

    // ---------- contacts ----------
    const contacts = [];
    const tmpA = [0, 0, 0], tmpB = [0, 0, 0];
    function addContact(A, B, p, n, pen, mu, e, type) {
      contacts.push({ A, B, p: p.slice(), n: n.slice(), pen, mu, e, type, jn: 0, jt: [0, 0, 0], bias: 0, target: 0, rA: null, rB: null, kN: 0 });
    }
    function surfaceY(ax) { // cross-section of lane, gutters and capping at |x| = ax
      if (ax <= HALF || ax >= HALF + GUTTER_W) return 0;
      const dx = ax - GUTTER_X; return GUTTER_AXIS_Y - Math.sqrt(Math.max(0, GUTTER_R * GUTTER_R - dx * dx));
    }
    function envSphere(b, c, r) { // world-space centre c, radius r (r = 0 for base points)
      const x = c[0], y = c[1], z = c[2], ax = Math.abs(x), isBall = b.kind === 'ball';
      const sg = x < 0 ? -1 : 1;
      if (z > 0) { // approach (behind the foul line): plain floor
        if (y - r < 0 && ax < 2) addContact(b, null, [x, 0, z], [0, 1, 0], r - y, 0.3, 0.1, 'approach');
      } else if (z >= DECK_END) {
        const sy = surfaceY(ax);
        if (y < sy - 0.5 * r - 0.01 && z - DECK_END < r + 0.02) {
          // below deck level, entering from the pit side: push back out through the deck end face
          addContact(b, null, [x, y, DECK_END], [0, 0, -1], z + r - DECK_END, 0.3, 0.2, 'tail');
        } else if (ax <= HALF) {
          if (y - r < 0) addContact(b, null, [x, 0, z], [0, 1, 0], r - y, isBall ? laneFriction(x, z) : 0.22, isBall ? 0.12 : 0.32, isBall ? 'lane' : 'deck');
        } else if (ax < HALF + GUTTER_W) {
          const gx = sg * GUTTER_X, dx = x - gx, dy = y - GUTTER_AXIS_Y, d = Math.hypot(dx, dy);
          if (d > 1e-6 && d + r > GUTTER_R && d < GUTTER_R + 0.04) {
            const n = [-dx / d, -dy / d, 0], cp = [gx - n[0] * GUTTER_R, GUTTER_AXIS_Y - n[1] * GUTTER_R, z];
            if (cp[1] < 0.004) addContact(b, null, cp, n, d + r - GUTTER_R, 0.18, 0.2, 'gutter');
          }
        } else if (y - r < 0 && ax < 1.2) addContact(b, null, [x, 0, z], [0, 1, 0], r - y, 0.3, 0.3, 'capping');
        // rounded edges where the lane meets the gutter and the gutter meets the capping (lines along z)
        if (r > 0) for (const ex of [HALF, HALF + GUTTER_W]) {
          if (ex === HALF ? ax <= HALF : ax >= HALF + GUTTER_W) continue;
          const lx = sg * ex, dx = x - lx, d = Math.hypot(dx, y);
          if (d < r && d > 1e-6) addContact(b, null, [lx, 0, z], [dx / d, y / d, 0], r - d, 0.2, 0.25, ex === HALF ? 'edge' : 'gutter');
        }
      } else { // pit side of the tail plank
        const sy = surfaceY(Math.min(ax, 1.5));
        if (y >= sy) {
          const dz = z - DECK_END, dy = y - sy, d = Math.hypot(dz, dy);
          if (r > 0 && d < r && d > 1e-6) addContact(b, null, [x, sy, DECK_END], [0, dy / d, dz / d], r - d, 0.25, 0.25, 'tail');
        } else if (z + r > DECK_END) addContact(b, null, [x, y, DECK_END], [0, 0, -1], z + r - DECK_END, 0.3, 0.2, 'tail');
        if (y - r < PIT_Y) addContact(b, null, [x, PIT_Y, z], [0, 1, 0], PIT_Y - (y - r), 0.6, 0.08, 'pit');
      }
      if (z - r < CUSHION_Z) addContact(b, null, [x, y, CUSHION_Z], [0, 0, 1], CUSHION_Z - (z - r), 0.7, 0.04, 'cushion');
      if (ax + r > KICKBACK_X && y < 0.8 && z < 0.5) addContact(b, null, [sg * KICKBACK_X, y, z], [-sg, 0, 0], ax + r - KICKBACK_X, 0.3, isBall ? 0.2 : 0.45, 'kickback');
      if (z < CEILING_Z && y + r > CEILING_Y) addContact(b, null, [x, CEILING_Y, z], [0, -1, 0], y + r - CEILING_Y, 0.3, 0.2, 'ceiling');
    }
    function worldPoint(b, local, o) { qrot(b.q, local, o); o[0] += b.pos[0]; o[1] += b.pos[1]; o[2] += b.pos[2]; return o; }

    function collect() {
      contacts.length = 0;
      const wc = [0, 0, 0];
      for (const b of bodies) {
        if (b.asleep) continue;
        for (const s of b.spheres) envSphere(b, worldPoint(b, s.c, wc), s.r);
        if (b.base) for (const p of b.base) envSphere(b, worldPoint(b, p, wc), 0);
      }
      // body pairs
      const ca = [0, 0, 0], cb = [0, 0, 0];
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const A = bodies[i], B = bodies[j];
        if (A.asleep && B.asleep) continue;
        const dx = A.pos[0] - B.pos[0], dy = A.pos[1] - B.pos[1], dz = A.pos[2] - B.pos[2];
        const rr = A.bound + B.bound; if (dx * dx + dy * dy + dz * dz > rr * rr) continue;
        const ball = A.kind === 'ball' || B.kind === 'ball';
        for (const sa of A.spheres) {
          worldPoint(A, sa.c, ca);
          for (const sb of B.spheres) {
            worldPoint(B, sb.c, cb);
            const ex = ca[0] - cb[0], ey = ca[1] - cb[1], ez = ca[2] - cb[2], d = Math.hypot(ex, ey, ez), rs = sa.r + sb.r;
            if (d >= rs || d < 1e-7) continue;
            const n = [ex / d, ey / d, ez / d], p = [cb[0] + n[0] * sb.r, cb[1] + n[1] * sb.r, cb[2] + n[2] * sb.r];
            addContact(A, B, p, n, rs - d, ball ? 0.14 : 0.24, ball ? 0.66 : 0.5, ball ? 'ball-pin' : 'pin-pin');
          }
        }
      }
    }

    function velAt(b, r, o) { if (!b) { o[0] = o[1] = o[2] = 0; return o; } cross(b.w, r, o); o[0] += b.v[0]; o[1] += b.v[1]; o[2] += b.v[2]; return o; }
    function applyImpulse(b, r, J) {
      if (!b || b.asleep) return;
      b.v[0] += J[0] * b.invMass; b.v[1] += J[1] * b.invMass; b.v[2] += J[2] * b.invMass;
      const t = cross(r, J, [0, 0, 0]), dw = mulM(b.invIw, t);
      b.w[0] += dw[0]; b.w[1] += dw[1]; b.w[2] += dw[2];
    }
    function effMass(c, dir) { // 1 / (n·(M^-1) n) along dir
      let k = 0;
      for (const [b, r] of [[c.A, c.rA], [c.B, c.rB]]) {
        if (!b || b.asleep) continue;
        const rn = cross(r, dir, [0, 0, 0]), t = mulM(b.invIw, rn);
        k += b.invMass + dot(cross(t, r, [0, 0, 0]), dir);
      }
      return k;
    }

    function wake(b) { if (b && b.asleep) { b.asleep = false; b.still = 0; } }

    function solve(h) {
      const va = [0, 0, 0], vb = [0, 0, 0], vr = [0, 0, 0];
      for (const c of contacts) {
        // contacts between an awake and a sleeping body wake the sleeper if they are approaching
        c.rA = [c.p[0] - c.A.pos[0], c.p[1] - c.A.pos[1], c.p[2] - c.A.pos[2]];
        c.rB = c.B ? [c.p[0] - c.B.pos[0], c.p[1] - c.B.pos[1], c.p[2] - c.B.pos[2]] : [0, 0, 0];
        velAt(c.A, c.rA, va); velAt(c.B, c.rB, vb);
        const vn = (va[0] - vb[0]) * c.n[0] + (va[1] - vb[1]) * c.n[1] + (va[2] - vb[2]) * c.n[2];
        if (c.B && (c.A.asleep !== c.B.asleep) && (vn < -0.02 || c.pen > 0.003)) { wake(c.A); wake(c.B); }
        c.kN = effMass(c, c.n);
        c.target = vn < -0.35 ? -c.e * vn : 0;
        c.bias = 0.25 / h * Math.max(0, c.pen - 0.0006);
        c.vn0 = vn;
        stats.maxPen = Math.max(stats.maxPen, c.pen);
      }
      for (let it = 0; it < 12; it++) {
        for (const c of contacts) {
          if (c.kN <= 0) continue;
          velAt(c.A, c.rA, va); velAt(c.B, c.rB, vb);
          vr[0] = va[0] - vb[0]; vr[1] = va[1] - vb[1]; vr[2] = va[2] - vb[2];
          const vn = dot(vr, c.n);
          const want = Math.max(c.target, c.bias);
          let dj = (want - vn) / c.kN; const old = c.jn; c.jn = Math.max(0, old + dj); dj = c.jn - old;
          if (dj !== 0) { const J = [c.n[0] * dj, c.n[1] * dj, c.n[2] * dj]; applyImpulse(c.A, c.rA, J); if (c.B) applyImpulse(c.B, c.rB, [-J[0], -J[1], -J[2]]); }
          // friction (vector, clamped to the friction cone)
          velAt(c.A, c.rA, va); velAt(c.B, c.rB, vb);
          vr[0] = va[0] - vb[0]; vr[1] = va[1] - vb[1]; vr[2] = va[2] - vb[2];
          const vn2 = dot(vr, c.n), vt = [vr[0] - c.n[0] * vn2, vr[1] - c.n[1] * vn2, vr[2] - c.n[2] * vn2], vtl = len(vt);
          if (vtl < 1e-9) continue;
          const tdir = [vt[0] / vtl, vt[1] / vtl, vt[2] / vtl], kT = effMass(c, tdir);
          if (kT <= 0) continue;
          const jt = [c.jt[0] - tdir[0] * vtl / kT, c.jt[1] - tdir[1] * vtl / kT, c.jt[2] - tdir[2] * vtl / kT];
          const lim = c.mu * c.jn, jl = len(jt);
          if (jl > lim) { const s = lim / jl; jt[0] *= s; jt[1] *= s; jt[2] *= s; }
          const dJ = [jt[0] - c.jt[0], jt[1] - c.jt[1], jt[2] - c.jt[2]]; c.jt = jt;
          applyImpulse(c.A, c.rA, dJ); if (c.B) applyImpulse(c.B, c.rB, [-dJ[0], -dJ[1], -dJ[2]]);
        }
      }
    }

    function emitEvents() {
      const seen = new Set();
      for (const c of contacts) {
        const key = (c.A.kind === 'ball' ? 'b' : c.A.id) + ':' + (c.B ? (c.B.kind === 'ball' ? 'b' : c.B.id) : c.type);
        if (seen.has(key)) continue; seen.add(key);
        const prev = pairState.get(key), speed = -c.vn0;
        pairState.set(key, time);
        // a sound only for a new contact (not touching during the last 60 ms) with a real approach speed
        if ((prev === undefined || time - prev > 0.06) && speed > 0.25) events.push({ type: c.type, a: c.A.kind === 'ball' ? 'ball' : 'pin', pos: c.p.slice(), speed: +speed.toFixed(3), t: +time.toFixed(4) });
      }
    }

    function integrate(h) {
      for (const b of bodies) {
        if (b.asleep) continue;
        b.v[1] -= G * h;
      }
    }
    function advance(h) {
      for (const b of bodies) {
        if (b.asleep) continue;
        const sp = len(b.v); if (sp > VMAX) { const s = VMAX / sp; b.v[0] *= s; b.v[1] *= s; b.v[2] *= s; }
        const ws = len(b.w); if (ws > WMAX) { const s = WMAX / ws; b.w[0] *= s; b.w[1] *= s; b.w[2] *= s; }
        b.pos[0] += b.v[0] * h; b.pos[1] += b.v[1] * h; b.pos[2] += b.v[2] * h;
        const [wx, wy, wz] = b.w, q = b.q;
        const dq = [wx * q[3] + wy * q[2] - wz * q[1], wy * q[3] + wz * q[0] - wx * q[2], wz * q[3] + wx * q[1] - wy * q[0], -wx * q[0] - wy * q[1] - wz * q[2]];
        q[0] += 0.5 * h * dq[0]; q[1] += 0.5 * h * dq[1]; q[2] += 0.5 * h * dq[2]; q[3] += 0.5 * h * dq[3]; qnorm(q);
        updateInertia(b);
        if (b === ball) b.travel += sp * h;
      }
    }

    function ballState(h) {
      const b = ball; if (!b) return;
      const onLane = contacts.some(c => (c.A === b) && (c.type === 'lane'));
      const inGutter = contacts.some(c => c.A === b && c.type === 'gutter');
      if (inGutter && !b.gutter && b.pos[2] > DECK_END) { b.gutter = true; }
      if (b.pos[2] < DECK_END && b.pos[1] < -0.02) b.pit = true;
      if (onLane && b.landZ === null) b.landZ = b.pos[2];
      b.onLane = onLane;
      // rolling resistance on the lane (small, bounded)
      if (onLane) {
        const sp = Math.hypot(b.v[0], b.v[2]);
        if (sp > 1e-3) { const dv = Math.min(sp, 0.012 * G * h); b.v[0] -= b.v[0] / sp * dv; b.v[2] -= b.v[2] / sp * dv; }
        // slip of the contact point decides the phase
        const r = [0, -R, 0], vc = velAt(b, r, [0, 0, 0]), slip = Math.hypot(vc[0], vc[2]);
        const prev = b.phase;
        b.phase = slip < 0.12 ? 'roll' : (laneFriction(b.pos[0], b.pos[2]) > 0.07 ? 'hook' : 'skid');
        if (b.phase === 'hook' && prev !== 'hook' && b.hookStart === null) b.hookStart = b.pos[2];
        if (b.phase === 'roll' && b.rollStart === null) b.rollStart = b.pos[2];
        b.slip = slip;
      } else if (!b.gutter && !b.pit && b.pos[1] > R + 0.004) b.phase = 'flight';
      if (b.gutter) b.phase = 'gutter';
      if (b.pit) b.phase = 'pit';
    }

    function sleepCheck(h) {
      for (const b of bodies) {
        if (b.asleep) continue;
        const e = b.v[0] ** 2 + b.v[1] ** 2 + b.v[2] ** 2 + 0.01 * (b.w[0] ** 2 + b.w[1] ** 2 + b.w[2] ** 2);
        const limit = b.kind === 'ball' ? 0.0004 : 0.0009;
        if (e < limit) b.still += h; else b.still = 0;
        if (b.still > 0.35) { b.asleep = true; b.v = [0, 0, 0]; b.w = [0, 0, 0]; }
      }
    }

    function step() {
      const h = STEP;
      time += h; stats.steps++;
      integrate(h);
      collect();
      stats.contacts = contacts.length;
      solve(h);
      emitEvents();
      advance(h);
      ballState(h);
      sleepCheck(h);
      if (ball && headTime < 0 && ball.pos[2] < -LENGTH + 0.4) headTime = time;
      if (!settledFlag && ball && settleTest()) { settledFlag = true; frozenCount = countDown(); }
    }

    function settleTest() {
      if (!ball) return false;
      const ballDone = ball.pit || ball.asleep || (ball.pos[2] < DECK_END) || (ball.gutter && ball.pos[2] < -LENGTH - 0.2);
      if (!ballDone) return false;
      // pins that left the deck (gutter, pit, kickback area) are down whatever they still do;
      // only pins that could still be standing must be at rest
      const onDeck = p => p.pos[2] > DECK_END && Math.abs(p.pos[0]) <= HALF && p.pos[1] > 0;
      const pinsQuiet = pins.every(p => {
        if (!onDeck(p) || p.asleep) return true;
        const up = pinUp(p)[1], v = len(p.v), w = len(p.w);
        return up > 0.5 ? (v < 0.03 && w < 0.25) : v < 0.15; // a pin lying on the deck may still rock or roll slowly
      });
      if (pinsQuiet && time > 0.5) return true;
      // like a pinsetter cycle: 5 s after the ball reached the pins the result is taken as final
      if (headTime >= 0 && time - headTime > 5) { for (const p of pins) { p.asleep = true; p.v = [0, 0, 0]; p.w = [0, 0, 0]; } return true; }
      return false;
    }

    function pinUp(p) { return qrot(p.q, [0, 1, 0]); }
    function standing(p) {
      const up = pinUp(p);
      const onDeck = p.pos[2] > DECK_END && Math.abs(p.pos[0]) <= HALF && Math.abs(p.pos[1] - PIN_COM) < 0.03;
      return onDeck && up[1] > Math.cos(25 * Math.PI / 180);
    }
    function countDown() { return pins.filter(p => !standing(p)).length; }

    function update(dt) {
      acc += clamp(dt, 0, 0.1);
      let n = 0;
      while (acc >= STEP - 1e-12 && n < 200) { step(); acc -= STEP; n++; }
      return n;
    }
    function drainEvents() { const e = events; events = []; return e; }
    function snapshot() {
      return {
        time, acc,
        ball: ball && { pos: ball.pos.slice(), q: ball.q.slice(), v: ball.v.slice(), w: ball.w.slice(), phase: ball.phase, travel: ball.travel },
        pins: pins.map(p => ({ id: p.id, pos: p.pos.slice(), q: p.q.slice(), v: p.v.slice(), w: p.w.slice(), asleep: p.asleep }))
      };
    }
    function finite() { return bodies.every(b => [...b.pos, ...b.q, ...b.v, ...b.w].every(Number.isFinite)); }

    reset();
    return {
      reset, launch, update, step, drainEvents, snapshot, finite, laneFriction,
      get ball() { return ball; }, get pins() { return pins; }, get time() { return time; },
      get settled() { return settledFlag; },
      get knocked() { return frozenCount !== null ? frozenCount : countDown(); },
      get standingIds() { return pins.filter(standing).map(p => p.id); },
      get reachedPins() { return headTime >= 0; },
      get stats() { return Object.assign({}, stats); },
      pinUp, oil
    };
  }

  const api = {
    create, releaseState, laneFriction, pinSpots, qrot,
    LENGTH, WIDTH, HALF, R, BALL_MASS, PIN_MASS, PIN_H, PIN_COM, PIN_PROFILE, PIN_SPHERES, PIN_INERTIA, STEP,
    GUTTER_W, GUTTER_R, GUTTER_AXIS_Y, GUTTER_X, DECK_END, PIT_Y, CUSHION_Z, KICKBACK_X, OIL,
    // aliases used by the venue builder
    OIL_END: OIL.length, GUTTER_D: GUTTER_DEPTH, KICK_X: KICKBACK_X, PIN_SPACING, ROW, rack: pinSpots
  };
  if (typeof module !== 'undefined') module.exports = api;
  root.BowlingPhysics = api;
})(typeof window !== 'undefined' ? window : globalThis);
