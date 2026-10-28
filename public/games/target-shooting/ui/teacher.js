/* Target Shooting 3D — teacher control panel (offline / standalone teacher version).
 * Edits the same JSON configuration that sanitize() accepts; nothing here talks to the platform or any
 * server. Inside the platform, teachers choose the mode/difficulty when creating the assignment and the
 * questions come from the platform's own question bank.
 */
(function (root) {
  'use strict';
  const TS = root.TS, U = TS.util, C = TS.config;
  const esc = U.esc;

  function open({ cfg, apply, root: host, store }) {
    let draft = JSON.parse(JSON.stringify(cfg));
    if (!draft.questions) draft.questions = JSON.parse(JSON.stringify(C.DEMO_QUESTIONS));
    let tab = 'settings', msg = '';
    host.hidden = false;
    function sel(name, label, options, value) { return `<label>${label}<select data-k="${name}">${options.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`; }
    function inp(name, label, value, type = 'text', extra = '') { return `<label>${label}<input data-k="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`; }
    function chk(name, label, value) { return `<label class="row"><input data-k="${name}" type="checkbox"${value ? ' checked' : ''}> ${label}</label>`; }
    function settings() {
      const d = draft;
      return `<h3 class="t-sec">الهوية والدرس</h3><div class="t-grid">
        ${inp('school', 'اسم المدرسة', d.school)}${inp('department', 'القسم', d.department)}${inp('teacher', 'اسم المعلم', d.teacher)}
        ${inp('lesson', 'عنوان الدرس', d.lesson)}${inp('accent', 'لون الهوية', d.accent, 'color')}${sel('mode', 'التحدي', [['choice', 'يختار الطالب'], ...C.MODE_KEYS.map(k => [k, C.MODES[k].title])], d.mode)}
      </div><h3 class="t-sec">اللعب</h3><div class="t-grid">
        ${sel('difficulty', 'المستوى', Object.values(C.DIFFICULTY).map(x => [x.key, x.title]), d.difficulty)}
        ${inp('arrowsPerQuestion', 'عدد الأسهم في كل جولة', d.arrowsPerQuestion, 'number', 'min="1" max="10"')}
        ${inp('targetsPerQuestion', 'عدد الأهداف في كل جولة', d.targetsPerQuestion, 'number', 'min="1" max="8"')}
        ${inp('speed', 'سرعة الأهداف (×)', d.speed, 'number', 'min="0.4" max="1.8" step="0.1"')}
        ${inp('size', 'حجم الأهداف (×)', d.size, 'number', 'min="0.6" max="1.8" step="0.1"')}
        ${sel('aimAssist', 'مساعدة التصويب', [['auto', 'حسب المستوى'], ['off', 'بدون'], ['low', 'خفيفة'], ['high', 'قوية']], d.aimAssist)}
        ${sel('controls', 'طريقة التحكم', [['standard', 'شد وإطلاق'], ['simple', 'مبسّطة (لمسة واحدة)']], d.controls)}
        ${inp('timeLimit', 'زمن الجولة بالثواني (٠ = بلا حد)', d.timeLimit, 'number', 'min="0" max="600"')}
        ${sel('celebration', 'شدة الاحتفال', [['low', 'هادئ'], ['normal', 'متوسط'], ['high', 'قوي']], d.celebration)}
      </div><h3 class="t-sec">الأسئلة والتقييم</h3><div class="t-grid">
        ${inp('questionCount', 'عدد الأسئلة (٠ = الكل)', d.questionCount, 'number', 'min="0" max="100"')}
        ${inp('attempts', 'محاولات الإجابة', d.attempts, 'number', 'min="1" max="3"')}
        ${inp('pointsCorrect', 'نقاط الإجابة الصحيحة', d.pointsCorrect, 'number', 'min="10" max="1000" step="10"')}
        ${sel('order', 'ترتيب الأسئلة', [['fixed', 'ثابت'], ['random', 'عشوائي']], d.order)}
        ${sel('feedback', 'التغذية الراجعة', [['explain', 'إظهار الإجابة الصحيحة والشرح'], ['brief', 'مختصرة']], d.feedback)}
        <div class="t-field">${chk('shuffleOptions', 'خلط ترتيب الخيارات', d.shuffleOptions)}${chk('sound', 'المؤثرات الصوتية', d.sound)}${chk('music', 'الموسيقى', d.music)}</div>
      </div>`;
    }
    function questions() {
      return `<div class="t-qs">${draft.questions.map((q, i) => qCard(q, i)).join('')}</div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button class="primary" data-act="add">+ إضافة سؤال</button><button class="ghost" data-act="addtf">+ صح وخطأ</button><button class="ghost" data-act="addopen">+ سؤال مقالي</button></div>`;
    }
    function qCard(q, i) {
      const head = `<div class="t-q-head"><b>${U.digits(i + 1)}</b><select data-q="${i}" data-f="type"><option value="multiple_choice"${q.type === 'multiple_choice' ? ' selected' : ''}>اختيار من متعدد</option><option value="true_false"${q.type === 'true_false' ? ' selected' : ''}>صح وخطأ</option><option value="open_text"${q.type === 'open_text' ? ' selected' : ''}>مقالي</option></select><span class="sp"></span>
        <button data-act="up" data-q="${i}" aria-label="أعلى">▲</button><button data-act="down" data-q="${i}" aria-label="أسفل">▼</button><button class="del" data-act="del" data-q="${i}">حذف</button></div>`;
      let body = `<textarea data-q="${i}" data-f="text" rows="2" placeholder="نص السؤال">${esc(q.text)}</textarea>`;
      if (q.type === 'multiple_choice') {
        const opts = (q.options || []).slice(0, 4); while (opts.length < 4) opts.push('');
        body += `<div class="t-opts">${opts.map((o, k) => `<div class="t-opt${q.correct === k ? ' is-correct' : ''}"><input type="text" data-q="${i}" data-f="opt" data-o="${k}" value="${esc(o)}" placeholder="الخيار ${'أبجد'[k]}"><label><input type="radio" name="c${i}" data-q="${i}" data-f="correct" value="${k}"${q.correct === k ? ' checked' : ''}> صحيحة</label></div>`).join('')}</div>`;
      } else if (q.type === 'true_false') {
        body += `<div class="t-opts">${['صح', 'خطأ'].map((o, k) => `<div class="t-opt${q.correct === k ? ' is-correct' : ''}"><span style="flex:1;padding:6px">${o}</span><label><input type="radio" name="c${i}" data-q="${i}" data-f="correct" value="${k}"${q.correct === k ? ' checked' : ''}> الإجابة الصحيحة</label></div>`).join('')}</div>`;
      } else {
        body += `<input type="text" data-q="${i}" data-f="answers" value="${esc((q.answers || []).join('، '))}" placeholder="إجابات مقبولة مفصولة بفاصلة (اختياري — بدونها تُرسل للمراجعة)">`;
      }
      body += `<input type="text" data-q="${i}" data-f="explanation" value="${esc(q.explanation || '')}" placeholder="شرح يظهر بعد الإجابة (اختياري)">`;
      body += `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="ghost" style="color:#8A1538;background:#fff;border-color:#e2cfd6">صورة السؤال<input type="file" accept="image/*" data-q="${i}" data-f="image" hidden></label>${q.image ? `<img src="${esc(q.image)}" alt="" style="height:44px;border-radius:8px"><button data-act="noimg" data-q="${i}">إزالة الصورة</button>` : ''}</div>`;
      return `<div class="t-q">${head}${body}</div>`;
    }
    function exportTab() {
      return `<h3 class="t-sec">نسخ للعمل دون إنترنت</h3>
        <p>ينشئ ملف HTML واحدًا للطالب يتضمن اللعبة كاملة والإعدادات والأسئلة الحالية (دون لوحة المعلم). يعمل بفتحه مباشرة في المتصفح دون اتصال.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="primary" data-act="student">تنزيل نسخة الطالب (HTML)</button><button class="ghost" data-act="backup">حفظ الإعدادات والأسئلة (JSON)</button><label class="ghost" style="color:#8A1538;background:#fff;border-color:#e2cfd6">استيراد ملف JSON<input type="file" accept="application/json,.json" data-act="import" hidden></label></div>
        <p class="note" style="color:#6b5d62">الإعدادات تُحفظ في هذا المتصفح أيضًا عند الضغط على «حفظ وتطبيق».</p>`;
    }
    function render() {
      host.innerHTML = `<div class="t-wrap" role="dialog" aria-modal="true" aria-labelledby="tTitle">
        <div class="t-head"><h2 id="tTitle">لوحة المعلم — ${esc(C.GAME_NAME)}</h2><button class="ghost" data-act="close">إغلاق</button></div>
        <div class="t-tabs" role="tablist">${[['settings', 'الإعدادات'], ['questions', 'الأسئلة (' + U.digits(draft.questions.length) + ')'], ['export', 'التصدير']].map(([k, t]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${t}</button>`).join('')}</div>
        <div class="t-body">${tab === 'settings' ? settings() : tab === 'questions' ? questions() : exportTab()}</div>
        <div class="t-actions"><span class="t-msg">${esc(msg)}</span><div style="display:flex;gap:8px"><button class="ghost" data-act="reset">استعادة الافتراضي</button><button class="primary" data-act="save">حفظ وتطبيق</button></div></div></div>`;
      msg = '';
    }
    function readSettings() {
      host.querySelectorAll('[data-k]').forEach(el => {
        const k = el.dataset.k;
        draft[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      });
    }
    function validate() {
      const bad = draft.questions.findIndex(q => !String(q.text || '').trim() || (q.type === 'multiple_choice' && ((q.options || []).filter(o => String(o || '').trim()).length < 2 || !String((q.options || [])[q.correct] || '').trim())));
      return bad;
    }
    host.oninput = host.onchange = e => {
      const el = e.target;
      if (el.dataset.k && tab === 'settings') { readSettings(); return; }
      const i = Number(el.dataset.q); if (!Number.isInteger(i)) return;
      const q = draft.questions[i], f = el.dataset.f;
      if (f === 'text') q.text = el.value;
      else if (f === 'opt') { q.options = (q.options || ['', '', '', '']).slice(); while (q.options.length < 4) q.options.push(''); q.options[Number(el.dataset.o)] = el.value; }
      else if (f === 'correct' && e.type === 'change') { q.correct = Number(el.value); render(); }
      else if (f === 'answers') q.answers = el.value.split(/[،,]/).map(s => s.trim()).filter(Boolean);
      else if (f === 'explanation') q.explanation = el.value;
      else if (f === 'type' && e.type === 'change') { q.type = el.value; if (q.type === 'true_false') { q.options = ['صح', 'خطأ']; q.correct = q.correct === 1 ? 1 : 0; } if (q.type === 'multiple_choice' && (!q.options || q.options.length < 4)) { q.options = ['', '', '', '']; q.correct = 0; } render(); }
      else if (f === 'image' && e.type === 'change' && el.files[0]) {
        const file = el.files[0]; if (file.size > 900000) { msg = 'الصورة كبيرة؛ اختر صورة أصغر من ٩٠٠ كيلوبايت.'; render(); return; }
        const r = new FileReader(); r.onload = () => { q.image = r.result; render(); }; r.readAsDataURL(file);
      }
      if (e.type === 'change' && el.dataset.act === 'import' && el.files[0]) {
        const r = new FileReader(); r.onload = () => { try { const x = C.sanitize(JSON.parse(r.result)); draft = Object.assign(draft, x); if (!draft.questions) draft.questions = []; msg = 'تم الاستيراد. اضغط «حفظ وتطبيق».'; } catch (err) { msg = 'ملف غير صالح.'; } render(); }; r.readAsText(el.files[0]);
      }
    };
    host.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { if (tab === 'settings') readSettings(); tab = b.dataset.tab; render(); return; }
      const act = b.dataset.act, i = Number(b.dataset.q);
      if (act === 'close') { host.hidden = true; host.innerHTML = ''; return; }
      if (act === 'add') draft.questions.push({ type: 'multiple_choice', text: '', options: ['', '', '', ''], correct: 0, explanation: '' });
      if (act === 'addtf') draft.questions.push({ type: 'true_false', text: '', options: ['صح', 'خطأ'], correct: 0, explanation: '' });
      if (act === 'addopen') draft.questions.push({ type: 'open_text', text: '', answers: [], explanation: '' });
      if (act === 'del') { if (confirm('حذف هذا السؤال؟')) draft.questions.splice(i, 1); }
      if (act === 'up' && i > 0) [draft.questions[i - 1], draft.questions[i]] = [draft.questions[i], draft.questions[i - 1]];
      if (act === 'down' && i < draft.questions.length - 1) [draft.questions[i + 1], draft.questions[i]] = [draft.questions[i], draft.questions[i + 1]];
      if (act === 'noimg') delete draft.questions[i].image;
      if (act === 'reset') { if (!confirm('استعادة الإعدادات الافتراضية؟ لن تُحذف الأسئلة.')) return; const qs = draft.questions; draft = JSON.parse(JSON.stringify(C.DEFAULTS)); draft.questions = qs; msg = 'تمت الاستعادة. اضغط «حفظ وتطبيق».'; }
      if (act === 'save' || act === 'student' || act === 'backup') {
        if (tab === 'settings') readSettings();
        const bad = validate();
        if (bad >= 0) { tab = 'questions'; msg = 'أكمل السؤال رقم ' + U.digits(bad + 1) + ': نص السؤال وخياران على الأقل والإجابة الصحيحة.'; render(); return; }
        if (!draft.questions.length) { tab = 'questions'; msg = 'أضف سؤالًا واحدًا على الأقل.'; render(); return; }
        const clean = C.sanitize(draft);
        if (act === 'save') { apply(clean); msg = 'تم الحفظ والتطبيق.'; }
        if (act === 'backup') download('التصويب-على-الهدف-إعدادات.json', JSON.stringify(clean, null, 2), 'application/json');
        if (act === 'student') {
          b.disabled = true; b.textContent = 'جارٍ إنشاء الملف…';
          try { const html = await TS.Export.student(clean); download('التصويب-على-الهدف-نسخة-الطالب.html', html, 'text/html'); msg = 'تم إنشاء نسخة الطالب.'; }
          catch (err) { console.error(err); msg = 'تعذر إنشاء الملف: ' + (err.message || err); }
        }
      }
      render();
    };
    render();
    setTimeout(() => { const f = host.querySelector('input,select,button'); f && f.focus(); }, 30);
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type + ';charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  TS.Teacher = { open, download };
})(typeof window !== 'undefined' ? window : globalThis);
