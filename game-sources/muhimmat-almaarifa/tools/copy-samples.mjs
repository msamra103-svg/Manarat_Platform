// ينسخ بنك الأسئلة التجريبي إلى مجلد عام حتى يجده المعلم كملف نموذج للاستيراد.
import { mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
mkdirSync('public/questions', { recursive: true });
copyFileSync('src/data/demo-bank.json', 'public/questions/demo-questions.json');
const demo = JSON.parse(readFileSync('src/data/demo-bank.json', 'utf8'));
const sample = { format: demo.format, version: 1, title: 'نموذج بنك أسئلة — استبدل هذا العنوان', questions: [
  { id: 'q-001', text: 'اكتب نص السؤال هنا؟', options: [{ id: 'a', text: 'الخيار الأول' }, { id: 'b', text: 'الخيار الثاني' }, { id: 'c', text: 'الخيار الثالث' }, { id: 'd', text: 'الخيار الرابع' }], correctOptionId: 'a', explanation: 'اكتب هنا تفسيرًا قصيرًا للإجابة الصحيحة.', hint: 'تلميح اختياري يظهر بعد الخطأ.', speech: '' },
  { id: 'q-002', text: 'سؤال صواب أم خطأ: اكتب العبارة هنا.', options: [{ id: 'true', text: 'صواب' }, { id: 'false', text: 'خطأ' }], correctOptionId: 'true', explanation: 'تفسير قصير.' }
] };
writeFileSync('public/questions/import-template.json', JSON.stringify(sample, null, 2));
console.log('نُسخت ملفات الأسئلة النموذجية إلى public/questions');
