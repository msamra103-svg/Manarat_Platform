# send-whatsapp-message

دالة Supabase Edge Function لإرسال رسائل نموذج التواصل مباشرة إلى واتساب عبر WhatsApp Business Cloud API.

## الإعدادات المطلوبة في Supabase Secrets

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TO_NUMBER`

اختياري:
- `WHATSAPP_API_VERSION`
- `WHATSAPP_USE_TEMPLATE=true`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANG=ar`

## مهم

اجعل Verify JWT = OFF لهذه الدالة، لأن الزائر العام يرسل من نموذج الصفحة الرئيسية دون تسجيل دخول.

إذا لم تضبط هذه الدالة، سيعود النموذج تلقائيًا إلى فتح واتساب بالطريقة العادية إذا كان خيار الاحتياطي مفعّلًا.
