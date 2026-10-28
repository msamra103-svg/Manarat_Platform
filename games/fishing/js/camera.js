/* صيد الأسماك V24 — cinematic camera director: automatic shot selection per fishing phase plus
 * user-selectable wide / over-the-shoulder / float / underwater cameras. Smooth critically-damped
 * tracking, hard cuts (with a short fade) when crossing the water surface, reduced-motion support.
 */
(function (root) {
  'use strict';
  const T = root.THREE, PH = root.FishingPhysics, SIM = root.FishingSimulation;
  const MODES = ['auto', 'wide', 'shoulder', 'bobber', 'underwater'];
  const LABELS = { auto: 'كاميرا: سينمائية تلقائية', wide: 'كاميرا: لقطة واسعة', shoulder: 'كاميرا: خلف الكتف', bobber: 'كاميرا: العوّامة', underwater: 'كاميرا: تحت الماء' };
  const v = a => new T.Vector3(a[0], a[1], a[2]);

  class Director {
    constructor(camera, onCut) { this.cam = camera; this.mode = 'auto'; this.pos = new T.Vector3(6, 3, 8); this.look = new T.Vector3(0, 1, -4); this.fov = 50; this.shot = 'orbit'; this.shotT = 0; this.onCut = onCut || (() => {}); this.reduced = false; this.t = 0; this.first = true; }
    cycle() { this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]; return this.mode; }
    label() { return LABELS[this.mode]; }
    choose(sim) {
      if (this.mode !== 'auto') return { wide: 'wide', shoulder: 'shoulder', bobber: 'bobber', underwater: 'underwater' }[this.mode];
      const p = sim.phase, pt = sim.pt;
      switch (p) {
        case 'idle': return 'orbit';
        case 'prepare': case 'ready': case 'windup': case 'stroke': case 'retrieve': case 'rebait': return 'shoulder';
        case 'flight': return 'cast';
        case 'settle': return pt < 0.5 ? 'cast' : 'bobber';
        case 'approach': case 'inspect': return 'underwater';
        case 'nibble': return pt < 0.8 ? 'underwater' : 'bobber';
        case 'bite': case 'question': return 'bobber';
        case 'hookset': return 'shoulder';
        case 'fight': return (Math.floor(pt / 3.2) % 2) ? 'fightUnder' : 'fightWide';
        case 'surface': case 'net': case 'onboard': return 'landing';
        case 'celebrate': return 'celebrate';
        case 'strike': case 'shake': return 'underwater';
        case 'escape': return pt < 1.6 ? 'underwater' : 'wide';
        case 'review': return 'wide';
        case 'done': return sim.result === 'correct' ? 'celebrate' : 'wide';
      }
      return 'wide';
    }
    target(shot, sim) {
      const b = sim.boat, c2b = SIM.charToBoat, t = sim.t, yaw = sim.pose.yaw || 0, fl = v(sim.rope.floatPos), hook = v(sim.rope.hookPos);
      const wh = (x, z) => PH.Sea.height(x, z, t);
      let pos, look, fov = 48;
      const fwd = new T.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
      switch (shot) {
        case 'orbit': { const a = 0.9 + this.t * 0.05; pos = new T.Vector3(Math.sin(a) * 7.5, 2.7, Math.cos(a) * 7.5 - 1); look = new T.Vector3(0, 1.0, -0.6); fov = 42; break; }
        case 'wide': pos = v(b.toWorld([3.6, 2.7, 5.6])); look = v(b.toWorld([-0.8, 0.8, -4.5])); fov = 46; break;
        case 'shoulder': { const ch = SIM.rotY([-0.78, 2.35, -2.05], -yaw * 0.6); pos = v(b.toWorld(c2b(ch))); const aim = sim.aim.target ? v(sim.aim.target) : v(b.toWorld([0, 0, -9])); look = aim.clone().add(new T.Vector3(0, 0.6, 0)).lerp(v(sim.rod.tip), 0.25); fov = 52; break; }
        case 'cast': { const ch = SIM.rotY([-0.65, 2.3, -1.9], -yaw * 0.6); pos = v(b.toWorld(c2b(ch))); const land = sim.cast ? v(sim.cast.to) : fl; look = fl.clone().lerp(land, 0.55); look.y = Math.min(look.y, 1.2); fov = 52; break; }
        case 'bobber': { const toBoat = v(b.pos).sub(fl).setY(0).normalize(), side = new T.Vector3(-toBoat.z, 0, toBoat.x); pos = fl.clone().add(toBoat.clone().multiplyScalar(1.25)).add(side.multiplyScalar(0.55)); pos.y = Math.max(wh(pos.x, pos.z) + 0.42, 0.45); look = fl.clone().add(new T.Vector3(0, -0.02, 0)); fov = 36; break; }
        case 'underwater': { const f = sim.target && !sim.target.landed ? v(sim.target.pos) : hook.clone().add(fwd.clone().multiplyScalar(1)); const mid = hook.clone().lerp(f, 0.45); const toBoat = v(b.pos).sub(mid).setY(0).normalize(), side = new T.Vector3(-toBoat.z, 0, toBoat.x); pos = mid.clone().add(side.multiplyScalar(1.45)).add(toBoat.multiplyScalar(0.55)); pos.y = Math.min(mid.y + 0.12, -1.0); look = mid; fov = 46; break; }
        case 'fightWide': { const f = sim.hooked ? v(sim.hooked.pos) : fl; pos = v(b.toWorld(c2b(SIM.rotY([-2.5, 2.0, 0.9], -yaw * 0.5)))); look = v(b.toWorld(c2b([0, 1.3, 0.3]))).lerp(f, 0.45); fov = 50; break; }
        case 'fightUnder': { const f = sim.hooked ? v(sim.hooked.pos) : hook; const toBoat = v(b.pos).sub(f).setY(0).normalize(), side = new T.Vector3(-toBoat.z, 0, toBoat.x); pos = f.clone().add(side.multiplyScalar(1.6)).add(toBoat.multiplyScalar(-0.3)); pos.y = Math.min(f.y + 0.1, -0.9); look = f; fov = 50; break; }
        case 'landing': { const n = sim.net.active ? v(sim.net.hoop) : (sim.hooked ? v(sim.hooked.pos) : fl); pos = v(b.toWorld(c2b(SIM.rotY([-1.3, 1.65, 2.7], -yaw * 0.5)))); look = n.clone().lerp(v(b.toWorld(c2b([0, 1.2, 0.4]))), 0.35); fov = 46; break; }
        case 'celebrate': pos = v(b.toWorld(c2b(SIM.rotY([-0.95, 1.45, 3.1], -yaw * 0.4)))); look = v(b.toWorld(c2b([0.0, sim.phase === 'done' ? 1.72 : 1.45, 0.0]))); fov = 42; break;
      }
      // keep above-water shots above the waves and underwater shots below
      const h = wh(pos.x, pos.z), under = pos.y < h;
      if (under) pos.y = Math.min(pos.y, h - 0.45); else pos.y = Math.max(pos.y, h + 0.35);
      return { pos, look, fov, under };
    }
    update(sim, dt) {
      this.t += dt; const shot = this.choose(sim); if (shot !== this.shot) { this.shot = shot; this.shotT = 0; } this.shotT += dt;
      const tg = this.target(shot, sim), camUnder = this.pos.y < PH.Sea.height(this.pos.x, this.pos.z, sim.t);
      const cut = this.first || tg.under !== camUnder || this.pos.distanceTo(tg.pos) > 25;
      if (cut) { const water = !this.first && tg.under !== camUnder; this.pos.copy(tg.pos); this.look.copy(tg.look); this.fov = tg.fov; if (water) this.onCut(); this.first = false; }
      else { const tau = this.reduced ? 0.95 : 0.42, k = 1 - Math.exp(-dt / tau), kl = 1 - Math.exp(-dt / (tau * 0.6)); this.pos.lerp(tg.pos, k); this.look.lerp(tg.look, kl); this.fov += (tg.fov - this.fov) * k; }
      const c = this.cam; c.position.copy(this.pos);
      if (!this.reduced) c.position.add(new T.Vector3(Math.sin(this.t * 0.9) * 0.012, Math.sin(this.t * 1.3) * 0.01, 0));
      const h = PH.Sea.height(c.position.x, c.position.z, sim.t); if (Math.abs(c.position.y - h) < 0.3) c.position.y = c.position.y < h ? h - 0.3 : h + 0.3;
      c.lookAt(this.look); if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
      return c.position.y < h;
    }
  }
  root.FishingCamera = { Director, MODES, LABELS };
})(window);
