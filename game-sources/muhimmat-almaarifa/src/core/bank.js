// بنك الأسئلة: تحقّق، تطبيع، استيراد وتصدير. لا يعتمد على المتصفح حتى يمكن اختباره في Node.
import { BANK_FORMAT, LIMITS, num } from './config.js';

const clean = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** صيغة موحّدة للمقارنة: بلا تشكيل ولا تطويل، مع توحيد الهمزات والأرقام. */
export function comparable(text) {
  return clean(text)
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[.,،؛:!؟?"'«»()\-]/g, '')
    .toLowerCase();
}

/**
 * يتحقق من بيانات بنك (كائن فيه questions أو مصفوفة أسئلة مباشرة).
 * يعيد { ok, errors[], warnings[], bank } — النصوص بالعربية وجاهزة للعرض.
 */
export function validateBank(input) {
  const errors = [], warnings = [];
  let data = input;
  if (Array.isArray(input)) data = { questions: input };
  if (!data || typeof data !== 'object' || !Array.isArray(data.questions)) {
    return { ok: false, errors: ['الملف لا يحتوي قائمة أسئلة. المطلوب كائن فيه الحقل «questions».'], warnings, bank: null };
  }
  if (data.questions.length === 0) errors.push('البنك فارغ: أضف سؤالًا واحدًا على الأقل.');
  if (data.questions.length > LIMITS.maxQuestions) errors.push(`عدد الأسئلة يتجاوز الحد الأقصى (${num(LIMITS.maxQuestions)}).`);

  const seenIds = new Set();
  const questions = [];
  data.questions.forEach((raw, i) => {
    const label = `السؤال رقم ${num(i + 1)}`;
    if (!raw || typeof raw !== 'object') { errors.push(`${label}: بيانات غير صالحة.`); return; }
    const q = {
      id: clean(String(raw.id ?? '')),
      text: clean(raw.text),
      options: [],
      correctOptionId: clean(String(raw.correctOptionId ?? '')),
      explanation: clean(raw.explanation),
      hint: clean(raw.hint),
      speech: clean(raw.speech)
    };
    if (!q.id) errors.push(`${label}: المعرّف «id» مفقود.`);
    else if (seenIds.has(q.id)) errors.push(`${label}: المعرّف «${q.id}» مكرر في سؤال آخر.`);
    seenIds.add(q.id);
    if (!q.text) errors.push(`${label}: نص السؤال فارغ.`);
    else if (q.text.length > LIMITS.maxQuestionChars) errors.push(`${label}: نص السؤال أطول من ${num(LIMITS.maxQuestionChars)} حرفًا (${num(q.text.length)}).`);

    const opts = Array.isArray(raw.options) ? raw.options : [];
    if (opts.length < LIMITS.minOptions || opts.length > LIMITS.maxOptions) {
      errors.push(`${label}: عدد الخيارات ${num(opts.length)}، والمسموح من ${num(LIMITS.minOptions)} إلى ${num(LIMITS.maxOptions)}.`);
    }
    const optIds = new Set(), optTexts = new Set();
    opts.forEach((o, k) => {
      const ol = `${label}، الخيار ${num(k + 1)}`;
      const opt = { id: clean(String(o?.id ?? '')), text: clean(o?.text) };
      if (!opt.id) errors.push(`${ol}: المعرّف «id» مفقود.`);
      else if (optIds.has(opt.id)) errors.push(`${ol}: المعرّف «${opt.id}» مكرر داخل السؤال.`);
      optIds.add(opt.id);
      if (!opt.text) errors.push(`${ol}: نص الخيار فارغ.`);
      else {
        if (opt.text.length > LIMITS.maxOptionChars) errors.push(`${ol}: النص أطول من ${num(LIMITS.maxOptionChars)} حرفًا (${num(opt.text.length)}) ولن يظهر كاملًا على الهدف.`);
        const key = comparable(opt.text);
        if (optTexts.has(key)) errors.push(`${ol}: النص «${opt.text}» مكرر أو مطابق لخيار آخر في السؤال نفسه.`);
        optTexts.add(key);
      }
      q.options.push(opt);
    });
    if (!q.correctOptionId) errors.push(`${label}: لم تُحدَّد الإجابة الصحيحة «correctOptionId».`);
    else if (q.options.filter(o => o.id === q.correctOptionId).length !== 1) {
      errors.push(`${label}: معرّف الإجابة الصحيحة «${q.correctOptionId}» لا يطابق خيارًا واحدًا من الخيارات.`);
    }
    if (!q.explanation) warnings.push(`${label}: لا يوجد تفسير للإجابة.`);
    questions.push(q);
  });

  const bank = {
    format: BANK_FORMAT,
    version: 1,
    title: clean(data.title) || 'بنك أسئلة',
    questions
  };
  return { ok: errors.length === 0, errors, warnings, bank: errors.length === 0 ? bank : null };
}

/** يحلّل نص JSON ويتحقق منه. لا يرمي استثناءً. */
export function parseBankText(text) {
  let data;
  try {
    data = JSON.parse(String(text).replace(/^﻿/, ''));
  } catch (e) {
    return { ok: false, errors: ['تعذّرت قراءة الملف: الصيغة ليست JSON سليمة. تأكد من الأقواس والفواصل وعلامات التنصيص.'], warnings: [], bank: null };
  }
  return validateBank(data);
}

export function serializeBank(bank) {
  const out = {
    format: BANK_FORMAT, version: 1, title: bank.title,
    questions: bank.questions.map(q => {
      const o = { id: q.id, text: q.text, options: q.options.map(x => ({ id: x.id, text: x.text })), correctOptionId: q.correctOptionId, explanation: q.explanation };
      if (q.hint) o.hint = q.hint;
      if (q.speech) o.speech = q.speech;
      return o;
    })
  };
  return JSON.stringify(out, null, 2);
}

/** معرّف جديد غير مستخدم في البنك. */
export function newId(existing, prefix = 'q') {
  const used = new Set(existing);
  let n = used.size + 1, id;
  do { id = `${prefix}-${String(n++).padStart(3, '0')}`; } while (used.has(id));
  return id;
}
