// لوحة المعلم: إدارة بنك الأسئلة (إضافة، تعديل، حذف، استيراد، تصدير) وقواعد اللعب.
import { $, esc, downloadText } from './ui.js';
import { validateBank, parseBankText, serializeBank, newId } from '../core/bank.js';
import { DEFAULT_RULES, LIMITS, APP_NAME, num, countQuestions, counted } from '../core/config.js';
import demoBank from '../data/demo-bank.json';

export class TeacherPanel {
  /** store: { bank, rules, saveBank(bank), saveRules(rules), persistent } */
  constructor(store, onClose) {
    this.store = store; this.onClose = onClose; this.editing = null; this.draftOptions = [];
    document.querySelectorAll('#scrTeacher .tab').forEach(t => t.addEventListener('click', () => this.tab(t.dataset.tab)));
    $('btnTeacherClose').addEventListener('click', () => this.close());
    $('btnAddQ').addEventListener('click', () => this.edit(null));
    $('btnCancelQ').addEventListener('click', () => this.closeForm());
    $('btnAddOpt').addEventListener('click', () => { if (this.draftOptions.length < LIMITS.maxOptions) { this.readDraft(); this.draftOptions.push({ id: this.optId(), text: '' }); this.renderOptions(); } });
    $('qForm').addEventListener('submit', e => { e.preventDefault(); this.saveQuestion(); });
    $('btnExport').addEventListener('click', () => downloadText(`${APP_NAME} - بنك الأسئلة.json`, serializeBank(this.store.bank)));
    $('btnImport').addEventListener('click', () => { $('fileImport').value = ''; $('fileImport').click(); });
    $('fileImport').addEventListener('change', e => this.importFile(e.target.files[0]));
    $('btnDemo').addEventListener('click', e => { if (this.confirmTwice(e.currentTarget, 'تأكيد: استبدال البنك الحالي')) { this.closeForm(); this.commit(validateBank(demoBank).bank); this.message('ok', 'أُعيدت الأسئلة التجريبية.'); } });
    $('bankTitle').addEventListener('change', () => { const b = this.store.bank; b.title = $('bankTitle').value.trim() || 'بنك أسئلة'; this.commit(b); });
    $('qList').addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.act === 'edit') this.edit(id);
      else if (b.dataset.act === 'del') this.remove(id, b);
    });
    const ruleIds = ['rHealth', 'rPenalty', 'rP1', 'rP2', 'rP3', 'rP4', 'rLimit', 'rFeedback', 'rShuffleO', 'rShuffleQ'];
    ruleIds.forEach(id => $(id).addEventListener('change', () => this.readRules()));
    $('btnRulesReset').addEventListener('click', () => { this.store.saveRules({ ...DEFAULT_RULES, points: DEFAULT_RULES.points.slice() }); this.renderRules(); });
  }

  open() { $('storeWarn').classList.toggle('hidden', this.store.persistent()); this.tab('tabBank'); this.closeForm(); this.render(); this.renderRules(); this.message(); }
  close() {
    if (!$('qForm').classList.contains('hidden')) {
      const m = $('qFormMsg'); m.className = 'msg'; m.textContent = 'لديك سؤال مفتوح لم يُحفظ. احفظه أو اضغط «إلغاء» ثم أغلق اللوحة.';
      $('qForm').scrollIntoView({ block: 'nearest' }); return;
    }
    this.onClose();
  }

  /** تأكيد بضغطتين: الأولى تغيّر نص الزر، والثانية خلال ٤ ثوانٍ تنفّذ. */
  confirmTwice(button, label) {
    if (button.dataset.armed === '1') { clearTimeout(button._t); button.dataset.armed = ''; button.textContent = button.dataset.label; return true; }
    button.dataset.label = button.textContent; button.dataset.armed = '1'; button.textContent = label;
    button._t = setTimeout(() => { button.dataset.armed = ''; button.textContent = button.dataset.label; }, 4000);
    return false;
  }
  tab(id) {
    document.querySelectorAll('#scrTeacher .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    $('tabBank').classList.toggle('hidden', id !== 'tabBank'); $('tabRules').classList.toggle('hidden', id !== 'tabRules');
  }

  message(kind, text, list) {
    const m = $('bankMsg');
    if (!text) { m.classList.add('hidden'); return; }
    m.className = 'msg' + (kind === 'ok' ? ' ok' : '');
    m.innerHTML = esc(text) + (list && list.length ? '<ul>' + list.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('') + (list.length > 12 ? `<li>… و${num(list.length - 12)} ملاحظات أخرى</li>` : '') + '</ul>' : '');
  }

  commit(bank) {
    const saved = this.store.saveBank(bank);
    $('storeWarn').classList.toggle('hidden', saved);
    this.render();
  }

  render() {
    const bank = this.store.bank;
    $('bankTitle').value = bank.title;
    $('qList').innerHTML = bank.questions.map(q => `<li><p>${esc(q.text)}<small>${counted(q.options.length, 'خيار واحد', 'خياران', 'خيارات', 'خيارًا')} — الصحيحة: ${esc((q.options.find(o => o.id === q.correctOptionId) || {}).text || '')}</small></p>
      <button class="btn small" data-act="edit" data-id="${esc(q.id)}">تعديل</button><button class="btn small ghost" data-act="del" data-id="${esc(q.id)}">حذف</button></li>`).join('');
  }

  optId() { let k = 0, id; do { id = 'o' + (++k); } while (this.draftOptions.some(o => o.id === id)); return id; }

  edit(id) {
    const q = id ? this.store.bank.questions.find(x => x.id === id) : null;
    this.editing = q ? q.id : null;
    $('qFormTitle').textContent = q ? 'تعديل السؤال' : 'سؤال جديد';
    $('qText').value = q ? q.text : ''; $('qExplain').value = q ? q.explanation : ''; $('qHint').value = q ? q.hint : ''; $('qSpeech').value = q ? q.speech : '';
    this.draftOptions = q ? q.options.map(o => ({ ...o })) : [];
    while (this.draftOptions.length < 4 && !q) this.draftOptions.push({ id: this.optId(), text: '' });
    this.draftCorrect = q ? q.correctOptionId : this.draftOptions[0].id;
    this.renderOptions(); $('qFormMsg').classList.add('hidden');
    $('qForm').classList.remove('hidden'); $('qForm').scrollIntoView({ block: 'nearest' }); $('qText').focus();
  }
  closeForm() { $('qForm').classList.add('hidden'); this.editing = null; }

  readDraft() {
    document.querySelectorAll('#qOptions .opt-row').forEach((row, i) => {
      if (!this.draftOptions[i]) return;
      this.draftOptions[i].text = row.querySelector('input[type=text]').value;
      if (row.querySelector('input[type=radio]').checked) this.draftCorrect = this.draftOptions[i].id;
    });
  }
  renderOptions() {
    $('qOptions').innerHTML = this.draftOptions.map((o, i) => `<div class="opt-row"><input type="radio" name="qCorrect" aria-label="الإجابة الصحيحة" ${o.id === this.draftCorrect ? 'checked' : ''}>
      <input type="text" maxlength="${LIMITS.maxOptionChars}" placeholder="الخيار ${num(i + 1)}" value="${esc(o.text)}">
      <button type="button" class="btn small ghost" data-rm="${i}" ${this.draftOptions.length <= LIMITS.minOptions ? 'disabled' : ''}>حذف</button></div>`).join('');
    $('qOptions').querySelectorAll('button[data-rm]').forEach(b => b.addEventListener('click', () => {
      this.readDraft(); const [gone] = this.draftOptions.splice(Number(b.dataset.rm), 1);
      if (gone.id === this.draftCorrect) this.draftCorrect = this.draftOptions[0].id;
      this.renderOptions();
    }));
    $('btnAddOpt').disabled = this.draftOptions.length >= LIMITS.maxOptions;
  }

  saveQuestion() {
    this.readDraft();
    const bank = this.store.bank;
    const q = {
      id: this.editing || newId(bank.questions.map(x => x.id)),
      text: $('qText').value, options: this.draftOptions.map(o => ({ id: o.id, text: o.text })),
      correctOptionId: this.draftCorrect, explanation: $('qExplain').value, hint: $('qHint').value, speech: $('qSpeech').value
    };
    const next = { ...bank, questions: this.editing ? bank.questions.map(x => (x.id === this.editing ? q : x)) : bank.questions.concat(q) };
    const v = validateBank(next);
    if (!v.ok) {
      const tag = `السؤال رقم ${num(next.questions.indexOf(q) + 1)}`;
      const mine = v.errors.filter(e => e.startsWith(tag + ':') || e.startsWith(tag + '،')).map(e => e.replace(tag + ': ', '').replace(tag + '، ', ''));
      const m = $('qFormMsg'); m.className = 'msg';
      m.innerHTML = 'لم يُحفظ السؤال:<ul>' + (mine.length ? mine : v.errors).map(e => `<li>${esc(e)}</li>`).join('') + '</ul>';
      return;
    }
    this.commit(v.bank); this.closeForm(); this.message('ok', 'حُفظ السؤال.');
  }

  remove(id, button) {
    const bank = this.store.bank;
    if (bank.questions.length <= 1) { this.message('err', 'لا يمكن حذف السؤال الأخير؛ يجب أن يحتوي البنك سؤالًا واحدًا على الأقل.'); return; }
    if (!this.confirmTwice(button, 'تأكيد الحذف')) return;
    this.commit({ ...bank, questions: bank.questions.filter(q => q.id !== id) });
    if (this.editing === id) this.closeForm();
  }

  async importFile(file) {
    if (!file) return;
    let text;
    try { text = await file.text(); } catch (e) { this.message('err', 'تعذّرت قراءة الملف.'); return; }
    const v = parseBankText(text);
    if (!v.ok) { this.message('err', `لم يُستورد الملف، وبقي البنك السابق كما هو. المشكلات (${num(v.errors.length)}):`, v.errors); return; }
    this.commit(v.bank); this.closeForm();
    this.message('ok', `تم استيراد «${v.bank.title}» وفيه ${countQuestions(v.bank.questions.length)}.` + (v.warnings.length ? ' ملاحظات:' : ''), v.warnings);
  }

  renderRules() {
    const r = this.store.rules;
    $('rHealth').value = r.startHealth; $('rPenalty').value = r.wrongPenalty;
    ['rP1', 'rP2', 'rP3', 'rP4'].forEach((id, i) => { $(id).value = r.points[i]; });
    $('rLimit').value = r.questionLimit; $('rFeedback').value = r.feedbackSeconds;
    $('rShuffleO').checked = r.shuffleOptions; $('rShuffleQ').checked = r.shuffleQuestions;
  }
  readRules() {
    const n = (id, lo, hi, d) => { const v = Number($(id).value); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    const D = DEFAULT_RULES;
    this.store.saveRules({
      startHealth: Math.round(n('rHealth', 20, 1000, D.startHealth)), wrongPenalty: Math.round(n('rPenalty', 0, 1000, D.wrongPenalty)),
      points: ['rP1', 'rP2', 'rP3', 'rP4'].map((id, i) => Math.round(n(id, 0, 10000, D.points[i]))),
      questionLimit: Math.round(n('rLimit', 0, 200, 0)), feedbackSeconds: n('rFeedback', 1, 8, D.feedbackSeconds),
      shuffleOptions: $('rShuffleO').checked, shuffleQuestions: $('rShuffleQ').checked
    });
    this.renderRules();
  }
}
