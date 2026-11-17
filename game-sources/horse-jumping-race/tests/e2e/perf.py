# قياس تكلفة الرسم لكل مستوى جودة (استدعاءات الرسم، المثلثات، الذاكرة) + زمن الإطار على SwiftShader.
# الاستخدام: python3 tests/e2e/perf.py OUT_JSON
import asyncio, json, sys, time
from playwright.async_api import async_playwright

D = 'window.HorseJumpingRace.debug'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'perf.json'

async def main():
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for q in ['low', 'medium', 'high']:
            pg = await b.new_page(viewport={'width': 1280, 'height': 720})
            await pg.goto(f'file:///home/claude/horse-jumping-race/dist/index.html?capture&debug&quality={q}')
            await pg.wait_for_function(f"{D}?.state === 'ready'", timeout=120000)
            await pg.evaluate("document.querySelector('[data-action=\"start\"]').click()")
            for _ in range(200):
                if await pg.evaluate(f'{D}.state') == 'running':
                    break
                await pg.evaluate(f'{D}.advance(0.25, 4)')
            await pg.evaluate(f'{D}.advance(1.5, 30)')
            info = await pg.evaluate(f'{D}.resources().scene')
            # زمن الإطار: متوسط ١٠ إطارات مرسومة
            t0 = time.time()
            for _ in range(10):
                await pg.evaluate(f'{D}.advance({1/30}, 30)')
            ms = (time.time() - t0) / 10 * 1000
            info['swiftshader_ms_per_frame'] = round(ms)
            res[q] = info
            print(q, info, flush=True)
            await pg.close()
        await b.close()
    with open(OUT, 'w') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)

asyncio.run(main())
