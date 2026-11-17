# لقطات سريعة لمراحل مختلفة (للمراجعة البصرية): البداية، الجري، السؤال، التجاوز، النهاية، النتائج
import asyncio, sys
from playwright.async_api import async_playwright
OUT = sys.argv[1]
Q = sys.argv[2] if len(sys.argv) > 2 else 'medium'
D = 'window.HorseJumpingRace.debug'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        await pg.goto(f'file:///home/claude/horse-jumping-race/dist/index.html?capture&debug&quality={Q}')
        await pg.wait_for_function(f"{D}?.state === 'ready'", timeout=300000)
        key = await pg.evaluate('window.HORSE_JUMPING_RACE_SAMPLE_QUESTIONS.answerKey')
        st = lambda: pg.evaluate(f'{D}.state')
        await pg.evaluate(f'{D}.advance(1.0, 5)')
        await pg.screenshot(path=f'{OUT}/p01_start.png')
        await pg.fill('#qcr-player-name', 'عبدالله')
        await pg.click('[data-action="start"]')
        await pg.evaluate(f'{D}.advance(1.2, 10)')
        await pg.screenshot(path=f'{OUT}/p02_intro.png')
        shots = {1: (0.62, 'p04_jump'), 2: (0.9, 'p04b_landing'), 3: (3.5, 'p05_mid_race')}
        qn = 0
        while True:
            s = await st()
            if s == 'question':
                if qn == 0:
                    await asyncio.sleep(1.2)
                    await pg.screenshot(path=f'{OUT}/p03_question.png')
                cur = await pg.evaluate(f'{D}.current()')
                await pg.click(f'.qcr-choice[data-choice-id="{key[cur["questionId"]]["correctChoiceId"]}"]')
                await pg.evaluate(f'{D}.advance(0.1, 10)')
                await pg.click('[data-action="continue"]')
                qn += 1
                if qn in shots:
                    await pg.evaluate(f'{D}.advance({shots[qn][0]}, 60)')
                    await pg.screenshot(path=f'{OUT}/{shots[qn][1]}.png', timeout=120000)
                continue
            if s == 'finishing':
                m = await pg.evaluate(f'{D}.model()')
                pl = [r for r in m['racers'] if r['id'] == 'player'][0]
                if m['finishX'] - pl['d'] < 14 and not pl['finished']:
                    await pg.evaluate(f'{D}.advance(0.3, 10)')
                    await pg.screenshot(path=f'{OUT}/p06_finish.png')
                    while await st() != 'results':
                        await pg.evaluate(f'{D}.advance(0.5, 5)')
                    await pg.evaluate(f'{D}.advance(1.0, 5)')
                    await pg.screenshot(path=f'{OUT}/p07_results.png')
                    break
                await pg.evaluate(f'{D}.advance(0.2, 10)')
                continue
            await pg.evaluate(f'{D}.advance(0.6, 5)')
        await b.close()
asyncio.run(main())
