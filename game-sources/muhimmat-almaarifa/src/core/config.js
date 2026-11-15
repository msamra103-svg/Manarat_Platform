// ثوابت اللعبة والقيم الافتراضية. قواعد المعلم قابلة للتعديل من «لوحة المعلم».
export const APP_NAME = 'مهمّة المعرفة';
export const BANK_FORMAT = 'muhimmat-almaarifa-bank';
export const STORAGE_KEYS = { settings: 'mm.settings.v1', bank: 'mm.bank.v1' };

export const LIMITS = { minOptions: 2, maxOptions: 4, maxQuestionChars: 240, maxOptionChars: 90, maxQuestions: 200 };

export const DEFAULT_RULES = {
  startHealth: 100,
  wrongPenalty: 20,
  points: [100, 70, 40, 10],
  shuffleOptions: true,
  shuffleQuestions: false,
  questionLimit: 0,          // 0 = كل أسئلة البنك
  feedbackSeconds: 2.2       // مدة عرض التفسير قبل الانتقال
};

export const DEFAULT_PREFS = {
  playerName: '',
  quality: 'auto',           // auto | low | medium | high
  sfxOn: true, sfxVolume: 0.8,
  ambienceOn: true, ambienceVolume: 0.45,
  speechOn: false, speechVolume: 1,
  reduceMotion: false,
  sensitivity: 1
};

// أبعاد الميدان (بالمتر)
export const WORLD = {
  pitch: 10,            // المسافة بين محطة وأخرى
  halfWidth: 7.4,       // نصف عرض الساحة
  wallH: 4.2,
  gateZ: -8,            // موضع جدار البوابة بالنسبة إلى نقطة الوقوف
  targetZ: -6.2,        // موضع صف الأهداف
  eye: 1.66,
  moveSeconds: 1.8,     // مدة الانتقال بين محطتين
  introSeconds: 1.4
};

export const FEEDBACK = {
  correct: ['أحسنت!', 'إجابة صحيحة!', 'ممتاز!', 'إصابة موفّقة!', 'رائع!'],
  wrong: ['حاول مرة أخرى', 'ليست هذه الإجابة، حاول مجددًا', 'فكّر قليلًا ثم حاول مرة أخرى']
};

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** تحويل الأرقام إلى الأرقام العربية المشرقية للعرض. */
export function num(n) {
  return String(n).replace(/[0-9]/g, d => AR_DIGITS[d]);
}

/** صيغة العدد والمعدود العربية: واحد، اثنان، ٣–١٠ جمع، ١١ فأكثر مفرد منصوب. */
export function counted(n, one, two, plural, accusative) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${num(n)} ${plural}`;
  return `${num(n)} ${accusative}`;
}
export const countQuestions = n => (n === 0 ? 'بلا أسئلة' : counted(n, 'سؤال واحد', 'سؤالان', 'أسئلة', 'سؤالًا'));
export const countMistakes = n => counted(n, 'خطأ واحد', 'خطأين', 'أخطاء', 'خطأً');
