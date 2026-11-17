# شريط لقطات لدورة العدو: python3 tools/dev/filmstrip.py OUT VIEW SPEED [N] [coat]
import asyncio, sys, subprocess
from playwright.async_api import async_playwright
ROOT = '/home/claude/horse-jumping-race'
OUT, VIEW, SPEED = sys.argv[1], sys.argv[2], float(sys.argv[3])
N = int(sys.argv[4]) if len(sys.argv) > 4 else 8
COAT = sys.argv[5] if len(sys.argv) > 5 else '0'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'])
        pg = await b.new_page(viewport={'width': 640, 'height': 400})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'file://{ROOT}/dev/viewer.html?view={VIEW}&speed={SPEED}&coat={COAT}')
        await pg.wait_for_function('window.__ready === true', timeout=120000)
        await pg.evaluate('window.__step(1.5, 1/120)')
        T = await pg.evaluate('window.__camel.animator.strideLen / ' + str(max(SPEED, 0.1)) + ' || 0.4')
        files = []
        for i in range(N):
            if i: await pg.evaluate(f'window.__step({T / N}, 1/240)')
            f = f'{OUT}_{i}.png'; await pg.screenshot(path=f); files.append(f)
        if errs: print(errs[:3])
        await b.close()
    cols = 4; rows = (N + cols - 1) // cols
    inputs = sum([['-i', f] for f in files], [])
    filt = ''.join(f'[{i}]scale=480:-1[s{i}];' for i in range(N))
    layout = '|'.join(f'{(i % cols) * 480}_{(i // cols) * 300}' for i in range(N))
    filt += ''.join(f'[s{i}]' for i in range(N)) + f'xstack=inputs={N}:layout={layout}'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', filt, '-frames:v', '1', f'{OUT}_strip.jpg'], check=True)
    print(f'{OUT}_strip.jpg', 'period', T)
asyncio.run(main())
