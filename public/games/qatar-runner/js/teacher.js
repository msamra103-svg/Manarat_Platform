/* عدّاء قطر — Arabic teacher dashboard (offline / standalone use).
 * Lesson identity, a very simple question editor (question first, then one box per answer with a visible
 * "correct answer" selector — no indexes to type), images, gameplay settings, save/preview, JSON import/export,
 * CSV/TSV paste import, and a student-only single-file export (offline build).
 * Inside the school platform this panel is hidden: assignments are created in the platform's own editor.
 */
(function (root) {
  'use strict';
  const doc = root.document, CFG = root.QRConfig;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  let draft = null, onSaved = null, host = null;
  const uid = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function open(cfg, cb) {
    host = doc.getElementById('teacher'); onSaved = cb;
    draft = JSON.parse(JSON.stringify(cfg));
    if (draft.sample) { draft._sampleNotice = true; }
    render(); host.hidden = false; host.scrollTop = 0;
  }
  function close() { host.hidden = true; host.innerHTML = ''; }
  function sel(name, value, opts) { return `<select data-k="${name}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`; }
  function render() {
    const d = draft;
    host.innerHTML = `<div class="t-wrap">
      <div class="t-head"><h2>لوحة المعلم — عدّاء قطر</h2><button class="t-mini" data-act="close" type="button">رجوع للعبة ✕</button></div>
      ${d._sampleNotice ? '<p class="t-msg ok">الأسئلة الحالية أسئلة تجريبية. عند حفظ أسئلة الدرس تحلّ محلها بالكامل.</p>' : ''}
      <div id="tMsg" aria-live="polite"></div>
      <section class="t-card"><h3>بيانات الدرس</h3><div class="t-grid">
        <label class="t-field">اسم المدرسة<input type="text" data-k="school" value="${esc(d.school)}" maxlength="150"></label>
        <label class="t-field">اسم المعلم<input type="text" data-k="teacher" value="${esc(d.teacher)}" maxlength="150"></label>
        <label class="t-field">عنوان الدرس<input type="text" data-k="lesson" value="${esc(d.lesson)}" maxlength="150"></label>
        <label class="t-field">الصف<input type="text" data-k="grade" value="${esc(d.grade)}" maxlength="60" placeholder="مثال: الصف السابع"></label>
        <label class="t-field">الشعبة / الفصل<input type="text" data-k="className" value="${esc(d.className)}" maxlength="60" placeholder="مثال: ٧/٢"></label>
        <label class="t-field">اسم الطالب <small>(اختياري، يظهر في الشهادة)</small><input type="text" data-k="student" value="${esc(d.student)}" maxlength="80"></label>
      </div></section>
      <section class="t-card"><h3>الأسئلة <small style="font-weight:400;color:#6d6468">(${AR(d.questions.length)})</small></h3>
        <p class="t-note">اكتب السؤال أولًا، ثم الإجابات، واختر الإجابة الصحيحة بالضغط على «صحيحة» بجانبها. تُخلط الإجابات تلقائيًا أثناء اللعب.</p>
        <div id="tQs" style="display:grid;gap:12px">${d.questions.map((q, i) => qCard(q, i)).join('')}</div>
        <div class="menu-row"><button class="btn btn-primary" data-act="add" type="button">+ إضافة سؤال</button><button class="btn btn-ghost" data-act="paste" type="button">لصق أسئلة من جدول</button><label class="btn btn-ghost" style="text-align:center">استيراد ملف<input type="file" accept=".json,.csv,.tsv,.txt" data-act="import" hidden></label></div>
        <div id="tPaste" hidden style="display:grid;gap:8px"><textarea id="tPasteArea" rows="6" placeholder="سطر لكل سؤال: السؤال ثم الإجابات مفصولة بفاصلة أو Tab، وضع * قبل الإجابة الصحيحة&#10;مثال: ما عاصمة قطر؟, *الدوحة, الوكرة, الخور, الريان"></textarea><button class="btn btn-primary" data-act="pasteGo" type="button">إضافة الأسئلة الملصقة</button></div>
      </section>
      <section class="t-card"><h3>إعدادات اللعب</h3><div class="t-grid">
        <label class="t-field">عدد الإجابات المعروضة${sel('answers', d.answers, [[2, 'إجابتان'], [3, 'ثلاث إجابات'], [4, 'أربع إجابات']])}</label>
        <label class="t-field">عدد المحاولات (القلوب)${sel('attempts', d.attempts, [1, 2, 3, 4, 5].map(n => [n, AR(n)]))}</label>
        <label class="t-field">عند نفاد المحاولات${sel('onFail', d.onFail, [['retry-gate', 'إعادة المحاولة من البوابة نفسها'], ['restart', 'إعادة الدرس من البداية']])}</label>
        <label class="t-field">صعوبة العوائق${sel('difficulty', d.difficulty, [['easy', 'سهلة'], ['normal', 'متوسطة'], ['hard', 'صعبة']])}</label>
        <label class="t-field">سرعة الجري${sel('speed', d.speed, [['slow', 'هادئة'], ['normal', 'عادية'], ['fast', 'سريعة']])}</label>
        <label class="t-field">المسافة بين الأسئلة${sel('gap', d.gap, [['short', 'قصيرة'], ['medium', 'متوسطة'], ['long', 'طويلة']])}</label>
        <label class="t-field">مؤقت السؤال${sel('timer', d.timer, [[0, 'بدون مؤقت'], [15, '١٥ ثانية'], [20, '٢٠ ثانية'], [30, '٣٠ ثانية'], [45, '٤٥ ثانية'], [60, '٦٠ ثانية']])}</label>
        <label class="t-field">صوت العدّ التنازلي${sel('countdownSound', d.countdownSound, [[true, 'مفعّل'], [false, 'متوقف']])}</label>
        <label class="t-field">نسبة النجاح (من المحاولة الأولى)<input type="number" data-k="threshold" min="0" max="100" value="${esc(d.threshold)}"></label>
        <label class="t-field">المسار${sel('environment', d.environment, [['tour', 'جولة: الكورنيش ← سوق واقف'], ['corniche', 'كورنيش الدوحة والأبراج'], ['souq', 'سوق واقف التراثي']])}</label>
        <label class="t-field">تحوّل النهار إلى الليل${sel('dayNight', d.dayNight, [[true, 'مع كل إجابة صحيحة'], [false, 'نهار دائمًا']])}</label>
        <label class="t-field">أزرار التحكم على الشاشة${sel('controls', d.controls, [['auto', 'تلقائي (للأجهزة اللمسية)'], ['on', 'تظهر دائمًا'], ['off', 'مخفية (سحب الإصبع فقط)']])}</label>
        <label class="t-field">جودة الرسوميات${sel('quality', d.quality, [['auto', 'تلقائية'], ['high', 'عالية'], ['medium', 'متوسطة'], ['low', 'منخفضة (أجهزة ضعيفة)']])}</label>
        <label class="t-field">صوت الموسيقى<input type="range" data-k="music" min="0" max="1" step="0.05" value="${esc(d.music)}"></label>
        <label class="t-field">صوت المؤثرات<input type="range" data-k="sfx" min="0" max="1" step="0.05" value="${esc(d.sfx)}"></label>
      </div>
      <p class="t-note">مدن أخرى من صور يرفعها المعلم: مخطط للمرحلة التالية (تكييف بصري من الصور، وليس إعادة بناء ثلاثية الأبعاد دقيقة).</p></section>
    </div>
    <div class="t-actions">
      <button class="btn btn-primary" data-act="save" type="button">حفظ الدرس</button>
      <button class="btn btn-gold" data-act="preview" type="button">حفظ ومعاينة اللعبة</button>
      <button class="btn btn-ghost" data-act="export" type="button">تصدير نسخة الطالب</button>
      <button class="btn btn-ghost" data-act="exportJson" type="button">حفظ نسخة احتياطية (JSON)</button>
      <button class="btn btn-ghost" data-act="reset" type="button">استعادة الإعدادات الأصلية</button>
    </div>`;
    host.querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.tagName === 'SELECT' || el.type === 'range' ? 'change' : 'input', () => {
      const k = el.dataset.k; let v = el.value; if (['answers', 'attempts', 'timer', 'threshold'].includes(k)) v = Number(v); if (['music', 'sfx'].includes(k)) v = Number(v); if (['countdownSound', 'dayNight'].includes(k)) v = v === 'true'; draft[k] = v;
    }));
    if (root.__QR_ARTIFACT__) host.querySelectorAll('[data-act=export],[data-act=exportJson]').forEach(b => b.remove()); // downloads are not available in the web preview
    host.querySelectorAll('[data-act]').forEach(el => el.addEventListener(el.type === 'file' ? 'change' : 'click', e => act(el.dataset.act, el, e)));
    wireQuestions();
  }
  function qCard(q, i) {
    const opts = q.options.slice(); while (opts.length < 4) opts.push('');
    return `<article class="t-q" data-i="${i}">
      <div class="t-q-head"><b>السؤال ${AR(i + 1)}</b><div class="t-q-tools">
        <button class="t-mini" data-q="up" type="button" aria-label="تحريك للأعلى">▲</button><button class="t-mini" data-q="down" type="button" aria-label="تحريك للأسفل">▼</button>
        <button class="t-mini" data-q="dup" type="button">نسخ</button><button class="t-mini danger" data-q="del" type="button">حذف</button></div></div>
      <label class="t-field">نص السؤال<textarea data-qk="text" maxlength="400" placeholder="اكتب السؤال هنا">${esc(q.text)}</textarea></label>
      ${opts.map((o, k) => `<div class="t-opt"><input type="text" data-qo="${k}" value="${esc(o)}" maxlength="160" placeholder="الإجابة ${AR(k + 1)}${k > 1 ? ' (اختيارية)' : ''}"><label class="correct"><input type="radio" name="c${i}" data-qc="${k}"${q.correct === k ? ' checked' : ''}> صحيحة</label></div>`).join('')}
      <div class="t-opt"><label class="t-mini" style="cursor:pointer">${q.image ? 'تغيير الصورة' : 'إضافة صورة للسؤال'}<input type="file" accept="image/*" data-qimg hidden></label>${q.image ? `<img class="t-thumb" src="${q.image}" alt="صورة السؤال"><button class="t-mini danger" data-q="noimg" type="button">إزالة الصورة</button>` : ''}</div>
    </article>`;
  }
  function wireQuestions() {
    host.querySelectorAll('.t-q').forEach(card => {
      const i = Number(card.dataset.i), q = () => draft.questions[i];
      card.querySelector('[data-qk=text]').addEventListener('input', e => { q().text = e.target.value; });
      card.querySelectorAll('[data-qo]').forEach(inp => inp.addEventListener('input', e => { const k = Number(inp.dataset.qo), o = q().options; while (o.length <= k) o.push(''); o[k] = e.target.value; }));
      card.querySelectorAll('[data-qc]').forEach(r => r.addEventListener('change', () => { q().correct = Number(r.dataset.qc); }));
      card.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
        const qs = draft.questions, a = b.dataset.q;
        if (a === 'up' && i > 0) [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
        if (a === 'down' && i < qs.length - 1) [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
        if (a === 'dup') qs.splice(i + 1, 0, Object.assign(JSON.parse(JSON.stringify(qs[i])), { id: uid() }));
        if (a === 'del') { if (qs.length <= 1) return msg('يجب أن يبقى سؤال واحد على الأقل.', 'err'); qs.splice(i, 1); }
        if (a === 'noimg') qs[i].image = '';
        rerenderQs();
      }));
      card.querySelector('[data-qimg]').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { q().image = await shrink(f, 800, 0.82); rerenderQs(); } catch (err) { msg('تعذّر قراءة الصورة.', 'err'); } });
    });
  }
  function rerenderQs() { const box = host.querySelector('#tQs'); box.innerHTML = draft.questions.map((q, i) => qCard(q, i)).join(''); host.querySelector('.t-card h3 small') && (host.querySelectorAll('.t-card h3 small')[0].textContent = '(' + AR(draft.questions.length) + ')'); wireQuestions(); }
  function shrink(file, max, q) { return new Promise((res, rej) => { const r = new FileReader(); r.onerror = rej; r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = doc.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q)); }; im.src = r.result; }; r.readAsDataURL(file); }); }
  function msg(t, kind = 'ok') { const m = host.querySelector('#tMsg'); m.className = 't-msg ' + kind; m.textContent = t; m.scrollIntoView({ block: 'nearest' }); }
  function problems() {
    const out = [];
    draft.questions.forEach((q, i) => {
      const opts = q.options.map(o => String(o || '').trim());
      if (!String(q.text || '').trim()) out.push('السؤال ' + AR(i + 1) + ': اكتب نص السؤال.');
      const filled = opts.filter(Boolean).length; if (filled < 2) out.push('السؤال ' + AR(i + 1) + ': أضف إجابتين على الأقل.');
      if (!opts[q.correct]) out.push('السؤال ' + AR(i + 1) + ': اختر إجابة صحيحة غير فارغة.');
    });
    return out;
  }
  function compact() { // drop empty answer boxes but keep the correct answer mapping
    const d = JSON.parse(JSON.stringify(draft)); delete d._sampleNotice;
    d.questions = d.questions.map(q => { const pairs = q.options.map((o, k) => [String(o || '').trim(), k]).filter(([o]) => o); const correct = pairs.findIndex(([, k]) => k === q.correct); return { id: q.id || uid(), text: String(q.text || '').trim(), options: pairs.map(([o]) => o), correct: Math.max(0, correct), image: q.image || '' }; });
    d.sample = false; return d;
  }
  function save() {
    const p = problems(); if (p.length) { msg(p.slice(0, 4).join(' · '), 'err'); return null; }
    const r = CFG.save(compact()); if (!r.ok) { msg(r.error, 'err'); return null; }
    draft = JSON.parse(JSON.stringify(r.config)); msg('تم حفظ الدرس ✓ (' + AR(r.config.questions.length) + ' أسئلة). يحفظ في هذا المتصفح فقط ولا يؤثر في الألعاب الأخرى.', 'ok');
    if (onSaved) onSaved(r.config); return r.config;
  }
  function download(name, text, type) { const a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function parseRows(text) {
    const rows = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean), out = [];
    for (const line of rows) {
      const cells = (line.includes('\t') ? line.split('\t') : line.split(/[,،]/)).map(c => c.trim()).filter(Boolean); if (cells.length < 3) continue;
      const [text0, ...ans] = cells; let correct = ans.findIndex(a => a.startsWith('*')); if (correct < 0) correct = 0;
      out.push({ id: uid(), text: text0, options: ans.slice(0, 4).map(a => a.replace(/^\*/, '').trim()), correct: Math.min(correct, 3), image: '' });
    }
    return out;
  }
  function act(a, el) {
    if (a === 'close') close();
    if (a === 'add') { draft.questions.push({ id: uid(), text: '', options: ['', '', '', ''], correct: 0, image: '' }); rerenderQs(); host.querySelector('.t-q:last-child textarea').focus(); }
    if (a === 'paste') { const p = host.querySelector('#tPaste'); p.hidden = !p.hidden; }
    if (a === 'pasteGo') { const list = parseRows(host.querySelector('#tPasteArea').value); if (!list.length) return msg('لم أجد أسئلة صالحة. اكتب السؤال ثم ٢–٤ إجابات في كل سطر.', 'err'); if (draft._sampleNotice) { draft.questions = []; draft._sampleNotice = false; } draft.questions.push(...list); rerenderQs(); msg('أُضيف ' + AR(list.length) + ' سؤال. لا تنسَ الحفظ.', 'ok'); }
    if (a === 'import') { const f = el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const t = String(r.result); if (/^\s*[{[]/.test(t)) { const j = JSON.parse(t); const c = CFG.validate(Array.isArray(j) ? Object.assign({}, draft, { questions: j }) : j); draft = Object.assign(draft, c, { sample: false }); draft._sampleNotice = false; render(); msg('تم استيراد الملف. راجع الأسئلة ثم احفظ.', 'ok'); } else { const list = parseRows(t); if (!list.length) throw new Error('empty'); draft.questions = list; draft._sampleNotice = false; rerenderQs(); msg('تم استيراد ' + AR(list.length) + ' سؤال. راجعها ثم احفظ.', 'ok'); } } catch (e) { msg('تعذّر قراءة الملف. استخدم JSON من هذه اللوحة أو جدولًا (CSV/TSV).', 'err'); } }; r.readAsText(f, 'utf-8'); }
    if (a === 'save') save();
    if (a === 'preview') { if (save()) { close(); const b = doc.getElementById('btnStart'); if (b && !b.disabled) b.click(); } }
    if (a === 'exportJson') { const c = compact(); download('qatar-runner-lesson.json', JSON.stringify(c, null, 2), 'application/json'); }
    if (a === 'export') exportStudent();
    if (a === 'reset') { if (!root.confirm('سيتم حذف أسئلة الدرس المحفوظة في هذا المتصفح واستعادة الأسئلة التجريبية. هل أنت متأكد؟')) return; const c = CFG.reset(); draft = JSON.parse(JSON.stringify(c)); draft._sampleNotice = true; render(); if (onSaved) onSaved(c); msg('تمت استعادة الإعدادات الأصلية.', 'ok'); }
  }
  function exportStudent() {
    const c = save(); if (!c) return;
    if (root.__QR_ARTIFACT__) { msg('التصدير غير متاح في هذه المعاينة على الويب. استخدم الملف qatar-runner-offline.html من الحزمة.', 'err'); return; }
    if (!root.__QR_PRISTINE__ || !doc.getElementById('qr-game')) { msg('تصدير نسخة الطالب متاح من النسخة غير المتصلة (ملف واحد: qatar-runner-offline.html) الموجودة في الحزمة. في هذه النسخة استخدم «حفظ نسخة احتياطية».', 'err'); return; }
    const cfgJson = JSON.stringify(Object.assign({}, c, { quality: c.quality })).replace(/</g, '\\u003c');
    const head = root.__QR_PRISTINE__.replace(/<\/body>\s*<\/html>\s*$/i, '');
    const html = '<!doctype html>\n' + head + '<script>window.__QR_EMBEDDED_CONFIG__=' + cfgJson + ';</script>\n<script id="qr-game">' + doc.getElementById('qr-game').textContent + '</script>\n</body></html>';
    download('qatar-runner-' + (c.lesson || 'lesson').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40) + '.html', html, 'text/html');
    msg('تم تصدير نسخة الطالب (ملف HTML واحد يعمل دون إنترنت، بدون لوحة المعلم).', 'ok');
  }
  root.QRTeacher = { open, close, _parseRows: parseRows };
})(typeof window !== 'undefined' ? window : globalThis);
