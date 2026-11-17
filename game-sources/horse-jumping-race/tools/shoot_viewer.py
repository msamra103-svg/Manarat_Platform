import sys, asyncio, json
from playwright.async_api import async_playwright
# usage: shoot_viewer.py out_prefix view1,view2 [times...]
async def main():
    prefix = sys.argv[1]; views = sys.argv[2].split(','); times = [float(x) for x in (sys.argv[3].split(',') if len(sys.argv)>3 else ['1.0'])]
    extra = sys.argv[4] if len(sys.argv)>4 else ''
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width':1000,'height':620})
        logs=[]; pg.on('console', lambda m: logs.append(m.text)); pg.on('pageerror', lambda e: logs.append('ERR '+str(e)))
        for v in views:
            await pg.goto(f'file:///home/claude/horse-jumping-race/dev/viewer.html?view={v}{extra}')
            await pg.wait_for_function('window.__ready === true', timeout=60000)
            last=0
            for t in times:
                await pg.evaluate(f'window.__step({t-last})'); last=t
                await pg.screenshot(path=f'{prefix}_{v}_{t:.2f}.png')
        print('\n'.join(logs[:20]))
        await b.close()
asyncio.run(main())
