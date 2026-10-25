/* Instant-replay recorder / player. Records the *rendered* state (root transform + every bone quaternion + ball) at a fixed sim-time rate into a ring buffer,
 * so a replay is exact (same poses, same ball) without re-simulating. Net bulges are re-applied from the recorded impact events. */
(function (root) {
  'use strict';
  const FB = root.FB = root.FB || {};
  const T = THREE;
  const RATE = 40, DT = 1 / RATE;

  class Replay {
    /** players: Player[] (each with .actor{root,boneList}); ball: FB.Ball; net: FB.Net|null; seconds: ring length */
    constructor(players, ball, net, seconds = 7) {
      this.players = players; this.ball = ball; this.net = net; this.max = Math.ceil(seconds * RATE); this.frames = []; this.acc = 0; this.t = 0; this.impacts = [];
      this.nb = players[0].actor.boneList.length; this.stride = 3 + 4 + 3 + this.nb * 4 + 3;     // root pos, root quat, hips pos, bones, (pad)
      this.perFrame = players.length * this.stride + 7 + 1; this.pool = []; this.playing = false; this.i = 0; this.clock = 0; this.saved = null;
    }
    clear() { this.pool.push(...this.frames); this.frames.length = 0; this.impacts.length = 0; this.acc = 0; }
    /** feed simulation time (dt already time-scaled; frozen frames pass 0) */
    record(dt) {
      if (this.playing) return; this.acc += dt; this.t += dt;
      while (this.acc >= DT) { this.acc -= DT; this.capture(); }
    }
    noteImpact(e) { this.impacts.push({ t: this.t, x: e.x, y: e.y, z: e.z, vx: e.vx || 0, vy: e.vy || 0, vz: e.vz || 0 }); if (this.impacts.length > 24) this.impacts.shift(); }
    capture() {
      const f = this.frames.length >= this.max ? this.frames.shift() : (this.pool.pop() || new Float32Array(this.perFrame)); let o = 0;
      for (const p of this.players) {
        const a = p.actor, r = a.root, bl = a.boneList;
        f[o++] = r.position.x; f[o++] = r.position.y; f[o++] = r.position.z; f[o++] = r.quaternion.x; f[o++] = r.quaternion.y; f[o++] = r.quaternion.z; f[o++] = r.quaternion.w;
        const h = bl[0].position; f[o++] = h.x; f[o++] = h.y; f[o++] = h.z;
        for (let i = 0; i < this.nb; i++) { const q = bl[i].quaternion; f[o++] = q.x; f[o++] = q.y; f[o++] = q.z; f[o++] = q.w; }
        o += 3;
      }
      const b = this.ball; f[o++] = b.p.x; f[o++] = b.p.y; f[o++] = b.p.z; f[o++] = b.q.x; f[o++] = b.q.y; f[o++] = b.q.z; f[o++] = b.q.w; f[o++] = this.t; this.frames.push(f);
    }
    /** mark "now" so a replay can start `pre` seconds earlier */
    mark() { this.markIdx = this.frames.length; this.markT = this.t; }
    /** begin playback of the last `pre` seconds up to now (+ `post` seconds already recorded after the mark) */
    start(pre = 0.6, rate = 0.7) {
      if (this.frames.length < 4) return false; const L = this.perFrame - 1, t0 = (this.markT !== undefined ? this.markT : this.t - 3) - pre;
      let i = this.frames.findIndex(f => f[L] >= t0); if (i < 0 || this.frames.length - i < 4) i = Math.max(0, this.frames.length - Math.ceil(3 * RATE));
      this.saved = this.snapshotLive(); this.i = i; this.end = this.frames.length - 1; this.clock = i; this.rate = rate; this.playing = true; this.done = false;
      if (this.net) { this.net.reset(); this.nextImpact = this.impacts.findIndex(m => m.t >= this.frames[i][L] - 1e-6); if (this.nextImpact < 0) this.nextImpact = this.impacts.length; }
      this.apply(i); return true;
    }
    snapshotLive() { const keep = this.frames, t = this.t; this.frames = []; this.capture(); const s = this.frames[0]; this.frames = keep; this.t = t; return s; }
    stop() { if (!this.playing) return; this.playing = false; if (this.saved) { this.applyFrame(this.saved); } this.saved = null; if (this.net) this.net.reset(); this.done = true; }
    /** advance by real dt; returns false when finished */
    update(dt) {
      if (!this.playing) return false; this.clock += dt * this.rate * RATE;
      const idx = Math.min(this.end, Math.floor(this.clock)); this.apply(idx, this.clock - Math.floor(this.clock));
      if (this.net) { const tNow = this.frames[idx][this.perFrame - 1]; while (this.nextImpact < this.impacts.length && this.impacts[this.nextImpact].t <= tNow) { const m = this.impacts[this.nextImpact++]; this.net.hit(m.x, m.y, m.z, m.vx, m.vy, m.vz); } this.net.update(dt * this.rate); }
      if (this.clock >= this.end + RATE * 0.9) { this.stop(); return false; } return true;
    }
    apply(i) { this.applyFrame(this.frames[i]); }
    applyFrame(f) {
      let o = 0;
      for (const p of this.players) {
        const a = p.actor, r = a.root, bl = a.boneList;
        r.position.set(f[o], f[o + 1], f[o + 2]); r.quaternion.set(f[o + 3], f[o + 4], f[o + 5], f[o + 6]); o += 7; bl[0].position.set(f[o], f[o + 1], f[o + 2]); o += 3;
        for (let i = 0; i < this.nb; i++) { bl[i].quaternion.set(f[o], f[o + 1], f[o + 2], f[o + 3]); o += 4; } o += 3;
      }
      this.view = { x: f[o], y: f[o + 1], z: f[o + 2], q: [f[o + 3], f[o + 4], f[o + 5], f[o + 6]] };
    }
    get ballView() { return this.view; }
  }
  FB.Replay = Replay;
})(typeof window !== 'undefined' ? window : globalThis);
