# لقطات سريعة من اللعبة مع إجابات محددة: python3 tools/dev/shot_game.py OUT_PREFIX [quality] [plan]
# plan مثل "c,w,c": لكل سؤال c صحيح / w خطأ (ثم صحيح). تُلتقط لقطات عند: الافتتاحية، الاقتراب، منتصف القفزة، الرفض.
import asyncio, sys
from playwright.async_api import async_playwright
OUT = sys.argv[1]; Q = sys.argv[2] if len(sys.argv) > 2 else 'high'
PLAN = (sys.argv[3] if len(sys.argv) > 3 else 'c,w').split(',')
D = 'window.HorseJumpingRace.debug'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto(f'file:///home/claude/horse-jumping-race/dist/index.html?capture&debug&quality={Q}')
        await pg.wait_for_function(f"{D}?.state === 'ready'", timeout=300000)
        key = await pg.evaluate('window.HORSE_JUMPING_RACE_SAMPLE_QUESTIONS.answerKey')
        n = 0
        async def shot(name):
            nonlocal n
            await pg.evaluate(f'{D}.advance(0.001, 30)')
            await pg.screenshot(path=f'{OUT}_{n}_{name}.png', timeout=300000); n += 1
        await shot('menu')
        await pg.evaluate("document.querySelector('[data-action=\"start\"]').click()")
        await pg.evaluate(f'{D}.advance(1.5, 30)')
        await shot('intro')
        qi = 0; tried = {}
        for _ in range(4000):
            st = await pg.evaluate(f'{D}.state')
            if st == 'question':
                cur = await pg.evaluate(f'{D}.current()')
                idx = cur['index']
                want = PLAN[idx] if idx < len(PLAN) else None
                if want is None: break
                right = key[cur['questionId']]['correctChoiceId']
                wrong = next(c for c in cur['choices'] if c != right)
                first = idx not in tried
                ch = wrong if (want == 'w' and first) else right
                tried[idx] = True
                if first: await shot(f'q{idx}')
                await pg.evaluate(f"document.querySelector('.qcr-choice[data-choice-id=\"{ch}\"]').click()")
                for _ in range(40):
                    if await pg.evaluate(f'{D}.state') == 'feedback': break
                    await pg.evaluate(f'{D}.advance(0.1, 10)')
                await shot(f'fb{idx}')
                await pg.evaluate("document.querySelector('[data-action=\"continue\"]').click()")
                if ch == right:
                    await pg.evaluate(f'{D}.advance(0.62, 60)'); await shot(f'jump{idx}')
                    await pg.evaluate(f'{D}.advance(0.2, 60)'); await shot(f'land{idx}')
                else:
                    await pg.evaluate(f'{D}.advance(0.55, 60)'); await shot(f'refuse{idx}')
                    await pg.evaluate(f'{D}.advance(0.9, 60)'); await shot(f'turn{idx}')
            else:
                await pg.evaluate(f'{D}.advance(0.2, 15)')
        print(errs[:5])
        await b.close()
asyncio.run(main())
