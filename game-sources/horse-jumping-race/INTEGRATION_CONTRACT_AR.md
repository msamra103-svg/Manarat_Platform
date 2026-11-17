# عقد الربط — سباق الخيل — قفز الحواجز (`horse-jumping-race`)

> ## ⚠️ حالة هذا العقد: **مقترح** (`qcr-bridge/1`)
> لم يُرفق مع الطلب عقد ربط المنصة المعتمد (`INTEGRATION_CONTRACT_AR.md` الخاص بالمنصة)، لذلك:
> - كل أسماء الرسائل والحقول أدناه **مقترحة** ولم تُفترض موجودة في المنصة.
> - عند الدمج تُطابق مع عقد المنصة بتعديل ملف واحد: `src/integration/postMessageBridge.js` (ومحاكي الاختبار `simulator/host.js`).
> - محرك السباق والواجهة لا يعرفان إلا الواجهة البرمجية المجردة أدناه (§٢)، فلا يتأثران بتغيير أسماء الرسائل.

---

## ١. المبادئ
1. **التصحيح وحفظ الدرجات في المنصة** في وضع الربط. اللعبة لا تملك مفتاح الإجابات ولا تستنتج الصحة.
2. **لا رجوع للتصحيح التجريبي** عند تعطل الربط. اللعبة تعرض خطأ اتصال مع «إعادة المحاولة»، ولا تحتسب السؤال خطأ.
3. **منع التكرار**: كل إجابة تحمل `attemptId` ثابتًا يُعاد إرساله كما هو عند إعادة المحاولة؛ والنتيجة النهائية تحمل `resultId` ثابتًا. على المنصة تجاهل المكرر وإعادة الرد السابق نفسه.
4. **«بانتظار التصحيح»** ليست صحيحة ولا خاطئة: يبقى السباق متجمدًا مع رسالة انتظار حتى تصل نتيجة نهائية.
5. اللعبة لا تنشئ جداول ولا تعدّل الدرجات أو تسجيل الدخول، ولا تحتاج مفاتيح سرية.
6. معرّف اللعبة الثابت: `horse-jumping-race`. اسم العرض: «سباق الخيل — قفز الحواجز».

---

## ٢. الواجهة البرمجية المجردة داخل اللعبة (ثابتة)
أي جسر (محلي أو منصة) يطبق:

| الدالة | الوصف |
|---|---|
| `init() → { sessionId, mode, player, settings, questions? }` | استقبال إعدادات الجلسة واللاعب/الفريق |
| `getQuestions() → Question[]` | الأسئلة **بدون** مفتاح الإجابة |
| `submitAnswer({questionId, choiceId, attemptId, timedOut, questionIndex}) → Grade` | إرسال الإجابة؛ يعيد `graded` أو `pending` أو يرمي خطأ قابلًا لإعادة المحاولة |
| `onGrade(cb)` | نتيجة لاحقة بعد `pending` |
| `reportProgress(progress)` | حالة التقدم (غير حرجة) |
| `reportResult(result) → ack` | النتيجة النهائية (قابلة لإعادة المحاولة دون تكرار) |
| `onControl(cb)` | أوامر: `pause` · `resume` · `restart` · `end` |
| `requestExit()` | «العودة» إلى المنصة |

الملفات: `src/integration/localSimulatorBridge.js` (الوضع التجريبي المستقل) و`src/integration/postMessageBridge.js` (المنصة) و`src/integration/schema.js` (التحقق).

---

## ٣. النقل المقترح: `window.postMessage` (اللعبة داخل iframe)

### الأمان
- اللعبة تقبل الرسائل فقط إذا كان `event.origin` ضمن `integration.allowedOrigins` (في `game.config.js`)، وإلا فالمصدر نفسه فقط افتراضيًا، **و**`event.source === window.parent`.
- مصدر المنصة **لا يُقبل من معاملات الرابط** (حتى لا يمكن لصفحة أخرى انتحاله).
- تُرسل اللعبة دائمًا إلى `targetOrigin` محدد (لا تستخدم `'*'`).
- كل رسالة يُتحقق من بنيتها: `protocol` و`type` نصيان، `payload` كائن، و`sessionId` مطابق بعد بدء الجلسة.
- الأسئلة تُطبّع ويُتجاهل أي حقل مفتاح إجابة يُرسل خطأً، وروابط الوسائط تقبل `https://` أو مسارات نسبية فقط.

### الغلاف (Envelope)
```json
{ "protocol": "qcr-bridge/1", "gameId": "horse-jumping-race", "type": "…",
  "sessionId": "…", "requestId": "…", "payload": { }, "sentAt": 1731400000000 }
```

### من اللعبة إلى المنصة
| النوع | requestId | الحمولة |
|---|---|---|
| `game:ready` | — | `{ gameId, version, capabilities: ['mcq','tf','pendingGrade','control','classroom'] }` |
| `game:requestQuestions` | معرّف طلب | `{}` (فقط إن لم ترسل المنصة الأسئلة مع `platform:init`) |
| `game:submitAnswer` | **= attemptId** | `{ questionId, choiceId, attemptId, timedOut, questionIndex }` — `choiceId` قد يكون `null` عند انتهاء المؤقت الاختياري |
| `game:progress` | — | `{ state, stage, totalStages, rank, correctCount, points, paused? }` |
| `game:result` | **= resultId** | انظر §٤ |
| `game:exit` | — | `{}` |

### من المنصة إلى اللعبة
| النوع | requestId | الحمولة |
|---|---|---|
| `platform:init` | — | `{ sessionId, mode: 'solo'|'classroom', player: { name?, teamName?, students?[] }, settings: { difficulty?, segmentSeconds?, answerTimerSeconds? }, questions?: Question[] }` |
| `platform:questions` | نفس طلب اللعبة | `{ questions: Question[] }` |
| `platform:grade` | نفس `attemptId` | `{ status: 'graded', correct: bool, points: number, correctChoiceId?, explanation? }` أو `{ status: 'pending' }` |
| `platform:grade` (لاحق) | أي قيمة | `{ status: 'graded', attemptId, questionId, correct, points, … }` — يصل بعد `pending` |
| `platform:ack` | نفس `resultId` | `{ status: 'saved' | 'duplicate' }` |
| `platform:error` | نفس الطلب | `{ code, message, retryable: bool }` |
| `platform:control` | — | `{ command: 'pause'|'resume'|'restart'|'end' }` |

### المهلات (قابلة للضبط في `game.config.js`)
- المصافحة `handshakeTimeoutMs` = ١٠ ث: إن لم يصل `platform:init` تظهر رسالة «تعذر الاتصال بالمنصة» مع إعادة المحاولة.
- التصحيح/الحفظ `gradeTimeoutMs` = ١٢ ث: بعدها «تعذر إرسال الإجابة» + «إعادة المحاولة» (بنفس `attemptId`).

---

## ٤. البيانات

### Question (من المنصة)
```json
{ "id": "q-17", "type": "mcq", "subject": "العلوم", "text": "…",
  "choices": [ { "id": "c1", "text": "…" }, { "id": "c2", "text": "…" } ],
  "media": { "image": "https://…/img.png", "alt": "…" }, "points": 10 }
```
- `type`: `mcq` أو `tf` (للصواب والخطأ تُستخدم المعرفات `true`/`false` إن لم تُرسل اختيارات).
- عدد المراحل = عدد الأسئلة المستلمة (بحد أقصى `questions.maxQuestions`)، ولا يُكرر أي سؤال.

### Result (`game:result`)
```json
{ "resultId": "result-…", "gameId": "horse-jumping-race", "gameTitle": "سباق الخيل — قفز الحواجز", "version": "1.0.0",
  "sessionId": "…", "mode": "solo", "name": "…",
  "rank": 1, "tied": false, "racers": 6,
  "correctCount": 5, "totalQuestions": 6, "points": 50, "difficulty": "normal",
  "finishOrder": [ { "id": "player", "rank": 1, "finishTime": 39.812, "number": 4, "isPlayer": true } ],
  "answers": [ { "questionId": "…", "choiceId": "…", "correct": true, "points": 10, "attemptId": "…", "timedOut": false } ] }
```
المركز في السباق والنقاط التعليمية **معلومتان منفصلتان**.

---

## ٥. ما تحتاج المنصة إلى تنفيذه (أو مطابقته)
1. تضمين اللعبة في iframe من مجلد فرعي (المسارات نسبية؛ مجرّب على `games/horse-jumping-race/`).
2. الرد على `game:ready` بـ `platform:init` (مع الأسئلة أو عند طلبها).
3. تصحيح `game:submitAnswer` في الخادم، مع منع التكرار حسب `attemptId`.
4. حفظ `game:result` مع منع التكرار حسب `resultId`، والرد بـ `platform:ack`.
5. ضبط `allowedOrigins` في `game.config.js` على نطاق المنصة إن اختلف عن نطاق اللعبة.
6. (اختياري) إرسال `platform:control` للإيقاف/الاستئناف/إعادة البدء/الإنهاء.

## ٦. الوضع التجريبي المستقل
`integration.bridge = 'local'` (الافتراضي): يستخدم `LocalSimulatorBridge` مع `questions.sample.js` (بيانات تجريبية ومفتاح إجابة محلي). مفصول تمامًا عن وضع المنصة ولا يُستخدم أبدًا كبديل تلقائي عنه. لاختبار الحالات: `?sim=latency:1500` · `?sim=fail:1` · `?sim=pending:1`.

## ٧. محاكي المنصة
`dist-platform-sim/` (المصدر في `simulator/`): صفحة مضيفة تطبق هذا العقد المقترح، مع خيارات التأخير والفشل وتجاهل الرسائل و«بانتظار التصحيح» وفشل الحفظ، وعدّاد للمحاولات المكررة المرفوضة.

---

## إضافة خاصة بلعبة قفز الحواجز: تعدد المحاولات على السؤال الواحد (مقترح)

في هذه اللعبة لا يتخطى الحصان الحاجز إلا بإجابة صحيحة، فقد تُرسل اللعبة **أكثر من محاولة للسؤال نفسه**:

- كل محاولة لها `attemptId` **جديد** (و`requestId` = `attemptId`)، مع حقل `attemptNo` (١ للمحاولة الأولى، ٢ بعد أول رفض، ...). إعادة إرسال المحاولة نفسها عند انقطاع الاتصال تستخدم **نفس** `attemptId` كما في العقد الأساسي، فترفض المنصة التكرار.
- **عند الإجابة الخاطئة يجب ألا ترسل المنصة `correctChoiceId` ولا الشرح** — السؤال سيُعاد. تُرسلان مع الإجابة الصحيحة فقط. (اللعبة نفسها لا تعرض الإجابة الصحيحة بعد الخطأ حتى لو وصلت.)
- اللعبة تعطّل محليًا الاختيارات التي ثبت خطؤها، فلا تُرسل مرة أخرى.
- النقاط المعروضة في اللعبة: نقاط المنصة كاملة للمحاولة الأولى، ونصفها للثانية، وصفر بعدها. إن أرادت المنصة قاعدة أخرى فتُرسل النقاط النهائية في `points` لكل محاولة ويُعدَّل سطر واحد في `gameController._applyGrade`.
- حمولة النتيجة النهائية تضيف: `refusals` (عدد المحاولات الخاطئة)، و`answers[].attempts` (عدد المحاولات لكل سؤال)، و`correctCount` = الصحيحة من أول محاولة.
- حالة «بانتظار التصحيح» وأخطاء الاتصال كما في العقد الأساسي: لا تُحتسب صحيحة ولا خاطئة، والحصان يبقى متجمدًا أمام الحاجز، ولا انتقال إلى تصحيح تجريبي.
