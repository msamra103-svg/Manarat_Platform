/* Classroom sessions: presentation only. Grades always come from school-api. */
(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const presets={
 classic:{name:'تحدّي المعرفة',kind:'knowledge',label:'فكّر ثم فسّر',tip:'ناقش الفكرة، ثم اختر الإجابة. تظهر الملاحظات بعد التصحيح.'},
 puzzle:{name:'بازل الصور',kind:'puzzle',label:'ركّب واكتشف',tip:'ركّب الصورة باللمس أو بلوحة المفاتيح، ثم اربطها بفكرة الدرس.'},
 race:{name:'سباق السيارات',kind:'track',icon:'🏎️',label:'محطات المعرفة',tip:'كل سؤال محطة في المسار. يتحرّك الفريق بعد الإجابة دون انتظار القيادة.'},
 football:{name:'كرة القدم',kind:'goal',icon:'⚽',label:'ركلة المعرفة',tip:'أجب عن السؤال لتنطلق التسديدة. يختار الفريق التالي متحدثًا جديدًا.'},
 basketball:{name:'كرة السلة',kind:'basket',icon:'🏀',label:'سلة المعرفة',tip:'سؤال واحد ثم تسديدة سريعة. نقاط التعلّم مستقلة عن حركة الكرة.'},
 volleyball:{name:'الكرة الطائرة',kind:'net',icon:'🏐',label:'تبادل الأفكار',tip:'يتشاور الفريق قبل الإجابة، ثم يمرّر الدور للفريق التالي.'},
 bowling:{name:'البولينج',kind:'pins',icon:'🎳',label:'ضربة الفكرة',tip:'إجابة صحيحة تُسقط القوارير. ناقش سبب الاختيار قبل الجولة التالية.'},
 fishing:{name:'صيد الأسماك',kind:'water',icon:'🐟',label:'صيد المعلومة',tip:'السؤال متاح فورًا. الإجابة الصحيحة تجمع سمكة في رصيد المعرفة.'},
 'target-shooting':{name:'التصويب على الهدف',kind:'balloons',icon:'🎯',label:'بالونات المعرفة',tip:'اختر بالون الإجابة باللمس أو برقم الاختيار على لوحة المفاتيح.'},
 'qatar-runner':{name:'عدّاء قطر',kind:'gates',icon:'🏃',label:'بوابات الدرس',tip:'كل سؤال بوابة جديدة. بدّل المتحدث داخل الفريق عند تسليم الدور.'},
 'qatar-hero':{name:'مغامرات بطل قطر',kind:'islands',icon:'🦸',label:'رحلة الاكتشاف',tip:'انتقل مباشرة بين محطات الدرس، واستعن بالتفسير عند إعادة المحاولة.'},
 'qatar-camel-race':{name:'سباق الهجن القطري',kind:'desert',icon:'🐪',label:'قافلة المعرفة',tip:'يتوقف المسار بين الأسئلة حتى تنتهي المناقشة وتختار المتابعة.'},
 'horse-jumping-race':{name:'سباق الخيل',kind:'jump',icon:'🏇',label:'حواجز المعرفة',tip:'حاول مجددًا عند الخطأ. يوضّح الملخص الإجابات الصحيحة من أول محاولة والمصحّحة لاحقًا.'},
 'muhimmat-almaarifa':{name:'مهمّة المعرفة',kind:'explore',icon:'🧭',label:'مستكشف المعرفة',tip:'اكتشف محطة بعد أخرى ببطاقات واضحة، مع فرصة للتصحيح دون خسارة طاقة.'}
};
const retryGames=new Set(['qatar-hero','horse-jumping-race','muhimmat-almaarifa']);
function teams(text){return String(text||'').split(/[\n،,]/).map(v=>v.trim().slice(0,36)).filter(Boolean).slice(0,6);}
function record(session,q,value,result){
 const rows=session.learning||(session.learning=Object.create(null));
 let row=Object.hasOwn(rows,q.id)?rows[q.id]:null;
 if(!row)row=rows[q.id]={id:q.id,index:session.questions.findIndex(x=>x.id===q.id),text:q.text,firstCorrect:!!result.correct,attempts:0,choices:[]};
 const signature=JSON.stringify(value);
 if(!row.choices.includes(signature)){row.choices.push(signature);row.attempts++;}
 Object.assign(row,{correct:!!result.correct,pending:!!result.pending,points:Number(result.points)||0,feedback:String(result.feedback||''),explanation:String(result.explanation||'')});
 row.done=!retryGames.has(session.template)||row.correct||row.pending;
 return row;
}
function stats(session){
 const rows=Object.values(session.learning||{}),graded=rows.filter(r=>!r.pending),first=graded.filter(r=>r.firstCorrect).length;
 return {answered:rows.length,graded:graded.length,first,accuracy:graded.length?Math.round(first/graded.length*100):null,assisted:graded.filter(r=>r.correct&&!r.firstCorrect).length,pending:rows.filter(r=>r.pending).length};
}
function resume(session){
 const rows=session.learning||{};
 session.completed=Object.values(rows).filter(r=>r.done).length;
 session.points=Object.values(rows).reduce((sum,r)=>sum+r.points,0);
 session.correct=Object.values(rows).filter(r=>r.done&&r.correct).length;
 session.pendingCount=Object.values(rows).filter(r=>r.pending).length;
 session.index=session.questions.findIndex(q=>!rows[q.id]?.done);
 return session.index>=0;
}
function team(session,index=session.index){const names=session.teams||[];return names.length?names[Math.max(0,index)%names.length]:'';}
function review(session){
 const rows=Object.values(session.learning||{}).sort((a,b)=>a.index-b.index),s=stats(session),needs=rows.filter(r=>!r.firstCorrect||r.pending);
 const teamsHTML=(session.teams||[]).length?`<div class="class-team-results">${session.teams.map((name,i)=>{const turns=rows.filter(r=>r.index%session.teams.length===i);return `<div><b>${esc(name)}</b><span>${turns.filter(r=>r.firstCorrect).length} صحيحة من أول مرة / ${turns.filter(r=>!r.pending).length} أسئلة مصحّحة</span></div>`;}).join('')}</div><p class="help">توزيع الأدوار داخل هذه الجلسة. درجات الطلاب الفردية تُسجّل فقط في النمط الفردي.</p>`:'';
 return `<section class="learning-review" aria-label="ملخص التعلّم"><h2>ماذا تعلّمنا؟</h2><div class="learning-totals"><span><b>${s.first}</b> صحيحة من أول محاولة</span><span><b>${s.assisted}</b> صُحّحت بالمحاولة</span>${s.pending?`<span><b>${s.pending}</b> تنتظر المعلم</span>`:''}</div>${teamsHTML}<h3>${needs.length?'أفكار نعود إليها':'أحسنتم، اكتملت المراجعة'}</h3>${needs.map(r=>`<details class="review-item"><summary>${esc(r.text)} <span>${r.pending?'بانتظار التصحيح':r.correct?'تم التصحيح بعد المحاولة':'تحتاج مراجعة'}</span></summary><p>${esc(r.explanation||r.feedback||'ناقش مع المعلم سبب اختيارك وطريقة الوصول للإجابة.')}</p></details>`).join('')}${session.reflection?`<div class="class-reflection"><b>سؤال النقاش الختامي</b><p>${esc(session.reflection)}</p></div>`:''}</section>`;
}
function scene(session){
 const p=presets[session.template]||presets.classic,n=session.completed||0,total=session.questions.length,x=54+Math.min(n/total,1)*450;
 let art='';
 if(['track','gates','desert','jump'].includes(p.kind)){
  art=`<path d="M0 118 Q150 94 300 118T600 118V210H0Z" fill="${p.kind==='desert'?'#e9d6b4':'#e4e8e1'}"/><rect x="22" y="130" width="556" height="48" rx="24" fill="${p.kind==='desert'?'#c1a27d':'#68776c'}"/><path d="M35 154H565" stroke="#fff" stroke-width="2" stroke-dasharray="13 12"/>${[100,230,360,490].map((a,i)=>p.kind==='jump'?`<path d="M${a} 110v66m-12-29h28" stroke="#8a1538" stroke-width="6"/>`:p.kind==='gates'?`<path d="M${a} 172v-66h36v66" fill="none" stroke="#b38739" stroke-width="5"/>`:`<circle cx="${a}" cy="105" r="13" fill="#fff"/><text x="${a}" y="110" text-anchor="middle" font-size="13" fill="#5f4c50">${i+1}</text>`).join('')}<text class="class-mover" x="${x}" y="153" text-anchor="middle" font-size="42">${p.icon}</text>`;
 }else if(p.kind==='goal'){
  art='<rect x="22" y="85" width="556" height="104" rx="24" fill="#dbe9df"/><path d="M430 150V65H550V150M450 65V150M475 65V150M500 65V150M525 65V150M430 90H550M430 120H550" fill="none" stroke="#7c9485" stroke-width="3"/><circle cx="220" cy="138" r="43" fill="none" stroke="#fff" stroke-width="2"/><text class="class-ball" x="140" y="159" font-size="42">⚽</text>';
 }else if(p.kind==='basket'){
  art='<rect x="22" y="154" width="556" height="36" rx="18" fill="#eadac4"/><path d="M512 45v132M445 40h90v44h-90z" fill="#fff" stroke="#7e6570" stroke-width="5"/><path d="M454 89l12 35h28l12-35" fill="none" stroke="#b2a6ad" stroke-width="3"/><ellipse cx="480" cy="89" rx="29" ry="7" fill="none" stroke="#8a1538" stroke-width="6"/><text class="class-ball" x="132" y="160" font-size="44">🏀</text>';
 }else if(p.kind==='net'){
  art='<rect x="22" y="155" width="556" height="35" rx="16" fill="#ecddbf"/><path d="M300 55V175M300 65h90v65h-90M320 65v65M345 65v65M370 65v65M300 88h90M300 110h90" stroke="#a58b96" fill="none" stroke-width="3"/><text class="class-ball" x="132" y="150" font-size="44">🏐</text>';
 }else if(p.kind==='pins'){
  art='<path d="M70 185L230 45H500L560 185Z" fill="#eaddc6"/><path d="M145 185L275 45M490 185L470 45" stroke="#fff" stroke-width="3"/>'+[0,1,2,3,4,5].map((i)=>`<g class="class-pin" transform="translate(${370+(i%3)*36},${70+Math.floor(i/3)*46})"><path d="M-4 0h8v13l6 17q0 8-10 8t-10-8l6-17z" fill="#fff" stroke="#baa6a8"/><path d="M-4 12h8" stroke="#8a1538" stroke-width="4"/></g>`).join('')+'<circle class="class-ball" cx="150" cy="160" r="20" fill="#8a1538"/>';
 }else if(p.kind==='water'){
  art='<path d="M0 100Q30 85 60 100T120 100T180 100T240 100T300 100T360 100T420 100T480 100T540 100T600 100V210H0Z" fill="#cfe7e8"/><path d="M130 70L335 35L342 135" stroke="#80644e" stroke-width="3" fill="none"/><text class="class-fish" x="315" y="164" font-size="42">🐟</text><path d="M90 75h95l-17 25h-63z" fill="#8a1538"/><circle cx="220" cy="140" r="6" fill="#fff"/><circle cx="430" cy="172" r="4" fill="#fff"/>';
 }else if(p.kind==='balloons'){
  art=[110,240,370,500].map((a,i)=>`<g class="class-balloon"><path d="M${a} 120q-15 25 0 55" stroke="#b8a6ac" fill="none"/><ellipse cx="${a}" cy="86" rx="32" ry="40" fill="${['#8a1538','#287c7e','#a56f1f','#637d47'][i]}"/><text x="${a}" y="94" text-anchor="middle" font-size="22" fill="white">${i+1}</text></g>`).join('');
 }else if(p.kind==='islands'||p.kind==='explore'){
  art='<path d="M75 158Q170 90 275 145T510 80" fill="none" stroke="#c5b69e" stroke-width="6" stroke-dasharray="8 10"/>'+[90,240,390,520].map((a,i)=>`<ellipse cx="${a}" cy="${i%2?120:160}" rx="46" ry="17" fill="#d8e3cb"/><text x="${a}" y="${i%2?116:156}" text-anchor="middle" font-size="37">${i===Math.min(3,Math.floor(n/total*4))?p.icon:'📖'}</text>`).join('');
 }else return '';
 return `<div class="class-scene class-kind-${p.kind} ${session.answered?'is-answered '+(session.lastCorrect?'is-correct':'is-review'):''}" aria-hidden="true"><svg viewBox="0 0 600 210"><circle cx="530" cy="35" r="20" fill="#efdbb0"/><path d="M45 45q25-20 50 0m32 0q25-20 50 0" stroke="#e3d8d9" stroke-width="7" fill="none" stroke-linecap="round"/>${art}</svg></div>`;
}
root.SchoolClassroom={presets,retryGames,teams,record,stats,resume,team,review,scene};
if(typeof module==='object'&&module.exports)module.exports=root.SchoolClassroom;
})(typeof window!=='undefined'?window:globalThis);
