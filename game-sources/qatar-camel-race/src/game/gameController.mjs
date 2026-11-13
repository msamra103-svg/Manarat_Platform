import { createRaceModel } from "../race/raceModel.mjs";
import { SceneManager } from "../scene/sceneManager.mjs";
import { AudioEngine } from "../audio/audioEngine.mjs";
import { UI, ar, ordinal } from "../ui/ui.mjs";
import { createBridge } from "../integration/index.mjs";
import { makeId } from "../integration/schema.mjs";
import { createRng, hashString } from "../core/random.mjs";
import { cleanPlayerName, DEFAULT_PLAYER_NAME } from "../race/names.mjs";
import { GAME_ID, GAME_TITLE, GAME_VERSION } from "../config/config.mjs";
const STATES = {
  LOADING: "loading",
  READY: "ready",
  INTRO: "intro",
  COUNTDOWN: "countdown",
  RUNNING: "running",
  QUESTION: "question",
  AWAITING_GRADE: "awaitingGrade",
  FEEDBACK: "feedback",
  FINISHING: "finishing",
  RESULTS: "results",
  PAUSED: "paused",
  ERROR: "error"
};
const RACE_STATES = /* @__PURE__ */ new Set([STATES.INTRO, STATES.COUNTDOWN, STATES.RUNNING, STATES.QUESTION, STATES.AWAITING_GRADE, STATES.FEEDBACK, STATES.FINISHING]);
class GameController {
  constructor(root, config, flags) {
    this.root = root;
    this.config = config;
    this.flags = flags;
    this.ui = new UI(root);
    this.state = STATES.LOADING;
    this.paused = false;
    this.timers = /* @__PURE__ */ new Set();
    this.raceCount = 0;
    this.rafId = null;
    this.rafLoops = 0;
    this.listeners = [];
    this.settings = {
      mode: config.mode.default,
      playerName: DEFAULT_PLAYER_NAME,
      teamName: "",
      students: [],
      difficulty: config.race.difficulty,
      segmentSeconds: config.race.segmentSeconds,
      timer: config.questions.answerTimerSeconds,
      quality: config.graphics.quality,
      voice: config.audio.voice.enabled,
      readQuestions: config.audio.voice.readQuestions,
      sfx: config.audio.effects.enabled,
      music: config.audio.music.enabled,
      reduced: config.graphics.reducedMotion
    };
    this.locked = {};
    this.fps = { acc: 0, frames: 0, low: 0, samples: [] };
    this.gameTimers = [];
  }
  _after(seconds, fn) {
    this.gameTimers.push({ t: seconds, fn });
  }
  _runGameTimers(dt) {
    if (!this.gameTimers.length) return;
    const due = [];
    this.gameTimers = this.gameTimers.filter((g) => {
      g.t -= dt;
      if (g.t <= 0) {
        due.push(g);
        return false;
      }
      return true;
    });
    due.forEach((g) => g.fn());
  }
  // ---------------- التهيئة ----------------
  async boot() {
    this._wireUI();
    this._wireGlobal();
    this.ui.loading(0.05, "تجهيز الخطوط…");
    try {
      await this._loadFonts();
      this.audio = new AudioEngine(this.config.audio);
      this.ui.loading(0.1, "الاتصال بمصدر الأسئلة…");
      this.bridge = createBridge(this.config, { simSpec: this.flags.sim });
      this.bridge.onControl((cmd) => this._onControl(cmd));
      this.bridge.onGrade((g) => this._onLateGrade(g));
      const session = await this.bridge.init();
      this.session = session;
      this._applySession(session);
      this.ui.loading(0.12, "تحميل الأسئلة…");
      this.questions = await this.bridge.getQuestions();
      this.scene = new SceneManager(this.ui.el.stage, this._effectiveConfig());
      await this.scene.init((p, msg) => this.ui.loading(0.12 + p * 0.8, msg));
      this._newRace();
      this.ui.loading(1, "جاهز");
      this.ui.hideLoading();
      this._toReady();
      this._startLoop();
      if (this.flags.autostart) this.startRace();
    } catch (err) {
      console.error(err);
      this._fatal(err);
    }
  }
  _fatal(err) {
    this.state = STATES.ERROR;
    this.ui.setState("error");
    let msg = "حدث خطأ غير متوقع أثناء التحميل.";
    if (err?.message === "webgl") msg = "تعذر تشغيل الرسوم ثلاثية الأبعاد (WebGL) على هذا الجهاز أو المتصفح. جرّب متصفحًا حديثًا أو فعّل تسريع الرسوم.";
    else if (err?.code === "timeout") msg = "تعذر الاتصال بالمنصة (انتهت المهلة). تأكد من فتح اللعبة داخل المنصة ثم أعد المحاولة.";
    else if (err?.code === "no_questions" || err?.code === "bad_question") msg = err.message;
    else if (err?.code === "network") msg = "تعذر الاتصال بالمنصة. أعد المحاولة.";
    else if (err?.message) msg = `تعذر التحميل: ${err.message}`;
    this.ui.loadingError(msg);
  }
  async _loadFonts() {
    return;
    if (!document.fonts) return;
    const faces = ['800 40px "QCR Cairo"', '700 40px "QCR Cairo"', '400 20px "QCR Cairo"', '700 30px "QCR Naskh"'];
    await Promise.race([
      Promise.all(faces.map((f) => document.fonts.load(f, "سباق 0123456789"))),
      new Promise((r) => setTimeout(r, 2500))
    ]);
  }
  _applySession(s) {
    if (!s) return;
    if (s.mode) {
      this.settings.mode = s.mode;
      this.locked.mode = true;
    }
    if (s.player?.name) this.settings.playerName = s.player.name;
    if (s.player?.teamName) this.settings.teamName = s.player.teamName;
    if (s.player?.students?.length) this.settings.students = s.player.students;
    const st = s.settings || {};
    if (["easy", "normal", "hard"].includes(st.difficulty)) {
      this.settings.difficulty = st.difficulty;
      this.locked.difficulty = true;
    }
    if (Number.isFinite(st.segmentSeconds)) this.settings.segmentSeconds = Math.min(8, Math.max(4, st.segmentSeconds));
    if (Number.isFinite(st.answerTimerSeconds)) this.settings.timer = Math.max(0, st.answerTimerSeconds);
  }
  _effectiveConfig() {
    const c = JSON.parse(JSON.stringify(this.config));
    c.trackLength = Math.max(1400, (this.questions?.length || 6) * 8 * this.config.race.baseSpeedMps * 1.5 + 500);
    c.graphics.quality = this.settings.quality;
    c.graphics.reducedMotion = this.settings.reduced;
    return c;
  }
  // ---------------- أحداث الواجهة ----------------
  _wireUI() {
    const ui = this.ui;
    ui.on("retry-load", () => location.reload());
    ui.on("start", () => this.startRace());
    ui.on("pause", () => this.pause());
    ui.on("resume", () => this.resume());
    ui.on("restart", () => this.restart());
    ui.on("replay", () => this.restart());
    ui.on("exit", () => this.exit());
    ui.on("mute", () => {
      this.settings.sfx = !this.settings.sfx;
      this.audio?.set("effects", { enabled: this.settings.sfx });
      ui.setMuteIcon(!this.settings.sfx);
    });
    ui.on("fullscreen", () => this.toggleFullscreen());
    ui.on("continue", () => this._continueAfterFeedback());
    ui.on("retry-submit", () => this._submitCurrent());
    ui.on("next-student", () => this._nextStudent());
    ui.on("retry-result", () => this._reportResult());
  }
  _wireGlobal() {
    const onVis = () => {
      if (document.hidden) {
        if (RACE_STATES.has(this.state) && !this.paused) this.pause({ auto: true });
        this.audio?.suspend();
      } else {
        this.lastTime = null;
        if (!this.paused) this.audio?.resume();
      }
    };
    const onResize = () => this.scene?.resize();
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (this.paused) this.resume();
        else if (RACE_STATES.has(this.state)) this.pause();
      }
      if (this.state === STATES.QUESTION && /^[1-8]$/.test(e.key)) {
        const q = this.current?.question;
        const c = q?.choices[Number(e.key) - 1];
        if (c) this._choose(c.id);
      }
    };
    const unlock = () => this.audio?.unlock();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    this.root.addEventListener("pointerdown", unlock);
    this.root.addEventListener("keydown", unlock);
    this.listeners.push(["visibilitychange", onVis, document], ["resize", onResize, window], ["keydown", onKey, window], ["pointerdown", unlock, this.root], ["keydown", unlock, this.root]);
  }
  // ---------------- الحلقة الرئيسية ----------------
  _startLoop() {
    if (this.flags.capture) return;
    if (this.rafId) return;
    this.rafLoops++;
    const loop = (now) => {
      this.rafId = requestAnimationFrame(loop);
      if (this.lastTime == null) this.lastTime = now;
      const dt = Math.min(0.1, (now - this.lastTime) / 1e3);
      this.lastTime = now;
      this.frame(dt);
    };
    this.rafId = requestAnimationFrame(loop);
  }
  frame(dt) {
    if (!this.scene || this.disposed) return;
    if (!this.paused) {
      this.stateTime += dt;
      this._runGameTimers(dt);
      this.ui.tick(dt);
      this._tick(dt);
      const frozen = !this.model || this.model.isFrozen();
      this.scene.update(dt, { frozen, mode: this.scene.director.mode, audio: this.audio, overtake: this._overtakeFlag });
      this._overtakeFlag = false;
      this._monitorFps(dt);
    }
    if (!this._skipRender) this.scene.render();
    if (this.model && this.state !== STATES.READY) this._updateHUD();
    this.ui.setMarker(RACE_STATES.has(this.state) && this.state !== STATES.INTRO ? this.scene.projectPlayerMarker() : null);
  }
  _tick(dt) {
    switch (this.state) {
      case STATES.INTRO:
        if (this.stateTime >= this.introDuration) this._toCountdown();
        break;
      case STATES.COUNTDOWN: {
        const n = this.config.race.countdownSeconds;
        const left = n - this.stateTime;
        const shown = Math.ceil(left);
        if (shown !== this._cdShown && shown > 0) {
          this._cdShown = shown;
          this.ui.countdown(ar(shown));
          this.audio?.countdownBeep(false);
        }
        if (left <= 0) {
          this.ui.countdown("انطلق!");
          this.audio?.countdownBeep(true);
          this.audio?.commentary("انطلق السباق");
          this._after(0.8, () => this.ui.countdown(null));
          this.model.start();
          this._onSegmentStart();
          this._setState(STATES.RUNNING);
        }
        break;
      }
      case STATES.RUNNING:
      case STATES.FINISHING:
      case STATES.RESULTS: {
        const events = this.model.step(dt);
        for (const e of events) this._onModelEvent(e);
        this._trackOvertakes();
        break;
      }
      case STATES.QUESTION:
        if (this.current?.timerLeft != null && !this.current.answered) {
          this.current.timerLeft -= dt;
          this.ui.setTimer(this.current.timerLeft);
          if (this.current.timerLeft <= 0) this._choose(null, { timedOut: true });
        }
        break;
      case STATES.FEEDBACK:
        if (this.current?.autoLeft != null) {
          this.current.autoLeft -= dt;
          this.ui.footer({ cont: true, autoSeconds: Math.max(0, this.current.autoLeft) });
          if (this.current.autoLeft <= 0) this._continueAfterFeedback();
        }
        break;
      default:
    }
  }
  _setState(s) {
    this.state = s;
    this.stateTime = 0;
    this.ui.setState(s);
    this._report();
  }
  _later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.disposed) fn();
    }, ms);
    this.timers.add(t);
    return t;
  }
  _clearTimers() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.gameTimers = [];
    this.ui.clearTimers();
  }
  // ---------------- السباق ----------------
  _newRace() {
    this.raceCount++;
    const N = this.bridge.mode === "platform" ? this.questions.length : Math.min(this.questions.length, this.config.questions.maxQuestions);
    const seed = hashString(this.session?.sessionId || "local") + this.raceCount * 9973 >>> 0;
    this.seed = seed;
    this.model = createRaceModel({
      questionCount: N,
      segmentSeconds: this.settings.segmentSeconds,
      sprintSeconds: this.config.race.sprintSeconds,
      baseSpeed: this.config.race.baseSpeedMps,
      boost: this.config.race.correctBoost,
      competitors: this.config.race.competitors,
      difficulty: this.settings.difficulty,
      seed,
      playerLane: 0
      // أقرب حارة للكاميرا: لا يحجب أي منافس هجين اللاعب
    });
    this.raceQuestions = this.questions.slice(0, N).map((q) => this._prepareQuestion(q, seed));
    this.answers = [];
    this.points = 0;
    this.resultId = makeId("result");
    this.resultSaved = false;
    this.turnIndex = 0;
    this.lastRank = null;
    this.identities = this.scene.setupRace(this.model, seed);
    this.scene.director.finishX = this.model.finishX;
  }
  _prepareQuestion(q, seed) {
    const out = { ...q, choices: q.choices.slice() };
    if (this.config.questions.shuffleChoices && q.type !== "tf") {
      const rng = createRng(seed ^ hashString(q.id));
      for (let i = out.choices.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [out.choices[i], out.choices[j]] = [out.choices[j], out.choices[i]];
      }
    }
    return out;
  }
  _toReady() {
    this._setState(STATES.READY);
    this.scene.director.setMode("menu");
    this.ui.hideHUD();
    this.ui.hideAllOverlays();
    const isSample = this.bridge.mode === "local" && window.QATAR_CAMEL_RACE_SAMPLE_QUESTIONS?.isSampleData;
    this.ui.showStart({
      ...this.settings,
      voiceAvailable: this.audio.voiceAvailable,
      locked: this.locked,
      dataNote: isSample ? `وضع تجريبي مستقل: ${ar(this.raceQuestions.length)} أسئلة تجريبية مع محاكي تصحيح محلي. استبدلها من ملف questions.sample.js أو اربط اللعبة بالمنصة.` : ""
    });
  }
  startRace() {
    if (this.state !== STATES.READY) return;
    this.audio.unlock();
    const s = this.ui.readStart();
    const qualityChanged = s.quality !== this.settings.quality;
    Object.assign(this.settings, s, { playerName: cleanPlayerName(s.playerName) });
    if (this.locked.mode && this.session?.mode) this.settings.mode = this.session.mode;
    this.root.classList.toggle("classroom", this.settings.mode === "classroom");
    this.root.classList.toggle("reduced-motion", this.settings.reduced);
    this._applyAudioSettings();
    this.scene.director.reduced = this.settings.reduced;
    this.scene.config.graphics.reducedMotion = this.settings.reduced;
    if (qualityChanged) this.scene.setQuality(this.settings.quality === "auto" ? "medium" : this.settings.quality);
    if (this.model.config.segmentSeconds !== this.settings.segmentSeconds || this.model.config.difficulty !== this.settings.difficulty) {
      this.raceCount--;
      this._newRace();
    }
    this.ui.hideStart();
    this._beginIntro();
  }
  _applyAudioSettings() {
    this.audio.set("voice", { enabled: this.settings.voice, readQuestions: this.settings.readQuestions });
    this.audio.set("effects", { enabled: this.settings.sfx });
    this.audio.set("music", { enabled: this.settings.music });
    this.ui.setMuteIcon(!this.settings.sfx);
  }
  playerLabel() {
    return cleanPlayerName(this.settings.playerName);
  }
  _beginIntro() {
    this.ui.showHUD(this.model.config.questionCount, this.playerLabel());
    const useIntro = this.config.race.introShot && !this.settings.reduced;
    this.introDuration = useIntro ? 2.4 : 0.01;
    this.scene.director.setMode("intro", { introDuration: this.introDuration });
    this._setState(STATES.INTRO);
  }
  _toCountdown() {
    this._cdShown = null;
    this.scene.director.setMode("follow");
    this._setState(STATES.COUNTDOWN);
  }
  _onSegmentStart() {
    const i = this.model.state.segmentIndex;
    const x = this.model.predictCheckpointX();
    if (x != null) this.scene.track.showStageMarker(i, x);
  }
  _onModelEvent(e) {
    switch (e.type) {
      case "checkpoint":
        this._openQuestion(e.index);
        break;
      case "finishPlaced":
        this.scene.placeFinish(e.x);
        break;
      case "cross":
        if (e.id === "player") {
          this.audio?.finish();
          const st = this.model.standings().find((s) => s.isPlayer);
          this.ui.toast(`عبرت خط النهاية — المركز ${ordinal(st.rank)}`);
          this.audio?.commentary(`وصل هجينك في المركز ${ordinal(st.rank)}`);
        }
        break;
      case "allFinished":
        this._after(1.5, () => this._showResults());
        break;
      default:
    }
  }
  _trackOvertakes() {
    if (this.state !== STATES.RUNNING && this.state !== STATES.FINISHING) return;
    const st = this.model.standings();
    const me = st.find((s) => s.isPlayer).rank;
    if (this.lastRank != null && me < this.lastRank && this.model.state.time > 3) {
      this._overtakeFlag = true;
      this.ui.toast(me === 1 ? "هجينك يتصدّر السباق!" : `تقدّم هجينك إلى المركز ${ordinal(me)}`);
      if (me === 1) this.audio?.cheer(0.9);
    }
    this.lastRank = me;
    if (this.state === STATES.FINISHING && this.scene.director.mode === "follow" && this.model.finishPlaced && this.model.finishX - this.model.player.d < 38) {
      this.scene.director.setMode("finish", { finishX: this.model.finishX });
    }
  }
  // ---------------- الأسئلة ----------------
  _openQuestion(index) {
    const q = this.raceQuestions[index];
    this.current = {
      index,
      question: q,
      answered: false,
      graded: false,
      choiceId: null,
      timedOut: false,
      attemptId: makeId(`att-${index}`),
      timerLeft: this.settings.timer > 0 ? this.settings.timer : null,
      autoLeft: null
    };
    this._setState(STATES.QUESTION);
    this.scene.director.setMode("question");
    this.audio?.duck(true);
    this.ui.showQuestion(q, {
      index,
      total: this.model.config.questionCount,
      turnName: this._turnName(),
      onChoose: (id) => this._choose(id),
      timer: this.current.timerLeft
    });
    this.audio?.readQuestion(q.text);
  }
  _turnName() {
    if (this.settings.mode !== "classroom" || !this.settings.students.length) return null;
    return this.settings.students[this.turnIndex % this.settings.students.length];
  }
  _nextStudent() {
    if (this.state !== STATES.QUESTION || this.current?.answered) return;
    this.turnIndex++;
    const name = this._turnName();
    const t = this.ui.$(".qcr-q-turn");
    if (name) t.textContent = `يجيب الآن: ${name}`;
  }
  // تسجيل الإجابة مرة واحدة فقط مهما تكرر الضغط
  _choose(choiceId, { timedOut = false } = {}) {
    const c = this.current;
    if (!c || c.answered || this.state !== STATES.QUESTION || this.paused) return;
    c.answered = true;
    c.choiceId = choiceId;
    c.timedOut = timedOut;
    this.ui.lockChoices(choiceId);
    this.ui.setTimer(null);
    this.audio?.click();
    this.audio?.cancelSpeech();
    this._submitCurrent();
  }
  async _submitCurrent() {
    const c = this.current;
    if (!c || !c.answered || c.graded || c.submitting) return;
    c.submitting = true;
    this._setState(STATES.AWAITING_GRADE);
    this.ui.footer({});
    this.ui.status("wait", "جارٍ التصحيح…");
    const myAttempt = c.attemptId;
    try {
      const g = await this.bridge.submitAnswer({
        questionId: c.question.id,
        choiceId: c.choiceId,
        attemptId: c.attemptId,
        timedOut: c.timedOut,
        questionIndex: c.index
      });
      if (this.current !== c || c.attemptId !== myAttempt) return;
      c.submitting = false;
      if (g.status === "pending") {
        c.pendingGrade = true;
        this.ui.status("wait", "الإجابة بانتظار التصحيح", "سيستأنف السباق تلقائيًا عند وصول نتيجة التصحيح.");
        return;
      }
      this._applyGrade(g);
    } catch (err) {
      if (this.current !== c) return;
      c.submitting = false;
      const detail = err?.retryable === false ? err.message || "تعذر تصحيح الإجابة." : "لن يُحتسب السؤال خطأ. تحقّق من الاتصال ثم أعد المحاولة.";
      this.ui.status("err", "تعذر إرسال الإجابة", detail);
      this.ui.footer({ retry: true });
    }
  }
  _onLateGrade(g) {
    const c = this.current;
    if (!c || c.graded || g.attemptId !== c.attemptId) return;
    if (g.status !== "graded") return;
    this._applyGrade(g);
  }
  _applyGrade(g) {
    const c = this.current;
    if (c.graded) return;
    c.graded = true;
    c.pendingGrade = false;
    const correct = !!g.correct;
    this.model.recordAnswer(c.index, correct);
    this.points += correct ? g.points ?? 0 : g.points > 0 ? g.points : 0;
    const chosen = c.question.choices.find((x) => x.id === c.choiceId);
    const right = g.correctChoiceId ? c.question.choices.find((x) => x.id === g.correctChoiceId) : null;
    this.answers[c.index] = {
      questionId: c.question.id,
      text: c.question.text,
      choiceId: c.choiceId,
      chosenText: chosen?.text || "",
      correct,
      points: g.points ?? 0,
      correctChoiceId: g.correctChoiceId,
      correctText: right?.text || "",
      explanation: g.explanation || "",
      timedOut: c.timedOut,
      attemptId: c.attemptId
    };
    this.ui.markChoices({ selectedId: c.choiceId, correctChoiceId: g.correctChoiceId, correct });
    if (correct) {
      const lines = ["أحسنت! هجينك يتسارع", "إجابة صحيحة! انطلق إلى الأمام", "رائع! تقدّم نحو الصدارة", "ممتاز! هجينك يندفع"];
      this.ui.status("ok", `${lines[c.index % lines.length]}${g.points ? ` (+${ar(g.points)} نقاط)` : ""}`, g.explanation || "");
      this.audio?.correct();
      this.audio?.commentary("إجابة صحيحة");
    } else {
      const title = c.timedOut ? "انتهى الوقت" : "إجابة غير صحيحة";
      const rt = right ? `الإجابة الصحيحة: ${right.text}` : "";
      this.ui.status("bad", rt ? `${title} — ${rt}` : title, g.explanation || "");
      this.audio?.wrong();
    }
    this._setState(STATES.FEEDBACK);
    const manual = this.settings.mode === "classroom" && this.config.mode.classroomManualContinue;
    if (manual) {
      c.autoLeft = null;
      this.ui.footer({ cont: true });
    } else {
      c.autoLeft = correct ? this.config.questions.autoContinueSeconds.correct : this.config.questions.autoContinueSeconds.wrong;
      this.ui.footer({ cont: true, autoSeconds: c.autoLeft });
    }
  }
  _continueAfterFeedback() {
    const c = this.current;
    if (this.state !== STATES.FEEDBACK || !c?.graded || this.paused) return;
    this.ui.hideQuestion();
    this.audio?.duck(false);
    if (this.settings.mode === "classroom") this.turnIndex++;
    const wasCorrect = this.answers[c.index]?.correct;
    this.model.resume();
    this.scene.director.setMode("follow");
    if (this.model.state.phase === "segment") {
      this._setState(STATES.RUNNING);
      this._onSegmentStart();
    } else {
      this._setState(STATES.FINISHING);
      this.scene.track.hideStageMarkers();
      this.ui.toast("الاندفاع الأخير نحو خط النهاية!");
    }
    if (wasCorrect) this.audio?.boost();
    this.current = null;
  }
  // ---------------- النتائج ----------------
  _showResults() {
    if (this.state === STATES.RESULTS) return;
    this._setState(STATES.RESULTS);
    this.scene.director.setMode("results");
    this.ui.hideHUD();
    const st = this.model.standings();
    const me = st.find((s) => s.isPlayer);
    const tied = st.filter((s) => s.rank === me.rank).length > 1;
    const total = this.model.config.questionCount;
    const correct = this.answers.filter((a) => a?.correct).length;
    this.finalResult = {
      resultId: this.resultId,
      gameId: GAME_ID,
      gameTitle: GAME_TITLE,
      version: GAME_VERSION,
      sessionId: this.session?.sessionId,
      mode: this.settings.mode,
      name: this.playerLabel(),
      rank: me.rank,
      tied,
      racers: st.length,
      correctCount: correct,
      totalQuestions: total,
      points: this.points,
      difficulty: this.settings.difficulty,
      finishOrder: st.map((s) => ({ id: s.id, rank: s.rank, finishTime: Number(s.finishTime?.toFixed(3)), number: this.identities[s.id].number, isPlayer: s.isPlayer })),
      answers: this.answers.map((a) => ({ questionId: a.questionId, choiceId: a.choiceId, correct: a.correct, points: a.points, attemptId: a.attemptId, timedOut: a.timedOut }))
    };
    this.ui.showResults({
      name: this.playerLabel(),
      rank: me.rank,
      tied,
      correct,
      total,
      points: this.points,
      order: st.map((s) => ({ rank: s.rank, isPlayer: s.isPlayer, color: this.identities[s.id].color, number: this.identities[s.id].number, name: this.identities[s.id].name })),
      review: this.answers.map((a) => ({ text: a.text, correct: a.correct, chosenText: a.timedOut ? "لم تُجب (انتهى الوقت)" : a.chosenText, correctText: a.correctText, explanation: a.explanation }))
    });
    this._reportResult();
  }
  async _reportResult() {
    if (!this.finalResult || this.resultSaved || this._savingResult) return;
    this._savingResult = true;
    const platform = this.bridge.mode === "platform";
    this.ui.saveStatus(platform ? "جارٍ حفظ النتيجة في المنصة…" : "");
    try {
      const ack = await this.bridge.reportResult(this.finalResult);
      this.resultSaved = true;
      this.ui.saveStatus(platform ? ack?.demo ? "تجربة تدريبية؛ لم تُسجّل درجات في المنصة." : ack?.group ? "اكتملت الجلسة الصفية دون درجات فردية للطلاب." : "تم حفظ النتيجة في المنصة." : "وضع تجريبي: النتيجة محفوظة محليًا في هذا المتصفح فقط.");
    } catch (err) {
      this.ui.saveStatus("تعذر حفظ النتيجة في المنصة. يمكنك إعادة المحاولة (لن تُسجّل مرتين).", { error: true, retry: true });
    } finally {
      this._savingResult = false;
    }
  }
  // ---------------- الإيقاف والاستئناف ----------------
  pause({ auto = false } = {}) {
    if (this.paused || !RACE_STATES.has(this.state)) return;
    this.paused = true;
    this.pausedFrom = this.state;
    this.ui.setState(STATES.PAUSED);
    this.audio?.suspend();
    this.ui.showPause({ voice: this.settings.voice, sfx: this.settings.sfx, music: this.settings.music, reduced: this.settings.reduced });
    this._report({ paused: true, auto });
  }
  resume() {
    if (!this.paused) return;
    const p = this.ui.readPause();
    Object.assign(this.settings, { voice: p.voice, sfx: p.sfx, music: p.music, reduced: p.reduced });
    this.scene.director.reduced = p.reduced;
    this.scene.config.graphics.reducedMotion = p.reduced;
    this.root.classList.toggle("reduced-motion", p.reduced);
    this.ui.hidePause();
    this.paused = false;
    this.lastTime = null;
    this.ui.setState(this.state);
    this.audio?.resume();
    this._applyAudioSettings();
    this._report({ paused: false });
  }
  async restart() {
    if (this.bridge?.mode === "platform") {
      if (this._restarting || this._savingResult || this.state === STATES.AWAITING_GRADE) return;
      this._restarting = true;
      try {
        await this.bridge.requestRestart();
      } catch (err) {
        this.ui.toast(err?.message || "تعذرت إعادة المحاولة.");
      } finally {
        this._restarting = false;
      }
      return;
    }
    this._clearTimers();
    this.paused = false;
    this.audio?.cancelSpeech();
    this.audio?.resume();
    this.audio?.duck(false);
    this.ui.hideAllOverlays();
    this.current = null;
    this._newRace();
    this.ui.hideStart();
    this._beginIntro();
  }
  exit() {
    this._clearTimers();
    this.audio?.cancelSpeech();
    const handled = this.bridge?.requestExit();
    if (!handled) {
      this.paused = false;
      this.audio?.resume();
      this.audio?.duck(false);
      this.current = null;
      this._newRace();
      this._toReady();
    }
  }
  _onControl(cmd) {
    if (cmd === "pause") this.pause();
    else if (cmd === "resume") this.resume();
    else if (cmd === "restart") {
      if (this.state !== STATES.LOADING) this.restart();
    } else if (cmd === "end") this.dispose();
  }
  toggleFullscreen() {
    const el = this.root;
    const doc = document;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {
    });
  }
  // ---------------- الواجهة ----------------
  _updateHUD() {
    const m = this.model;
    const st = m.standings();
    const me = st.find((s) => s.isPlayer);
    const N = m.config.questionCount;
    const T = m.config.segmentSeconds;
    let progress;
    if (m.state.phase === "ready") progress = 0;
    else if (m.state.phase === "segment" || m.state.phase === "checkpoint") {
      const done = m.state.segmentIndex + (m.state.phase === "checkpoint" ? 1 : 1 - m.state.stepsLeft / m.config.segmentSteps);
      progress = done / (N + 0.67);
    } else {
      const toGo = Math.max(0, m.finishX - m.player.d);
      const startGap = m.config.baseSpeed * m.config.sprintSeconds * 1.1;
      progress = Math.min(1, (N + 0.67 * (1 - Math.min(1, toGo / startGap))) / (N + 0.67));
    }
    void T;
    const finished = m.state.phase === "finished" || this.state === STATES.RESULTS;
    this.scene.updateScoreboard(st, this.playerLabel(), finished ? "النتيجة النهائية" : "الترتيب المباشر");
    this.ui.updateHUD({
      stage: Math.max(1, m.state.segmentIndex + 1),
      total: N,
      points: this.points,
      rank: me.rank,
      progress,
      standings: st,
      identities: this.identities,
      playerLabel: this.playerLabel(),
      stagesDone: this.answers.filter(Boolean).length
    });
  }
  _report(extra = {}) {
    if (!this.bridge || !this.model) return;
    const st = this.model.standings();
    this.bridge.reportProgress({
      state: this.state,
      stage: this.model.state.segmentIndex + 1,
      totalStages: this.model.config.questionCount,
      rank: st.find((s) => s.isPlayer)?.rank,
      correctCount: (this.answers || []).filter((a) => a?.correct).length,
      points: this.points,
      ...extra
    });
  }
  // جودة تلقائية: خفض الجودة عند بطء الإطارات على أجهزة المدارس
  _monitorFps(dt) {
    if (this.settings.quality !== "auto" || this.flags.capture) return;
    if (this.state !== STATES.RUNNING && this.state !== STATES.FINISHING) return;
    const f = this.fps;
    f.acc += dt;
    f.frames++;
    if (f.acc >= 2) {
      const fps = f.frames / f.acc;
      f.acc = 0;
      f.frames = 0;
      f.low = fps < 40 ? f.low + 1 : 0;
      if (f.low >= 2) {
        const cur = this.scene.qualityName;
        const next = cur === "high" ? "medium" : cur === "medium" ? "low" : null;
        if (next) {
          this.scene.setQuality(next);
          f.low = 0;
        }
      }
    }
  }
  // ---------------- أدوات الاختبار ----------------
  debugAPI() {
    return {
      get state() {
        return this._c.state;
      },
      _c: this,
      // تقديم الزمن يدويًا (وضع الالتقاط). تُرسم الصورة الأخيرة فقط ما لم يُطلب غير ذلك.
      advance: (seconds, fps = 30, renderAll = false) => {
        const n = Math.max(1, Math.round(seconds * fps));
        for (let i = 0; i < n; i++) {
          this._skipRender = !renderAll && i < n - 1;
          this.frame(1 / fps);
        }
        this._skipRender = false;
      },
      standings: () => this.model.standings(),
      model: () => ({ phase: this.model.state.phase, segment: this.model.state.segmentIndex, time: this.model.state.time, finishX: this.model.finishX, racers: this.model.racers.map((r) => ({ id: r.id, d: r.d, v: r.v, z: r.z, finished: r.finished, finishTime: r.finishTime })) }),
      current: () => this.current && { index: this.current.index, questionId: this.current.question.id, choices: this.current.question.choices.map((c) => c.id), answered: this.current.answered, graded: this.current.graded, attemptId: this.current.attemptId },
      answers: () => this.answers,
      points: () => this.points,
      result: () => this.finalResult,
      resources: () => ({ timers: this.timers.size + this.gameTimers.length, uiTimers: this.ui._timers.size, rafLoops: this.rafLoops, audio: this.audio?.stats(), scene: this.scene.info(), camels: this.scene.camels.length }),
      settings: () => ({ ...this.settings })
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this._clearTimers();
    for (const [ev, fn, target] of this.listeners) target.removeEventListener(ev, fn);
    this.listeners = [];
    this.audio?.dispose();
    this.bridge?.dispose();
    this.scene?.dispose();
  }
}
export {
  GameController,
  STATES
};
