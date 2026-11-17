// اختبارات منطق سباق الحواجز (Node بدون متصفح): node tests/raceModel.test.mjs
import { createRaceModel, STEP, JUMP, REFUSAL } from '../src/race/raceModel.js';

let failures = 0, passes = 0;
const check = (cond, msg) => { if (cond) passes++; else { failures++; console.log('FAIL:', msg); } };

// wrongs[k] = عدد المحاولات الخاطئة على الحاجز k قبل الإجابة الصحيحة
function run(opts, wrongs) {
  const m = createRaceModel(opts);
  const N = m.config.questionCount;
  const info = { frozenMoved: false, clearedWithoutCorrect: false, cpTimes: [], firstCross: null, lastAnswerTime: null, checkpoints: 0, playerRefusals: 0, takeoffs: {}, lands: {}, aiRefusals: 0 };
  const cleared = new Array(N).fill(false);
  m.start();
  let guard = 0;
  while (m.state.phase !== 'finished' && guard++ < 600000) {
    const ev = m.step(STEP);
    // اللاعب لا يتجاوز نقطة ارتقاء حاجز لم يُجب عنه صحيحًا بعد
    for (let k = 0; k < N; k++) if (!cleared[k] && m.player.d > m.fences[k] - JUMP.takeoff + 1e-6) info.clearedWithoutCorrect = true;
    for (const e of ev) {
      if (e.type === 'checkpoint') {
        info.checkpoints++;
        if (e.attempt === 1) info.cpTimes.push(m.state.time);
        const snap = m.racers.map((r) => r.d);
        m.step(5); m.step(30); // التجميد: لا حركة أثناء السؤال مهما مر من وقت
        if (m.racers.some((r, i) => r.d !== snap[i])) info.frozenMoved = true;
        const correct = e.attempt > (wrongs[e.index] ?? 0);
        check(m.recordAnswer(e.index, correct) === true, 'recordAnswer accepted');
        check(m.recordAnswer(e.index, !correct) === false, 'duplicate recordAnswer rejected');
        const out = m.resume();
        check(out === (correct ? 'jump' : 'refusal'), 'resume outcome matches answer');
        if (correct) { cleared[e.index] = true; if (e.index === N - 1) info.lastAnswerTime = m.state.time; } else info.playerRefusals++;
      }
      if (e.type === 'takeoff') info.takeoffs[e.id] = (info.takeoffs[e.id] || 0) + 1;
      if (e.type === 'land') info.lands[e.id] = (info.lands[e.id] || 0) + 1;
      if (e.type === 'refusal') info.aiRefusals++;
      if (e.type === 'cross' && info.firstCross === null) info.firstCross = e.time;
    }
  }
  return { m, info, st: m.standings(), rank: m.standings().find((s) => s.isPlayer).rank };
}

const N6 = [0, 0, 0, 0, 0, 0];
for (const difficulty of ['easy', 'normal', 'hard']) {
  for (let seed = 1; seed <= 12; seed++) {
    const o = { difficulty, seed };
    // 1) كل الإجابات صحيحة من أول محاولة ⇒ المركز الأول
    const a = run(o, N6);
    check(a.rank === 1, `${difficulty}/${seed}: all first-try correct should win (got ${a.rank})`);
    check(!a.info.frozenMoved, `${difficulty}/${seed}: racers moved while frozen`);
    check(!a.info.clearedWithoutCorrect, `${difficulty}/${seed}: fence cleared without correct answer`);
    check(a.info.checkpoints === 6 && a.info.playerRefusals === 0, `${difficulty}/${seed}: 6 checkpoints, no refusals`);
    // زمن الجري بين الحواجز ≈ مدة المقطع
    for (let k = 1; k < a.info.cpTimes.length; k++) {
      const dt = a.info.cpTimes[k] - a.info.cpTimes[k - 1];
      check(dt > 4.5 && dt < 6.6, `${difficulty}/${seed}: segment ${k} took ${dt.toFixed(2)}s`);
    }
    check(Math.abs(a.info.cpTimes[0] - 6) < 0.6, `${difficulty}/${seed}: first fence reached in ~6s (${a.info.cpTimes[0].toFixed(2)})`);
    // 2) لا أحد يعبر خط النهاية قبل تطبيق آخر إجابة صحيحة
    check(a.info.firstCross > a.info.lastAnswerTime, `${difficulty}/${seed}: nobody finishes before last answer`);
    // 3) ترتيب النتائج = ترتيب العبور
    check(JSON.stringify(a.st.map((s) => s.id)) === JSON.stringify(a.m.state.finishOrder), `${difficulty}/${seed}: results order equals crossing order`);
    // 4) كل متسابق يقفز كل الحواجز مرة واحدة
    for (const r of a.m.racers) check(a.info.takeoffs[r.id] === 6 && a.info.lands[r.id] === 6, `${difficulty}/${seed}: ${r.id} jumped all 6 fences`);
    // 5) الرفض: كل محاولة خاطئة = رفض واحد وسؤال معاد، والحاجز لا يُتخطى قبل الصحيحة
    const b = run(o, [1, 0, 2, 0, 0, 3]);
    check(b.info.playerRefusals === 6 && b.info.checkpoints === 12, `${difficulty}/${seed}: refusals/checkpoints (${b.info.playerRefusals}/${b.info.checkpoints})`);
    check(!b.info.clearedWithoutCorrect, `${difficulty}/${seed}: fence cleared without correct answer (mixed)`);
    check(b.info.firstCross > b.info.lastAnswerTime, `${difficulty}/${seed}: nobody finishes before last answer (mixed)`);
    check(b.info.takeoffs.player === 6, `${difficulty}/${seed}: player eventually jumps all fences`);
    // 6) تدرّج عادل: المركز لا يتحسن بزيادة الأخطاء
    const ranks = [0, 1, 2, 3].map((w) => run(o, [w, w, w, w, w, w]).rank);
    for (let i = 1; i < ranks.length; i++) check(ranks[i] >= ranks[i - 1], `${difficulty}/${seed}: rank monotonic in wrong attempts (${ranks})`);
    check(ranks[3] === 6, `${difficulty}/${seed}: 3 wrong on every fence ⇒ last (${ranks[3]})`);
    // 7) ليس فوزًا تلقائيًا: خطأ في كل حاجز لا يفوز
    check(run(o, [1, 1, 1, 1, 1, 1]).rank > 1, `${difficulty}/${seed}: one wrong per fence must not win`);
    // 8) الحتمية: نفس البذرة ⇒ نفس النتيجة
    const c1 = run(o, [1, 0, 1, 0, 1, 0]), c2 = run(o, [1, 0, 1, 0, 1, 0]);
    check(JSON.stringify(c1.m.state.finishOrder) === JSON.stringify(c2.m.state.finishOrder) && c1.m.state.time === c2.m.state.time, `${difficulty}/${seed}: deterministic`);
  }
}

// استقلال النتيجة عن معدل الإطارات
{
  const sim = (dt) => {
    const m = createRaceModel({ seed: 5 });
    m.start();
    let g = 0;
    while (m.state.phase !== 'finished' && g++ < 400000) {
      for (const e of m.step(dt)) if (e.type === 'checkpoint') { m.recordAnswer(e.index, e.attempt > (e.index % 2)); m.resume(); }
    }
    return { order: m.state.finishOrder.join(','), t: m.racers.map((r) => r.finishTime.toFixed(4)).join(',') };
  };
  const a = sim(1 / 144), b = sim(1 / 30), c = sim(0.1);
  check(a.order === b.order && b.order === c.order && a.t === b.t && b.t === c.t, 'frame-rate independence');
}

// إعدادات: عدد الأسئلة ومدة المقطع
for (const q of [1, 3, 4, 8]) for (const seg of [4, 6, 8]) {
  const r = run({ questionCount: q, segmentSeconds: seg, seed: 3 }, new Array(q).fill(0));
  check(r.rank === 1, `q=${q} seg=${seg}: all-correct wins`);
  check(r.m.fences.length === q, `q=${q}: fence count`);
  const expected = seg * q + r.m.config.sprintSeconds;
  const playerT = r.m.player.finishTime;
  check(Math.abs(playerT - expected) < expected * 0.2 + 2, `q=${q} seg=${seg}: player race time ${playerT.toFixed(1)} ≈ ${expected}`);
}

// هندسة الرفض: يتوقف قبل نقطة الارتقاء ويعود للخلف ثم يقترب
{
  const m = createRaceModel({ seed: 2 });
  m.start();
  let g = 0, maxD = 0, minDAfter = Infinity, started = false, sawBack = false;
  while (g++ < 100000) {
    const ev = m.step(STEP);
    if (started) { maxD = Math.max(maxD, m.player.d); if (m.player.heading > 3) sawBack = true; minDAfter = Math.min(minDAfter, m.player.d); }
    const cp = ev.find((e) => e.type === 'checkpoint');
    if (cp && !started) { m.recordAnswer(0, false); m.resume(); started = true; continue; }
    if (cp && started) break;
  }
  check(maxD < m.fences[0] - JUMP.takeoff, `refusal stops before take-off point (${maxD.toFixed(2)} < ${(m.fences[0] - JUMP.takeoff).toFixed(2)})`);
  check(sawBack && minDAfter < maxD - REFUSAL.backDist * 0.5, 'refusing horse turns and goes back');
  check(m.state.attempt === 2 && m.state.phase === 'checkpoint', 'question re-asked after refusal');
}

console.log(`raceModel tests: ${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
