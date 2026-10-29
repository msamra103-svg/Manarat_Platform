# نتائج الاختبارات الآلية — عدّاء قطر

التاريخ: 2026-10-29T03:03:32.546Z · البيئة: Chromium (Playwright) + SwiftShader WebGL, headless

**النتيجة: 16 / 16 ناجح**

| # | الاختبار | النتيجة | التفاصيل | الزمن |
|---|---|---|---|---|
| 1 | 01 boot: menu reached, Arabic RTL, Tajawal font, no runtime errors, no network | ✅ ناجح | dir=rtl, fonts ok, 18 local files | 0.0 ث |
| 2 | 02 three lanes: smooth lane switching, exactly three lanes | ✅ ناجح | lane change 0.37 s, max step 0.235 m/frame | 1.6 ث |
| 3 | 03 jump: consistent height and duration, landing detected, no double-jump | ✅ ناجح | peak 1.28 m, airtime 0.68 s, second press mid-air ignored (peak 1.28 m) | 1.2 ث |
| 4 | 04 slide: fixed duration, returns to running | ✅ ناجح | slide 0.83 s | 0.5 ث |
| 5 | 05 collisions: hit when ignoring a hazard, clear when jumping / sliding / dodging; no getting stuck | ✅ ناجح | {"jerseyIgnore":1,"jerseyJump":0,"hurdleJump":0,"coneJump":0,"beamIgnore":1,"beamSlide":0,"carDodge":0,"carFront":1,"laneAfterBump":0,"speedAfter":6.300000000000006,"stuckFrames":0} | 9.4 ث |
| 6 | 06 fair generation: every row keeps a reachable passable lane (3 difficulties × 6 km), no hazards near gates | ✅ ناجح | {"easy":{"rows":224,"bad":0,"minGap":14.5,"blockedHits":0},"normal":{"rows":279,"bad":0,"minGap":12.9,"blockedHits":0},"hard":{"rows":330,"bad":0,"minGap":12.8,"blockedHits":0}} | 0.5 ث |
| 7 | 07 question gate: stop before gate → question; wrong = recoil + exactly one heart; retry; correct opens; no repeats | ✅ ناجح | {"recoil_m":6.52,"phases":"evaluate→reject→recover→retry→approach→question","results":"0✗ 0✓ 1✓"} | 15.0 ث |
| 8 | 08 input protection: repeated answer clicks evaluate once; a closed gate cannot be crossed | ✅ ناجح | {"evals":1,"d":1205.1,"limit":1205.1} | 16.2 ث |
| 9 | 09 answer randomisation: correct answer spread over all positions (2/3/4 answers) | ✅ ناجح | {"2":[3063,2937],"3":[2031,2059,1910],"4":[1507,1513,1497,1483]} | 0.2 ث |
| 10 | 10 sounds fire at the right moments (wrong → wave → recoil; correct → success → gate opens) | ✅ ناجح | gate-appear → jump → jump-start → land → slide → hit:soft → question-open → select → wrong → wave → recoil → question-open → select → success | 7.6 ث |
| 11 | 11 character lock + cloth + knees + planted feet + no jitter | ✅ ناجح | {"meshes":37,"plantedFeet":"45/52","hipJerk":0.0015} | 2.0 ث |
| 12 | 12 restart from pause, question timer timeout, game over → retry from gate | ✅ ناجح | pause→restart, 15 s timer, game over → retry gate | 14.1 ث |
| 13 | 13 performance counters (low quality, headless) | ✅ ناجح | {"stepMs":3.86,"calls":153,"triangles":222832} | 45.4 ث |
| 14 | 14 teacher: new lesson replaces sample data; correct-answer selector; image upload; settings persist | ✅ ناجح | saved 2 questions, image, 2 hearts, Souq route | 7.9 ث |
| 15 | 15 phone portrait: swipe controls (left / right / up / down) and on-screen buttons | ✅ ناجح | swipes + buttons ok | 1.7 ث |
| 16 | 16 offline single file: runs from file:// with all network blocked; student export hides the teacher panel | ✅ ناجح | offline OK, export 4.44 MB | 17.0 ث |

## اختبار الدمج الحقيقي مع منصة المدرسة (بعد تحديث الواقعية)

نُفّذ على نسخة محلية من `msamra103-svg/Manarat_Platform` (الإيداع `dfe6450`) بالكود الحقيقي لـ `js/school.js` ومحاكاة `school-api` (`tests/qatar-runner-integration.cjs`):

| # | الفحص | النتيجة |
|---|---|---|
| 1 | مصافحة config: رمز الجلسة، سؤالان، اسم المدرسة والطالب، إخفاء لوحة المعلم | ✅ ناجح |
| 2 | التوقف قبل البوابة وعرض سؤال المنصة في نافذتها (اللعبة لا ترى مفتاح الإجابة) | ✅ ناجح |
| 3 | تجاهل الرسائل المزورة (رمز خاطئ، لعبة أخرى، أصل خارجي، مصدر غير الأب، رقم سؤال خاطئ) | ✅ ناجح |
| 4 | إجابة صحيحة ← تصحيح الخادم ← فتح البوابة ← next/advance | ✅ ناجح |
| 5 | سؤال مقالي قيد التصحيح ← نتيجة محايدة دون خصم قلب | ✅ ناجح |
| 6 | قوس النهاية ← نتائج اللعبة ← تقرير المنصة، وتسجيل finish مرة واحدة | ✅ ناجح |
| 7 | مسار التجربة `?demo=qatar-runner`: خطأ ← ارتداد ← فتح البوابة للسؤال التالي | ✅ ناجح |

فحص `smoke-check` في المنصة يُظهر اختلافات في ملفات كرة القدم فقط، وهي موجودة في الفرع main قبل هذا العمل (انظر `docs/INTEGRATION.md`).

## فحوص بصرية لهذا التحديث

- اتجاه السير: السيارات في الاتجاه المعاكس تتقدّم نحو اللاعب ومقدّمتها ومصابيحها الأمامية للأمام، والسيارات المتوقفة في مسار اللاعب تواجه اتجاه سيرها (سير على اليمين كما في قطر). تحقّق آلي من مواضع السيارات عبر عدة إطارات + لقطات.
- لقطات المقارنة الجديدة في `screenshots/`.

## ما لم يُختبر بعد (يحتاج أجهزة حقيقية)

- معدل الإطارات الفعلي على iPad / iPhone / Android / حواسيب المدرسة / السبورة الذكية (الاختبارات تمت بـ WebGL برمجي على المعالج). الخامات الجديدة رفعت حجم النسخة دون إنترنت إلى ‎4.4‎ م.ب تقريبًا.
- الصوت مسموعًا عبر سماعات حقيقية، وSafari على iOS تحديدًا.
- نشر دالة `school-api` وتجربة حساب معلم وطالب حقيقيين.
