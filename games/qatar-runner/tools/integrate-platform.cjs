#!/usr/bin/env node
/* عدّاء قطر — adds the game to a LOCAL checkout of the Abu Ubaida platform (msamra103-svg/Manarat_Platform).
 * Review package helper: it edits files in the folder you pass, never pushes, deploys or touches Supabase.
 *   node tools/integrate-platform.cjs <path-to-platform-checkout> [--dry]
 * Every edit is an exact string replacement that must match once; if the platform has changed since
 * V20.3 (commit dfe6450, 28 Oct 2026) the script stops and lists what did not match, editing nothing.
 */
'use strict';
const fs = require('fs'), path = require('path');
const plat = path.resolve(process.argv[2] || ''), dry = process.argv.includes('--dry'), here = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(plat, 'js/school.js'))) { console.error('Not a platform checkout: ' + plat); process.exit(2); }
const KEY = 'qatar-runner', NAME = 'عدّاء قطر';
const ICON = '<circle cx="14.5" cy="4" r="2"/><path d="M8 21l3.2-6.2 3.3 2.7V22M5.5 11.5l3.2-3h5.2l2.6 3.2 3 .6M11.2 14.8l-.9-4.3"/>';
const edits = {
  'js/school.js': [
    ["'target-shooting':['🎯','التصويب على الهدف'],", "'target-shooting':['🎯','التصويب على الهدف'],'qatar-runner':['🏃','" + NAME + "'],"],
    ["'target-shooting':'sports',puzzle:'mind'", "'target-shooting':'sports','qatar-runner':'speed',puzzle:'mind'"],
    ["classic:'<path d=\"M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z\"/>'};", "classic:'<path d=\"M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z\"/>','qatar-runner':'" + ICON + "'};", 1],
    ["'fishing','target-shooting']", "'fishing','target-shooting','qatar-runner']", 'all'],
    ["'fishing','target-shooting','puzzle','classic']", "'fishing','target-shooting','qatar-runner','puzzle','classic']", 'all'],
    ["['volleyball','fishing','puzzle','classic'].includes(play.template)", "['volleyball','fishing','qatar-runner','puzzle','classic'].includes(play.template)"],
    ["'target-shooting':'تصويب تعليمي',", "'target-shooting':'تصويب تعليمي','qatar-runner':'جري 3D في الدوحة',"],
    ["'target-shooting':'شاهد الرامي يشد القوس، ثم أجب عن السؤال؛ سهمك يصيب عند الإجابة الصحيحة.',", "'target-shooting':'شاهد الرامي يشد القوس، ثم أجب عن السؤال؛ سهمك يصيب عند الإجابة الصحيحة.','qatar-runner':'اجرِ في شوارع الدوحة، تفادَ العوائق، وأجب عند بوابة السؤال ليفتح طريقك.',"],
    [" classic:{key:'classic',name:'تحدّي المعرفة'", " 'qatar-runner':{key:'qatar-runner',name:'" + NAME + "',badge:'جري 3D في الدوحة',headline:'اجرِ في كورنيش الدوحة وسوق واقف وافتح بوابات الأسئلة',pitch:'ولد قطري يجري بين المسارات الثلاثة، يقفز وينزلق، وتفتح الإجابة الصحيحة بوابة السؤال المضيئة.',cover:'assets/game-covers/qatar-runner.svg'},\n classic:{key:'classic',name:'تحدّي المعرفة'"],
    ["const order=['football','volleyball','basketball','race','bowling','fishing','target-shooting','classic'];", "const order=['football','volleyball','basketball','race','bowling','fishing','target-shooting','qatar-runner','classic'];"],
    ["sport==='target-shooting'?{school:String(config?.name||OFFICIAL_SCHOOL_NAME),student:String(play.studentName||''),shooting:assignment.settings?.shooting||null}:{}", "sport==='target-shooting'?{school:String(config?.name||OFFICIAL_SCHOOL_NAME),student:String(play.studentName||''),shooting:assignment.settings?.shooting||null}:sport==='qatar-runner'?{school:String(config?.name||OFFICIAL_SCHOOL_NAME),teacher:String(assignment.teacher||''),student:String(play.studentName||'')}:{}"]
  ],
  'js/homepage-hub-logic.js': [
    ["    classic: {\n      key: 'classic',", "    'qatar-runner': {\n      key: 'qatar-runner',\n      name: '" + NAME + "',\n      badge: 'جري 3D في الدوحة',\n      eyebrow: 'سرعة وتركيز وتعلّم',\n      headline: 'اجرِ في كورنيش الدوحة وسوق واقف وافتح بوابات الأسئلة',\n      pitch: 'ولد قطري يجري بين المسارات الثلاثة، يقفز وينزلق، وتفتح الإجابة الصحيحة بوابة السؤال المضيئة.',\n      cover: 'assets/game-covers/qatar-runner.svg',\n      playableDemo: true\n    },\n    classic: {\n      key: 'classic',"],
    ["const defaultOrder = ['football', 'volleyball', 'basketball', 'race', 'bowling', 'fishing', 'target-shooting', 'classic', 'puzzle'];", "const defaultOrder = ['football', 'volleyball', 'basketball', 'race', 'bowling', 'fishing', 'target-shooting', 'qatar-runner', 'classic', 'puzzle'];"]
  ],
  'js/design-schema.js': [["const gameKeys=['football','volleyball','basketball','race','bowling','fishing','target-shooting','classic','puzzle'];", "const gameKeys=['football','volleyball','basketball','race','bowling','fishing','target-shooting','qatar-runner','classic','puzzle'];"]],
  'supabase/functions/_shared/design-schema.js': [["const gameKeys=['football','volleyball','basketball','race','bowling','fishing','target-shooting','classic','puzzle'];", "const gameKeys=['football','volleyball','basketball','race','bowling','fishing','target-shooting','qatar-runner','classic','puzzle'];"]],
  'js/design-studio.js': [["'target-shooting':'التصويب على الهدف',classic:'تحدّي المعرفة'", "'target-shooting':'التصويب على الهدف','qatar-runner':'" + NAME + "',classic:'تحدّي المعرفة'"]],
  'js/platform-nav.js': [["fishing|target-shooting|puzzle|classic", "fishing|target-shooting|qatar-runner|puzzle|classic"]],
  'supabase/functions/school-api/index.ts': [
    ["const templates=['race','football','basketball','volleyball','bowling','fishing','target-shooting','puzzle','classic'];", "const templates=['race','football','basketball','volleyball','bowling','fishing','target-shooting','qatar-runner','puzzle','classic'];"],
    [" 'target-shooting':['التصويب على الهدف','٤ تحديات رماية 3D','assets/game-covers/target-shooting.svg'],", " 'target-shooting':['التصويب على الهدف','٤ تحديات رماية 3D','assets/game-covers/target-shooting.svg'],\n 'qatar-runner':['" + NAME + "','جري 3D في الدوحة','assets/game-covers/qatar-runner.svg'],"]
  ],
  'package.json': [["\"build:target-shooting-offline\":", "\"test:qatar-runner\": \"node games/qatar-runner/tests/run-all.cjs && node tests/qatar-runner-integration.cjs\",\n    \"build:target-shooting-offline\":"]]
};
const problems = [], out = {};
for (const [file, list] of Object.entries(edits)) {
  const p = path.join(plat, file); if (!fs.existsSync(p)) { problems.push(file + ': missing'); continue; }
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes("'qatar-runner'") || s.includes('qatar-runner|') || s.includes('test:qatar-runner')) { problems.push(file + ': already contains qatar-runner (already integrated?)'); continue; }
  for (const [a, b, mode] of list) {
    const n = s.split(a).length - 1;
    if (mode === 'all') { if (n < 1) { problems.push(file + ': not found: ' + a.slice(0, 90)); continue; } s = s.split(a).join(b); }
    else { if (n !== 1) { problems.push(file + ': expected 1 match, found ' + n + ': ' + a.slice(0, 90)); continue; } s = s.replace(a, b); }
  }
  out[p] = s;
}
if (problems.length) { console.error('Integration stopped, nothing was written:\n - ' + problems.join('\n - ')); process.exit(1); }
if (dry) { console.log('Dry run OK: ' + Object.keys(out).length + ' files would change.'); process.exit(0); }
for (const [p, s] of Object.entries(out)) fs.writeFileSync(p, s);
// game files (runtime only) + cover + integration test
const copy = (src, dst) => { const st = fs.statSync(src); if (st.isDirectory()) { fs.mkdirSync(dst, { recursive: true }); for (const e of fs.readdirSync(src)) copy(path.join(src, e), path.join(dst, e)); } else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); } };
const game = path.join(plat, 'games', KEY);
for (const item of ['index.html', 'teacher.html', 'css', 'js', 'vendor', 'assets', 'docs', 'tests', 'README.md']) if (fs.existsSync(path.join(here, item))) copy(path.join(here, item), path.join(game, item));
copy(path.join(here, 'assets/cover/qatar-runner.svg'), path.join(plat, 'assets/game-covers/qatar-runner.svg'));
copy(path.join(here, 'platform/qatar-runner-integration.cjs'), path.join(plat, 'tests/qatar-runner-integration.cjs'));
console.log('Integrated into ' + plat + ' (local files only). Next: npm run sync && npm run test:qatar-runner');
