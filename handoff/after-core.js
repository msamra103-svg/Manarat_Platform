/* FIXTURE ADAPTER: excluded from every production return archive. */
(()=>{'use strict';const M=window.Manarat,m=window.__uiMock;if(!M||!m)return;const p=m.profile();let s=M.store();
s.profile=p;s.teachers=m.db.teachers;s.games=m.db.games.map(g=>({...g,...g.data}));s.attempts=m.db.sessions;s.questionBanks=s.questionBanks||[];
s.platform={...s.platform,brandName:'مدرسة أبو عبيدة الإعدادية للبنين',brandSubtitle:'منصة التعلّم التفاعلي',uiGender:'male',educatorGender:'male',logoImage:'school-mark.svg',markImage:'school-mark.svg',accent1:'#8a1538',accent2:'#8a1538',accent3:'#ba965a',background:'school',hoverSounds:false,playerSounds:false,socialLinks:{},publicSocials:[],youtubeVideos:[],siteContact:'بيانات تجريبية فقط',cloud:{...s.platform.cloud,enabled:false,supabaseUrl:'https://ui-preview.invalid',publishableKey:'LOCAL_UI_PREVIEW_NO_KEY'},ai:{...s.platform.ai,apiKey:'',enabled:false}};
localStorage.setItem(M.STORE_KEY,JSON.stringify(s));
const sess={access_token:'local-preview-not-a-token',refresh_token:'local-preview-not-a-refresh',expires_at:4102444800,user:{id:p.id,email:p.email,user_metadata:{name:p.name,educator_gender:'male'}}};
if(m.role==='guest')localStorage.removeItem(M.AUTH_SESSION_KEY);else localStorage.setItem(M.AUTH_SESSION_KEY,JSON.stringify(sess));
M.ensureFreshSession=async()=>m.role==='guest'?null:sess;
M.authSignIn=async()=>{localStorage.setItem('abu_ui_role','teacher');localStorage.setItem(M.AUTH_SESSION_KEY,JSON.stringify(sess));return sess;};
M.authSignOut=async()=>{localStorage.setItem('abu_ui_role','guest');localStorage.removeItem(M.AUTH_SESSION_KEY);location.href='/index.html?previewRole=guest';};
M.cloudSyncTables=async()=>true;M.initCloudSync=async()=>true;M.cloudSaveAllTables=async()=>true;M.syncCloudNow=async()=>{M.toast('محاكاة محلية فقط — لم تُرفع بيانات');return true;};M.testCloudConnection=async()=>{M.toast('لا يوجد اتصال حقيقي في حزمة التصميم');return true;};M.testAIConnection=async()=>{M.toast('الذكاء الاصطناعي خارج نطاق المعاينة');return false;};
M.cloudUploadFile=async f=>{const url=await M.fileToDataURL(f);return {url,publicUrl:url};};
M.aiGenerateQuestions=async()=>{throw new Error('توليد الأسئلة بالذكاء الاصطناعي معطّل في حزمة التصميم؛ استخدم الإدخال اليدوي للمعاينة.');};
M.cloudUpsertGame=async g=>{const i=m.db.games.findIndex(x=>x.id===g.id);const row={...g,data:{...g}};if(i<0)m.db.games.unshift(row);else m.db.games[i]=row;m.save();return row;};
M.cloudForceSavePlatform=async()=>true;M.cloudFetchProfiles=async()=>m.db.teachers;M.cloudFetchAuditLogs=async()=>[];M.cloudInsertAudit=async()=>({local_only:true});
})();
