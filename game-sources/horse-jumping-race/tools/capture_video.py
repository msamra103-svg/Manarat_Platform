# تسجيل مقطع من التشغيل الفعلي (وضع الالتقاط الحتمي) ثم تجميعه بـ ffmpeg.
# الاستخدام: python3 tools/capture_video.py OUT_DIR
import asyncio, sys, os, shutil, subprocess
from playwright.async_api import async_playwright

OUT = sys.argv[1]
FR = os.path.join(OUT, 'frames')
shutil.rmtree(FR, ignore_errors=True)
os.makedirs(FR)
FPS = 15
D = 'window.HorseJumpingRace.debug'
n = 0

async def main():
    global n
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        await pg.goto('file:///home/claude/horse-jumping-race/dist/index.html?capture&debug&quality=high')
        await pg.wait_for_function(f"{D}?.state === 'ready'", timeout=300000)
        key = await pg.evaluate('window.HORSE_JUMPING_RACE_SAMPLE_QUESTIONS.answerKey')

        async def snap():
            global n
            path = os.path.join(FR, f'{n:05d}.jpg')
            await pg.screenshot(path=path, type='jpeg', quality=88)
            n += 1
            return path

        async def render(seconds):
            for _ in range(round(seconds * FPS)):
                await pg.evaluate(f'{D}.advance({1 / FPS}, {FPS})')
                await snap()

        async def hold(seconds):
            global n
            await asyncio.sleep(0.45)  # انتظار انتهاء حركة ظهور البطاقة (CSS بالزمن الحقيقي)
            path = await snap()
            for _ in range(round(seconds * FPS) - 1):
                shutil.copy(path, os.path.join(FR, f'{n:05d}.jpg'))
                n += 1

        async def st():
            return await pg.evaluate(f'{D}.state')

        async def click(sel):
            await pg.evaluate('(s) => document.querySelector(s).click()', sel)

        async def answer(correct=True):
            cur = await pg.evaluate(f'{D}.current()')
            cid = key[cur['questionId']]['correctChoiceId']
            ch = cid if correct else next(c for c in cur['choices'] if c != cid)
            await click(f'.qcr-choice[data-choice-id="{ch}"]')
            for _ in range(60):
                if await st() == 'feedback': break
                await pg.evaluate(f'{D}.advance(0.05, 20)')

        async def run_to_question():
            while await st() not in ('question', 'results'):
                await render(0.2)

        await pg.fill('#qcr-player-name', 'عبدالله')
        await render(1.2)
        await click('[data-action="start"]')
        await run_to_question()
        # الحاجز ١: إجابة صحيحة ← قفزة
        await hold(1.6)
        await answer(True)
        await hold(1.6)
        await click('[data-action="continue"]')
        await run_to_question()
        # الحاجز ٢: إجابة خاطئة ← رفض الحاجز ← إعادة السؤال ← إجابة صحيحة ← قفزة
        await hold(1.2)
        await answer(False)
        await hold(2.2)
        await click('[data-action="continue"]')
        await run_to_question()
        await hold(1.8)
        await answer(True)
        await hold(1.4)
        await click('[data-action="continue"]')
        # بقية الحواجز: إجابات صحيحة بعرض سريع
        while True:
            await run_to_question()
            if await st() == 'results': break
            await hold(0.7)
            await answer(True)
            await hold(0.8)
            await click('[data-action="continue"]')
        await render(0.6)
        await hold(3.0)
        await b.close()
    out = os.path.join(OUT, 'horse-jumping-race-gameplay.mp4')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(FR, '%05d.jpg'),
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], check=True)
    print('frames', n, 'video', out)

asyncio.run(main())
