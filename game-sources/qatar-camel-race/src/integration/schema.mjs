class BridgeError extends Error {
  constructor(code, message, { retryable = false } = {}) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
const isStr = (v) => typeof v === "string" && v.length > 0;
function normalizeQuestion(raw, index) {
  if (!raw || typeof raw !== "object") throw new BridgeError("bad_question", `سؤال غير صالح رقم ${index + 1}`);
  const id = isStr(raw.id) ? raw.id : null;
  if (!id) throw new BridgeError("bad_question", `السؤال رقم ${index + 1} بلا معرّف`);
  const text = isStr(raw.text) ? raw.text : null;
  if (!text) throw new BridgeError("bad_question", `السؤال ${id} بلا نص`);
  let type = raw.type === "tf" || raw.type === "true_false" ? "tf" : "mcq";
  let choices = Array.isArray(raw.choices) ? raw.choices : [];
  if (type === "tf" && choices.length === 0) choices = [{ id: "true", text: "صواب" }, { id: "false", text: "خطأ" }];
  choices = choices.map((c, i) => {
    if (!c || !isStr(String(c.id ?? "")) || !isStr(c.text)) throw new BridgeError("bad_question", `اختيار غير صالح في السؤال ${id} (#${i + 1})`);
    return { id: String(c.id), text: c.text, media: c.media && typeof c.media === "object" ? sanitizeMedia(c.media) : null };
  });
  if (choices.length < 2) throw new BridgeError("bad_question", `السؤال ${id} يحتاج اختيارين على الأقل`);
  const ids = new Set(choices.map((c) => c.id));
  if (ids.size !== choices.length) throw new BridgeError("bad_question", `معرّفات اختيارات مكررة في السؤال ${id}`);
  return {
    id,
    type,
    text,
    subject: isStr(raw.subject) ? raw.subject : "",
    choices,
    media: raw.media && typeof raw.media === "object" ? sanitizeMedia(raw.media) : null,
    points: Number.isFinite(raw.points) ? raw.points : null
  };
}
function sanitizeMedia(m) {
  const out = {};
  const ok = (u) => isStr(u) && (/^https:\/\//i.test(u) || /^(\.{0,2}\/)?[\w\-./]+$/.test(u));
  if (ok(m.image) || isStr(m.image) && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(m.image)) out.image = m.image;
  if (isStr(m.alt)) out.alt = m.alt;
  if (ok(m.audio)) out.audio = m.audio;
  return out;
}
function normalizeGrade(raw) {
  if (!raw || typeof raw !== "object") throw new BridgeError("bad_grade", "نتيجة تصحيح غير صالحة", { retryable: true });
  const status = raw.status === "pending" ? "pending" : raw.status === "graded" ? "graded" : null;
  if (!status) throw new BridgeError("bad_grade", "حالة تصحيح غير معروفة", { retryable: true });
  if (status === "pending") return { status };
  if (typeof raw.correct !== "boolean") throw new BridgeError("bad_grade", "نتيجة التصحيح بلا قيمة صحيح/خطأ", { retryable: true });
  return {
    status,
    correct: raw.correct,
    points: Number.isFinite(raw.points) ? raw.points : 0,
    correctChoiceId: raw.correctChoiceId != null ? String(raw.correctChoiceId) : null,
    explanation: isStr(raw.explanation) ? raw.explanation : ""
  };
}
function makeId(prefix) {
  const rnd = typeof crypto !== "undefined" && crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("") : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `${prefix}-${rnd}`;
}
export {
  BridgeError,
  makeId,
  normalizeGrade,
  normalizeQuestion
};
