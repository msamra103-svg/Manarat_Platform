/* Target Shooting 3D — standalone / offline question panel.
 * Used ONLY outside the platform (offline teacher/student files and the public demo). Inside the platform
 * the host renders the question with its own official renderer and grades on the server; the game never
 * sees the answer key there.
 * Grading mirrors the platform's rules for the supported types: multiple choice and true/false by index,
 * open text = pending review unless the teacher supplied accepted answers (normalised comparison).
 */
(function (root) {
  'use strict';
  const TS = root.TS, U = TS.util;
  const TYPES = { multiple_choice: 'اختيار من متعدد', true_false: 'صح وخطأ', open_text: 'إجابة مكتوبة' };
  const LETTERS = ['أ', 'ب', 'ج', 'د'];
  const norm = s => String(s ?? '').trim().normalize('NFKC').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').toLowerCase();

  function grade(q, value) {
    if (q.type === 'multiple_choice' || q.type === 'true_false') return { correct: value === q.correct, pending: false };
    if (q.type === 'open_text') {
      if (!q.answers || !q.answers.length) return { correct: false, pending: true };
      return { correct: q.answers.some(a => norm(a) === norm(value)), pending: false };
    }
    return { correct: false, pending: true };
  }

  /** Shows question q; resolves with {correct, pending, attempts, value}. order: shuffled index map. */
  function ask(els, q, { index, total, attempts = 1, shuffle = true, feedback = 'explain', rng = Math.random } = {}) {
    return new Promise(resolve => {
      const $ = id => els.root.querySelector('#' + id);
      $('qType').textContent = TYPES[q.type] || 'سؤال';
      $('qCount').textContent = 'السؤال ' + U.digits(index + 1) + ' من ' + U.digits(total);
      $('qText').textContent = q.text;
      const img = $('qImage'); if (q.image) { img.src = q.image; img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }
      const body = $('qBody'); body.innerHTML = ''; body.className = '';
      const note = $('qNote'); note.textContent = attempts > 1 ? 'لديك ' + U.digits(attempts) + ' محاولات للإجابة.' : '';
      const submit = $('qSubmit'); submit.hidden = true;
      let tries = 0;
      const finish = (res) => { setTimeout(() => resolve(res), res.pending ? 250 : 900); };
      if (q.type === 'open_text') {
        body.className = 'single';
        const ta = document.createElement('textarea'); ta.placeholder = 'اكتب إجابتك هنا…'; ta.maxLength = 1000; body.appendChild(ta);
        submit.hidden = false; submit.disabled = false;
        submit.onclick = () => {
          const v = ta.value.trim(); if (!v) { note.textContent = 'اكتب إجابتك أولًا.'; ta.focus(); return; }
          tries++; const r = grade(q, v);
          if (r.pending) { submit.disabled = true; ta.disabled = true; finish({ correct: false, pending: true, attempts: tries, value: v }); return; }
          if (r.correct || tries >= attempts) { submit.disabled = true; ta.disabled = true; finish({ correct: r.correct, pending: false, attempts: tries, value: v }); }
          else { note.textContent = 'الإجابة غير مطابقة. لديك محاولة أخرى.'; ta.select(); }
        };
        setTimeout(() => ta.focus(), 60);
        return;
      }
      const idx = q.options.map((_, i) => i);
      const order = shuffle && q.type === 'multiple_choice' ? U.shuffle(idx, rng) : idx;
      if (q.type === 'true_false') body.className = '';
      const buttons = order.map((oi, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'opt';
        b.innerHTML = '<b>' + LETTERS[k] + '</b><span>' + U.esc(q.options[oi]) + '</span>';
        b.onclick = () => {
          tries++; const r = grade(q, oi);
          if (r.correct || tries >= attempts) {
            buttons.forEach(x => { x.disabled = true; });
            b.classList.add(r.correct ? 'correct' : 'wrong');
            if (!r.correct && feedback === 'explain') buttons[order.indexOf(q.correct)].classList.add('correct');
            finish({ correct: r.correct, pending: false, attempts: tries, value: oi });
          } else {
            b.classList.add('wrong'); b.disabled = true;
            note.textContent = 'ليست الإجابة الصحيحة. لديك ' + U.digits(attempts - tries) + ' محاولة أخرى.';
          }
        };
        body.appendChild(b); return b;
      });
      setTimeout(() => buttons[0] && buttons[0].focus(), 60);
    });
  }
  TS.Questions = { ask, grade, TYPES, norm };
})(typeof window !== 'undefined' ? window : globalThis);
