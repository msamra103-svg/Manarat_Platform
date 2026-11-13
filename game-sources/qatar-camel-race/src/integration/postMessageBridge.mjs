import { BridgeError, normalizeQuestion, normalizeGrade, makeId } from "./schema.mjs";
class PostMessageBridge {
  constructor({ config, target = window.parent, self = window }) {
    this.mode = "platform";
    this.label = "المنصة";
    this.cfg = config.integration;
    this.gameId = config.gameId;
    this.target = target;
    this.self = self;
    this.allowed = this.cfg.allowedOrigins && this.cfg.allowedOrigins.length ? this.cfg.allowedOrigins.slice() : [self.location.origin];
    this.targetOrigin = this.allowed[0];
    this.sessionId = null;
    this.pending = /* @__PURE__ */ new Map();
    this.gradeListeners = /* @__PURE__ */ new Set();
    this.controlListeners = /* @__PURE__ */ new Set();
    this.questions = null;
    this.initPayload = null;
    this._onMessage = this._onMessage.bind(this);
    self.addEventListener("message", this._onMessage);
  }
  _send(type, payload = {}, requestId = void 0) {
    const msg = { protocol: this.cfg.protocol, gameId: this.gameId, type, sessionId: this.sessionId, requestId, payload, sentAt: Date.now() };
    try {
      this.target.postMessage(msg, this.targetOrigin);
    } catch (e) {
      throw new BridgeError("network", "تعذر إرسال الرسالة إلى المنصة", { retryable: true });
    }
  }
  _onMessage(ev) {
    if (!this.allowed.includes(ev.origin)) return;
    if (ev.source !== this.target) return;
    const m = ev.data;
    if (!m || typeof m !== "object" || Array.isArray(m) || m.protocol !== this.cfg.protocol || m.gameId !== this.gameId || typeof m.type !== "string") return;
    if (m.payload != null && (typeof m.payload !== "object" || Array.isArray(m.payload))) return;
    if (this.sessionId && (m.sessionId !== this.sessionId || m.type === "platform:init")) return;
    if (!this.sessionId && m.type !== "platform:init") return;
    const p = m.payload || {};
    switch (m.type) {
      case "platform:init": {
        if (!isStr(p.sessionId) || m.sessionId !== p.sessionId) return;
        this.sessionId = p.sessionId;
        this.initPayload = p;
        this._resolve("init", p);
        break;
      }
      case "platform:questions": {
        this._resolve(m.requestId || "questions", p);
        break;
      }
      case "platform:grade": {
        const req = this.pending.get(m.requestId);
        let grade;
        try {
          grade = normalizeGrade(p);
        } catch (e) {
          if (req) {
            this._reject(m.requestId, e);
          }
          return;
        }
        if (req) this._resolve(m.requestId, grade);
        else if (grade.status === "graded") {
          this.gradeListeners.forEach((cb) => cb({ attemptId: p.attemptId || m.requestId, questionId: p.questionId, ...grade }));
        }
        break;
      }
      case "platform:ack": {
        this._resolve(m.requestId, p);
        break;
      }
      case "platform:error": {
        this._reject(m.requestId, new BridgeError(p.code || "platform_error", p.message || "خطأ من المنصة", { retryable: p.retryable !== false }));
        break;
      }
      case "platform:control": {
        if (["pause", "resume", "restart", "end"].includes(p.command)) this.controlListeners.forEach((cb) => cb(p.command));
        break;
      }
      default:
    }
  }
  _await(requestId, kind, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new BridgeError("timeout", "انتهت مهلة الاتصال بالمنصة", { retryable: true }));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer, kind });
    });
  }
  _resolve(id, value) {
    const p = this.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(id);
    p.resolve(value);
  }
  _reject(id, err) {
    const p = this.pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(id);
    p.reject(err);
  }
  async init() {
    const wait = this._await("init", "init", this.cfg.handshakeTimeoutMs);
    this._send("game:ready", { gameId: this.gameId, version: "1.0.0", capabilities: ["mcq", "tf", "pendingGrade", "control", "classroom"] });
    const p = await wait;
    return {
      sessionId: p.sessionId,
      mode: p.mode === "classroom" ? "classroom" : p.mode === "solo" ? "solo" : null,
      player: p.player && typeof p.player === "object" ? { name: str(p.player.name), teamName: str(p.player.teamName), students: Array.isArray(p.player.students) ? p.player.students.filter(isStr).slice(0, 60) : [] } : null,
      settings: p.settings && typeof p.settings === "object" ? p.settings : {},
      questions: Array.isArray(p.questions) ? p.questions : null
    };
  }
  async getQuestions() {
    let list = this.initPayload?.questions;
    if (!Array.isArray(list)) {
      const rid = makeId("q");
      const wait = this._await(rid, "questions", this.cfg.handshakeTimeoutMs);
      this._send("game:requestQuestions", {}, rid);
      const p = await wait;
      list = p.questions;
    }
    if (!Array.isArray(list) || list.length === 0) throw new BridgeError("no_questions", "لم ترسل المنصة أسئلة لهذه الجلسة.");
    return list.map((q, i) => normalizeQuestion(q, i));
  }
  // requestId = attemptId حتى تتمكن المنصة من رفض التكرار عند إعادة الإرسال
  async submitAnswer({ questionId, choiceId, attemptId, timedOut, questionIndex }) {
    const wait = this._await(attemptId, "grade", this.cfg.gradeTimeoutMs);
    this._send("game:submitAnswer", { questionId, choiceId, attemptId, timedOut: !!timedOut, questionIndex }, attemptId);
    return wait;
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
    try {
      this._send("game:progress", progress);
    } catch {
    }
  }
  async reportResult(result) {
    const wait = this._await(result.resultId, "result", this.cfg.gradeTimeoutMs);
    this._send("game:result", result, result.resultId);
    return wait;
  }
  async requestRestart() {
    const id = makeId("restart");
    const wait = this._await(id, "restart", this.cfg.gradeTimeoutMs);
    this._send("game:restart", {}, id);
    return wait;
  }
  requestExit() {
    try {
      this._send("game:exit", {});
    } catch {
    }
    return true;
  }
  dispose() {
    this.self.removeEventListener("message", this._onMessage);
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
    }
    this.pending.clear();
    this.gradeListeners.clear();
    this.controlListeners.clear();
  }
}
function isStr(v) {
  return typeof v === "string" && v.length > 0;
}
function str(v) {
  return typeof v === "string" ? v.slice(0, 60) : "";
}
export {
  PostMessageBridge
};
