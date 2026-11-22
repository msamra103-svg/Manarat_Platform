/* School administration navigation. */
(()=>{'use strict';
window.MANARAT_UNIFIED_ADMIN=true;
const $=id=>document.getElementById(id),side=document.querySelector('.admin-side'),advanced=side.querySelector('details');
for(const frame of document.querySelectorAll('[data-school-panel]')){
 const key=frame.dataset.schoolPanel,panel=frame.parentElement;
 let observer;
 const fitFrame=()=>{
  const body=frame.contentDocument?.body;
  if(!body)return;
  observer?.disconnect();
  const fit=()=>{if(panel.style.display!=='none')frame.style.height=Math.max(600,body.scrollHeight)+'px';};
  observer=new ResizeObserver(fit);observer.observe(body);fit();
 };
 frame.addEventListener('load',fitFrame);
 if(frame.contentDocument?.readyState==='complete')fitFrame();
 side.querySelector(`[data-tab="school-${key}"]`).addEventListener('click',()=>{
  if(!frame.hasAttribute('src'))frame.src='../index.html?adminPanel='+key;
  else if(key!=='settings')frame.contentWindow.School?.dashboard().catch(e=>Manarat.toast(e.message,'error'));
 });
}
const cloud=$('tab-cloud');const diagnostic=document.createElement('section');diagnostic.className='card';diagnostic.innerHTML='<h3>قاعدة بيانات المدرسة الحالية</h3><p class="muted">المشروع المتصل: yltlzogrhwvnmxcnaesu. الفحص التالي يتحقق من خدمة المدرسة والجداول وصلاحية الإدارة. تغيير مشروع المدرسة بالكامل يحتاج ترحيل بياناتها وإعادة نشر الخدمة. تُستخدم حقول الاتصال أدناه لبنوك الأسئلة والألعاب المصدّرة.</p><button class="btn" id="checkSchoolData">اختبار اتصال المدرسة</button><p id="schoolDataResult" role="status"></p>';cloud.prepend(diagnostic);$('checkSchoolData').onclick=async()=>{const b=$('checkSchoolData'),out=$('schoolDataResult');b.disabled=true;out.textContent='جارٍ الفحص…';try{await Manarat.ensureFreshSession();const r=await fetch('https://yltlzogrhwvnmxcnaesu.supabase.co/functions/v1/school-api',{method:'POST',headers:{'Content-Type':'application/json',apikey:'sb_publishable_W-XxH2FTvSZq66b-eHt-TQ_a8ZuqGRD',Authorization:'Bearer '+Manarat.authSession()?.access_token},body:JSON.stringify({action:'dashboard'})});const data=await r.json();if(!r.ok||!data.profile?.admin)throw new Error(data.error||'يلزم حساب إدارة');out.textContent='الاتصال ناجح · المستخدمون: '+data.teachers.length+' · المهمات: '+data.assignments.length+' · المحاولات: '+data.sessions.length;}catch(e){out.textContent='تعذر الفحص: '+e.message;}finally{b.disabled=false;}};
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='school-settings-saved'||![...document.querySelectorAll('[data-school-panel]')].some(f=>f.contentWindow===e.source))return;const script=document.createElement('script');script.src='../js/school-bridge.js?v=22.2-school';document.body.append(script);});
side.querySelectorAll('.side-btn').forEach(b=>b.dataset.short=b.textContent.trim().slice(0,2));$('v21Collapse').onclick=()=>{const collapsed=document.body.classList.toggle('is-side-collapsed');$('v21Collapse').setAttribute('aria-expanded',String(!collapsed));};$('v21AdminSearch').oninput=e=>{const q=e.target.value.trim();side.querySelectorAll('.side-btn').forEach(b=>b.hidden=!!q&&!b.textContent.includes(q));if(q)advanced.open=true;};

document.addEventListener('click',e=>{const b=e.target.closest('[data-jump-tab]');if(b){const target=document.querySelector(`[data-tab="${b.dataset.jumpTab}"]`);if(target?.closest('details'))target.closest('details').open=true;}});

})();
