const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function test() {
  const root = path.join(__dirname, '..', 'public');
  const types = { '.css': 'text/css', '.js': 'application/javascript', '.html': 'text/html', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const file = path.join(root, url.pathname === '/' ? 'index.html' : url.pathname);
    try {
      const bytes = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox'] });
    const page = await browser.newPage({viewport:{width:1366,height:850}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('manarat_v12_platform_store', JSON.stringify({platform:{brandName:'منارة التعلم الرقمي',background:'cosmic',accent1:'#f6c85f',accent2:'#18d2ff',accent3:'#7c3aed',homeFooter:'تذييل قديم'} }));
      localStorage.setItem('manarat_v10_auth_session', JSON.stringify({access_token:'browser-test',expires_at:9999999999,user:{id:'22222222-2222-4222-8222-222222222222',email:'teacher@example.test'}}));
    });
    let allowScripts, allowSettings;
    const scripts = new Promise(resolve => { allowScripts = resolve; });
    const settings = new Promise(resolve => { allowSettings = resolve; });
    const cfg={name:'مدرسة أبو عبيدة الإعدادية للبنين',design:{primary:'#802545'}};
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === base) {
        if (url.pathname.endsWith('.js')) await scripts;
        return route.continue();
      }
      if (url.pathname.endsWith('/school-api')) {
        const action=route.request().postDataJSON().action;
        if (action==='settings') await settings;
        const reply=action==='settings'?cfg:action==='designState'?{data:cfg,revision:'test',publicVideos:[]}:action==='dashboard'?{profile:{admin:true},teachers:[],sessions:[],assignments:[],games:[],videos:[]}:{admin:true};
        return route.fulfill({json:reply});
      }
      return route.fulfill({json:[]});
    });
    await page.goto(base+'/admin/admin.html',{waitUntil:'commit'});
    const settingsButton=page.locator('[data-tab="school-settings"]');
    await settingsButton.waitFor();
    const background=()=>page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor);
    assert.equal(await background(),'rgb(250, 248, 247)');
    assert(await settingsButton.evaluate(el=>el.classList.contains('active')));
    assert.equal(await page.locator('#tab-identity,[data-tab=identity],#tab-home,#tab-admins').count(),0);
    const frame=page.frameLocator('[data-school-panel=settings]');
    await frame.locator('#app').waitFor();
    assert(!(await frame.locator('#platformHeader').isVisible()));
    allowScripts();
    await page.waitForFunction(()=>!!window.Manarat);
    await page.waitForLoadState('domcontentloaded');
    assert.equal(await background(),'rgb(250, 248, 247)');
    assert.equal(await page.locator('body').getAttribute('data-bg'),null);
    assert(!(await page.locator('body').innerText()).includes('منارة التعلم'));
    allowSettings();
    await frame.locator('.design-studio').waitFor();
    await page.waitForFunction(()=>document.documentElement.style.getPropertyValue('--primary').toLowerCase()==='#802545');
    await page.evaluate(()=>{Manarat.applyPlatform();document.dispatchEvent(new CustomEvent('manarat:store-updated'));});
    assert.equal(await page.locator('body').getAttribute('data-bg'),null);
    await page.locator('[data-tab=school-teachers]').click();
    await page.frameLocator('[data-school-panel=teachers]').locator('#panel').waitFor();
    await settingsButton.click();
    assert(await frame.locator('.design-studio').isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS school admin shell before JS, pending settings, saved design, and panel switching');
  } finally {
    if(browser)await browser.close();
    server.close();
  }
}
test().catch(error=>{console.error(error);process.exitCode=1;});
