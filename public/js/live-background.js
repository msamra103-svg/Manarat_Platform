/* Optional room artwork, shared by the host and participants. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const storage='https://yltlzogrhwvnmxcnaesu.supabase.co/storage/v1/object/public/manarat-brand-assets/';
const pattern=/^[a-f0-9-]{36}\/live\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/;
let draft='',payload=null,preview='',ready=Promise.resolve(),sequence=0,active='',loadID=0,locked=false;
function url(path){return pattern.test(path||'')?storage+path:'';}
function reset(path=''){sequence++;draft=path;payload=null;preview=url(path);ready=Promise.resolve();}
function paint(){const img=$('backgroundPreview'),remove=$('backgroundRemove');if(img){img.hidden=!preview;if(preview)img.src=preview;else img.removeAttribute('src');}if(remove)remove.hidden=!preview;}
function editor(){return `<fieldset class="background-editor"><legend>خلفية المسابقة (اختياري)</legend><label for="backgroundFile">رفع صورة</label><input id="backgroundFile" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="backgroundHelp backgroundStatus"><p id="backgroundHelp" class="help">تظهر خلف الأسئلة لجميع المشاركين. يفضّل صورة أفقية. الصيغ: JPG وPNG وWebP، حتى ١٠ ميجابايت.</p><img id="backgroundPreview" class="background-preview" alt="معاينة خلفية المسابقة" hidden><p id="backgroundStatus" role="status" class="help"></p><button id="backgroundRemove" type="button" class="quiet" data-action="remove_background" hidden>إزالة الصورة واستخدام الخلفية الافتراضية</button></fieldset>`;}
function open(path){reset(path);let dialog=$('backgroundDialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='backgroundDialog';document.body.appendChild(dialog);dialog.addEventListener('cancel',e=>{if(locked)e.preventDefault();});}dialog.innerHTML=`<h2>خلفية المسابقة</h2>${editor()}<div class="row"><button type="button" data-action="save_background">حفظ الخلفية</button><button type="button" class="quiet" data-action="close_background">إلغاء</button></div>`;paint();dialog.showModal();}
function close(){$('backgroundDialog')?.close();}
function setLocked(value){locked=value;document.querySelectorAll('.background-editor input,.background-editor button,#backgroundDialog button').forEach(el=>el.disabled=value);}
async function prepare(file){
 if(!file||locked)return;const id=++sequence,status=$('backgroundStatus');
 status.textContent='جارٍ تجهيز الصورة…';
 ready=(async()=>{
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('اختر صورة بصيغة JPG أو PNG أو WebP.');
  if(file.size>10*1024*1024)throw Error('حجم الصورة أكبر من ١٠ ميجابايت. اختر صورة أصغر.');
  const objectURL=URL.createObjectURL(file),img=new Image();
  try{img.src=objectURL;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw Error('تعذّر قراءة الصورة.');
   const scale=Math.min(1,1920/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
   let data=canvas.toDataURL('image/webp',.84);if(data.length>1900000)data=canvas.toDataURL('image/jpeg',.72);
   if(data.length>2000000)throw Error('الصورة كبيرة بعد تجهيزها. اختر صورة أصغر.');
   if(id!==sequence)return;const match=data.match(/^data:(image\/(?:webp|jpeg|png));base64,(.+)$/);if(!match)throw Error('تعذّر تجهيز هذه الصورة.');
   payload={mime:match[1],base64:match[2]};draft='';preview=data;paint();status.textContent='الصورة جاهزة. ستظهر بعد حفظ المسابقة.';
  }finally{URL.revokeObjectURL(objectURL);}
 })().catch(e=>{if(id===sequence)status.textContent=e.message||'تعذّر قراءة الصورة. اختر صورة أخرى.';throw e;});
 // Observe failures even when the teacher does not submit the form.
 ready.catch(()=>{});
}
async function upload(request){await ready;if(payload){const result=await request('upload_background',payload);if(!url(result.path))throw Error('تعذّر حفظ خلفية المسابقة.');draft=result.path;payload=null;}return draft;}
function remove(){reset();paint();if($('backgroundFile'))$('backgroundFile').value='';if($('backgroundStatus'))$('backgroundStatus').textContent='ستُستخدم الخلفية الافتراضية.';}
function apply(path){const src=url(path);if(src===active)return;active=src;const id=++loadID;
 const clear=()=>{document.body.classList.remove('has-live-background');document.body.style.removeProperty('--live-background');};
 if(!src){clear();return;}const img=new Image();
 img.onload=()=>{if(id!==loadID)return;document.body.style.setProperty('--live-background',`url("${src}")`);document.body.classList.add('has-live-background');};
 img.onerror=()=>{if(id===loadID)clear();};img.src=src;
}
document.addEventListener('change',e=>{if(e.target.id==='backgroundFile')prepare(e.target.files[0]);});
window.LiveBackground={editor,reset,open,close,remove,upload,apply,setLocked};
})();
