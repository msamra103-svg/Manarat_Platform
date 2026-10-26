const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('css/abu-ubaida-contrast.css');
assert(css.includes('.builder-page .q-admin-card b'),'Missing question-title correction');
assert(css.includes('.site-footer-global :is(h2,h3'),'Missing dark footer contrast correction');
assert(css.includes('.builder-page .export-actions'),'Missing toolbar contrast correction');
for(const f of ['index.html','admin/admin.html','teacher/create-game.html']){
 const h=read(f);
 assert(h.includes('abu-ubaida-contrast.css?v=21.2'),'Missing final theme from '+f);
 assert(!h.includes('manarat-mark.svg')&&!h.includes('manarat-logo.svg'),'Old brand logo in '+f);
}
for(const f of ['css/abu-ubaida-contrast.css','index.html','admin/admin.html','teacher/create-game.html','js/school.js']){
 assert.equal(read(f),read('public/'+f),'Deployment mirror mismatch '+f);
}
console.log('PASS: Abu Ubaida light theme contrast, legacy logo cleanup, footer rules and mirrored site assets');
