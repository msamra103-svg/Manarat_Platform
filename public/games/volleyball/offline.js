/* الكرة الطائرة V24 — offline classroom packages (loaded ONLY by the offline builds, never by the platform).
 *
 * Teacher build: edit a local question set (stored in this browser), export it as a JSON file, import one.
 * Student build: plays the question set bundled at build time, or a JSON file the teacher shared.
 * Offline answers are checked locally on the device for practice ONLY: nothing is recorded or sent
 * anywhere, and the screens say so. Official assessment stays on the platform.
 */
(function () {
  'use strict';
  const cfg = window.VOLLEY_OFFLINE || { role: 'student' };
  const KEY = 'vb24.offline.questions';
  const $ = (id) => document.getElementById(id);
  const clean = (list) => (Array.isArray(list) ? list : []).map((q) => {
    const text = String(q.text || '').trim().slice(0, 400);
    if (!text) return null;
    if (q.essay) return { text, essay: true };
    const choices = (Array.isArray(q.choices) ? q.choices : []).map((c) => String(c).trim().slice(0, 120)).filter(Boolean).slice(0, 4);
    const answer = Number(q.answer);
    if (choices.length < 2 || !(answer >= 0 && answer < choices.length)) return null;
    return { text, choices, answer };
  }).filter(Boolean).slice(0, 30);
  function load() {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && clean(saved).length) return clean(saved); } catch (e) { /* storage unavailable */ }
    return clean(cfg.questions);
  }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* */ } }
  // Text format, one question per line:  السؤال | خيار | *الخيار الصحيح | خيار     (or:  السؤال | مقالي)
  const toText = (list) => list.map((q) => [q.text, ...(q.essay ? ['مقالي'] : q.choices.map((c, i) => (i === q.answer ? '*' : '') + c))].join(' | ')).join('\n');
  function fromText(txt) {
    return clean(txt.split(/\n+/).map((line) => {
      const parts = line.split('|').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) return null;
      if (parts.length === 2 && /^مقال/.test(parts[1])) return { text: parts[0], essay: true };
      const opts = parts.slice(1), answer = opts.findIndex((o) => o.startsWith('*'));
      return { text: parts[0], choices: opts.map((o) => o.replace(/^\*/, '')), answer };
    }));
  }
  let bank = load();
  window.VolleyQuestionBank = { list: () => bank.slice(), offline: true, role: cfg.role };

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importFile(onDone) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files[0]; if (!f) return;
      f.text().then((t) => { const list = clean(JSON.parse(t).questions || JSON.parse(t)); if (!list.length) throw new Error('empty'); bank = list; save(bank); onDone(true); })
        .catch(() => onDone(false));
    };
    input.click();
  }
  function mount() {
    const welcome = $('welcome');
    if (!welcome) return;
    const label = $('modeLabel');
    const note = () => { label.textContent = `نسخة دون اتصال (${cfg.role === 'teacher' ? 'المعلم' : 'الطالب'}) · ${bank.length} أسئلة · للتدريب فقط ولا تُسجَّل النتائج`; };
    const badge = $('demoBadge'); if (badge) badge.textContent = 'دون اتصال · تدريب فقط · لا تُسجَّل النتائج';
    const bar = document.createElement('div');
    bar.className = 'offline-tools';
    bar.innerHTML = cfg.role === 'teacher'
      ? '<button type="button" id="offEdit">تحرير الأسئلة</button><button type="button" id="offExport">تصدير ملف الأسئلة</button><button type="button" id="offImport">استيراد</button>'
      : '<button type="button" id="offImport">فتح ملف أسئلة من المعلم</button>';
    welcome.insertBefore(bar, $('start'));
    const panel = document.createElement('section');
    panel.id = 'offlineEditor'; panel.className = 'panel pop editor'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'تحرير الأسئلة');
    panel.innerHTML = '<h3>أسئلة الحصة (دون اتصال)</h3><p class="hint">سؤال في كل سطر: السؤال | خيار | *الإجابة الصحيحة | خيار — أو: السؤال | مقالي</p><textarea id="offText" rows="9" dir="rtl"></textarea><p class="hint" id="offMsg"></p><div class="row"><button type="button" id="offSave" class="primary">حفظ</button><button type="button" id="offReset">الأسئلة النموذجية</button><button type="button" data-close="offlineEditor">إغلاق</button></div>';
    document.getElementById('stadium').appendChild(panel);
    panel.querySelector('[data-close]').onclick = () => { panel.hidden = true; };
    const msg = (t) => { $('offMsg').textContent = t; };
    if ($('offEdit')) $('offEdit').onclick = () => { $('offText').value = toText(bank); msg(''); panel.hidden = false; $('offText').focus(); };
    if ($('offSave')) $('offSave').onclick = () => {
      const list = fromText($('offText').value);
      if (!list.length) { msg('لم يُعثر على أسئلة صالحة. حدّد الإجابة الصحيحة بنجمة *'); return; }
      bank = list; save(bank); note(); msg(`حُفظت ${list.length} أسئلة على هذا الجهاز.`);
    };
    if ($('offReset')) $('offReset').onclick = () => { bank = clean(cfg.questions); save(bank); $('offText').value = toText(bank); note(); msg('أعيدت الأسئلة النموذجية.'); };
    if ($('offExport')) $('offExport').onclick = () => download('volleyball-questions.json', JSON.stringify({ game: 'الكرة الطائرة', version: 24, questions: bank }, null, 2));
    if ($('offImport')) $('offImport').onclick = () => importFile((ok) => { note(); if (!ok) label.textContent = 'تعذّر قراءة الملف. تأكد أنه ملف أسئلة الكرة الطائرة.'; });
    note();
    const st = document.createElement('style');
    st.textContent = '.offline-tools{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 .7em}.offline-tools button{font-size:.82em;min-height:38px;padding:.4em .8em}.editor{width:min(560px,92vw);left:50%!important;transform:translateX(-50%);top:12%!important}.editor textarea{width:100%;font:inherit;background:#1e1017;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:.6em;resize:vertical;min-height:9em}.editor .row{display:flex;gap:8px;flex-wrap:wrap}';
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
