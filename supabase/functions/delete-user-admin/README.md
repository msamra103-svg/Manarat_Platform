# delete-user-admin

دالة آمنة اختيارية لحذف حساب المعلم من Supabase Auth عند الضغط على زر حذف في لوحة الأدمن.

## الأسرار المطلوبة في Supabase

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## النشر من Dashboard
انسخ ملف `index.ts` داخل دالة باسم:

`delete-user-admin`

## النشر من CLI
```bash
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
npx supabase functions deploy delete-user-admin
```

هذه الدالة لا تغيّر اسم دالة الذكاء الاصطناعي الحالية `dynamic-handler`.
