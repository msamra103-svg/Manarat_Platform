const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function ar(n) {
  return String(n).replace(/[0-9]/g, (d) => AR_DIGITS[d]);
}
const ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن"];
function ordinal(n) {
  return ORDINALS[n - 1] || ar(n);
}
const KEYS_AR = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
class UI {
  constructor(root) {
    this.root = root;
    this.$ = (sel) => root.querySelector(sel);
    this.el = {
      stage: this.$("#qcr-stage"),
      loading: this.$("#qcr-loading"),
      start: this.$("#qcr-start"),
      hud: this.$("#qcr-hud"),
      marker: this.$("#qcr-marker"),
      countdown: this.$("#qcr-countdown"),
      toast: this.$("#qcr-toast"),
      question: this.$("#qcr-question"),
      pause: this.$("#qcr-pause"),
      results: this.$("#qcr-results")
    };
    this.handlers = {};
    this._timers = /* @__PURE__ */ new Set();
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn || btn.disabled) return;
      this._emit(btn.dataset.action, btn);
    });
    root.querySelectorAll(".qcr-seg-btn").forEach((b) => b.addEventListener("click", () => this.setMode(b.dataset.mode)));
    const seg = this.$("#qcr-segment");
    seg.addEventListener("input", () => {
      this.$("#qcr-segment-out").textContent = ar(seg.value);
    });
  }
  on(name, fn) {
    this.handlers[name] = fn;
    return this;
  }
  _emit(name, arg) {
    this.handlers[name]?.(arg);
  }
  _later(fn, ms) {
    const t = setTimeout(() => {
      this._timers.delete(t);
      fn();
    }, ms);
    this._timers.add(t);
    return t;
  }
  clearTimers() {
    this._timers.forEach((t) => clearTimeout(t));
    this._timers.clear();
  }
  setState(s) {
    this.root.dataset.state = s;
  }
  // ---------- التحميل ----------
  loading(progress, msg) {
    this.el.loading.hidden = false;
    this.$(".qcr-progress-fill").style.width = `${Math.round(progress * 100)}%`;
    this.$(".qcr-progress").setAttribute("aria-valuenow", Math.round(progress * 100));
    if (msg) this.$(".qcr-loading-msg").textContent = msg;
  }
  loadingError(msg) {
    this.el.loading.hidden = false;
    const box = this.$(".qcr-error");
    box.hidden = false;
    this.$(".qcr-loading .qcr-error-msg").textContent = msg;
  }
  hideLoading() {
    this.el.loading.hidden = true;
    this.$(".qcr-error").hidden = true;
  }
  // ---------- البداية ----------
  showStart(s) {
    this.el.start.hidden = false;
    this.setMode(s.mode);
    this.$("#qcr-player-name").value = s.playerName || "";
    this.$("#qcr-team-name").value = s.teamName || "";
    this.$("#qcr-students").value = (s.students || []).join("\n");
    this.$("#qcr-difficulty").value = s.difficulty;
    this.$("#qcr-segment").value = s.segmentSeconds;
    this.$("#qcr-segment-out").textContent = ar(s.segmentSeconds);
    this.$("#qcr-timer").value = String(s.timer || 0);
    if (!this.$(`#qcr-timer option[value="${s.timer}"]`)) this.$("#qcr-timer").value = "0";
    this.$("#qcr-quality").value = s.quality;
    this.$("#qcr-voice").checked = s.voice;
    this.$("#qcr-read").checked = s.readQuestions;
    this.$("#qcr-sfx").checked = s.sfx;
    this.$("#qcr-music").checked = s.music;
    this.$("#qcr-reduced").checked = s.reduced;
    this.$(".qcr-voice-note").hidden = s.voiceAvailable;
    const note = this.$(".qcr-data-note");
    note.hidden = !s.dataNote;
    note.textContent = s.dataNote || "";
    this.$("#qcr-difficulty").disabled = !!s.locked?.difficulty;
    this.root.querySelectorAll(".qcr-seg-btn").forEach((b) => b.disabled = !!s.locked?.mode);
    this._later(() => this.$('[data-action="start"]').focus({ preventScroll: true }), 50);
  }
  readStart() {
    return {
      mode: this.mode,
      playerName: this.$("#qcr-player-name").value.trim(),
      teamName: this.$("#qcr-team-name").value.trim(),
      students: this.$("#qcr-students").value.split(/\n|،|,/).map((s) => s.trim()).filter(Boolean).slice(0, 60),
      difficulty: this.$("#qcr-difficulty").value,
      segmentSeconds: Number(this.$("#qcr-segment").value),
      timer: Number(this.$("#qcr-timer").value),
      quality: this.$("#qcr-quality").value,
      voice: this.$("#qcr-voice").checked,
      readQuestions: this.$("#qcr-read").checked,
      sfx: this.$("#qcr-sfx").checked,
      music: this.$("#qcr-music").checked,
      reduced: this.$("#qcr-reduced").checked
    };
  }
  setMode(mode) {
    this.mode = mode;
    this.root.querySelectorAll(".qcr-seg-btn").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mode === mode)));
    this.root.querySelectorAll("[data-show]").forEach((el) => {
      el.hidden = el.dataset.show !== mode;
    });
    this.root.classList.toggle("classroom", mode === "classroom");
  }
  hideStart() {
    this.el.start.hidden = true;
  }
  // ---------- واجهة السباق ----------
  showHUD(total, label) {
    this.el.hud.hidden = false;
    this.$(".qcr-stage-total").textContent = ar(total);
    this.$(".qcr-marker-label").textContent = label;
    const ticks = this.$(".qcr-track-ticks");
    ticks.innerHTML = "";
    for (let i = 1; i <= total; i++) {
      const s = document.createElement("span");
      s.style.right = `${i / (total + 0.67) * 100}%`;
      ticks.appendChild(s);
    }
    this._boardIds = null;
  }
  hideHUD() {
    this.el.hud.hidden = true;
    this.el.marker.hidden = true;
  }
  updateHUD({ stage, total, points, rank, progress, standings, identities, playerLabel, stagesDone }) {
    this.$(".qcr-stage-num").textContent = ar(Math.min(stage, total));
    this.$(".qcr-points").textContent = ar(points);
    this.$(".qcr-rank").textContent = rank ? ar(rank) : "—";
    this.$(".qcr-track-fill").style.width = `${progress * 100}%`;
    this.$(".qcr-track-me").style.right = `${progress * 100}%`;
    this.root.querySelectorAll(".qcr-track-ticks span").forEach((s, i) => s.classList.toggle("done", i < stagesDone));
    const board = this.$(".qcr-board");
    const ids = standings.map((s) => s.id + ":" + s.rank).join(",");
    if (ids !== this._boardIds) {
      this._boardIds = ids;
      board.innerHTML = standings.map((s) => {
        const idn = identities[s.id];
        const fg = isLight(idn.color) ? "#111" : "#fff";
        const name = s.isPlayer ? esc(playerLabel) : esc(idn.name);
        return `<li class="${s.isPlayer ? "me" : ""}" data-id="${s.id}"><span class="pos">${ar(s.rank)}</span><span class="sw" style="background:${idn.color};color:${fg}">${idn.number}</span><span class="nm">${name}</span>${s.isPlayer ? '<span class="tag">أنت</span>' : ""}</li>`;
      }).join("");
    }
  }
  setMarker(pos) {
    const m = this.el.marker;
    if (!pos) {
      m.hidden = true;
      return;
    }
    m.hidden = false;
    m.style.left = `${pos.x * 100}%`;
    m.style.top = `${pos.y * 100}%`;
  }
  setMuteIcon(muted) {
    this.$('[data-action="mute"]').classList.toggle("muted", muted);
  }
  countdown(text) {
    const c = this.el.countdown;
    if (text == null) {
      c.hidden = true;
      return;
    }
    c.hidden = false;
    c.textContent = text;
    c.classList.remove("pop");
    void c.offsetWidth;
    c.classList.add("pop");
  }
  // الإشعار يُخفى بزمن اللعبة (يتوقف مع الإيقاف المؤقت)
  toast(msg) {
    const t = this.el.toast;
    t.textContent = msg;
    t.hidden = false;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
    this._toastLeft = 2.3;
  }
  tick(dt) {
    if (this._toastLeft > 0) {
      this._toastLeft -= dt;
      if (this._toastLeft <= 0) this.el.toast.hidden = true;
    }
  }
  // ---------- السؤال ----------
  showQuestion(q, { index, total, turnName, onChoose, timer }) {
    const el = this.el.question;
    el.hidden = false;
    this.$(".qcr-q-count").textContent = `السؤال ${ar(index + 1)} من ${ar(total)}`;
    this.$(".qcr-q-subject").textContent = q.subject || "";
    const turn = this.$(".qcr-q-turn");
    turn.hidden = !turnName;
    turn.textContent = turnName ? `يجيب الآن: ${turnName}` : "";
    this.$('[data-action="next-student"]').hidden = !turnName;
    this.$(".qcr-q-text").textContent = q.text;
    const media = this.$(".qcr-q-media");
    media.innerHTML = "";
    media.hidden = !q.media?.image;
    if (q.media?.image) {
      const img = document.createElement("img");
      img.src = q.media.image;
      img.alt = q.media.alt || "";
      img.onerror = () => {
        media.innerHTML = '<p class="qcr-note">تعذر تحميل صورة السؤال.</p>';
      };
      media.appendChild(img);
    }
    const box = this.$(".qcr-choices");
    box.className = `qcr-choices ${q.type === "tf" ? "tf" : ""}`;
    box.innerHTML = "";
    q.choices.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qcr-choice";
      b.dataset.choiceId = c.id;
      b.innerHTML = `<span class="key">${q.type === "tf" ? c.id === "true" || c.id === "0" ? "✓" : "✗" : KEYS_AR[i]}</span><span class="txt"></span>`;
      b.querySelector(".txt").textContent = c.text;
      b.addEventListener("click", () => onChoose(c.id));
      box.appendChild(b);
    });
    this.status(null);
    this.footer({});
    this.setTimer(timer);
    this._later(() => box.querySelector("button")?.focus({ preventScroll: true }), 60);
  }
  lockChoices(selectedId) {
    this.root.querySelectorAll(".qcr-choice").forEach((b) => {
      b.disabled = true;
      b.classList.toggle("selected", b.dataset.choiceId === selectedId);
    });
  }
  unlockChoices() {
    this.root.querySelectorAll(".qcr-choice").forEach((b) => {
      b.disabled = false;
      b.classList.remove("selected");
    });
  }
  markChoices({ selectedId, correctChoiceId, correct }) {
    this.root.querySelectorAll(".qcr-choice").forEach((b) => {
      const id = b.dataset.choiceId;
      b.disabled = true;
      b.classList.remove("selected");
      if (correctChoiceId && id === correctChoiceId) b.classList.add("correct");
      else if (id === selectedId && !correct) b.classList.add("wrong");
      else if (id === selectedId && correct) b.classList.add("correct");
      else b.classList.add("dim");
    });
  }
  setTimer(seconds) {
    const t = this.$(".qcr-q-timer");
    if (seconds == null) {
      t.hidden = true;
      return;
    }
    t.hidden = false;
    t.textContent = ar(Math.max(0, Math.ceil(seconds)));
    t.classList.toggle("low", seconds <= 5);
  }
  status(kind, title = "", detail = "") {
    const s = this.$(".qcr-q-status");
    if (!kind) {
      s.innerHTML = "";
      return;
    }
    const ico = kind === "ok" ? "✓" : kind === "bad" ? "✗" : kind === "err" ? "!" : "";
    s.innerHTML = `<div class="qcr-status ${kind}">${kind === "wait" ? '<span class="qcr-spin"></span>' : `<span class="ico">${ico}</span>`}<div><span class="ttl"></span><span class="exp"></span></div></div>`;
    s.querySelector(".ttl").textContent = title;
    const e = s.querySelector(".exp");
    if (detail) e.textContent = detail;
    else e.remove();
  }
  footer({ cont = false, retry = false, autoSeconds = null }) {
    const c = this.$('[data-action="continue"]');
    const wasHidden = c.hidden;
    c.hidden = !cont;
    const label = autoSeconds != null ? `متابعة السباق <span class="qcr-auto">(${ar(Math.ceil(autoSeconds))})</span>` : "متابعة السباق";
    if (c.innerHTML !== label) c.innerHTML = label;
    const r = this.$('[data-action="retry-submit"]');
    const retryWasHidden = r.hidden;
    r.hidden = !retry;
    if (cont && wasHidden) this._later(() => c.focus({ preventScroll: true }), 30);
    if (retry && retryWasHidden) this._later(() => r.focus({ preventScroll: true }), 30);
  }
  hideQuestion() {
    this.el.question.hidden = true;
  }
  // ---------- الإيقاف ----------
  showPause(s) {
    this.el.pause.hidden = false;
    this.root.querySelectorAll("#qcr-pause [data-bind]").forEach((inp) => {
      inp.checked = !!s[inp.dataset.bind];
    });
  }
  readPause() {
    const out = {};
    this.root.querySelectorAll("#qcr-pause [data-bind]").forEach((inp) => {
      out[inp.dataset.bind] = inp.checked;
    });
    return out;
  }
  hidePause() {
    this.el.pause.hidden = true;
  }
  // ---------- النتائج ----------
  showResults(r) {
    const el = this.el.results;
    el.hidden = false;
    this.$("#qcr-r-title").textContent = "سباق الهجن القطري";
    this.$(".qcr-r-name").textContent = r.name;
    this.$(".qcr-r-rank").textContent = r.tied ? `${ordinal(r.rank)} (مشترك)` : ordinal(r.rank);
    this.$(".qcr-r-correct").textContent = `${ar(r.correct)} من ${ar(r.total)}`;
    this.$(".qcr-r-points").textContent = ar(r.points);
    this.$(".qcr-r-order").innerHTML = r.order.map((o) => {
      const fg = isLight(o.color) ? "#111" : "#fff";
      return `<li class="${o.isPlayer ? "me" : ""}"><b>${ar(o.rank)}</b><span class="sw" style="background:${o.color};color:${fg}">${o.number}</span>${o.isPlayer ? esc(r.name) : esc(o.name)}</li>`;
    }).join("");
    this.$(".qcr-review").innerHTML = r.review.map((q) => `
      <li><span class="q">${esc(q.text)}</span>
        <span class="a ${q.correct ? "ok" : "bad"}">${q.correct ? "✓ إجابتك صحيحة" : "✗ إجابتك"}: ${esc(q.chosenText || "لم تُجب")}${!q.correct && q.correctText ? ` — الصحيحة: ${esc(q.correctText)}` : ""}</span>
        ${q.explanation ? `<span class="e">${esc(q.explanation)}</span>` : ""}
      </li>`).join("");
    this.saveStatus("");
    this._later(() => this.$('[data-action="replay"]').focus({ preventScroll: true }), 60);
  }
  saveStatus(text, { error = false, retry = false } = {}) {
    const s = this.$(".qcr-r-save");
    s.textContent = text;
    s.classList.toggle("err", error);
    this.$('[data-action="retry-result"]').hidden = !retry;
  }
  hideResults() {
    this.el.results.hidden = true;
  }
  hideAllOverlays() {
    this.hideQuestion();
    this.hidePause();
    this.hideResults();
    this.countdown(null);
    this.el.toast.hidden = true;
    this._toastLeft = 0;
  }
}
function isLight(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1e3 > 150;
}
export {
  AR_DIGITS,
  UI,
  ar,
  ordinal
};
