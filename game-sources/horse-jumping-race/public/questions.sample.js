/*
 * ⚠️ بيانات تجريبية فقط — ستة أسئلة بسيطة من مواد مختلفة لتجربة التشغيل.
 * استبدلها بأسئلة المعلم أو اتركها: في وضع المنصة تُرسل المنصة الأسئلة ولا يُستخدم هذا الملف.
 *
 * البنية:
 *  - questions: ما تراه اللعبة (بلا مفتاح الإجابة). type: 'mcq' (اختيار من متعدد) أو 'tf' (صواب وخطأ).
 *  - answerKey: يستخدمه «المحاكي المحلي» للتصحيح فقط. لا يُرسل مع الأسئلة في وضع المنصة.
 */
window.HORSE_JUMPING_RACE_SAMPLE_QUESTIONS = {
  isSampleData: true,
  questions: [
    {
      id: 'demo-q1',
      type: 'mcq',
      subject: 'الرياضيات',
      text: 'ما ناتج ٧ × ٨ ؟',
      choices: [
        { id: 'a', text: '٥٤' },
        { id: 'b', text: '٥٦' },
        { id: 'c', text: '٦٤' },
        { id: 'd', text: '٤٨' },
      ],
    },
    {
      id: 'demo-q2',
      type: 'tf',
      subject: 'العلوم',
      text: 'يتجمّد الماء النقيّ عند درجة صفر مئوية تحت الضغط الجوي المعتاد.',
      choices: [
        { id: 'true', text: 'صواب' },
        { id: 'false', text: 'خطأ' },
      ],
    },
    {
      id: 'demo-q3',
      type: 'mcq',
      subject: 'اللغة العربية',
      text: 'ما جمعُ كلمةِ «كِتاب»؟',
      choices: [
        { id: 'a', text: 'كُتُب' },
        { id: 'b', text: 'كاتِبون' },
        { id: 'c', text: 'مَكاتِب' },
        { id: 'd', text: 'كِتابات' },
      ],
    },
    {
      id: 'demo-q4',
      type: 'mcq',
      subject: 'الدراسات الاجتماعية',
      text: 'ما عاصمة دولة قطر؟',
      choices: [
        { id: 'a', text: 'الخور' },
        { id: 'b', text: 'الوكرة' },
        { id: 'c', text: 'الدوحة' },
        { id: 'd', text: 'الشحانية' },
      ],
    },
    {
      id: 'demo-q5',
      type: 'mcq',
      subject: 'العلوم',
      text: 'أيُّ الكواكب الآتية هو الأقرب إلى الشمس في مجموعتنا الشمسية، علمًا بأنه أيضًا أصغر كواكبها حجمًا؟',
      choices: [
        { id: 'a', text: 'الزُّهَرة' },
        { id: 'b', text: 'عُطارِد' },
        { id: 'c', text: 'المرّيخ' },
        { id: 'd', text: 'الأرض' },
      ],
    },
    {
      id: 'demo-q6',
      type: 'tf',
      subject: 'الرياضيات',
      text: 'العدد ١٥ عددٌ أوّليّ.',
      choices: [
        { id: 'true', text: 'صواب' },
        { id: 'false', text: 'خطأ' },
      ],
    },
  ],
  answerKey: {
    'demo-q1': { correctChoiceId: 'b', explanation: '٧ × ٨ = ٥٦. يمكن التحقق: ٧ × ٤ = ٢٨، ثم ٢٨ × ٢ = ٥٦.' },
    'demo-q2': { correctChoiceId: 'true', explanation: 'نقطة تجمّد الماء النقيّ صفر درجة مئوية عند الضغط الجوي المعتاد.' },
    'demo-q3': { correctChoiceId: 'a', explanation: '«كُتُب» جمعُ تكسيرٍ لكلمة «كِتاب».' },
    'demo-q4': { correctChoiceId: 'c', explanation: 'الدوحة هي عاصمة دولة قطر وأكبر مدنها.' },
    'demo-q5': { correctChoiceId: 'b', explanation: 'عُطارِد هو أقرب الكواكب إلى الشمس وأصغرها حجمًا.' },
    'demo-q6': { correctChoiceId: 'false', explanation: '١٥ ليس أوّليًّا لأنه يقبل القسمة على ٣ و٥ (١٥ = ٣ × ٥).' },
  },
};
