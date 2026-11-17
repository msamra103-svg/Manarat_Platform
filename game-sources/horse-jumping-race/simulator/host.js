/* محاكي منصة مضيفة يطبق العقد المقترح qcr-bridge/1 — للاختبار فقط.
 * اللعبة موضوعة في مجلد فرعي: games/horse-jumping-race/ وتُفتح داخل iframe.
 * الأسئلة تُرسل للعبة بدون مفتاح الإجابة؛ التصحيح يتم هنا. */
(function () {
  const PROTOCOL = 'qcr-bridge/1';
  // معاملات اختيارية لأغراض الاختبار تُمرر إلى اللعبة: debug و quality=low
  const qs = new URLSearchParams(location.search);
  const GAME_PATH = 'games/horse-jumping-race/index.html?bridge=postMessage' + (qs.has('debug') ? '&debug' : '') + (qs.get('quality') ? '&quality=' + encodeURIComponent(qs.get('quality')) : '');
  const $ = (id) => document.getElementById(id);
  const frame = $('game');
  const logEl = $('log');

  // بنك أسئلة المنصة (مفتاح الإجابة يبقى في المضيف)
  const BANK = [
    { q: { id: 'p-1', type: 'mcq', subject: 'الرياضيات', text: 'ما ناتج ٩ × ٦ ؟', choices: [{ id: 'x1', text: '٥٤' }, { id: 'x2', text: '٥٦' }, { id: 'x3', text: '٤٥' }, { id: 'x4', text: '٦٣' }] }, key: 'x1', exp: '٩ × ٦ = ٥٤.' },
    { q: { id: 'p-2', type: 'tf', subject: 'العلوم', text: 'الشمس نجمٌ.', choices: [{ id: 'true', text: 'صواب' }, { id: 'false', text: 'خطأ' }] }, key: 'true', exp: 'الشمس نجم متوسط الحجم.' },
    { q: { id: 'p-3', type: 'mcq', subject: 'اللغة العربية', text: 'ما مُفردُ كلمةِ «أقلام»؟', choices: [{ id: 'm1', text: 'قَلَم' }, { id: 'm2', text: 'قَلّام' }, { id: 'm3', text: 'مِقْلَمة' }] }, key: 'm1', exp: 'مفرد «أقلام» هو «قَلَم».' },
    { q: { id: 'p-4', type: 'mcq', subject: 'الجغرافيا', text: 'في أيِّ قارّةٍ تقع دولة قطر؟', choices: [{ id: 'a', text: 'أفريقيا' }, { id: 'b', text: 'آسيا' }, { id: 'c', text: 'أوروبا' }, { id: 'd', text: 'أستراليا' }] }, key: 'b', exp: 'تقع قطر في غرب قارة آسيا على الخليج العربي.' },
    { q: { id: 'p-5', type: 'mcq', subject: 'العلوم', text: 'ما الغازُ الذي تمتصّه النباتاتُ من الهواء لتصنع غذاءها في عمليةِ البناءِ الضوئيّ تحت ضوء الشمس، ويخرجُ من الإنسان مع الزفير؟', choices: [{ id: 'g1', text: 'الأكسجين' }, { id: 'g2', text: 'ثاني أكسيد الكربون' }, { id: 'g3', text: 'النيتروجين' }, { id: 'g4', text: 'الهيليوم' }] }, key: 'g2', exp: 'تمتص النباتات ثاني أكسيد الكربون وتطلق الأكسجين.' },
    { q: { id: 'p-6', type: 'tf', subject: 'الرياضيات', text: 'مجموع زوايا المثلث ١٨٠ درجة.', choices: [{ id: 'true', text: 'صواب' }, { id: 'false', text: 'خطأ' }] }, key: 'true', exp: 'مجموع زوايا أي مثلث في المستوى ١٨٠ درجة.' },
  ];

  let session = null;
  const graded = new Map(); // attemptId → grade (منع التكرار)
  const pendingAttempts = new Map();
  const results = new Map();
  let dupAnswers = 0, dupResults = 0;
  window.__sim = { graded, results, log: [], get dupAnswers() { return dupAnswers; }, get dupResults() { return dupResults; } };

  function log(dir, obj) {
    const line = document.createElement('div');
    line.className = dir;
    const text = typeof obj === 'string' ? obj : `${dir === 'in' ? '⇠' : '⇢'} ${obj.type} ${JSON.stringify(obj.payload || {}).slice(0, 240)}`;
    line.textContent = text;
    window.__sim.log.push(text);
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function stats() {
    $('nAnswers').textContent = graded.size; $('nDup').textContent = dupAnswers;
    $('nResults').textContent = results.size; $('nResDup').textContent = dupResults;
  }
  function send(type, payload, requestId) {
    const msg = { protocol: PROTOCOL, type, sessionId: session && session.sessionId, requestId, payload };
    log('out', msg);
    frame.contentWindow.postMessage(msg, location.origin); // نفس المصدر
  }
  function grade(attemptId, sub) {
    const item = BANK.find((b) => b.q.id === sub.questionId);
    if (!item) return { status: 'graded', correct: false, points: 0, explanation: 'سؤال غير معروف' };
    const correct = !sub.timedOut && sub.choiceId === item.key;
    // لا يُرسل مفتاح الإجابة ولا الشرح إلا مع الإجابة الصحيحة (السؤال يُعاد بعد رفض الحاجز)
    return { status: 'graded', correct, points: correct ? 10 : 0, correctChoiceId: correct ? item.key : undefined, explanation: correct ? item.exp : '', attemptId, attemptNo: sub.attemptNo || 1, questionId: sub.questionId };
  }

  window.addEventListener('message', (ev) => {
    // تحقق من المصدر والنافذة
    if (ev.origin !== location.origin || ev.source !== frame.contentWindow) return;
    const m = ev.data;
    if (!m || m.protocol !== PROTOCOL || typeof m.type !== 'string') return;
    log('in', m);
    const p = m.payload || {};
    switch (m.type) {
      case 'game:ready': {
        const n = Math.max(1, Math.min(BANK.length, Number($('qcount').value) || 6));
        session = { sessionId: 'sim-' + Date.now().toString(36) };
        const mode = $('mode').value;
        send('platform:init', {
          sessionId: session.sessionId, mode,
          player: mode === 'classroom' ? { teamName: $('pname').value, students: ['سارة', 'أحمد', 'مريم'] } : { name: $('pname').value },
          settings: { difficulty: 'normal' },
          questions: BANK.slice(0, n).map((b) => b.q), // بلا مفتاح إجابة
        });
        break;
      }
      case 'game:submitAnswer': {
        const id = m.requestId || p.attemptId;
        if (graded.has(id)) { dupAnswers++; stats(); send('platform:grade', graded.get(id), id); return; }
        if ($('drop').checked) { $('drop').checked = false; log('warn', '(تم تجاهل الإرسال عمدًا)'); return; }
        if ($('fail').checked) { $('fail').checked = false; send('platform:error', { code: 'network', message: 'خطأ اتصال (محاكاة)', retryable: true }, id); return; }
        setTimeout(() => {
          const g = grade(id, p);
          if ($('pending').checked) {
            pendingAttempts.set(id, g);
            send('platform:grade', { status: 'pending', attemptId: id }, id);
            return;
          }
          graded.set(id, g); stats();
          if ($('dropReply').checked) { $('dropReply').checked = false; log('warn', '(سُجلت الإجابة ولم يُرسل الرد عمدًا)'); return; }
          send('platform:grade', g, id);
        }, Number($('latency').value) || 0);
        break;
      }
      case 'game:result': {
        const id = m.requestId || p.resultId;
        if (results.has(id)) { dupResults++; stats(); send('platform:ack', { status: 'duplicate' }, id); return; }
        if ($('failResult').checked) { $('failResult').checked = false; send('platform:error', { code: 'save_failed', message: 'تعذر الحفظ (محاكاة)', retryable: true }, id); return; }
        results.set(id, p); stats();
        $('lastResult').textContent = `المركز ${p.rank} — ${p.correctCount}/${p.totalQuestions} — ${p.points} نقطة`;
        if ($('dropAck').checked) { $('dropAck').checked = false; log('warn', '(حُفظت النتيجة ولم يُرسل التأكيد عمدًا)'); return; }
        send('platform:ack', { status: 'saved' }, id);
        break;
      }
      case 'game:exit': log('out', '(طلبت اللعبة العودة إلى المنصة)'); break;
      default:
    }
  });

  $('gradeNow').addEventListener('click', () => {
    for (const [id, g] of pendingAttempts) {
      graded.set(id, g);
      // نتيجة لاحقة: requestId غير مرتبط بطلب معلّق في اللعبة، لذا تُرسل كحدث مستقل
      send('platform:grade', g, 'late-' + id);
    }
    pendingAttempts.clear(); stats();
  });
  document.querySelectorAll('[data-cmd]').forEach((b) => b.addEventListener('click', () => send('platform:control', { command: b.dataset.cmd })));
  $('reload').addEventListener('click', () => { graded.clear(); results.clear(); pendingAttempts.clear(); dupAnswers = 0; dupResults = 0; stats(); frame.src = GAME_PATH + '&t=' + Date.now(); });
  frame.src = GAME_PATH;
})();
