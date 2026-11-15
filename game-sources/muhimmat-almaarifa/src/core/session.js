// منطق الجلسة: الصحة، النقاط، المحاولات والنتيجة. وحدة خالصة بلا رسوم حتى تُختبر مستقلة.
// كل طرق الاختيار (فأرة، لمس، لوحة مفاتيح) تمر عبر submitAnswer وحدها.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createSession(bank, rules, seed = Date.now()) {
  const rnd = mulberry32(seed);
  let qs = bank.questions.slice();
  if (rules.shuffleQuestions) qs = shuffled(qs, rnd);
  if (rules.questionLimit > 0) qs = qs.slice(0, rules.questionLimit);
  const missions = qs.map(q => ({
    id: q.id,
    question: q,
    // ترتيب العرض مصفوفة معرّفات؛ الإجابة الصحيحة مرتبطة بالمعرّف لا بالموضع
    order: rules.shuffleOptions ? shuffled(q.options.map(o => o.id), rnd) : q.options.map(o => o.id),
    wrong: [],
    solved: false,
    solvedAttempt: 0,
    points: 0
  }));
  return {
    missions,
    index: 0,
    health: rules.startHealth,
    maxHealth: rules.startHealth,
    score: 0,
    status: missions.length ? 'active' : 'done',   // active | failed | done
    retries: 0,
    rules: { ...rules, points: rules.points.slice() }
  };
}

export const currentMission = s => s.missions[s.index] || null;

/**
 * يقيّم إصابة هدف. يعيد:
 *  { type:'correct', attempt, points, isLast }  أو  { type:'wrong', health, failed }  أو  { type:'ignored', reason }
 */
export function submitAnswer(s, optionId) {
  if (s.status !== 'active') return { type: 'ignored', reason: 'inactive' };
  const m = currentMission(s);
  if (!m) return { type: 'ignored', reason: 'no-mission' };
  if (m.solved) return { type: 'ignored', reason: 'solved' };
  if (!m.order.includes(optionId)) return { type: 'ignored', reason: 'unknown-option' };
  if (m.wrong.includes(optionId)) return { type: 'ignored', reason: 'disabled-option' };

  if (optionId === m.question.correctOptionId) {
    const attempt = m.wrong.length + 1;
    const table = s.rules.points;
    const points = Math.max(0, Number(table[Math.min(attempt, table.length) - 1]) || 0);
    m.solved = true;
    m.solvedAttempt = attempt;
    m.points = points;
    s.score += points;
    return { type: 'correct', attempt, points, isLast: s.index === s.missions.length - 1 };
  }
  m.wrong.push(optionId);
  s.health = Math.max(0, s.health - s.rules.wrongPenalty);
  if (s.health === 0) s.status = 'failed';
  return { type: 'wrong', health: s.health, failed: s.status === 'failed' };
}

/** ينتقل إلى المهمة التالية بعد حل الحالية فقط. */
export function advance(s) {
  const m = currentMission(s);
  if (!m || !m.solved || s.status !== 'active') return false;
  s.index += 1;
  if (s.index >= s.missions.length) s.status = 'done';
  return true;
}

/** استكمال من المهمة الحالية بصحة كاملة. سجل المحاولات يبقى، فلا تُكرَّر النقاط ولا يُخصم من خيار معطَّل. */
export function retryCurrent(s) {
  if (s.status !== 'failed') return false;
  s.health = s.maxHealth;
  s.status = 'active';
  s.retries += 1;
  return true;
}

export function summarize(s) {
  const total = s.missions.length;
  const completed = s.missions.filter(m => m.solved).length;
  const firstTry = s.missions.filter(m => m.solved && m.solvedAttempt === 1).length;
  const mistakes = s.missions.reduce((n, m) => n + m.wrong.length, 0);
  const maxScore = total * (Number(s.rules.points[0]) || 0);
  return {
    total, completed, firstTry, mistakes,
    firstTryPercent: total ? Math.round((firstTry / total) * 100) : 0,
    score: s.score, maxScore,
    retries: s.retries,
    health: s.health,
    missions: s.missions.map(m => ({
      id: m.id, text: m.question.text, solved: m.solved, attempts: m.wrong.length + (m.solved ? 1 : 0),
      wrong: m.wrong.length, points: m.points,
      correctText: (m.question.options.find(o => o.id === m.question.correctOptionId) || {}).text || ''
    }))
  };
}
