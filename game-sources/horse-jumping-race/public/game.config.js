/*
 * ملف إعدادات «سباق الخيل — قفز الحواجز» — يمكن تعديله دون إعادة بناء اللعبة.
 * يُحمَّل قبل اللعبة، وأي قيمة غير موجودة هنا تأخذ القيمة الافتراضية من الشفرة.
 * يمكن أيضًا تمرير بعض القيم عبر الرابط، مثل: index.html?segment=5&difficulty=easy&quality=low
 */
window.HORSE_JUMPING_RACE_CONFIG = {
  // ---- السباق ----
  race: {
    segmentSeconds: 6,        // زمن الجري بين الأسئلة (4 إلى 8 ثوانٍ)
    sprintSeconds: 4,         // الاندفاع الختامي بعد آخر سؤال
    countdownSeconds: 3,      // العد التنازلي مرة واحدة عند البداية
    competitors: 5,           // عدد الخيل المنافسة (1 إلى 5)
    difficulty: 'normal',     // easy | normal | hard
    correctBoost: 0.12,       // تسارع الإجابة الصحيحة في المقطع التالي (+12%)
    baseSpeedMps: 12,         // السرعة الأساسية بالمتر/ثانية (~43 كم/س)
    introShot: true,          // لقطة افتتاحية قصيرة قبل العد التنازلي
  },

  // ---- الأسئلة ----
  questions: {
    maxQuestions: 6,          // عدد الحواجز = عدد الأسئلة المختارة (لا يُكرر سؤال)
    shuffleChoices: true,     // خلط الاختيارات (الإجابة مرتبطة بمعرّف الخيار لا بموضعه)
    answerTimerSeconds: 0,    // 0 = بلا مؤقت (الافتراضي). يمكن للمعلم تفعيله: 20/30/45/60
    pointsPerCorrect: 10,     // في الوضع المحلي فقط؛ في وضع المنصة تأتي النقاط من المنصة
    autoContinueSeconds: { correct: 2.5, wrong: 6 }, // الوضع الفردي: متابعة تلقائية بعد التغذية الراجعة
  },

  // ---- الوضع ----
  mode: {
    default: 'solo',          // solo | classroom
    classroomManualContinue: true, // في الوضع الصفي: المعلم يتابع الجولة يدويًا بعد التصحيح
  },

  // ---- الصوت (القنوات مستقلة) ----
  audio: {
    master: 0.9,
    voice: { enabled: true, volume: 1.0, readQuestions: false, commentary: true }, // الصوت البشري (قراءة/تعليق)
    effects: { enabled: true, volume: 0.85 },  // المؤثرات وأصوات السباق والجمهور
    music: { enabled: false, volume: 0.35 },   // الموسيقى الاختيارية
  },

  // ---- الرسوم والأداء ----
  graphics: {
    quality: 'auto',          // auto | high | medium | low
    reducedMotion: false,     // تقليل حركة الكاميرا والاهتزاز
    maxPixelRatio: 2,
  },

  // ---- التكامل مع المنصة ----
  integration: {
    // local: محاكي محلي للأسئلة والتصحيح (للتجربة المستقلة)
    // postMessage: الربط بالمنصة المضيفة عبر iframe (عقد مقترح — انظر INTEGRATION_CONTRACT_AR.md)
    bridge: 'local',
    allowedOrigins: [],       // مصادر المنصة المسموح بها، مثل ['https://platform.example.qa']
    handshakeTimeoutMs: 10000,
    gradeTimeoutMs: 12000,
    protocol: 'qcr-bridge/1',
  },

  gameId: 'horse-jumping-race',
};
