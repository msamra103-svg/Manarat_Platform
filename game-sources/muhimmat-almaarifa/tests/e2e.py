#!/usr/bin/env python3
"""
اختبار آلي كامل لـ«مهمّة المعرفة» في متصفح حقيقي (Chrome بلا واجهة) عبر أحداث إدخال فعلية.

  pip install playwright
  node tools/serve.mjs dist 8080 &
  python3 tests/e2e.py http://localhost:8080/ [مسار_ملف_التقرير.json]

يستخدم المنفذ ‎?test=1‎ لقراءة حالة اللعبة فقط؛ كل الإجابات تُرسل بنقرات ولمسات وضغطات مفاتيح حقيقية.
"""
import sys, json, asyncio, time, os
from playwright.async_api import async_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/').rstrip('/') + '/'
REPORT = sys.argv[2] if len(sys.argv) > 2 else None
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SECTIONS = os.environ.get('SECTIONS', 'ABCD')   # A: فأرة ولوحة مفاتيح، B: لمس، C: خلط ونصوص طويلة، D: لوحة المعلم والصوت
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required']
results = []

INFO = """() => {
  const g = window.__mmTest, s = g.session, V = g.v1.constructor;
  const out = { state: g.state, paused: g.paused, lastShot: g.lastShot, clock: g.clock, w: innerWidth, h: innerHeight, tier: g.tier, fps: g.fps, locked: g.controls.locked };
  if (!s) return out;
  const m = s.missions[Math.min(s.index, s.missions.length - 1)];
  Object.assign(out, { index: s.index, total: s.missions.length, health: s.health, score: s.score, status: s.status, retries: s.retries,
    correctId: m.question.correctOptionId, wrong: m.wrong.slice(), qid: m.id, optionCount: m.order.length,
    hittable: g.targets.hitMeshes().length, allFit: g.targets.allFit(),
    stale: g.targets.sets.flat().filter(b => b.optionId && !(g.targets.current || []).includes(b)).length,
    gateOpen: (g.world.station(Math.min(s.index, s.missions.length - 1)) || {}).gate ? g.world.station(Math.min(s.index, s.missions.length - 1)).gate.open : null });
  out.boards = (g.targets.current || []).map(b => { const p = b.face.getWorldPosition(new V()).project(g.camera);
    return { id: b.optionId, text: b.text, badge: b.badge, state: b.state, x: Math.round((p.x * 0.5 + 0.5) * innerWidth), y: Math.round((-p.y * 0.5 + 0.5) * innerHeight) }; });
  return out;
}"""


def check(name, ok, detail=''):
    results.append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('  ✔ ' if ok else '  ✘ ') + name + (f' — {detail}' if detail else ''))


async def info(pg):
    return await pg.evaluate(INFO)


async def wait_state(pg, state, timeout=90000):
    await pg.wait_for_function(f"window.__mmTest && window.__mmTest.state === '{state}' && !window.__mmTest.controls.tween && !window.__mmTest.recenterAt", timeout=timeout)


async def settle(pg, ms=450):
    await pg.wait_for_timeout(ms)


async def open_page(browser, w=800, h=450, touch=False, query='test=1'):
    ctx = await browser.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, accept_downloads=True)
    pg = await ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    await pg.goto(URL + '?' + query)
    await pg.wait_for_function("document.getElementById('scrLoading').classList.contains('hidden')", timeout=120000)
    return ctx, pg, errors


async def click_board(pg, board, touch=False):
    if touch: await pg.touchscreen.tap(board['x'], board['y'])
    else: await pg.mouse.click(board['x'], board['y'])


async def shoot_at(pg, opt_id, touch=False):
    """يصوّب بنقرة/لمسة حقيقية على لوحة الخيار وينتظر اكتمال الطلقة."""
    await pg.wait_for_function("!window.__mmTest.controls.tween && !window.__mmTest.recenterAt", timeout=30000)
    i = await info(pg)
    b = next(x for x in i['boards'] if x['id'] == opt_id)
    await click_board(pg, b, touch)
    await pg.wait_for_function(f"window.__mmTest.lastShot > {i['lastShot']} || window.__mmTest.state !== 'question'", timeout=30000)
    await pg.wait_for_function("!window.__mmTest.controls.tween && !window.__mmTest.recenterAt", timeout=30000)
    return await info(pg)


def pick(i, correct=True):
    for b in i['boards']:
        if (b['id'] == i['correctId']) == correct and b['state'] == 'normal':
            return b
    return None


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=CHROME, args=ARGS)

        if 'A' in SECTIONS:
            # ===== ١) الفأرة بمؤشر حر: دورة اللعب كاملة =====
            print('١) دورة اللعب بالفأرة')
            ctx, pg, errors = await open_page(browser)
            await pg.evaluate("window.__mmTest.controls.wantLock = false")
            await pg.evaluate("""(() => { const g = window.__mmTest; document.getElementById('btnStart').addEventListener('click', () => { window.__c0 = g.clock; }, true);
              const tick = () => { if (g.state === 'question' && window.__c1 === undefined) window.__c1 = g.clock; else requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()""")
            await pg.click('#btnStart')
            await pg.wait_for_function("window.__c1 !== undefined", timeout=90000)
            took = await pg.evaluate("window.__c1 - window.__c0")
            i = await info(pg)
            # في بيئة الاختبار البرمجية (نحو إطار في الثانية) يُقرَّب الزمن إلى أقرب ربع ثانية؛ القيمة الاسمية ٢٫٠ ث
            check('السؤال الأول يظهر بعد النقر على «ابدأ» خلال نحو ثانيتين من زمن اللعبة', took <= 2.8, f"{took:.2f} ث من زمن اللعبة (الاسمي ٢٫٠ ث)")
            check('نقرة زر البدء لا تُحسب طلقة', i['lastShot'] < 0 and i['health'] == 100)
            check('عدد الأهداف القابلة للإصابة يساوي عدد خيارات السؤال', i['hittable'] == i['optionCount'] == len(i['boards']), f"{i['hittable']} أهداف")
            check('نصوص الخيارات داخل حدود اللوحات', i['allFit'])
            check('كل الأهداف داخل الشاشة', all(0 < b['x'] < i['w'] and 0 < b['y'] < i['h'] for b in i['boards']))
            await settle(pg, 300)

            # طلقة خارج الأهداف
            await pg.mouse.click(i['w'] // 2, int(i['h'] * 0.72))      # أسفل الأهداف: باب/أرض
            await settle(pg)
            j = await info(pg)
            check('إطلاق النار خارج الأهداف لا يخصم الصحة ولا يُحسب إجابة', j['lastShot'] > i['lastShot'] and j['health'] == 100 and j['index'] == 0 and j['wrong'] == [], f"الصحة {j['health']}")

            # إجابة خاطئة ثم تكرار الإصابة على الهدف نفسه
            w = pick(j, False)
            k = await shoot_at(pg, w['id'])
            check('الإجابة الخاطئة تخصم ٢٠ مرة واحدة وتُبقي السؤال نفسه', k['health'] == 80 and k['index'] == 0 and k['state'] == 'question', f"الصحة {k['health']}")
            check('الهدف الخاطئ يتحول إلى حالة «معطّل»', next(b for b in k['boards'] if b['id'] == w['id'])['state'] == 'wrong')
            yawc = await pg.evaluate("window.__mmTest.controls.yaw")
            check('بعد التصويب بالنقر يعود النظر إلى الوسط وتبقى كل الأهداف ظاهرة', abs(yawc) < 0.02 and all(0 < b['x'] < k['w'] and 0 < b['y'] < k['h'] for b in k['boards']), f"زاوية النظر {yawc:.3f}")
            for _ in range(4):
                k2 = await shoot_at(pg, w['id'])
            check('تكرار إصابة الخيار المعطَّل لا يخصم مجددًا', k2['health'] == 80 and len(k2['wrong']) == 1, f"الصحة {k2['health']}")

            # إجابة صحيحة بعدة طلقات سريعة
            c = next(b for b in (await info(pg))['boards'] if b['id'] == k2['correctId'])
            await click_board(pg, c)
            for _ in range(5):
                await pg.mouse.click(c['x'], c['y']); await pg.wait_for_timeout(40)
            await pg.wait_for_function("window.__mmTest.state !== 'question'", timeout=20000)
            k3 = await info(pg)
            check('الصحيحة من المحاولة الثانية تمنح ٧٠ مرة واحدة رغم الطلقات السريعة', k3['score'] == 70, f"النقاط {k3['score']}")
            shots_before = k3['lastShot']
            # طلقات أثناء عرض النتيجة والانتقال (نتوقف عن المحاولة لحظة ظهور السؤال التالي)
            tried = 0; blocked = True
            for _ in range(10):
                st = await pg.evaluate("window.__mmTest.state")
                if st not in ('feedback', 'moving'): break
                await pg.mouse.click(i['w'] // 2, i['h'] // 2); await pg.keyboard.press('Space'); tried += 1
                now = await pg.evaluate("({ s: window.__mmTest.state, l: window.__mmTest.lastShot })")
                if now['s'] in ('feedback', 'moving', 'presenting') and now['l'] != shots_before: blocked = False
            await pg.wait_for_function("window.__mmTest.session.index === 1", timeout=60000)
            g = await pg.evaluate("window.__mmTest.world.station(0).gate.open")
            check('الإجابة الصحيحة تفتح بوابة المحطة', g > 0.9, f"فتح البوابة {g:.2f}")
            await wait_state(pg, 'question')
            m = await info(pg)
            check('لا تُحتسب طلقات أثناء النتيجة والانتقال', blocked and tried > 0 and m['score'] == 70 and m['health'] == 80, f"{tried} محاولات إطلاق مرفوضة")
            check('الانتقال إلى المهمة التالية مرة واحدة فقط', m['index'] == 1)
            check('لا أهداف متبقية من السؤال السابق', m['stale'] == 0 and m['hittable'] == m['optionCount'], f"قابلة للإصابة: {m['hittable']}")
            check('بوابة المحطة الجديدة مغلقة حتى الإجابة', m['gateOpen'] == 0)

            # ===== لوحة المفاتيح =====
            print('٢) لوحة المفاتيح والإيقاف المؤقت وتغيير المقاس')
            c = pick(m, True)
            await pg.keyboard.press(f"Digit{c['badge']}")
            await pg.wait_for_function("window.__mmTest.session.index === 2", timeout=60000)
            await wait_state(pg, 'question')
            n = await info(pg)
            check('الاختيار بلوحة المفاتيح يصيب الهدف ويمنح ١٠٠ من المحاولة الأولى', n['score'] == 170, f"النقاط {n['score']}")

            # الإيقاف المؤقت: زر Esc ثم «متابعة»
            await pg.keyboard.press('Escape'); await settle(pg, 250)
            pz = await info(pg)
            visible = await pg.is_visible('#scrPause')
            await pg.mouse.click(n['boards'][0]['x'], n['boards'][0]['y']); await pg.keyboard.press('Digit1'); await settle(pg, 300)
            pz2 = await info(pg)
            check('الإيقاف المؤقت يوقف اللعب ويمنع الطلقات', pz['paused'] and visible and pz2['lastShot'] == n['lastShot'] and pz2['health'] == n['health'])
            await pg.click('#btnResume'); await settle(pg, 150)
            r = await info(pg)
            check('نقرة «متابعة» لا تُحسب طلقة', (not r['paused']) and r['lastShot'] == n['lastShot'])
            await settle(pg, 400)

            # تغيير مقاس الشاشة أثناء السؤال
            await pg.set_viewport_size({'width': 1180, 'height': 520}); await settle(pg, 500)
            await pg.set_viewport_size({'width': 760, 'height': 560}); await settle(pg, 500)
            rs = await info(pg)
            check('تغيير المقاس لا يفقد التقدم والأهداف تبقى داخل الشاشة', rs['index'] == 2 and rs['score'] == 170 and rs['state'] == 'question' and all(0 < b['x'] < rs['w'] and 0 < b['y'] < rs['h'] for b in rs['boards']), f"{rs['w']}×{rs['h']}")
            await pg.set_viewport_size({'width': 800, 'height': 450}); await settle(pg, 400)

            # ===== نفاد الصحة والاستكمال =====
            print('٣) نفاد الصحة والاستكمال')
            guard = 0
            while guard < 12:
                guard += 1
                cur = await info(pg)
                if cur['state'] == 'failed' or cur['status'] == 'failed': break
                wb = pick(cur, False)
                if wb is None:      # لا خيارات خاطئة متبقية: نجيب ونكمل
                    idx = cur['index']; await shoot_at(pg, cur['correctId'])
                    await pg.wait_for_function(f"window.__mmTest.session.index === {idx + 1}", timeout=60000); await wait_state(pg, 'question'); continue
                await shoot_at(pg, wb['id'])
            f = await info(pg)
            check('الصحة لا تنخفض عن الصفر وتنتهي المحاولة عند نفادها', f['health'] == 0 and f['status'] == 'failed', f"الصحة {f['health']}")
            await pg.wait_for_selector('#scrFail:not(.hidden)', timeout=30000)
            await pg.keyboard.press('Space'); await pg.keyboard.press('Digit1'); await settle(pg, 250)
            f2 = await info(pg)
            check('لا تُستقبل طلقات بعد انتهاء المحاولة', f2['lastShot'] == f['lastShot'] and f2['score'] == f['score'])
            fail_text = await pg.inner_text('#scrFail')
            check('شاشة «انتهت المحاولة» تعرض مراجعة السؤال', 'انتهت المحاولة' in fail_text and 'مراجعة السؤال' in fail_text)
            await pg.click('#btnRetry'); await wait_state(pg, 'question')
            rt = await info(pg)
            check('الاستكمال من المهمة نفسها بصحة كاملة دون نقاط مكررة', rt['health'] == 100 and rt['index'] == f['index'] and rt['score'] == f['score'] and rt['retries'] == 1)
            check('الخيارات الخاطئة السابقة تبقى معطّلة بعد الاستكمال', len(rt['wrong']) == len(f['wrong']) and all(b['state'] == 'wrong' for b in rt['boards'] if b['id'] in rt['wrong']))

            # ===== إكمال الجلسة والنتيجة =====
            print('٤) إكمال الجلسة والنتيجة النهائية')
            while True:
                cur = await info(pg)
                if cur['status'] != 'active': break
                idx = cur['index']
                await shoot_at(pg, cur['correctId'])
                await pg.wait_for_function(f"window.__mmTest.session.index === {idx + 1}", timeout=60000)
                if idx + 1 >= cur['total']: break
                await wait_state(pg, 'question')
            await pg.wait_for_selector('#scrEnd:not(.hidden)', timeout=60000)
            res = await pg.evaluate("window.__mmTest.result")
            end_text = await pg.inner_text('#scrEnd')
            recomputed = await pg.evaluate("(() => { const s = window.__mmTest.session; return { first: s.missions.filter(m => m.solved && m.wrong.length === 0).length, mistakes: s.missions.reduce((n, m) => n + m.wrong.length, 0), score: s.missions.reduce((n, m) => n + m.points, 0) }; })()")
            check('عدد المهمات المكتملة يساوي عدد الأسئلة', res['completed'] == res['total'] == 10, f"{res['completed']} من {res['total']}")
            check('النتيجة محسوبة من بيانات المحاولات الحقيقية', res['firstTry'] == recomputed['first'] and res['mistakes'] == recomputed['mistakes'] and res['score'] == recomputed['score'], json.dumps(res | {'missions': None}, ensure_ascii=False))
            check('الدقة ليست ١٠٠٪ لمجرد الوصول إلى النهاية', res['firstTryPercent'] < 100 and res['mistakes'] > 0, f"{res['firstTryPercent']}٪ من المحاولة الأولى، {res['mistakes']} أخطاء")
            check('اسم «مهمّة المعرفة» ظاهر في شاشة النهاية', 'مهمّة المعرفة' in end_text)
            async with pg.expect_download() as dl:
                await pg.click('#btnSaveResult')
            d = await dl.value
            check('ملف النتيجة المصدَّر يحمل اسم اللعبة', 'مهمّة المعرفة' in d.suggested_filename, d.suggested_filename)
            await pg.click('#btnAgain'); await wait_state(pg, 'question')
            ag = await info(pg)
            check('إعادة اللعب تبدأ جلسة نظيفة', ag['index'] == 0 and ag['score'] == 0 and ag['health'] == 100 and ag['wrong'] == [])
            check('لا أخطاء JavaScript أثناء الجلسة', len(errors) == 0, '; '.join(errors[:3]))

            # ===== قفل المؤشر =====
            print('٥) قفل المؤشر')
            await pg.evaluate("window.__mmTest.enterMenu()"); await pg.wait_for_selector('#scrStart:not(.hidden)')
            await pg.evaluate("window.__mmTest.controls.wantLock = true")
            await pg.click('#btnStart'); await wait_state(pg, 'question'); await settle(pg, 300)
            lk = await info(pg)
            if lk['locked']:
                yaw0 = await pg.evaluate("window.__mmTest.controls.yaw")
                await pg.mouse.move(500, 270); await pg.mouse.move(560, 270, steps=6); await settle(pg, 200)
                yaw1 = await pg.evaluate("window.__mmTest.controls.yaw")
                check('قفل المؤشر: تحريك الفأرة يدير النظر', abs(yaw1 - yaw0) > 0.01, f"{yaw0:.3f} → {yaw1:.3f}")
                await pg.mouse.down(); await pg.mouse.up(); await settle(pg, 300)
                lk2 = await info(pg)
                check('قفل المؤشر: النقر يطلق من مركز التصويب', lk2['lastShot'] > lk['lastShot'])
                await pg.evaluate("document.exitPointerLock()"); await settle(pg, 400)
                check('الخروج من قفل المؤشر يوقف اللعبة مؤقتًا دون فقدان التقدم', (await info(pg))['paused'] and await pg.is_visible('#scrPause'))
            else:
                check('قفل المؤشر غير متاح في بيئة الاختبار؛ اللعب مستمر بالمؤشر الحر', lk['state'] == 'question', 'بديل المؤشر الحر يعمل')
            await ctx.close()

        if 'B' in SECTIONS:
            # ===== ٦) اللمس =====
            print('٦) اللمس (هاتف أفقي ٨٤٤×٣٩٠)')
            ctx, pg, errors = await open_page(browser, 844, 390, touch=True)
            await pg.tap('#btnStart'); await wait_state(pg, 'question'); await settle(pg, 300)
            t = await info(pg)
            check('اللمس: زر البدء لا يُحسب طلقة والأهداف كلها ظاهرة', t['lastShot'] < 0 and all(0 < b['x'] < t['w'] and 0 < b['y'] < t['h'] for b in t['boards']))
            check('اللمس: زرّا الإطلاق ظاهران', await pg.is_visible('#fireR') and await pg.is_visible('#fireL'))
            wb = pick(t, False)
            t2 = await shoot_at(pg, wb['id'], touch=True)
            check('اللمس: لمس هدف خاطئ يخصم ٢٠ مرة واحدة', t2['health'] == 80 and t2['index'] == 0)
            # سحب لتحريك النظر ثم زر الإطلاق
            yaw0 = await pg.evaluate("window.__mmTest.controls.yaw")
            cdp = await ctx.new_cdp_session(pg)
            pts = [(250 + k * 30, 200) for k in range(8)]      # سحب واسع (نحو ٤٣°) حتى يتجه التصويب إلى الجدار بعيدًا عن الأهداف
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': pts[0][0], 'y': pts[0][1]}]})
            for (x, y) in pts[1:]:
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y}]}); await pg.wait_for_timeout(30)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await settle(pg, 250)
            yaw1 = await pg.evaluate("window.__mmTest.controls.yaw")
            t3 = await info(pg)
            check('اللمس: السحب يحرّك النظر دون إطلاق', abs(yaw1 - yaw0) > 0.02 and t3['lastShot'] == t2['lastShot'], f"{yaw0:.3f} → {yaw1:.3f}")
            await pg.tap('#fireR'); await settle(pg, 300)
            t4 = await info(pg)
            check('اللمس: زر الإطلاق يطلق من مركز التصويب، والطلقة خارج الأهداف لا تُحسب', t4['lastShot'] > t3['lastShot'] and t4['health'] == 80 and t4['index'] == 0)
            await pg.tap('#btnPause'); await settle(pg, 250)
            check('اللمس: زر الإيقاف المؤقت لا يطلق النار خلفه', (await info(pg))['paused'] and (await info(pg))['lastShot'] == t4['lastShot'])
            await pg.tap('#btnResume'); await settle(pg, 500)
            # سحب معاكس لإعادة الأهداف إلى وسط الشاشة
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': pts[-1][0], 'y': pts[-1][1]}]})
            for (x, y) in reversed(pts[:-1]):
                await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y}]}); await pg.wait_for_timeout(30)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await settle(pg, 250)
            t5 = await info(pg)
            yaw2 = await pg.evaluate("window.__mmTest.controls.yaw")
            check('اللمس: السحب المعاكس يعيد النظر إلى موضعه', abs(yaw2 - yaw0) < 0.06, f"{yaw1:.3f} → {yaw2:.3f}")
            await shoot_at(pg, t5['correctId'], touch=True)
            await pg.wait_for_function("window.__mmTest.session.index === 1", timeout=60000)
            check('اللمس: لمس الهدف الصحيح يُنهي المهمة', (await info(pg))['score'] == 70)
            # تدوير إلى الوضع الرأسي ثم العودة
            await wait_state(pg, 'question')
            await pg.set_viewport_size({'width': 390, 'height': 844}); await settle(pg, 500)
            rot = await pg.is_visible('#scrRotate'); pr = await info(pg)
            await pg.set_viewport_size({'width': 844, 'height': 390}); await settle(pg, 500)
            back = await info(pg)
            check('تدوير الجهاز يعرض تنبيهًا ويحفظ التقدم', rot and pr['paused'] and back['index'] == 1 and back['score'] == 70 and not await pg.is_visible('#scrRotate'))
            check('لا أخطاء JavaScript في جلسة اللمس', len(errors) == 0, '; '.join(errors[:3]))
            await ctx.close()

        if 'C' in SECTIONS:
            # ===== ٧) خلط الخيارات =====
            print('٧) خلط الخيارات والنصوص الطويلة')
            ctx, pg, errors = await open_page(browser, 960, 540)
            await pg.evaluate("window.__mmTest.controls.wantLock = false")
            seen = set(); ok = True
            for _ in range(6):
                await pg.evaluate("window.__mmTest.startSession()"); await wait_state(pg, 'question')
                s = await info(pg)
                bank_correct = await pg.evaluate("(() => { const g = window.__mmTest, m = g.session.missions[0], q = g.bank.questions.find(x => x.id === m.id); return q.options.find(o => o.id === q.correctOptionId).text; })()")
                cb = next(b for b in s['boards'] if b['id'] == s['correctId'])
                ok = ok and cb['text'] == bank_correct
                seen.add(tuple(b['id'] for b in s['boards']))
            check('الخلط يغيّر المواضع ولا يغيّر الإجابة الصحيحة', ok and len(seen) > 1, f"{len(seen)} ترتيبات مختلفة في ٦ جلسات")

            # نصوص عربية طويلة (٩٠ حرفًا للخيار)
            long_bank = {'title': 'اختبار النصوص الطويلة', 'questions': [{
                'id': 'long-1', 'text': 'أيّ العبارات الآتية تصف بدقة ما يحدث لجزيئات الماء عند تسخينه تدريجيًا من درجة حرارة الغرفة حتى يبدأ بالغليان في وعاء مفتوح عند مستوى سطح البحر، مع بقاء الضغط الجوي ثابتًا طوال التجربة؟',
                'options': [
                    {'id': 'a', 'text': 'تزداد سرعة حركة الجزيئات وتتباعد عن بعضها حتى تتحول إلى بخار عند ١٠٠ درجة مئوية تقريبًا'},
                    {'id': 'b', 'text': 'تتوقف الجزيئات عن الحركة تمامًا ثم تتحول فجأة إلى غاز دون أن ترتفع درجة حرارة الماء أبدًا'},
                    {'id': 'c', 'text': 'تقترب الجزيئات من بعضها أكثر فأكثر حتى يصبح الماء أثقل ويهبط كله إلى قاع الوعاء المفتوح'},
                    {'id': 'd', 'text': 'تتحلل الجزيئات إلى هيدروجين وأكسجين فور بدء التسخين، ولا يبقى في الوعاء ماء سائل (٥٠٪ فقط)'}],
                'correctOptionId': 'a', 'explanation': 'التسخين يزيد الطاقة الحركية للجزيئات حتى تتغلب على قوى التجاذب بينها.'}]}
            v = await pg.evaluate("(b) => { const g = window.__mmTest; g.bank = b; g.bank.format = 'x'; g.startSession(); return true; }", long_bank)
            await wait_state(pg, 'question'); await settle(pg, 300)
            lg = await info(pg)
            qh = await pg.evaluate("document.querySelector('.mission').getBoundingClientRect().height / innerHeight")
            qfs = await pg.evaluate("parseFloat(getComputedStyle(document.getElementById('question')).fontSize)")
            lens = [len(o['text']) for o in long_bank['questions'][0]['options']]
            check('الخيارات الطويلة (حتى ٩٠ حرفًا) تبقى كاملة داخل اللوحات', lg['allFit'] and max(lens) <= 90, f"أطوال الخيارات: {lens}")
            check('السؤال الطويل لا يتجاوز ثلث الشاشة وخطه مقروء', qh <= 0.34 and qfs >= 15, f"ارتفاع اللوحة {qh:.0%} وحجم الخط {qfs:.0f}px")
            if REPORT: await pg.screenshot(path=os.path.join(os.path.dirname(REPORT) or '.', 'e2e-long-text.png'))
            await ctx.close()

        if 'D' in SECTIONS:
            # ===== ٨) لوحة المعلم: الاستيراد والتصدير والحفظ المحلي =====
            print('٨) لوحة المعلم والحفظ المحلي والصوت')
            ctx, pg, errors = await open_page(browser, 960, 540)
            await pg.click('#btnTeacher'); await pg.wait_for_selector('#scrTeacher:not(.hidden)')
            async with pg.expect_download() as dl:
                await pg.click('#btnExport')
            d = await dl.value; path = await d.path()
            exported = json.load(open(path, encoding='utf8'))
            check('التصدير ينتج JSON صالحًا باسم اللعبة', len(exported['questions']) == 10 and 'مهمّة المعرفة' in d.suggested_filename, d.suggested_filename)
            bad = '/tmp/mm-bad.json'; good = '/tmp/mm-good.json'
            open(bad, 'w', encoding='utf8').write(json.dumps({'questions': [{'id': 'x', 'text': '', 'options': [{'id': 'a', 'text': 'واحد'}], 'correctOptionId': 'z'}]}, ensure_ascii=False))
            exported['title'] = 'بنك مستورد'; exported['questions'] = exported['questions'][:3]
            open(good, 'w', encoding='utf8').write(json.dumps(exported, ensure_ascii=False))
            await pg.set_input_files('#fileImport', bad)
            await pg.wait_for_selector('#bankMsg:not(.hidden)', timeout=20000)
            msg = await pg.inner_text('#bankMsg'); cnt = await pg.evaluate("window.__mmTest.bank.questions.length")
            check('استيراد ملف معيب يُرفض برسالة عربية ويبقى البنك السابق', cnt == 10 and 'لم يُستورد' in msg and 'نص السؤال فارغ' in msg, msg.replace('\n', ' ')[:110])
            await pg.set_input_files('#fileImport', good)
            await pg.wait_for_selector('#bankMsg.ok', timeout=20000)
            cnt = await pg.evaluate("window.__mmTest.bank.questions.length")
            check('استيراد ملف صالح يستبدل البنك', cnt == 3 and (await pg.evaluate("window.__mmTest.bank.title")) == 'بنك مستورد')
            # إضافة سؤال من النموذج
            await pg.click('#btnAddQ'); await pg.fill('#qText', 'ما عاصمة دولة قطر؟')
            rows = pg.locator('#qOptions .opt-row input[type=text]')
            for k, txt in enumerate(['الدوحة', 'الريان', 'الوكرة', 'الخور']): await rows.nth(k).fill(txt)
            await pg.fill('#qExplain', 'الدوحة هي عاصمة دولة قطر.'); await pg.click('#qForm button[type=submit]')
            await pg.wait_for_function("window.__mmTest.bank.questions.length === 4", timeout=20000)
            check('إضافة سؤال من لوحة المعلم', await pg.evaluate("window.__mmTest.bank.questions.length") == 4)
            # الحذف بتأكيد داخل الصفحة (ضغطتان)
            await pg.click('#qList li:first-child button[data-act=del]'); await pg.wait_for_timeout(200)
            armed = await pg.evaluate("window.__mmTest.bank.questions.length")
            await pg.click('#qList li:first-child button[data-act=del]')
            await pg.wait_for_function("window.__mmTest.bank.questions.length === 3", timeout=20000)
            check('حذف سؤال يتطلب تأكيدًا بضغطة ثانية', armed == 4)
            await pg.click('.tab[data-tab=tabRules]'); await pg.fill('#rPenalty', '25'); await pg.dispatch_event('#rPenalty', 'change')
            await pg.click('#btnTeacherClose'); await pg.wait_for_selector('#scrStart:not(.hidden)')
            await pg.reload(); await pg.wait_for_function("document.getElementById('scrLoading').classList.contains('hidden')", timeout=120000)
            st = await pg.evaluate("({ n: window.__mmTest.bank.questions.length, title: window.__mmTest.bank.title, pen: window.__mmTest.rules.wrongPenalty, note: document.getElementById('bankNote').textContent })")
            check('البنك والإعدادات محفوظة محليًا بعد إعادة التحميل', st['n'] == 3 and st['title'] == 'بنك مستورد' and st['pen'] == 25, st['note'])
            await pg.evaluate("window.__mmTest.controls.wantLock = false")
            await pg.click('#btnStart'); await wait_state(pg, 'question')
            s4 = await info(pg)
            check('عدد المهمات يتبع البنك المعتمد وقواعد المعلم', s4['total'] == 3)
            s5 = await shoot_at(pg, pick(s4, False)['id'])
            check('قيمة الخصم المعدّلة من المعلم مطبّقة', s5['health'] == 75)

            # فصل قنوات الصوت
            a = await pg.evaluate("""(() => { const g = window.__mmTest, a = g.audio, p = g.prefs; a.unlock();
              let spoken = 0; const real = a.speechSupported() ? window.speechSynthesis.speak.bind(window.speechSynthesis) : null;
              if (real) window.speechSynthesis.speak = u => { spoken++; };
              p.speechOn = false; p.sfxOn = true; a.applyPrefs(); const r1 = a.speak(['اختبار']); const n1 = spoken;
              p.speechOn = true; p.sfxOn = false; a.applyPrefs(); const r2 = a.speak(['اختبار']); const n2 = spoken;
              let played = 0; const tone = a._tone.bind(a); a._tone = (...x) => { played++; return tone(...x); }; a.play('correct'); const mutedPlays = played;
              p.sfxOn = true; p.speechOn = false; a.applyPrefs(); a.play('correct'); const onPlays = played - mutedPlays;
              return { ready: a.ready, supported: a.speechSupported(), r1, n1, r2, n2, mutedPlays, onPlays, ctx: a.ctx ? a.ctx.state : 'none' }; })()""")
            check('القراءة موقوفة والمؤثرات تعمل', a['ready'] and a['r1'] is False and a['n1'] == 0 and a['onPlays'] > 0, json.dumps(a))
            check('المؤثرات موقوفة والقراءة تعمل (إن دعمها المتصفح)', a['mutedPlays'] == 0 and (a['n2'] > 0 if a['supported'] else a['r2'] is False))
            check('لا أخطاء JavaScript في لوحة المعلم', len(errors) == 0, '; '.join(errors[:3]))
            await ctx.close()
        await browser.close()

    passed = sum(1 for r in results if r['ok'])
    print(f"\nالنتيجة: {passed} من {len(results)} فحصًا ناجحًا")
    if REPORT:
        json.dump({'url': URL, 'passed': passed, 'total': len(results), 'results': results}, open(REPORT, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    sys.exit(0 if passed == len(results) else 1)

asyncio.run(main())
