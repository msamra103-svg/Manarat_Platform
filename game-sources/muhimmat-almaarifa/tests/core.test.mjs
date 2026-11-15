// اختبارات منطق الجلسة وبنك الأسئلة:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSession, submitAnswer, advance, retryCurrent, summarize, currentMission } from '../src/core/session.js';
import { validateBank, parseBankText, serializeBank } from '../src/core/bank.js';
import { DEFAULT_RULES } from '../src/core/config.js';

const demo = JSON.parse(readFileSync(new URL('../src/data/demo-bank.json', import.meta.url), 'utf8'));
const bank = validateBank(demo).bank;
const wrongOf = m => m.order.filter(id => id !== m.question.correctOptionId && !m.wrong.includes(id));

test('البنك التجريبي صالح وعدد المهمات يساوي عدد الأسئلة', () => {
  const v = validateBank(demo);
  assert.equal(v.ok, true, v.errors.join('\n'));
  const s = createSession(bank, DEFAULT_RULES, 1);
  assert.equal(s.missions.length, demo.questions.length);
  assert.equal(new Set(s.missions.map(m => m.id)).size, demo.questions.length);
});

test('الإجابة الصحيحة من المحاولة الأولى تمنح ١٠٠ مرة واحدة فقط', () => {
  const s = createSession(bank, DEFAULT_RULES, 2);
  const m = currentMission(s);
  const r = submitAnswer(s, m.question.correctOptionId);
  assert.deepEqual([r.type, r.points, r.attempt], ['correct', 100, 1]);
  for (let i = 0; i < 5; i++) assert.equal(submitAnswer(s, m.question.correctOptionId).type, 'ignored');
  assert.equal(s.score, 100);
  assert.equal(advance(s), true);
  assert.equal(advance(s), false, 'لا تقدّم دون حل المهمة الجديدة');
  assert.equal(s.index, 1);
});

test('الخطأ يخصم ٢٠ مرة واحدة ويعطّل الخيار ولا ينقل للسؤال التالي', () => {
  const s = createSession(bank, DEFAULT_RULES, 3);
  const m = currentMission(s);
  const w = wrongOf(m)[0];
  assert.equal(submitAnswer(s, w).type, 'wrong');
  assert.equal(s.health, 80);
  for (let i = 0; i < 6; i++) assert.equal(submitAnswer(s, w).reason, 'disabled-option');
  assert.equal(s.health, 80);
  assert.equal(s.index, 0);
  assert.equal(advance(s), false);
});

test('جدول النقاط حسب رقم المحاولة: ١٠٠ / ٧٠ / ٤٠ / ١٠', () => {
  const four = { ...bank, questions: bank.questions.filter(q => q.options.length === 4) };
  [100, 70, 40, 10].forEach((expected, k) => {
    const s = createSession(four, DEFAULT_RULES, 10 + k);
    const m = currentMission(s);
    wrongOf(m).slice(0, k).forEach(id => submitAnswer(s, id));
    assert.equal(submitAnswer(s, m.question.correctOptionId).points, expected);
  });
});

test('الصحة لا تنزل تحت الصفر، وعند النفاد تتوقف الإجابات ثم يعمل الاستكمال', () => {
  const s = createSession(bank, { ...DEFAULT_RULES, wrongPenalty: 45 }, 4);
  let guard = 0;
  while (s.status === 'active' && guard++ < 50) {
    const m = currentMission(s);
    const w = wrongOf(m)[0];
    if (w) submitAnswer(s, w); else { submitAnswer(s, m.question.correctOptionId); advance(s); }
  }
  assert.equal(s.status, 'failed');
  assert.equal(s.health, 0);
  const m = currentMission(s);
  assert.equal(submitAnswer(s, m.question.correctOptionId).type, 'ignored');
  const scoreBefore = s.score, idx = s.index, wrongBefore = m.wrong.length;
  assert.equal(retryCurrent(s), true);
  assert.equal(s.health, s.maxHealth);
  assert.equal(s.index, idx, 'الاستكمال من المهمة الحالية');
  assert.equal(s.score, scoreBefore, 'لا نقاط مكررة');
  assert.equal(m.wrong.length, wrongBefore, 'سجل المحاولات محفوظ');
  assert.equal(retryCurrent(s), false);
});

test('خلط الخيارات لا يغيّر الإجابة الصحيحة', () => {
  for (let seed = 1; seed < 40; seed++) {
    const s = createSession(bank, DEFAULT_RULES, seed);
    for (const m of s.missions) {
      assert.deepEqual(m.order.slice().sort(), m.question.options.map(o => o.id).sort());
      const original = demo.questions.find(q => q.id === m.id);
      assert.equal(m.question.correctOptionId, original.correctOptionId);
    }
  }
});

test('النتيجة النهائية تُحسب من المحاولات الحقيقية لا من الوصول للنهاية', () => {
  const s = createSession(bank, DEFAULT_RULES, 5);
  s.missions.forEach((m, i) => {
    if (i % 2 === 0) {
      submitAnswer(s, wrongOf(m)[0]);
      if (s.status === 'failed') retryCurrent(s);   // الخطأ الخامس يُنفد الصحة ثم نستكمل
    }
    submitAnswer(s, m.question.correctOptionId);
    advance(s);
  });
  const r = summarize(s);
  assert.equal(s.status, 'done');
  assert.equal(r.completed, r.total);
  assert.equal(r.firstTry, 5);
  assert.equal(r.firstTryPercent, 50);
  assert.equal(r.mistakes, 5);
  assert.equal(r.score, 5 * 100 + 5 * 70);
  assert.equal(r.retries, 1);
});

test('التحقق يرفض البيانات المعيبة برسائل عربية ويقبل التصدير ثم الاستيراد', () => {
  const bad = { questions: [
    { id: 'x', text: '', options: [{ id: 'a', text: 'واحد' }], correctOptionId: 'z' },
    { id: 'x', text: 'سؤال', options: [{ id: 'a', text: 'أحمد' }, { id: 'a', text: 'احمد' }, { id: 'c', text: '' }], correctOptionId: 'a' }
  ] };
  const v = validateBank(bad);
  assert.equal(v.ok, false);
  assert.equal(v.bank, null);
  const all = v.errors.join(' | ');
  for (const part of ['نص السؤال فارغ', 'عدد الخيارات', 'مكرر', 'نص الخيار فارغ', 'لا يطابق']) assert.ok(all.includes(part), part);
  assert.equal(parseBankText('{ not json').ok, false);
  assert.equal(parseBankText('{"questions": []}').ok, false);
  const round = parseBankText(serializeBank(bank));
  assert.equal(round.ok, true);
  assert.deepEqual(round.bank.questions, bank.questions);
});
