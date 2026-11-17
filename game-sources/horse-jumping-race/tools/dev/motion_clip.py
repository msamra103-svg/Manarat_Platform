# مقطع قريب لحركة الحصان: عدو بالسرعة الحقيقية ثم بالحركة البطيئة، ثم لقطة خلفية للذيل
# python3 tools/dev/motion_clip.py OUT.mp4
import asyncio, sys, subprocess, os, shutil
from playwright.async_api import async_playwright
ROOT = '/home/claude/horse-jumping-race'
OUT = sys.argv[1]
TMP = OUT + '_frames'
async def shoot(b, view, coat, speed, segments, idx):
    pg = await b.new_page(viewport={'width': 1280, 'height': 720})
    await pg.goto(f'file://{ROOT}/dev/viewer.html?view={view}&speed={speed}&coat={coat}')
    await pg.wait_for_function('window.__ready === true', timeout=120000)
    await pg.evaluate('window.__step(1.5, 1/120)')
    for (n, dt) in segments:
        for _ in range(n):
            await pg.evaluate(f'window.__step({dt}, 1/240)')
            await pg.screenshot(path=f'{TMP}/f{idx:05d}.jpg', type='jpeg', quality=90)
            idx += 1
    await pg.close()
    return idx
async def main():
    shutil.rmtree(TMP, ignore_errors=True); os.makedirs(TMP)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'])
        i = 0
        i = await shoot(b, 'wide', 0, 13, [(90, 1/30), (150, 1/120)], i)   # ٣ ث بالسرعة الحقيقية + ٥ ث بطيئة (×٤)
        i = await shoot(b, 'rear', 2, 13, [(90, 1/30)], i)                  # الذيل من الخلف (حصان أشهب)
        i = await shoot(b, 'hindq', 3, 13, [(120, 1/60)], i)                # الساق الخلفية والذيل، بطيء ×٢ (أدهم)
        await b.close()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{TMP}/f%05d.jpg', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT], check=True)
    shutil.rmtree(TMP)
    print(OUT)
asyncio.run(main())
