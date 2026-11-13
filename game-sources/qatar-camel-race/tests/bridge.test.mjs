import { normalizeQuestion, normalizeGrade, BridgeError } from "../src/integration/schema.mjs";
import { LocalSimulatorBridge } from "../src/integration/localSimulatorBridge.mjs";
import { PostMessageBridge } from "../src/integration/postMessageBridge.mjs";
let pass = 0, fail = 0;
const check = (c, m) => {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", m);
  }
};
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch (e) {
    return e instanceof BridgeError;
  }
};
const config = {
  gameId: "qatar-camel-race",
  questions: { maxQuestions: 6, pointsPerCorrect: 10 },
  integration: { gameId: "qatar-camel-race", protocol: "qcr-bridge/1", allowedOrigins: ["https://platform.example"], handshakeTimeoutMs: 300, gradeTimeoutMs: 300 }
};
const q = normalizeQuestion({ id: "q1", text: "س", choices: [{ id: "a", text: "١" }, { id: "b", text: "٢" }], correctChoiceId: "a", answer: "a" }, 0);
check(!("correctChoiceId" in q) && !("answer" in q), "answer key fields are stripped from questions");
check(throws(() => normalizeQuestion({ id: "q", text: "x", choices: [{ id: "a", text: "1" }, { id: "a", text: "2" }] }, 0)), "duplicate choice ids rejected");
check(throws(() => normalizeQuestion({ text: "x", choices: [] }, 0)), "missing id rejected");
check(normalizeQuestion({ id: "t", type: "tf", text: "x" }, 0).choices.length === 2, "tf gets default choices");
check(normalizeQuestion({ id: "m", text: "x", media: { image: "javascript:alert(1)" }, choices: [{ id: "a", text: "1" }, { id: "b", text: "2" }] }, 0).media.image === void 0, "unsafe media url dropped");
check(normalizeGrade({ status: "pending" }).status === "pending", "pending grade normalized");
check(throws(() => normalizeGrade({ status: "graded" })), "graded without correct flag rejected");
{
  const src = { questions: [{ id: "q1", text: "x", choices: [{ id: "a", text: "1" }, { id: "b", text: "2" }] }], answerKey: { q1: { correctChoiceId: "b", explanation: "e" } } };
  const br = new LocalSimulatorBridge({ source: src, config, simSpec: "fail:1" });
  let err = null;
  try {
    await br.submitAnswer({ questionId: "q1", choiceId: "b", attemptId: "A1" });
  } catch (e) {
    err = e;
  }
  check(err && err.retryable, "local sim fail:1 → retryable error");
  const g1 = await br.submitAnswer({ questionId: "q1", choiceId: "b", attemptId: "A1" });
  const g2 = await br.submitAnswer({ questionId: "q1", choiceId: "a", attemptId: "A1" });
  check(g1.correct && g2 === g1, "same attemptId returns the first grade (no double registration)");
  const r1 = await br.reportResult({ resultId: "R1" });
  const r2 = await br.reportResult({ resultId: "R1" });
  check(r1.status === "saved" && r2.status === "duplicate", "result saved once");
  const brP = new LocalSimulatorBridge({ source: src, config, simSpec: "pending:1" });
  const late = new Promise((res) => brP.onGrade(res));
  const gp = await brP.submitAnswer({ questionId: "q1", choiceId: "a", attemptId: "P1" });
  check(gp.status === "pending", "pending returned first");
  const lg = await late;
  check(lg.attemptId === "P1" && lg.correct === false, "late grade delivered through onGrade");
  br.dispose();
  brP.dispose();
}
function makeEnv() {
  const listeners = [];
  const sent = [];
  const parent = { postMessage: (msg, origin) => sent.push({ msg, origin }) };
  const self = { location: { origin: "https://game.example" }, addEventListener: (t, f) => listeners.push(f), removeEventListener: () => {
  } };
  const deliver = (data, origin = "https://platform.example", source = parent) => listeners.forEach((f) => f({ data, origin, source }));
  return { parent, self, sent, deliver };
}
{
  const env = makeEnv();
  const br = new PostMessageBridge({ config, target: env.parent, self: env.self });
  const initP = br.init();
  check(env.sent[0].msg.type === "game:ready" && env.sent[0].origin === "https://platform.example", "ready sent to the configured origin (never *)");
  env.deliver({ gameId: "qatar-camel-race", protocol: "qcr-bridge/1", type: "platform:init", payload: { sessionId: "EVIL" } }, "https://evil.example");
  env.deliver({ gameId: "qatar-camel-race", protocol: "qcr-bridge/1", type: "platform:init", payload: { sessionId: "EVIL2" } }, "https://platform.example", {});
  env.deliver({ protocol: "other", type: "platform:init", payload: { sessionId: "EVIL3" } });
  env.deliver({ gameId: "qatar-camel-race", protocol: "qcr-bridge/1", type: "platform:init", sessionId: "S1", payload: { sessionId: "S1", mode: "classroom", player: { teamName: "الصقور" }, questions: [{ id: "p1", text: "x", choices: [{ id: "a", text: "1" }, { id: "b", text: "2" }] }] } });
  const s = await initP;
  check(s.sessionId === "S1" && s.mode === "classroom", "init accepted only from allowed origin + parent window");
  const qs = await br.getQuestions();
  check(qs.length === 1 && qs[0].id === "p1", "questions from init payload");
  const gP = br.submitAnswer({ questionId: "p1", choiceId: "a", attemptId: "AT1" });
  const sub = env.sent.find((x) => x.msg.type === "game:submitAnswer");
  check(sub.msg.requestId === "AT1" && sub.msg.payload.attemptId === "AT1", "submit carries attemptId as requestId");
  env.deliver({ gameId: "qatar-camel-race", protocol: "qcr-bridge/1", type: "platform:grade", sessionId: "S1", requestId: "AT1", payload: { status: "graded", correct: true, points: 10, correctChoiceId: "a" } });
  const g = await gP;
  check(g.correct && g.points === 10, "grade received");
  let te = null;
  try {
    await br.submitAnswer({ questionId: "p1", choiceId: "b", attemptId: "AT2" });
  } catch (e) {
    te = e;
  }
  check(te && te.code === "timeout" && te.retryable, "timeout → retryable error (no local fallback)");
  const lateP = new Promise((res) => br.onGrade(res));
  env.deliver({ gameId: "qatar-camel-race", protocol: "qcr-bridge/1", type: "platform:grade", sessionId: "S1", requestId: "late-AT2", payload: { status: "graded", attemptId: "AT2", correct: false, points: 0 } });
  const lg = await lateP;
  check(lg.attemptId === "AT2" && lg.correct === false, "late grade after pending/timeout delivered");
  let gotControl = 0;
  br.onControl(() => gotControl++);
  env.deliver({ gameId: "qatar-camel-race", protocol: "qcr-bridge/1", type: "platform:control", sessionId: "OTHER", payload: { command: "pause" } });
  env.deliver({ gameId: "qatar-camel-race", protocol: "qcr-bridge/1", type: "platform:control", sessionId: "S1", payload: { command: "pause" } });
  check(gotControl === 1, "messages for another session ignored");
  const rP = br.reportResult({ resultId: "RES1", rank: 1 });
  env.deliver({ gameId: "qatar-camel-race", protocol: "qcr-bridge/1", type: "platform:ack", sessionId: "S1", requestId: "RES1", payload: { status: "saved" } });
  check((await rP).status === "saved", "result ack");
  br.dispose();
}
{
  const env = makeEnv();
  const br = new PostMessageBridge({ config, target: env.parent, self: env.self });
  let e = null;
  try {
    await br.init();
  } catch (x) {
    e = x;
  }
  check(e && e.code === "timeout", "handshake timeout when no platform answers");
  br.dispose();
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
