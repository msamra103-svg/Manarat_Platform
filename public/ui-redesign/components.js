/* UI presentation enhancements only. No auth, cloud writes, grading, API replacements or game engine changes. Preserve IDs and event hooks. */
/* ==========================================================================
   مدرسة أبو عبيدة الإعدادية للبنين — طبقة مكونات العرض (Abu Ubaida UI 1.0)

   What this file does (presentation only):
   - Adds visible <label>s to builder/admin fields that only had placeholders,
     by MOVING the existing input into a wrapper (same node, same id, same
     listeners and value; never cloned or re-rendered).
   - Adds status/tone attributes and small chips derived from text the
     platform already rendered (e.g. "متاحة"/"متوقفة", "مكتملة").
   - Adds a "filter the rows shown on this page" box to long tables. It only
     hides/shows rows already in the DOM and says so explicitly.
   - Adds group headings to the admin sidebar and a mode legend/hints for
     the three play modes (wording taken from the platform's own help text).
   - Replaces the visible legacy studio eyebrow "MANARAT · DESIGN STUDIO".
   - Places the official ministry logo beside the school name on tool pages
     (only when the official file is shipped with the layer).

   What it never does: call APIs, read/write storage, touch postMessage,
   change form values, change data-action/data-tab/ids, add listeners to
   platform elements, or run on game screens (body.playing-game / games/).

   Performance: one MutationObserver per page (childList only, batched with
   requestAnimationFrame), one ResizeObserver for the sticky header height.
   Every enhancement is idempotent (guarded by data-abu-* markers), so a
   re-render or re-opening a section never stacks duplicate nodes/listeners.
   ========================================================================== */
(()=>{"use strict";
if(window.__abuUI)return;window.__abuUI={version:"1.1.1-reviewed",passes:0};
const LAYER_BASE=(document.currentScript&&document.currentScript.src)||"";
const doc=document,body=()=>doc.body;
const isGame=()=>!body()||body().classList.contains("playing-game")||/\/games\//.test(location.pathname);
const $$=(sel,root=doc)=>Array.from(root.querySelectorAll(sel));
const txt=el=>(el&&el.textContent||"").replace(/\s+/g," ").trim();
const make=(tag,props={},children=[])=>{const el=doc.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==="class")el.className=v;else if(k==="text")el.textContent=v;else el.setAttribute(k,v);}children.forEach(c=>el.append(c));return el;};

/* ---------------------------------------------------------------------
   1) Visible labels for placeholder-only fields (builder + admin tools)
   --------------------------------------------------------------------- */
const OPTIONAL=new Set(["folder","qEmoji","qExplanation","description","homeHighlight"]);
const NAMED={qType:"نوع السؤال"}; // selects without a placeholder
function labelFields(root){
  const scope=root||doc;
  const fields=$$("input[placeholder]:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),textarea[placeholder],"+Object.keys(NAMED).map(id=>"select#"+id).join(","),scope)
    .filter(f=>f.id&&!f.closest(".abu-field")&&!f.closest("label")&&!f.dataset.abuLabelled);
  for(const f of fields){
    // Only static page fields with an id; dynamic editor rows get aria-label instead.
    if(f.closest("#qStructuredEditor,#questionsList,.structured-row,.q-admin-card,#youtubeVideosManager,#homeSectionsManager,.v21-side-tools,#joinForm,dialog#modal"))continue;
    if(doc.querySelector(`label[for="${CSS.escape(f.id)}"]`)){f.dataset.abuLabelled="1";continue;}
    const text=NAMED[f.id]||(f.getAttribute("placeholder")||"").split(/[:،(]/)[0].replace(/[.…]+$/,"").trim();
    if(!text||text.length>48){if(!f.getAttribute("aria-label")&&f.placeholder)f.setAttribute("aria-label",f.placeholder);f.dataset.abuLabelled="1";continue;}
    const parent=f.parentNode;if(!parent)continue;
    const hadFocus=doc.activeElement===f;if(hadFocus)continue; // never move a field while the user is typing in it
    const wrap=make("div",{class:"abu-field","data-abu-for":f.id});
    const label=make("label",{class:"abu-label",for:f.id,text});
    if(OPTIONAL.has(f.id))label.append(make("span",{class:"abu-opt",text:"(اختياري)"}));
    parent.insertBefore(wrap,f);wrap.append(label,f); // same node moved: id, value, listeners preserved
    f.dataset.abuLabelled="1";
  }
  // Dynamic editor rows: accessible names only (no DOM moves inside re-rendered editors)
  for(const f of $$("#qStructuredEditor input[placeholder]:not([aria-label]),#questionsList input[placeholder]:not([aria-label]),.ds-sort-row input[placeholder]:not([aria-label])",scope)){
    f.setAttribute("aria-label",f.getAttribute("placeholder"));
  }
}

/* ---------------------------------------------------------------------
   2) Teacher workspace + embedded panels (#panel)
   --------------------------------------------------------------------- */
const CHIP_TONES=[
  [/^(نشط|مفعل|مفعّل)$/,"success"],[/^(موقوف|معلق|معلّق)$/,"danger"],
  [/^مكتملة$/,"success"],[/^بانتظار التصحيح$/,"warning"],[/^بدأ اللعب$/,"info"],
  [/^الصف$/,"class"],[/^المنزل$/,"home"],[/^مدير المنصة$/,"admin"],[/^معلم$/,"teacher"]
];
function enhancePanel(){
  const panel=doc.getElementById("panel");if(!panel)return;
  // Assignment cards: status from the platform's own tag text
  for(const card of $$("article.card",panel)){
    if(card.dataset.abuDone)continue;
    const tag=card.querySelector(".tag");const t=txt(tag);
    if(/·\s*(متاحة|متوقفة)$/.test(t)){
      const paused=/متوقفة$/.test(t);
      card.dataset.abuStatus=paused?"paused":"active";
      const state=make("span",{class:"abu-state","data-state":paused?"paused":"active","aria-hidden":"true",text:paused?"متوقفة":"نشطة"});
      const top=make("div",{class:"abu-card-top"});tag.parentNode.insertBefore(top,tag);top.append(tag,state);
    }
    const toggle=card.querySelector("[data-action=toggle]");
    if(toggle&&/إعادة التفعيل/.test(txt(toggle)))toggle.dataset.abuTone="positive";
    card.dataset.abuDone="1";
  }
  // Play-mode legend above the assignments grid (wording from the platform's help text)
  const grid=panel.querySelector(":scope>.grid");
  if(grid&&grid.querySelector("[data-action=copy]")&&!panel.querySelector(".abu-mode-legend")){
    const item=(mode,title,desc)=>make("li",{"data-mode":mode},[make("b",{text:title}),make("span",{text:desc})]);
    const legend=make("ul",{class:"abu-mode-legend","aria-label":"طرق تشغيل المهمة"},[
      item("group","جماعي على السبورة","من «تشغيل صفي». يُحتسب جلسة للمعلم دون درجات فردية."),
      item("individual","فردي باسم الطالب","من «تشغيل صفي». يُسجَّل باسم الطالب ودرجته."),
      item("homework","واجب منزلي","«نسخ رابط الواجب» ثم مشاركته؛ يلعب الطالب من المنزل باسمه.")
    ]);
    panel.insertBefore(legend,grid);
  }
  // Tables
  for(const wrap of $$(".table-wrap",panel)){
    if(!wrap.hasAttribute("tabindex")){wrap.tabIndex=0;wrap.setAttribute("role","region");wrap.setAttribute("aria-label",(txt(panel.querySelector("h2"))||"جدول")+" — يمكن تمريره أفقيًا");}
    const table=wrap.querySelector("table");if(!table||table.dataset.abuDone)continue;
    for(const td of $$("tbody td",table)){
      if(td.children.length===0){
        const t=txt(td);
        const tone=CHIP_TONES.find(([re])=>re.test(t));
        if(tone){td.textContent="";td.append(make("span",{class:"abu-chip","data-tone":tone[1],text:t}));continue;}
        if(/^(\d+(\.\d+)?%?|—)$/.test(t))td.dataset.abuNum="";
        if(t==="حساب محمي"){td.textContent="";td.append(make("span",{class:"abu-protected",text:t}));}
      }
    }
    for(const b of $$("[data-action=teacherStatus]",table))if(/^تفعيل$/.test(txt(b)))b.dataset.abuTone="positive";
    addRowFilter(wrap,table);
    table.dataset.abuDone="1";
  }
}
function addRowFilter(wrap,table){
  const rows=$$("tbody tr",table);if(rows.length<6||wrap.previousElementSibling?.classList.contains("abu-table-tools"))return;
  const id="abuFilter"+Math.random().toString(36).slice(2,8);
  const input=make("input",{type:"search",id,autocomplete:"off",placeholder:"اكتب اسمًا أو مهمة…"});
  const out=make("output",{for:id,"aria-live":"polite"});
  const tools=make("div",{class:"abu-table-tools"},[make("label",{for:id},[make("span",{text:"تصفية الصفوف المعروضة"}),input]),out]);
  const total=rows.length;
  const say=n=>{out.textContent=n===total?`${total} صفًا محمّلًا في هذه الصفحة`:`يظهر ${n} من ${total} صفًا محمّلًا في هذه الصفحة فقط`;};
  input.addEventListener("input",()=>{ // listener lives on our own new node; it is discarded with the panel on re-render
    const q=input.value.trim();let n=0;
    for(const r of rows){const hit=!q||r.textContent.includes(q);r.toggleAttribute("data-abu-filtered",!hit);if(hit)n++;}
    say(n);
  });
  say(total);wrap.parentNode.insertBefore(tools,wrap);
}

/* Class-run dialog: short hints under each mode button */
function enhanceDialog(){
  const box=doc.getElementById("modalContent");if(!box)return;
  for(const [action,hint] of [["classGroup","يُحتسب جلسة للمعلم دون درجات فردية"],["classIndividual","يُسجَّل باسم الطالب ودرجته"]]){
    const b=box.querySelector(`[data-action=${action}]`);
    if(b&&!b.querySelector(".abu-mode-hint"))b.append(make("span",{class:"abu-mode-hint",text:hint}));
  }
}

/* ---------------------------------------------------------------------
   3) Design studio (embedded settings panel)
   --------------------------------------------------------------------- */
function enhanceStudio(){
  const studio=doc.querySelector(".design-studio");if(!studio)return;
  const eyebrow=studio.querySelector(".ds-heading .eyebrow");
  if(eyebrow&&/MANARAT/i.test(eyebrow.textContent))eyebrow.textContent="مدرسة أبو عبيدة الإعدادية للبنين · استوديو التصميم والهوية";
  const status=doc.getElementById("dsStatus");
  if(status){
    const t=txt(status);
    const state=/غير محفوظة/.test(t)?"dirty":/تعذر|خطأ|فشل|تعارض/.test(t)?"error":/جارٍ|جار /.test(t)?"saving":"saved";
    if(status.dataset.state!==state)status.dataset.state=state;
  }
  for(const b of $$(".ds-tabs [data-module]",studio))if(!b.dataset.abuIcon)b.dataset.abuIcon=b.dataset.module;
}

/* ---------------------------------------------------------------------
   4) Admin shell (admin/admin.html)
   --------------------------------------------------------------------- */
function enhanceAdmin(){
  const side=doc.querySelector(".admin-side");if(!side||side.dataset.abuDone)return;
  const first=side.querySelector('[data-tab="school-settings"]');
  const content=side.querySelector('[data-tab="ai"],[data-tab="banks"],[data-tab="games"]');
  if(!first||!content)return; // admin-unified.js has not finished building the sidebar yet
  side.insertBefore(make("p",{class:"abu-side-group",role:"presentation",text:"الإدارة اليومية"}),first);
  side.insertBefore(make("p",{class:"abu-side-group",role:"presentation",text:"المحتوى والأسئلة"}),content);
  const adv=side.querySelector(".admin-advanced");
  if(adv&&!adv.previousElementSibling?.classList.contains("abu-side-group"))side.insertBefore(make("p",{class:"abu-side-group abu-side-group--tech",role:"presentation",text:"أدوات تقنية"}),adv);
  side.setAttribute("aria-label","أقسام لوحة الإدارة");
  side.dataset.abuDone="1";
}


/* ---------------------------------------------------------------------
   5) Ministry logo + school name at the top of every page
   - index.html pages: the studio-uploaded logo (#ministryLogoImg, set by
     school.js) always wins; layout is pure CSS (public.css).
   - admin/admin.html and teacher/create-game.html have no ministry slot in
     their markup; we add one inside the existing brand link, using the
     OFFICIAL file shipped with this layer. MINISTRY_ASSET stays empty until
     the school supplies that file — no logo is ever drawn or substituted.
   --------------------------------------------------------------------- */
const MINISTRY_ASSET=""; // e.g. "assets/ministry-logo.svg" (path relative to this script)
const MINISTRY_ALT="شعار وزارة التربية والتعليم والتعليم العالي - دولة قطر";
const ministryUrl=()=>{try{return MINISTRY_ASSET&&LAYER_BASE?new URL(MINISTRY_ASSET,LAYER_BASE).href:"";}catch{return "";}};
function ministryNode(extra){const span=make("span",{class:"abu-ministry"+(extra?" "+extra:"")});span.append(make("img",{src:ministryUrl(),alt:MINISTRY_ALT,decoding:"async"}));return span;}
function enhanceMinistry(){
  const url=ministryUrl();
  const brand=doc.querySelector(".topbar a.brand");
  if(brand&&url&&!brand.querySelector(".abu-ministry")){brand.prepend(ministryNode());brand.classList.add("abu-has-ministry");}
  const slot=doc.getElementById("ministryBrandSlot");
  if(slot&&slot.parentElement){
    if(url&&!slot.parentElement.querySelector(".abu-ministry--packaged"))slot.parentElement.insertBefore(ministryNode("abu-ministry--packaged"),slot);
    if(/[?&]designPreview=/.test(location.search))doc.documentElement.classList.add("abu-design-preview");
  }
}

/* ---------------------------------------------------------------------
   Header height → CSS var (sticky teacher tabs sit under the header)
   --------------------------------------------------------------------- */
function watchHeader(){
  const h=doc.getElementById("platformHeader");if(!h||!("ResizeObserver" in window))return;
  const set=()=>{const sticky=getComputedStyle(h).position==="sticky";doc.documentElement.style.setProperty("--abu-header-h",(sticky?Math.round(h.getBoundingClientRect().height):0)+"px");};
  new ResizeObserver(set).observe(h);set();
}

/* ---------------------------------------------------------------------
   Scheduler: one observer, batched, idempotent
   --------------------------------------------------------------------- */
let queued=false;
function pass(){
  queued=false;if(isGame())return;
  const t0=performance.now();window.__abuUI.passes++;
  try{enhanceStudio();}catch(e){console.warn("[abu-ui] studio",e);}
  try{enhancePanel();}catch(e){console.warn("[abu-ui] panel",e);}
  try{enhanceDialog();}catch(e){console.warn("[abu-ui] dialog",e);}
  try{enhanceAdmin();}catch(e){console.warn("[abu-ui] admin",e);}
  try{enhanceMinistry();}catch(e){console.warn("[abu-ui] ministry",e);}
  try{if(body().classList.contains("builder-page")||body().classList.contains("admin-page"))labelFields();}catch(e){console.warn("[abu-ui] labels",e);}
  window.__abuUI.ms=(window.__abuUI.ms||0)+(performance.now()-t0);
}
const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(pass);}};
function start(){
  if(!body()||/\/games\//.test(location.pathname))return;
  body().classList.add("abu-ui");
  watchHeader();pass();
  const targets=[doc.getElementById("app"),doc.getElementById("modal"),doc.querySelector(".admin-side"),doc.querySelector("main.page"),doc.getElementById("qModal")].filter(Boolean);
  const mo=new MutationObserver(records=>{
    // Ignore mutations we caused ourselves (abu-* nodes) to avoid feedback loops.
    for(const r of records){
      if(r.target&&r.target.nodeType===1&&(r.target.id==="dsStatus"||r.target.closest?.("#dsStatus"))){schedule();return;}
      for(const n of r.addedNodes){if(n.nodeType===1&&!(n.className&&String(n.className).startsWith("abu-"))){schedule();return;}}}
  });
  targets.forEach(t=>mo.observe(t,{childList:true,subtree:true}));
  window.__abuUI.observer=mo;
  // Late builders (admin-unified.js runs after DOMContentLoaded handlers)
  window.addEventListener("load",schedule,{once:true});
}
if(doc.readyState==="loading")doc.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
