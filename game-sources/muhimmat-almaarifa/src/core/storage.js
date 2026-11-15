// تخزين محلي آمن: إذا تعذّر localStorage (وضع خاص، حصة ممتلئة...) نكمل بالذاكرة فقط دون تعطيل اللعبة.
const memory = new Map();
let available = true;
try {
  const k = '__mm_probe__';
  window.localStorage.setItem(k, '1');
  window.localStorage.removeItem(k);
} catch (e) {
  available = false;
}

export const storage = {
  get available() { return available; },
  read(key, fallback = null) {
    try {
      const raw = available ? window.localStorage.getItem(key) : memory.get(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  /** يعيد true إذا حُفظت القيمة بشكل دائم. */
  write(key, value) {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    if (!available) return false;
    try {
      window.localStorage.setItem(key, raw);
      return true;
    } catch (e) {
      available = false;
      return false;
    }
  },
  remove(key) {
    memory.delete(key);
    try { if (available) window.localStorage.removeItem(key); } catch (e) { /* تجاهل */ }
  }
};
