import asyncio, sys, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]
URL = sys.argv[2] if len(sys.argv) > 2 else 'file:///home/claude/horse-jumping-race/dist/index.html?capture&debug'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        logs=[]
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append('PAGEERROR '+str(e)))
        await pg.goto(URL)
        try:
            await pg.wait_for_function("window.HorseJumpingRace && window.HorseJumpingRace.debug && window.HorseJumpingRace.debug.state === 'ready'", timeout=90000)
        except Exception as e:
            print('not ready', e)
        await pg.evaluate("window.HorseJumpingRace.debug.advance(1.5)")
        await pg.screenshot(path=f'{OUT}/smoke_start.png')
        print('\n'.join([l for l in logs if 'GPU stall' not in l][:30]))
        await b.close()
asyncio.run(main())
