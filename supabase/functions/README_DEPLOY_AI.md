# نشر التوليد الذكي من PDF عبر Supabase Edge Function

هذه النسخة تستخدم دالة آمنة باسم:

`generate-questions-from-pdf`

## الخطوات

من جذر المشروع وبعد تثبيت Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_KEY
supabase functions deploy generate-questions-from-pdf
```

يوجد أيضًا مجلد `generate-questions` كنسخة توافق قديمة، لكن الاسم المعتمد في المنصة هو:

`generate-questions-from-pdf`

## داخل المنصة

في لوحة الأدمن > الذكاء الاصطناعي:

- فعّل: استخدام Supabase Edge Function الآمنة
- اسم الدالة: `generate-questions-from-pdf`
- النموذج: `gemini-2.5-flash`

بهذا الشكل لا يحتاج المتصفح إلى قراءة PDF بنفسه، ولا يظهر مفتاح Gemini للطلاب أو المعلمين.
