const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('js/core.js','utf8'),ctx={location:{href:'https://school.example/index.html'},URL};vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function schoolBranding('),src.indexOf('function defaultPlatform(')),ctx);
for(const code of ['123456','١٢٣٤٥٦','۱۲۳۴۵۶','https://school.example/live.html?code=123456'])assert.equal(ctx.resolveStudentEntry(code).href,'live.html?code=123456');
for(const code of ['abcdef012345abcdef012345','https://school.example/index.html?task=abcdef012345abcdef012345'])assert.equal(ctx.resolveStudentEntry(code).kind,'task');
for(const code of ['','12345','javascript:alert(1)','https://evil.test/'])assert.throws(()=>ctx.resolveStudentEntry(code));
const b=ctx.schoolBranding({brandName:'منارة التعلم الرقمي',siteAbout:'عن منارة التعلم الرقمي',siteContact:'للتواصل مع منارة',homeFooter:'منارة',logoImage:'assets/manarat-logo.svg',socialLinks:{facebook:'https://www.facebook.com/profile.php?id=61574253098010',youtube:'https://youtube.com/@school'},publicSocials:[{url:'https://instagram.com/mnrltlmlrqmy/',label:'Instagram'},{url:'https://example.com/school',label:'المدرسة'}]});assert.equal(b.brandName,'مدرسة أبو عبيدة الإعدادية للبنين');assert(!JSON.stringify(b).includes('منارة'));assert.equal(b.siteContact,'');assert.equal(b.logoImage,'school-mark.svg');assert.equal(b.socialLinks.youtube,'https://youtube.com/@school');assert.equal(b.publicSocials.length,1);
console.log('PASS unified entry: Arabic/Persian digits, task/live links, invalid codes, legacy branding removal and school links preserved');

const schoolDesign=require('../js/design-schema');
const serverDesign=require('../supabase/functions/_shared/design-schema');
const schoolVideo={id:'school-video',title:'زيارة منارة البحر'};
assert.equal(ctx.schoolBranding({youtubeVideos:[schoolVideo]}).youtubeVideos[0].id,schoolVideo.id);
for(const design of [schoolDesign,serverDesign]){
 const stored={name:'منارة التعلم الرقمي',about:'عن منارة التعلم الرقمي',contactText:'للتواصل مع منارة',
  logo:'assets/manarat-logo.svg?v=1',platformLogo:'assets/manarat-mark.svg',
  socials:[{label:'القناة',url:'https://youtube.com/@'+encodeURIComponent('منارةالتعلمالرقمي')},
   {label:'المدرسة',url:'https://example.school/100%'},null],homepageVideos:[schoolVideo]};
 const clean=design.normalize(stored);
 assert.equal(clean.name,'مدرسة أبو عبيدة الإعدادية للبنين');
 assert.equal(clean.about,'');
 assert.equal(clean.contactText,'');
 assert.equal(clean.logo,'assets/school-mark.svg');
 assert.equal(clean.platformLogo,'');
 assert.deepEqual(clean.socials,[stored.socials[1]]);
 assert.deepEqual(clean.homepageVideos,[schoolVideo]);
 assert.equal(design.normalize({about:'زيارة منارة البحر',logo:'assets/school-mark.svg'}).about,'زيارة منارة البحر');
 assert.equal(stored.socials.length,3);
}
console.log('PASS school display settings clean former profiles and logos while preserving educational content and custom links');
