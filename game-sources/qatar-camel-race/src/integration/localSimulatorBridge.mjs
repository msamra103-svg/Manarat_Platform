import { BridgeError, normalizeQuestion, makeId } from "./schema.mjs";
class LocalSimulatorBridge {
  constructor({ source, config, simSpec = "" }) {
    this.mode = "local";
    this.label = "محاكي محلي (بيانات تجريبية)";
    this.source = source;
    this.config = config;
    this.sim = parseSim(simSpec);
    this.failuresLeft = this.sim.fail;
    this.gradeListeners = /* @__PURE__ */ new Set();
    this.controlListeners = /* @__PURE__ */ new Set();
    this.graded = /* @__PURE__ */ new Map();
    this.savedResults = /* @__PURE__ */ new Map();
    this.progressLog = [];
    this.timers = /* @__PURE__ */ new Set();
  }
  async init() {
    await this._delay(this.sim.latency * 0.3);
    return { sessionId: makeId("local"), mode: null, player: null, settings: {} };
  }
  async getQuestions() {
    const src = this.source;
    if (!src || !Array.isArray(src.questions) || src.questions.length === 0) {
      throw new BridgeError("no_questions", "لا توجد أسئلة. أضف أسئلة في questions.sample.js أو اربط اللعبة بالمنصة.");
    }
    const max = this.config.questions.maxQuestions;
    return src.questions.slice(0, max).map((q, i) => normalizeQuestion(q, i));
  }
  // تصحيح محلي بالمفتاح التجريبي، مع منع التكرار حسب معرّف المحاولة
  async submitAnswer({ questionId, choiceId, attemptId, timedOut }) {
    if (this.graded.has(attemptId)) return this.graded.get(attemptId);
    await this._delay(this.sim.latency);
    if (this.failuresLeft > 0) {
      this.failuresLeft--;
      throw new BridgeError("network", "تعذر الاتصال بخدمة التصحيح (محاكاة).", { retryable: true });
    }
    const key = this.source.answerKey?.[questionId];
    if (!key) throw new BridgeError("no_key", `لا يوجد مفتاح إجابة تجريبي للسؤال ${questionId}`);
    const correct = !timedOut && choiceId === key.correctChoiceId;
    const result = {
      status: "graded",
      correct,
      points: correct ? this.config.questions.pointsPerCorrect ?? 10 : 0,
      correctChoiceId: key.correctChoiceId,
      explanation: key.explanation || ""
    };
    if (this.sim.pending) {
      const t = setTimeout(() => {
        this.timers.delete(t);
        this.graded.set(attemptId, result);
        this.gradeListeners.forEach((cb) => cb({ attemptId, questionId, ...result }));
      }, Math.max(800, this.sim.latency * 2));
      this.timers.add(t);
      return { status: "pending" };
    }
    this.graded.set(attemptId, result);
    return result;
  }
  onGrade(cb) {
    this.gradeListeners.add(cb);
    return () => this.gradeListeners.delete(cb);
  }
  onControl(cb) {
    this.controlListeners.add(cb);
    return () => this.controlListeners.delete(cb);
  }
  reportProgress(progress) {
    this.progressLog.push({ at: Date.now(), ...progress });
    if (this.progressLog.length > 200) this.progressLog.shift();
  }
  async reportResult(result) {
    if (this.savedResults.has(result.resultId)) return { status: "duplicate" };
    await this._delay(this.sim.latency * 0.5);
    this.savedResults.set(result.resultId, result);
    try {
      localStorage.setItem("qcr:lastResult", JSON.stringify(result));
    } catch {
    }
    return { status: "saved" };
  }
  requestExit() {
    return false;
  }
  _delay(ms) {
    if (!ms) return Promise.resolve();
    return new Promise((res) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        res();
      }, ms);
      this.timers.add(t);
    });
  }
  dispose() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.gradeListeners.clear();
    this.controlListeners.clear();
  }
}
function parseSim(spec) {
  const out = { latency: 0, fail: 0, pending: false };
  if (!spec) return out;
  for (const part of spec.split(",")) {
    const [k, v] = part.split(":");
    if (k === "latency") out.latency = Math.max(0, Number(v) || 0);
    if (k === "fail") out.fail = Math.max(0, Number(v) || 0);
    if (k === "pending") out.pending = v !== "0";
  }
  return out;
}
export {
  LocalSimulatorBridge
};
