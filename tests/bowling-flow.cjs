/* Educational flow + platform message contract tests (real game.js, scripted scene, Node VM).
 * Run with `node tests/bowling-flow.cjs` */
'use strict';
const assert = require('node:assert/strict');
const { load } = require('./lib/game-harness.cjs');
let passed = 0;
const ok = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };
const PRE = 'school-bowling-';
const TOKEN = '3f9c2b1e-1111-4a2b-9c3d-abcdefabcdef';
const types = h => h.posted.map(p => p.m.type);

async function embedded(count = 3, title = 'لعبة النباتات المائية') {
  const h = load({ embedded: true });
  await h.flush();
  h.send({ type: PRE + 'config', title, count, images: [], token: TOKEN });
  await h.flush();
  return h;
}
async function throwToQuestion(h) {
  h.el('start').click(); h.el('throw').click();
  h.ctl.scene._release(); h.ctl.scene._half();
}
const result = (h, extra) => h.send(Object.assign({ type: PRE + 'result', token: TOKEN, index: h.G().round, correct: true, pending: false, feedback: 'ok' }, extra));

(async () => {
  await ok('every script loaded by games/bowling/index.html exists and parses', async () => {
    const fs = require('fs'), path = require('path'), vm = require('vm'), dir = path.join(__dirname, '../games/bowling');
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), srcs = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]);
    assert.ok(srcs.includes('hall.js') && srcs.includes('audio.js') && srcs.length >= 14, srcs.join(','));
    for (const s of srcs) { const f = path.join(dir, s); assert.ok(fs.existsSync(f), 'missing ' + s); new vm.Script(fs.readFileSync(f, 'utf8'), { filename: s }); }
  });
  await ok('ready is posted first, with location.origin as target (never "*")', async () => {
    const h = load({ embedded: true }); await h.flush();
    assert.equal(h.posted[0].m.type, PRE + 'ready'); assert.ok(h.posted.every(p => p.target === h.origin));
  });

  await ok('config: invalid token / unsafe count rejected; initialised once; title preserved', async () => {
    const h = load({ embedded: true }); await h.flush();
    for (const bad of [{ token: '' }, { token: 'short' }, { token: 'x'.repeat(300) }, { token: '<script>x</script>' }, { count: 0 }, { count: 101 }, { count: 2.5 }, { count: 'NaN' }, { count: -1 }]) {
      h.send(Object.assign({ type: PRE + 'config', title: 'X', count: 3, token: TOKEN }, bad)); await h.flush();
      assert.equal(h.G().phase, 'loading', 'accepted bad config ' + JSON.stringify(bad));
    }
    h.send({ type: PRE + 'config', title: 'لعبة النباتات المائية', count: 3, images: [], token: TOKEN }); await h.flush();
    assert.equal(h.G().phase, 'welcome'); assert.equal(h.G().title, 'لعبة النباتات المائية'); assert.equal(h.G().total, 3);
    h.send({ type: PRE + 'config', title: 'عنوان مزوّر', count: 99, token: 'another-token-456' }); await h.flush();
    assert.equal(h.G().title, 'لعبة النباتات المائية'); assert.equal(h.G().total, 3);
    assert.equal(h.el('assignmentTitle').textContent, 'لعبة النباتات المائية');
  });

  await ok('question message carries the exact token and zero-based index; ball frozen until the result', async () => {
    const h = await embedded(); await throwToQuestion(h);
    const q = h.posted.at(-1).m; assert.deepEqual(q, { type: PRE + 'question', token: TOKEN, index: 0 });
    assert.equal(h.G().phase, 'question'); assert.ok(!h.ctl.scene.calls.includes('resume'));
  });

  await ok('forged messages are rejected: origin, sibling frame, token, stale index, other sport, wrong phase', async () => {
    const h = await embedded(); await h.flush();
    result(h); assert.equal(h.G().phase, 'welcome', 'result before the question is ignored');
    await throwToQuestion(h);
    const g = await embedded(); await throwToQuestion(g);
    g.send({ type: PRE + 'result', token: TOKEN, index: 0, correct: true }, { from: 'https://evil.example' });
    g.send({ type: PRE + 'result', token: TOKEN, index: 0, correct: true }, { source: { postMessage() { } } });
    g.send({ type: PRE + 'result', token: 'not-the-token-123', index: 0, correct: true });
    g.send({ type: PRE + 'result', token: TOKEN, index: 1, correct: true });
    g.send({ type: PRE + 'result', token: TOKEN, index: '0', correct: true });
    g.send({ type: 'school-football-result', token: TOKEN, index: 0, correct: true });
    g.send('school-bowling-result'); g.send(null);
    assert.equal(g.G().phase, 'question'); assert.ok(!g.ctl.scene.calls.includes('resume'));
  });

  await ok('correct answer: pins become local game points once; outcome posted with pins; no forced strike', async () => {
    const h = await embedded(); await throwToQuestion(h);
    result(h, { correct: true });
    result(h, { correct: true }); // duplicate
    assert.equal(h.ctl.scene.calls.filter(c => c === 'resume').length, 1);
    assert.equal(h.G().phase, 'resolve');
    h.ctl.scene._settle(7); await h.flush();
    assert.equal(h.G().points, 7); assert.equal(h.G().correct, 1);
    const o = h.posted.at(-1).m; assert.equal(o.type, PRE + 'outcome'); assert.equal(o.outcome, 'goal'); assert.equal(o.pins, 7); assert.equal(o.earned, 7); assert.equal(o.index, 0);
    assert.equal(h.ctl.scene.world.knocked, 7, 'the scene result is whatever the physics produced');
    result(h, { correct: true }); assert.equal(h.G().points, 7, 'no duplicate award after the outcome');
    assert.equal(h.el('outcomeTitle').textContent, 'لعبة النباتات المائية');
  });

  await ok('wrong answer earns zero game points even with a physical strike; feedback explains the difference', async () => {
    const h = await embedded(); await throwToQuestion(h);
    result(h, { correct: false, feedback: 'الإجابة الصحيحة: ب' });
    h.ctl.scene._settle(10); await h.flush();
    assert.equal(h.G().points, 0); assert.equal(h.posted.at(-1).m.outcome, 'miss'); assert.equal(h.posted.at(-1).m.earned, 0);
    assert.match(h.el('resultLabel').textContent, /غير صحيحة/); assert.match(h.el('pinBadge').textContent, /فيزيائي/, 'a strike after a wrong answer is described as physical only');
    assert.match(h.el('resultText').textContent, /لم تُضف نقاط/);
    assert.ok(h.ctl.scene.calls.includes('react:wrong'), 'no celebration of a wrong answer');
  });

  await ok('pending (manual review) is neutral: no points, no success/failure wording; pending wins over correct', async () => {
    const h = await embedded(); await throwToQuestion(h);
    result(h, { correct: true, pending: true });
    h.ctl.scene._settle(9); await h.flush();
    assert.equal(h.G().points, 0); assert.equal(h.G().pending, 1); assert.equal(h.posted.at(-1).m.outcome, 'pending');
    assert.equal(h.el('feedback').dataset.kind, 'pending');
    assert.doesNotMatch(h.el('resultLabel').textContent + h.el('resultText').textContent, /أحسنت|غير صحيحة|صحيحة/);
    assert.ok(h.ctl.scene.calls.includes('react:pending'));
  });

  await ok('next/advance: next carries token+index; only the OLD index advances; duplicates ignored', async () => {
    const h = await embedded(); await throwToQuestion(h); result(h); h.ctl.scene._settle(4); await h.flush();
    h.el('next').click(); h.el('next').click();
    const nexts = h.posted.filter(p => p.m.type === PRE + 'next'); assert.equal(nexts.length, 1); assert.deepEqual(nexts[0].m, { type: PRE + 'next', token: TOKEN, index: 0 });
    h.send({ type: PRE + 'advance', token: TOKEN, index: 1 }); assert.equal(h.G().round, 0, 'advance with a future index ignored');
    h.send({ type: PRE + 'advance', token: 'nope-nope-nope', index: 0 }); assert.equal(h.G().round, 0);
    h.send({ type: PRE + 'advance', token: TOKEN, index: 0 }); assert.equal(h.G().round, 1);
    h.send({ type: PRE + 'advance', token: TOKEN, index: 0 }); assert.equal(h.G().round, 1, 'stale advance ignored');
    assert.ok(h.ctl.scene.calls.includes('nextRack'));
    h.ctl.scene._ready(); assert.equal(h.G().phase, 'ready');
  });

  await ok('last round: host owns finishing; retry re-enables Next without awarding again; title kept', async () => {
    const h = await embedded(1); await throwToQuestion(h); result(h); h.ctl.scene._settle(6); await h.flush();
    assert.equal(h.G().points, 6);
    h.el('next').click(); assert.equal(h.el('next').disabled, true); assert.match(h.el('saveStatus').textContent, /حفظ/);
    h.send({ type: PRE + 'advance', token: TOKEN, index: 0 }); assert.equal(h.G().round, 0, 'no advance past the last question');
    h.send({ type: PRE + 'retry', token: TOKEN, index: 0 });
    assert.equal(h.el('next').disabled, false); assert.equal(h.G().points, 6); assert.match(h.el('saveStatus').textContent, /تعذر/);
    h.el('next').click(); assert.equal(h.posted.filter(p => p.m.type === PRE + 'next').length, 2);
    assert.equal(h.G().phase, 'outcome', 'never marks the assignment complete itself');
    assert.ok(!types(h).some(t => /finish|complete/.test(t)), 'no invented finish message');
    assert.equal(h.el('assignmentTitle').textContent, 'لعبة النباتات المائية');
  });

  await ok('fullscreen in embedded mode is requested from the host with token/index', async () => {
    const h = await embedded(); h.el('full').onclick();
    assert.deepEqual(h.posted.at(-1).m, { type: PRE + 'fullscreen', token: TOKEN, index: 0 });
  });

  await ok('titles/feedback are rendered as text, never HTML; optional metadata is handled', async () => {
    const h = load({ embedded: true }); await h.flush();
    h.send({ type: PRE + 'config', title: '<img src=x onerror=alert(1)>', count: 2, token: TOKEN, subject: 'العلوم', teacher: 42 }); await h.flush();
    assert.equal(h.el('assignmentTitle').textContent, '<img src=x onerror=alert(1)>');
    assert.equal(h.el('assignmentMeta').textContent, 'العلوم');
    const g = load({ embedded: true }); await g.flush(); g.send({ type: PRE + 'config', count: 2, token: TOKEN }); await g.flush();
    assert.equal(g.G().title, 'مهمة المعلم', 'missing title falls back gracefully');
  });

  await ok('standalone: demo questions, local summary with the title, no messages posted', async () => {
    const h = load({ embedded: false }); await h.flush();
    assert.equal(h.G().phase, 'welcome'); assert.equal(h.posted.length, 0);
    for (let r = 0; r < 3; r++) {
      if (r === 0) h.el('start').click();
      h.el('throw').click(); h.ctl.scene._release(); h.ctl.scene._half();
      assert.equal(h.G().phase, 'question'); assert.ok(h.el('choices').children.length === 4);
      h.el('choices').children[r === 1 ? 0 : [0, 1, 2][r]].click();   // round 2 answered wrong (correct is index 1)
      h.ctl.scene._settle(5); await h.flush();
      h.el('next').click();
      if (r < 2) { assert.equal(h.G().phase, 'resetting'); h.ctl.scene._ready(); }
    }
    assert.equal(h.G().phase, 'finished'); assert.equal(h.G().points, 10);
    assert.equal(h.el('summaryTitle').textContent, h.G().title); assert.match(h.G().title, /البولينج/);
    assert.equal(h.posted.length, 0);
    assert.deepEqual(Object.keys(h.storage).filter(k => !/audio|hand|reduced/.test(k)), [], 'demo attempts are never persisted');
  });

  await ok('standalone ManaratGameControls: restart and early end are safe in every phase', async () => {
    const drive = { welcome: h => { }, ready: h => h.el('start').click(), approach: h => { h.el('start').click(); h.el('throw').click(); }, rolling: h => { h.el('start').click(); h.el('throw').click(); h.ctl.scene._release(); }, question: h => { h.el('start').click(); h.el('throw').click(); h.ctl.scene._release(); h.ctl.scene._half(); }, resolve: h => { drive.question(h); h.el('choices').children[0].click(); }, outcome: async h => { drive.resolve(h); h.ctl.scene._settle(3); await h.flush(); } };
    for (const [ph, fn] of Object.entries(drive)) {
      for (const action of ['restart', 'end']) {
        const h = load({ embedded: false }); await h.flush(); await fn(h);
        assert.equal(h.G().phase, ph);
        const C = h.controls(); assert.equal(typeof C.restart, 'function'); assert.equal(C.isBusy(), false);
        await C[action]();
        if (action === 'restart') { assert.equal(h.G().phase, 'ready'); assert.equal(h.G().points, 0); assert.equal(h.G().round, 0); }
        else { assert.equal(h.G().phase, 'finished'); assert.match(h.el('summaryLead').textContent, /قبل إكمال/); assert.equal(C.isActive(), false); }
        assert.ok(h.ctl.scene.calls.includes('hardReset'));
        // a late result/settle after restart/end must not award points
        const before = h.G().points; h.ctl.scene._settle(10); await h.flush(); assert.equal(h.G().points, before);
      }
    }
  });

  await ok('blocked/unavailable Web Audio never breaks the game; preferences persist', async () => {
    const h = load({ embedded: false }); await h.flush();
    h.el('sound').onclick(); assert.equal(JSON.parse(h.storage['manarat-bowling-audio']).muted, true);
    h.el('volume').value = 30; h.el('volume').listeners.input[0]();
    const saved = JSON.parse(h.storage['manarat-bowling-audio']); assert.equal(saved.volume, 0.3); assert.equal(saved.muted, false);
    h.el('start').click(); h.el('throw').click(); assert.equal(h.G().phase, 'approach');
    const g = load({ embedded: false, storage: h.storage }); await g.flush();
    assert.equal(g.el('volume').value, 30);
  });

  console.log(`\n${passed} flow/contract tests passed`);
})().catch(e => { console.error(e); process.exit(1); });
