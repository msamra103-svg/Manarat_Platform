const {chromium}=require('playwright'),fs=require('fs'),http=require('http'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,'http://x').pathname);if(file.endsWith('/'))file+='index.html';fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);return res.end('not found')}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(d);});});
const teacher='22222222-2222-4222-8222-222222222222',questions=[{id:'q1',type:'multiple_choice',text:'ما العنصر الذي يحتاجه النبات؟',options:['الماء','البلاستيك'],points:10},{id:'q2',type:'open_text',text:'اشرح أهمية الماء.',points:10}];
const config={name:'مدرسة أبو عبيدة الإعدادية للبنين',subtitle:'منصة التعلّم التفاعلي',primary:'#8a1538',background:'#f8f6f4',hero:'تعلّم بطريقتك. وتقدّم كل يوم.',description:'ألعاب تعليمية ومهمات صفية وواجبات منزلية، في مساحة واحدة تجمع معلمي المدرسة وطلابها.',socials:[],sections:['games','videos','about']};
const assignment={id:'as',code:'code',teacher_id:teacher,title:'لعبة النباتات المائية',game_id:'g',class_name:'سابع 1',active:true,settings:{templates:['race','football','basketball','volleyball','bowling','fishing','puzzle','classic'],types:['multiple_choice','open_text']},types:['multiple_choice','open_text'],videos:[]};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let answers=0;
await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1')return r.continue();if(u.pathname.endsWith('/school-api')){const b=r.request().postDataJSON();let j={};switch(b.action){case'settings':j=config;break;case'designState':j={data:config,revision:'2026-10-24',preview:false,publicVideos:[]};break;case'homeHub':j={videos:[{key:'yt:dQw4w9WgXcQ',id:'dQw4w9WgXcQ',youtubeId:'dQw4w9WgXcQ',kind:'youtube',title:'مقدمة التفاعلات الكيميائية',subject:'العلوم العامة',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',embedUrl:'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',thumbnail:'',featured:true},{key:'url:https://example.test/lesson2.mp4',id:'v2',youtubeId:'',kind:'direct',title:'مراجعة الهندسة الفضائية',subject:'الرياضيات',url:'https://example.test/lesson2.mp4',embedUrl:'https://example.test/lesson2.mp4',thumbnail:'',featured:false}],weekly:{week:{labelAr:'الأحد ١٨ أكتوبر – السبت ٢٤ أكتوبر'},champions:[{grade:'7',title:'نجم الصف السابع',gradeLabel:'الصف السابع',hasWinner:true,studentName:'عبدالله م. الكواري',className:'الصف السابع / ١',avgScore:96,metricLabel:'متوسط 96% · 3 مهمات مكتملة'},{grade:'8',title:'نجم الصف الثامن',gradeLabel:'الصف الثامن',hasWinner:true,studentName:'تميم ف. العطية',className:'الصف الثامن / ٢',avgScore:93,metricLabel:'متوسط 93% · مهمتان مكتملتان'},{grade:'9',title:'نجم الصف التاسع',gradeLabel:'الصف التاسع',hasWinner:false,studentName:null,className:'الصف التاسع',avgScore:null,emptyPrompt:'من سيكون نجم الصف التاسع هذا الأسبوع؟',metricLabel:'أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف التاسع.'}],topGames:[{rank:1,key:'football',name:'كرة القدم',badge:'ملعب 3D',cover:'assets/game-covers/football.svg',sessionsCount:28,uniqueStudents:19,sharePercent:100},{rank:2,key:'volleyball',name:'الكرة الطائرة',badge:'تداول 6×6',cover:'assets/game-covers/volleyball.svg',sessionsCount:21,uniqueStudents:15,sharePercent:75},{rank:3,key:'race',name:'سباق السيارات',badge:'حلبة 3D',cover:'assets/game-covers/race.svg',sessionsCount:16,uniqueStudents:12,sharePercent:57}],activeTeachers:[{id:teacher,name:'أ. خالد المنصوري',subject:'العلوم · الرياضيات',summaryText:'4 مهمات نشطة · 28 مشاركة طلابية',engagementScore:400}]},puzzleAvailable:false};break;case'profile':j={id:teacher,name:'معلم الاختبار',admin:true};break;case'dashboard':j={profile:{id:teacher,name:'معلم الاختبار',admin:true},games:[{id:'g',title:'لعبة النباتات المائية',teacher_id:teacher,data:{questions}}],assignments:[assignment],videos:[],sessions:[],teachers:[]};break;case'open':j=assignment;break;case'start':j={id:'s',secret:'secret',questions,threshold:70};break;case'answer':answers++;j={correct:b.question==='q1',pending:b.question==='q2',feedback:'تم تسجيل إجابتك',explanation:''};break;case'finish':j={score:50,pending:true,group:false};break;case'settingsHistory':case'leaderboard':case'saveSettings':j=[];break;case'assignment':j=assignment;break;}return r.fulfill({json:j});}return r.fulfill({json:[]});});
await page.goto(base);await page.locator('.hero').waitFor();const gameKeys=require('../js/design-schema').gameKeys;
await page.locator('#footer .v21-footer-nav a').first().waitFor();
await page.evaluate(()=>document.fonts.ready);
for (const width of [1326, 768, 390, 320]) {
  await page.setViewportSize({width, height:844});
  const layout = await page.locator('#footer').evaluate(footer => {
    const brand = footer.querySelector('.footer-brand-row');
    const nav = footer.querySelector('.v21-footer-nav');
    const center = document.documentElement.clientWidth / 2;
    function lineOffsets(row) {
      const lines = new Map();
      for (const item of row.children) {
        const box = item.getBoundingClientRect();
        if (!box.width) continue;
        const key = Math.round((box.top + box.bottom) / 2);
        const line = lines.get(key) || {left:Infinity, right:-Infinity};
        line.left = Math.min(line.left, box.left);
        line.right = Math.max(line.right, box.right);
        lines.set(key, line);
      }
      return [...lines.values()].map(line => Math.abs((line.left + line.right) / 2 - center));
    }
    return {
      offsets:[...lineOffsets(brand), ...lineOffsets(nav)],
      stacked:nav.getBoundingClientRect().top >= brand.getBoundingClientRect().bottom,
      fits:footer.scrollWidth <= document.documentElement.clientWidth
    };
  });
  assert(layout.offsets.length > 0 && layout.offsets.every(offset => offset <= 1), 'Footer content must be centered at ' + width);
  assert(layout.stacked && layout.fits, 'Footer rows must stack and fit at ' + width);
}
await page.setViewportSize({width:1440,height:1000});
console.log('PASS centered school identity and footer navigation');
await page.locator('#galleryQuery').fill('كُرَة القَدَم');
assert.equal(await page.locator('.game-cover-card:visible').count(),1);
assert.equal(await page.locator('.game-cover-card:visible').getAttribute('data-game'),'football');
await page.locator('[data-action=filterGames][data-id=mind]').click();
assert(await page.locator('#galleryEmpty').isVisible());
await page.locator('[data-action=resetGallery]').click();
assert.equal(await page.locator('.game-cover-card:visible').count(),14);
assert(!await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('/js/student-analytics.js'))));
const galleryKeys=await page.locator('.games-gallery [data-game]').evaluateAll(cards=>cards.map(card=>card.dataset.game));
assert.deepEqual(galleryKeys.sort(),[...gameKeys].sort());
assert.equal(await page.locator('.games-gallery [data-game=puzzle] .game-launch-btn').getAttribute('href'),'index.html?demo=puzzle');
assert.equal(await page.locator('[data-testid^="champion-card-grade-"]').count(),3);assert((await page.locator('[data-testid="champion-card-grade-7"]').innerText()).includes('عبدالله م. الكواري'));assert((await page.locator('[data-testid="champion-card-grade-9"]').innerText()).includes('من سيكون نجم الصف التاسع هذا الأسبوع؟'));assert.equal(await page.locator('[data-testid="top-game-row"]').count(),3);assert.equal(await page.locator('[data-testid="active-teacher-card"]').count(),1);assert(await page.locator('[data-testid="homepage-video-gallery"]').isVisible());const selectedVideo=page.locator('[data-action="selectHomeVideo"]').nth(1);const selectedVideoKey=await selectedVideo.getAttribute('data-id');await selectedVideo.click();await page.waitForFunction(key=>{const button=Array.from(document.querySelectorAll('[data-action="selectHomeVideo"]')).find(b=>b.dataset.id===key);return Boolean(button?.classList.contains('active')&&document.querySelector('#activeHomeVideoTitle')?.textContent?.trim());},selectedVideoKey);await page.locator('[data-action="heroNext"]').click();await page.screenshot({path:__dirname+'/school-home.png',fullPage:true});console.log('PASS homepage');
for(const id of ['weeklyChampionsSection','weeklyTopGamesSection','schoolVideosSection','gamesGallerySection']){await page.locator(`[data-v-target="${id}"]`).click();assert.equal(await page.locator('#primaryNavTabs [aria-current=location]').getAttribute('data-v-target'),id);await page.waitForTimeout(1600);console.log('NAV geometry',id,await page.evaluate(id=>({top:document.getElementById(id).getBoundingClientRect().top,header:document.getElementById('platformHeader').getBoundingClientRect().bottom,y:scrollY}),id));assert.equal(await page.locator('#primaryNavTabs [aria-current=location]').getAttribute('data-v-target'),id);assert(await page.locator('#'+id).evaluate(el=>el.getBoundingClientRect().top>=document.getElementById('platformHeader').getBoundingClientRect().bottom-2));}
const rankingBoxes=await page.locator('.top-game-row').evaluateAll(els=>els.map(el=>({top:el.getBoundingClientRect().top,width:el.getBoundingClientRect().width})));assert(Math.abs(rankingBoxes[0].top-rankingBoxes[1].top)<2);assert(rankingBoxes[0].width<500);
assert.equal(await page.locator('.hero-school-name').innerText(),config.name);const badgeColors=await page.locator('.hero-school-name').evaluate(badge=>{
 const body=document.body,initial=body.dataset.heroBackdrop;
 const sample=document.createElement('span');
 sample.style.color='var(--abu-brand)';
 badge.append(sample);
 try{
  const brand=getComputedStyle(sample).color;
  body.dataset.heroBackdrop='maroon';
  const maroonText=getComputedStyle(badge).color;
  body.dataset.heroBackdrop='light';
  return {brand,maroonText,lightText:getComputedStyle(badge).color};
 }finally{
  sample.remove();
  if(initial===undefined)delete body.dataset.heroBackdrop;
  else body.dataset.heroBackdrop=initial;
 }
});
assert.equal(badgeColors.maroonText,'rgb(255, 255, 255)');
assert.equal(badgeColors.lightText,badgeColors.brand);
assert.notEqual(badgeColors.lightText,badgeColors.maroonText);
assert(await page.locator('.video-thumb-btn').evaluateAll(els=>els.every(el=>{const a=el.getBoundingClientRect(),b=el.querySelector('.video-thumb-preview').getBoundingClientRect();return b.left>=a.left&&b.right<=a.right&&Math.abs(b.width/b.height-16/9)<.05;})));
console.log('PASS active navigation, compact ranking grid, readable identity and media proportions');for(const w of [390,768,1024]){await page.setViewportSize({width:w,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'overflow '+w);}console.log('PASS responsive widths');await page.setViewportSize({width:1440,height:1000});
await page.locator('#joinCode').fill('١٢٣٤٥٦');await page.locator('#joinForm button').click();await page.waitForURL('**/live.html?code=123456');await page.locator('#studentName').waitFor();assert.equal(await page.locator('#code').inputValue(),'123456');assert.equal(await page.locator('.site-footer-global').count(),0);assert(!(await page.locator('body').innerText()).includes('منارة'));await page.goto(base+'/');await page.locator('#joinCode').waitFor();
await page.locator('#joinCode').fill('abcdef012345abcdef012345');await page.locator('#joinForm button').click();await page.locator('#studentName').fill('طالب الاختبار');await page.locator('[data-action=selectTemplate][data-id=classic]').click();await page.locator('#startForm button').last().click();await page.locator('[data-action=answer]').first().click();await page.locator('[data-action=next]').click();await page.locator('#answerText').fill('الماء ضروري للنمو');await page.locator('[data-action=textAnswer]').click();await page.locator('[data-action=next]').click();await page.locator('.result-score').waitFor();assert((await page.locator('#app').innerText()).includes('لعبة النباتات المائية'));assert.equal(answers,2);console.log('PASS individual assignment and scoring UI');
await page.evaluate(({teacher})=>{localStorage.setItem(Manarat.AUTH_SESSION_KEY,JSON.stringify({access_token:'test',expires_at:9999999999,user:{id:teacher,email:'t@example.invalid',user_metadata:{name:'معلم'}}}));},{teacher});
await page.goto(base);
await page.locator('#adminLink').waitFor();
await page.locator('#galleryQuery').waitFor();
await page.evaluate(()=>document.fonts.ready);
for(const width of [1335,1280,1152,1024,540,390,320]){
 await page.setViewportSize({width,height:844});
 const desktop=width>1150;
 const geometry=await page.locator('#platformTopNav').evaluate(nav=>{
  const boxes=selector=>Array.from(nav.querySelectorAll(selector),el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
  const links=boxes('#primaryNavTabs a'),actions=boxes('.nav-actions-cluster > *');
  const bounds=nav.getBoundingClientRect(),track=nav.querySelector('#primaryNavTabs');
  const controls=[...links,...actions];
  return {actionCount:actions.length,linkCount:links.length,
   oneLine:controls.every(r=>r.top<controls[0].bottom&&r.bottom>controls[0].top),
   allFit:track.scrollWidth<=track.clientWidth+1&&controls.every(r=>r.left>=bounds.left-1&&r.right<=bounds.right+1),
   pageFits:document.documentElement.scrollWidth<=innerWidth+1};
 });
 assert.equal(geometry.actionCount,desktop?4:5,'admin actions at '+width);
 assert.equal(geometry.linkCount,desktop?6:0,'section links at '+width);
 assert(geometry.oneLine&&geometry.allFit&&geometry.pageFits,'all controls share one visible row at '+width+' '+JSON.stringify(geometry));
 if(!desktop){
  const menu=page.locator('#mobileNavBtn'),about=page.locator('#primaryNavTabs [data-v-target=aboutSchoolSection]');
  await menu.click();await about.click();
  assert.equal(await menu.getAttribute('aria-expanded'),'false');
  assert.equal(await about.getAttribute('aria-current'),'location');
 }
}
console.log('PASS admin header fits one row and About stays reachable on desktop, tablet and mobile');
await page.setViewportSize({width:1440,height:1000});
await page.goto(base+'/?dashboard=1');await page.locator('[data-testid="recharts-student-analytics"] svg.recharts-surface').first().waitFor();await page.locator('[data-testid="chart-tab-students"]').click();assert((await page.locator('[data-testid="recharts-student-analytics"]').innerText()).includes('لا توجد محاولات فردية مكتملة'));await page.locator('[data-testid="chart-tab-progression"]').click();console.log('PASS Recharts student progression charts in teacher dashboard');await page.locator('[data-action=assign]').click();assert.deepEqual((await page.locator('[name=templates]').evaluateAll(inputs=>inputs.map(input=>input.value))).sort(),gameKeys.filter(key=>key!=='puzzle').sort());await page.locator('#closeModal').click();await page.locator('[data-action=tab][data-id=settings]').click();await page.locator('[data-module=contact]').click();await page.locator('[data-design-path=name]').fill('معاينة المدرسة');await page.frameLocator('#dsPreview').locator('#brandName').filter({hasText:'معاينة المدرسة'}).waitFor();assert.equal(await page.locator('#brandName').innerText(),config.name);console.log('PASS assignment controls and preview isolation');await page.locator('[data-action=tab][data-id=reports]').click();await page.locator('[data-testid="recharts-student-analytics"] svg.recharts-surface').first().waitFor();const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=export]').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'سجل-إنجاز-الطلاب.csv');assert(fs.readFileSync(await download.path(),'utf8').includes('الطالب'));console.log('PASS CSV filename and contents');
await page.locator('[data-action=tab][data-id=games]').click();
await page.locator('.latest-assignment [data-action=class]').click();
await page.locator('[data-action=classGroup]').click();
await page.clock.install();
await page.locator('#reviewMinutes').selectOption('3');
await page.locator('[data-action=selectTemplate][data-id=football]').click();
await page.locator('#startForm button[type=submit]').click();
const classroomFrame=await page.locator('#footballGame').elementHandle();
assert(await page.locator('body.classroom-board').isVisible());
assert((await classroomFrame.getAttribute('src')).includes('assist=simple'));
await page.locator('[data-action=toggleBoard]').click();
assert.equal(await page.locator('body.classroom-board').count(),0);
assert(await classroomFrame.evaluate(el=>el===document.querySelector('#footballGame')));
const scores=await page.locator('.session-scores').innerText();
await page.clock.fastForward(181000);
await page.waitForFunction(()=>document.querySelector('[data-review-clock]')?.textContent==='انتهى وقت المراجعة');
assert.equal(await page.locator('.session-scores').innerText(),scores);
assert(await classroomFrame.evaluate(el=>el.isConnected));
console.log('PASS classroom timer, board toggle and uninterrupted game');
await page.goto(base+'/?task=code');await page.locator('#studentName').fill('طالب السباق');await page.locator('[data-action=selectTemplate][data-id=race]').click();await page.locator('#startForm button').last().click();const rf=page.frameLocator('#originalRace');await rf.locator('#menu-screen').waitFor();const frame=page.frames().find(f=>f.url().includes('/games/champions-race/index.html?school=1'));await frame.waitForFunction(()=>typeof THREE!=='undefined'&&GameEngine.renderer,{},{timeout:20000});assert.equal(await frame.evaluate(()=>APP_CONFIG.gameTitle),'لعبة النباتات المائية');await frame.evaluate(()=>{GameEngine.startNewRace();GameEngine.openQuestionForCurrentCheckpoint();});await page.locator('#modal [data-action=answer]').first().click();await page.locator('#modal [data-action=next]').click();assert.equal(await page.locator('#modal').isVisible(),false);console.log('PASS Champions Race V8 3D checkpoint bridge');questions.splice(0,questions.length,{id:'p1',type:'puzzle_image',text:'أكمل الصورة',image:'data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="maroon"/></svg>').toString('base64'),puzzle_grid:3});await page.goto(base+'/?task=code');await page.locator('#studentName').fill('طالب البازل');await page.locator('[data-action=selectTemplate][data-id=classic]').click();await page.locator('#startForm button').last().click();await page.locator('#originalPuzzle').scrollIntoViewIfNeeded();await page.screenshot({path:__dirname+'/puzzle-debug.png',fullPage:true});await page.frameLocator('#originalPuzzle').locator('#startChallengeBtn').click();const pf=await (await page.locator('#originalPuzzle').elementHandle()).contentFrame();await pf.waitForFunction(()=>game.pieces.length===9);
const canvas=pf.locator('#puzzleCanvas');
await canvas.focus();
async function movePuzzleCursor(row,col){
 const current=await pf.evaluate(()=>game.keyboardCell);
 for(let i=0;i<Math.abs(current.row-row);i++)await canvas.press(current.row<row?'ArrowDown':'ArrowUp');
 for(let i=0;i<Math.abs(current.col-col);i++)await canvas.press(current.col<col?'ArrowRight':'ArrowLeft');
}
for(let placed=0;placed<9;placed++){
 await canvas.press('Space');
 const target=await pf.evaluate(()=>({row:game.selectedPiece.row,col:game.selectedPiece.col}));
 if(placed===0){
  await movePuzzleCursor(target.row,(target.col+1)%3);
  await canvas.press('Enter');
  assert.equal(await pf.evaluate(()=>game.lockedCount),0);
 }
 await movePuzzleCursor(target.row,target.col);
 await canvas.press('Enter');
 assert.equal(await pf.evaluate(()=>game.lockedCount),placed+1);
}
await page.locator('#feedback .feedback').waitFor();console.log('PASS original puzzle loads nine pieces and completion bridge');assert.deepEqual(errors,[]);await browser.close();server.close();console.log('SCHOOL BROWSER ALL PASS');})().catch(e=>{console.error(e);server.close();process.exit(1)});
