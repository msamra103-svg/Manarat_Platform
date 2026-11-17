# لقطات قريبة للهجين من عارض التطوير: python3 tools/dev/shoot_camel.py OUT_PREFIX [coat] [views]
import asyncio, sys, subprocess
from playwright.async_api import async_playwright
ROOT = '/home/claude/horse-jumping-race'
OUT = sys.argv[1]
COAT = sys.argv[2] if len(sys.argv) > 2 else '1'
VIEWS = (sys.argv[3] if len(sys.argv) > 3 else 'side:0,side:13,oblique:13,headside:0,side:13:0.25,side:13:0.5').split(',')
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'])
        files = []
        for v in VIEWS:
            view, speed, *rest = v.split(':'); jq = ('&jump=' + rest[0]) if rest else ''
            pg = await b.new_page(viewport={'width': 900, 'height': 560})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            await pg.goto(f'file://{ROOT}/dev/viewer.html?view={view}&speed={speed}&coat={COAT}{jq}')
            await pg.wait_for_function('window.__ready === true', timeout=120000)
            await pg.evaluate('window.__step(1.3, 1/60)')
            f = f'{OUT}_{view}_{speed}{rest[0] if rest else ""}.png'
            await pg.screenshot(path=f, timeout=120000)
            files.append(f)
            if errs: print(v, errs[:3])
            await pg.close()
        await b.close()
    n = len(files)
    cols = 3 if n > 4 else 2
    rows = (n + cols - 1) // cols
    inputs = sum([['-i', f] for f in files], [])
    pad = n
    filt = ''.join(f'[{i}]scale=600:-1[s{i}];' for i in range(n))
    while pad < rows * cols:
        inputs += ['-f', 'lavfi', '-i', 'color=c=white:s=600x373']; filt += f'[{pad}]null[s{pad}];'; pad += 1
    layout = '|'.join(f'{(i % cols) * 600}_{(i // cols) * 373}' for i in range(rows * cols))
    filt += ''.join(f'[s{i}]' for i in range(rows * cols)) + f'xstack=inputs={rows * cols}:layout={layout}'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', filt, '-frames:v', '1', f'{OUT}_grid.jpg'], check=True)
    print(f'{OUT}_grid.jpg')
asyncio.run(main())
