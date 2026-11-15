// الواجهات العربية: الشاشات، واجهة اللعب، والإعدادات. لا منطق لعب هنا.
import { num, APP_NAME, countMistakes, counted } from '../core/config.js';

export const $ = id => document.getElementById(id);
const SCREENS = ['scrLoading', 'scrStart', 'scrHow', 'scrSettings', 'scrPause', 'scrFail', 'scrEnd', 'scrTeacher'];

export function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export class UI {
  constructor() {
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.isTouch);
    $('fireL').classList.toggle('hidden', !this.isTouch); $('fireR').classList.toggle('hidden', !this.isTouch);
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { this.hide(b.dataset.close); this.onClose && this.onClose(b.dataset.close); }));
    // النقر داخل القوائم لا يصل إلى مساحة اللعب
    SCREENS.concat('scrRotate').forEach(id => $(id).addEventListener('pointerdown', e => e.stopPropagation()));
  }

  show(id) { $(id).classList.remove('hidden'); }
  hide(id) { $(id).classList.add('hidden'); }
  only(id) { SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id)); }
  visible(id) { return !$(id).classList.contains('hidden'); }
  anyScreen() { return SCREENS.some(s => this.visible(s)) || this.visible('scrRotate'); }

  setLoading(p, text) {
    const pct = Math.round(Math.max(0, Math.min(1, p)) * 100);
    $('loadFill').style.width = pct + '%'; $('loadPct').textContent = num(pct) + '٪';
    if (text) $('loadText').textContent = text;
  }

  fade(on) { $('fade').classList.toggle('on', on); }

  toast(msg, ms = 4200) { notify(msg, ms); }

  // ---------- واجهة اللعب ----------
  showHud(on) { $('hud').classList.toggle('hidden', !on); }

  setHealth(h, max, hit = false) {
    const r = max ? h / max : 0;
    $('healthFill').style.width = Math.round(r * 100) + '%'; $('healthNum').textContent = num(h);
    const box = $('healthBox');
    box.classList.toggle('low', r <= 0.34); box.classList.toggle('mid', r > 0.34 && r <= 0.67);
    if (hit) { box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit'); const d = $('damage'); d.classList.add('on'); setTimeout(() => d.classList.remove('on'), 90); }
  }
  setScore(n) { $('scoreNum').textContent = num(n); }

  setMission(index, total) {
    $('missionLabel').textContent = `المهمة ${num(Math.min(index + 1, total))} من ${num(total)}`;
    const p = $('progress');
    if (p.children.length !== total) p.innerHTML = Array.from({ length: total }, () => '<i></i>').join('');
    [...p.children].forEach((el, i) => { el.className = i < index ? 'done' : i === index ? 'now' : ''; });
  }

  setQuestion(text) {
    const el = $('question'); el.style.fontSize = ''; el.textContent = text;
    // النص الطويل يُصغَّر تدريجيًا حتى حدّ أدنى مقروء حتى لا تغطي لوحة السؤال الأهداف
    const maxH = window.innerHeight * 0.24;
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollHeight > maxH && size > 15) { size -= 1; el.style.fontSize = size + 'px'; }
  }

  feedback(kind, title, text) {
    const f = $('feedback'); f.className = 'feedback ' + (kind === 'ok' ? 'ok' : 'no');
    $('fbTitle').textContent = title; $('fbText').textContent = text || '';
    void f.offsetWidth;
  }
  clearFeedback() { $('feedback').classList.add('hidden'); }

  aimed(board) {
    const a = $('aimed');
    if (!board || !board.optionId) { a.classList.add('hidden'); $('crosshair').classList.remove('on'); return; }
    if (this._aimed !== board.optionId + board.text) { $('aimedNum').textContent = num(board.badge); $('aimedText').textContent = board.text; this._aimed = board.optionId + board.text; }
    a.classList.remove('hidden'); $('crosshair').classList.add('on');
  }

  hitmark() { const h = $('hitmark'); h.classList.remove('show'); void h.offsetWidth; h.classList.add('show'); }

  // ---------- شاشات النتائج ----------
  renderFail(summary, mission, index) {
    $('failSummary').textContent = `نفدت الصحة في المهمة ${num(index + 1)} من ${num(summary.total)}. نقاطك حتى الآن: ${num(summary.score)}.`;
    $('failQuestion').textContent = mission.question.text;
    const wrong = mission.wrong.map(id => (mission.question.options.find(o => o.id === id) || {}).text).filter(Boolean);
    $('failWrong').textContent = wrong.length ? `إجابات جرّبتَها وليست صحيحة: ${wrong.join('، ')}.` : 'لم تجرّب أي إجابة في هذا السؤال بعد.';
    $('failHint').textContent = mission.question.hint ? `تلميح: ${mission.question.hint}` : '';
  }

  renderEnd(r, name) {
    $('endName').textContent = name ? `أحسنت يا ${name}، أنهيت جميع محطات ${APP_NAME}.` : `أنهيت جميع محطات ${APP_NAME}.`;
    const cards = [
      [num(r.score), `النقاط من ${num(r.maxScore)}`],
      [num(r.firstTryPercent) + '٪', `صحيحة من المحاولة الأولى (${num(r.firstTry)} من ${num(r.total)})`],
      [num(r.mistakes), 'عدد الأخطاء'],
      [`${num(r.completed)}/${num(r.total)}`, 'المهمات المكتملة']
    ];
    $('endCards').innerHTML = cards.map(([b, s]) => `<div class="card"><b>${b}</b><span>${s}</span></div>`).join('');
    let v;
    if (r.firstTryPercent === 100) v = 'أداء متقن: أجبت عن كل الأسئلة من المحاولة الأولى.';
    else if (r.firstTryPercent >= 80) v = 'أداء ممتاز. راجع الأسئلة القليلة التي أخطأت فيها لتبلغ الإتقان.';
    else if (r.firstTryPercent >= 50) v = 'أداء جيد. راجع تفسير الأسئلة التي احتجت فيها إلى أكثر من محاولة ثم أعد اللعب.';
    else v = 'وصلت إلى النهاية، وهذا جهد يُحسب لك. راجع تفسير الإجابات بهدوء ثم حاول مرة أخرى.';
    if (r.retries > 0) v += ` استكملت بعد نفاد الصحة ${counted(r.retries, 'مرة واحدة', 'مرتين', 'مرات', 'مرة')}.`;
    $('endVerdict').textContent = v;
    $('endReview').innerHTML = r.missions.map(m => `<li>${esc(m.text)}<small>الإجابة الصحيحة: ${esc(m.correctText)} — ${m.wrong === 0 ? 'من المحاولة الأولى' : `بعد ${countMistakes(m.wrong)}`} — ${num(m.points)} نقطة</small></li>`).join('');
  }

  // ---------- الإعدادات ----------
  bindSettings(prefs, onChange) {
    const map = [['setQuality', 'quality', 'value'], ['setSfxOn', 'sfxOn', 'checked'], ['setSfxVol', 'sfxVolume', 'value'], ['setAmbOn', 'ambienceOn', 'checked'], ['setAmbVol', 'ambienceVolume', 'value'],
      ['setSpeechOn', 'speechOn', 'checked'], ['setSpeechVol', 'speechVolume', 'value'], ['setSens', 'sensitivity', 'value'], ['setReduce', 'reduceMotion', 'checked']];
    this.syncSettings = () => map.forEach(([id, key, prop]) => { $(id)[prop] = prefs[key]; });
    this.syncSettings();
    map.forEach(([id, key, prop]) => $(id).addEventListener('input', () => {
      const el = $(id); prefs[key] = prop === 'checked' ? el.checked : (el.type === 'range' ? Number(el.value) : el.value);
      onChange(key);
    }));
  }
}

export function notify(msg, ms = 4200) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => t.classList.add('hidden'), ms);
}

/** تنزيل نص كملف (للتصدير). داخل إطار قد يمنع التنزيل ننسخ النص إلى الحافظة أيضًا. */
export function downloadText(filename, text, type = 'application/json', bom = false) {
  const blob = new Blob([(bom ? '\uFEFF' : '') + text], { type: type + ';charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  if (window.parent !== window && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => notify('إن لم يبدأ التنزيل في وضع المعاينة: نُسخ المحتوى إلى الحافظة.'), () => {});
  }
}
