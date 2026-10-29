/* عدّاء قطر — obstacle rows and coins: a fair procedural generator (every row keeps a reachable safe lane,
 * difficulty ramps up gradually, hazards appear far ahead, none near question gates), collision volumes,
 * knock-over animation for low obstacles and pooled meshes.
 */
(function (root) {
  'use strict';
  const T = root.THREE, P = root.QRProps;
  const LANES = [-2.5, 0, 2.5];
  const LANE_TIME = 0.3;        // seconds the player needs per lane change, incl. reaction
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // kinds: action 'jump' (low), 'slide' (overhead), 'block' (dodge only)
  const KINDS = {
    cone: { build: () => P.cone(), action: 'jump', box: [0.5, 0.78, 0.5], zones: ['corniche', 'souq'], triple: true },
    jersey: { build: () => P.jersey(), action: 'jump', box: [2.15, 0.95, 0.7], zones: ['corniche'] },
    hurdle: { build: () => P.hurdle(), action: 'jump', box: [2.15, 1.02, 0.5], zones: ['corniche', 'souq'] },
    beam: { build: () => P.beam(), action: 'slide', box: [2.4, 1.0, 0.3], yMin: 1.18, zones: ['corniche'] },
    suv: { build: () => P.car('suv'), action: 'block', box: [2.0, 1.9, 5.0], zones: ['corniche'], paint: true },
    sedan: { build: () => P.car('sedan'), action: 'block', box: [1.85, 1.5, 4.8], zones: ['corniche'], paint: true },
    van: { build: () => P.van(), action: 'block', box: [2.2, 3.0, 6.2], zones: ['corniche'], paint: true },
    crates: { build: () => P.crates(), action: 'jump', box: [1.75, 1.05, 0.62], zones: ['souq'] },
    cart: { build: () => P.cart(), action: 'block', box: [1.95, 2.1, 2.7], zones: ['souq'] },
    rug: { build: () => P.carpetBanner(), action: 'slide', box: [2.4, 1.3, 0.25], yMin: 1.24, zones: ['souq'] }
  };
  const PAINTS = ['#e4e4e1', '#e4e4e1', '#b9bdc2', '#1c1d20', '#2c3e57', '#6e1029', '#7a7f85', '#cfc8ba'];

  class Track {
    constructor(scene, track, opts = {}) {
      this.track = track; this.rows = []; this.coins = []; this.nextS = 70; this.seed = opts.seed || 2026; this.rnd = mulberry(this.seed);
      this.templates = {}; this.free = {}; for (const k in KINDS) { this.templates[k] = P.group(KINDS[k].build()); this.free[k] = []; }
      const cd = P.coin(); this.coinMesh = new T.InstancedMesh(cd.parts[0].geo, cd.parts[0].mat, 260); this.coinMesh.frustumCulled = false; this.coinMesh.castShadow = false;
      this.coinFree = []; const z = new T.Matrix4().makeScale(0, 0, 0); for (let i = 259; i >= 0; i--) { this.coinFree.push(i); this.coinMesh.setMatrixAt(i, z); } this.zero = z; this.coinMesh.count = 0; this.coinUsed = new Uint8Array(260); track.add(this.coinMesh);
      this.difficulty = opts.difficulty || 'normal'; this.blocked = []; this.knocked = []; this.lastCoinS = -999; this.reach = 0b111; this.lastS = 0;
      this._m = new T.Matrix4(); this._q = new T.Quaternion(); this._e = new T.Euler(); this._v = new T.Vector3(); this._s = new T.Vector3(1, 1, 1);
    }
    reset(opts = {}) { for (const r of this.rows) this.freeRow(r); this.rows = []; for (const c of this.coins) this.freeCoin(c); this.coins = []; this.nextS = opts.start || 70; this.rnd = mulberry(opts.seed || this.seed); this.reach = 0b111; this.lastS = 0; this.knocked = []; this.lastCoinS = -999; }
    setBlocked(list) { this.blocked = list; } // [[s0, s1], …] intervals without hazards (gates, finish)
    isBlocked(s) { return this.blocked.some(([a, b]) => s > a && s < b); }
    obj(kind) { const g = this.free[kind].pop() || this.templates[kind].clone(); g.visible = true; g.rotation.set(0, 0, 0); g.position.set(0, 0, 0); this.track.add(g); return g; }
    freeObj(o) { this.track.remove(o.g); this.free[o.kind].push(o.g); }
    freeRow(r) { for (const o of r.objs) this.freeObj(o); }
    freeCoin(c) { if (c.id >= 0) { this.coinMesh.setMatrixAt(c.id, this.zero); this.coinUsed[c.id] = 0; this.coinFree.push(c.id); this.coinFree.sort((a, b) => b - a); let n = this.coinMesh.count; while (n > 0 && !this.coinUsed[n - 1]) n--; this.coinMesh.count = n; this.coinMesh.instanceMatrix.needsUpdate = true; } }
    // -------------------------------------------------------------- generation
    level(s) { return Math.min(1, s / 1600); }
    gapFor(speed) { const base = { easy: 2.35, normal: 1.85, hard: 1.45 }[this.difficulty] || 1.85; return Math.max(15, speed * base); }
    generate(distance, speed, zoneAt) {
      while (this.nextS < distance + 240) {
        const s = this.nextS;
        if (this.isBlocked(s)) { this.nextS += 6; this.reach = 0b111; continue; }
        const gap = this.gapFor(Math.max(speed, 6));
        this.makeRow(s, zoneAt(s), Math.max(speed, 6), gap);
        this.nextS = s + gap * (0.85 + this.rnd() * 0.45);
      }
    }
    makeRow(s, zone, speed, gap) {
      const rnd = this.rnd, L = this.level(s);
      // how many lanes the player can travel since the previous row
      const dt = (s - this.lastS) / speed, k = Math.max(0, Math.min(2, Math.floor(dt / LANE_TIME)));
      let reach = this.reach; for (let i = 0; i < k; i++) reach = reach | ((reach << 1) & 0b111) | (reach >> 1);
      if (this.lastS === 0) reach = 0b111;
      // pick lane contents
      const easy = this.difficulty === 'easy', hard = this.difficulty === 'hard';
      const pBlock = (easy ? 0.25 : hard ? 0.5 : 0.38) + 0.15 * L, nMax = L > 0.35 || hard ? 2 : 1;
      const lanes = ['free', 'free', 'free'];
      const order = [0, 1, 2].sort(() => rnd() - 0.5);
      let nUsed = 0;
      for (const i of order) {
        if (nUsed >= nMax + (rnd() < 0.25 + 0.3 * L ? 1 : 0)) break;
        const r = rnd();
        lanes[i] = r < pBlock ? 'block' : r < pBlock + 0.33 ? 'jump' : 'slide'; nUsed++;
      }
      // fairness: keep at least one passable lane inside the reachable set
      let pass = 0; lanes.forEach((t, i) => { if (t !== 'block') pass |= 1 << i; });
      if (!(pass & reach)) { const cand = [0, 1, 2].filter(i => reach & (1 << i)); const i = cand[(rnd() * cand.length) | 0]; lanes[i] = rnd() < 0.5 ? 'free' : 'jump'; pass |= 1 << i; }
      if (lanes.every(t => t === 'block')) lanes[1] = 'free';
      const row = { s, lanes, objs: [], zone };
      lanes.forEach((t, i) => { if (t !== 'free') this.place(row, i, t, zone, rnd); });
      // vehicles occupy length: push the next row further so it is not hidden behind a van
      this.rows.push(row); this.reach = pass & reach; this.lastS = s;
      // coins along a passable lane
      if (rnd() < 0.8) {
        const opts = [0, 1, 2].filter(i => pass & (1 << i)); const li = opts[(rnd() * opts.length) | 0], t = lanes[li];
        const len = 6 + ((rnd() * 4) | 0);
        for (let c = 0; c < len; c++) {
          const cs = s - 4 - (len - 1 - c) * 2.2; if (cs < this.lastCoinS + 1.5 || this.isBlocked(cs)) continue;
          this.addCoin(cs, LANES[li], 0.95);
        }
        if (t === 'jump') for (let c = -2; c <= 2; c++) { const y = 0.95 + 1.15 * (1 - (c / 2.6) ** 2); this.addCoin(s + c * 1.8, LANES[li], y); }
        if (t === 'slide') this.addCoin(s, LANES[li], 0.45);
        this.lastCoinS = s + 4;
      }
    }
    place(row, lane, action, zone, rnd, forced) {
      const kinds = Object.keys(KINDS).filter(k => KINDS[k].action === action && KINDS[k].zones.includes(zone));
      let kind = forced || kinds[(rnd() * kinds.length) | 0]; if (!kind) return;
      const K = KINDS[kind], x = LANES[lane];
      if (K.triple) { for (const dx of [-0.75, 0, 0.75]) { const g = this.obj(kind); g.position.set(x + dx, 0, -row.s); row.objs.push({ kind, g, lane, action, box: { x0: x + dx - 0.25, x1: x + dx + 0.25, y0: 0, y1: K.box[1], s0: row.s - 0.25, s1: row.s + 0.25 } }); } return; }
      const g = this.obj(kind); g.position.set(x, 0, -row.s);
      if (K.paint) { const col = new T.Color(PAINTS[(rnd() * PAINTS.length) | 0]).convertSRGBToLinear(); g.children.forEach(m => { if (m.name === 'body') { if (!m.userData.own) { m.material = m.material.clone(); m.userData.own = true; } m.material.color.copy(col); } }); }
      if (action === 'block') { rnd(); g.rotation.y = Math.PI; } // parked facing the direction of travel of this carriageway (right-hand traffic)
      const half = K.box[2] / 2, sOff = action === 'block' ? half - 0.4 : 0; // vehicles start at the row and extend ahead
      if (action === 'block') g.position.z = -(row.s + sOff);
      row.objs.push({ kind, g, lane, action, box: { x0: x - K.box[0] / 2, x1: x + K.box[0] / 2, y0: K.yMin || 0, y1: (K.yMin || 0) + K.box[1], s0: row.s + sOff - half, s1: row.s + sOff + half } });
    }
    testRow(s, lanes, zone) { const row = { s, lanes: lanes.slice(), objs: [], zone }; const r0 = this.rnd; this.rnd = () => 0; lanes.forEach((t, i) => { if (t === 'free') return; if (KINDS[t]) { row.lanes[i] = KINDS[t].action; this.place(row, i, KINDS[t].action, zone, this.rnd, t); } else this.place(row, i, t, zone, this.rnd); }); this.rnd = r0; this.rows.push(row); this.rows.sort((a, b) => a.s - b.s); return row; }
    addCoin(s, x, y) { const id = this.coinFree.pop(); if (id === undefined) return; this.coinUsed[id] = 1; if (id + 1 > this.coinMesh.count) this.coinMesh.count = id + 1; this.coins.push({ s, x, y, id, taken: false, t: 0 }); }
    // -------------------------------------------------------------- per frame
    update(dt, distance, time) {
      // cull behind
      while (this.rows.length && this.rows[0].s < distance - 25) this.freeRow(this.rows.shift());
      for (let i = this.coins.length - 1; i >= 0; i--) { const c = this.coins[i]; if (c.s < distance - 6 || (c.taken && c.t > 0.35)) { this.freeCoin(c); this.coins.splice(i, 1); } }
      // spin / collect animation
      const m = this._m, q = this._q, e = this._e, v = this._v, sc = this._s;
      for (const c of this.coins) {
        if (c.taken) { c.t += dt; const k = c.t / 0.35; v.set(c.x, c.y + k * 1.4, -c.s); sc.setScalar(Math.max(0.01, 1 - k)); }
        else { v.set(c.x, c.y + Math.sin(time * 3 + c.s) * 0.06, -c.s); sc.setScalar(1); }
        q.setFromEuler(e.set(0, time * 3.2 + c.s * 0.3, 0)); m.compose(v, q, sc); this.coinMesh.setMatrixAt(c.id, m);
      }
      this.coinMesh.instanceMatrix.needsUpdate = true;
      // knocked-over obstacles
      for (let i = this.knocked.length - 1; i >= 0; i--) { const k = this.knocked[i]; k.t += dt; const g = k.o.g; g.rotation.x = -Math.min(1.45, k.t * 5) * k.dir; g.position.z -= k.vz * dt; g.position.y = Math.max(0, g.position.y + k.vy * dt); k.vy -= 9.8 * dt; k.vz *= 0.96; if (k.t > 1.2) this.knocked.splice(i, 1); }
    }
    // player AABB vs obstacles. p = {s, x, y, h, half}
    collide(p) {
      for (const r of this.rows) {
        if (r.s > p.s + 8) break; if (r.s < p.s - 8) continue;
        for (const o of r.objs) {
          if (o.hit) continue; const b = o.box;
          if (p.s + p.half < b.s0 || p.s - p.half > b.s1) continue;
          if (p.x + 0.3 < b.x0 || p.x - 0.3 > b.x1) continue;
          if (p.y + p.h < b.y0 || p.y + 0.16 > b.y1) continue; // feet tuck: a little overlap at the top edge is forgiven
          return o;
        }
      }
      return null;
    }
    knock(o, speed) { o.hit = true; if (o.action === 'jump') this.knocked.push({ o, t: 0, vz: speed * 0.5, vy: 1.8, dir: 1 }); }
    collect(p) { let n = 0; for (const c of this.coins) { if (c.taken) continue; if (Math.abs(c.s - p.s) < 0.8 && Math.abs(c.x - p.x) < 0.75 && Math.abs(c.y - (p.y + 0.9)) < 1.0) { c.taken = true; n++; } } return n; }
    rowAt(s) { return this.rows.find(r => Math.abs(r.s - s) < 3); }
    freeLaneNear(s, from) { // used after a frontal bump into a vehicle
      const blocked = new Set(); for (const r of this.rows) for (const o of r.objs) if (o.action === 'block' && s > o.box.s0 - 12 && s < o.box.s1 + 2) blocked.add(o.lane);
      const order = [from - 1, from + 1, from - 2, from + 2].filter(i => i >= 0 && i <= 2);
      return order.find(i => !blocked.has(i));
    }
    snapshot() { return { rows: this.rows.length, coins: this.coins.length, next: Math.round(this.nextS) }; }
  }
  root.QRTrack = { Track, LANES, KINDS };
})(typeof window !== 'undefined' ? window : globalThis);
