# منصة منارة التعلم الرقمي — V16.13 — حساب m.samra103@gmail.com

هذه النسخة مهيأة للحساب الجديد ومربوطة بمشروع Supabase الحالي.

## GitHub
المستودع: `msamra103-svg/Manarat_Platform`

## Supabase
Project URL: `https://yltlzogrhwvnmxcnaesu.supabase.co`
Publishable key: `sb_publishable_W-XxH2FTvSZq66b-eHt-TQ_a8ZuqGRD`

ملف قاعدة البيانات المرجعي: `supabase/00_START_HERE_CREATE_DATABASE.sql`

## حساب مدير المنصة
البريد المعتمد: `m.samra103@gmail.com`
عند إنشاء/تسجيل هذا الحساب عبر Supabase Auth تُسند له صلاحية الأدمن تلقائيًا من قاعدة البيانات.
لا توجد كلمة مرور مخزنة داخل ملفات GitHub.

## الأمان
- RLS مفعّل على جميع جداول منارة في `public`.
- الزائر يستطيع قراءة الألعاب المنشورة وحفظ نتيجة اللعب فقط.
- تعديل المنصة والألعاب والبنوك والقوائم يحتاج جلسة مصادق عليها وصلاحية مناسبة.
- المفتاح الموجود في الواجهة Publishable فقط؛ لا يوجد `service_role` أو secret key في ملفات الموقع.
- حالة المنصة العامة محفوظة في صف `public` منفصل، والحالة الكاملة للأدمن في صف `main`.
