# دليل دمج «التصويب على الهدف» في المنصة

## ١) ما الذي يُدمج
- المجلد `games/target-shooting/` كاملًا، ونسخته في `public/games/target-shooting/`.
- `assets/game-covers/target-shooting.svg` (ونسخته في `public/`).
- التعديلات الصغيرة في: `js/school.js`، `js/design-schema.js`، `js/design-studio.js`، `js/platform-nav.js`، `js/homepage-hub-logic.js` (ونسخها في `public/js/`)، `supabase/functions/_shared/design-schema.js`، `supabase/functions/school-api/index.ts`، `package.json`، `tests/school-browser.cjs`، واختبارات `tests/target-shooting-*.cjs`.
- **لا يوجد ترحيل لقاعدة البيانات.** إعدادات اللعبة تُحفظ داخل حقل `settings` الموجود في `school_assignments`:
  ```json
  "shooting": { "mode": "choice | archery | birds | balloons | clay",
                "difficulty": "beginner | intermediate | advanced",
                "arrowsPerQuestion": 1-10, "aimAssist": "auto | off | low | high" }
  ```

## ٢) خطوات التطبيق (يقوم بها صاحب المشروع)
1. راجع الفرع `feature/target-shooting` (أو طبّق الرقعة `target-shooting.patch` بالأمر `git am`).
2. شغّل الاختبارات: `npm run test:target-shooting` ثم اختبارات المنصة المعتادة.
3. **أعد نشر دالة الحافة `school-api`** على Supabase بعد الدمج. قبل إعادة النشر لن يقبل الخادم القالب `target-shooting` في التكليفات الجديدة (سيُحذف من قائمة الألعاب المختارة) ولن تُحفظ `settings.shooting`.
4. انشر الواجهة كالمعتاد (المرآة `public/` محدّثة مسبقًا).

## ٣) كيف يعمل داخل المنصة
- يظهر في قائمة الألعاب وفي نموذج التكليف باسم «التصويب على الهدف». عند اختياره يظهر قسم «إعدادات التصويب على الهدف»: التحدي (يختار الطالب أو تحدٍ محدد)، المستوى، الأسهم لكل سؤال، مساعدة التصويب.
- يفتح داخل iframe بالبروتوكول نفسه للألعاب الأخرى (بادئة `school-target-shooting-`): `ready/config/question/result/outcome/next/advance/retry/fullscreen`. كل رسالة تُفحص للأصل والمصدر والرمز والفهرس والمرحلة.
- السؤال تعرضه المنصة بمعالجها الخاص، والخادم هو من يصحح (اللعبة لا ترى الإجابات). الإجابة المقالية المعلقة تظهر محايدة.
- في النهاية تعرض اللعبة النتائج (اسم اللعبة، التحدي، الطالب، المدرسة، الإجابات، النقاط، الدقة)، ثم يضغط الطالب «حفظ النتيجة في المنصة» فتعرض المنصة تقريرها.

## ٤) النسخة غير المتصلة
- `npm run build:target-shooting-offline` ينشئ `dist/target-shooting-offline/` وملف ZIP:
  نسخة المعلم (لوحة التحكم + محرر الأسئلة + تصدير نسخة طالب) ونسخة الطالب، وملف «اقرأني».
- يعمل كل ملف بفتحه مباشرة في المتصفح، دون إنترنت ودون Supabase ودون أي مفتاح سري. نتائج هذه النسخة محلية للتدريب ولا تُرسل إلى المنصة.

## ٥) الهوية
اسم المدرسة والشعار النصي واللون مأخوذة من إعدادات المنصة أو لوحة المعلم وليست مثبتة في الكود (الافتراضي: مدرسة أبو عبيدة الإعدادية للبنين، العنابي #8A1538).
