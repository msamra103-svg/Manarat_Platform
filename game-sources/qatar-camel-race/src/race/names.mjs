const DEFAULT_PLAYER_NAME = "شهاب";
const COMPETITOR_NAMES = Object.freeze(["شاهين", "برق", "سهيل", "رعد", "غيث"]);
function competitorName(id) {
  const m = /^c([1-5])$/.exec(String(id));
  return m ? COMPETITOR_NAMES[Number(m[1]) - 1] : "منافس";
}
function cleanPlayerName(value) {
  const name = String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);
  return name || DEFAULT_PLAYER_NAME;
}
export {
  COMPETITOR_NAMES,
  DEFAULT_PLAYER_NAME,
  cleanPlayerName,
  competitorName
};
