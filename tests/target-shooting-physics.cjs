/* Target Shooting 3D — deterministic physics, scoring, configuration and export (Node, no browser). */
const assert = require('node:assert/strict'), path = require('path');
const G = path.join(__dirname, '..', 'games', 'target-shooting');
const PH = require(path.join(G, 'physics/projectile.js'));
const C = require(path.join(G, 'core/config.js'));
const E = require(path.join(G, 'ui/export.js'));
const v3 = PH.v3;
function segDist(a, b, p) { const d = v3(b.x - a.x, b.y - a.y, b.z - a.z), w = v3(p.x - a.x, p.y - a.y, p.z - a.z), L = d.x * d.x + d.y * d.y + d.z * d.z; const t = L ? Math.max(0, Math.min(1, (w.x * d.x + w.y * d.y + w.z * d.z) / L)) : 0; return Math.hypot(w.x - d.x * t, w.y - d.y * t, w.z - d.z * t); }
let n = 0; const pass = m => { n++; console.log('PASS', m); };

// 1. launch solver + integrator: the integrated path passes through the aim point (reticle == impact)
{
  let worst = 0;
  for (const [x, y, z] of [[0, 1.2, -12], [3, 1.0, -22], [-5, 0.8, -45], [10, 9, -30], [-20, 14, -38], [0, 1.4, -70]]) {
    const o = v3(0.1, 1.5, 0.5), p = v3(x, y, z), s = PH.solveLaunch(o, p);
    assert(s, 'reachable ' + [x, y, z]);
    assert(Math.abs(Math.hypot(s.v.x, s.v.y, s.v.z) - PH.SPEED) < 1e-9);
    // integrate the nock point with the game's fixed sub-steps; distance of closest approach to p
    const f = new PH.Flight(o, s.v, 't'); let best = Infinity;
    for (let i = 0; i < 2400; i++) { const a = { ...f.p }; f.step(PH.STEP, []); best = Math.min(best, segDist(a, f.p, p)); }
    worst = Math.max(worst, best);
  }
  assert(worst < 0.005, 'closest approach ' + worst);
  pass('launch solver + 1/240 s integrator meet the aim point (worst ' + (worst * 1000).toFixed(2) + ' mm, tolerance 5 mm)');
  assert.equal(PH.solveLaunch(v3(0, 1.5, 0), v3(0, 1.5, -500), 30), null);
  pass('out-of-range shots are reported (no fake trajectory)');
}
// 2. frame-rate independence: same flight whatever the render frame rate (fixed sub-steps)
{
  const run = (fps) => { const f = new PH.Flight(v3(0, 1.5, 0), v3(0, 3, -60), 'f'); let acc = 0, t = 0; const dt = 1 / fps; while (t < 0.6) { acc += dt; t += dt; while (acc >= PH.STEP - 1e-12) { f.step(PH.STEP, []); acc -= PH.STEP; } } return f; };
  const a = run(30), b = run(60), c = run(144);
  const da = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y, a.p.z - b.p.z), dc = Math.hypot(c.p.x - b.p.x, c.p.y - b.p.y, c.p.z - b.p.z);
  assert(da < 0.27 && dc < 0.27, 'positions within one sub-step of travel');
  pass('fixed sub-step simulation: 30/60/144 fps agree to one sub-step (' + da.toFixed(3) + ' m, ' + dc.toFixed(3) + ' m)');
}
// 3. swept collision vs ground truth: random fast targets crossing the arrow path; the 1/240 s swept test must
//    agree with a 1/100 000 s brute-force reference (no tunnelling, no phantom hits)
{
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let agree = 0, hitsRef = 0, trials = 300;
  for (let k = 0; k < trials; k++) {
    const z = -(15 + rnd() * 30), aim = v3((rnd() - 0.5) * 2, 1.5 + rnd() * 2, z);
    const s = PH.solveLaunch(v3(0, 1.5, 0), aim);
    const speed = 4 + rnd() * 16, r = 0.08 + rnd() * 0.15;
    const tMeet = Math.abs(z) / (62 * Math.cos(s.angle));
    const start = v3(aim.x - speed * tMeet + (rnd() - 0.5) * 1.2, aim.y + (rnd() - 0.5) * 0.5, aim.z + 0.74 * 0);
    // reference: fine sampling of tip vs centre
    const tipAt = t => { const pp = PH.at(v3(0, 1.5, 0), s.v, t), vy = s.v.y - 9.81 * t, L = Math.hypot(s.v.x, vy, s.v.z); return v3(pp.x + s.v.x / L * 0.74, pp.y + vy / L * 0.74, pp.z + s.v.z / L * 0.74); };
    let ref = false; for (let t = 0; t < 1.6 && !ref; t += 1e-5) { const tp = tipAt(t); if (Math.hypot(tp.x - (start.x + speed * t), tp.y - start.y, tp.z - start.z) <= r) ref = true; }
    // swept
    const f = new PH.Flight(v3(0, 1.5, 0), s.v, 'a'); let hit = null; const pos = { ...start };
    for (let i = 0; i < 400 && !hit; i++) { const c0 = { ...pos }; pos.x += speed * PH.STEP; hit = f.step(PH.STEP, [{ kind: 'sphere', c0, c1: { ...pos }, r }]); }
    if (!!hit === ref) agree++; if (ref) hitsRef++;
  }
  assert.equal(agree, trials, 'swept vs reference ' + agree + '/' + trials);
  assert(hitsRef > 30, 'the scenario set contains real hits');
  pass('swept sphere test agrees with a 10 µs brute-force reference in ' + agree + '/' + trials + ' crossings (' + hitsRef + ' hits, no tunnelling, no phantom hits)');
  // pass-through is impossible after contact: the tip is placed exactly on the surface
  const f = new PH.Flight(v3(0, 1, 0), v3(0, 0, -62), 'b');
  let hit = null; for (let i = 0; i < 200 && !hit; i++) hit = f.step(PH.STEP, [{ kind: 'disc', c0: v3(0, 1, -10), c1: v3(0, 1, -10), n: v3(0, 0, 1), r: 0.61 }]);
  assert(hit && Math.abs(hit.point.z + 10) < 1e-9 && Math.abs(f.tip.z + 10) < 1e-9, 'tip on the face plane');
  assert.equal(PH.sweepDisc(v3(0, 1, -10.5), v3(0, 1, -11), v3(0, 1, -10), v3(0, 1, -10), v3(0, 0, 1), 0.61), -1, 'no back-face hits');
  pass('disc contact puts the tip on the face (no pass-through), back faces never score');
}
// 4. World Archery ring values
{
  const R = 0.61;
  assert.equal(PH.ringScore(0, R), 10); assert.equal(PH.ringScore(0.0609, R), 10); assert.equal(PH.ringScore(0.0611, R), 9);
  assert.equal(PH.ringScore(0.3, R), 6); assert.equal(PH.ringScore(0.6099, R), 1); assert.equal(PH.ringScore(0.62, R), 0);
  pass('ring scoring: 10 rings of r/10, 0 outside the face');
}
// 5. configuration gate
{
  const c = C.sanitize({ school: '<b>مدرسة</b>', mode: 'hack', difficulty: 'advanced', arrowsPerQuestion: 99, size: 9, accent: 'red', questions: [{ type: 'multiple_choice', text: 'س', options: ['أ', '', 'ب', 'ج'], correct: 2 }, { type: 'multiple_choice', text: 'ناقص', options: ['أ'] }, { text: '' }, { type: 'true_false', text: 'صح؟', correct: 1 }, { type: 'open_text', text: 'اكتب', answers: ['ماء'] }] });
  assert.equal(c.mode, 'choice'); assert.equal(c.difficulty, 'advanced'); assert.equal(c.arrowsPerQuestion, 10); assert.equal(c.size, 1.8); assert.equal(c.accent, '#8A1538');
  assert.equal(c.questions.length, 3); assert.deepEqual(c.questions[0].options, ['أ', 'ب', 'ج']); assert.equal(c.questions[0].correct, 1, 'correct answer survives empty-slot removal');
  assert.equal(c.questions[1].correct, 1); assert.deepEqual(c.questions[2].answers, ['ماء']);
  assert.equal(C.sanitize({}).school, 'مدرسة أبو عبيدة الإعدادية للبنين');
  const p = C.fromPlatform({ mode: 'birds', difficulty: 'beginner', arrowsPerQuestion: 4, aimAssist: 'high', questions: [{ text: 'should be ignored' }] });
  assert.equal(p.mode, 'birds'); assert.equal(p.arrowsPerQuestion, 4); assert.equal(p.questions, null);
  pass('teacher/platform configuration is sanitised (ranges, enums, questions, platform never injects questions)');
}
// 6. offline export escaping
{
  const html = E.assemble({ css: 'body{}', markup: '<main></main>', scripts: ['var s="</script><img>";'], bundle: { 'fonts/x.woff2': 'AAA', 'models/m.glb': 'QQ==' }, preset: { role: 'student', config: { lesson: '</script><script>alert(1)</script>' } } });
  assert(!/<\/script><img>/.test(html)); assert(!html.includes('</script><script>alert(1)'));
  assert(html.includes('window.TS_BUNDLE={"models/m.glb":"QQ=="}'));
  assert(!/https?:\/\//.test(html.replace(/<meta[^>]*>/g, '')), 'no remote URL in the shell');
  pass('offline export: inline scripts and preset JSON cannot break out of <script>; no remote URLs');
}
console.log('TARGET SHOOTING PHYSICS/CONFIG ALL PASS (' + n + ')');
