"use strict";
/* ===== 00-config ===== */
/**
 * ============================================================================
 * سباق الأبطال ثلاثي الأبعاد — 3D CHAMPIONS EDUCATIONAL RACING ENGINE
 * Architecture:
 * 1. IndexedDB Configuration & Question Bank Store
 * 2. Web Audio API Multi-Channel Synthesizer (Engine RPM, Real Horn, Brakes, SFX, Music)
 * 3. Three.js Real-Time 3D Engine (Procedural Sports Cars, 5 Biomes, Curved Road Streaming,
 *    Mechanical Checkpoint Barriers, Confetti & Fireworks, Trophy Showcase)
 * 4. Strict Game State Machine & Educational Quiz Evaluator
 * 5. Complete Teacher Admin CRUD & Student-Only ZIP Builder
 * ============================================================================
 */

// Flag overwritten to true inside exported Student builds
window.__STUDENT_ONLY_BUILD__ = window.__STUDENT_ONLY_BUILD__ || false;
window.__EXPORTED_CONFIG__ = window.__EXPORTED_CONFIG__ || null;

/* ----------------------- 1. DEFAULT CONFIGURATION & QUESTIONS ----------------------- */
const CAR_MODELS = [
  { id: 'ferrari_458_real', name: 'Ferrari 458 Italia — نموذج PBR حقيقي', desc: 'سيارة رياضية عالية التفاصيل (دهان Clearcoat، زجاج، عجلات تدور وتنعطف) • مضمّنة محليًا • تصميم vicent091036 (CC BY 4.0)', builtinReal:true, speedBonus:1.02 },
  { id: 'car_concept', name: 'GT كونسبت — سيارة رياضية مفصّلة', desc: 'سيارة رياضية PBR حقيقية بلا علامة تجارية: مرايا ومصابيح وأقراص فرامل وعجلات • مضمّنة محليًا • Khronos / Eric Chadwick (CC BY 4.0)', builtinReal:true, speedBonus:1.03 },
  { id: 'supercar', name: 'البرق الرياضي GT (عامة)', desc: 'سيارة رياضية عامة بلا علامة تجارية — هيكل منحوت وعجلات تفصيلية', speedBonus: 1.0 },
  { id: 'coupe', name: 'الصقر التوربيني (عامة)', desc: 'كوبيه رياضية عامة بثبات عالٍ على المنعطفات', speedBonus: 0.96 },
  { id: 'suv_sport', name: 'الأسد الصحراوي RS (عامة)', desc: 'سيارة دفع رباعي رياضية عامة', speedBonus: 0.94 },
  { id: 'custom_glb', name: 'سيارتي الواقعية GLB', desc: 'حمّل نموذج سيارة ثلاثي الأبعاد مرخّصًا من جهازك (GLB) مع محوّل اتجاه تلقائي', speedBonus: 1.0 },
  { id:'porsche_911',name:'Porsche 911 GT3',desc:'خانة استيراد: أضف ملف GLB مرخّصًا لهذه الفئة. لا يتم استبدالها بسيارة مزيفة.', brandModel:true,speedBonus:1.0 },
  { id:'bmw_m4',name:'BMW M4 Competition',desc:'خانة استيراد: أضف ملف GLB مرخّصًا لهذه الفئة.',brandModel:true,speedBonus:.99 },
  { id:'mercedes_amg',name:'Mercedes-AMG GT',desc:'خانة استيراد: أضف ملف GLB مرخّصًا لهذه الفئة.',brandModel:true,speedBonus:1.0 },
  { id:'lamborghini',name:'Lamborghini Huracán',desc:'خانة استيراد: أضف ملف GLB مرخّصًا لهذه الفئة.',brandModel:true,speedBonus:1.02 },
  { id:'ferrari',name:'Ferrari 488 GTB',desc:'خانة استيراد: أضف ملف GLB مرخّصًا لهذه الفئة.',brandModel:true,speedBonus:1.02 },
  { id:'nissan_gtr',name:'Nissan GT-R',desc:'خانة استيراد: أضف ملف GLB مرخّصًا لهذه الفئة.',brandModel:true,speedBonus:.99 }
];

const CAR_COLORS = [
  { id: 'red', name: 'أحمر معدني', hex: '#dc2626' },
  { id: 'gold', name: 'ذهبي لوسيل', hex: '#eab308' },
  { id: 'blue', name: 'أزرق ملكي', hex: '#2563eb' },
  { id: 'emerald', name: 'أخضر زمردي', hex: '#10b981' },
  { id: 'white', name: 'أبيض لؤلؤي', hex: '#f8fafc' },
  { id: 'purple', name: 'بنفسجي ليلي', hex: '#7c3aed' }
];

/*
 * Every environment is an "inspired" recreation (not exact geography). Fields:
 *   theme       scenery generator (see 60-world.js)    water   'sea' | 'nile' | null (right-hand side of the route)
 *   ground      surface type                           elev    road elevation amplitude (m)
 *   sunAz/sunEl position of the sun in the sky texture (0..1)
 */
const ENVIRONMENTS = {
  doha: {
    id:'doha',name:'الدوحة — كورنيش وأبراج ويست باي',icon:'🇶🇦',
    desc:'مضمار مستوحى من كورنيش الدوحة: البحر والمشاة والنخيل وأبراج زجاجية بأشكال مميزة. تصميم افتراضي مستوحى وليس خريطة جغرافية مطابقة.',
    theme:'gulf',cityStyle:'gulf',isUrban:true,water:'sea',ground:'stone',elev:1.1,
    skyTop:0x4f9fe6,skyBottom:0xcfeaf8,fogColor:0xc3e1ec,groundColor:0xc9bea0,sunColor:0xfff0d2,sunIntensity:1.55,ambientIntensity:0.78,isNight:false,sunAz:.78,sunEl:.27
  },
  cairo: {
    id:'cairo',name:'القاهرة — النيل وأبراج الحجر',icon:'🇪🇬',
    desc:'مضمار مستوحى من القاهرة: النيل والمراكب الشراعية والعمارات ذات الشرفات والمآذن وبرج شبكي. تصميم افتراضي مستوحى وليس خريطة جغرافية مطابقة.',
    theme:'cairo',cityStyle:'cairo',isUrban:true,water:'nile',ground:'dirt',elev:1.4,
    skyTop:0x78b2d8,skyBottom:0xf6d9b0,fogColor:0xe3d2b4,groundColor:0xb69d7f,sunColor:0xffe2b0,sunIntensity:1.4,ambientIntensity:0.74,isNight:false,sunAz:.72,sunEl:.31
  },
  dubai: {
    id:'dubai',name:'دبي — الأبراج الحديثة',icon:'🇦🇪',
    desc:'شارع حضري مستوحى من دبي: أبراج زجاجية شاهقة وبرج إبري ونخيل. تصميم افتراضي مستوحى وليس خريطة جغرافية مطابقة.',
    theme:'gulf',cityStyle:'gulf',isUrban:true,water:null,ground:'sand',elev:1.0,towerBias:1.5,landmark:'spire',
    skyTop:0x59a5e6,skyBottom:0xe9f0fc,fogColor:0xcddce6,groundColor:0xc9b190,sunColor:0xffffff,sunIntensity:1.45,ambientIntensity:0.72,isNight:false,sunAz:.7,sunEl:.26
  },
  riyadh: {
    id:'riyadh',name:'الرياض — المدينة الصحراوية',icon:'🇸🇦',
    desc:'شارع مستوحى من الرياض: أبراج حجرية وزجاجية ونخيل ولون الصحراء. تصميم افتراضي مستوحى وليس خريطة جغرافية مطابقة.',
    theme:'gulf',cityStyle:'gulf',isUrban:true,water:null,ground:'desert',elev:1.2,towerBias:.8,landmark:'gate',
    skyTop:0x62a4d6,skyBottom:0xf7d8ad,fogColor:0xe8d3b0,groundColor:0xcdad85,sunColor:0xffe2bd,sunIntensity:1.5,ambientIntensity:0.7,isNight:false,sunAz:.66,sunEl:.3
  },
  london: {
    id:'london',name:'لندن — الشوارع الأوروبية',icon:'🇬🇧',
    desc:'مضمار مستوحى من لندن: واجهات الطوب والمداخن وبرج الساعة والنهر. تصميم افتراضي مستوحى وليس خريطة جغرافية مطابقة.',
    theme:'europe',cityStyle:'europe',facade:'brick',isUrban:true,water:null,ground:'grass',elev:1.6,landmark:'clock',
    skyTop:0x7f9aae,skyBottom:0xcbd6da,fogColor:0xbdc8cd,groundColor:0x71846d,sunColor:0xe4eefb,sunIntensity:0.95,ambientIntensity:0.88,isNight:false,sunAz:.6,sunEl:.35
  },
  paris: {
    id:'paris',name:'باريس — الجادات الكلاسيكية',icon:'🇫🇷',
    desc:'مضمار مستوحى من باريس: عمارات حجرية بأسقف مانسارد وشرفات حديدية وبرج شبكي. تصميم افتراضي مستوحى وليس خريطة جغرافية مطابقة.',
    theme:'europe',cityStyle:'europe',facade:'haussmann',isUrban:true,water:null,ground:'stone',elev:1.2,landmark:'lattice',
    skyTop:0x82a9d3,skyBottom:0xf1e7d2,fogColor:0xd9d4c8,groundColor:0x9aa090,sunColor:0xfff5de,sunIntensity:1.2,ambientIntensity:0.8,isNight:false,sunAz:.74,sunEl:.3
  },
  istanbul: {
    id:'istanbul',name:'إسطنبول — بين الطرازين',icon:'🇹🇷',
    desc:'مضمار مستوحى من إسطنبول: بيوت ملونة وقباب ومآذن وجسر على المضيق. تصميم افتراضي مستوحى وليس خريطة جغرافية مطابقة.',
    theme:'historic',cityStyle:'historic',isUrban:true,water:'sea',ground:'stone',elev:2.2,landmark:'mosque',
    skyTop:0x539bbd,skyBottom:0xfbd6b6,fogColor:0xd1d5c8,groundColor:0x998e7a,sunColor:0xffefd7,sunIntensity:1.25,ambientIntensity:0.8,isNight:false,sunAz:.68,sunEl:.3
  },
  new_york: {
    id:'new_york',name:'نيويورك — ناطحات السحاب',icon:'🇺🇸',
    desc:'شوارع مستوحاة من مانهاتن: ناطحات سحاب متدرجة وخزانات مياه وسلالم نجاة. تصميم افتراضي مستوحى وليس خريطة جغرافية مطابقة.',
    theme:'metropolis',cityStyle:'metropolis',isUrban:true,water:null,ground:'stone',elev:.6,towerBias:1.7,landmark:'stepped',
    skyTop:0x689bc9,skyBottom:0xbfdaf3,fogColor:0xb2c3d2,groundColor:0x6c747c,sunColor:0xeaf4ff,sunIntensity:1.15,ambientIntensity:0.72,isNight:false,sunAz:.62,sunEl:.3
  },
  custom_city: {
    id:'custom_city',name:'مدينة أختارها بنفسي',icon:'🗺️',
    desc:'مدينة افتراضية باسم تختاره مع طابع معماري قابل للتخصيص.',
    theme:'gulf',cityStyle:'gulf',isUrban:true,water:null,ground:'sand',elev:1.2,
    skyTop:0x78b6e0,skyBottom:0xd8eaf4,fogColor:0xbcd8df,groundColor:0xc0ad92,sunColor:0xffe9c5,sunIntensity:1.3,ambientIntensity:0.75,isNight:false,sunAz:.74,sunEl:.3
  },
  mountain: {
    id:'mountain',name:'طريق الجبال المشمس',icon:'🏔️',
    desc:'طريق سريع بين القمم الجبلية والأشجار الخضراء تحت أشعة الشمس',
    theme:'alpine',ground:'grass',elev:5.0,
    skyTop:0x2a5fbf,skyBottom:0xa4cdf7,fogColor:0xa7cdf2,groundColor:0x3f6a3a,sunColor:0xfffbeb,sunIntensity:1.25,ambientIntensity:0.65,isNight:false,sunAz:.8,sunEl:.24
  },
  qatar_desert: {
    id:'qatar_desert',name:'طريق صحراء قطر الذهبي',icon:'🏜️',
    desc:'كثبان رملية ذهبية ونخيل وأقواس مستوحاة من طرق قطر الحديثة',
    theme:'desert',ground:'desert',elev:2.2,
    skyTop:0x2a62d6,skyBottom:0xfde8a8,fogColor:0xf6d99a,groundColor:0xd9a45e,sunColor:0xfef3c7,sunIntensity:1.35,ambientIntensity:0.7,isNight:false,sunAz:.72,sunEl:.28
  },
  city: {
    id:'city',name:'حلبة المدينة الحديثة',icon:'🌆',
    desc:'أبراج زجاجية حديثة وجسور سريعة وإضاءة حضرية متطورة',
    theme:'metropolis',cityStyle:'metropolis',isUrban:true,ground:'stone',elev:.8,towerBias:1.4,
    skyTop:0x2c6fb5,skyBottom:0x9fd3f2,fogColor:0x9fcbe6,groundColor:0x4b5768,sunColor:0xffffff,sunIntensity:1.15,ambientIntensity:0.65,isNight:false,sunAz:.7,sunEl:.3
  },
  countryside: {
    id:'countryside',name:'الطريق الريفي الأخضر',icon:'🌳',
    desc:'تلال خضراء ممتدة وغابات طبيعية وأسوار خشبية على جانبي الطريق',
    theme:'country',ground:'grass',elev:3.4,
    skyTop:0x1b86d0,skyBottom:0xc4e6fa,fogColor:0xbfe2f8,groundColor:0x4d8a3a,sunColor:0xffffff,sunIntensity:1.2,ambientIntensity:0.7,isNight:false,sunAz:.7,sunEl:.3
  },
  night: {
    id:'night',name:'حلبة السباق الليلية',icon:'🌙',
    desc:'سباق ليلي مثير تحت النجوم مع أعمدة الإنارة المضيئة ومصابيح السيارة القوية',
    theme:'metropolis',cityStyle:'metropolis',isUrban:true,ground:'stone',elev:.8,towerBias:1.2,
    skyTop:0x050a1c,skyBottom:0x16224a,fogColor:0x0c1428,groundColor:0x141a28,sunColor:0x7fa6ff,sunIntensity:0.4,ambientIntensity:0.34,isNight:true,sunAz:.3,sunEl:.2
  }
};

const DEFAULT_QUESTIONS = [
  {
    id: 'q1',
    text: 'تقع دولة قطر في شرق شبه الجزيرة العربية وتطل على الخليج العربي؟',
    type: 'tf',
    options: ['نعم', 'لا'],
    correctAnswer: 'نعم',
    subject: 'الدراسات الاجتماعية',
    difficulty: 'سهل',
    hint: 'تذكر موقع قطر الجغرافي في منطقة الخليج العربي.',
    image: '',
    enabled: true
  },
  {
    id: 'q2',
    text: 'هل الضوء ينتقل في الفراغ بسرعة أبطأ من سرعة الصوت؟',
    type: 'tf',
    options: ['نعم', 'لا'],
    correctAnswer: 'لا',
    subject: 'العلوم العامة',
    difficulty: 'سهل',
    hint: 'نحن نرى البرق في السماء قبل أن نسمع صوت الرعد!',
    image: '',
    enabled: true
  },
  {
    id: 'q3',
    text: 'الفعل «يَكْتُبُ» في اللغة العربية يُصنّف على أنه فعل مضارع؟',
    type: 'tf',
    options: ['نعم', 'لا'],
    correctAnswer: 'نعم',
    subject: 'اللغة العربية',
    difficulty: 'سهل',
    hint: 'الفعل يدل على حدث يقع في الزمن الحاضر ويبدأ بأحد حروف المضارعة.',
    image: '',
    enabled: true
  },
  {
    id: 'q4',
    text: 'حاصل ضرب العدد 8 في العدد 7 يساوي 48؟',
    type: 'tf',
    options: ['نعم', 'لا'],
    correctAnswer: 'لا',
    subject: 'الرياضيات',
    difficulty: 'متوسط',
    hint: '8 × 7 = 56 وليس 48.',
    image: '',
    enabled: true
  },
  {
    id: 'q5',
    text: 'ما هو الغاز الأساسي الذي تنتجه النباتات الخضراء أثناء عملية البناء الضوئي؟',
    type: 'mcq',
    options: ['غاز الأكسجين', 'غاز النيتروجين', 'غاز الهيليوم', 'بخار الماء فقط'],
    correctAnswer: 'غاز الأكسجين',
    subject: 'العلوم العامة',
    difficulty: 'متوسط',
    hint: 'هو الغاز الضروري لتنفس الإنسان والكائنات الحية.',
    image: '',
    enabled: true
  },
  {
    id: 'q6',
    text: 'العدد الأولي هو العدد الأكبر من 1 ولا يقبل القسمة إلا على نفسه وعلى الواحد الصحيح؟',
    type: 'tf',
    options: ['نعم', 'لا'],
    correctAnswer: 'نعم',
    subject: 'الرياضيات',
    difficulty: 'متوسط',
    hint: 'من أمثلة الأعداد الأولية: 2، 3، 5، 7، 11.',
    image: '',
    enabled: true
  }
];

function createDefaultConfig() {
  return {
    schoolName: 'مدرسة الأبطال النموذجية',
    deptName: 'قسم تكنولوجيا التعليم والأنشطة التربوية',
    teacherName: 'أ/ محمود الشبراوي',
    gameTitle: 'سباق الأبطال ثلاثي الأبعاد',
    gameSubtitle: 'تعلّم، أجب، وانطلق نحو الفوز!',
    schoolLogo: '',
    victoryMsg: 'مبروك يا بطل! لقد أنهيت السباق بنجاح!',
    praiseMsgs: ['أحسنت يا بطل!', 'إجابة رائعة!', 'أنت متسابق ذكي!', 'واصل التقدم!'],
    retryMsgs: ['حاول مرة أخرى!', 'فكر جيدًا يا بطل!', 'أنت تستطيع!'],
    carModel: 'ferrari_458_real',
    schemaV: 8,
    visualUpgrade: 4,
    carColor: '#dc2626',
    trackId: 'doha',
    customCityName: 'مدينتي',
    customCityStyle: 'gulf',
    customCarData: '',
    customCarHeading: '-z',
    carAssets: {}, // Optional user-supplied branded GLB assets; original geometry is not fabricated
    collisionPenalty: 100,
    trafficPenalty: 70,
    startingScore: 1000,
    roadDifficulty: 'normal',
    steeringAssist: 0.35,
    aiCount: 6,
    checkpointCount: 5,
    questionOrder: 'fixed',
    checkpointSpacing: 260,
    maxSpeed: 220,
    questionTimer: 0,
    questionScale: 1,
    aiEnabled: true,
    autoDrive: false,
    touchMode: 'free',
    freeTouchV7: true,
    graphicsQuality: 'auto',
    classroomMode: false,        // classroom performance mode: stable frame rate on weak smartboards
    steeringSensitivity: 1.0,    // 0.5 (gentle) .. 1.6 (sharp)
    autoAccel: true,             // automatic throttle (touch-free driving)
    cameraDefault: 'chase',      // chase | low | hood
    soundOn: true,
    carHeading: {},              // per-model forward-axis override: {modelId:'auto'|'-z'|'+z'|'+x'|'-x'}
    lowPerfAuto: true,
    volMusic: 0.7,
    volEngine: 0.8,
    volSfx: 0.9,
    questions: JSON.parse(JSON.stringify(DEFAULT_QUESTIONS))
  };
}

let APP_CONFIG = createDefaultConfig();

/* ===== 10-storage ===== */
/* ----------------------- 2. INDEXEDDB STORAGE ENGINE (with safe migration + backup) ----------------------- */
const DB_NAME = 'ChampionsRace3D_DB';
const DB_VERSION = 1;
const STORE_NAME = 'settings_store';
const BACKUP_KEY = 'backup_pre_v8';
const BACKUP_LS = 'ChampionsRace3D_Backup_preV8';
const STUDENT_PREFS_KEY = 'ChampionsRace3D_StudentPrefs';
const STUDENT_PREF_KEYS = ['volMusic', 'volEngine', 'volSfx', 'graphicsQuality', 'touchMode', 'steeringSensitivity', 'cameraDefault', 'classroomMode', 'soundOn', 'autoDrive'];

/**
 * Merge a stored configuration into the new defaults WITHOUT touching questions or the user's settings.
 * A one-time backup of the exact pre-upgrade record is written before anything is changed.
 */
function migrateConfig(stored){
  const merged = Object.assign(createDefaultConfig(), stored);
  const wasOld = !(stored && stored.schemaV >= 8);
  if (wasOld) {
    merged.schemaV = 8;
    // v7 stored 'supercar' as the procedural default: move to the real PBR car, but never override a deliberate choice.
    if (!Object.prototype.hasOwnProperty.call(stored,'visualUpgrade') && merged.carModel==='supercar') merged.carModel='ferrari_458_real';
    if (!stored.freeTouchV7) { merged.touchMode='free'; merged.freeTouchV7=true; }
    // older default AI count (5) becomes the new default only if the teacher never changed it
    if (stored.aiCount===5) merged.aiCount=6;
    // never replace questions: keep the teacher's bank exactly as stored
    if (Array.isArray(stored.questions) && stored.questions.length) merged.questions = stored.questions;
  }
  merged.visualUpgrade = 4;
  return { merged, wasOld };
}

const StorageManager = {
  db: null,
  async init() {
    if (window.__EXPORTED_CONFIG__ || window.__STUDENT_ONLY_BUILD__) {
      const m = migrateConfig(window.__EXPORTED_CONFIG__ || createDefaultConfig());
      APP_CONFIG = m.merged;
      // student devices may keep their own comfort preferences (sound, quality, touch style); questions & identity stay locked
      try { const pr = JSON.parse(localStorage.getItem(STUDENT_PREFS_KEY) || 'null'); if (pr) STUDENT_PREF_KEYS.forEach((k) => { if (pr[k] !== undefined) APP_CONFIG[k] = pr[k]; }); } catch (e) {}
      return APP_CONFIG;
    }
    return new Promise((resolve) => {
      if (!window.indexedDB) { this.loadFallback(); resolve(APP_CONFIG); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { this.loadFallback(); resolve(APP_CONFIG); return; }
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = (e) => { this.db = e.target.result; this.load().then(resolve); };
      req.onerror = () => { this.loadFallback(); resolve(APP_CONFIG); };
      req.onblocked = () => { this.loadFallback(); resolve(APP_CONFIG); };
    });
  },
  async load() {
    if (!this.db) { this.loadFallback(); return APP_CONFIG; }
    return new Promise((resolve) => {
      let getReq;
      try { getReq = this.db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('main_config'); }
      catch (e) { this.loadFallback(); resolve(APP_CONFIG); return; }
      getReq.onsuccess = async () => {
        if (getReq.result) {
          const { merged, wasOld } = migrateConfig(getReq.result);
          if (wasOld) { await this.writeBackup(getReq.result); }
          APP_CONFIG = merged;
          if (wasOld) queueMicrotask(() => this.save(APP_CONFIG).catch(console.warn));
        }
        resolve(APP_CONFIG);
      };
      getReq.onerror = () => resolve(APP_CONFIG);
    });
  },
  async writeBackup(raw) {
    try { localStorage.setItem(BACKUP_LS, JSON.stringify(raw)); } catch (e) {}
    if (!this.db) return;
    await new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(raw, BACKUP_KEY);
        tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); tx.onabort = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  },
  /** returns the raw pre-upgrade record if one exists (for the teacher "restore backup" button) */
  async readBackup() {
    if (this.db) {
      const v = await new Promise((resolve) => {
        try { const r = this.db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(BACKUP_KEY); r.onsuccess = () => resolve(r.result || null); r.onerror = () => resolve(null); }
        catch (e) { resolve(null); }
      });
      if (v) return v;
    }
    try { const raw = localStorage.getItem(BACKUP_LS); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  },
  async save(cfg = APP_CONFIG) {
    APP_CONFIG = cfg;
    if (window.__STUDENT_ONLY_BUILD__) { // student builds never overwrite questions/identity; only comfort preferences are remembered
      try { const pr = {}; STUDENT_PREF_KEYS.forEach((k) => { pr[k] = cfg[k]; }); localStorage.setItem(STUDENT_PREFS_KEY, JSON.stringify(pr)); } catch (e) {}
      return true;
    }
    if (!this.db) {
      try { localStorage.setItem('ChampionsRace3D_Fallback', JSON.stringify(cfg)); } catch (e) {}
      return true;
    }
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(cfg, 'main_config');
        tx.oncomplete = () => resolve(true);
        tx.onerror = (err) => reject(err);
      } catch (err) { reject(err); }
    });
  },
  loadFallback() {
    try {
      const raw = localStorage.getItem('ChampionsRace3D_Fallback');
      if (raw) {
        const parsed = JSON.parse(raw);
        const { merged, wasOld } = migrateConfig(parsed);
        if (wasOld) { try { localStorage.setItem(BACKUP_LS, raw); } catch (e) {} }
        APP_CONFIG = merged;
      }
    } catch (e) {}
  }
};

/* ===== 20-audio ===== */
class RacingSoundEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.muted = false;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.musicTimer = null;
    this.isPlayingEngine = false;
    this.musicStep = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.unlocked && this.ctx) {
      // Play silent buffer for iOS Safari unlock
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
      this.unlocked = true;
    }
  }

  getSfxVol() {
    return this.muted ? 0 : APP_CONFIG.volSfx;
  }

  getEngineVol() {
    return this.muted ? 0 : APP_CONFIG.volEngine;
  }

  getMusicVol() {
    return this.muted ? 0 : APP_CONFIG.volMusic;
  }

  startEngineSound() {
    this.unlock();
    if (!this.ctx || this.isPlayingEngine) return;
    const now = this.ctx.currentTime;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineOsc1.frequency.setValueAtTime(52, now);
    this.engineOsc2.frequency.setValueAtTime(104, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);

    this.engineGain.gain.setValueAtTime(0.001, now);
    this.engineGain.gain.exponentialRampToValueAtTime(Math.max(0.001, this.getEngineVol() * 0.14), now + 0.35);

    this.engineOsc1.connect(filter);
    this.engineOsc2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);
    this.isPlayingEngine = true;
  }

  updateEngineRPM(speedRatio, isBraking = false) {
    if (!this.ctx || !this.isPlayingEngine || !this.engineOsc1) return;
    const now = this.ctx.currentTime;
    const baseFreq = 48 + speedRatio * 145;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.02, now, 0.06);
    const targetGain = this.muted ? 0.0001 : (0.04 + speedRatio * 0.12) * this.getEngineVol() * (isBraking ? 0.6 : 1.0);
    this.engineGain.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, 0.08);
  }

  revEngine() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(75, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.55);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22 * this.getEngineVol(), now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Authentic dual-tone automotive horn (F4 ~349Hz + A4 ~440Hz / 415Hz + 510Hz)
  playCarHorn(celebratoryPattern = false) {
    this.unlock();
    if (!this.ctx || this.getSfxVol() <= 0) return;

    const triggerBeep = (startOffset, duration) => {
      const t0 = this.ctx.currentTime + startOffset;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(412, t0);
      osc2.frequency.setValueAtTime(512, t0);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(850, t0);
      filter.Q.setValueAtTime(1.8, t0);

      const peak = 0.28 * this.getSfxVol();
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
      gain.gain.setValueAtTime(peak, t0 + duration - 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t0);
      osc2.start(t0);
      osc1.stop(t0 + duration + 0.02);
      osc2.stop(t0 + duration + 0.02);
    };

    if (celebratoryPattern) {
      // Joyful "Beep - Beep - Beeeeep!"
      triggerBeep(0.0, 0.16);
      triggerBeep(0.22, 0.16);
      triggerBeep(0.45, 0.42);
    } else {
      triggerBeep(0.0, 0.32);
    }
  }

  // Forceful tire screech & hydraulic brake sound
  playStrongBrake() {
    this.unlock();
    if (!this.ctx || this.getSfxVol() <= 0) return;
    const now = this.ctx.currentTime;

    // White noise buffer for tire friction screech
    const bufferSize = this.ctx.sampleRate * 0.65;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.45));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1750, now);
    bandpass.frequency.linearRampToValueAtTime(950, now + 0.6);
    bandpass.Q.setValueAtTime(4.5, now);

    const screechOsc = this.ctx.createOscillator();
    screechOsc.type = 'sawtooth';
    screechOsc.frequency.setValueAtTime(980, now);
    screechOsc.frequency.exponentialRampToValueAtTime(320, now + 0.55);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32 * this.getSfxVol(), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.64);

    noise.connect(bandpass);
    screechOsc.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    screechOsc.start(now);
    screechOsc.stop(now + 0.6);
  }

  playBarrierServo() {
    this.unlock();
    if (!this.ctx || this.getSfxVol() <= 0) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(360, now + 0.75);
    gain.gain.setValueAtTime(0.14 * this.getSfxVol(), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.82);
  }

  playSuccessFanfare() {
    this.unlock();
    if (!this.ctx || this.getSfxVol() <= 0) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.24 * this.getSfxVol(), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  playWrongWarning() {
    this.unlock();
    if (!this.ctx || this.getSfxVol() <= 0) return;
    const notes = [220, 174.61];
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.18;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.22 * this.getSfxVol(), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  playVictoryAnthem() {
    this.unlock();
    if (!this.ctx || this.getSfxVol() <= 0) return;
    const melody = [
      { f: 523.25, d: 0.18, t: 0.0 },
      { f: 659.25, d: 0.18, t: 0.2 },
      { f: 783.99, d: 0.18, t: 0.4 },
      { f: 1046.5, d: 0.42, t: 0.6 },
      { f: 783.99, d: 0.18, t: 1.08 },
      { f: 1046.5, d: 0.65, t: 1.3 }
    ];
    melody.forEach((n) => {
      const t0 = this.ctx.currentTime + n.t;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t0);
      gain.gain.setValueAtTime(0.28 * this.getSfxVol(), t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.d);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.d + 0.02);
    });
  }

  startBackgroundMusic() {
    this.unlock();
    if (this.musicTimer) return;
    const bassLine = [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.getMusicVol() <= 0.01 || GameEngine.state === 'MENU') return;
      const freq = bassLine[this.musicStep % bassLine.length];
      this.musicStep++;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.07 * this.getMusicVol(), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    }, 260);
  }

  /** Impact thud + metallic crunch for boundary / traffic collisions (synthesised, no audio files). */
  playCrash() {
    this.unlock();
    if (!this.ctx || this.getSfxVol() <= 0) return;
    const c = this.ctx, now = c.currentTime, vol = this.getSfxVol();
    const len = Math.floor(c.sampleRate * 0.55), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2); }
    const noise = c.createBufferSource(); noise.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, now); f.frequency.exponentialRampToValueAtTime(260, now + 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0.7 * vol, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    noise.connect(f); f.connect(g); g.connect(c.destination); noise.start(now);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(130, now); o.frequency.exponentialRampToValueAtTime(38, now + 0.35);
    const og = c.createGain(); og.gain.setValueAtTime(0.9 * vol, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    o.connect(og); og.connect(c.destination); o.start(now); o.stop(now + 0.45);
  }

  /** Short tyre-squeal burst used while the car slides. Rate-limited by the caller. */
  playSkid() {
    if (!this.ctx || this.getSfxVol() <= 0) return;
    const c = this.ctx, now = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(760, now); o.frequency.linearRampToValueAtTime(980, now + 0.28);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 6;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.06 * this.getSfxVol(), now + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    o.connect(f); f.connect(g); g.connect(c.destination); o.start(now); o.stop(now + 0.32);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.updateEngineRPM(0);
    return this.muted;
  }
}

const SoundFX = new RacingSoundEngine();

/* ===== 30-path ===== */
/* ----------------------- 4a. ROAD PATH: ONE SPLINE SHARED BY VISUALS, COLLISION, AI, CAMERA ----------------------- */
/*
 * The road is a real 3D navigable spline (centripetal-free uniform Catmull-Rom through control points that
 * are generated from a deterministic curvature script: straights, gentle / medium / sharp bends).
 * The spline is re-sampled to a 1 m arc-length table. EVERYTHING that needs the road geometry reads this
 * table: road meshes, kerbs, guardrails, scenery placement, checkpoints, AI cars, boundary collision and camera.
 *
 * Conventions
 *   s      distance along the road centre line in metres (0 at the start grid, increasing forward)
 *   d      lateral offset from the centre line in metres, POSITIVE = to the driver's RIGHT
 *   yaw    three.js rotation.y that makes an object's local -Z axis point along the road
 *   curv   d(yaw)/ds in 1/m, POSITIVE = road turns LEFT
 */
function mulberry32(seed){
  let a=seed>>>0;
  return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}
function hashString(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
const smooth01=x=>{x=x<0?0:x>1?1:x;return x*x*(3-2*x);};

const RoadPath = {
  ready:false,
  STEP:1,                 // table resolution (metres)
  length:0,
  X:null,Y:null,Z:null,TX:null,TZ:null,CURV:null,
  info:{segments:[],minRadius:0,maxHeadingDeg:0},

  /**
   * opts: {seed, length, difficulty:'easy'|'normal'|'hard', elevation:metres}
   */
  build(opts){
    const rnd=mulberry32(opts.seed||1);
    const L=Math.max(600,opts.length||4000);
    const diff=opts.difficulty||'normal';
    const radiusScale=diff==='easy'?1.45:diff==='hard'?0.84:1.0;
    const sharpChance=diff==='easy'?0.04:diff==='hard'?0.30:0.17;
    const mediumChance=diff==='easy'?0.30:diff==='hard'?0.40:0.38;
    const elev=opts.elevation!==undefined?opts.elevation:1.6;

    // 1) curvature script -> dense polyline (0.5 m integration)
    const segs=[];
    let s=0;
    const pushSeg=(kind,len,curv)=>{segs.push({kind,s0:s,len,curv});s+=len;};
    pushSeg('straight',150,0); // starting grid + first approach is straight so every player can orient
    let heading=0; // integrate analytic heading to steer the script away from a runaway turn
    while(s<L+300){
      const r=rnd();
      let kind='straight',len=0,curv=0;
      if(r<sharpChance){kind='sharp';}
      else if(r<sharpChance+mediumChance){kind='medium';}
      else if(r<sharpChance+mediumChance+0.28){kind='gentle';}
      if(kind==='straight'){len=70+rnd()*150;}
      else{
        let R,ang;
        if(kind==='gentle'){R=(430+rnd()*300)*radiusScale;ang=(14+rnd()*20)*Math.PI/180;}
        else if(kind==='medium'){R=(230+rnd()*110)*radiusScale;ang=(26+rnd()*28)*Math.PI/180;}
        else{R=(125+rnd()*50)*radiusScale;ang=(42+rnd()*36)*Math.PI/180;}
        R=Math.max(98,R);
        let sign=rnd()<0.5?1:-1;
        if(heading>0.40)sign=-1;else if(heading<-0.40)sign=1;
        if(segs.length<3&&kind!=='gentle'){kind='gentle';R=(520+rnd()*160)*radiusScale;ang=(14+rnd()*8)*Math.PI/180;} // first bend is always gentle
        // never let the cumulative heading drift past +-62 deg so the route stays a compact corridor (no self-overlap)
        const room=1.08-sign*heading;
        if(ang>room)ang=Math.max(0.17,room);
        len=R*ang+2*Math.min(36,R*ang*0.3); // ramps add length so the full turn is reached
        curv=sign/R;
        heading+=curv*(R*ang);
      }
      pushSeg(kind,len,curv);
    }
    // curvature function with clothoid-like smooth ramps at both ends of each bend
    const kappaAt=(u)=>{
      for(let i=0;i<segs.length;i++){
        const g=segs[i];
        if(u<g.s0+g.len||i===segs.length-1){
          if(g.curv===0)return 0;
          const ramp=Math.min(36,g.len*0.3);
          const a=(u-g.s0)/ramp,b=(g.s0+g.len-u)/ramp;
          return g.curv*smooth01(Math.min(a,b,1));
        }
      }
      return 0;
    };
    const dsI=0.5,nI=Math.ceil((L+300)/dsI);
    const px=new Float32Array(nI+1),pz=new Float32Array(nI+1);
    let x=0,z=0,th=0,maxH=0;
    for(let i=0;i<=nI;i++){
      px[i]=x;pz[i]=z;
      const k=kappaAt(i*dsI);
      th+=k*dsI;
      if(Math.abs(th)>maxH)maxH=Math.abs(th);
      x+=-Math.sin(th)*dsI;z+=-Math.cos(th)*dsI;
    }
    // 2) control points every 16 m, plus smooth elevation
    const CP=16;
    const nCP=Math.floor((L+300)/CP);
    const ph1=rnd()*6.28,ph2=rnd()*6.28;
    const elevAt=(u)=>{
      const fade=smooth01((u-90)/110);
      return fade*elev*(0.62*Math.sin(u/227+ph1)+0.38*Math.sin(u/109+ph2));
    };
    const cx=[],cy=[],cz=[];
    for(let i=0;i<=nCP;i++){
      const idx=Math.min(nI,Math.round(i*CP/dsI));
      cx.push(px[idx]);cz.push(pz[idx]);cy.push(elevAt(i*CP));
    }
    // 3) Catmull-Rom evaluation (uniform, tension 0.5) -> dense samples
    const sub=24;
    const sx=[],sy=[],sz=[];
    const cr=(p0,p1,p2,p3,t)=>0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);
    for(let i=0;i<nCP;i++){
      const i0=Math.max(0,i-1),i1=i,i2=i+1,i3=Math.min(nCP,i+2);
      for(let k=0;k<sub;k++){
        const t=k/sub;
        sx.push(cr(cx[i0],cx[i1],cx[i2],cx[i3],t));
        sy.push(cr(cy[i0],cy[i1],cy[i2],cy[i3],t));
        sz.push(cr(cz[i0],cz[i1],cz[i2],cz[i3],t));
      }
    }
    sx.push(cx[nCP]);sy.push(cy[nCP]);sz.push(cz[nCP]);
    // 4) arc-length resample to exact 1 m steps
    const cum=[0];
    for(let i=1;i<sx.length;i++){
      const dx=sx[i]-sx[i-1],dy=sy[i]-sy[i-1],dz=sz[i]-sz[i-1];
      cum.push(cum[i-1]+Math.hypot(dx,dy,dz));
    }
    const total=cum[cum.length-1];
    const N=Math.floor(Math.min(total,L+200));
    const X=new Float32Array(N+1),Y=new Float32Array(N+1),Z=new Float32Array(N+1);
    let j=0;
    for(let i=0;i<=N;i++){
      while(j<cum.length-2&&cum[j+1]<i)j++;
      const span=cum[j+1]-cum[j]||1,f=(i-cum[j])/span;
      X[i]=sx[j]+(sx[j+1]-sx[j])*f;
      Y[i]=sy[j]+(sy[j+1]-sy[j])*f;
      Z[i]=sz[j]+(sz[j+1]-sz[j])*f;
    }
    // 5) tangents & curvature from the final table (central differences, then light smoothing)
    const TX=new Float32Array(N+1),TZ=new Float32Array(N+1),CURV=new Float32Array(N+1);
    const yawRaw=new Float32Array(N+1);
    for(let i=0;i<=N;i++){
      const a=Math.max(0,i-2),b=Math.min(N,i+2);
      let dx=X[b]-X[a],dz=Z[b]-Z[a];
      const m=Math.hypot(dx,dz)||1;dx/=m;dz/=m;
      TX[i]=dx;TZ[i]=dz;
      yawRaw[i]=Math.atan2(-dx,-dz);
    }
    for(let i=1;i<=N;i++){ // unwrap
      let d=yawRaw[i]-yawRaw[i-1];
      while(d>Math.PI){yawRaw[i]-=2*Math.PI;d=yawRaw[i]-yawRaw[i-1];}
      while(d<-Math.PI){yawRaw[i]+=2*Math.PI;d=yawRaw[i]-yawRaw[i-1];}
    }
    for(let i=0;i<=N;i++){
      const a=Math.max(0,i-6),b=Math.min(N,i+6);
      CURV[i]=(yawRaw[b]-yawRaw[a])/Math.max(1,b-a);
    }
    let minR=Infinity;for(let i=0;i<=N;i++){const k=Math.abs(CURV[i]);if(k>1e-5)minR=Math.min(minR,1/k);}
    Object.assign(this,{X,Y,Z,TX,TZ,CURV,length:N,ready:true});
    this.info={segments:segs.slice(0,40).map(g=>({kind:g.kind,s0:Math.round(g.s0),len:Math.round(g.len)})),minRadius:Math.round(minR),maxHeadingDeg:Math.round(maxH*180/Math.PI),difficulty:diff,length:N,seed:opts.seed};
    return this.info;
  },

  /** Interpolated frame at distance s. Writes into `o` (allocated once by the caller on hot paths). */
  at(s,o){
    o=o||{};
    if(s<0)s=0;else if(s>this.length-1.001)s=this.length-1.001;
    const i=s|0,f=s-i;
    o.x=this.X[i]+(this.X[i+1]-this.X[i])*f;
    o.y=this.Y[i]+(this.Y[i+1]-this.Y[i])*f;
    o.z=this.Z[i]+(this.Z[i+1]-this.Z[i])*f;
    let tx=this.TX[i]+(this.TX[i+1]-this.TX[i])*f,tz=this.TZ[i]+(this.TZ[i+1]-this.TZ[i])*f;
    const m=Math.hypot(tx,tz)||1;tx/=m;tz/=m;
    o.tx=tx;o.tz=tz;
    o.nx=-tz;o.nz=tx;                          // right-hand normal in the XZ plane
    o.yaw=Math.atan2(-tx,-tz);
    o.curv=this.CURV[i]+(this.CURV[i+1]-this.CURV[i])*f;
    o.slope=(this.Y[Math.min(this.length,i+2)]-this.Y[Math.max(0,i-1)])/3;
    return o;
  },

  /** World position of lateral offset d at distance s (writes o.x/o.y/o.z, o.yaw is the road yaw). */
  world(s,d,o){
    o=this.at(s,o);
    o.x+=o.nx*d;o.z+=o.nz*d;
    return o;
  },

  /** Largest safe approach speed (m/s) for upcoming bends, from lateral-acceleration comfort `aLat` (m/s^2). */
  cornerSpeed(s,lookahead,aLat){
    let kMax=0;
    const n=Math.min(this.length-1,Math.floor(s+lookahead));
    for(let i=Math.max(0,Math.floor(s));i<=n;i+=4){const k=Math.abs(this.CURV[i]);if(k>kMax)kMax=k;}
    return kMax<1e-5?Infinity:Math.sqrt(aLat/kMax);
  }
};

/* ===== 35-textures ===== */
/* ----------------------- 4b. PROCEDURAL PBR TEXTURE LAB (100% offline, generated locally) ----------------------- */
/*
 * No texture is downloaded. Everything is generated on the device from deterministic noise, then turned into
 * albedo + normal + roughness/metalness maps so the materials are real PBR (MeshStandardMaterial) instead of flat colour.
 */
const TexLab = {
  qualitySize:{low:256,medium:384,high:512},
  size:512,
  setQuality(preset){this.size=this.qualitySize[preset]||512;},

  canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;},

  // Tileable value noise (period = lattice cells), fbm of several octaves.
  _hash(ix,iy,seed){let h=(ix*374761393+iy*668265263+seed*2147483647)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967296;},
  noise(x,y,period,seed){
    const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
    const wrap=v=>((v%period)+period)%period;
    const a=this._hash(wrap(x0),wrap(y0),seed),b=this._hash(wrap(x0+1),wrap(y0),seed),
          c=this._hash(wrap(x0),wrap(y0+1),seed),d=this._hash(wrap(x0+1),wrap(y0+1),seed);
    const ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);
    return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;
  },
  fbm(u,v,basePeriod,octaves,seed){
    let amp=.5,sum=0,norm=0,p=basePeriod;
    for(let o=0;o<octaves;o++){sum+=amp*this.noise(u*p,v*p,p,seed+o*17);norm+=amp;amp*=.5;p*=2;}
    return sum/norm;
  },

  // Height field (Float32Array w*h, 0..1) -> tangent-space normal map canvas.
  heightToNormal(h,w,hh,strength){
    const c=this.canvas(w,hh),ctx=c.getContext('2d'),img=ctx.createImageData(w,hh),d=img.data;
    const at=(x,y)=>h[((y+hh)%hh)*w+((x+w)%w)];
    for(let y=0;y<hh;y++)for(let x=0;x<w;x++){
      const dx=(at(x+1,y)-at(x-1,y))*strength,dy=(at(x,y+1)-at(x,y-1))*strength;
      let nx=-dx,ny=dy,nz=1;const m=Math.hypot(nx,ny,nz);nx/=m;ny/=m;nz/=m;
      const i=(y*w+x)*4;d[i]=(nx*.5+.5)*255;d[i+1]=(ny*.5+.5)*255;d[i+2]=(nz*.5+.5)*255;d[i+3]=255;
    }
    ctx.putImageData(img,0,0);return c;
  },

  tex(canvas,{srgb=false,repeat=true,aniso=4}={}){
    const t=new THREE.CanvasTexture(canvas);
    if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;}
    if(srgb)t.encoding=THREE.sRGBEncoding;
    t.anisotropy=aniso;
    return t;
  },

  /* ------------ road & ground surfaces ------------ */
  // Real asphalt: aggregate speckle + binder variation in albedo, matching normal relief and roughness.
  asphalt(){
    const N=this.size,P=8,h=new Float32Array(N*N);
    const alb=this.canvas(N,N),ac=alb.getContext('2d'),ai=ac.createImageData(N,N);
    const rg=this.canvas(N,N),rc=rg.getContext('2d'),ri=rc.createImageData(N,N);
    const rnd=mulberry32(901);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N,v=y/N;
      let g=this.fbm(u,v,P,4,11)*.55+this.fbm(u,v,P*8,2,23)*.45;
      const speck=rnd();
      let hv=g;if(speck>.965)hv+=.35;else if(speck<.02)hv-=.25;
      h[y*N+x]=hv;
      const base=.115+g*.07+(speck>.965?.18:0)+(speck<.02?-.04:0);
      const l=Math.max(0,Math.min(1,base));
      const i=(y*N+x)*4;
      // slightly warm-grey asphalt in sRGB
      ai.data[i]=l*255*1.02;ai.data[i+1]=l*255;ai.data[i+2]=l*255*1.05;ai.data[i+3]=255;
      const rough=.78+g*.12+(speck>.965?-.12:0);
      ri.data[i]=0;ri.data[i+1]=Math.min(255,rough*255);ri.data[i+2]=0;ri.data[i+3]=255;
    }
    ac.putImageData(ai,0,0);rc.putImageData(ri,0,0);
    return {map:this.tex(alb,{srgb:true}),normalMap:this.tex(this.heightToNormal(h,N,N,2.6)),roughnessMap:this.tex(rg)};
  },

  // Generic ground: sand / grass / stone paving / dirt, tileable.
  ground(kind){
    const N=Math.min(this.size,384),P=6,h=new Float32Array(N*N);
    const alb=this.canvas(N,N),ac=alb.getContext('2d'),ai=ac.createImageData(N,N);
    const pal={
      sand:[[196,170,120],[214,190,140]],
      desert:[[205,160,95],[226,184,118]],
      grass:[[70,112,48],[102,140,62]],
      stone:[[150,142,128],[178,170,154]],
      dirt:[[116,96,70],[140,118,86]],
      rock:[[110,104,96],[150,142,130]]
    }[kind]||[[150,150,150],[180,180,180]];
    const rnd=mulberry32(77+kind.length);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){
      const u=x/N,v=y/N;
      const g=this.fbm(u,v,P,5,5+kind.length);
      let hv=g;
      if(kind==='stone'){ // paving slabs
        const sx=((x/(N/6))%1),sy=((y/(N/6))%1);
        const joint=(sx<.04||sy<.04)?1:0;hv=g*.5+(joint?-.5:0)+.3;
      }
      h[y*N+x]=hv;
      const t=Math.max(0,Math.min(1,g*1.2-.1)),sp=rnd()*.08;
      const i=(y*N+x)*4;
      for(let k=0;k<3;k++)ai.data[i+k]=(pal[0][k]+(pal[1][k]-pal[0][k])*t)*(0.94+sp)*(kind==='stone'&&h[y*N+x]<.3?.62:1);
      ai.data[i+3]=255;
    }
    ac.putImageData(ai,0,0);
    return {map:this.tex(alb,{srgb:true}),normalMap:this.tex(this.heightToNormal(h,N,N,kind==='grass'?2.2:3.0))};
  },

  waterNormal(){
    const N=256,h=new Float32Array(N*N);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x/N,v=y/N;h[y*N+x]=this.fbm(u,v,4,4,303)*.7+Math.sin((u*6+v*2)*Math.PI*2)*.15+Math.sin((u*2-v*5)*Math.PI*2)*.15;}
    return this.tex(this.heightToNormal(h,N,N,2.2));
  },

  /* ------------ building facades (albedo + roughness/metalness + emissive + normal) ------------ */
  // One tile = 12 m wide x 12 m tall (4 floors of 3 m, 4 window bays of 3 m).
  facade(style,variant){
    const N=this.size,S=N/12; // pixels per metre
    const albC=this.canvas(N,N),a=albC.getContext('2d');
    const rmC=this.canvas(N,N),r=rmC.getContext('2d');   // G = roughness, B = metalness
    const emC=this.canvas(N,N),e=emC.getContext('2d');
    const hC=this.canvas(N,N),hc=hC.getContext('2d');   // height (white = proud)
    const rnd=mulberry32(hashString(style)+variant*7919);
    const P=(c,col)=>{c.fillStyle=col;};
    const rm=(rough,metal)=>`rgb(0,${Math.round(rough*255)},${Math.round(metal*255)})`;
    r.fillStyle=rm(.85,0);r.fillRect(0,0,N,N);
    e.fillStyle='#000';e.fillRect(0,0,N,N);
    hc.fillStyle='#808080';hc.fillRect(0,0,N,N);
    const mottled=(base,amp)=>{ // large soft stains over the whole wall
      const img=a.getImageData(0,0,N,N),d=img.data;
      for(let y=0;y<N;y+=1)for(let x=0;x<N;x+=1){
        const g=this.fbm(x/N,y/N,4,4,41+variant)-.5,sp=(rnd()-.5)*amp*.35,i=(y*N+x)*4;
        for(let k=0;k<3;k++)d[i+k]=Math.max(0,Math.min(255,d[i+k]*(1+g*amp+sp)));
      }
      a.putImageData(img,0,0);
    };
    const win=(x,y,w,h,opts={})=>{ // x,y,w,h in metres from the tile origin
      const px=x*S,py=y*S,pw=w*S,ph=h*S;
      const lit=rnd()<.34;
      const g=a.createLinearGradient(px,py,px+pw,py+ph);
      const t=opts.glass||[[30,55,72],[70,110,130]];
      g.addColorStop(0,`rgb(${t[0]})`);g.addColorStop(1,`rgb(${t[1]})`);
      a.fillStyle=g;
      if(opts.arch){a.beginPath();a.moveTo(px,py+ph);a.lineTo(px,py+pw*.5);a.arc(px+pw/2,py+pw*.5,pw/2,Math.PI,0);a.lineTo(px+pw,py+ph);a.closePath();a.fill();}
      else a.fillRect(px,py,pw,ph);
      r.fillStyle=rm(opts.gRough??.1,opts.gMetal??.6);
      if(opts.arch){r.beginPath();r.moveTo(px,py+ph);r.lineTo(px,py+pw*.5);r.arc(px+pw/2,py+pw*.5,pw/2,Math.PI,0);r.lineTo(px+pw,py+ph);r.closePath();r.fill();}
      else r.fillRect(px,py,pw,ph);
      if(lit){e.fillStyle=`rgb(${230+rnd()*25|0},${180+rnd()*40|0},${90+rnd()*50|0})`;
        if(opts.arch){e.beginPath();e.moveTo(px,py+ph);e.lineTo(px,py+pw*.5);e.arc(px+pw/2,py+pw*.5,pw/2,Math.PI,0);e.lineTo(px+pw,py+ph);e.closePath();e.fill();}
        else e.fillRect(px,py,pw,ph);}
      // recess
      hc.fillStyle='#404040';hc.fillRect(px,py,pw,ph);
    };
    const frame=(x,y,w,h,col,t)=>{a.strokeStyle=col;a.lineWidth=t*S;a.strokeRect(x*S,y*S,w*S,h*S);hc.strokeStyle='#d0d0d0';hc.lineWidth=t*S;hc.strokeRect(x*S,y*S,w*S,h*S);};

    if(style==='glass_tower'){
      const tints=[[[24,66,86],[78,138,160]],[[22,52,78],[96,142,186]],[[36,70,64],[110,160,148]],[[60,66,74],[150,160,170]]][variant%4];
      a.fillStyle='rgb(150,160,170)';a.fillRect(0,0,N,N);
      for(let fl=0;fl<4;fl++)for(let c=0;c<4;c++)win(c*3+.12,fl*3+.35,2.76,2.3,{glass:tints,gRough:.06,gMetal:.9});
      // spandrel panels
      for(let fl=0;fl<4;fl++){a.fillStyle='rgb(88,98,108)';a.fillRect(0,(fl*3)*S,N,.35*S);r.fillStyle=rm(.45,.7);r.fillRect(0,(fl*3)*S,N,.35*S);}
      for(let c=0;c<=4;c++){a.fillStyle='rgb(170,178,186)';a.fillRect((c*3-.06)*S,0,.12*S,N);r.fillStyle=rm(.3,.9);r.fillRect((c*3-.06)*S,0,.12*S,N);}
    }else if(style==='sand_stone'){
      const tone=[[214,190,152],[203,176,138],[224,202,168],[190,160,120]][variant%4];
      a.fillStyle=`rgb(${tone})`;a.fillRect(0,0,N,N);mottled(tone,.22);
      for(let fl=0;fl<4;fl++)for(let c=0;c<4;c++){
        const wx=c*3+.7,wy=fl*3+.55,ww=1.6,wh=1.9;
        win(wx,wy,ww,wh,{glass:[[36,48,58],[88,110,124]],gRough:.12,gMetal:.5});
        // mashrabiya-like lattice screen: crossing diagonals over the window
        a.strokeStyle='rgba(120,92,60,.9)';a.lineWidth=.045*S;hc.strokeStyle='#e8e8e8';hc.lineWidth=.05*S;
        for(let k=-8;k<=8;k++){
          a.beginPath();a.moveTo((wx+k*.2)*S,wy*S);a.lineTo((wx+k*.2+wh)*S,(wy+wh)*S);a.stroke();
          a.beginPath();a.moveTo((wx+k*.2+wh)*S,wy*S);a.lineTo((wx+k*.2)*S,(wy+wh)*S);a.stroke();
        }
        a.save();a.globalCompositeOperation='destination-over';a.restore();
        frame(wx-.08,wy-.08,ww+.16,wh+.16,'rgb(236,222,196)',.14);
      }
      // crenellated cornice line
      a.fillStyle='rgb(238,226,200)';a.fillRect(0,0,N,.22*S);
    }else if(style==='cairo'){
      const tones=[[216,186,140],[222,160,128],[190,176,150],[206,150,112],[170,160,150]];
      const tone=tones[variant%tones.length];
      a.fillStyle=`rgb(${tone})`;a.fillRect(0,0,N,N);mottled(tone,.34);
      const shutters=['rgb(70,98,62)','rgb(104,70,44)','rgb(52,82,104)'][variant%3];
      for(let fl=0;fl<4;fl++)for(let c=0;c<4;c++){
        const wx=c*3+.8,wy=fl*3+.5,ww=1.35,wh=2.0;
        win(wx,wy,ww,wh,{glass:[[28,40,50],[70,90,104]],gRough:.14,gMetal:.4});
        // louvered wooden shutters either side
        a.fillStyle=shutters;a.fillRect((wx-.5)*S,wy*S,.48*S,wh*S);a.fillRect((wx+ww+.02)*S,wy*S,.48*S,wh*S);
        a.strokeStyle='rgba(0,0,0,.25)';a.lineWidth=.02*S;
        for(let k=0;k<12;k++){const yy=(wy+k*wh/12)*S;a.beginPath();a.moveTo((wx-.5)*S,yy);a.lineTo((wx-.02)*S,yy);a.moveTo((wx+ww+.02)*S,yy);a.lineTo((wx+ww+.5)*S,yy);a.stroke();}
        hc.fillStyle='#a8a8a8';hc.fillRect((wx-.5)*S,wy*S,.48*S,wh*S);hc.fillRect((wx+ww+.02)*S,wy*S,.48*S,wh*S);
        // balcony slab + rail shadow line under the window (real 3D balconies are added as geometry)
        a.fillStyle='rgba(60,44,30,.55)';a.fillRect((wx-.3)*S,(wy+wh+.08)*S,(ww+.6)*S,.16*S);
        if(rnd()<.16){a.fillStyle='rgb(220,222,224)';a.fillRect((wx+.1)*S,(wy+wh-.55)*S,.7*S,.5*S);hc.fillStyle='#e0e0e0';hc.fillRect((wx+.1)*S,(wy+wh-.55)*S,.7*S,.5*S);} // A/C unit
      }
    }else if(style==='brick'){
      const tone=[[148,76,58],[132,70,56],[160,92,66],[118,92,82]][variant%4];
      a.fillStyle=`rgb(${tone})`;a.fillRect(0,0,N,N);
      const bh=.19*S,bw=.46*S;
      for(let row=0;row*bh<N;row++){
        const off=(row%2)*bw*.5;
        for(let x=-bw;x<N;x+=bw){
          const jit=.86+rnd()*.28;
          a.fillStyle=`rgb(${tone[0]*jit|0},${tone[1]*jit|0},${tone[2]*jit|0})`;
          a.fillRect(x+off+.5,row*bh+.5,bw-1.2,bh-1.2);
          hc.fillStyle='#b0b0b0';hc.fillRect(x+off+.5,row*bh+.5,bw-1.2,bh-1.2);
        }
      }
      for(let fl=0;fl<4;fl++)for(let c=0;c<4;c++){
        const wx=c*3+.75,wy=fl*3+.45,ww=1.5,wh=2.2;
        win(wx,wy,ww,wh,{glass:[[26,34,44],[66,84,100]],gRough:.12,gMetal:.45});
        frame(wx,wy,ww,wh,'rgb(236,234,226)',.12);
        a.strokeStyle='rgb(236,234,226)';a.lineWidth=.07*S;a.beginPath();a.moveTo((wx+ww/2)*S,wy*S);a.lineTo((wx+ww/2)*S,(wy+wh)*S);a.moveTo(wx*S,(wy+wh/3)*S);a.lineTo((wx+ww)*S,(wy+wh/3)*S);a.moveTo(wx*S,(wy+wh*2/3)*S);a.lineTo((wx+ww)*S,(wy+wh*2/3)*S);a.stroke();
        a.fillStyle='rgb(206,200,188)';a.fillRect((wx-.15)*S,(wy-.22)*S,(ww+.3)*S,.2*S);
      }
    }else if(style==='haussmann'){
      const tone=[[226,212,180],[214,198,164],[232,222,196],[204,190,160]][variant%4];
      a.fillStyle=`rgb(${tone})`;a.fillRect(0,0,N,N);mottled(tone,.16);
      for(let fl=0;fl<4;fl++){ // rustication
        a.strokeStyle='rgba(120,104,80,.45)';a.lineWidth=.03*S;
        for(let k=0;k<12;k++){const yy=(fl*3+k*.25)*S;a.beginPath();a.moveTo(0,yy);a.lineTo(N,yy);a.stroke();}
      }
      for(let fl=0;fl<4;fl++)for(let c=0;c<4;c++){
        const wx=c*3+.85,wy=fl*3+.3,ww=1.3,wh=2.55;
        win(wx,wy,ww,wh,{glass:[[30,42,54],[80,100,116]],gRough:.1,gMetal:.5,arch:fl===3});
        frame(wx-.08,wy-.08,ww+.16,wh+.1,'rgb(238,230,208)',.12);
        // wrought-iron balcony rail on floors 2 and 4
        if(fl%2===1){a.strokeStyle='rgb(30,32,36)';a.lineWidth=.04*S;const by=(wy+wh-.7)*S;a.beginPath();a.moveTo((wx-.35)*S,by);a.lineTo((wx+ww+.35)*S,by);a.stroke();
          for(let k=0;k<=12;k++){const bx=(wx-.35+k*(ww+.7)/12)*S;a.beginPath();a.moveTo(bx,by);a.lineTo(bx,by+.65*S);a.stroke();}
          hc.fillStyle='#cfcfcf';hc.fillRect((wx-.35)*S,by,(ww+.7)*S,.65*S);}
      }
    }else if(style==='istanbul'){
      const tones=[[222,176,150],[232,208,140],[160,196,190],[214,150,128],[196,170,206]];
      const tone=tones[variant%tones.length];
      a.fillStyle=`rgb(${tone})`;a.fillRect(0,0,N,N);mottled(tone,.2);
      for(let fl=0;fl<4;fl++)for(let c=0;c<4;c++){
        const wx=c*3+.85,wy=fl*3+.4,ww=1.3,wh=2.2;
        win(wx,wy,ww,wh,{glass:[[40,48,60],[96,112,128]],gRough:.12,gMetal:.45,arch:true});
        a.strokeStyle='rgb(248,244,236)';a.lineWidth=.12*S;
        a.beginPath();a.moveTo(wx*S,(wy+wh)*S);a.lineTo(wx*S,(wy+ww/2)*S);a.arc((wx+ww/2)*S,(wy+ww/2)*S,ww/2*S,Math.PI,0);a.lineTo((wx+ww)*S,(wy+wh)*S);a.stroke();
        a.fillStyle='rgba(80,52,34,.8)';a.fillRect((wx-.2)*S,(wy+wh)*S,(ww+.4)*S,.14*S);
      }
      a.fillStyle='rgb(150,100,70)';a.fillRect(0,0,N,.3*S);
    }else if(style==='nyc'){
      const tone=[[150,112,92],[120,116,118],[172,150,126],[96,84,78]][variant%4];
      a.fillStyle=`rgb(${tone})`;a.fillRect(0,0,N,N);mottled(tone,.28);
      for(let fl=0;fl<4;fl++)for(let c=0;c<4;c++){
        const wx=c*3+.65,wy=fl*3+.4,ww=1.7,wh=2.2;
        win(wx,wy,ww,wh,{glass:[[24,32,44],[70,88,104]],gRough:.1,gMetal:.5});
        a.strokeStyle='rgb(220,216,206)';a.lineWidth=.1*S;a.strokeRect(wx*S,wy*S,ww*S,wh*S);
        if(fl>0&&c%2===0){a.strokeStyle='rgb(20,22,24)';a.lineWidth=.05*S; // fire escape
          a.beginPath();a.moveTo((wx-.3)*S,(wy+wh+.1)*S);a.lineTo((wx+ww+.3)*S,(wy+wh+.1)*S);a.moveTo((wx-.3)*S,(wy+wh+.1)*S);a.lineTo((wx+ww+.3)*S,(wy+wh+.9)*S);a.stroke();}
      }
    }else{ // modern concrete
      const tone=[[190,190,188],[170,172,176],[205,200,190]][variant%3];
      a.fillStyle=`rgb(${tone})`;a.fillRect(0,0,N,N);mottled(tone,.18);
      for(let fl=0;fl<4;fl++)for(let c=0;c<4;c++)win(c*3+.3,fl*3+.5,2.4,2.0,{glass:[[30,52,70],[88,122,146]],gRough:.08,gMetal:.7});
    }
    // roughness: wall vs glass handled above; add subtle wall roughness noise
    // build normal map from height canvas
    const hd=hc.getImageData(0,0,N,N).data,hf=new Float32Array(N*N);
    for(let i=0;i<N*N;i++)hf[i]=hd[i*4]/255;
    const rmTex=this.tex(rmC);
    return {
      map:this.tex(albC,{srgb:true,aniso:4}),
      roughnessMap:rmTex,
      metalnessMap:rmTex,
      emissiveMap:this.tex(emC,{srgb:true}),
      normalMap:this.tex(this.heightToNormal(hf,N,N,3.4))
    };
  },

  /* ------------ small helper textures ------------ */
  sign(lines,{bg='#0b6b3a',fg='#ffffff',w=512,h=192,border='#ffffff'}={}){
    const c=this.canvas(w,h),x=c.getContext('2d');
    x.fillStyle=bg;x.fillRect(0,0,w,h);
    x.strokeStyle=border;x.lineWidth=8;x.strokeRect(10,10,w-20,h-20);
    x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.direction='rtl';
    const n=lines.length;
    lines.forEach((t,i)=>{x.font=(i===0?'800 ':'700 ')+(n>1?(i===0?58:40):66)+'px Cairo, sans-serif';x.fillText(t,w/2,(i+1)*h/(n+1));});
    const t=this.tex(c,{srgb:true,repeat:false,aniso:4});return t;
  },
  stripes(a,b,n){
    const c=this.canvas(n*32,32),x=c.getContext('2d');
    for(let i=0;i<n;i++){x.fillStyle=i%2?b:a;x.fillRect(i*32,0,32,32);}
    const t=this.tex(c,{srgb:true});t.magFilter=THREE.NearestFilter;return t;
  },

  /* ------------ sky / environment (equirectangular) ------------ */
  // Physically-motivated gradient sky with sun disc & glow, haze band, soft clouds and a distant skyline silhouette.
  sky(env,w,h){
    const c=this.canvas(w,h),x=c.getContext('2d');
    const top=new THREE.Color(env.skyTop),low=new THREE.Color(env.skyBottom||env.fogColor),fog=new THREE.Color(env.fogColor);
    const css=(col,k=1)=>'#'+col.clone().multiplyScalar(k).getHexString();
    const g=x.createLinearGradient(0,0,0,h);
    g.addColorStop(0,css(top,env.isNight?.5:.72));g.addColorStop(.38,css(top));g.addColorStop(.52,css(low));g.addColorStop(.5,css(fog));
    g.addColorStop(1,css(new THREE.Color(env.groundColor).lerp(fog,.35),env.isNight?.5:.9));
    x.fillStyle=g;x.fillRect(0,0,w,h);
    // horizon haze band
    const hz=x.createLinearGradient(0,h*.38,0,h*.56);hz.addColorStop(0,'rgba(255,255,255,0)');hz.addColorStop(.7,css(fog)+'cc');hz.addColorStop(1,css(fog)+'00');
    x.fillStyle=hz;x.fillRect(0,h*.38,w,h*.18);
    const sunX=w*(env.sunAz!==undefined?env.sunAz:.78),sunY=h*(env.sunEl!==undefined?env.sunEl:.30);
    if(!env.isNight){
      const glow=x.createRadialGradient(sunX,sunY,3,sunX,sunY,h*.55);
      glow.addColorStop(0,'rgba(255,255,244,1)');glow.addColorStop(.03,'rgba(255,248,214,.9)');glow.addColorStop(.12,'rgba(255,230,170,.38)');glow.addColorStop(1,'rgba(255,230,170,0)');
      x.fillStyle=glow;x.fillRect(0,0,w,h);
      const rnd=mulberry32(hashString(env.id||'sky'));
      for(let k=0;k<46;k++){
        const cx=rnd()*w,cy=h*(.16+rnd()*.2),r=30+rnd()*120;
        const cg=x.createRadialGradient(cx,cy,2,cx,cy,r);cg.addColorStop(0,'rgba(255,255,255,.34)');cg.addColorStop(1,'rgba(255,255,255,0)');
        x.save();x.translate(cx,cy);x.scale(1,.34);x.translate(-cx,-cy);x.fillStyle=cg;x.fillRect(cx-r,cy-r,r*2,r*2);x.restore();
      }
    }else{
      const rnd=mulberry32(5);
      for(let k=0;k<420;k++){x.fillStyle=`rgba(255,255,255,${.25+rnd()*.7})`;x.fillRect(rnd()*w,rnd()*h*.4,1.4,1.4);}
      const m=x.createRadialGradient(sunX,sunY,2,sunX,sunY,40);m.addColorStop(0,'rgba(240,244,255,1)');m.addColorStop(1,'rgba(160,180,255,0)');x.fillStyle=m;x.fillRect(sunX-60,sunY-60,120,120);
    }
    const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.encoding=THREE.sRGBEncoding;
    t.userData={sunX:sunX/w,sunY:sunY/h};
    return t;
  }
};

/* ===== 40-batch ===== */
/* ----------------------- 4c. GEOMETRY BATCHER (merges thousands of small pieces into few draw calls) ----------------------- */
const _bm=new THREE.Matrix4(),_bq=new THREE.Quaternion(),_bv=new THREE.Vector3(),_bs=new THREE.Vector3(1,1,1),_be=new THREE.Euler();

class GeoBatch{
  constructor(){this.b=new Map();}
  bucket(key){let b=this.b.get(key);if(!b){b={p:[],n:[],u:[],i:[]};this.b.set(key,b);}return b;}
  get empty(){return this.b.size===0;}

  /** Matrix from position / yaw / scale convenience. */
  static mat(x,y,z,yaw=0,sx=1,sy=sx,sz=sx,pitch=0,roll=0){
    _be.set(pitch,yaw,roll,'YXZ');_bq.setFromEuler(_be);_bv.set(x,y,z);_bs.set(sx,sy,sz);
    return new THREE.Matrix4().compose(_bv,_bq,_bs);
  }

  /** push one vertex (position & normal transformed by matrix m; uv as given) */
  _v(b,m,x,y,z,nx,ny,nz,u,v){
    const e=m.elements;
    b.p.push(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]);
    let X=e[0]*nx+e[4]*ny+e[8]*nz,Y=e[1]*nx+e[5]*ny+e[9]*nz,Z=e[2]*nx+e[6]*ny+e[10]*nz;
    const l=Math.hypot(X,Y,Z)||1;b.n.push(X/l,Y/l,Z/l);
    b.u.push(u,v);
    return b.p.length/3-1;
  }
  _quad(b,m,p,nrm,uv){ // p: 4 corners CCW seen from the normal side
    const base=b.p.length/3;
    for(let k=0;k<4;k++)this._v(b,m,p[k][0],p[k][1],p[k][2],nrm[0],nrm[1],nrm[2],uv[k][0],uv[k][1]);
    b.i.push(base,base+1,base+2,base,base+2,base+3);
  }

  /**
   * Building block with metre-based UVs. Sides use key `wallKey` (tiled facade), the top uses `roofKey`.
   * tile = [metres per texture tile horizontally, vertically]; uOff/vOff randomise the tile offset.
   */
  box(wallKey,roofKey,w,h,d,m,tile=[12,12],uOff=0,vOff=0){
    const b=this.bucket(wallKey),hw=w/2,hd=d/2,tw=tile[0],th=tile[1];
    this._quad(b,m,[[-hw,0,hd],[hw,0,hd],[hw,h,hd],[-hw,h,hd]],[0,0,1],[[uOff,vOff],[uOff+w/tw,vOff],[uOff+w/tw,vOff+h/th],[uOff,vOff+h/th]]);
    this._quad(b,m,[[hw,0,-hd],[-hw,0,-hd],[-hw,h,-hd],[hw,h,-hd]],[0,0,-1],[[uOff,vOff],[uOff+w/tw,vOff],[uOff+w/tw,vOff+h/th],[uOff,vOff+h/th]]);
    this._quad(b,m,[[hw,0,hd],[hw,0,-hd],[hw,h,-hd],[hw,h,hd]],[1,0,0],[[uOff,vOff],[uOff+d/tw,vOff],[uOff+d/tw,vOff+h/th],[uOff,vOff+h/th]]);
    this._quad(b,m,[[-hw,0,-hd],[-hw,0,hd],[-hw,h,hd],[-hw,h,-hd]],[-1,0,0],[[uOff,vOff],[uOff+d/tw,vOff],[uOff+d/tw,vOff+h/th],[uOff,vOff+h/th]]);
    if(roofKey){
      const r=this.bucket(roofKey);
      this._quad(r,m,[[-hw,h,hd],[hw,h,hd],[hw,h,-hd],[-hw,h,-hd]],[0,1,0],[[0,0],[w/6,0],[w/6,d/6],[0,d/6]]);
    }
  }

  /** Plain box (uv 0..1 per face) – props, rails, boards. */
  plainBox(key,w,h,d,m,y0=0){
    const b=this.bucket(key),hw=w/2,hd=d/2,t=y0,u=y0+h;
    const F=(p,n)=>this._quad(b,m,p,n,[[0,0],[1,0],[1,1],[0,1]]);
    F([[-hw,t,hd],[hw,t,hd],[hw,u,hd],[-hw,u,hd]],[0,0,1]);
    F([[hw,t,-hd],[-hw,t,-hd],[-hw,u,-hd],[hw,u,-hd]],[0,0,-1]);
    F([[hw,t,hd],[hw,t,-hd],[hw,u,-hd],[hw,u,hd]],[1,0,0]);
    F([[-hw,t,-hd],[-hw,t,hd],[-hw,u,hd],[-hw,u,-hd]],[-1,0,0]);
    F([[-hw,u,hd],[hw,u,hd],[hw,u,-hd],[-hw,u,-hd]],[0,1,0]);
    F([[-hw,t,-hd],[hw,t,-hd],[hw,t,hd],[-hw,t,hd]],[0,-1,0]);
  }

  /** Cylinder / cone frustum along +Y from y=0 to h. */
  cyl(key,rBot,rTop,h,segs,m,{cap=true,vRepeat=1,uRepeat=1,open=false}={}){
    const b=this.bucket(key);
    const base=b.p.length/3;
    const slope=(rBot-rTop)/h;
    for(let i=0;i<=segs;i++){
      const a=i/segs*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
      const nl=Math.hypot(1,slope);
      this._v(b,m,c*rBot,0,s*rBot,c/nl,slope/nl,s/nl,i/segs*uRepeat,0);
      this._v(b,m,c*rTop,h,s*rTop,c/nl,slope/nl,s/nl,i/segs*uRepeat,vRepeat);
    }
    for(let i=0;i<segs;i++){const a=base+i*2;b.i.push(a,a+2,a+1,a+1,a+2,a+3);}
    if(cap&&rTop>0&&!open){
      const c0=this._v(b,m,0,h,0,0,1,0,.5,.5);
      for(let i=0;i<=segs;i++){const a=i/segs*Math.PI*2;this._v(b,m,Math.cos(a)*rTop,h,Math.sin(a)*rTop,0,1,0,.5+Math.cos(a)*.5,.5+Math.sin(a)*.5);}
      for(let i=0;i<segs;i++)b.i.push(c0,c0+2+i,c0+1+i);
    }
  }

  /** Sphere (dome): latitude from phi0..phi1 (radians from the pole). */
  dome(key,r,segs,rings,m,phi1=Math.PI/2){
    const b=this.bucket(key),base=b.p.length/3;
    for(let j=0;j<=rings;j++){
      const phi=j/rings*phi1,y=Math.cos(phi)*r,rr=Math.sin(phi)*r;
      for(let i=0;i<=segs;i++){const a=i/segs*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
        this._v(b,m,c*rr,y,s*rr,c*Math.sin(phi),Math.cos(phi),s*Math.sin(phi),i/segs,j/rings);}
    }
    for(let j=0;j<rings;j++)for(let i=0;i<segs;i++){const a=base+j*(segs+1)+i,c=a+segs+1;b.i.push(a,a+1,c,a+1,c+1,c);}
  }

  /** Raw triangle strip between two polylines (used for road ribbons). left/right: arrays of [x,y,z]; uvs [[u,v]...] */
  ribbon(key,left,right,uvL,uvR,up=[0,1,0],flip=false){
    const b=this.bucket(key),base=b.p.length/3;
    for(let i=0;i<left.length;i++){
      b.p.push(left[i][0],left[i][1],left[i][2],right[i][0],right[i][1],right[i][2]);
      b.n.push(up[0],up[1],up[2],up[0],up[1],up[2]);
      b.u.push(uvL[i][0],uvL[i][1],uvR[i][0],uvR[i][1]);
    }
    for(let i=0;i<left.length-1;i++){const a=base+i*2;if(!flip)b.i.push(a,a+1,a+2,a+1,a+3,a+2);else b.i.push(a,a+2,a+1,a+1,a+2,a+3);}
  }

  /** Vertical wall strip following polylines bottom/top; normal given per column. */
  wall(key,bottom,top,normals,uvs){
    const b=this.bucket(key),base=b.p.length/3;
    for(let i=0;i<bottom.length;i++){
      b.p.push(bottom[i][0],bottom[i][1],bottom[i][2],top[i][0],top[i][1],top[i][2]);
      b.n.push(normals[i][0],normals[i][1],normals[i][2],normals[i][0],normals[i][1],normals[i][2]);
      b.u.push(uvs[i][0],0,uvs[i][0],uvs[i][1]);
    }
    for(let i=0;i<bottom.length-1;i++){const a=base+i*2;b.i.push(a,a+1,a+2,a+1,a+3,a+2);}
  }

  /** Create meshes in `parent` for each bucket. mats: {key: Material}. flags: {key:{cast,receive}} */
  build(parent,mats,flags={}){
    const out=[];
    this.b.forEach((b,key)=>{
      if(!b.i.length)return;
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
      g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
      g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2));
      g.setIndex(b.p.length/3>65000?new THREE.Uint32BufferAttribute(b.i,1):new THREE.Uint16BufferAttribute(b.i,1));
      g.computeBoundingSphere();g.computeBoundingBox();
      const mat=mats[key];
      if(!mat){g.dispose();return;}
      const mesh=new THREE.Mesh(g,mat);
      const f=flags[key]||{};
      mesh.castShadow=!!f.cast;mesh.receiveShadow=f.receive!==false;
      mesh.userData.batchKey=key;
      parent.add(mesh);out.push(mesh);
    });
    return out;
  }
}

/** Dispose all geometries below a group (materials are shared and owned by the world, so they are kept). */
function disposeGroupGeometry(g){
  g.traverse(o=>{if(o.geometry)o.geometry.dispose();});
}

/* ===== 50-vehicles ===== */
/* ----------------------- 4d. VEHICLES: GLB PBR CARS, HEADING ADAPTER, WHEEL RIG, PROCEDURAL FALLBACKS ----------------------- */

// With outputEncoding = sRGB, authored hex colours must be converted to linear first, otherwise paint looks washed-out.
function Col(hex){const c=new THREE.Color(hex);return c.convertSRGBToLinear();}

/* ===== Offline asset store: base64 payloads embedded in the page (single-file) or in assets/*.js (multi-file) ===== */
const AssetStore = {
  buffers:new Map(),
  has(name){
    return !!(document.getElementById('asset-'+name)||(window.__ASSETS&&window.__ASSETS[name]));
  },
  b64ToBuffer(b64){
    const bin=atob(b64),n=bin.length,u=new Uint8Array(n);
    for(let i=0;i<n;i++)u[i]=bin.charCodeAt(i);
    return u.buffer;
  },
  loadScript(src){
    return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=()=>res();s.onerror=()=>rej(new Error('تعذّر تحميل الملف المحلي '+src));document.head.appendChild(s);});
  },
  async getText(name){
    const el=document.getElementById('asset-'+name);
    if(el)return el.textContent.trim();
    if(window.__ASSETS&&window.__ASSETS[name])return window.__ASSETS[name];
    try{await this.loadScript('assets/'+name+'.js');}catch(e){}
    if(window.__ASSETS&&window.__ASSETS[name])return window.__ASSETS[name];
    throw new Error('الملف '+name+' غير موجود ضمن حزمة اللعبة');
  },
  async getBuffer(name){
    if(this.buffers.has(name))return this.buffers.get(name);
    const txt=await this.getText(name);
    const buf=this.b64ToBuffer(txt);
    this.buffers.set(name,buf);
    return buf;
  }
};

/* ===== GLB parsing (r128 GLTFLoader, no network). Draco only if an imported model needs it. ===== */
const GLBTools = {
  parsedCache:new Map(),
  dracoLoader:null,
  hasDraco(buf){
    try{
      const dv=new DataView(buf);if(dv.getUint32(0,true)!==0x46546C67)return false;
      const len=dv.getUint32(12,true);
      const json=new TextDecoder().decode(new Uint8Array(buf,20,len));
      return json.indexOf('KHR_draco_mesh_compression')>=0;
    }catch(e){return false;}
  },
  async ensureDraco(){
    if(this.dracoLoader)return this.dracoLoader;
    if(typeof THREE.DRACOLoader!=='function')throw new Error('قارئ DRACO غير متوفر في هذه الحزمة');
    const js=await AssetStore.getText('draco-decoder');
    const d=new THREE.DRACOLoader();
    d.setDecoderConfig({type:'js'});
    // Serve the decoder from memory: nothing is fetched from the network.
    d._loadLibrary=function(url){return Promise.resolve(js);};
    d.preload();
    this.dracoLoader=d;return d;
  },
  async parse(buf){
    const loader=new THREE.GLTFLoader();
    if(this.hasDraco(buf))loader.setDRACOLoader(await this.ensureDraco());
    return new Promise((res,rej)=>loader.parse(buf,'',res,rej));
  },
  async loadAsset(name){
    if(this.parsedCache.has(name))return this.parsedCache.get(name);
    const buf=await AssetStore.getBuffer(name);
    const g=await this.parse(buf.slice(0));
    this.parsedCache.set(name,g);
    return g;
  }
};

/* ===== Car definitions: licensed GLB cars bundled with the game ===== */
const CAR_DEFS = {
  ferrari_458_real:{
    hi:'ferrari_458_hi',lod:'ferrari_458_lod',length:4.53,nativeForward:'-z',
    wheel:/^wheel_(fl|fr|rl|rr)$/i,front:/^wheel_f/i,
    paint:m=>m.name==='Body_Color',glass:m=>/^Glass/i.test(m.name),
    tail:n=>/^lights_red$/i.test(n),head:n=>/^lights$/i.test(n),
    brakeMat:m=>/Taillight/i.test(m.name),headMat:m=>/Projector|Turn_Signal/i.test(m.name),
    credit:'Ferrari 458 Italia — vicent091036 (CC BY 4.0) via three.js examples'
  },
  car_concept:{
    hi:'car_concept_hi',lod:'car_concept_lod',length:4.72,nativeForward:'+z',
    wheel:/^Wheel(Front|Rear)[LR]$/,front:/^WheelFront/,
    paint:m=>/^Paint 1/.test(m.name),paint2:m=>/^Paint 2/.test(m.name),glass:m=>/^Glass/.test(m.name),
    tail:n=>/Taillights$/.test(n),head:n=>/Headlights$/.test(n),
    brakeMat:m=>m.name==='Brakelight',headMat:m=>m.name==='Headlight',
    credit:'Car Concept — Eric Chadwick / Khronos glTF Sample Assets (CC BY 4.0)'
  }
};

/* ===== Rig that every car (GLB or procedural) exposes to the game ===== */
const SHADOW_BLOB=(()=>{let t=null;return()=>{if(t)return t;const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,6,64,64,62);g.addColorStop(0,'rgba(0,0,0,.62)');g.addColorStop(.55,'rgba(0,0,0,.34)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);t=new THREE.CanvasTexture(c);return t;};})();

class CarRig{
  constructor(){
    this.root=new THREE.Group();
    this.bodyPivot=new THREE.Group();
    this.wheelHolder=new THREE.Group();
    this.root.add(this.bodyPivot,this.wheelHolder);
    this.wheels=[];           // {steer,spin,front,radius}
    this.paintMats=[];this.brakeMats=[];this.headMats=[];
    this.dims={length:4.6,width:2,height:1.2};
    this.headingInfo={};      // diagnostics for tests
    this.pitch=0;this.roll=0;this.heave=0;
    this.braking=false;
    this.headLamp=null;
    const blob=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:SHADOW_BLOB(),transparent:true,depthWrite:false,fog:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
    blob.rotation.x=-Math.PI/2;blob.position.y=0.02;blob.renderOrder=1;this.blob=blob;this.root.add(blob);
  }
  finalize(){
    this.blob.scale.set(this.dims.width*1.35,this.dims.length*1.28,1);
  }
  setPaint(hex){this.paintMats.forEach(m=>{m.color.copy(Col(hex));m.needsUpdate=true;});}
  setBrake(on){
    if(this.braking===on)return;this.braking=on;
    this.brakeMats.forEach(m=>{m.emissiveIntensity=on?(m.userData.brakeOn||2.4):(m.userData.brakeOff||.5);});
  }
  setHeadlights(level){this.headMats.forEach(m=>{m.emissiveIntensity=(m.userData.headBase||.8)*level;});if(this.headLamp)this.headLamp.intensity=level>1?3.2:.55;}
  /** speedMs: forward speed; steer: front wheel angle (rad, +left); lean: {pitch,roll,heave} targets */
  update(dt,speedMs,steer,lean){
    for(const w of this.wheels){
      w.spin.rotation.x-=speedMs*dt/w.radius;
      if(w.front)w.steer.rotation.y=steer;
    }
    if(lean){
      const k=Math.min(1,dt*7);
      this.pitch+=(lean.pitch-this.pitch)*k;this.roll+=(lean.roll-this.roll)*k;this.heave+=(lean.heave-this.heave)*k;
      this.bodyPivot.rotation.x=this.pitch;this.bodyPivot.rotation.z=this.roll;this.bodyPivot.position.y=this.heave;
    }
  }
  dispose(){this.root.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});}
}

/* ===== Heading adapter: detect and normalise the model's native forward axis so that headlights point to -Z ===== */
const HeadingAdapter = {
  // returns yaw (radians) to rotate a model so that its forward becomes -Z
  yawFor(key){return {'-z':0,'+z':Math.PI,'+x':Math.PI/2,'-x':-Math.PI/2}[key]??0;},
  /** Detect native forward by locating the centroid of the tail-lights relative to the body centre. */
  detect(model,def){
    model.updateMatrixWorld(true);
    const whole=new THREE.Box3().setFromObject(model);
    const c=whole.getCenter(new THREE.Vector3()),size=whole.getSize(new THREE.Vector3());
    const tails=new THREE.Box3(),heads=new THREE.Box3();let nt=0,nh=0;
    model.traverse(o=>{
      if(!o.isMesh)return;
      const nm=o.name||'';
      if(def.tail&&def.tail(nm)){tails.expandByObject(o);nt++;}
      else if(def.head&&def.head(nm)){heads.expandByObject(o);nh++;}
    });
    const info={method:'none',size:size.toArray().map(v=>+v.toFixed(2)),tailsFound:nt,headsFound:nh};
    if(nt>0){
      const t=tails.getCenter(new THREE.Vector3()).sub(c);
      let rearAxis;
      if(Math.abs(t.z)>=Math.abs(t.x))rearAxis=t.z>0?'+z':'-z';else rearAxis=t.x>0?'+x':'-x';
      // forward is the opposite of where the tail-lights are
      const fwd={'+z':'-z','-z':'+z','+x':'-x','-x':'+x'}[rearAxis];
      info.method='taillights';info.rearAxis=rearAxis;info.forward=fwd;info.tailOffset=t.toArray().map(v=>+v.toFixed(2));
      return {forward:fwd,info};
    }
    if(nh>0){
      const h=heads.getCenter(new THREE.Vector3()).sub(c);
      const fwd=Math.abs(h.z)>=Math.abs(h.x)?(h.z>0?'+z':'-z'):(h.x>0?'+x':'-x');
      info.method='headlights';info.forward=fwd;return {forward:fwd,info};
    }
    // wheel-based fallback: front wheels carry "front"/"_f" in the node name
    let fw=0,rw=0;const fc=new THREE.Vector3(),rc=new THREE.Vector3();
    model.traverse(o=>{if(def.wheel&&def.wheel.test(o.name||'')){const p=new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());if(def.front&&def.front.test(o.name)){fc.add(p);fw++;}else{rc.add(p);rw++;}}});
    if(fw&&rw){fc.divideScalar(fw);rc.divideScalar(rw);const d=fc.sub(rc);const fwd=Math.abs(d.z)>=Math.abs(d.x)?(d.z>0?'+z':'-z'):(d.x>0?'+x':'-x');info.method='wheels';info.forward=fwd;return {forward:fwd,info};}
    info.method='declared';info.forward=def.nativeForward||'-z';
    return {forward:info.forward,info};
  }
};

/* ===== Build a CarRig from a parsed GLB scene ===== */
const CarFactory = {
  glassMat:null,
  getGlass(){
    if(!this.glassMat)this.glassMat=new THREE.MeshPhysicalMaterial({color:Col(0x0a1218),metalness:0,roughness:.04,transparent:true,opacity:.42,envMapIntensity:1.6,side:THREE.DoubleSide,depthWrite:false});
    return this.glassMat;
  },

  /** generic definition for imported GLBs (custom/branded slots); relies on node/material names */
  genericDef(){
    return {
      length:4.6,nativeForward:'-z',
      wheel:/wheel|tyre|tire|rim/i,front:/front|_f[lr]|fl$|fr$/i,
      paint:m=>/paint|carpaint|body|exterior|lacquer/i.test(m.name||''),glass:m=>/glass|window|windshield|windscreen/i.test(m.name||''),
      tail:n=>/tail.?light|rear.?light|brake.?light|taillamp/i.test(n),head:n=>/head.?light|headlamp|projector/i.test(n),
      brakeMat:m=>/tail|brake/i.test(m.name||''),headMat:m=>/head.?light|projector/i.test(m.name||''),
      generic:true
    };
  },

  /**
   * @param {THREE.Object3D} source parsed gltf.scene (will be cloned)
   * @param {object} def car definition
   * @param {object} opt {color, headingOverride:'auto'|'-z'|..., lod:bool, flip:bool}
   */
  fromScene(source,def,opt={}){
    const rig=new CarRig();
    const model=source.clone(true);
    // Per-car private materials for the pieces that change per car (paint, brake lights, head lights).
    const remap=new Map();
    const priv=(m)=>{if(!remap.has(m))remap.set(m,m.clone());return remap.get(m);};
    model.traverse(o=>{
      if(!o.isMesh)return;
      o.castShadow=true;o.receiveShadow=true;
      const mats=Array.isArray(o.material)?o.material:[o.material];
      const out=mats.map(m=>{
        if(def.glass&&def.glass(m)){return this.getGlass();}
        if(def.paint&&def.paint(m)){const p=priv(m);if(!rig.paintMats.includes(p)){rig.paintMats.push(p);}return p;}
        if(def.paint2&&def.paint2(m)){return m;}
        if(def.brakeMat&&def.brakeMat(m)){const p=priv(m);if(!rig.brakeMats.includes(p))rig.brakeMats.push(p);return p;}
        if(def.headMat&&def.headMat(m)){const p=priv(m);if(!rig.headMats.includes(p))rig.headMats.push(p);return p;}
        return m;
      });
      o.material=Array.isArray(o.material)?out:out[0];
    });
    // --- heading adapter ---
    const det=HeadingAdapter.detect(model,def);
    let fwd=det.forward;
    if(opt.headingOverride&&opt.headingOverride!=='auto')fwd=opt.headingOverride;
    if(opt.flip)fwd={'+z':'-z','-z':'+z','+x':'-x','-x':'+x'}[fwd];
    const inner=new THREE.Group();inner.add(model);
    inner.rotation.y=HeadingAdapter.yawFor(fwd);
    rig.bodyPivot.add(inner);
    // --- normalise scale & ground contact (wheels touch y=0, centred at origin) ---
    rig.root.updateMatrixWorld(true);
    let box=new THREE.Box3().setFromObject(inner);
    let size=box.getSize(new THREE.Vector3());
    const targetLen=def.length||4.6;
    const k=targetLen/Math.max(size.z,0.001);
    inner.scale.setScalar(k);
    rig.root.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(inner);
    const mid=box.getCenter(new THREE.Vector3());
    inner.position.set(-mid.x,-box.min.y,-mid.z);
    rig.root.updateMatrixWorld(true);
    box=new THREE.Box3().setFromObject(inner);size=box.getSize(new THREE.Vector3());
    rig.dims={length:size.z,width:size.x,height:size.y};
    rig.headingInfo=Object.assign({},det.info,{used:fwd,declared:def.nativeForward,scale:+k.toFixed(4)});
    // --- wheels: separate steer & spin pivots, kept outside the body pivot so the body can pitch/roll over them ---
    const wheelNodes=[];
    inner.traverse(o=>{if(!o.isMesh&&def.wheel&&def.wheel.test(o.name||'')&&o.name&&!wheelNodes.some(w=>w.contains?.(o)))wheelNodes.push(o);});
    // keep only top-most nodes (avoid nested matches)
    const tops=wheelNodes.filter(n=>!wheelNodes.some(m=>m!==n&&isDescendant(n,m)));
    const sideSeen=new Set();
    for(const node of tops){
      const wb=new THREE.Box3().setFromObject(node);
      const wc=wb.getCenter(new THREE.Vector3()),ws=wb.getSize(new THREE.Vector3());
      if(ws.y<0.25||ws.y>1.0)continue; // not a real wheel
      const steer=new THREE.Group(),spin=new THREE.Group();
      steer.position.copy(wc);
      rig.wheelHolder.add(steer);steer.add(spin);
      rig.root.updateMatrixWorld(true);
      spin.attach(node);
      const isFront=wc.z<0; // after heading normalisation the front is -Z
      rig.wheels.push({steer,spin,front:isFront,radius:Math.max(.25,ws.y/2),center:wc.clone(),size:ws.clone()});
      sideSeen.add((wc.x<0?'L':'R')+(isFront?'F':'R'));
    }
    rig.headingInfo.wheelCount=rig.wheels.length;
    // --- lights ---
    rig.brakeMats.forEach(m=>{
      m.userData.brakeOff=.55;m.userData.brakeOn=2.6;
      if(!m.emissive||m.emissive.getHex()===0)m.emissive=new THREE.Color(0xe01010);
      m.emissiveIntensity=.55;
    });
    rig.headMats.forEach(m=>{m.userData.headBase=.9;m.emissiveIntensity=.9;});
    if(rig.paintMats.length){
      rig.paintMats.forEach(m=>{
        m.envMapIntensity=1.5;
        if(m.isMeshPhysicalMaterial){m.clearcoat=Math.max(m.clearcoat||0,1);m.clearcoatRoughness=.06;}
        else{/* standard material: keep */}
      });
      if(opt.color)rig.setPaint(opt.color);
    }
    // glass should not cast opaque shadows
    model.traverse(o=>{if(o.isMesh&&o.material===this.getGlass()){o.castShadow=false;o.renderOrder=2;}});
    // head lamp (single spot, used at night/tunnels)
    if(!opt.lod){
      const lamp=new THREE.SpotLight(0xe6f2ff,.55,78,Math.PI/6,.55,1.4);
      lamp.position.set(0,rig.dims.height*.42,-rig.dims.length*.45);
      lamp.target.position.set(0,.2,-34);
      rig.bodyPivot.add(lamp,lamp.target);rig.headLamp=lamp;
    }
    rig.finalize();
    return rig;
  }
};
function isDescendant(node,ancestor){let p=node.parent;while(p){if(p===ancestor)return true;p=p.parent;}return false;}

/* ===== Procedural (unbranded, generic) sports cars — used for traffic variety and as a safe fallback ===== */
CarFactory.procedural=function(modelId,hexColor,isPlayer){
  const rig=new CarRig();
  const body=rig.bodyPivot;
  const isSUV=modelId==='suv_sport',isCoupe=modelId==='coupe';
  const L=(h)=>Col(h);
  const paint=new THREE.MeshPhysicalMaterial({color:Col(hexColor),metalness:.62,roughness:.26,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.5});
  const trim=new THREE.MeshStandardMaterial({color:L(0x0d1119),metalness:.3,roughness:.56});
  const glass=CarFactory.getGlass();
  const smoked=new THREE.MeshStandardMaterial({color:L(0x182334),metalness:.42,roughness:.31});
  const chrome=new THREE.MeshStandardMaterial({color:L(0xc6d6df),metalness:.92,roughness:.18});
  const tyre=new THREE.MeshStandardMaterial({color:L(0x151515),roughness:.93});
  const redLED=new THREE.MeshStandardMaterial({color:L(0x9b070b),emissive:L(0xee060b),emissiveIntensity:.5});
  const whiteLED=new THREE.MeshStandardMaterial({color:L(0xd5f3ff),emissive:L(0xbfe9ff),emissiveIntensity:1.0});
  rig.paintMats=[paint];rig.brakeMats=[redLED];rig.headMats=[whiteLED];
  redLED.userData.brakeOff=.5;redLED.userData.brakeOn=2.6;whiteLED.userData.headBase=1;
  const bodyY=isSUV?.96:.77,roofY=isSUV?2.04:(isCoupe?1.43:1.47);
  const length=isSUV?4.75:4.60,half=length/2;
  const addMesh=(geometry,material,x=0,y=0,z=0,parent=body)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=material!==glass;m.receiveShadow=true;parent.add(m);return m;};
  const addBox=(w,h,d,mat,x,y,z)=>addMesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const addLine=(pts,r,mat)=>addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),Math.max(8,pts.length*5),r,5,false),mat);
  const addPanel=(points,mat)=>{
    const geom=new THREE.BufferGeometry();const positions=[];
    const tris=points.length===4?[[0,1,2],[0,2,3]]:[[0,1,2]];
    tris.forEach(t=>t.forEach(i=>positions.push(...points[i])));
    geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.computeVertexNormals();
    return addMesh(geom,mat);
  };
  const contours=[
    [-half,.76,.56],[-half+.20,.91,.66],[-1.76,1.015,bodyY],[-1.25,1.035,bodyY+.12],
    [-.58,1.00,bodyY+.15],[.20,1.005,bodyY+.14],[.94,1.04,bodyY+.12],
    [1.62,1.02,bodyY+.10],[half-.17,.92,bodyY+.045],[half,.84,bodyY-.05]
  ];
  const vert=[],idx=[];
  contours.forEach(([z,w,top])=>{
    [[-w*.84,.28],[-w,.45],[-w,top-.08],[-w*.79,top],[w*.79,top],[w,top-.08],[w,.45],[w*.84,.28]].forEach(([x,y])=>vert.push(x,y,z));
  });
  for(let k=0;k<contours.length-1;k++)for(let j=0;j<8;j++){
    const a=k*8+j,b=k*8+(j+1)%8,c=(k+1)*8+j,d=(k+1)*8+(j+1)%8;idx.push(a,c,b,b,c,d);
  }
  for(let j=1;j<7;j++){idx.push(0,j,j+1);const a=(contours.length-1)*8;idx.push(a,a+j+1,a+j);}
  const bodyGeo=new THREE.BufferGeometry();bodyGeo.setAttribute('position',new THREE.Float32BufferAttribute(vert,3));bodyGeo.setIndex(idx);bodyGeo.computeVertexNormals();
  addMesh(bodyGeo,paint);
  addBox(1.91,.08,.40,trim,0,.24,-half+.16);addBox(1.82,.1,.30,trim,0,.27,half-.08);
  [-1,1].forEach(sign=>{addBox(.10,.10,2.34,trim,sign*.96,.31,.11);addLine([[sign*.99,.78,-.83],[sign*1.015,.83,-.23],[sign*1.015,.81,.78]],.010,smoked);});
  const roofZFront=isSUV?-1.18:-.82,roofZRear=isSUV?1.23:.83;
  const frontBottom=-1.39,rearBottom=1.58,pillarBottom=bodyY+.12;
  addPanel([[-.85,pillarBottom,frontBottom],[.85,pillarBottom,frontBottom],[.72,roofY,roofZFront],[-.72,roofY,roofZFront]],glass);
  addPanel([[-.72,roofY,roofZRear],[.72,roofY,roofZRear],[.86,pillarBottom,rearBottom],[-.86,pillarBottom,rearBottom]],glass);
  [-1,1].forEach(side=>{
    addPanel([[side*.84,pillarBottom,frontBottom],[side*.72,roofY,roofZFront],[side*.73,roofY,roofZRear],[side*.86,pillarBottom,rearBottom]],glass);
    addLine([[side*.84,pillarBottom,frontBottom],[side*.72,roofY,roofZFront],[side*.73,roofY,roofZRear],[side*.86,pillarBottom,rearBottom]],.025,smoked);
    addLine([[side*.79,roofY+.014,roofZFront],[side*.77,roofY+.014,roofZRear]],.038,paint);
    addBox(.15,.09,.36,paint,side*1.13,1.10,-.80);addBox(.12,.06,.23,chrome,side*1.18,1.12,-.85);addBox(.19,.035,.09,chrome,side*1.027,.82,.34);
  });
  addBox(1.48,.06,roofZRear-roofZFront+.16,paint,0,roofY+.025,(roofZRear+roofZFront)/2);
  const wheelR=isSUV?.42:.37;
  [{z:-1.43,front:true},{z:1.48,front:false}].forEach(({z,front})=>[-1,1].forEach(side=>{
    const steer=new THREE.Group();steer.position.set(side*1.01,wheelR,z);rig.wheelHolder.add(steer);
    const spin=new THREE.Group();steer.add(spin);
    const tyreGeo=new THREE.CylinderGeometry(wheelR,wheelR,.33,28);tyreGeo.rotateZ(Math.PI/2);addMesh(tyreGeo,tyre,0,0,0,spin);
    const rimGeo=new THREE.CylinderGeometry(wheelR*.68,wheelR*.68,.36,28);rimGeo.rotateZ(Math.PI/2);addMesh(rimGeo,smoked,0,0,0,spin);
    for(let n=0;n<5;n++){const spoke=new THREE.Mesh(new THREE.BoxGeometry(.012,wheelR*.53,.075),chrome);spoke.position.x=side*.186;spoke.rotation.x=n*Math.PI*2/5;spoke.castShadow=true;spin.add(spoke);}
    const hubGeo=new THREE.CylinderGeometry(.086,.086,.38,14);hubGeo.rotateZ(Math.PI/2);spin.add(new THREE.Mesh(hubGeo,chrome));
    const ring=new THREE.Mesh(new THREE.TorusGeometry(wheelR+.025,.035,8,28,Math.PI),trim);ring.rotation.y=side*Math.PI/2;ring.rotation.z=Math.PI;ring.position.set(side*1.05,wheelR,z);body.add(ring);
    rig.wheels.push({steer,spin,front,radius:wheelR});
  }));
  [-1,1].forEach(side=>{
    addBox(.48,.11,.058,whiteLED,side*.65,.67,-half-.025).rotation.z=-side*.10;
    addBox(.46,.085,.055,redLED,side*.68,.71,half+.026);
    addBox(.39,.14,.042,trim,side*.62,.38,-half-.025);addBox(.29,.08,.042,smoked,side*.63,.32,half+.015);
  });
  addBox(1.25,.075,.046,redLED,0,.73,half+.037);addBox(.68,.19,.062,trim,0,.36,-half-.018);
  for(let i=-2;i<=2;i++)addBox(.058,.17,.073,smoked,i*.11,.365,-half-.05);
  [-.47,.47].forEach(x=>{const pipe=addMesh(new THREE.CylinderGeometry(.085,.085,.25,14),chrome,x,.25,half+.05);pipe.rotation.x=Math.PI/2;});
  if(!isSUV){[-.70,.70].forEach(x=>addBox(.085,.31,.18,trim,x,bodyY+.26,half-.26));addBox(1.92,.085,.34,isCoupe?paint:trim,0,bodyY+.43,half-.25).rotation.x=.065;}
  else addBox(1.65,.08,.22,trim,0,roofY-.02,roofZRear+.04);
  rig.dims={length,width:2.1,height:roofY+.05};
  if(isPlayer){const lamp=new THREE.SpotLight(0xe6f2ff,.55,78,Math.PI/6,.55,1.4);lamp.position.set(0,.77,-half);lamp.target.position.set(0,.2,-34);body.add(lamp,lamp.target);rig.headLamp=lamp;}
  rig.headingInfo={method:'procedural',used:'-z',forward:'-z'};
  rig.finalize();
  return rig;
};

/* ===== public helpers used by the engine ===== */
const CarLibrary = {
  isGLBModel(id){return !!CAR_DEFS[id];},
  /** Asynchronously build a rig for model id. lod=true builds the lightweight AI version. */
  async build(modelId,hexColor,{lod=false,isPlayer=true}={}){
    const entry=CAR_MODELS.find(c=>c.id===modelId);
    try{
      if(CAR_DEFS[modelId]){
        const def=CAR_DEFS[modelId];
        const gltf=await GLBTools.loadAsset(lod?def.lod:def.hi);
        return CarFactory.fromScene(gltf.scene,def,{color:hexColor,lod,headingOverride:(APP_CONFIG.carHeading&&APP_CONFIG.carHeading[modelId])||'auto'});
      }
      if(entry&&(entry.brandModel||entry.id==='custom_glb')){
        const data=entry.brandModel?APP_CONFIG.carAssets?.[entry.id]:APP_CONFIG.customCarData;
        if(data){
          const b64=data.split(',')[1];
          const gltf=await GLBTools.parse(AssetStore.b64ToBuffer(b64));
          const def=CarFactory.genericDef();
          const heading=(APP_CONFIG.carHeading&&APP_CONFIG.carHeading[modelId])||APP_CONFIG.customCarHeading||'auto';
          return CarFactory.fromScene(gltf.scene,def,{color:hexColor,lod,headingOverride:heading==='-z'&&!APP_CONFIG.carHeading?.[modelId]?'auto':heading});
        }
      }
    }catch(err){
      console.warn('GLB car failed, using generic fallback:',err);
      CarLibrary.lastError=err;
    }
    const proc=(modelId==='coupe'||modelId==='suv_sport')?modelId:'supercar';
    return CarFactory.procedural(proc,hexColor,isPlayer);
  }
};

/* ===== 60-world ===== */
/* ----------------------- 4e. WORLD: STREAMING ROAD CHUNKS + CITY SCENERY (all procedural, PBR, offline) ----------------------- */
/*
 * Everything is generated from the shared RoadPath. A chunk is 40 m of road with its own kerbs, markings, guardrails,
 * ground, buildings, trees, lamps, signs and water. Chunks are streamed around the player and rebuilt on demand.
 * Scenery is deterministic per (environment, slot) so recycled chunks look identical when revisited.
 */
const ROAD_HALF = 7;          // asphalt half width (3 lanes of 4.67 m)
const SHOULDER_END = 8.6;     // outer edge of the paved shoulder
const RAIL_D = 8.95;          // guardrail centre line (the physical boundary the car can touch)
const CAR_HALF_WIDTH = 0.98;
const ROAD_LIMIT = RAIL_D - 0.12 - CAR_HALF_WIDTH; // |d| beyond this = the car is touching the guardrail (collision)

const World = {
  CH: 40,
  scene: null, root: null, env: null, theme: null, preset: 'high', Q: null,
  chunks: new Map(), pending: [], mats: {}, texs: [], waterLevel: 0, minY: 0,
  tmp: {}, tmp2: {}, tmpc: {}, nightMode: false, seedBase: 1,

  QUALITY: {
    low:   { ahead: 360, behind: 60,  density: .45, balconies: 0,   far: 0, palms: .6, buildPerFrame: 1, shadows: false, texSize: 'low' },
    medium:{ ahead: 520, behind: 80,  density: .75, balconies: .5,  far: 1, palms: .85,buildPerFrame: 1, shadows: true,  texSize: 'medium' },
    high:  { ahead: 700, behind: 100, density: 1,   balconies: 1,   far: 1, palms: 1,  buildPerFrame: 2, shadows: true,  texSize: 'high' }
  },

  /* ============ setup / teardown ============ */
  setup(scene, env, preset, routeLength) {
    this.dispose();
    this.scene = scene; this.env = env; this.theme = env.theme || 'gulf'; this.preset = preset;
    this.Q = this.QUALITY[preset] || this.QUALITY.high;
    this.nightMode = !!env.isNight;
    this.root = new THREE.Group(); this.root.name = 'world'; scene.add(this.root);
    TexLab.setQuality(this.Q.texSize);
    this.seedBase = hashString(env.id);
    // road path shared by everything
    const diffKey = APP_CONFIG.roadDifficulty || 'normal';
    RoadPath.build({ seed: this.seedBase, length: routeLength, difficulty: diffKey, elevation: env.elev !== undefined ? env.elev : 1.4 });
    let minY = 1e9; for (let i = 0; i < RoadPath.length; i += 8) minY = Math.min(minY, RoadPath.Y[i]);
    this.minY = minY; this.waterLevel = minY - 3.0;
    this.buildMaterials();
    scene.fog = new THREE.FogExp2(Col(env.fogColor), 1.95 / (this.Q.ahead + 40));
  },

  dispose() {
    if (this.root) {
      this.chunks.forEach(c => { disposeGroupGeometry(c.group); this.root.remove(c.group); });
      if (this.scene) this.scene.remove(this.root);
    }
    this.chunks.clear(); this.pending.length = 0;
    this.texs.forEach(t => t && t.dispose && t.dispose()); this.texs.length = 0;
    Object.values(this.mats).forEach(m => { if (Array.isArray(m)) m.forEach(x => x.dispose()); else if (m && m.dispose) m.dispose(); }); this.mats = {};
    this.root = null;
  },

  _t(t) { if (t) this.texs.push(t); return t; },

  /* ============ materials (shared, PBR) ============ */
  buildMaterials() {
    const env = this.env, M = this.mats, T = this;
    const track = (tex, rx, ry) => { if (!tex) return tex; if (rx) { tex.repeat.set(rx, ry || rx); } return T._t(tex); };
    // asphalt: albedo + normal + roughness (no texture is downloaded)
    const as = TexLab.asphalt();
    M.road = new THREE.MeshStandardMaterial({ map: track(as.map), normalMap: track(as.normalMap), roughnessMap: track(as.roughnessMap), roughness: 1, metalness: 0, envMapIntensity: .35, normalScale: new THREE.Vector2(1.1, 1.1) });
    M.road.map.anisotropy = 8;
    const paint = (hex, rough) => new THREE.MeshStandardMaterial({ color: Col(hex), roughness: rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: .4 });
    M.paintW = paint(0xf2f2ee, .55); M.paintY = paint(0xf4c20d, .55);
    M.kerb = new THREE.MeshStandardMaterial({ map: this._t(TexLab.stripes('#d9261c', '#f3f3f0', 2)), roughness: .75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const gtype = env.ground || 'sand';
    const gr = TexLab.ground(gtype);
    const tintByGround = { sand: 0xffffff, desert: 0xffffff, grass: 0xffffff, stone: 0xffffff, dirt: 0xffffff, rock: 0xffffff };
    M.ground = new THREE.MeshStandardMaterial({ map: track(gr.map), normalMap: track(gr.normalMap), color: Col(tintByGround[gtype] || 0xffffff), roughness: .95, metalness: 0, envMapIntensity: .25 });
    const pv = TexLab.ground('stone');
    M.paving = new THREE.MeshStandardMaterial({ map: track(pv.map), normalMap: track(pv.normalMap), roughness: .85, metalness: 0, envMapIntensity: .3 });
    M.shoulder = new THREE.MeshStandardMaterial({ color: Col(0x74777d), roughness: .95, metalness: 0, envMapIntensity: .2 });
    M.rail = new THREE.MeshStandardMaterial({ color: Col(0xb9c0c6), roughness: .35, metalness: .85, side: THREE.DoubleSide, envMapIntensity: 1.1 });
    M.post = new THREE.MeshStandardMaterial({ color: Col(0x6b7178), roughness: .5, metalness: .6 });
    M.concrete = new THREE.MeshStandardMaterial({ color: Col(0xbdbab2), roughness: .9, metalness: 0 });
    M.roof = new THREE.MeshStandardMaterial({ color: Col(0x6b6a68), roughness: .95, metalness: 0 });
    M.roofRed = new THREE.MeshStandardMaterial({ color: Col(0x9a4a36), roughness: .85, metalness: 0 });
    M.roofZinc = new THREE.MeshStandardMaterial({ color: Col(0x59626d), roughness: .6, metalness: .35 });
    M.dome = new THREE.MeshStandardMaterial({ color: Col(0x7fb8c4), roughness: .35, metalness: .55, envMapIntensity: 1.2 });
    M.stone = new THREE.MeshStandardMaterial({ color: Col(0xe6dcc3), roughness: .85, metalness: 0 });
    M.metalDark = new THREE.MeshStandardMaterial({ color: Col(0x2a2f36), roughness: .45, metalness: .7 });
    M.metalLight = new THREE.MeshStandardMaterial({ color: Col(0xc8d0d8), roughness: .3, metalness: .9, envMapIntensity: 1.2 });
    M.glassTower = new THREE.MeshStandardMaterial({ color: Col(0x7aaec4), roughness: .08, metalness: .9, envMapIntensity: 1.6 });
    M.trunk = new THREE.MeshStandardMaterial({ color: Col(0x7c5e3e), roughness: .95, metalness: 0 });
    M.leaf = new THREE.MeshStandardMaterial({ color: Col(0x3f7d2d), roughness: .7, metalness: 0, side: THREE.DoubleSide });
    M.leaf2 = new THREE.MeshStandardMaterial({ color: Col(0x2f6a28), roughness: .8, metalness: 0 });
    M.pine = new THREE.MeshStandardMaterial({ color: Col(0x24512f), roughness: .9, metalness: 0 });
    M.rock = new THREE.MeshStandardMaterial({ color: Col(0x7b766e), roughness: .95, metalness: 0 });
    M.snow = new THREE.MeshStandardMaterial({ color: Col(0xf4f7fb), roughness: .7, metalness: 0 });
    M.dune = new THREE.MeshStandardMaterial({ color: Col(0xd9a964), roughness: 1, metalness: 0 });
    M.wood = new THREE.MeshStandardMaterial({ color: Col(0x8d6a45), roughness: .9, metalness: 0 });
    M.sail = new THREE.MeshStandardMaterial({ color: Col(0xf4efe3), roughness: .8, metalness: 0, side: THREE.DoubleSide });
    M.boatHull = new THREE.MeshStandardMaterial({ color: Col(0x5c3b25), roughness: .8, metalness: 0 });
    M.lampPole = new THREE.MeshStandardMaterial({ color: Col(0x8a929b), roughness: .45, metalness: .7 });
    M.lampHead = new THREE.MeshStandardMaterial({ color: Col(0xfff3cf), emissive: Col(0xffe7a8), emissiveIntensity: this.nightMode ? 3.2 : .35, roughness: .4, metalness: 0 });
    // water (right-hand side for sea / nile)
    const wn = this._t(TexLab.waterNormal()); wn.repeat.set(1, 1);
    const wcol = env.water === 'nile' ? 0x486a4f : env.id === 'istanbul' ? 0x2f7f98 : 0x1f7fa6;
    M.water = new THREE.MeshStandardMaterial({ color: Col(wcol), roughness: .06, metalness: .25, normalMap: wn, normalScale: new THREE.Vector2(.55, .55), envMapIntensity: 1.5, transparent: false });
    // signs
    const names = this.signNames();
    M.signs = names.map(n => new THREE.MeshStandardMaterial({ map: this._t(TexLab.sign(n.lines, { bg: n.bg })), roughness: .55, metalness: .1 }));
    M.signBack = new THREE.MeshStandardMaterial({ color: Col(0x777f88), roughness: .6, metalness: .6 });
    // facades
    this.facadeSets = this.facadeStylesFor();
    this.facadeMats = {};
    const tex = this;
    this.facadeSets.forEach(style => {
      const variants = style === 'glass_tower' ? 4 : 3;
      for (let v = 0; v < variants; v++) {
        const f = TexLab.facade(style, v);
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(k => this._t(f[k]));
        const m = new THREE.MeshStandardMaterial({
          map: f.map, normalMap: f.normalMap, roughnessMap: f.roughnessMap, metalnessMap: f.metalnessMap,
          roughness: 1, metalness: 1, envMapIntensity: style === 'glass_tower' ? 1.5 : 1.0, normalScale: new THREE.Vector2(.8, .8),
          emissive: new THREE.Color(0xffffff), emissiveMap: f.emissiveMap, emissiveIntensity: this.nightMode ? 1.25 : 0
        });
        this.facadeMats[style + ':' + v] = m;
        M['f:' + style + ':' + v] = m;
      }
    });
    this.dispose_mats_extra = [];
  },

  facadeStylesFor() {
    switch (this.theme) {
      case 'gulf': return ['glass_tower', 'sand_stone'];
      case 'cairo': return ['cairo', 'sand_stone', 'glass_tower'];
      case 'europe': return [this.env.facade || 'brick'];
      case 'historic': return ['istanbul', 'sand_stone'];
      case 'metropolis': return ['nyc', 'glass_tower'];
      default: return ['modern'];
    }
  },
  signNames() {
    const E = this.env.id;
    const city = { doha: [['الكورنيش', 'Corniche'], ['وست باي', 'West Bay'], ['الدوحة', 'DOHA']], cairo: [['كورنيش النيل', 'Nile Corniche'], ['وسط البلد', 'Downtown'], ['القاهرة', 'CAIRO']], dubai: [['وسط المدينة', 'Downtown'], ['المرسى', 'Marina'], ['دبي', 'DUBAI']], riyadh: [['العليا', 'Olaya'], ['الدرعية', 'Diriyah'], ['الرياض', 'RIYADH']], london: [['ويستمنستر', 'Westminster'], ['المركز', 'City'], ['لندن', 'LONDON']], paris: [['الشانزليزيه', 'Champs-Élysées'], ['اللوفر', 'Louvre'], ['باريس', 'PARIS']], istanbul: [['البوسفور', 'Bosphorus'], ['السلطان أحمد', 'Sultanahmet'], ['إسطنبول', 'ISTANBUL']], new_york: [['مانهاتن', 'Manhattan'], ['بروكلين', 'Brooklyn'], ['نيويورك', 'NEW YORK']] }[E];
    const base = (city || [['الطريق السريع', 'Highway'], ['الاتجاه', 'Ahead'], ['المدينة', 'City']]);
    const customName = APP_CONFIG.customCityName;
    return base.map((b, i) => ({ lines: (E === 'custom_city' && customName && i === 2) ? [customName] : [b[0], b[1]], bg: i === 1 ? '#0b4f8f' : '#0b6b3a' }));
  },

  /* ============ geometry helpers ============ */
  _p(s, d, y = 0) { const o = RoadPath.world(s, d, this.tmp); return [o.x, o.y + y, o.z]; },
  strip(B, key, s0, s1, d0, d1, y, step, uvMode, extra) {
    const L = [], R = [], UL = [], UR = [];
    const n = Math.max(1, Math.ceil((s1 - s0) / step));
    for (let i = 0; i <= n; i++) {
      const s = s0 + (s1 - s0) * i / n;
      const a = RoadPath.world(s, d0, this.tmp), b = RoadPath.world(s, d1, this.tmp2);
      const ya = typeof y === 'function' ? y(s, d0, a) : a.y + y, yb = typeof y === 'function' ? y(s, d1, b) : b.y + y;
      L.push([a.x, ya, a.z]); R.push([b.x, yb, b.z]);
      if (uvMode === 'road') { UL.push([(d0 + ROAD_HALF) / 4, s / 4]); UR.push([(d1 + ROAD_HALF) / 4, s / 4]); }
      else if (uvMode === 'kerb') { UL.push([0, s / 2]); UR.push([1, s / 2]); }
      else { UL.push([a.x / 8, a.z / 8]); UR.push([b.x / 8, b.z / 8]); }
    }
    B.ribbon(key, L, R, UL, UR, [0, 1, 0], d1 < d0);
  },

  /* ============ chunk construction ============ */
  chunkRange(sPlayer) {
    const a = Math.max(0, Math.floor((sPlayer - this.Q.behind) / this.CH)), b = Math.floor((sPlayer + this.Q.ahead) / this.CH);
    return [a, Math.min(b, Math.floor((RoadPath.length - 2) / this.CH))];
  },

  /** build every chunk synchronously (used when a race starts or the world is rebuilt) */
  prime(sPlayer) {
    const [a, b] = this.chunkRange(sPlayer);
    for (let i = a; i <= b; i++) if (!this.chunks.has(i)) this.buildChunk(i);
  },

  update(sPlayer, budget) {
    const [a, b] = this.chunkRange(sPlayer);
    // remove far-behind / beyond chunks
    this.chunks.forEach((c, idx) => { if (idx < a - 1 || idx > b + 2) { disposeGroupGeometry(c.group); this.root.remove(c.group); this.chunks.delete(idx); } });
    let built = 0; const maxBuild = budget === undefined ? this.Q.buildPerFrame : budget;
    // build nearest-first (ahead of the player)
    for (let i = a; i <= b && built < maxBuild; i++) {
      if (!this.chunks.has(i)) { this.buildChunk(i); built++; }
    }
    // animated water
    if (this.mats.water) { const t = performance.now() * 0.00004; this.mats.water.normalMap.offset.set(t, t * .6); }
  },

  buildChunk(idx) {
    const s0 = idx * this.CH, s1 = s0 + this.CH;
    const group = new THREE.Group(); group.name = 'chunk' + idx;
    const B = new GeoBatch(); const env = this.env, Q = this.Q;
    const step = 2;
    // --- road surface, shoulders, kerbs ---
    this.strip(B, 'road', s0, s1, -ROAD_HALF, ROAD_HALF, 0, step, 'road');
    this.strip(B, 'shoulder', s0, s1, -SHOULDER_END, -ROAD_HALF, -0.02, step, 'ground');
    this.strip(B, 'shoulder', s0, s1, ROAD_HALF, SHOULDER_END, -0.02, step, 'ground');
    this.strip(B, 'kerb', s0, s1, -ROAD_HALF - 0.38, -ROAD_HALF, 0.035, step, 'kerb');
    this.strip(B, 'kerb', s0, s1, ROAD_HALF, ROAD_HALF + 0.38, 0.035, step, 'kerb');
    // --- markings: solid edge lines + dashed lane dividers, aligned to global s ---
    this.strip(B, 'paintW', s0, s1, -ROAD_HALF + 0.55, -ROAD_HALF + 0.73, 0.012, step);
    this.strip(B, 'paintW', s0, s1, ROAD_HALF - 0.73, ROAD_HALF - 0.55, 0.012, step);
    const dashP = 9, dashL = 3.6;
    for (let k = Math.floor(s0 / dashP) - 1; k * dashP < s1; k++) {
      const a = Math.max(s0, k * dashP), b = Math.min(s1, k * dashP + dashL);
      if (b - a < 0.2) continue;
      for (const lane of [-ROAD_HALF / 3, ROAD_HALF / 3]) this.strip(B, 'paintW', a, b, lane - .09, lane + .09, 0.012, 1.8);
    }
    if (idx === 0) this.startGrid(B);
    // --- guardrails (beam + posts) both sides; sea side gets a low concrete parapet instead ---
    this.guardrails(B, s0, s1);
    // --- ground, pavements, water ---
    this.groundAndWater(B, s0, s1);
    // --- scenery ---
    this.scenery(B, idx, s0, s1, group);
    const flags = { wallCast: true };
    const castKeys = {};
    this.facadeSets.forEach(st => { for (let v = 0; v < 4; v++) castKeys['f:' + st + ':' + v] = { cast: Q.shadows && this.preset !== 'low', receive: true }; });
    castKeys.palmTrunk = { cast: false, receive: false }; castKeys.rail = { cast: false, receive: true };
    castKeys.road = { cast: false, receive: true };
    const meshes = B.build(group, this.keyMaterials(), castKeys);
    meshes.forEach(m => { m.matrixAutoUpdate = false; m.updateMatrix(); });
    group.userData.idx = idx;
    this.root.add(group);
    this.chunks.set(idx, { group, idx });
    return group;
  },

  keyMaterials() {
    if (this._km) return this._km;
    const M = this.mats; const km = {};
    const m = new Proxy({}, { get: (t, key) => { if (typeof key !== 'string') return undefined; if (key.startsWith('f:')) return this.facadeMats[key.slice(2)]; if (/^sign\d/.test(key)) return M.signs[+key.slice(4)]; const map = { road: M.road, shoulder: M.shoulder, kerb: M.kerb, paintW: M.paintW, paintY: M.paintY, rail: M.rail, post: M.post, ground: M.ground, paving: M.paving, concrete: M.concrete, roof: M.roof, roofRed: M.roofRed, roofZinc: M.roofZinc, dome: M.dome, stone: M.stone, metalDark: M.metalDark, metalLight: M.metalLight, glassTower: M.glassTower, palmTrunk: M.trunk, palmLeaf: M.leaf, leaf2: M.leaf2, pine: M.pine, rock: M.rock, snow: M.snow, dune: M.dune, wood: M.wood, sail: M.sail, boatHull: M.boatHull, lampPole: M.lampPole, lampHead: M.lampHead, water: M.water, signBack: M.signBack }; return map[key]; } });
    return m;
  },

  /* ----- start grid ----- */
  startGrid(B) {
    for (let r = 0; r < 6; r++) for (const side of [-1, 1]) {
      const s = 3 + r * 7.5 + (side > 0 ? 3.5 : 0), d = side * 2.3;
      this.strip(B, 'paintW', s - .7, s + .7, d - 1.6, d - 1.45, .013, 1.4);
      this.strip(B, 'paintW', s - .7, s + .7, d + 1.45, d + 1.6, .013, 1.4);
      this.strip(B, 'paintW', s - .7, s - .55, d - 1.6, d + 1.6, .013, 1.4);
    }
  },

  /* ----- guardrails ----- */
  guardrails(B, s0, s1) {
    const seaSide = !!this.env.water;
    for (const side of [-1, 1]) {
      const d = side * RAIL_D;
      const beamBottom = [], beamTop = [], nrm = [], uv = [];
      const n = Math.ceil((s1 - s0) / 2);
      for (let i = 0; i <= n; i++) {
        const s = s0 + (s1 - s0) * i / n, o = RoadPath.world(s, d, this.tmp);
        const isSea = seaSide && side > 0;
        beamBottom.push([o.x, o.y + (isSea ? 0 : .42), o.z]); beamTop.push([o.x, o.y + (isSea ? 1.0 : .78), o.z]);
        nrm.push([-o.nx * side, 0, -o.nz * side]); uv.push([s / 4, 1]);
      }
      B.wall(seaSide && side > 0 ? 'concrete' : 'rail', beamBottom, beamTop, nrm, uv);
      // posts every 4 m
      for (let k = Math.ceil(s0 / 4); k * 4 < s1; k++) {
        if (seaSide && side > 0) continue;
        const o = RoadPath.world(k * 4, d, this.tmp);
        B.plainBox('post', .13, .78, .13, GeoBatch.mat(o.x, o.y - .05, o.z, o.yaw));
      }
    }
  },

  /* ----- ground, promenade and water ----- */
  groundAndWater(B, s0, s1) {
    const step = 4, env = this.env;
    const waterSide = env.water ? 1 : 0;
    // left side: pavement then ground
    this.strip(B, 'paving', s0, s1, -SHOULDER_END - 3.4, -SHOULDER_END, -.03, step, 'ground');
    this.strip(B, 'ground', s0, s1, -75, -SHOULDER_END - 3.4, (s, d, o) => o.y - .06 - Math.max(0, (-d - 20)) * .035, step, 'ground');
    if (!waterSide) {
      this.strip(B, 'paving', s0, s1, SHOULDER_END, SHOULDER_END + 3.4, -.03, step, 'ground');
      this.strip(B, 'ground', s0, s1, SHOULDER_END + 3.4, 75, (s, d, o) => o.y - .06 - Math.max(0, (d - 20)) * .035, step, 'ground');
    } else {
      // promenade + sea wall + water level
      const wallD = env.water === 'nile' ? 20 : 22;
      this.strip(B, 'paving', s0, s1, SHOULDER_END, wallD, -.03, step, 'ground');
      const top = [], bot = [], nrm = [], uv = [];
      const n = Math.ceil((s1 - s0) / step);
      for (let i = 0; i <= n; i++) {
        const s = s0 + (s1 - s0) * i / n, o = RoadPath.world(s, wallD, this.tmp);
        top.push([o.x, o.y - .03, o.z]); bot.push([o.x, this.waterLevel, o.z]); nrm.push([-o.nx, 0, -o.nz]); uv.push([s / 6, (o.y - this.waterLevel) / 6]);
      }
      B.wall('concrete', bot, top, nrm, uv);
      // water: wide quad strip at a constant level, world-space UVs so the normal map is continuous
      const far = env.water === 'nile' ? 170 : 330;
      const L = [], R = [], UL = [], UR = [];
      for (let i = 0; i <= n; i++) {
        const s = s0 + (s1 - s0) * i / n, a = RoadPath.world(s, wallD - .2, this.tmp), b = RoadPath.world(s, far, this.tmp2);
        L.push([a.x, this.waterLevel, a.z]); R.push([b.x, this.waterLevel, b.z]); UL.push([a.x / 22, a.z / 22]); UR.push([b.x / 22, b.z / 22]);
      }
      B.ribbon('water', L, R, UL, UR, [0, 1, 0], false);
      if (env.water === 'nile') { // far bank
        this.strip(B, 'ground', s0, s1, 170, 330, (s, d, o) => this.waterLevel + .6 + (d - 170) * .01, step, 'ground');
      }
    }
  },

  /* ============ scenery ============ */
  rng(tag, slot) { return mulberry32(hashString(this.env.id + tag + slot)); },

  facadeKey(style, rnd) { const v = style === 'glass_tower' ? 4 : 3; return 'f:' + style + ':' + ((rnd() * v) | 0); },

  scenery(B, idx, s0, s1, group) {
    const th = this.theme, Q = this.Q;
    this.lampsAndSigns(B, idx, s0, s1);
    if (['gulf', 'cairo', 'europe', 'historic', 'metropolis'].includes(th)) this.cityRows(B, idx, s0, s1, group);
    else this.natureRows(B, idx, s0, s1, group);
  },

  /* ----- lamps, signs ----- */
  lampsAndSigns(B, idx, s0, s1) {
    const night = this.nightMode;
    for (let k = Math.ceil(s0 / 40); k * 40 < s1; k++) {
      const s = k * 40;
      for (const side of [-1, 1]) {
        if (this.env.water && side > 0 && ((k & 1) === 0)) continue;
        const o = RoadPath.world(s + (side > 0 ? 20 : 0), side * 10.2, this.tmp);
        const yaw = o.yaw; const m = GeoBatch.mat(o.x, o.y - .05, o.z, yaw);
        B.cyl('lampPole', .07, .1, 8.4, 8, m, { cap: false });
        // arm reaching over the road
        const arm = GeoBatch.mat(o.x, o.y + 8.1, o.z, yaw);
        const armM = new THREE.Matrix4().multiplyMatrices(arm, new THREE.Matrix4().makeTranslation(-side * 1.4, 0, 0));
        B.plainBox('lampPole', 2.8, .09, .09, armM);
        const headM = new THREE.Matrix4().multiplyMatrices(arm, new THREE.Matrix4().makeTranslation(-side * 2.7, -.02, 0));
        B.plainBox('lampHead', .75, .12, .32, headM);
      }
    }
    // gantry/side signs every ~480 m
    const slot = Math.floor((s0 + 200) / 480);
    const ss = slot * 480 - 200;
    if (ss >= s0 && ss < s1 && ss > 100) {
      const rn = this.rng('sign', slot), which = (rn() * this.mats.signs.length) | 0;
      const o = RoadPath.world(ss, -10.6, this.tmp);
      const m = GeoBatch.mat(o.x, o.y - .05, o.z, o.yaw);
      B.cyl('lampPole', .09, .09, 4.8, 8, m, { cap: false });
      const mm = new THREE.Matrix4().multiplyMatrices(GeoBatch.mat(o.x, o.y + 3.6, o.z, o.yaw), new THREE.Matrix4().makeTranslation(0, 0, 0));
      // sign face: a plain box with the sign texture on the road-facing +Z face; others use back material
      this.signPanel(B, which, mm);
    }
  },
  signPanel(B, which, m) {
    const key = 'sign' + which, b = B.bucket(key);
    // two-sided face toward oncoming traffic (+Z local = toward the driver)
    B._quad(b, m, [[-1.6, -.6, .07], [1.6, -.6, .07], [1.6, .6, .07], [-1.6, .6, .07]], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    B.plainBox('signBack', 3.3, 1.3, .1, m);
  },

  /* ----- city building rows ----- */
  cityRows(B, idx, s0, s1, group) {
    const th = this.theme, env = this.env, Q = this.Q;
    const slotLen = 20;
    for (let slot = Math.floor(s0 / slotLen); slot * slotLen < s1; slot++) {
      const sc = slot * slotLen + slotLen / 2;
      for (const side of [-1, 1]) {
        if (env.water && side > 0) { this.waterfrontProps(B, slot, sc, side, group); continue; }
        const rn = this.rng('b' + side, slot);
        if (rn() > Q.density + .22 && Q.density < 1) { this.streetTrees(B, rn, sc, side); continue; }
        this.buildingSlot(B, rn, slot, sc, side, th, 'front');
        if (Q.far && slot % 2 === 0) this.buildingSlot(B, this.rng('back' + side, slot), slot, sc, side, th, 'back');
        if (Q.far && slot % 3 === 0 && (th === 'gulf' || th === 'metropolis')) this.buildingSlot(B, this.rng('far' + side, slot), slot, sc, side, th, 'far');
        this.streetTrees(B, rn, sc, side);
      }
      // far bank skyline across the water
      if (env.water && Q.far && slot % 2 === 0) this.farBank(B, slot, sc);
      if (slot % 55 === 17) this.landmark(B, slot, sc, group);
    }
    if (env.water === 'nile') this.boats(B, idx, s0, s1);
  },

  buildingSlot(B, rn, slot, sc, side, th, row) {
    const env = this.env;
    // row geometry
    let front, depth, frontage, h, style, towerKind = null;
    const gulfy = th === 'gulf', metro = th === 'metropolis';
    if (row === 'front') {
      front = (env.water ? 12.5 : 14) + rn() * 4; depth = 14 + rn() * 8; frontage = 17 + rn() * 2.6;
      if (th === 'cairo') { front = 11 + rn() * 1.5; frontage = 19.4; h = 16 + ((rn() * 7) | 0) * 3; style = ['cairo', 'cairo', 'cairo', 'sand_stone'][(rn() * 4) | 0]; }
      else if (th === 'europe') { frontage = 19.6; h = 15 + ((rn() * 4) | 0) * 3; style = env.facade || 'brick'; front = 11.5 + rn() * 1.2; }
      else if (th === 'historic') { frontage = 18.6; h = 9 + ((rn() * 4) | 0) * 3; style = ['istanbul', 'istanbul', 'sand_stone'][(rn() * 3) | 0]; front = 12 + rn() * 3; }
      else if (metro) { frontage = 19.5; h = 24 + ((rn() * 14) | 0) * 3; style = rn() < .62 ? 'nyc' : 'glass_tower'; front = 11.5 + rn(); }
      else { h = 8 + ((rn() * 5) | 0) * 3; style = 'sand_stone'; if (rn() < (.28 * (env.towerBias || 1))) { h = 42 + rn() * 55; style = 'glass_tower'; depth = 22; frontage = 17; } }
    } else if (row === 'back') {
      front = 38 + rn() * 14; depth = 26 + rn() * 10; frontage = 26 + rn() * 6; h = (gulfy ? 50 : metro ? 70 : 24) * (.6 + rn() * (env.towerBias || 1)) + 10;
      style = th === 'cairo' ? 'cairo' : th === 'europe' ? (env.facade || 'brick') : th === 'historic' ? 'istanbul' : 'glass_tower';
      if (th === 'europe' || th === 'historic') h = 14 + rn() * 12;
    } else { // far skyline, low-detail slabs
      front = 90 + rn() * 90; depth = 30 + rn() * 20; frontage = 30 + rn() * 12; h = (metro ? 110 : 80) * (.5 + rn() * (env.towerBias || 1) * .9) + 30; style = 'glass_tower';
    }
    // plot may stay empty (parks, plazas)
    if (row === 'front' && rn() < (gulfy ? .12 : .05) && th !== 'cairo') return;
    const key = this.facadeKey(style, rn);
    const cOff = side * (front + depth / 2);
    const ctr = RoadPath.world(sc, cOff, this.tmp);
    const yaw = ctr.yaw, y0 = ctr.y - 2.2, H = h + 2.2;
    const mat = GeoBatch.mat(ctr.x, y0, ctr.z, yaw);
    const rotAlong = rn() * 12;
    // main block (some towers get stepped / twisted silhouettes)
    const shapeRoll = rn();
    if (style === 'glass_tower' && h > 40 && row !== 'far' && (gulfy || metro)) {
      if (shapeRoll < .3 && gulfy) this.twistedTower(B, key, ctr, yaw, y0, depth * .8, frontage * .9, H, rn);
      else if (shapeRoll < .52) this.steppedTower(B, key, ctr, yaw, y0, depth, frontage, H, rn);
      else if (shapeRoll < .7 && gulfy) this.cylTower(B, key, ctr, yaw, y0, Math.min(depth, frontage) * .62, H, rn);
      else this.plainTower(B, key, mat, depth, frontage, H, rn);
    } else {
      B.box(key, 'roof', depth, H, frontage, mat, [12, 12], rn() * 3, 0);
      this.roofDetail(B, rn, ctr, yaw, y0 + H, depth, frontage, th, side);
      if (th === 'cairo' && this.Q.balconies > 0 && row === 'front') this.balconies(B, rn, ctr, yaw, side, depth, frontage, h, y0);
      if (th === 'europe' && env.facade === 'haussmann' && row === 'front') this.mansard(B, ctr, yaw, y0 + H, depth, frontage);
      if (th === 'historic' && row === 'front') this.pitchedRoof(B, ctr, yaw, y0 + H, depth, frontage, rn);
    }
  },

  plainTower(B, key, mat, depth, frontage, H, rn) {
    B.box(key, 'roof', depth, H, frontage, mat, [12, 12], rn() * 3, 0);
    // crown: setback box + antenna
    const m2 = new THREE.Matrix4().multiplyMatrices(mat, new THREE.Matrix4().makeTranslation(0, H, 0));
    B.plainBox('metalLight', depth * .5, 3.2, frontage * .5, m2);
    B.cyl('metalLight', .18, .1, 9 + rn() * 12, 6, new THREE.Matrix4().multiplyMatrices(m2, new THREE.Matrix4().makeTranslation(0, 3.2, 0)), { cap: false });
  },
  steppedTower(B, key, ctr, yaw, y0, depth, frontage, H, rn) {
    let y = y0, d = depth, f = frontage; const tiers = 3 + ((rn() * 2) | 0);
    for (let t = 0; t < tiers; t++) {
      const h = (t === tiers - 1 ? H * .22 : H * (.78 / (tiers - 1))) * 1;
      B.box(key, 'roof', d, h, f, GeoBatch.mat(ctr.x, y, ctr.z, yaw), [12, 12], t * .37, y / 12);
      y += h; d *= .8; f *= .8;
    }
    B.cyl('metalLight', .22, .04, 16 + rn() * 14, 6, GeoBatch.mat(ctr.x, y, ctr.z, yaw), { cap: false });
  },
  twistedTower(B, key, ctr, yaw, y0, depth, frontage, H, rn) {
    const n = 14, h = H / n, tw = (rn() < .5 ? 1 : -1) * 0.07;
    for (let i = 0; i < n; i++) {
      const k = 1 - i / n * .22;
      B.box(key, 'roof', depth * k, h + .05, frontage * k, GeoBatch.mat(ctr.x, y0 + i * h, ctr.z, yaw + tw * i), [12, 12], i * .11, i * h / 12);
    }
    B.cyl('metalLight', .2, .05, 14, 6, GeoBatch.mat(ctr.x, y0 + H, ctr.z, yaw + tw * n), { cap: false });
  },
  cylTower(B, key, ctr, yaw, y0, r, H, rn) {
    B.cyl(key, r, r * .93, H, 28, GeoBatch.mat(ctr.x, y0, ctr.z, yaw), { cap: true, vRepeat: H / 12, uRepeat: 2 * Math.PI * r / 12 });
    B.dome('dome', r * .94, 20, 6, GeoBatch.mat(ctr.x, y0 + H, ctr.z, yaw), Math.PI / 2);
    B.cyl('metalLight', .25, .04, 20, 6, GeoBatch.mat(ctr.x, y0 + H + r * .9, ctr.z, yaw), { cap: false });
  },

  roofDetail(B, rn, ctr, yaw, yTop, depth, frontage, th, side) {
    const m = GeoBatch.mat(ctr.x, yTop, ctr.z, yaw);
    // parapet rim + rooftop units
    B.plainBox('concrete', depth + .3, .7, .3, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, 0, frontage / 2)));
    B.plainBox('concrete', depth + .3, .7, .3, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, 0, -frontage / 2)));
    B.plainBox('concrete', .3, .7, frontage, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(depth / 2, 0, 0)));
    B.plainBox('concrete', .3, .7, frontage, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(-depth / 2, 0, 0)));
    const nUnits = 1 + ((rn() * 3) | 0);
    for (let i = 0; i < nUnits; i++) {
      const u = new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation((rn() - .5) * depth * .5, 0, (rn() - .5) * frontage * .6));
      B.plainBox('metalLight', 1.6 + rn() * 2, 1.2 + rn() * 1.6, 1.6 + rn() * 2.4, u);
    }
    if (th === 'metropolis' && rn() < .5) { // water tower
      const u = new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(depth * .2, 0, frontage * .15));
      B.cyl('wood', 1.7, 1.7, 3.2, 14, new THREE.Matrix4().multiplyMatrices(u, new THREE.Matrix4().makeTranslation(0, 2.4, 0)), { cap: true });
      B.cyl('metalDark', 1.9, 0.1, 1.0, 14, new THREE.Matrix4().multiplyMatrices(u, new THREE.Matrix4().makeTranslation(0, 5.6, 0)), { cap: false });
      for (const x of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) B.plainBox('metalDark', .12, 2.4, .12, new THREE.Matrix4().multiplyMatrices(u, new THREE.Matrix4().makeTranslation(x, 0, z)));
    }
    if (th === 'europe' && rn() < .55) { // chimney pots
      for (let i = 0; i < 3; i++) B.plainBox('roofRed', .9, 2.4, .9, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(depth * .25, 0, (i - 1) * frontage * .28)));
    }
  },
  mansard(B, ctr, yaw, yTop, depth, frontage) {
    const m = GeoBatch.mat(ctr.x, yTop, ctr.z, yaw);
    B.box('roofZinc', 'roofZinc', depth * .9, 3.2, frontage * .98, m, [6, 6]);
    B.box('roofZinc', 'roofZinc', depth * .6, 1.6, frontage * .9, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, 3.2, 0)), [6, 6]);
  },
  pitchedRoof(B, ctr, yaw, yTop, depth, frontage, rn) {
    const m = GeoBatch.mat(ctr.x, yTop, ctr.z, yaw);
    B.cyl('roofRed', Math.max(depth, frontage) * .62, Math.max(depth, frontage) * .12, 3.4, 4, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeRotationY(Math.PI / 4)), { cap: true });
  },
  balconies(B, rn, ctr, yaw, side, depth, frontage, h, y0) {
    const k = this.Q.balconies, floors = Math.floor(h / 3);
    const faceX = -side * (depth / 2 + .45); // toward the road
    for (let fl = 1; fl < floors; fl++) {
      for (let c = 0; c < 6; c++) {
        if (rn() > .6 * k + .15) continue;
        const z = -frontage / 2 + 1.6 + c * 3.1;
        const m = new THREE.Matrix4().multiplyMatrices(GeoBatch.mat(ctr.x, y0 + 2.2 + fl * 3 + .45, ctr.z, yaw), new THREE.Matrix4().makeTranslation(faceX, 0, z));
        B.plainBox('concrete', .9, .16, 2.3, m);
        B.plainBox('metalDark', .06, .95, 2.3, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(-side * -.42, .16, 0)).multiply(new THREE.Matrix4().makeTranslation(side * .0, 0, 0)));
      }
    }
  },

  /* ----- trees, palms ----- */
  palm(B, x, y, z, yaw, scale, rn) {
    const lean = (rn() - .5) * .22, h = (7 + rn() * 4) * scale;
    const m = GeoBatch.mat(x, y, z, yaw, scale, scale, scale, lean, 0);
    B.cyl('palmTrunk', .26, .17, h / scale, 7, m, { cap: false });
    const top = new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, h / scale, 0));
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + rn() * .2, droop = .5 + rn() * .25, len = 3.6 + rn() * 1.2;
      const lm = new THREE.Matrix4().multiplyMatrices(top, new THREE.Matrix4().makeRotationY(a));
      // frond: 4-segment tapered, drooping strip
      const L = [], R = [], U = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4, w = .55 * Math.sin(Math.PI * Math.min(1, t * 1.15 + .12)) + .04;
        const px = t * len, py = Math.sin(t * Math.PI * .55) * .8 - t * t * droop * len * .5;
        const v1 = new THREE.Vector3(px, py, -w).applyMatrix4(lm), v2 = new THREE.Vector3(px, py, w).applyMatrix4(lm);
        L.push([v1.x, v1.y, v1.z]); R.push([v2.x, v2.y, v2.z]); U.push([0, t]);
      }
      B.ribbon('palmLeaf', L, R, U, U, [0, 1, 0], false);
    }
  },
  streetTrees(B, rn, sc, side) {
    const th = this.theme, env = this.env;
    if (rn() > this.Q.palms) return;
    const p = RoadPath.world(sc + (rn() - .5) * 8, side * (SHOULDER_END + 1.8), this.tmp);
    if (th === 'gulf' || th === 'cairo' || env.water) { this.palm(B, p.x, p.y - .05, p.z, rn() * 6, .9 + rn() * .25, rn); }
    else this.roundTree(B, p.x, p.y, p.z, rn);
  },
  roundTree(B, x, y, z, rn) {
    const s = .9 + rn() * .5, m = GeoBatch.mat(x, y - .05, z, 0, s);
    B.cyl('palmTrunk', .2, .28, 3.2, 6, m, { cap: false });
    B.dome('leaf2', 2.1, 10, 5, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, 3.0, 0)).multiply(new THREE.Matrix4().makeScale(1, 1.2, 1)), Math.PI * .85);
  },
  waterfrontProps(B, slot, sc, side, group) {
    const rn = this.rng('wf', slot);
    // palms + benches on the promenade; occasional small kiosk
    if (rn() < this.Q.palms * .85) { const p = RoadPath.world(sc + (rn() - .5) * 8, SHOULDER_END + 2.5 + rn() * 7, this.tmp); this.palm(B, p.x, p.y - .05, p.z, rn() * 6, 1 + rn() * .25, rn); }
    if (slot % 4 === 1) {
      const p = RoadPath.world(sc, SHOULDER_END + 6, this.tmp);
      B.plainBox('wood', 2.2, .12, .6, GeoBatch.mat(p.x, p.y + .45, p.z, p.yaw + Math.PI / 2));
      B.plainBox('metalDark', .1, .45, .1, GeoBatch.mat(p.x, p.y, p.z, p.yaw));
    }
  },
  farBank(B, slot, sc) {
    const rn = this.rng('fb', slot), env = this.env;
    const d = (env.water === 'nile' ? 215 : 380) + rn() * 40;
    const o = RoadPath.world(sc, d, this.tmp);
    const h = this.theme === 'cairo' ? 18 + rn() * 26 : 40 + rn() * 120;
    const key = this.facadeKey(this.theme === 'cairo' ? 'cairo' : 'glass_tower', rn);
    B.box(key, 'roof', 24 + rn() * 14, h, 26 + rn() * 12, GeoBatch.mat(o.x, this.waterLevel, o.z, o.yaw), [12, 12], rn() * 2, 0);
  },
  boats(B, idx, s0, s1) { // felucca-style sailing boats on the Nile
    const slot = Math.floor((s0 + s1) / 2 / 120), rn = this.rng('boat', slot);
    const s = slot * 120 + rn() * 80; if (s < s0 || s >= s1) return;
    const o = RoadPath.world(s, 48 + rn() * 70, this.tmp);
    const bm = GeoBatch.mat(o.x, this.waterLevel + .05, o.z, o.yaw + rn() * 3);
    B.plainBox('boatHull', 1.2, .45, 5.2, bm);
    B.cyl('wood', .06, .05, 6, 5, bm, { cap: false });
    // triangular sail
    const sm = new THREE.Matrix4().multiplyMatrices(bm, new THREE.Matrix4().makeTranslation(0, 0, 0));
    const p = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(sm);
    const a = p(0, .5, 2.4), b = p(0, 5.8, 0), c = p(0, .8, -2.2);
    const bk = B.bucket('sail'), base = bk.p.length / 3;
    for (const v of [a, b, c]) { bk.p.push(v.x, v.y, v.z); bk.n.push(0, 0, 1); }
    bk.u.push(0, 0, .5, 1, 1, 0); bk.i.push(base, base + 1, base + 2);
  },

  /* ----- landmarks (inspired, not exact replicas) ----- */
  landmark(B, slot, sc, group) {
    const env = this.env, id = env.landmark || ({ doha: 'twist', cairo: 'cairotower' }[env.id]);
    if (!id) return;
    const side = -1, d = side * (id === 'cairotower' ? 62 : 80);
    const o = RoadPath.world(sc, d, this.tmp), yaw = o.yaw, y0 = o.y - 2;
    const M = (x, y, z, ry = 0) => GeoBatch.mat(o.x + x, y0 + y, o.z + z, yaw + ry);
    const beam = (x1, y1, z1, x2, y2, z2, th, key) => { // thin box between two points
      const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2), mid = a.clone().add(b).multiplyScalar(.5), len = a.distanceTo(b);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      const m = new THREE.Matrix4().compose(new THREE.Vector3(o.x + mid.x, y0 + mid.y - len / 2 * 0, o.z + mid.z), q, new THREE.Vector3(1, 1, 1));
      const mm = new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, 0, 0));
      B.plainBox(key || 'metalLight', th, len, th, mm, -len / 2);
    };
    switch (id) {
      case 'cairotower': { // hyperboloid lattice shaft with a lotus-like crown
        const N = 16, H = 150, R0 = 9, Rm = 5.2;
        for (let i = 0; i < N; i++) {
          const a0 = i / N * Math.PI * 2;
          for (let k = 0; k < 9; k++) {
            const t0 = k / 9, t1 = (k + 1) / 9;
            const r = t => Rm + (R0 - Rm) * Math.pow(Math.abs(2 * t - 1), 1.4);
            const tw = 0.9;
            const p0 = [Math.cos(a0 + tw * t0) * r(t0), t0 * H, Math.sin(a0 + tw * t0) * r(t0)], p1 = [Math.cos(a0 + tw * t1) * r(t1), t1 * H, Math.sin(a0 + tw * t1) * r(t1)];
            const q0 = [Math.cos(a0 - tw * t0) * r(t0), t0 * H, Math.sin(a0 - tw * t0) * r(t0)], q1 = [Math.cos(a0 - tw * t1) * r(t1), t1 * H, Math.sin(a0 - tw * t1) * r(t1)];
            beam(...p0, ...p1, .5, 'stone'); beam(...q0, ...q1, .5, 'stone');
          }
        }
        B.cyl('stone', 8.5, 12, 4, 20, M(0, H - 2, 0), { cap: true }); B.cyl('glassTower', 12, 12, 9, 20, M(0, H + 2, 0), { cap: true }); B.dome('dome', 12, 20, 5, M(0, H + 11, 0));
        B.cyl('metalLight', .5, .1, 40, 6, M(0, H + 17, 0), { cap: false });
        B.cyl('stone', 14, 16, 8, 24, M(0, 0, 0), { cap: true });
        break; }
      case 'twist': { // Doha — tall tapered twisted tower with a spire
        const n = 28, h = 5.2, tw = .055; for (let i = 0; i < n; i++) { const k = 1 - i / n * .5; B.box('f:glass_tower:' + (i & 1), 'roof', 22 * k, h + .1, 22 * k, GeoBatch.mat(o.x, y0 + i * h, o.z, yaw + tw * i), [12, 12], 0, i * h / 12); }
        B.cyl('metalLight', .4, .05, 30, 6, GeoBatch.mat(o.x, y0 + n * h, o.z, yaw), { cap: false });
        break; }
      case 'spire': { // Dubai — stepped needle tower
        let y = 0, r = 17; for (let i = 0; i < 8; i++) { const h = 24; B.cyl('f:glass_tower:' + (i % 4), r, r * .78, h, 6, M(0, y, 0, i * .5), { cap: true, vRepeat: h / 12, uRepeat: 3 }); y += h; r *= .78; }
        B.cyl('metalLight', 1, .06, 70, 8, M(0, y, 0), { cap: false }); break; }
      case 'gate': { // Riyadh — two towers joined by a crown with an opening
        for (const x of [-12, 12]) B.box('f:glass_tower:0', 'roof', 14, 120, 18, GeoBatch.mat(o.x, y0, o.z, yaw).multiply(new THREE.Matrix4().makeTranslation(x, 0, 0)), [12, 12]);
        B.box('f:glass_tower:1', 'roof', 44, 26, 18, GeoBatch.mat(o.x, y0 + 120, o.z, yaw), [12, 12]);
        B.plainBox('metalDark', 14, 10, 18.5, GeoBatch.mat(o.x, y0 + 126, o.z, yaw)); break; }
      case 'clock': { // London — clock tower with pyramid spire
        B.box('f:brick:0', 'roof', 12, 50, 12, M(0, 0, 0), [12, 12]);
        B.box('stone', 'roof', 13, 12, 13, M(0, 50, 0), [12, 12]);
        for (const [rx, rz, ry] of [[0, 6.6, 0], [0, -6.6, Math.PI], [6.6, 0, Math.PI / 2], [-6.6, 0, -Math.PI / 2]]) B.cyl('stone', 3, 3, .3, 20, new THREE.Matrix4().multiplyMatrices(M(rx, 56, rz, ry), new THREE.Matrix4().makeRotationX(Math.PI / 2)), { cap: true });
        B.cyl('roofZinc', 8, .2, 22, 4, new THREE.Matrix4().multiplyMatrices(M(0, 62, 0), new THREE.Matrix4().makeRotationY(Math.PI / 4)), { cap: false }); break; }
      case 'lattice': { // Paris — four-legged lattice tower
        const H = 110, w0 = 22;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { for (let k = 0; k < 7; k++) { const t0 = k / 7, t1 = (k + 1) / 7; const f = t => w0 * Math.pow(1 - t, 1.6) + 1.2; beam(sx * f(t0), t0 * H, sz * f(t0), sx * f(t1), t1 * H, sz * f(t1), 1.1, 'metalDark'); } }
        for (let k = 1; k < 6; k++) { const t = k / 7, w = w0 * Math.pow(1 - t, 1.6) + 1.2; beam(-w, t * H, -w, w, t * H, -w, .6, 'metalDark'); beam(-w, t * H, w, w, t * H, w, .6, 'metalDark'); beam(-w, t * H, -w, -w, t * H, w, .6, 'metalDark'); beam(w, t * H, -w, w, t * H, w, .6, 'metalDark'); }
        B.cyl('metalDark', .6, .06, 28, 6, M(0, H * .95, 0), { cap: false }); break; }
      case 'mosque': { // Istanbul — central dome + four minarets
        B.box('stone', 'roof', 30, 16, 30, M(0, 0, 0), [12, 12]); B.dome('dome', 15, 28, 8, M(0, 16, 0)); B.cyl('stone', 15, 15, 0.1, 28, M(0, 16, 0), { cap: false });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { B.cyl('stone', 1.8, 1.4, 44, 12, M(sx * 20, 0, sz * 20), { cap: false }); B.cyl('stone', 2.6, 2.6, 1.2, 12, M(sx * 20, 34, sz * 20), { cap: true }); B.cyl('roofZinc', 1.9, .05, 9, 12, M(sx * 20, 44, sz * 20), { cap: false }); }
        break; }
      case 'stepped': { // New York — Art Deco stepped skyscraper
        let y = 0, w = 30; for (let i = 0; i < 6; i++) { const h = 28 - i * 2; B.box('f:nyc:' + (i % 3), 'roof', w, h, w, M(0, y, 0), [12, 12], 0, y / 12); y += h; w *= .8; }
        B.cyl('metalLight', .8, .05, 40, 8, M(0, y, 0), { cap: false }); break; }
    }
  },

  /* ----- nature themes (mountain, country, desert) ----- */
  natureRows(B, idx, s0, s1, group) {
    const th = this.theme, Q = this.Q;
    for (let slot = Math.floor(s0 / 20); slot * 20 < s1; slot++) {
      const sc = slot * 20 + 10;
      for (const side of [-1, 1]) {
        const rn = this.rng('n' + side, slot);
        // roadside vegetation / rocks
        if (th === 'alpine') {
          if (rn() < Q.density * .8) { const o = RoadPath.world(sc + rn() * 16 - 8, side * (11 + rn() * 26), this.tmp); this.pine(B, o.x, o.y - .1, o.z, 1 + rn() * 1.2, rn); }
          if (rn() < .3 * Q.density) { const o = RoadPath.world(sc, side * (10 + rn() * 12), this.tmp); B.dome('rock', 1 + rn() * 1.5, 7, 4, GeoBatch.mat(o.x, o.y - .3, o.z, rn() * 6).multiply(new THREE.Matrix4().makeScale(1, .7, 1.2))); }
          if (slot % 4 === 0) { const o = RoadPath.world(sc, side * (140 + rn() * 140), this.tmp), r = 70 + rn() * 90, h = 80 + rn() * 160; B.cyl('rock', r, 6, h, 9, GeoBatch.mat(o.x, o.y - 18, o.z, rn() * 6), { cap: true }); B.cyl('snow', r * .24, 2, h * .26, 9, GeoBatch.mat(o.x, o.y - 18 + h * .76, o.z, 0), { cap: true }); }
        } else if (th === 'country') {
          if (rn() < Q.density * .7) { const o = RoadPath.world(sc + rn() * 16 - 8, side * (11 + rn() * 30), this.tmp); this.roundTree(B, o.x, o.y, o.z, rn); }
          // wooden fence along the shoulder
          const f = RoadPath.world(sc, side * 10.6, this.tmp);
          B.plainBox('wood', .14, 1.1, .14, GeoBatch.mat(f.x, f.y - .1, f.z, f.yaw)); B.plainBox('wood', .06, .1, 20, GeoBatch.mat(f.x, f.y + .6, f.z, f.yaw)); B.plainBox('wood', .06, .1, 20, GeoBatch.mat(f.x, f.y + .95, f.z, f.yaw));
          if (slot % 5 === 0) { const o = RoadPath.world(sc, side * (120 + rn() * 100), this.tmp); B.dome('ground', 60 + rn() * 50, 14, 6, GeoBatch.mat(o.x, o.y - 14, o.z).multiply(new THREE.Matrix4().makeScale(1.5, .5, 1.3)), Math.PI / 2); }
          if (slot % 14 === 3 && side < 0) { const o = RoadPath.world(sc, -40, this.tmp); B.box('roofRed', 'roofRed', 12, 6, 16, GeoBatch.mat(o.x, o.y - .1, o.z, o.yaw), [6, 6]); B.cyl('roofRed', 11, .2, 4, 4, GeoBatch.mat(o.x, o.y + 5.9, o.z, o.yaw + Math.PI / 4), { cap: false }); }
        } else { // desert
          if (rn() < Q.density * .35) { const o = RoadPath.world(sc, side * (12 + rn() * 30), this.tmp); this.palm(B, o.x, o.y - .1, o.z, rn() * 6, .9 + rn() * .3, rn); }
          if (slot % 2 === 0) { const o = RoadPath.world(sc, side * (60 + rn() * 220), this.tmp), r = 40 + rn() * 80; B.dome('dune', r, 14, 5, GeoBatch.mat(o.x, o.y - 6, o.z, rn() * 6).multiply(new THREE.Matrix4().makeScale(1.6, .32, 1)), Math.PI / 2); }
          if (rn() < .12) { const o = RoadPath.world(sc, side * (11 + rn() * 14), this.tmp); B.dome('rock', 1.2 + rn() * 2, 7, 4, GeoBatch.mat(o.x, o.y - .2, o.z, rn() * 6).multiply(new THREE.Matrix4().makeScale(1, .8, 1))); }
        }
      }
      if (th === 'desert' && slot % 60 === 30) { // gantry arch over the road
        const o = RoadPath.world(sc, 0, this.tmp), mm = GeoBatch.mat(o.x, o.y, o.z, o.yaw);
        for (const sx of [-1, 1]) B.cyl('stone', .9, .9, 9, 12, new THREE.Matrix4().multiplyMatrices(mm, new THREE.Matrix4().makeTranslation(sx * 10.2, 0, 0)), { cap: true });
        B.plainBox('stone', 22, 2.2, 1.6, new THREE.Matrix4().multiplyMatrices(mm, new THREE.Matrix4().makeTranslation(0, 8.6, 0)));
      }
    }
  },
  pine(B, x, y, z, s, rn) {
    const m = GeoBatch.mat(x, y, z, rn() * 6, s);
    B.cyl('palmTrunk', .22, .28, 2.2, 6, m, { cap: false });
    for (let i = 0; i < 4; i++) B.cyl('pine', 2.3 - i * .45, .15, 3.6, 8, new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(0, 1.6 + i * 1.7, 0)), { cap: false });
  }
};

/* ===== 70-engine ===== */
/* ----------------------- 4. GAME ENGINE: renderer, Frenet vehicle physics on the shared spline, AI, camera, state machine ----------------------- */
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const angWrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

const QPRESET = {
  low:    { pr: 1.0,  shadows: false, shadowSize: 0,    skyW: 512,  aiMax: 4, fov: 0 },
  medium: { pr: 1.5,  shadows: true,  shadowSize: 1024, skyW: 1024, aiMax: 6, fov: 0 },
  high:   { pr: 2.0,  shadows: true,  shadowSize: 2048, skyW: 2048, aiMax: 8, fov: 0 }
};

const AI_SPECS = [
  { model: 'car_concept',      color: '#1171db', ds: 14,  d: -4.4, f: .80 },
  { model: 'ferrari_458_real', color: '#f2c62e', ds: 28,  d:  4.4, f: .84 },
  { model: 'coupe',            color: '#f8fafc', ds: 46,  d: -4.4, f: .76 },
  { model: 'supercar',         color: '#08ab84', ds: 62,  d: -4.4, f: .88 },
  { model: 'suv_sport',        color: '#ac55ec', ds: -12, d:  4.4, f: .72 },
  { model: 'car_concept',      color: '#f97416', ds: 80,  d:  4.4, f: .82 },
  { model: 'coupe',            color: '#ef4444', ds: -26, d: -4.4, f: .78 },
  { model: 'supercar',         color: '#14b8a6', ds: 104, d:  0,   f: .86 }
];

const WHEELBASE = 2.7;

const GameEngine = {
  state: 'MENU', // MENU, COUNTDOWN, DRIVING, APPROACHING_CHECKPOINT, QUESTION, CORRECT_CELEBRATION, WRONG_RETRY, CRASH_RECOVERY, FINISH, RESULTS
  scene: null, camera: null, renderer: null, sunLight: null, hemiLight: null,
  skyDome: null, skyTex: null, envRT: null, checkeredTexture: null,
  preset: 'high', resScale: 1, dynRes: false, contextLost: false,
  START_S: 24,

  // player rig
  playerRig: null, carGroup: null,
  // Frenet state: s = metres along the road, d = lateral offset (+right), psi = heading relative to road tangent (+left)
  s: 0, d: 0, v: 0, psi: 0, speedKmh: 0,
  steerAngle: 0, steerCmd: 0, steerVis: 0, aLong: 0, aLat: 0, skid: 0,
  steerInput: 0, touchTargetLane: null, manualSteerOverride: false, gasInput: false, brakeInput: false,
  cameraMode: 'chase', menuOrbitAngle: 0,
  lastSafeS: 0, collisionGraceUntil: 0, crash: null,

  checkpoints: [], finishArch: null, trophyMesh: null, currentCheckpointIndex: 0, activeQuestions: [],
  aiCars: [], particles: [],
  celebrationDriveThroughActive: false,
  pitchNudge: { v: 0, t: 0, T: 1 }, shakeAmp: 0,
  stats: { correctCount: 0, wrongAttempts: 0, collisions: 0, points: 1000, startTime: 0, elapsedSec: 0, pausedTimeAccum: 0, pauseStartStamp: 0 },
  questionTimerInterval: null,
  lastFrameTime: 0, clock: 0, buildToken: 0, hudTimer: 0, skidTimer: 0,
  perf: { ema: 0.016, frames: 0, ring: new Float32Array(600), ringN: 0, winT: 0, winN: 0 },

  _r: {}, _r2: {}, _v1: null, _v2: null, camYaw: 0, camLook: null, camFrom: null, camTrans: 1,

  /* ======================= init ======================= */
  init() {
    const container = document.getElementById('webgl-container');
    this._v1 = new THREE.Vector3(); this._v2 = new THREE.Vector3();
    this.camLook = new THREE.Vector3(); this.camFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight), 0.3, 1600);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    const gl = this.renderer.getContext();
    if (!gl) throw new Error('WebGL غير متاح');
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);
    this.gpuName = this.detectGpu();
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); this.contextLost = true;
      this.setLoading('فقد المتصفح سياق الرسم ثلاثي الأبعاد مؤقتًا… جارٍ الاستعادة تلقائيًا', null, true);
    }, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false; this.rebuildWorld({ keepState: this.state !== 'MENU' });
    }, false);

    // lights
    this.hemiLight = new THREE.HemisphereLight(0xeaf4ff, 0x30343c, 0.4);
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xfff1d1, 1.3);
    this.sunLight.shadow.camera.near = 5; this.sunLight.shadow.camera.far = 260;
    const sd = 42; Object.assign(this.sunLight.shadow.camera, { left: -sd, right: sd, top: sd, bottom: -sd });
    this.sunLight.shadow.bias = -0.0004; this.sunLight.shadow.normalBias = 0.06;
    this.scene.add(this.sunLight); this.scene.add(this.sunLight.target);
    this.sunDir = new THREE.Vector3(.5, .6, .4).normalize();

    // sky dome (equirect, UV mirrored so the sun in the sky matches the environment map and the directional light)
    const g = new THREE.SphereGeometry(900, 48, 24); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    this.skyDome = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false, toneMapped: false }));
    this.skyDome.renderOrder = -10; this.skyDome.frustumCulled = false; this.scene.add(this.skyDome);

    this.checkeredTexture = this.createCheckeredTexture();
    this.applyGraphicsQuality();

    window.addEventListener('resize', () => this.onResize());
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.onResize());
    if (window.ResizeObserver) { this.viewportObserver = new ResizeObserver(() => this.onResize()); this.viewportObserver.observe(container); }
    window.addEventListener('orientationchange', () => requestAnimationFrame(() => this.onResize()));
    document.addEventListener('visibilitychange', () => { this.lastFrameTime = performance.now(); });
    this.onResize();
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.animate(t));
    return this.rebuildWorld();
  },

  detectGpu() {
    try {
      const gl = this.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    } catch (e) { return 'unknown'; }
  },

  createCheckeredTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d'); const size = 16;
    for (let y = 0; y < 64; y += size) for (let x = 0; x < 256; x += size) { ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#ffffff' : '#0f172a'; ctx.fillRect(x, y, size, size); }
    const tex = new THREE.CanvasTexture(canvas); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.encoding = THREE.sRGBEncoding; return tex;
  },

  /* ======================= quality / resolution ======================= */
  resolvePreset() {
    let q = APP_CONFIG.graphicsQuality || 'auto';
    if (APP_CONFIG.classroomMode) return 'low';
    if (q === 'auto') {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));
      const soft = /SwiftShader|llvmpipe|Software|Microsoft Basic/i.test(this.gpuName || '');
      const cores = navigator.hardwareConcurrency || 4;
      q = soft ? 'low' : mobile ? 'medium' : (cores <= 4 ? 'medium' : 'high');
    }
    return QPRESET[q] ? q : 'medium';
  },

  applyGraphicsQuality() {
    if (!this.renderer) return;
    this.preset = this.resolvePreset();
    const Q = QPRESET[this.preset];
    this.dynRes = APP_CONFIG.graphicsQuality === 'auto' || !!APP_CONFIG.classroomMode;
    this.resScale = 1;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.prCap = Math.min(Q.pr, mobile ? 1.5 : 2);
    this.renderer.shadowMap.enabled = Q.shadows;
    this.sunLight.castShadow = Q.shadows;
    if (Q.shadows) {
      const sz = Q.shadowSize; if (this.sunLight.shadow.mapSize.x !== sz) { this.sunLight.shadow.mapSize.set(sz, sz); if (this.sunLight.shadow.map) { this.sunLight.shadow.map.dispose(); this.sunLight.shadow.map = null; } }
    }
    this.scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); } });
    this.onResize();
  },

  applyPixelRatio() {
    const pr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, this.prCap) * this.resScale);
    if (Math.abs(this.renderer.getPixelRatio() - pr) > 0.01) this.renderer.setPixelRatio(pr);
  },

  onResize() {
    if (!this.renderer) return;
    const area = document.getElementById('webgl-container');
    const w = Math.max(1, Math.round(area.clientWidth)), h = Math.max(1, Math.round(area.clientHeight));
    this.applyPixelRatio();
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.portrait = w < h;
  },

  setLoading(text, pct, sticky) {
    const el = document.getElementById('loading-overlay'); if (!el) return;
    if (text === null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const t = document.getElementById('loading-text'); if (t) t.textContent = text;
    const b = document.getElementById('loading-bar'); if (b && pct !== null && pct !== undefined) b.style.width = Math.round(pct) + '%';
  },

  /* ======================= environment, lights, sky ======================= */
  buildAtmosphere(env) {
    if (this.skyTex) { this.skyTex.dispose(); this.skyTex = null; }
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    const Q = QPRESET[this.preset];
    this.skyTex = TexLab.sky(env, Q.skyW, Q.skyW / 2);
    this.skyDome.material.map = this.skyTex; this.skyDome.material.needsUpdate = true;
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pmrem.fromEquirectangular(this.skyTex); this.scene.environment = this.envRT.texture; pmrem.dispose();
    } catch (e) { console.warn('PMREM unavailable, using no environment map', e); this.scene.environment = null; }
    const A = ((env.sunAz !== undefined ? env.sunAz : .78) - .5) * Math.PI * 2, E = (.5 - (env.sunEl !== undefined ? env.sunEl : .3)) * Math.PI;
    this.sunDir.set(Math.cos(E) * Math.cos(A), Math.sin(E), Math.cos(E) * Math.sin(A)).normalize();
    this.sunLight.color.setHex(env.sunColor || 0xfff1d1);
    this.sunLight.intensity = (env.sunIntensity || 1.4) * (env.isNight ? 0.5 : 1.05);
    this.hemiLight.color.setHex(env.skyBottom || 0xeaf4ff); this.hemiLight.groundColor.setHex(env.groundColor || 0x30343c);
    this.hemiLight.intensity = (env.ambientIntensity || 0.7) * (env.isNight ? 0.28 : 0.34);
    this.renderer.toneMappingExposure = env.isNight ? 1.12 : 0.92;
  },

  runtimeEnv() {
    const base = ENVIRONMENTS[APP_CONFIG.trackId] || ENVIRONMENTS.doha;
    const env = Object.assign({}, base);
    if (base.id === 'custom_city') {
      const style = APP_CONFIG.customCityStyle || 'gulf';
      const ref = ENVIRONMENTS[style] || ENVIRONMENTS.doha;
      ['theme', 'cityStyle', 'ground', 'water', 'facade', 'landmark', 'towerBias', 'skyTop', 'skyBottom', 'fogColor', 'groundColor', 'sunColor', 'sunIntensity', 'ambientIntensity', 'isNight', 'sunAz', 'sunEl', 'elev'].forEach((k) => { if (ref[k] !== undefined) env[k] = ref[k]; });
      env.id = 'custom_city'; env.name = APP_CONFIG.customCityName || base.name;
    }
    return env;
  },

  /* ======================= build / rebuild ======================= */
  routeLength() { return this.START_S + (this.checkpointTotal(APP_CONFIG.questions.length) + 1.2) * this.checkpointSpacing() + 520; },

  async rebuildWorld(opts = {}) {
    const token = ++this.buildToken;
    this.setLoading('جارٍ تجهيز المدينة والطريق…', 5);
    this.clearTimers();
    this.state = opts.keepState ? this.state : 'MENU';
    this.disposeRigs();
    this.applyGraphicsQuality();
    const env = this.runtimeEnv(); this.env = env;
    await nextFrame();
    World.setup(this.scene, env, this.preset, this.routeLength());
    this.buildAtmosphere(env);
    this.setupCheckpointsAndFinish();
    // stream the first road chunks in slices so the loader stays responsive
    const [a, b] = World.chunkRange(this.START_S); let n = 0;
    for (let i = a; i <= b; i++) {
      if (!World.chunks.has(i)) World.buildChunk(i);
      if (++n % 2 === 0) { this.setLoading('جارٍ بناء الطريق والمباني…', 8 + 52 * (i - a + 1) / (b - a + 1)); await nextFrame(); if (token !== this.buildToken) return; }
    }
    this.setLoading('جارٍ تحميل السيارات…', 65);
    await this.loadPlayerRig(token); if (token !== this.buildToken) return;
    this.setLoading('جارٍ تجهيز المنافسين…', 82);
    await this.loadAIRigs(token); if (token !== this.buildToken) return;
    if (!opts.keepState) this.resetCarPosition();
    this.snapCamera();
    this.setLoading(null);
    this.ready = true;
    document.dispatchEvent(new CustomEvent('world-ready', { detail: { env: env.id } }));
  },

  disposeRigs() {
    if (this.playerRig) { this.scene.remove(this.playerRig.root); this.playerRig.dispose(); this.playerRig = null; this.carGroup = null; }
    this.aiCars.forEach((ai) => { this.scene.remove(ai.rig.root); ai.rig.dispose(); });
    this.aiCars = [];
    this.particles.forEach((p) => this.scene.remove(p.mesh)); this.particles = [];
  },

  async loadPlayerRig(token) {
    const rig = await CarLibrary.build(APP_CONFIG.carModel, APP_CONFIG.carColor, { lod: false, isPlayer: true });
    if (token !== undefined && token !== this.buildToken) { rig.dispose(); return; }
    if (this.playerRig) { this.scene.remove(this.playerRig.root); this.playerRig.dispose(); }
    rig.root.rotation.order = 'YXZ'; rig.root.userData.keep = true;
    rig.setHeadlights(this.env && this.env.isNight ? 2 : 1);
    this.playerRig = rig; this.carGroup = rig.root; this.scene.add(rig.root);
    this.placeRig(rig, this.s || this.START_S, this.d, this.psi);
    this.verifyOrientation(rig);
  },

  /** Rebuild only the player car (car/paint/heading changes) without regenerating the city. */
  async reloadPlayerCar() { const t = this.buildToken; this.setLoading('جارٍ تحميل السيارة…', 40); await this.loadPlayerRig(t); this.setLoading(null); },
  setPlayerPaint(hex) { if (this.playerRig) this.playerRig.setPaint(hex); },
  get carPaintMaterials() { return this.playerRig ? this.playerRig.paintMats : []; },

  aiTotal() {
    if (!APP_CONFIG.aiEnabled) return 0;
    return Math.max(0, Math.min(QPRESET[this.preset].aiMax, Number(APP_CONFIG.aiCount) || 0, AI_SPECS.length));
  },

  async loadAIRigs(token) {
    this.aiCars.forEach((ai) => { this.scene.remove(ai.rig.root); ai.rig.dispose(); }); this.aiCars = [];
    const n = this.aiTotal();
    const rigs = await Promise.all(AI_SPECS.slice(0, n).map((sp) => CarLibrary.build(sp.model, sp.color, { lod: true, isPlayer: false })));
    if (token !== undefined && token !== this.buildToken) { rigs.forEach((r) => r.dispose()); return; }
    const maxKmh = this.maxSpeedKmh();
    rigs.forEach((rig, i) => {
      const sp = AI_SPECS[i]; rig.root.rotation.order = 'YXZ';
      this.scene.add(rig.root);
      this.aiCars.push({ rig, index: i, s: this.START_S + sp.ds, d: sp.d, startS: this.START_S + sp.ds, startD: sp.d, homeD: sp.d, targetD: sp.d,
        v: 0, baseV: maxKmh * sp.f / 3.6, aLat: 7.3 + (i % 4) * 0.55, psi: 0, steerVis: 0, laneCool: 0, blocked: 0 });
    });
    this.updateAI(0, false);
  },
  async reloadAICars() { const t = this.buildToken; await this.loadAIRigs(t); },

  maxSpeedKmh() {
    const bonus = (CAR_MODELS.find((m) => m.id === APP_CONFIG.carModel) || {}).speedBonus || 1;
    return (parseFloat(APP_CONFIG.maxSpeed) || 220) * bonus;
  },

  clearTimers() { clearInterval(this.questionTimerInterval); if (this.recoveryHandle) { clearTimeout(this.recoveryHandle); this.recoveryHandle = null; } this.crash = null; },

  /* ======================= placement / diagnostics ======================= */
  placeRig(rig, s, d, psi) {
    const o = RoadPath.world(s, d, this._r2);
    rig.root.position.set(o.x, o.y, o.z);
    rig.root.rotation.set(Math.atan(o.slope || 0), o.yaw + psi, 0);
  },

  /** Geometric proof that the car faces forward: tail-light centroid must lie behind the root along the travel direction. */
  verifyOrientation(rig) {
    try {
      rig.root.updateMatrixWorld(true);
      const base = new THREE.Vector3(); rig.root.getWorldPosition(base);
      const yaw = rig.root.rotation.y, fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const cent = (mats) => { const box = new THREE.Box3(); let n = 0; rig.bodyPivot.traverse((o) => { if (o.isMesh && (Array.isArray(o.material) ? o.material : [o.material]).some((m) => mats.includes(m))) { box.expandByObject(o); n++; } }); if (!n) return null; return box.getCenter(new THREE.Vector3()).sub(base); };
      const tail = cent(rig.brakeMats), head = cent(rig.headMats);
      const r = { tailForwardDot: tail ? +tail.dot(fwd).toFixed(2) : null, headForwardDot: head ? +head.dot(fwd).toFixed(2) : null };
      r.ok = (r.tailForwardDot === null || r.tailForwardDot < 0) && (r.headForwardDot === null || r.headForwardDot > 0);
      if (r.tailForwardDot === null && r.headForwardDot === null) r.note = 'no lamp meshes detected, heading from adapter';
      rig.headingInfo.verify = r; return r;
    } catch (e) { return { ok: false, error: String(e) }; }
  },

  /* ======================= race lifecycle ======================= */
  resetCarPosition() {
    this.clearTimers();
    this.s = this.START_S; this.d = 0; this.psi = 0; this.v = 0; this.speedKmh = 0;
    this.steerAngle = 0; this.steerCmd = 0; this.steerVis = 0; this.aLong = 0; this.aLat = 0; this.skid = 0;
    this.touchTargetLane = null; this.steerInput = 0; this.gasInput = false; this.brakeInput = false;
    this.currentCheckpointIndex = 0; this.lastSafeS = this.START_S; this.collisionGraceUntil = 0;
    this.celebrationDriveThroughActive = false;
    this.checkpoints.forEach((cp) => { cp.isOpen = false; cp.cleared = false; cp.targetAngle = 0; cp.currentAngle = 0; cp.armPivot.rotation.z = 0; cp.lightMat.color.setHex(0xef4444); cp.lightMat.emissive.setHex(0xef4444); });
    if (this.trophyMesh) { this.scene.remove(this.trophyMesh); this.trophyMesh = null; }
    this.aiCars.forEach((ai) => { ai.s = ai.startS; ai.d = ai.startD; ai.targetD = ai.startD; ai.homeD = ai.startD; ai.v = 0; ai.psi = 0; });
    if (this.playerRig) { this.playerRig.setBrake(false); this.placeRig(this.playerRig, this.s, this.d, this.psi); }
    this.updateAI(0, false);
    World.update(this.s, 3);
    this.startCameraTransition();
  },

  startNewRace() {
    SoundFX.unlock(); SoundFX.startEngineSound(); SoundFX.startBackgroundMusic();
    this.setupCheckpointsAndFinish();
    this.resetCarPosition();
    this.stats = { correctCount: 0, wrongAttempts: 0, collisions: 0, points: Math.max(0, Number(APP_CONFIG.startingScore) || 1000), startTime: this.clock, elapsedSec: 0, pausedTimeAccum: 0, pauseStartStamp: 0 };
    this.cameraMode = APP_CONFIG.cameraDefault || 'chase';
    ['menu-screen', 'modal-results', 'question-overlay'].forEach((id) => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); });
    const hud = document.getElementById('hud-screen'); if (hud) hud.classList.remove('hidden');
    this.state = 'COUNTDOWN';
    this.startCameraTransition();
    this.updateHUD();
    this.runCountdownSequence();
  },

  runCountdownSequence() {
    const steps = ['3', '2', '1', 'انطلق! 🏁']; let idx = 0;
    const showNext = () => {
      if (this.state !== 'COUNTDOWN') return;
      UIController.showBanner(steps[idx], idx === 3 ? 'success' : 'warning');
      if (idx === 3) {
        SoundFX.revEngine(); this.state = 'DRIVING'; this.stats.startTime = this.clock;
        this.v = 3; setTimeout(() => UIController.hideBanner(), 900);
      } else { idx++; setTimeout(showNext, 750); }
    };
    showNext();
  },

  setBrakeLights(on) { if (this.playerRig) this.playerRig.setBrake(!!on); },

  nudgePitch(value, resetMs = 700) { this.pitchNudge = { v: value, t: resetMs / 1000, T: resetMs / 1000 }; },
  shake(amount) { this.shakeAmp = Math.max(this.shakeAmp, amount); },

  /* ======================= vehicle model ======================= */
  params() {
    const diff = APP_CONFIG.roadDifficulty || 'normal';
    const maxV = this.maxSpeedKmh() / 3.6;
    return {
      maxV, vtop: maxV * 1.07, accel: 7.6, brake: 14, roll: 0.45, drag: 0.0011,
      mu: diff === 'easy' ? 12.6 : diff === 'hard' ? 10.4 : 11.4,
      comfort: diff === 'easy' ? 8.0 : diff === 'hard' ? 9.4 : 8.7,
      maxSteer: 0.56, sens: clamp(Number(APP_CONFIG.steeringSensitivity) || 1, 0.4, 1.8),
      assist: clamp(Number(APP_CONFIG.steeringAssist) || 0, 0, 0.75)
    };
  },

  dmax(v, P) { return P.maxSteer / (1 + Math.pow(v / 13, 2)) * (0.55 + 0.45 * P.sens); },

  /** Closed-loop lane-keeping used by touch lane-targets, auto-drive and the barrier approach / celebration autopilot. */
  autoSteerCmd(targetD, ff, road, P) {
    const vv = Math.max(this.v, 0.6);
    const e = targetD - this.d;
    const k = Math.min(0.10, 0.55 / vv);
    const psiT = -clamp(e * k, -0.30, 0.30);
    const sdot = vv * Math.cos(this.psi) / Math.max(0.3, 1 + road.curv * this.d);
    const omegaReq = ff * road.curv * sdot + 2.4 * (psiT - this.psi);
    const dReq = Math.atan(omegaReq * WHEELBASE / vv);
    return clamp(-dReq / this.dmax(vv, P), -1, 1);
  },

  /** One integration step of the Frenet bicycle model. ctl: {steer(-1..1,+right), accel, brake, vCap, ff} */
  vehicleStep(dt, ctl, P) {
    const road = RoadPath.at(this.s, this._r);
    // longitudinal
    let a, braking = false;
    if (ctl.brake) { a = -P.brake; braking = true; }
    else {
      const acc = (ctl.accel > 0 && this.v < ctl.vCap - 0.4) ? P.accel * Math.max(0, 1 - Math.pow(this.v / P.vtop, 2)) : 0;
      a = acc - P.roll - P.drag * this.v * this.v;
      if (this.v > ctl.vCap) { const ab = Math.min(9, 1 + (this.v - ctl.vCap) * 1.6); a -= ab; braking = true; }
    }
    this.v = Math.max(0, this.v + a * dt);
    this.aLong += (a - this.aLong) * Math.min(1, dt * 6);
    this.autoBraking = braking;
    // steering (speed-sensitive, rate limited)
    const vv = Math.max(this.v, 0.01);
    const dm = this.dmax(vv, P);
    const target = -ctl.steer * dm;
    const rate = (2.2 + 2.4 * P.sens) * dt;
    this.steerAngle += clamp(target - this.steerAngle, -rate, rate);
    let omega = vv / WHEELBASE * Math.tan(this.steerAngle);
    const sdot0 = vv * Math.cos(this.psi) / Math.max(0.3, 1 + road.curv * this.d);
    if (ctl.ff) omega += ctl.ff * road.curv * sdot0;
    // tyre grip: yaw rate capped by lateral-acceleration limit, excess becomes understeer slide + speed scrub
    const demand = Math.abs(omega) * vv;
    let skidding = false;
    if (demand > P.mu) { omega = Math.sign(omega) * P.mu / vv; skidding = true; this.v = Math.max(0, this.v - (demand - P.mu) * 0.06 * dt * 10); }
    if (ctl.brake && this.v > 22 && Math.abs(this.steerAngle) > 0.01) skidding = skidding || Math.abs(omega) * vv > P.mu * 0.8;
    this.skid += ((skidding ? 1 : 0) - this.skid) * Math.min(1, dt * 8);
    this.aLat += (omega * vv - this.aLat) * Math.min(1, dt * 8);
    // Frenet kinematics
    const sdot = vv * Math.cos(this.psi) / Math.max(0.3, 1 + road.curv * this.d);
    this.psi = clamp(this.psi + (omega - road.curv * sdot) * dt, -1.25, 1.25);
    this.d += -this.v * Math.sin(this.psi) * dt;
    this.s += (this.v * Math.cos(this.psi) / Math.max(0.3, 1 + road.curv * this.d)) * dt;
    this.speedKmh = this.v * 3.6;
    return road;
  },

  extent() { const c = Math.abs(Math.cos(this.psi)), sn = Math.abs(Math.sin(this.psi)); return CAR_HALF_WIDTH * c + 2.25 * sn; },
  railLimit() { return RAIL_D - 0.12 - this.extent(); },

  throttleLogic(P) {
    const manualGas = this.gasInput;
    const auto = APP_CONFIG.autoAccel !== false || APP_CONFIG.autoDrive;
    const accel = (auto || manualGas) ? 1 : 0;
    let vCap = P.maxV;
    if (auto && !manualGas) {
      const look = 45 + this.v * 1.7;
      vCap = Math.min(vCap, Math.max(13, RoadPath.cornerSpeed(this.s, look, P.comfort)));
    }
    // slow down in time for the next educational barrier
    const cp = this.checkpoints[this.currentCheckpointIndex];
    if (cp && !cp.cleared) vCap = Math.min(vCap, Math.sqrt(2 * 5.0 * Math.max(0, cp.s - 10.5 - this.s)) + 4);
    return { accel, vCap };
  },

  steerLogic(P, road) {
    const manual = Math.abs(this.steerInput) > 0.02;
    let steer = 0, ff = 0;
    if (APP_CONFIG.autoDrive) steer = this.autoSteerCmd(0, 1, road, P);
    else if (manual) { steer = this.steerInput; ff = P.assist * 0.30; }
    else if (APP_CONFIG.touchMode === 'free' && this.touchTargetLane !== null) steer = this.autoSteerCmd(this.touchTargetLane, 0.55 + 0.4 * P.assist, road, P);
    else ff = P.assist * 0.30;
    this.steerCmd += (steer - this.steerCmd) * Math.min(1, (manual ? 9 : 14) * this.dtNow);
    return { steer: this.steerCmd, ff };
  },

  detectTrafficCollision() {
    for (const ai of this.aiCars) {
      if (Math.abs(this.s - ai.s) < 4.5 && Math.abs(this.d - ai.d) < 1.95) return ai;
    }
    return null;
  },

  triggerCollision(kind = 'edge') {
    if (this.state !== 'DRIVING' || this.clock < this.collisionGraceUntil) return;
    this.state = 'CRASH_RECOVERY';
    this.stats.collisions = (this.stats.collisions || 0) + 1;
    const penalty = Math.max(0, Number(kind === 'traffic' ? APP_CONFIG.trafficPenalty : APP_CONFIG.collisionPenalty) || 0);
    this.stats.points = Math.max(0, (this.stats.points || 0) - penalty);
    this.gasInput = false; this.brakeInput = false; this.celebrationDriveThroughActive = false;
    this.crash = { t: 0, kind, moved: false, side: Math.sign(this.d) || 1 };
    this.setBrakeLights(true);
    SoundFX.playCrash(); SoundFX.playStrongBrake(); this.spawnTireSmoke(); this.shake(0.75); this.nudgePitch(-0.06, 500);
    UIController.showBanner((kind === 'traffic' ? '💥 اصطدمت بسيارة منافسة!' : '💥 اصطدمت بحافة الطريق!') + ` −${penalty} نقطة — العودة لآخر نقطة آمنة`, 'error');
    this.updateHUD();
  },

  stepCrash(dt) {
    const c = this.crash; if (!c) { this.state = 'DRIVING'; return; }
    c.t += dt;
    if (!c.moved) {
      // slide to a stop against the guardrail: the boundary is never crossed
      this.v *= Math.exp(-5.5 * dt); this.speedKmh = this.v * 3.6;
      this.psi *= Math.exp(-4 * dt);
      const lim = this.railLimit(); if (Math.abs(this.d) > lim) this.d = Math.sign(this.d) * lim;
      if (c.kind === 'edge') this.d -= c.side * 0.9 * dt;
      const road = RoadPath.at(this.s, this._r); this.s += this.v * Math.cos(this.psi) / Math.max(0.3, 1 + road.curv * this.d) * dt;
      if (c.t > 0.85) {
        // return to the last safe position and resume
        let rs = Math.min(this.lastSafeS, this.s);
        const cleared = this.checkpoints[this.currentCheckpointIndex - 1];
        if (cleared) rs = Math.max(rs, cleared.s + 12);
        rs = Math.max(this.START_S, rs);
        this.s = rs; this.d = 0; this.psi = 0; this.v = 0; this.steerAngle = 0; this.steerCmd = 0; this.touchTargetLane = null;
        this.aiCars.forEach((ai) => { if (ai.s > rs - 14 && ai.s < rs + 16) { ai.s = rs - 30 - ai.index * 6; ai.v = this.v; } });
        c.moved = true; this.snapCamera(true);
      }
    } else if (c.t > 1.9) {
      UIController.hideBanner(); this.setBrakeLights(false);
      this.state = 'DRIVING'; this.v = 10; this.speedKmh = 36; this.crash = null;
      this.collisionGraceUntil = this.clock + 2600; this.lastSafeS = this.s;
    }
  },

  /* ======================= AI competitors ======================= */
  updateAI(dt, moving) {
    const n = this.aiCars.length; if (!n) return;
    const P = this._P || (this._P = this.params());
    const cp = this.checkpoints[this.currentCheckpointIndex];
    const barrierS = cp && !cp.isOpen && !cp.cleared ? cp.s - 15 : Infinity;
    const finishS = this.finishArch ? this.finishArch.userData.s : Infinity;
    const nowT = performance.now() * 0.001;
    const Q = World.Q || { ahead: 500, behind: 80 };
    for (let i = 0; i < n; i++) {
      const ai = this.aiCars[i];
      if (moving) {
        const road = RoadPath.at(ai.s, this._r);
        let vDes = ai.baseV * (1 + 0.035 * Math.sin(nowT * 0.45 + i * 1.7));
        vDes = Math.min(vDes, Math.max(12, RoadPath.cornerSpeed(ai.s, 40 + ai.v * 1.6, ai.aLat)));
        // look for blockers ahead in my lane
        let gap = Infinity, bv = 0, barrierBlock = false;
        const consider = (os, od, ov) => { const ds = os - ai.s; if (ds > 0 && ds < 55 && Math.abs(od - ai.targetD) < 2.5) { const g = ds - 4.8; if (g < gap) { gap = g; bv = ov; } } };
        for (let j = 0; j < n; j++) if (j !== i) consider(this.aiCars[j].s, this.aiCars[j].d, this.aiCars[j].v);
        consider(this.s, this.d, this.v);
        if (barrierS - ai.s < gap + 4.8 && barrierS - ai.s < 55 && barrierS - ai.s > -2) { gap = Math.max(0, barrierS - ai.s - 4.2); bv = 0; barrierBlock = true; }
        ai.laneCool -= dt;
        if (barrierS - ai.s < 110 && barrierS < Infinity) {
          // queue in the outer lanes at an uncleared barrier so the player's centre-lane stop stays clear
          const side = (ai.index % 2 === 0) ? -1 : 1; ai.targetD = side * 4.4;
        } else if (gap < 24 && !barrierBlock && ai.laneCool <= 0) {
          let best = null, bestScore = 1e9;
          for (const lane of [-4.4, 0, 4.4]) {
            if (Math.abs(lane - ai.d) > 5) continue;
            let free = true;
            const chk = (os, od) => { if (os - ai.s > -9 && os - ai.s < 32 && Math.abs(od - lane) < 2.7) free = false; };
            for (let j = 0; j < n; j++) if (j !== i) chk(this.aiCars[j].s, this.aiCars[j].d);
            chk(this.s, this.d);
            if (free) { const sc = Math.abs(lane - ai.homeD) * .2 + Math.abs(lane - ai.d); if (lane !== ai.targetD && sc < bestScore) { bestScore = sc; best = lane; } }
          }
          if (best !== null) { ai.targetD = best; ai.laneCool = 2.5; }
        } else if (gap > 60 && ai.laneCool <= 0 && Math.abs(ai.targetD - ai.homeD) > .1 && barrierS - ai.s > 120) { ai.targetD = ai.homeD; ai.laneCool = 2.5; }
        if (gap < 60) vDes = Math.min(vDes, bv + Math.sqrt(Math.max(0, gap - 2.5) * 2 * 6));
        if (ai.s > finishS + 25) vDes = 0;
        ai.v += clamp(vDes - ai.v, -9 * dt, 4.5 * dt);
        ai.v = Math.max(0, ai.v);
        const lateral = clamp(ai.targetD - ai.d, -3.2 * dt, 3.2 * dt) * Math.min(1, 6 * dt + 0.2);
        ai.d += lateral;
        ai.psi = ai.v > 1 ? -Math.atan2(lateral / Math.max(dt, 1e-3), ai.v) : 0;
        ai.s += ai.v * dt / Math.max(0.3, 1 + road.curv * ai.d);
        ai.steerVis = clamp(Math.atan(WHEELBASE * road.curv) * 6 - ai.psi * 1.4, -0.4, 0.4);
      } else if (dt > 0) { ai.v = Math.max(0, ai.v - 12 * dt); }
      const ds = ai.s - this.s;
      const vis = ds > -Q.behind + 12 && ds < Q.ahead - 12;
      ai.rig.root.visible = vis;
      if (vis) {
        this.placeRig(ai.rig, ai.s, ai.d, ai.psi);
        const road = RoadPath.at(ai.s, this._r);
        ai.rig.setBrake(ai.v < 1 && moving ? true : false);
        ai.rig.update(dt, ai.v, ai.steerVis, { pitch: 0, roll: -ai.v * ai.v * road.curv * 0.0035 * 0.5, heave: 0 });
      }
    }
  },

  /* ======================= camera ======================= */
  snapCamera(keepTrans) {
    this.camYaw = this.playerRig ? this.playerRig.root.rotation.y : 0;
    this.camTrans = 1; this.updateCamera(0.016, this.clock, true);
  },

  startCameraTransition() {
    if (!this.camera) return;
    this.camFrom.pos.copy(this.camera.position); this.camFrom.look.copy(this.camLook); this.camTrans = 0;
  },

  computeCameraTarget(dt, now, pos, look) {
    const rig = this.playerRig; if (!rig) return { fov: 55 };
    const p = rig.root.position, mode = this.cameraMode;
    const portrait = this.portrait;
    const speedK = clamp(this.v / 70, 0, 1);
    let fov = portrait ? 70 : 54; fov += speedK * 7;
    if (this.state === 'MENU' || this.state === 'FINISH' || this.state === 'RESULTS') {
      const finish = this.state !== 'MENU';
      this.menuOrbitAngle += dt * (finish ? 0.5 : 0.34);
      const R = (finish ? 7.4 : 6.6) * (portrait ? 1.35 : 1);
      const yaw = rig.root.rotation.y; const a = this.menuOrbitAngle + yaw + 0.7;
      pos.set(p.x + Math.sin(a) * R, p.y + 1.55 + Math.sin(this.menuOrbitAngle * 0.7) * 0.25, p.z + Math.cos(a) * R);
      look.set(p.x, p.y + 0.72, p.z);
      return { fov: portrait ? 52 : 36 };
    }
    // chase modes
    const rd = RoadPath.at(this.s, this._r);
    const look0 = 14 + this.v * 0.34;
    const P2 = RoadPath.world(this.s + look0, this.d * 0.35, this._r2);
    const yawLook = Math.atan2(-(P2.x - p.x), -(P2.z - p.z));
    const yawCar = rig.root.rotation.y;
    const tgt = yawCar + angWrap(yawLook - yawCar) * 0.62;
    this.camYaw += angWrap(tgt - this.camYaw) * Math.min(1, dt * 3.2);
    if (this.snap) this.camYaw = tgt;
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    const checkpointView = this.state === 'QUESTION' || this.state === 'APPROACHING_CHECKPOINT' || this.state === 'WRONG_RETRY' || this.state === 'CORRECT_CELEBRATION';
    let dist, h, lookDist, lookH;
    if (mode === 'hood') {
      const dims = rig.dims;
      const fy = Math.sin(yawCar), fz = Math.cos(yawCar);
      pos.set(p.x - fy * dims.length * 0.30, p.y + dims.height * 0.82, p.z - fz * dims.length * 0.30);
      look.set(p.x - Math.sin(this.camYaw) * 28, p.y + dims.height * 0.7 + Math.atan(rd.slope || 0) * 8, p.z - Math.cos(this.camYaw) * 28);
      return { fov: fov + 6 };
    } else if (mode === 'low') {
      dist = (portrait ? 6.0 : 4.7) + speedK * 0.8; h = portrait ? 1.25 : 0.95; lookDist = 26; lookH = 0.75; fov -= 2;
    } else {
      dist = (checkpointView ? (portrait ? 7.4 : 6.0) : (portrait ? 7.6 : 5.9)) + speedK * 1.0; h = checkpointView ? 2.5 : 1.95; lookDist = 22; lookH = 1.0;
    }
    pos.set(p.x + sy * dist, p.y + h, p.z + cy * dist);
    look.set(p.x - sy * lookDist, p.y + lookH + (rd.slope || 0) * lookDist * 0.6, p.z - cy * lookDist);
    return { fov };
  },

  updateCamera(dt, now, snap) {
    const pos = this._v1, look = this._v2;
    this.snap = !!snap;
    const r = this.computeCameraTarget(dt, now, pos, look);
    if (this.camTrans < 1) {
      this.camTrans = Math.min(1, this.camTrans + dt / 1.6);
      const k = this.camTrans * this.camTrans * (3 - 2 * this.camTrans);
      pos.lerpVectors(this.camFrom.pos, pos, k); look.lerpVectors(this.camFrom.look, look, k);
    }
    // subtle motion: speed-driven micro vibration + decaying impact shake (no roll, no strong sway)
    this.shakeAmp *= Math.exp(-5 * dt);
    const sp = clamp(this.v / 60, 0, 1);
    const amp = this.shakeAmp * 0.35 + sp * 0.006;
    if (amp > 0.0005 && this.state !== 'MENU') {
      const t = now * 0.001;
      pos.x += (Math.sin(t * 37.1) + Math.sin(t * 53.7)) * 0.5 * amp;
      pos.y += (Math.sin(t * 41.3) + Math.sin(t * 29.9)) * 0.5 * amp;
    }
    this.camera.position.copy(pos);
    this.camLook.copy(look);
    this.camera.lookAt(look);
    const f = r.fov !== undefined ? r.fov : 55;
    if (snap || Math.abs(this.camera.fov - f) > 0.02) { this.camera.fov += (f - this.camera.fov) * (snap ? 1 : Math.min(1, dt * 4)); this.camera.updateProjectionMatrix(); }
    this.skyDome.position.copy(this.camera.position);
  },

  /* ======================= main loop ======================= */
  perfTick(dt) {
    const P = this.perf; P.ema = P.ema * 0.95 + dt * 0.05; P.frames++;
    P.ring[P.ringN++ % P.ring.length] = dt;
    if (!this.dynRes) return;
    P.winT += dt; P.winN++;
    if (P.winT > 1.5) {
      const avg = P.winT / P.winN; P.winT = 0; P.winN = 0;
      if (avg > 0.026 && this.resScale > 0.55) { this.resScale = Math.max(0.55, this.resScale - 0.1); this.onResize(); }
      else if (avg < 0.0155 && this.resScale < 1) { this.resScale = Math.min(1, this.resScale + 0.05); this.onResize(); }
    }
  },

  metrics() {
    const n = Math.min(this.perf.ringN, this.perf.ring.length); const arr = Array.from(this.perf.ring.slice(0, n)).sort((a, b) => a - b);
    const avg = n ? arr.reduce((a, b) => a + b, 0) / n : 0;
    const info = this.renderer.info;
    return { preset: this.preset, gpu: this.gpuName, resScale: +this.resScale.toFixed(2), pixelRatio: this.renderer.getPixelRatio(), avgFrameMs: +(avg * 1000).toFixed(1), p95FrameMs: n ? +(arr[Math.floor(n * 0.95)] * 1000).toFixed(1) : 0, fps: avg ? +(1 / avg).toFixed(1) : 0, drawCalls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, chunks: World.chunks.size };
  },

  animate(now) {
    requestAnimationFrame((t) => this.animate(t));
    if (this.contextLost || !this.playerRig) { this.lastFrameTime = now; return; }
    const raw = Math.max(0.0005, (now - this.lastFrameTime) / 1000); this.lastFrameTime = now;
    this.perfTick(raw); // real (unclamped) frame time feeds the metrics and the dynamic-resolution controller
    this.step(Math.min(0.05, raw));
    this.renderer.render(this.scene, this.camera);
  },

  /** Advance the simulation by dt seconds without rendering (also used by the automated tests via fastForward). */
  fastForward(seconds, dt = 1 / 30) { const n = Math.ceil(seconds / dt); for (let i = 0; i < n; i++) this.step(dt); },

  step(dt) {
    this.dtNow = dt; this.clock += dt * 1000; const now = this.clock;
    this.updateParticles(dt);
    this.checkpoints.forEach((cp) => { cp.currentAngle += (cp.targetAngle - cp.currentAngle) * Math.min(1, dt * 6); cp.armPivot.rotation.z = -cp.currentAngle; });
    if (this.trophyMesh) { this.trophyMesh.rotation.y += dt * 1.8; this.trophyMesh.position.y = this.carGroup.position.y + 0.7 + Math.sin(now * 0.004) * 0.2; }

    if (!this._P || (this.perf.frames % 20) === 0) this._P = this.params();
    const P = this._P;
    const st = this.state;
    const racing = st === 'DRIVING' || st === 'APPROACHING_CHECKPOINT' || st === 'CORRECT_CELEBRATION' || st === 'CRASH_RECOVERY' || st === 'FINISH' || st === 'RESULTS';
    let brakeOn = false;

    if (st === 'DRIVING') {
      const th = this.throttleLogic(P);
      const road = RoadPath.at(this.s, this._r);
      const sl = this.steerLogic(P, road);
      this.vehicleStep(dt, { steer: sl.steer, ff: sl.ff, accel: th.accel, brake: this.brakeInput ? 1 : 0, vCap: th.vCap }, P);
      brakeOn = this.brakeInput || this.autoBraking;
      // boundary: physical guardrail contact -> collision
      const edge = Math.abs(this.d) + this.extent();
      if (edge > RAIL_D - 0.12) { this.d = Math.sign(this.d) * this.railLimit(); this.triggerCollision('edge'); }
      else if (edge < RAIL_D - 0.9 && Math.abs(this.psi) < 0.3 && this.s - this.lastSafeS > 8) this.lastSafeS = this.s;
      if (this.state === 'DRIVING' && this.detectTrafficCollision()) this.triggerCollision('traffic');
      // approaching the next barrier
      const cp = this.checkpoints[this.currentCheckpointIndex];
      if (this.state === 'DRIVING') {
        if (cp && !cp.cleared) {
          if (cp.s - this.s <= 90) { this.state = 'APPROACHING_CHECKPOINT'; UIController.showBanner(`⚠️ اقتربت من الحاجز التعليمي ${this.currentCheckpointIndex + 1} — استعد للسؤال!`, 'warning'); }
        } else if (this.finishArch && this.s >= this.finishArch.userData.s) { this.triggerFinalVictorySequence(); }
      }
    } else if (st === 'APPROACHING_CHECKPOINT') {
      const cp = this.checkpoints[this.currentCheckpointIndex];
      const stopS = cp.s - 10.5, rem = Math.max(0, stopS - this.s);
      const road = RoadPath.at(this.s, this._r);
      brakeOn = true;
      const steer = this.autoSteerCmd(0, 1, road, P); this.steerCmd += (steer - this.steerCmd) * Math.min(1, dt * 10);
      const vDes = rem > 0.35 ? Math.max(3.5, Math.sqrt(2 * 6.0 * rem)) : 0;
      this.vehicleStep(dt, { steer: this.steerCmd, accel: 0, brake: 0, vCap: P.maxV, ff: 0 }, P);
      if (this.v > vDes) { this.v = Math.max(vDes, this.v - 12 * dt); this.speedKmh = this.v * 3.6; }
      if (rem <= 0.35 || this.s >= stopS) {
        this.s = Math.min(this.s, stopS); this.v = 0; this.speedKmh = 0; this.d += (0 - this.d) * Math.min(1, dt * 6);
        UIController.hideBanner(); this.openQuestionForCurrentCheckpoint();
      }
      this.clampToRails();
    } else if (st === 'QUESTION' || st === 'WRONG_RETRY') {
      this.v = 0; this.speedKmh = 0; brakeOn = true;
      const cp = this.checkpoints[this.currentCheckpointIndex];
      if (cp && this.s > cp.s - 4) this.s = cp.s - 4; // the barrier is solid
    } else if (st === 'CORRECT_CELEBRATION') {
      brakeOn = !this.celebrationDriveThroughActive;
      if (this.celebrationDriveThroughActive) {
        const road = RoadPath.at(this.s, this._r);
        const steer = this.autoSteerCmd(0, 1, road, P); this.steerCmd += (steer - this.steerCmd) * Math.min(1, dt * 10);
        this.vehicleStep(dt, { steer: this.steerCmd, accel: 1, brake: 0, vCap: Math.min(40, P.maxV), ff: 0 }, P);
        this.setBrakeLights(false);
        const cp = this.checkpoints[this.currentCheckpointIndex];
        if (this.s > cp.s + 8) { cp.cleared = true; this.currentCheckpointIndex++; this.celebrationDriveThroughActive = false; UIController.hideBanner(); this.state = 'DRIVING'; this.lastSafeS = this.s; }
        this.clampToRails();
      } else { this.v = 0; this.speedKmh = 0; }
    } else if (st === 'CRASH_RECOVERY') {
      this.stepCrash(dt); brakeOn = true;
    } else if (st === 'FINISH' || st === 'RESULTS') {
      const road = RoadPath.at(this.s, this._r);
      const steer = this.autoSteerCmd(0, 1, road, P); this.steerCmd += (steer - this.steerCmd) * Math.min(1, dt * 10);
      this.vehicleStep(dt, { steer: this.steerCmd, accel: 0, brake: 1, vCap: 0, ff: 0 }, P);
      brakeOn = this.v > 0.5; this.clampToRails();
    } else { // MENU / COUNTDOWN: parked
      this.v = 0; this.speedKmh = 0;
      brakeOn = true;
    }

    if (racing || st === 'QUESTION' || st === 'WRONG_RETRY') this.setBrakeLights(brakeOn);
    if (st === 'DRIVING' || st === 'APPROACHING_CHECKPOINT' || st === 'CORRECT_CELEBRATION' || st === 'CRASH_RECOVERY') {
      this.stats.elapsedSec = ((now - this.stats.startTime) - this.stats.pausedTimeAccum) / 1000;
    }

    // visuals of the player car
    this.steerVis += ((-this.steerCmd * 0.42) - this.steerVis) * Math.min(1, dt * 10);
    let pitchTarget = clamp(this.aLong * 0.0034, -0.055, 0.04);
    if (this.pitchNudge.t > 0) { this.pitchNudge.t -= dt; pitchTarget += this.pitchNudge.v * clamp(this.pitchNudge.t / this.pitchNudge.T, 0, 1); }
    const lean = { pitch: pitchTarget, roll: clamp(-this.aLat * 0.0042, -0.06, 0.06), heave: Math.sin(this.s * 0.9) * 0.004 * clamp(this.v / 30, 0, 1) };
    const rigPsi = this.psi + (this.skid > 0.4 ? -Math.sign(this.aLat) * 0.06 * this.skid : 0);
    this.placeRig(this.playerRig, this.s, this.d, rigPsi);
    this.playerRig.update(dt, this.v, this.steerVis, lean);
    if (this.skid > 0.6 && st === 'DRIVING') { this.skidTimer -= dt; if (this.skidTimer <= 0) { SoundFX.playSkid(); this.spawnTireSmoke(); this.skidTimer = 0.55; } }

    this.updateAI(dt, racing);
    World.update(this.s);
    // sun & shadows follow the player
    const p = this.playerRig.root.position;
    this.sunLight.position.set(p.x + this.sunDir.x * 90, p.y + this.sunDir.y * 90, p.z + this.sunDir.z * 90);
    this.sunLight.target.position.copy(p); this.sunLight.target.updateMatrixWorld();
    this.updateCamera(dt, now);
    SoundFX.updateEngineRPM(clamp(this.speedKmh / (parseFloat(APP_CONFIG.maxSpeed) || 220), 0, 1), brakeOn && this.v > 1);

    this.hudTimer -= dt; if (this.hudTimer <= 0 && this.state !== 'MENU') { this.hudTimer = 0.12; this.updateHUD(); }
  },

  clampToRails() { const lim = this.railLimit(); if (Math.abs(this.d) > lim) { this.d = Math.sign(this.d) * lim; this.psi *= 0.5; } },

  /* ======================= test / diagnostics hooks ======================= */
  debugInfo() {
    const rig = this.playerRig;
    return { state: this.state, s: +this.s.toFixed(2), d: +this.d.toFixed(2), psiDeg: +(this.psi * 57.2958).toFixed(1), kmh: +this.speedKmh.toFixed(1), cp: this.currentCheckpointIndex, cpTotal: this.checkpoints.length,
      points: this.stats.points, collisions: this.stats.collisions, correct: this.stats.correctCount, wrong: this.stats.wrongAttempts, ai: this.aiCars.length,
      heading: rig ? rig.headingInfo : null, wheels: rig ? rig.wheels.length : 0, camera: this.cameraMode, preset: this.preset, road: RoadPath.info };
  },
  /** test helper: mark the first n barriers as already cleared (open) */
  debugSetProgress(n) { this.checkpoints.forEach((cp, i) => { cp.cleared = i < n; cp.isOpen = i < n; cp.targetAngle = i < n ? Math.PI * 0.48 : 0; cp.currentAngle = cp.targetAngle; }); this.currentCheckpointIndex = n; },
  debugScenario({ s, d = 0, kmh = 0, progress = 0, lane = null }) {
    this.clearTimers(); clearInterval(this.questionTimerInterval);
    const q = document.getElementById('question-overlay'); if (q) q.classList.add('hidden');
    UIController.hideBanner(); this.celebrationDriveThroughActive = false;
    this.debugSetProgress(progress); this.state = 'DRIVING'; this.touchTargetLane = lane; this.steerInput = 0; this.steerCmd = 0; this.steerAngle = 0;
    this.debugTeleport(s, d, kmh, 0); this.aiCars.forEach((ai) => { ai.s = s - 80; ai.v = 0; });
  },
  debugTeleport(s, d = 0, kmh = 0, psi = 0) { this.s = s; this.d = d; this.v = kmh / 3.6; this.psi = psi; this.speedKmh = kmh; this.lastSafeS = s; this.collisionGraceUntil = 0; }
};

/* ===== 72-checkpoints ===== */
/* ----------------------- 4f. CHECKPOINT BARRIERS & FINISH ARCH (placed physically on the road path) ----------------------- */
const EngineCheckpointMethods = {
  setupCheckpointsAndFinish() {
    this.checkpoints.forEach((cp) => { this.scene.remove(cp.group); disposeGroupGeometry(cp.group); });
    this.checkpoints = [];
    if (this.finishArch) { this.scene.remove(this.finishArch); disposeGroupGeometry(this.finishArch); this.finishArch = null; }
    if (this.trophyMesh) { this.scene.remove(this.trophyMesh); this.trophyMesh = null; }

    let pool = APP_CONFIG.questions.filter((q) => q.enabled !== false);
    if (pool.length === 0) pool = JSON.parse(JSON.stringify(DEFAULT_QUESTIONS));
    if (APP_CONFIG.questionOrder === 'random') pool = [...pool].sort(() => Math.random() - 0.5);
    const totalCP = this.checkpointTotal(pool.length);
    this.activeQuestions = [];
    for (let i = 0; i < totalCP; i++) this.activeQuestions.push(pool[i % pool.length]);
    const spacing = this.checkpointSpacing();
    for (let i = 0; i < totalCP; i++) {
      const cpS = this.START_S + (i + 1) * spacing;
      const cpObj = this.createCheckpointBarrier3D(cpS, i + 1);
      this.scene.add(cpObj.group);
      this.checkpoints.push(cpObj);
    }
    const finishS = this.START_S + (totalCP + 0.85) * spacing;
    this.finishArch = this.createFinishLineArch3D(finishS);
    this.scene.add(this.finishArch);
  },

  checkpointTotal(poolLen) { return Math.max(1, Math.min(30, parseInt(APP_CONFIG.checkpointCount, 10) || poolLen)); },
  checkpointSpacing() { return Math.max(180, parseInt(APP_CONFIG.checkpointSpacing, 10) || 260); },

  createCheckpointBarrier3D(sPos, indexNumber) {
    const group = new THREE.Group();
    const o = RoadPath.at(sPos);
    group.position.set(o.x, o.y, o.z);
    group.rotation.y = o.yaw;
    const half = SHOULDER_END + 0.2;
    const pillarMat = new THREE.MeshStandardMaterial({ color: Col(0x1e293b), metalness: 0.6, roughness: 0.3 });
    const pillarGeo = new THREE.BoxGeometry(0.85, 6.2, 0.85);
    [-half - 0.6, half + 0.6].forEach((xSide) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(xSide, 3.1, 0); pillar.castShadow = true; group.add(pillar);
    });
    // overhead sign with Arabic text (Cairo font is embedded, no network)
    const signCanvas = document.createElement('canvas'); signCanvas.width = 768; signCanvas.height = 160;
    const ctx = signCanvas.getContext('2d');
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 768, 160);
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 10; ctx.strokeRect(8, 8, 752, 144);
    ctx.fillStyle = '#fbbf24'; ctx.font = '800 62px Cairo, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(`حاجز السؤال التعليمي ${indexNumber}`, 384, 82);
    const signTex = new THREE.CanvasTexture(signCanvas); signTex.encoding = THREE.sRGBEncoding; signTex.anisotropy = 4;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1.8, 2.1, 0.5), new THREE.MeshBasicMaterial({ map: signTex }));
    banner.position.set(0, 5.6, 0); group.add(banner);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.6 });
    const lightGeo = new THREE.SphereGeometry(0.4, 14, 14);
    const leftLight = new THREE.Mesh(lightGeo, lightMat); leftLight.position.set(-half + 0.1, 4.0, 0.55);
    const rightLight = new THREE.Mesh(lightGeo, lightMat); rightLight.position.set(half - 0.1, 4.0, 0.55);
    group.add(leftLight, rightLight);
    // mechanical boom arm pivot on the right side, spanning the whole carriageway
    const armPivot = new THREE.Group();
    armPivot.position.set(half, 1.25, 0.35); group.add(armPivot);
    const armCanvas = document.createElement('canvas'); armCanvas.width = 512; armCanvas.height = 64;
    const aCtx = armCanvas.getContext('2d');
    for (let x = 0; x < 512; x += 64) { aCtx.fillStyle = (x / 64) % 2 === 0 ? '#ef4444' : '#ffffff'; aCtx.fillRect(x, 0, 64, 64); }
    const armTex = new THREE.CanvasTexture(armCanvas); armTex.encoding = THREE.sRGBEncoding;
    const armLength = half * 2 - 0.4;
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(armLength, 0.36, 0.26), new THREE.MeshStandardMaterial({ map: armTex, roughness: 0.3 }));
    armMesh.position.set(-armLength * 0.5, 0, 0); armMesh.castShadow = true; armPivot.add(armMesh);
    // base post for the boom
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), pillarMat); post.position.set(half, 0.75, 0.35); group.add(post);
    return { s: sPos, z: sPos, index: indexNumber - 1, group, armPivot, lightMat, isOpen: false, targetAngle: 0, currentAngle: 0, cleared: false };
  },

  createFinishLineArch3D(sPos) {
    const group = new THREE.Group();
    group.userData.s = sPos; group.userData.z = sPos;
    const o = RoadPath.at(sPos);
    group.position.set(o.x, o.y, o.z); group.rotation.y = o.yaw;
    const half = SHOULDER_END + 0.6;
    const goldMat = new THREE.MeshStandardMaterial({ color: Col(0xf59e0b), metalness: 0.75, roughness: 0.2 });
    [-half - 0.6, half + 0.6].forEach((xSide) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 7.5, 16), goldMat);
      col.position.set(xSide, 3.75, 0); group.add(col);
    });
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 2.4, 1.8, 0.7), new THREE.MeshStandardMaterial({ map: this.checkeredTexture }));
    topMesh.position.set(0, 7.1, 0); group.add(topMesh);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, 3.2), new THREE.MeshBasicMaterial({ map: this.checkeredTexture, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    strip.rotation.x = -Math.PI / 2; strip.position.y = 0.05; group.add(strip);
    return group;
  }
};
Object.assign(GameEngine, EngineCheckpointMethods);

/* ===== 75-quiz ===== */
/* ----------------------- 4g. CELEBRATIONS, PARTICLES, QUIZ FLOW (preserved from V7, adapted to the path model) ----------------------- */
const EngineQuizMethods = {
  spawnGoldenTrophy3D() {
    if (this.trophyMesh) this.scene.remove(this.trophyMesh);
    const trophy = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.88,
      roughness: 0.15,
      emissive: 0x78350f,
      emissiveIntensity: 0.3
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.5, 20), goldMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 1.2, 16), goldMat);
    stem.position.y = 0.85;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.55, 1.4, 24), goldMat);
    cup.position.y = 2.0;

    trophy.add(base, stem, cup);
    const cy = this.carGroup.rotation.y, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    trophy.position.set(this.carGroup.position.x + rx * 3.2 + fx * 2.4, this.carGroup.position.y + 0.6, this.carGroup.position.z + rz * 3.2 + fz * 2.4);
    this.scene.add(trophy);
    this.trophyMesh = trophy;
  },

  /* ------------------- 3D CONFETTI, TIRE SMOKE & FIREWORKS ------------------- */
  spawnCelebrationConfetti(originPos, count = 95) {
    const colors = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0xec4899, 0xfde047];
    const geo = new THREE.PlaneGeometry(0.28, 0.18);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        originPos.x + (Math.random() - 0.5) * 9,
        originPos.y + 2.2 + Math.random() * 4.5,
        originPos.z + (Math.random() - 0.5) * 6
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 6,
        vy: 3 + Math.random() * 7,
        vz: (Math.random() - 0.5) * 6,
        rx: Math.random() * 8,
        ry: Math.random() * 8,
        gravity: 7.5,
        life: 3.2
      });
    }
  },

  spawnTireSmoke() {
    if (!this.carGroup) return;
    const smokeGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.65
    });
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(smokeGeo, smokeMat.clone());
      const side = i % 2 === 0 ? -0.95 : 0.95;
      const cy = this.carGroup.rotation.y, bx = Math.sin(cy), bz = Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
      const back = 1.5 + Math.random() * 0.6;
      mesh.position.set(
        this.carGroup.position.x + rx * side + bx * back + (Math.random() - 0.5) * 0.3,
        this.carGroup.position.y + 0.25,
        this.carGroup.position.z + rz * side + bz * back
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 1.8,
        vy: 0.8 + Math.random() * 1.4,
        vz: 1.5 + Math.random() * 2.0,
        rx: 0,
        ry: 0,
        gravity: -0.4,
        isSmoke: true,
        life: 1.1
      });
    }
  },

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.y += p.ry * dt;
      if (p.isSmoke) {
        p.mesh.scale.addScalar(dt * 1.6);
        p.mesh.material.opacity = Math.max(0, p.life * 0.6);
      }
    }
  },

  /* ------------------- QUESTION DISPLAY & ANSWER EVALUATION ------------------- */
  openQuestionForCurrentCheckpoint() {
    this.state = 'QUESTION';
    this.stats.pauseStartStamp = this.clock;

    const q = this.activeQuestions[this.currentCheckpointIndex];
    const overlay = document.getElementById('question-overlay');
    overlay.classList.remove('hidden');

    document.documentElement.style.setProperty('--question-scale', APP_CONFIG.questionScale || 1);
    document.getElementById('q-Number-badge').textContent = `الحاجز التعليمي ${this.currentCheckpointIndex + 1} من ${this.checkpoints.length}`;
    document.getElementById('q-subject-badge').textContent = `${q.subject || 'عام'} • ${q.difficulty || 'متوسط'}`;
    document.getElementById('q-text-el').textContent = q.text;

    // Optional Question Image
    const imgWrap = document.getElementById('q-image-container');
    const imgEl = document.getElementById('q-image-el');
    if (q.image) {
      imgEl.src = q.image;
      imgWrap.classList.remove('hidden');
    } else {
      imgWrap.classList.add('hidden');
    }

    // Optional Hint Button
    const hintBtn = document.getElementById('btn-show-hint');
    const hintBox = document.getElementById('q-hint-display');
    hintBox.classList.add('hidden');
    if (q.hint && q.hint.trim() !== '') {
      hintBtn.classList.remove('hidden');
      hintBtn.onclick = () => {
        hintBox.textContent = `💡 تلميح: ${q.hint}`;
        hintBox.classList.remove('hidden');
      };
    } else {
      hintBtn.classList.add('hidden');
    }

    // Build Answer Buttons (نعم / لا OR Multiple Choice)
    const answersGrid = document.getElementById('q-answers-container');
    answersGrid.innerHTML = '';
    const isMCQ = q.type === 'mcq' && Array.isArray(q.options) && q.options.length > 2;
    answersGrid.className = isMCQ ? 'answers-grid mcq-grid' : 'answers-grid';

    const opts = isMCQ ? q.options.filter((o) => o && o.trim() !== '') : ['نعم', 'لا'];
    opts.forEach((optText) => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      const icon = optText === 'نعم' ? '✅ ' : (optText === 'لا' ? '❌ ' : '🔹 ');
      btn.innerHTML = `<span>${icon}${optText}</span>`;
      btn.onclick = () => this.evaluateStudentAnswer(optText, btn, q);
      answersGrid.appendChild(btn);
    });

    // Optional Question Timer
    clearInterval(this.questionTimerInterval);
    const timerBadge = document.getElementById('q-timer-badge');
    const limitSec = parseInt(APP_CONFIG.questionTimer, 10) || 0;
    if (limitSec > 0) {
      let rem = limitSec;
      timerBadge.textContent = `⏱️ ${rem} ث`;
      timerBadge.classList.remove('hidden');
      this.questionTimerInterval = setInterval(() => {
        if (this.state !== 'QUESTION') {
          clearInterval(this.questionTimerInterval);
          return;
        }
        rem--;
        timerBadge.textContent = `⏱️ ${rem} ث`;
        if (rem <= 0) {
          clearInterval(this.questionTimerInterval);
          this.triggerWrongAnswerSequence(null, q);
        }
      }, 1000);
    } else {
      timerBadge.classList.add('hidden');
    }
  },

  evaluateStudentAnswer(selectedOption, btnElement, questionObj) {
    if (this.state !== 'QUESTION') return;
    clearInterval(this.questionTimerInterval);

    // Disable buttons during transition
    const allBtns = document.querySelectorAll('#q-answers-container .answer-btn');
    allBtns.forEach((b) => (b.style.pointerEvents = 'none'));

    const normalizedSelected = String(selectedOption).trim();
    const normalizedCorrect = String(questionObj.correctAnswer).trim();

    if (normalizedSelected === normalizedCorrect) {
      this.triggerCorrectAnswerCelebration(btnElement);
    } else {
      this.triggerWrongAnswerSequence(btnElement, questionObj);
    }
  },

  /* ------------------- 4. SPECTACULAR CORRECT ANSWER TIMELINE ------------------- */
  triggerCorrectAnswerCelebration(btnElement) {
    this.state = 'CORRECT_CELEBRATION';
    this.celebrationDriveThroughActive = false;
    this.stats.correctCount++;
    this.stats.points=(this.stats.points||0)+200;
    this.stats.pausedTimeAccum += (this.clock - this.stats.pauseStartStamp);
    this.updateHUD();

    const activeCP = this.checkpoints[this.currentCheckpointIndex];

    // [0.0 – 0.5s]: Selected answer glows green + positive sound + engine rev
    if (btnElement) btnElement.classList.add('correct-glow');
    SoundFX.playSuccessFanfare();
    SoundFX.revEngine();
    this.nudgePitch(0.03);

    // [0.5 – 1.5s]: Joyful REAL CAR HORN pattern + barrier warning lights turn green + mechanical barrier opens
    setTimeout(() => {
      document.getElementById('question-overlay').classList.add('hidden');
      SoundFX.playCarHorn(true);
      SoundFX.playBarrierServo();

      activeCP.isOpen = true;
      activeCP.targetAngle = Math.PI * 0.48; // Opens smoothly upward ~86 degrees
      activeCP.lightMat.color.setHex(0x10b981);
      activeCP.lightMat.emissive.setHex(0x10b981);
    }, 520);

    // [1.5 – 3.0s]: Colorful 3D confetti & golden sparkles erupt + floating congratulatory Arabic message
    setTimeout(() => {
      this.spawnCelebrationConfetti(activeCP.group.position, 110);
      const praises = APP_CONFIG.praiseMsgs?.length ? APP_CONFIG.praiseMsgs : ['أحسنت يا بطل!', 'إجابة رائعة!', 'أنت متسابق ذكي!', 'واصل التقدم!'];
      const msg = praises[Math.floor(Math.random() * praises.length)];
      UIController.showBanner(`🎉 ${msg}`, 'success');
    }, 1450);

    // [3.0s onward]: Car accelerates smoothly through the open barrier
    setTimeout(() => {
      this.celebrationDriveThroughActive = true;
      SoundFX.revEngine();
    }, 2850);
  },

  /* ------------------- 5. WRONG ANSWER: POWERFUL BRAKING EVENT ------------------- */
  triggerWrongAnswerSequence(btnElement, questionObj) {
    this.state = 'WRONG_RETRY';
    this.stats.wrongAttempts++;
    this.stats.points=Math.max(0,(this.stats.points||0)-40);
    this.updateHUD();

    // 1. Incorrect option flashes red
    if (btnElement) btnElement.classList.add('wrong-flash');

    // 2. Forceful braking sound + warning cue
    SoundFX.playStrongBrake();
    SoundFX.playWrongWarning();

    // 3. Intense brake lights + nose-dive braking reaction + tire smoke
    this.setBrakeLights(true);
    this.spawnTireSmoke();
    this.nudgePitch(-0.07, 450);

    // 4. Camera gentle braking shake
    this.shake(0.25);

    // 5. Motivational retry banner
    const retries = APP_CONFIG.retryMsgs?.length ? APP_CONFIG.retryMsgs : ['حاول مرة أخرى!', 'فكر جيدًا يا بطل!', 'أنت تستطيع!'];
    const msg = retries[Math.floor(Math.random() * retries.length)];
    UIController.showBanner(`🛑 ${msg}`, 'error');

    // Reveal hint automatically if available
    if (questionObj.hint) {
      const hintBox = document.getElementById('q-hint-display');
      hintBox.textContent = `💡 تلميح للبطل: ${questionObj.hint}`;
      hintBox.classList.remove('hidden');
    }

    // Present THE SAME QUESTION again after brief delay while barrier stays CLOSED
    setTimeout(() => {
      UIController.hideBanner();
      this.openQuestionForCurrentCheckpoint();
    }, 1650);
  },

  /* ------------------- 15. FINAL RACE VICTORY SEQUENCE ------------------- */
  triggerFinalVictorySequence() {
    this.state = 'FINISH';
    SoundFX.playCarHorn(true);
    SoundFX.playVictoryAnthem();

    UIController.showBanner(`🏆 ${APP_CONFIG.victoryMsg || 'مبروك يا بطل! لقد أنهيت السباق بنجاح!'}`, 'success');

    // Confetti & Sky Fireworks + 3D Championship Trophy
    this.spawnCelebrationConfetti(this.carGroup.position, 160);
    this.spawnGoldenTrophy3D();

    setTimeout(() => {
      this.spawnCelebrationConfetti(
        new THREE.Vector3(this.carGroup.position.x - Math.sin(this.carGroup.rotation.y) * 6, this.carGroup.position.y + 5, this.carGroup.position.z - Math.cos(this.carGroup.rotation.y) * 6),
        120
      );
    }, 1100);

    setTimeout(() => {
      this.state = 'RESULTS';
      UIController.hideBanner();
      UIController.showResultsModal();
    }, 3600);
  },

  updateHUD() {
    const totalCP = this.checkpoints.length || 1;
    const completed = Math.min(this.currentCheckpointIndex, totalCP);
    const pct = Math.round((completed / totalCP) * 100);

    document.getElementById('hud-checkpoint-txt').textContent = `${Math.min(this.currentCheckpointIndex + 1, totalCP)} / ${totalCP}`;
    document.getElementById('hud-progress-fill').style.width = `${pct}%`;
    document.getElementById('hud-correct-val').textContent = this.stats.correctCount;
    document.getElementById('hud-wrong-val').textContent = this.stats.wrongAttempts;
    document.getElementById('hud-crashes-val').textContent=this.stats.collisions||0;
    document.getElementById('hud-score-val').textContent=Math.round(this.stats.points||0);

    const sec = Math.max(0, Math.floor(this.stats.elapsedSec));
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    document.getElementById('hud-time-val').textContent = `${mm}:${ss}`;

    const distMeters = Math.max(0, Math.round(this.s - this.START_S));
    document.getElementById('hud-dist-val').textContent = `${distMeters} م`;

    const spd = Math.round(this.speedKmh);
    const safety=document.getElementById('hud-road-safety');
    if(safety){
      const risk=Math.abs(this.d)/ROAD_LIMIT;
      safety.textContent=risk>.81?'⚠️ احذر حافة الطريق':risk>.6?'↔️ عُد إلى الوسط':'✓ المسار آمن';
      safety.style.color=risk>.81?'#f87171':risk>.6?'#fbbf24':'#4ade80';
    }
    document.getElementById('hud-speed-val').textContent = spd;
    const maxSpd = parseFloat(APP_CONFIG.maxSpeed) || 220;
    document.getElementById('hud-rpm-fill').style.width = `${Math.min(100, Math.max(12, (spd / maxSpd) * 100))}%`;

    // Ranking display if AI competitors enabled
    const rankPill = document.getElementById('hud-rank-pill');
    if (APP_CONFIG.aiEnabled) {
      rankPill.classList.remove('hidden');
      let rank = 1;
      this.aiCars.forEach((ai) => {
        if (ai.s > this.s) rank++;
      });
      document.getElementById('hud-rank-val').textContent = `${rank} / ${this.aiCars.length + 1}`;
    } else {
      rankPill.classList.add('hidden');
    }
  }
};
Object.assign(GameEngine, EngineQuizMethods);

/* ===== 80-ui ===== */
/* ----------------------- 5. UI, CONTROLS & ADMIN CONTROLLER ----------------------- */
const $id = (id) => document.getElementById(id);
const WORLD_KEYS = ['trackId', 'customCityName', 'customCityStyle', 'roadDifficulty', 'checkpointCount', 'checkpointSpacing', 'graphicsQuality', 'classroomMode', 'questions'];
const CAMERA_ORDER = ['chase', 'low', 'hood'];

const UIController = {
  init() {
    this.syncBrandingUI();
    this.renderGarageModal();
    this.renderTracksModal();
    this.bindCityAndCarImport();
    this.bindMenuAndHUDButtons();
    this.bindKeyboardAndTouchControls();
    this.bindFreeTouchControls();
    SoundFX.muted = APP_CONFIG.soundOn === false;
    this.refreshMuteIcons();
    if (window.__STUDENT_ONLY_BUILD__) {
      const adminBtn = $id('btn-open-admin'); const adminModal = $id('modal-admin');
      if (adminBtn) adminBtn.remove(); if (adminModal) adminModal.remove();
    } else { this.initAdminDashboard(); }
  },

  showStatus(text, ms = 3200) {
    const el = $id('realism-status'); if (!el) return;
    el.textContent = text; el.classList.remove('hidden');
    clearTimeout(this._statusT); this._statusT = setTimeout(() => el.classList.add('hidden'), ms);
  },

  syncBrandingUI() {
    $id('ui-school-name').textContent = APP_CONFIG.schoolName;
    $id('ui-dept-name').textContent = APP_CONFIG.deptName;
    $id('ui-game-title').textContent = APP_CONFIG.gameTitle;
    $id('ui-game-subtitle').textContent = APP_CONFIG.gameSubtitle;
    $id('ui-teacher-credit').textContent = `إشراف: ${APP_CONFIG.teacherName}`;
    document.title = APP_CONFIG.gameTitle || document.title;
    const logoEl = $id('ui-school-logo');
    if (APP_CONFIG.schoolLogo) { logoEl.src = APP_CONFIG.schoolLogo; logoEl.classList.remove('hidden'); } else { logoEl.classList.add('hidden'); }
    const envName = APP_CONFIG.trackId === 'custom_city' ? ('مدينة ' + (APP_CONFIG.customCityName || 'مخصصة')) : (ENVIRONMENTS[APP_CONFIG.trackId]?.name || ENVIRONMENTS.doha.name);
    const enabledQCount = APP_CONFIG.questions.filter((q) => q.enabled !== false).length;
    const totalCP = Math.min(APP_CONFIG.checkpointCount || enabledQCount, 30);
    $id('ui-active-track-label').textContent = `المضمار الحالي: ${envName} | الحواجز التعليمية: ${totalCP}`;
    $id('lbl-autodrive-state').textContent = APP_CONFIG.autoDrive ? 'مفعّل' : 'إيقاف';
    const leftBtns = $id('touch-left-buttons'); const wheelWrap = $id('virtual-wheel-wrap');
    if (APP_CONFIG.touchMode === 'wheel') { leftBtns.classList.add('hidden'); wheelWrap.classList.remove('hidden'); }
    else { leftBtns.classList.toggle('hidden', APP_CONFIG.touchMode === 'free'); wheelWrap.classList.add('hidden'); }
    const hint = $id('free-steer-hint');
    if (hint) hint.classList.toggle('hidden', APP_CONFIG.touchMode !== 'free' || $id('hud-screen').classList.contains('hidden'));
  },

  showBanner(text, type = 'warning') {
    const wrap = $id('center-banner-wrap'); const box = $id('center-banner');
    box.textContent = text; box.className = `banner-box banner-${type}`; wrap.classList.remove('hidden');
  },
  hideBanner() { $id('center-banner-wrap').classList.add('hidden'); },

  /* ------------------- race start (rebuilds the world first if a setting changed it) ------------------- */
  async startRace() {
    if (this._starting) return; this._starting = true;
    try {
      if (GameEngine.worldDirty) { GameEngine.worldDirty = false; await GameEngine.rebuildWorld(); }
      GameEngine.startNewRace();
    } finally { this._starting = false; }
  },

  async applyConfigChanges(before) {
    const changed = (k) => JSON.stringify(before[k]) !== JSON.stringify(APP_CONFIG[k]);
    const prevQuestionsOnly = changed('questions') && !WORLD_KEYS.filter((k) => k !== 'questions').some(changed);
    if (WORLD_KEYS.filter((k) => k !== 'questions').some(changed)) { await GameEngine.rebuildWorld(); }
    else {
      if (prevQuestionsOnly || changed('maxSpeed') || changed('startingScore')) { GameEngine.setupCheckpointsAndFinish(); GameEngine.resetCarPosition(); }
      if (changed('carModel') || JSON.stringify(before.carHeading) !== JSON.stringify(APP_CONFIG.carHeading)) await GameEngine.reloadPlayerCar();
      else if (changed('carColor')) GameEngine.setPlayerPaint(APP_CONFIG.carColor);
      if (changed('aiCount') || changed('aiEnabled')) { await GameEngine.reloadAICars(); GameEngine.resetCarPosition(); }
    }
    SoundFX.muted = APP_CONFIG.soundOn === false; this.refreshMuteIcons();
    this.syncBrandingUI();
  },

  snapshotConfig() { return JSON.parse(JSON.stringify(Object.assign({}, APP_CONFIG, { schoolLogo: '', customCarData: '', carAssets: {} }))); },

  /* ------------------- garage ------------------- */
  renderGarageModal() {
    const modelsGrid = $id('garage-models-grid'); modelsGrid.innerHTML = '';
    CAR_MODELS.forEach((m) => {
      const card = document.createElement('div');
      card.className = `select-card ${APP_CONFIG.carModel === m.id ? 'selected' : ''}`;
      card.innerHTML = `
        <div style="font-size:2.1rem; margin-bottom:6px;">${m.builtinReal ? '🏎️' : m.brandModel ? '🚘' : '🏁'}</div>
        <h4 style="color:#fbbf24; font-size:1.05rem;">${m.name}</h4>
        <p style="font-size:0.8rem; color:#cbd5e1; margin-top:4px;">${m.desc}</p>
        ${m.builtinReal ? '<p style="font-size:.78rem;color:#86efac;margin-top:8px">✅ نموذج PBR حقيقي مضمّن — يعمل بدون إنترنت</p>' : ''}
        ${m.brandModel ? `<p style="color:${APP_CONFIG.carAssets?.[m.id] ? '#34d399' : '#fda4af'};font-size:.79rem;margin-top:7px">${APP_CONFIG.carAssets?.[m.id] ? '✅ النموذج الأصلي مرفوع' : '📁 اضغط هنا لإرفاق ملف GLB مرخّص'}</p>` : ''}`;
      card.onclick = async () => {
        if (m.brandModel && !APP_CONFIG.carAssets?.[m.id]) {
          this.pendingCarSlot = m.id;
          $id('garage-car-upload-status').textContent = 'اختر ملف GLB حقيقيًا ومرخصًا لسيارة ' + m.name + ' — لا يتم استبدالها بموديل مختلف.';
          $id('garage-car-glb').click(); return;
        }
        if (m.id === 'custom_glb' && !APP_CONFIG.customCarData) { this.pendingCarSlot = 'custom_glb'; $id('garage-car-upload-status').textContent = 'ارفع نموذج سيارة بصيغة GLB أولًا.'; $id('garage-car-glb').click(); return; }
        APP_CONFIG.carModel = m.id; StorageManager.save();
        this.renderGarageModal();
        await GameEngine.reloadPlayerCar(); this.refreshHeadingUI();
      };
      modelsGrid.appendChild(card);
    });
    const colorsRow = $id('garage-colors-row'); colorsRow.innerHTML = '';
    CAR_COLORS.forEach((c) => {
      const sw = document.createElement('div');
      sw.className = `color-swatch ${APP_CONFIG.carColor === c.hex ? 'selected' : ''}`;
      sw.style.backgroundColor = c.hex; sw.title = c.name;
      sw.onclick = () => { APP_CONFIG.carColor = c.hex; StorageManager.save(); GameEngine.setPlayerPaint(c.hex); this.renderGarageModal(); };
      colorsRow.appendChild(sw);
    });
    this.refreshHeadingUI();
  },

  refreshHeadingUI() {
    const sel = $id('garage-car-heading'); if (!sel) return;
    sel.value = (APP_CONFIG.carHeading && APP_CONFIG.carHeading[APP_CONFIG.carModel]) || 'auto';
    const info = $id('garage-heading-info'); const rig = GameEngine.playerRig;
    if (info && rig && rig.headingInfo) {
      const h = rig.headingInfo, v = h.verify;
      info.textContent = `المقدمة المكتشفة: ${h.used || '?'} (الطريقة: ${h.method || '—'}) • فحص هندسي: ${v ? (v.ok ? '✅ المقدمة نحو الأمام والمصابيح الخلفية خلف السيارة' : '❌ اتجاه خاطئ — غيّر المحوّل') : '—'}`;
    }
  },

  renderTracksModal() {
    const grid = $id('tracks-grid'); grid.innerHTML = '';
    Object.values(ENVIRONMENTS).forEach((env) => {
      const card = document.createElement('div');
      card.className = `select-card ${APP_CONFIG.trackId === env.id ? 'selected' : ''}`;
      card.innerHTML = `<div style="font-size:2.2rem; margin-bottom:6px;">${env.icon}</div><h4 style="color:#fbbf24; font-size:1.05rem;">${env.name}</h4><p style="font-size:0.8rem; color:#cbd5e1; margin-top:4px;">${env.desc}</p>`;
      card.onclick = () => { APP_CONFIG.trackId = env.id; StorageManager.save(); GameEngine.rebuildWorld(); this.syncBrandingUI(); this.renderTracksModal(); };
      grid.appendChild(card);
    });
  },

  bindCityAndCarImport() {
    const name = $id('custom-city-name'); const style = $id('custom-city-style');
    if (name) name.value = APP_CONFIG.customCityName || '';
    if (style) style.value = APP_CONFIG.customCityStyle || 'gulf';
    $id('btn-apply-custom-city').onclick = async () => {
      const value = (name.value || '').trim(); if (!value) { name.focus(); return; }
      APP_CONFIG.customCityName = value; APP_CONFIG.customCityStyle = style.value; APP_CONFIG.trackId = 'custom_city';
      await StorageManager.save(APP_CONFIG); GameEngine.rebuildWorld(); this.syncBrandingUI(); this.renderTracksModal();
      $id('modal-tracks').classList.add('hidden');
    };
    const heading = $id('garage-car-heading');
    heading.onchange = async () => {
      APP_CONFIG.carHeading = APP_CONFIG.carHeading || {};
      if (heading.value === 'auto') delete APP_CONFIG.carHeading[APP_CONFIG.carModel]; else APP_CONFIG.carHeading[APP_CONFIG.carModel] = heading.value;
      await StorageManager.save(APP_CONFIG); await GameEngine.reloadPlayerCar(); this.refreshHeadingUI();
    };
    const status = $id('garage-car-upload-status');
    if (APP_CONFIG.customCarData) status.textContent = '✅ تم حفظ نموذج سيارة واقعي مسبقًا — اختر «سيارتي الواقعية GLB» للعرض.';
    const fileInput = $id('garage-car-glb');
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      if (!/\.glb$/i.test(file.name)) { status.textContent = '⚠️ اختر ملف GLB فقط.'; return; }
      if (file.size > 18 * 1024 * 1024) { status.textContent = '⚠️ الملف أكبر من 18 ميجابايت؛ استخدم نسخة محسّنة للجوال.'; return; }
      status.textContent = '⏳ جارٍ قراءة السيارة وتحميلها...';
      try {
        const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error('تعذّرت قراءة الملف')); r.readAsDataURL(file); });
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw new Error('بيانات GLB غير صالحة');
        const slot = this.pendingCarSlot || 'custom_glb';
        if (slot === 'custom_glb') APP_CONFIG.customCarData = dataUrl; else { APP_CONFIG.carAssets = APP_CONFIG.carAssets || {}; APP_CONFIG.carAssets[slot] = dataUrl; }
        APP_CONFIG.carModel = slot; this.pendingCarSlot = null;
        await StorageManager.save(APP_CONFIG);
        await GameEngine.reloadPlayerCar(); this.renderGarageModal();
        const h = GameEngine.playerRig?.headingInfo;
        status.textContent = `✅ تم حفظ السيارة. اتجاه المقدمة المكتشف: ${h?.used || '?'} (${h?.method || '—'}). إن بدت السيارة تسير للخلف فغيّر محوّل الاتجاه أعلاه.`;
      } catch (err) { status.textContent = '⚠️ تعذّر استيراد النموذج: ' + (err.message || err); }
      finally { fileInput.value = ''; this.pendingCarSlot = null; }
    };
    $id('garage-car-remove').onclick = async () => {
      if (CAR_MODELS.find((x) => x.id === APP_CONFIG.carModel)?.brandModel) { if (APP_CONFIG.carAssets) delete APP_CONFIG.carAssets[APP_CONFIG.carModel]; } else APP_CONFIG.customCarData = '';
      APP_CONFIG.carModel = 'ferrari_458_real'; await StorageManager.save(APP_CONFIG);
      status.textContent = 'تم حذف النموذج المستورد والعودة للسيارة المضمّنة.';
      await GameEngine.reloadPlayerCar(); this.renderGarageModal();
    };
  },

  showResultsModal() {
    $id('hud-screen').classList.add('hidden');
    $id('modal-results').classList.remove('hidden');
    const studentName = $id('input-student-name').value.trim() || 'بطل السباق';
    $id('res-victory-title').textContent = `🏆 ${APP_CONFIG.victoryMsg || 'مبروك يا بطل! لقد أنهيت السباق بنجاح!'}`;
    $id('res-student-line').textContent = `المتسابق البطل: ${studentName}`;
    const totalCP = GameEngine.checkpoints.length, wrong = GameEngine.stats.wrongAttempts, impacts = GameEngine.stats.collisions || 0;
    const score = Math.max(0, Math.round(GameEngine.stats.points || 0));
    const stars = (wrong === 0 && impacts === 0) ? '⭐⭐⭐' : (wrong + impacts <= 2 ? '⭐⭐' : '⭐');
    const sec = Math.max(1, Math.floor(GameEngine.stats.elapsedSec));
    $id('res-stars').textContent = stars;
    $id('res-checkpoints').textContent = `${totalCP} / ${totalCP}`;
    $id('res-correct').textContent = GameEngine.stats.correctCount;
    $id('res-wrong').textContent = wrong; $id('res-crashes').textContent = impacts; $id('res-score').textContent = score;
    $id('res-time').textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  },

  toggleFullscreen() {
    const docEl = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
      else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
      else { window.scrollTo(0, 1); this.showStatus('هذا المتصفح لا يدعم ملء الشاشة: على iPhone اختر «مشاركة ← إضافة إلى الشاشة الرئيسية» للعب بملء الشاشة.', 6000); }
    } else if (document.exitFullscreen) document.exitFullscreen().catch(() => {}); else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  },

  refreshMuteIcons() { const icon = SoundFX.muted ? '🔇' : '🔊'; const a = $id('btn-menu-audio'), b = $id('btn-hud-audio'); if (a) a.textContent = icon; if (b) b.textContent = icon; },
  cycleCamera() { const i = CAMERA_ORDER.indexOf(GameEngine.cameraMode); GameEngine.cameraMode = CAMERA_ORDER[(i + 1) % CAMERA_ORDER.length]; GameEngine.startCameraTransition(); this.showStatus({ chase: '🎥 كاميرا المطاردة الخلفية', low: '🎬 الكاميرا السينمائية المنخفضة', hood: '🚗 كاميرا غطاء المحرك' }[GameEngine.cameraMode], 1400); },

  bindMenuAndHUDButtons() {
    const unlockOnce = () => { SoundFX.unlock(); window.removeEventListener('pointerdown', unlockOnce); window.removeEventListener('touchstart', unlockOnce); window.removeEventListener('keydown', unlockOnce); };
    window.addEventListener('pointerdown', unlockOnce); window.addEventListener('touchstart', unlockOnce, { passive: true }); window.addEventListener('keydown', unlockOnce);
    $id('btn-start-race').onclick = () => this.startRace();
    $id('btn-open-garage').onclick = () => { this.renderGarageModal(); $id('modal-garage').classList.remove('hidden'); };
    $id('btn-open-tracks').onclick = () => { this.renderTracksModal(); $id('modal-tracks').classList.remove('hidden'); };
    $id('btn-open-howto').onclick = () => $id('modal-howto').classList.remove('hidden');
    $id('btn-open-settings').onclick = () => { $id('btn-quit-to-menu').classList.add('hidden'); $id('modal-settings').classList.remove('hidden'); };
    document.querySelectorAll('[data-close]').forEach((btn) => { btn.onclick = () => $id(btn.getAttribute('data-close')).classList.add('hidden'); });
    $id('btn-menu-audio').onclick = () => { SoundFX.toggleMute(); APP_CONFIG.soundOn = !SoundFX.muted; StorageManager.save(); this.refreshMuteIcons(); };
    $id('btn-hud-audio').onclick = () => { SoundFX.toggleMute(); APP_CONFIG.soundOn = !SoundFX.muted; StorageManager.save(); this.refreshMuteIcons(); };
    $id('btn-menu-fullscreen').onclick = () => this.toggleFullscreen();
    $id('btn-hud-fullscreen').onclick = () => this.toggleFullscreen();
    $id('btn-hud-autodrive').onclick = () => {
      APP_CONFIG.autoDrive = !APP_CONFIG.autoDrive; $id('lbl-autodrive-state').textContent = APP_CONFIG.autoDrive ? 'مفعّل' : 'إيقاف';
      $id('sel-autodrive-mode').value = String(APP_CONFIG.autoDrive); StorageManager.save();
    };
    $id('btn-hud-camera').onclick = () => this.cycleCamera();
    $id('btn-hud-horn').onclick = () => SoundFX.playCarHorn(false);
    $id('btn-hud-pause').onclick = () => { $id('btn-quit-to-menu').classList.remove('hidden'); $id('modal-settings').classList.remove('hidden'); };
    $id('btn-quit-to-menu').onclick = () => {
      $id('modal-settings').classList.add('hidden'); $id('hud-screen').classList.add('hidden'); $id('question-overlay').classList.add('hidden');
      this.hideBanner(); $id('menu-screen').classList.remove('hidden');
      GameEngine.state = 'MENU'; GameEngine.resetCarPosition();
    };
    const bindSlider = (id, lblId, key) => {
      const el = $id(id), lbl = $id(lblId);
      el.value = Math.round((APP_CONFIG[key] ?? 0.8) * 100); lbl.textContent = `${el.value}%`;
      el.oninput = () => { lbl.textContent = `${el.value}%`; APP_CONFIG[key] = parseInt(el.value, 10) / 100; StorageManager.save(); };
    };
    bindSlider('rng-vol-music', 'val-vol-music', 'volMusic'); bindSlider('rng-vol-engine', 'val-vol-engine', 'volEngine'); bindSlider('rng-vol-sfx', 'val-vol-sfx', 'volSfx');
    const sens = $id('rng-steer-sens'), sensL = $id('val-steer-sens');
    sens.value = Math.round((APP_CONFIG.steeringSensitivity ?? 1) * 100); sensL.textContent = `${sens.value}%`;
    sens.oninput = () => { sensL.textContent = `${sens.value}%`; APP_CONFIG.steeringSensitivity = parseInt(sens.value, 10) / 100; StorageManager.save(); };
    const selCam = $id('sel-camera-default'); selCam.value = APP_CONFIG.cameraDefault || 'chase';
    selCam.onchange = () => { APP_CONFIG.cameraDefault = selCam.value; GameEngine.cameraMode = selCam.value; StorageManager.save(); };
    const selClass = $id('sel-classroom-mode'); selClass.value = String(!!APP_CONFIG.classroomMode);
    selClass.onchange = () => { APP_CONFIG.classroomMode = selClass.value === 'true'; GameEngine.applyGraphicsQuality(); GameEngine.worldDirty = true; StorageManager.save(); };
    const selQual = $id('sel-graphics-quality'); selQual.value = APP_CONFIG.graphicsQuality || 'auto';
    selQual.onchange = () => { APP_CONFIG.graphicsQuality = selQual.value; GameEngine.applyGraphicsQuality(); GameEngine.worldDirty = true; StorageManager.save(); };
    const selTouch = $id('sel-touch-mode'); selTouch.value = APP_CONFIG.touchMode || 'free';
    selTouch.onchange = () => {
      APP_CONFIG.touchMode = selTouch.value; GameEngine.touchTargetLane = null; GameEngine.steerInput = 0;
      if (selTouch.value === 'free') APP_CONFIG.autoDrive = false; this.syncBrandingUI(); StorageManager.save();
    };
    const selAuto = $id('sel-autodrive-mode'); selAuto.value = String(!!APP_CONFIG.autoDrive);
    selAuto.onchange = () => { APP_CONFIG.autoDrive = selAuto.value === 'true'; this.syncBrandingUI(); StorageManager.save(); };
    $id('btn-res-replay').onclick = () => this.startRace();
    $id('btn-res-newrace').onclick = () => { $id('modal-results').classList.add('hidden'); $id('menu-screen').classList.remove('hidden'); GameEngine.state = 'MENU'; GameEngine.resetCarPosition(); this.renderTracksModal(); $id('modal-tracks').classList.remove('hidden'); };
    $id('btn-res-home').onclick = () => { $id('modal-results').classList.add('hidden'); $id('menu-screen').classList.remove('hidden'); GameEngine.state = 'MENU'; GameEngine.resetCarPosition(); };
  },

  /* ------------------- full-screen free touch steering: absolute lane target (tap, quick tap, drag) ------------------- */
  bindFreeTouchControls() {
    const surface = $id('webgl-container'); const marker = $id('free-steer-target'); const hint = $id('free-steer-hint');
    if (!surface) return;
    let owner = null, fadeHandle = null;
    const active = () => APP_CONFIG.touchMode === 'free' && (GameEngine.state === 'DRIVING' || GameEngine.state === 'APPROACHING_CHECKPOINT') &&
      $id('question-overlay').classList.contains('hidden') && [...document.querySelectorAll('.modal-backdrop')].every((m) => m.classList.contains('hidden'));
    const steerTo = (x, y) => {
      if (!active()) return;
      const r = surface.getBoundingClientRect();
      const ratio = Math.max(-1, Math.min(1, ((x - r.left) / Math.max(1, r.width) - 0.5) * 2));
      GameEngine.touchTargetLane = ratio * (ROAD_HALF - 1.4);
      if (APP_CONFIG.autoDrive) { APP_CONFIG.autoDrive = false; $id('lbl-autodrive-state').textContent = 'إيقاف'; $id('sel-autodrive-mode').value = 'false'; StorageManager.save().catch(() => {}); }
      if (marker) { marker.style.left = (x - r.left) + 'px'; marker.style.top = (y - r.top) + 'px'; marker.classList.add('active'); }
      if (hint) hint.classList.add('hidden');
      clearTimeout(fadeHandle); fadeHandle = setTimeout(() => marker?.classList.remove('active'), 1100);
    };
    surface.addEventListener('pointerdown', (e) => {
      if (!active() || owner !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      owner = e.pointerId; try { surface.setPointerCapture(owner); } catch (_e) {}
      steerTo(e.clientX, e.clientY); e.preventDefault();
    }, { passive: false });
    surface.addEventListener('pointermove', (e) => { if (owner !== e.pointerId) return; steerTo(e.clientX, e.clientY); e.preventDefault(); }, { passive: false });
    const up = (e) => { if (owner !== e.pointerId) return; owner = null; try { if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId); } catch (_e) {} marker?.classList.remove('active'); };
    surface.addEventListener('pointerup', up); surface.addEventListener('pointercancel', up);
    window.addEventListener('blur', () => { owner = null; marker?.classList.remove('active'); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { owner = null; marker?.classList.remove('active'); } });
    window.setInterval(() => { if (!hint) return; hint.classList.toggle('hidden', APP_CONFIG.touchMode !== 'free' || $id('hud-screen').classList.contains('hidden') || GameEngine.state !== 'DRIVING' || GameEngine.touchTargetLane !== null); }, 450);
  },

  bindKeyboardAndTouchControls() {
    const keys = { left: false, right: false };
    const updateSteer = () => {
      if (keys.left && !keys.right) GameEngine.steerInput = -1; else if (keys.right && !keys.left) GameEngine.steerInput = 1; else GameEngine.steerInput = 0;
      GameEngine.manualSteerOverride = keys.left || keys.right;
      if (GameEngine.manualSteerOverride) GameEngine.touchTargetLane = null;
    };
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = true; updateSteer(); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; updateSteer(); }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') GameEngine.gasInput = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') { GameEngine.brakeInput = true; if (e.code === 'Space') e.preventDefault(); }
      if (e.code === 'KeyH') SoundFX.playCarHorn(false);
      if (e.code === 'KeyC' && !e.repeat) this.cycleCamera();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = false; updateSteer(); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = false; updateSteer(); }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') GameEngine.gasInput = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Space') GameEngine.brakeInput = false;
    });
    window.addEventListener('blur', () => { keys.left = keys.right = false; GameEngine.steerInput = 0; GameEngine.gasInput = false; GameEngine.brakeInput = false; });
    const bindHoldButton = (id, onDown, onUp) => {
      const el = $id(id);
      const start = (ev) => { ev.preventDefault(); ev.stopPropagation(); el.classList.add('active'); try { el.setPointerCapture(ev.pointerId); } catch (_e) {} onDown(); };
      const end = (ev) => { ev.preventDefault(); el.classList.remove('active'); onUp(); };
      el.addEventListener('pointerdown', start); el.addEventListener('pointerup', end); el.addEventListener('pointerleave', end); el.addEventListener('pointercancel', end);
    };
    bindHoldButton('btn-touch-left', () => { keys.left = true; updateSteer(); }, () => { keys.left = false; updateSteer(); });
    bindHoldButton('btn-touch-right', () => { keys.right = true; updateSteer(); }, () => { keys.right = false; updateSteer(); });
    bindHoldButton('btn-touch-gas', () => { GameEngine.gasInput = true; }, () => { GameEngine.gasInput = false; });
    bindHoldButton('btn-touch-brake', () => { GameEngine.brakeInput = true; }, () => { GameEngine.brakeInput = false; });
    const wheelWrap = $id('virtual-wheel-wrap'), wheelEl = $id('virtual-wheel'); let dragging = false;
    const move = (clientX) => {
      const rect = wheelWrap.getBoundingClientRect();
      const norm = Math.max(-1, Math.min(1, (clientX - (rect.left + rect.width / 2)) / (rect.width * 0.45)));
      GameEngine.steerInput = norm; GameEngine.touchTargetLane = null; wheelEl.style.transform = `rotate(${norm * 65}deg)`;
    };
    wheelWrap.addEventListener('pointerdown', (e) => { dragging = true; wheelWrap.setPointerCapture(e.pointerId); move(e.clientX); });
    wheelWrap.addEventListener('pointermove', (e) => { if (dragging) move(e.clientX); });
    const release = () => { dragging = false; GameEngine.steerInput = 0; wheelEl.style.transform = 'rotate(0deg)'; };
    wheelWrap.addEventListener('pointerup', release); wheelWrap.addEventListener('pointercancel', release);
  },

  /* ------------------- TEACHER DASHBOARD ------------------- */
  initAdminDashboard() {
    const openBtn = $id('btn-open-admin'); if (!openBtn) return;
    openBtn.onclick = () => { this.populateAdminFields(); this.renderAdminQuestionsList(); $id('modal-admin').classList.remove('hidden'); };
    document.querySelectorAll('.admin-tab').forEach((tabBtn) => {
      tabBtn.onclick = () => {
        document.querySelectorAll('.admin-tab').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-pane').forEach((p) => p.classList.add('hidden'));
        tabBtn.classList.add('active'); $id(tabBtn.getAttribute('data-tab')).classList.remove('hidden');
      };
    });
    const qType = $id('q-form-type');
    qType.onchange = () => { const m = qType.value === 'mcq'; $id('wrap-tf-correct').classList.toggle('hidden', m); $id('wrap-mcq-options').classList.toggle('hidden', !m); };
    this.pendingQuestionImageBase64 = '';
    $id('q-form-image').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { this.pendingQuestionImageBase64 = ev.target.result; }; r.readAsDataURL(f); };
    $id('btn-save-question').onclick = () => this.saveQuestionFromForm();
    $id('btn-cancel-edit-q').onclick = () => this.resetQuestionForm();
    $id('cfg-school-logo').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { APP_CONFIG.schoolLogo = ev.target.result; }; r.readAsDataURL(f); };

    const saveAndApply = async (close, thenStart) => {
      const before = this.snapshotConfig();
      before.carHeading = JSON.parse(JSON.stringify(APP_CONFIG.carHeading || {}));
      this.collectAdminFields();
      await StorageManager.save(APP_CONFIG);
      await this.applyConfigChanges(before);
      if (close) $id('modal-admin').classList.add('hidden');
      if (thenStart) { GameEngine.worldDirty = false; GameEngine.startNewRace(); }
    };
    $id('btn-save-all-admin').onclick = () => saveAndApply(true, false);
    $id('btn-preview-student').onclick = () => saveAndApply(true, true);

    $id('btn-export-questions-json').onclick = () => this.triggerDownload(new Blob([JSON.stringify(APP_CONFIG.questions, null, 2)], { type: 'application/json' }), 'champions-questions.json');
    $id('btn-export-questions-csv').onclick = () => {
      const rows = [['text', 'type', 'options', 'correctAnswer', 'subject', 'difficulty', 'hint']];
      const q2 = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      APP_CONFIG.questions.forEach((q) => rows.push([q2(q.text), q.type || 'tf', q2((q.options || ['نعم', 'لا']).join('|')), q2(q.correctAnswer || 'نعم'), q2(q.subject), q2(q.difficulty), q2(q.hint)]));
      this.triggerDownload(new Blob(['﻿' + rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }), 'champions-questions.csv');
    };
    $id('input-import-questions').onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const content = ev.target.result;
          if (file.name.endsWith('.json')) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0) { this.backupQuestionsBeforeImport(); APP_CONFIG.questions = parsed; StorageManager.save(); this.renderAdminQuestionsList(); }
          } else if (file.name.endsWith('.csv')) {
            const lines = content.split(/\r?\n/).filter((l) => l.trim() !== ''); const imported = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = this.parseCsvLine(lines[i]);
              if (cols[0]) imported.push({ id: 'q_' + Date.now() + '_' + i, text: cols[0], type: cols[1] === 'mcq' ? 'mcq' : 'tf', options: cols[2] ? cols[2].split('|') : ['نعم', 'لا'], correctAnswer: cols[3] || 'نعم', subject: cols[4] || 'عام', difficulty: cols[5] || 'متوسط', hint: cols[6] || '', image: '', enabled: true });
            }
            if (imported.length > 0) { this.backupQuestionsBeforeImport(); APP_CONFIG.questions = imported; StorageManager.save(); this.renderAdminQuestionsList(); }
          }
        } catch (err) { alert('تعذر قراءة الملف. تأكد من صحة تنسيق JSON أو CSV.'); }
      };
      reader.readAsText(file);
    };
    $id('btn-reset-defaults').onclick = async () => {
      if (!confirm('سيتم استبدال كل الإعدادات والأسئلة بالقيم الافتراضية. سيُحفظ نسخة احتياطية قبل ذلك. هل تريد المتابعة؟')) return;
      try { localStorage.setItem('ChampionsRace3D_Backup_beforeReset', JSON.stringify(APP_CONFIG)); } catch (e) {}
      APP_CONFIG = createDefaultConfig(); await StorageManager.save(APP_CONFIG);
      this.populateAdminFields(); this.renderAdminQuestionsList(); await GameEngine.rebuildWorld(); this.syncBrandingUI(); this.renderGarageModal();
    };
    $id('btn-export-config').onclick = () => this.triggerDownload(new Blob([JSON.stringify(APP_CONFIG, null, 1)], { type: 'application/json' }), 'champions-config-backup.json');
    $id('btn-restore-backup').onclick = async () => {
      const raw = await StorageManager.readBackup();
      if (!raw) { alert('لا توجد نسخة احتياطية تلقائية على هذا الجهاز (لم تتم ترقية من إصدار سابق هنا).'); return; }
      if (!confirm('سيتم استرجاع إعدادات وأسئلة ما قبل الترقية. المتابعة؟')) return;
      APP_CONFIG = migrateConfig(raw).merged; await StorageManager.save(APP_CONFIG);
      this.populateAdminFields(); this.renderAdminQuestionsList(); await GameEngine.rebuildWorld(); this.syncBrandingUI();
    };
    $id('btn-run-asset-check').onclick = () => this.runAssetCheck();
    $id('btn-export-student-zip').onclick = () => this.exportStudentPackage(true);
    $id('btn-export-zip-main').onclick = () => this.exportStudentPackage(true);
    $id('btn-export-html-single').onclick = () => this.exportStudentPackage(false);
  },

  backupQuestionsBeforeImport() { try { localStorage.setItem('ChampionsRace3D_Backup_questions', JSON.stringify(APP_CONFIG.questions)); } catch (e) {} },

  parseCsvLine(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur.trim()); cur = ''; } else cur += c;
    }
    out.push(cur.trim()); return out;
  },

  fillSelect(id, items) { const el = $id(id); if (!el) return; el.innerHTML = ''; items.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; el.appendChild(o); }); },

  populateAdminFields() {
    $id('cfg-school-name').value = APP_CONFIG.schoolName || ''; $id('cfg-dept-name').value = APP_CONFIG.deptName || '';
    $id('cfg-teacher-name').value = APP_CONFIG.teacherName || ''; $id('cfg-game-title').value = APP_CONFIG.gameTitle || '';
    $id('cfg-game-subtitle').value = APP_CONFIG.gameSubtitle || ''; $id('cfg-victory-msg').value = APP_CONFIG.victoryMsg || '';
    $id('cfg-praise-msgs').value = (APP_CONFIG.praiseMsgs || []).join(' ، '); $id('cfg-retry-msgs').value = (APP_CONFIG.retryMsgs || []).join(' ، ');
    $id('cfg-default-track').value = APP_CONFIG.trackId || 'doha';
    $id('cfg-checkpoint-count').value = APP_CONFIG.checkpointCount || 5; $id('cfg-question-order').value = APP_CONFIG.questionOrder || 'fixed';
    $id('cfg-checkpoint-spacing').value = APP_CONFIG.checkpointSpacing || 260; $id('cfg-max-speed').value = APP_CONFIG.maxSpeed || 220;
    $id('cfg-question-timer').value = APP_CONFIG.questionTimer || 0; $id('cfg-question-scale').value = String(APP_CONFIG.questionScale || 1);
    $id('cfg-ai-enabled').value = String(APP_CONFIG.aiEnabled !== false); $id('cfg-road-difficulty').value = APP_CONFIG.roadDifficulty || 'normal';
    $id('cfg-steering-assist').value = Math.round((Number(APP_CONFIG.steeringAssist) || 0) * 100);
    $id('cfg-starting-score').value = APP_CONFIG.startingScore ?? 1000; $id('cfg-collision-penalty').value = APP_CONFIG.collisionPenalty ?? 100;
    $id('cfg-traffic-penalty').value = APP_CONFIG.trafficPenalty ?? 70; $id('cfg-ai-count').value = APP_CONFIG.aiCount ?? 6;
    this.fillSelect('cfg-car-model', CAR_MODELS.map((m) => [m.id, m.name + (m.brandModel && !APP_CONFIG.carAssets?.[m.id] ? ' (يحتاج رفع GLB)' : '')]));
    $id('cfg-car-model').value = APP_CONFIG.carModel;
    this.fillSelect('cfg-car-color', CAR_COLORS.map((c) => [c.hex, c.name]));
    $id('cfg-car-color').value = CAR_COLORS.some((c) => c.hex === APP_CONFIG.carColor) ? APP_CONFIG.carColor : CAR_COLORS[0].hex;
    $id('cfg-quality').value = APP_CONFIG.graphicsQuality || 'auto'; $id('cfg-classroom').value = String(!!APP_CONFIG.classroomMode);
    $id('cfg-touch-mode').value = APP_CONFIG.touchMode || 'free'; $id('cfg-steer-sens').value = Math.round((APP_CONFIG.steeringSensitivity ?? 1) * 100);
    $id('cfg-auto-accel').value = String(APP_CONFIG.autoAccel !== false); $id('cfg-camera').value = APP_CONFIG.cameraDefault || 'chase';
    $id('cfg-sound').value = String(APP_CONFIG.soundOn !== false);
    const st = $id('storage-status-txt'); if (st) st.textContent = StorageManager.db ? 'الإعدادات والصور تُحفظ تلقائيًا في IndexedDB على هذا الجهاز.' : 'IndexedDB غير متاح هنا؛ تُستخدم نسخة احتياطية في localStorage.';
  },

  collectAdminFields() {
    const val = (id) => $id(id).value;
    APP_CONFIG.schoolName = val('cfg-school-name').trim() || APP_CONFIG.schoolName; APP_CONFIG.deptName = val('cfg-dept-name').trim() || APP_CONFIG.deptName;
    APP_CONFIG.teacherName = val('cfg-teacher-name').trim() || APP_CONFIG.teacherName; APP_CONFIG.gameTitle = val('cfg-game-title').trim() || APP_CONFIG.gameTitle;
    APP_CONFIG.gameSubtitle = val('cfg-game-subtitle').trim() || APP_CONFIG.gameSubtitle; APP_CONFIG.victoryMsg = val('cfg-victory-msg').trim() || APP_CONFIG.victoryMsg;
    const split = (s) => s.split(/[،,]/).map((x) => x.trim()).filter(Boolean);
    const praises = split(val('cfg-praise-msgs')); if (praises.length) APP_CONFIG.praiseMsgs = praises;
    const retries = split(val('cfg-retry-msgs')); if (retries.length) APP_CONFIG.retryMsgs = retries;
    APP_CONFIG.trackId = val('cfg-default-track');
    APP_CONFIG.checkpointCount = Math.max(1, Math.min(30, parseInt(val('cfg-checkpoint-count'), 10) || 5));
    APP_CONFIG.questionOrder = val('cfg-question-order');
    APP_CONFIG.checkpointSpacing = Math.max(180, Math.min(700, parseInt(val('cfg-checkpoint-spacing'), 10) || 260));
    APP_CONFIG.maxSpeed = Math.max(120, Math.min(320, parseInt(val('cfg-max-speed'), 10) || 220));
    APP_CONFIG.questionTimer = Math.max(0, parseInt(val('cfg-question-timer'), 10) || 0);
    APP_CONFIG.questionScale = parseFloat(val('cfg-question-scale')) || 1;
    APP_CONFIG.aiEnabled = val('cfg-ai-enabled') === 'true';
    APP_CONFIG.roadDifficulty = val('cfg-road-difficulty'); APP_CONFIG.steeringAssist = Number(val('cfg-steering-assist')) / 100;
    APP_CONFIG.startingScore = Math.max(100, Number(val('cfg-starting-score')) || 1000);
    APP_CONFIG.collisionPenalty = Math.max(0, Number(val('cfg-collision-penalty')) || 0);
    APP_CONFIG.trafficPenalty = Math.max(0, Number(val('cfg-traffic-penalty')) || 0);
    APP_CONFIG.aiCount = Math.max(1, Math.min(8, Number(val('cfg-ai-count')) || 6));
    const chosen = CAR_MODELS.find((m) => m.id === val('cfg-car-model'));
    if (chosen && !(chosen.brandModel && !APP_CONFIG.carAssets?.[chosen.id]) && !(chosen.id === 'custom_glb' && !APP_CONFIG.customCarData)) APP_CONFIG.carModel = chosen.id;
    APP_CONFIG.carColor = val('cfg-car-color'); APP_CONFIG.graphicsQuality = val('cfg-quality'); APP_CONFIG.classroomMode = val('cfg-classroom') === 'true';
    APP_CONFIG.touchMode = val('cfg-touch-mode'); APP_CONFIG.steeringSensitivity = Math.max(0.5, Math.min(1.6, Number(val('cfg-steer-sens')) / 100 || 1));
    APP_CONFIG.autoAccel = val('cfg-auto-accel') === 'true'; APP_CONFIG.cameraDefault = val('cfg-camera'); APP_CONFIG.soundOn = val('cfg-sound') === 'true';
    this.syncSettingsModal();
  },

  syncSettingsModal() {
    const set = (id, v) => { const e = $id(id); if (e) e.value = v; };
    set('sel-graphics-quality', APP_CONFIG.graphicsQuality); set('sel-touch-mode', APP_CONFIG.touchMode); set('sel-camera-default', APP_CONFIG.cameraDefault);
    set('sel-classroom-mode', String(!!APP_CONFIG.classroomMode)); set('rng-steer-sens', Math.round(APP_CONFIG.steeringSensitivity * 100));
    const l = $id('val-steer-sens'); if (l) l.textContent = Math.round(APP_CONFIG.steeringSensitivity * 100) + '%';
  },

  renderAdminQuestionsList() {
    const listEl = $id('admin-questions-list'); $id('admin-q-count').textContent = APP_CONFIG.questions.length; listEl.innerHTML = '';
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    APP_CONFIG.questions.forEach((q, idx) => {
      const row = document.createElement('div'); row.className = 'q-list-item';
      row.innerHTML = `
        <div style="flex:1; min-width:220px;">
          <div style="font-weight:800; color:#fff; font-size:0.98rem;">${idx + 1}. ${esc(q.text)}</div>
          <div style="font-size:0.8rem; color:#94a3b8; margin-top:4px;">النوع: <strong style="color:#fbbf24;">${q.type === 'mcq' ? 'اختيار من متعدد' : 'نعم / لا'}</strong> | الإجابة الصحيحة: <strong style="color:#34d399;">${esc(q.correctAnswer)}</strong> | المادة: ${esc(q.subject || 'عام')}</div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn-glass" style="padding:6px 10px; font-size:0.8rem;" data-act="toggle" data-idx="${idx}">${q.enabled !== false ? '🟢 مفعل' : '⚪ معطل'}</button>
          <button class="btn btn-glass" style="padding:6px 10px; font-size:0.8rem;" data-act="up" data-idx="${idx}">⬆️</button>
          <button class="btn btn-glass" style="padding:6px 10px; font-size:0.8rem;" data-act="down" data-idx="${idx}">⬇️</button>
          <button class="btn btn-glass" style="padding:6px 10px; font-size:0.8rem;" data-act="dup" data-idx="${idx}">📋 نسخ</button>
          <button class="btn btn-blue" style="padding:6px 12px; font-size:0.8rem;" data-act="edit" data-idx="${idx}">✏️ تعديل</button>
          <button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem;" data-act="del" data-idx="${idx}">🗑️ حذف</button>
        </div>`;
      listEl.appendChild(row);
    });
    listEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10), act = btn.getAttribute('data-act'), q = APP_CONFIG.questions[idx];
        if (act === 'toggle') q.enabled = q.enabled === false;
        else if (act === 'up' && idx > 0) [APP_CONFIG.questions[idx - 1], APP_CONFIG.questions[idx]] = [APP_CONFIG.questions[idx], APP_CONFIG.questions[idx - 1]];
        else if (act === 'down' && idx < APP_CONFIG.questions.length - 1) [APP_CONFIG.questions[idx + 1], APP_CONFIG.questions[idx]] = [APP_CONFIG.questions[idx], APP_CONFIG.questions[idx + 1]];
        else if (act === 'dup') { const c = JSON.parse(JSON.stringify(q)); c.id = 'q_' + Date.now(); APP_CONFIG.questions.splice(idx + 1, 0, c); }
        else if (act === 'del') { if (APP_CONFIG.questions.length > 1) APP_CONFIG.questions.splice(idx, 1); }
        else if (act === 'edit') { this.loadQuestionIntoForm(q); return; }
        StorageManager.save(); this.renderAdminQuestionsList();
      };
    });
  },

  loadQuestionIntoForm(q) {
    $id('form-q-heading').textContent = '✏️ تعديل السؤال المحدد'; $id('edit-q-id').value = q.id; $id('q-form-text').value = q.text;
    $id('q-form-type').value = q.type || 'tf'; $id('q-form-subject').value = q.subject || 'العلوم العامة'; $id('q-form-diff').value = q.difficulty || 'سهل';
    $id('q-form-hint').value = q.hint || ''; this.pendingQuestionImageBase64 = q.image || '';
    const isMCQ = q.type === 'mcq'; $id('wrap-tf-correct').classList.toggle('hidden', isMCQ); $id('wrap-mcq-options').classList.toggle('hidden', !isMCQ);
    if (isMCQ) { for (let i = 0; i < 4; i++) $id(`q-opt-${i}`).value = (q.options && q.options[i]) || ''; $id('q-form-mcq-correct').value = String(Math.max(0, (q.options || []).indexOf(q.correctAnswer))); }
    else $id('q-form-tf-answer').value = q.correctAnswer === 'لا' ? 'لا' : 'نعم';
    $id('btn-cancel-edit-q').classList.remove('hidden');
  },

  resetQuestionForm() {
    $id('form-q-heading').textContent = '➕ إضافة سؤال تعليمي جديد'; $id('edit-q-id').value = ''; $id('q-form-text').value = ''; $id('q-form-hint').value = '';
    $id('q-form-image').value = ''; this.pendingQuestionImageBase64 = ''; $id('btn-cancel-edit-q').classList.add('hidden');
  },

  saveQuestionFromForm() {
    const text = $id('q-form-text').value.trim(); if (!text) return;
    const type = $id('q-form-type').value; let options = ['نعم', 'لا']; let correctAnswer = $id('q-form-tf-answer').value;
    if (type === 'mcq') {
      options = [$id('q-opt-0').value.trim() || 'الخيار 1', $id('q-opt-1').value.trim() || 'الخيار 2', $id('q-opt-2').value.trim() || 'الخيار 3'];
      const o3 = $id('q-opt-3').value.trim(); if (o3) options.push(o3);
      correctAnswer = options[Math.min(parseInt($id('q-form-mcq-correct').value, 10) || 0, options.length - 1)];
    }
    const editId = $id('edit-q-id').value;
    const payload = { id: editId || 'q_' + Date.now(), text, type, options, correctAnswer, subject: $id('q-form-subject').value.trim() || 'عام', difficulty: $id('q-form-diff').value, hint: $id('q-form-hint').value.trim(), image: this.pendingQuestionImageBase64 || '', enabled: true };
    if (editId) { const i = APP_CONFIG.questions.findIndex((q) => q.id === editId); if (i !== -1) APP_CONFIG.questions[i] = payload; } else APP_CONFIG.questions.push(payload);
    StorageManager.save(); this.resetQuestionForm(); this.renderAdminQuestionsList();
  },

  /* ------------------- asset / offline validation ------------------- */
  async runAssetCheck() {
    const box = $id('asset-check-result'); const rows = [];
    const ok = (t) => rows.push('✅ ' + t), bad = (t) => rows.push('❌ ' + t), warn = (t) => rows.push('⚠️ ' + t);
    box.textContent = '⏳ جارٍ الفحص…';
    try {
      ok(`Three.js r${THREE.REVISION} (محلي)`);
      typeof THREE.GLTFLoader === 'function' ? ok('GLTFLoader') : bad('GLTFLoader مفقود');
      typeof THREE.DRACOLoader === 'function' ? ok('DRACOLoader') : warn('DRACOLoader مفقود');
      typeof JSZip !== 'undefined' ? ok('JSZip (تصدير ZIP)') : bad('JSZip مفقود');
      try { await document.fonts.ready; document.fonts.check('700 16px Cairo') ? ok('خط Cairo مضمّن ومحمّل') : warn('خط Cairo غير محمّل'); } catch (e) { warn('تعذّر فحص الخطوط'); }
      for (const [id, def] of Object.entries(CAR_DEFS)) {
        const name = CAR_MODELS.find((m) => m.id === id)?.name || id;
        if (!AssetStore.has(def.hi) || !AssetStore.has(def.lod)) { bad(`${name}: ملف النموذج غير موجود`); continue; }
        try {
          const rig = await CarLibrary.build(id, '#dc2626', { lod: false, isPlayer: false });
          rig.root.rotation.order = 'YXZ'; const v = GameEngine.verifyOrientation(rig); const h = rig.headingInfo;
          (v.ok ? ok : bad)(`${name}: الاتجاه ${h.used} (${h.method}) — المصابيح الخلفية ${v.tailForwardDot} / الأمامية ${v.headForwardDot} • عجلات ${h.wheelCount} • ${(rig.dims.length).toFixed(2)}م`);
          rig.dispose();
        } catch (e) { bad(`${name}: ${e.message || e}`); }
      }
      const ext = performance.getEntriesByType('resource').filter((e) => /^https?:/i.test(e.name) && (location.protocol === 'file:' || new URL(e.name).host !== location.host));
      ext.length === 0 ? ok('لا توجد أي طلبات شبكة خارجية منذ فتح الصفحة') : bad('طلبات خارجية: ' + ext.map((e) => e.name).slice(0, 5).join(' , '));
      ok(`وحدة الرسم: ${GameEngine.gpuName} • الجودة الفعلية: ${GameEngine.preset}`);
      ok(`التخزين: ${StorageManager.db ? 'IndexedDB' : 'localStorage (بديل)'}`);
    } catch (e) { bad('تعذّر إكمال الفحص: ' + (e.message || e)); }
    box.innerHTML = rows.map((r) => `<div>${r.replace(/</g, '&lt;')}</div>`).join('');
  },

  /* ------------------- STUDENT EXPORT: fully independent, offline, no admin panel ------------------- */
  async buildStudentHtml() {
    // only read the form when the dashboard is actually open; otherwise APP_CONFIG is already the saved truth (empty fields must never zero it)
    if (!$id('modal-admin').classList.contains('hidden')) this.collectAdminFields();
    await StorageManager.save(APP_CONFIG);
    const pristine = window.__PRISTINE_BODY__; if (!pristine) throw new Error('تعذّر الحصول على قالب الصفحة الأصلي');
    const doc = new DOMParser().parseFromString('<!DOCTYPE html><html><body>' + pristine + '</body></html>', 'text/html');
    ['btn-open-admin', 'modal-admin'].forEach((id) => { const e = doc.getElementById(id); if (e) e.remove(); });
    const styleText = $id('app-style')?.textContent || '';
    const metas = [...document.head.querySelectorAll('meta')].map((m) => m.outerHTML).join('\n');
    const cfg = JSON.stringify(APP_CONFIG).replace(/</g, '\\u003c');
    const parts = [];
    for (const s of document.querySelectorAll('script[data-pack]')) {
      let text = s.textContent;
      if (s.getAttribute('src')) {
        try { const r = await fetch(s.getAttribute('src')); if (!r.ok) throw new Error(r.status); text = await r.text(); }
        catch (e) { throw new Error('هذه النسخة متعددة الملفات ولا يمكنها قراءة ملفاتها من file:// — افتحها عبر خادم محلي/استضافة أو استخدم نسخة الملف الواحد للتصدير.'); }
      }
      const attrs = [s.id ? `id="${s.id}"` : '', s.type ? `type="${s.type}"` : '', 'data-pack="1"'].filter(Boolean).join(' ');
      parts.push(`<script ${attrs}>${text}<\/script>`);
    }
    return '<!DOCTYPE html>\n<html lang="ar" dir="rtl"><head>' + metas + `\n<title>${(APP_CONFIG.gameTitle || '').replace(/</g, '&lt;')}</title>\n<link rel="manifest" href="manifest.json">\n<style id="app-style">${styleText}</style></head><body>\n` +
      doc.body.innerHTML + `\n<script>window.__STUDENT_ONLY_BUILD__=true;window.__EXPORTED_CONFIG__=${cfg};<\/script>\n` + parts.join('\n') + '\n</body></html>';
  },

  async exportStudentPackage(asZip = true) {
    try {
      this.showStatus('⏳ جارٍ تجهيز نسخة الطلاب…', 8000);
      let html = await this.buildStudentHtml();
      if (!asZip || typeof JSZip === 'undefined') {
        html = html.replace('<link rel="manifest" href="manifest.json">\n', '');
        this.triggerDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), 'champions-race-student.html'); this.showStatus('✅ تم تنزيل ملف الطلاب المستقل (HTML واحد يعمل بدون إنترنت)'); return;
      }
      const zip = new JSZip();
      zip.file('index.html', html);
      zip.file('manifest.json', JSON.stringify({ name: APP_CONFIG.gameTitle, short_name: 'سباق الأبطال 3D', description: APP_CONFIG.gameSubtitle, start_url: './index.html', display: 'fullscreen', orientation: 'any', background_color: '#070b14', theme_color: '#ef4444' }, null, 2));
      zip.file('README.md', this.studentReadme());
      const credits = $id('credits-text'); if (credits) zip.file('CREDITS_AND_LICENSES.txt', credits.textContent.trim());
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      this.triggerDownload(blob, 'champions-race-3d-student-package.zip'); this.showStatus('✅ تم تنزيل حزمة الطلاب (ZIP) — ملف index.html واحد يعمل بدون إنترنت');
    } catch (err) { console.error(err); this.showStatus('⚠️ تعذّر التصدير: ' + (err.message || err), 9000); alert('تعذّر تصدير نسخة الطلاب: ' + (err.message || err)); }
  },

  studentReadme() {
    return `# ${APP_CONFIG.gameTitle} — نسخة الطلاب المستقلة
المدرسة: ${APP_CONFIG.schoolName}
القسم: ${APP_CONFIG.deptName}
إشراف: ${APP_CONFIG.teacherName}

## محتويات الحزمة
- \`index.html\`: اللعبة كاملة في ملف واحد (المحرك، السيارات ثلاثية الأبعاد، الخطوط، الأسئلة، الشعار والإعدادات). لا تحتوي على لوحة المعلم ولا تطلب أي موارد من الإنترنت.
- \`manifest.json\`: ملف اختياري لتثبيت اللعبة كتطبيق ويب عند استضافتها عبر HTTPS.
- \`CREDITS_AND_LICENSES.txt\`: اعتمادات الأصول والتراخيص.

## التشغيل بدون إنترنت
- **Windows / Mac / Linux**: انقر نقرًا مزدوجًا على \`index.html\` لفتحه في Chrome أو Edge أو Firefox أو Safari. تم اختبار هذا السيناريو آليًا في Chromium مع حجب الشبكة بالكامل.
- **Android**: انسخ الملف إلى الجهاز وافتحه عبر Chrome. (لم يُختبر على جهاز Android فعلي.)
- **iPhone / iPad**: لم يُختبر على جهاز فعلي. يضع iOS قيودًا على فتح ملفات HTML المحلية؛ الحل الموثوق هو رفع الملف إلى استضافة HTTPS (GitHub Pages / Netlify / Vercel / خادم المدرسة) ثم فتح الرابط في Safari وإضافته إلى الشاشة الرئيسية، أو تغليفه في تطبيق WebView (مثل Capacitor). لا نؤكد عمل \`file://\` على iOS.
- **السبورات الذكية**: افتح الملف في Chrome/Edge على جهاز السبورة. فعّل «وضع أداء الفصل» من الإعدادات إن كان الجهاز ضعيفًا.

## ملاحظات
- المدن بيئات افتراضية مستوحاة من طابعها العمراني وليست نسخًا مطابقة لخرائط حقيقية.
- نماذج السيارات المضمّنة: Ferrari 458 Italia (CC BY 4.0) وسيارة GT كونسبت (CC BY 4.0). لا تتوفر نماذج مرخّصة داخل الحزمة لماركات Porsche / BMW / Mercedes / Lamborghini / Nissan.
- تفضيلات الصوت والجودة وأسلوب اللمس يحفظها المتصفح على جهاز الطالب فقط؛ الأسئلة والهوية مثبّتة في الملف.
`;
  },

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
  }
};

/* ===== 90-boot ===== */
/* ----------------------- BOOTSTRAP (100% local: no CDN, no remote fonts/models/sounds) ----------------------- */
function raceWebGLSupported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
function getRaceSplash() {
  let e = document.getElementById('race-startup-status');
  if (!e) {
    e = document.createElement('section'); e.id = 'race-startup-status'; e.dir = 'rtl';
    e.setAttribute('role', 'status'); e.setAttribute('aria-live', 'polite');
    e.style.cssText = 'position:fixed;inset:0;z-index:900;display:flex;justify-content:center;align-items:center;padding:18px;background:#070e20;color:#eaf4ff;text-align:center;font-family:Cairo,system-ui,sans-serif;overflow:auto';
    e.innerHTML = '<div style="max-width:560px;width:100%;padding:20px;border:1px solid #30405d;background:#101b31;border-radius:22px"><div style="font-size:38px">🏎️</div><div style="font-size:clamp(19px,5vw,27px);font-weight:900">سباق الأبطال ثلاثي الأبعاد</div><div id="race-startup-message" style="font-size:clamp(13px,3.7vw,17px);line-height:1.8;margin:18px 0">جاري تجهيز محرك السباق...</div><div id="race-startup-extra" style="font-size:13px;color:#cbd5e1;line-height:1.9"></div></div>';
    document.body.appendChild(e);
  }
  return e;
}
function raceStartupMessage(m) { getRaceSplash().querySelector('#race-startup-message').textContent = m; }
function raceShowFatal(error) {
  console.error('Champions Race startup error', error);
  const overlay = getRaceSplash(); overlay.style.zIndex = '1000';
  overlay.querySelector('#race-startup-message').textContent = 'تعذّر تشغيل السباق: ' + (error && error.message ? error.message : 'مشكلة غير معروفة');
  const extra = overlay.querySelector('#race-startup-extra'); extra.replaceChildren();
  const note = document.createElement('p');
  note.textContent = location.protocol === 'file:'
    ? 'تأكد من تفعيل JavaScript وWebGL في المتصفح، وأعد التحميل. على iPhone/iPad قد يقيّد النظام فتح ملفات HTML المحلية؛ استضف الملف على HTTPS أو غلّفه بتطبيق WebView.'
    : 'تأكد من تفعيل JavaScript وWebGL في المتصفح ثم أعد تحميل الصفحة. جرّب متصفحًا آخر إن استمرت المشكلة.';
  extra.appendChild(note);
  const retry = document.createElement('button'); retry.textContent = '🔄 إعادة المحاولة';
  retry.style.cssText = 'margin:12px 4px;background:#ea4343;color:white;border:0;border-radius:12px;padding:12px 20px;font:700 16px Cairo,Tahoma,sans-serif;cursor:pointer';
  retry.onclick = () => location.reload(); extra.appendChild(retry);
}
window.addEventListener('DOMContentLoaded', async () => {
  // keep an untouched copy of the markup: the student export is rebuilt from it (never from the mutated DOM)
  const root = document.getElementById('app-root'); window.__PRISTINE_BODY__ = root ? root.outerHTML : '';
  getRaceSplash();
  try {
    if (!(window.THREE && THREE.WebGLRenderer)) throw new Error('مكتبة Three.js غير موجودة داخل الحزمة');
    if (window.RaceSchoolBridge?.enabled) await window.RaceSchoolBridge.awaitPlatformConfiguration();
    await StorageManager.init();
    if (!raceWebGLSupported()) throw new Error('هذا المتصفح لا يدعم WebGL. جرّب Chrome أو Edge أو Safari حديثًا.');
    try { await Promise.race([Promise.all([document.fonts.load('700 24px Cairo', 'أبجد'), document.fonts.load('800 24px Cairo', 'abc')]), new Promise((r) => setTimeout(r, 4000))]); } catch (e) {}
    raceStartupMessage('جاري تجهيز الطريق والسيارة...');
    const worldReady = GameEngine.init();
    UIController.init();
    getRaceSplash().remove();
    await worldReady;
    window.__GAME_READY__ = true;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  } catch (error) { raceShowFatal(error); }
});
window.__game = { GameEngine, UIController, RoadPath, World, APP_CONFIG: () => APP_CONFIG, StorageManager, CarLibrary };
