'use strict';
const fs=require('node:fs');
const before="const publicAction=['settings','homeHub','open','start','answer','finish','leaderboard','register','loginAlias'].includes(action);if(!publicAction)await M.ensureFreshSession();const token=publicAction?null:M.authSession()?.access_token;";
const after="// Classroom starts need the teacher session; homework remains anonymous.\nconst classroomStart=action==='start'&&['group','individual'].includes(payload.mode);const publicAction=!classroomStart&&['settings','homeHub','open','start','answer','finish','leaderboard','register','loginAlias'].includes(action);if(!publicAction)await M.ensureFreshSession();const token=publicAction?null:M.authSession()?.access_token;if(classroomStart&&!token)throw new Error('انتهت جلسة المعلم. سجّل الدخول من جديد لتشغيل المهمة في الصف.');";
for(const path of ['js/school.js','public/js/school.js']){const source=fs.readFileSync(path,'utf8');if(source.split(before).length!==2)throw new Error('Expected exactly one original auth block in '+path);fs.writeFileSync(path,source.replace(before,after));}
for(const path of ['index.html','public/index.html']){const source=fs.readFileSync(path,'utf8');const matches=source.match(/js\/school\.js\?v=[^"']+/g)||[];if(matches.length!==1)throw new Error('Unexpected school script reference in '+path);fs.writeFileSync(path,source.replace(matches[0],'js/school.js?v=21.12-classroom-auth'));}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
if(pkg.scripts['test:unit'].includes('classroom-auth'))throw new Error('Test already registered');
pkg.scripts['test:unit']+=' tests/classroom-auth.test.cjs';
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
console.log('Updated classroom authorization in source and public mirrors, cache versions and regression test registration.');
