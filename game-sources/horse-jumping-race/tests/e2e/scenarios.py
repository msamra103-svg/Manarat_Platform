# سيناريوهات تحقق في متصفح Chrome حقيقي (بدون واجهة، WebGL برمجي SwiftShader).
# الاستخدام: python3 tests/e2e/scenarios.py OUT_DIR scenario1,scenario2,...
# السيناريوهات: outcomes, refusal, pause, replay, touch, layouts, localsim, platform
import asyncio, sys, json, time, subprocess, os, shutil
from playwright.async_api import async_playwright

OUT = sys.argv[1]
WHICH = sys.argv[2].split(',') if len(sys.argv) > 2 else ['outcomes']
DIST = '/home/claude/horse-jumping-race/dist'
SIM = '/home/claude/horse-jumping-race/dist-platform-sim'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
RESULTS = []
D = 'window.HorseJumpingRace.debug'

def record(name, ok, detail):
    RESULTS.append({'test': name, 'ok': bool(ok), 'detail': detail})
    print(('PASS' if ok else 'FAIL'), name, json.dumps(detail, ensure_ascii=False)[:600], flush=True)

async def open_game(b, url, viewport=(1280, 720), **ctx):
    c = await b.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, **ctx)
    pg = await c.new_page()
    pg.logs = []
    pg.on('console', lambda m: pg.logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.logs.append('PAGEERROR ' + str(e)))
    await pg.goto(url)
    await pg.wait_for_function("['ready','intro','countdown','running'].includes(window.HorseJumpingRace?.debug?.state)", timeout=120000, polling=250)
    return c, pg

async def jsclick(f, sel):
    await f.evaluate('(s) => document.querySelector(s).click()', sel)

async def jscheck(f, sel, val=True):
    await f.evaluate('([s, v]) => { document.querySelector(s).checked = v; }', [sel, val])

async def adv(pg, sec, fps=5):
    await pg.evaluate(f'{D}.advance({sec}, {fps})')

async def state(pg):
    return await pg.evaluate(f'{D}.state')

# pattern: لكل حاجز 'c' صحيح من أول محاولة، 'w' خطأ واحد ثم صحيح، أو رقم = عدد المحاولات الخاطئة قبل الصحيحة
async def play_to_end(pg, pattern, key, fps=5, on_question=None):
    log = []
    tried = {}
    while True:
        st = await state(pg)
        if st in ('running', 'finishing', 'intro', 'countdown', 'awaitingGrade', 'feedback'):
            if st == 'feedback':
                await jsclick(pg, '[data-action="continue"]')
            await adv(pg, 0.6, fps)
            continue
        if st == 'question':
            cur = await pg.evaluate(f'{D}.current()')
            i = cur['index']
            p = pattern[i] if i < len(pattern) else 'c'
            wrongs = 0 if p == 'c' else 1 if p == 'w' else int(p)
            cid = key[cur['questionId']]['correctChoiceId']
            done = tried.setdefault(i, [])
            if len(done) < wrongs:
                choice = [c for c in cur['choices'] if c != cid and c not in done][0]
                done.append(choice)
            else:
                choice = cid
            if on_question:
                await on_question(cur)
            await jsclick(pg, f'.qcr-choice[data-choice-id="{choice}"]')
            await adv(pg, 0.2, fps)
            log.append('c' if choice == cid else 'w')
            continue
        if st == 'results':
            return log
        await adv(pg, 0.4, fps)

async def sample_key(pg):
    return await pg.evaluate('window.HORSE_JUMPING_RACE_SAMPLE_QUESTIONS.answerKey')

# ---------------------------------------------------------------- النتائج حسب الإجابات
async def t_outcomes(b):
    for pattern in ['cccccc', 'wwwwww', 'cwcwcw']:
        c, pg = await open_game(b, f'file://{DIST}/index.html?capture&debug')
        key = await sample_key(pg)
        await jsclick(pg, '[data-action="start"]')
        t0 = time.time()
        await play_to_end(pg, pattern, key)
        res = await pg.evaluate(f'{D}.result()')
        model = await pg.evaluate(f'{D}.model()')
        order_by_time = [r['id'] for r in sorted(model['racers'], key=lambda r: r['finishTime'])]
        order_result = [f['id'] for f in sorted(res['finishOrder'], key=lambda f: (f['rank'], f['finishTime']))]
        ui = await pg.evaluate("({title: document.querySelector('#qcr-r-title').textContent, rank: document.querySelector('.qcr-r-rank').textContent, correct: document.querySelector('.qcr-r-correct').textContent, points: document.querySelector('.qcr-r-points').textContent, docTitle: document.title})")
        nc = pattern.count('c'); nw = pattern.count('w')
        ok = (res['correctCount'] == nc and res['points'] == nc * 10 + nw * 5 and res['refusals'] == nw and order_by_time == order_result
              and ui['title'] == 'سباق الخيل — قفز الحواجز' and ui['docTitle'] == 'سباق الخيل — قفز الحواجز'
              and (res['rank'] == 1 if pattern == 'cccccc' else True) and (res['rank'] > 1 if pattern == 'wwwwww' else True))
        record(f'outcome_{pattern}', ok, {'rank': res['rank'], 'tied': res['tied'], 'correct': res['correctCount'], 'refusals': res['refusals'], 'points': res['points'],
               'finishOrder': order_result, 'crossingOrder': order_by_time, 'ui': ui, 'errors': pg.logs[:5], 'secs': round(time.time() - t0)})
        await pg.screenshot(path=f'{OUT}/outcome_{pattern}.png')
        await c.close()

# ---------------------------------------------------------------- رفض الحاجز وإعادة السؤال
async def t_refusal(b):
    c, pg = await open_game(b, f'file://{DIST}/index.html?capture&debug')
    key = await sample_key(pg)
    await jsclick(pg, '[data-action="start"]')
    async def to_question():
        for _ in range(600):
            if await state(pg) == 'question': return
            await adv(pg, 0.3, 10)
    await to_question()
    cur = await pg.evaluate(f'{D}.current()')
    cid = key[cur['questionId']]['correctChoiceId']
    wrong = [x for x in cur['choices'] if x != cid]
    m0 = await pg.evaluate(f'{D}.model()')
    takeoff_x = m0['fences'][0] - m0['takeoff']
    await jsclick(pg, f'.qcr-choice[data-choice-id="{wrong[0]}"]')
    for _ in range(40):
        if await state(pg) == 'feedback': break
        await adv(pg, 0.1, 10)
    fb = await pg.evaluate("({revealed: document.querySelectorAll('.qcr-choice.correct').length, status: document.querySelector('.qcr-status')?.textContent || ''})")
    await pg.screenshot(path=f'{OUT}/refusal_feedback.png')
    await jsclick(pg, '[data-action="continue"]')
    await adv(pg, 0.05, 20)
    phase = (await pg.evaluate(f'{D}.model()'))['phase']
    max_d = 0; went_back = False; rivals_moved = False
    r0 = {r['id']: r['d'] for r in m0['racers']}
    for _ in range(200):
        if await state(pg) == 'question': break
        await adv(pg, 0.1, 30)
        m = await pg.evaluate(f'{D}.model()')
        pd = next(r['d'] for r in m['racers'] if r['id'] == 'player')
        if pd < max_d - 1.0: went_back = True
        max_d = max(max_d, pd)
        rivals_moved = rivals_moved or any(r['d'] > r0[r['id']] + 5 for r in m['racers'] if r['id'] != 'player')
    await pg.screenshot(path=f'{OUT}/refusal_retry_question.png')
    cur2 = await pg.evaluate(f'{D}.current()')
    ui2 = await pg.evaluate(f"({{count: document.querySelector('.qcr-q-count').textContent, triedDisabled: document.querySelector('.qcr-choice[data-choice-id=\"{wrong[0]}\"]').disabled, enabled: [...document.querySelectorAll('.qcr-choice:not(:disabled)')].length}})")
    # الضغط على الاختيار المعطّل لا يُسجَّل
    await jsclick(pg, f'.qcr-choice[data-choice-id="{wrong[0]}"]')
    await adv(pg, 0.2, 10)
    still_q = await state(pg) == 'question'
    record('refusal_blocks_fence_and_reasks', phase == 'refusal' and fb['revealed'] == 0 and 'رفض' in fb['status'] and max_d < takeoff_x and went_back and rivals_moved
           and cur2['index'] == 0 and cur2['questionId'] == cur['questionId'] and ui2['triedDisabled'] and ui2['enabled'] == len(cur['choices']) - 1 and still_q,
           {'phase_after_wrong': phase, 'answer_revealed': fb['revealed'], 'status': fb['status'][:60], 'player_max_x': round(max_d, 2), 'takeoff_x': round(takeoff_x, 2),
            'went_back': went_back, 'rivals_moved': rivals_moved, 'same_question': cur2['questionId'] == cur['questionId'], 'ui': ui2, 'disabled_click_ignored': still_q})
    # الآن الإجابة الصحيحة ⇒ يقفز ويتخطى الحاجز
    await jsclick(pg, f'.qcr-choice[data-choice-id="{cid}"]')
    for _ in range(40):
        if await state(pg) == 'feedback': break
        await adv(pg, 0.1, 10)
    await jsclick(pg, '[data-action="continue"]')
    await adv(pg, 0.62, 60)
    await pg.screenshot(path=f'{OUT}/jump_after_retry.png')
    await adv(pg, 1.2, 30)
    m = await pg.evaluate(f'{D}.model()')
    pd = next(r['d'] for r in m['racers'] if r['id'] == 'player')
    record('correct_after_refusal_clears_fence', pd > m0['fences'][0] + 2 and await pg.evaluate(f'{D}.points()') == 5 and m['wrongAttempts'] == 1,
           {'player_x': round(pd, 2), 'fence_x': m0['fences'][0], 'points_half_on_second_try': await pg.evaluate(f'{D}.points()'), 'errors': pg.logs[:5]})
    await c.close()

# ---------------------------------------------------------------- الإيقاف وتغيير التبويب (زمن حقيقي)
async def t_pause(b):
    c, pg = await open_game(b, f'file://{DIST}/index.html?debug&autostart&quality=low')
    # انتظار بدء الجري
    await pg.wait_for_function(f"{D}.state === 'running'", timeout=180000, polling=250)
    await pg.wait_for_function(f"{D}.model().time > 1.0", timeout=120000, polling=250)
    await jsclick(pg, '[data-action="pause"]')
    m1 = await pg.evaluate(f'{D}.model()')
    await asyncio.sleep(2.5)
    m2 = await pg.evaluate(f'{D}.model()')
    paused_ok = m1['time'] == m2['time'] and all(a['d'] == b2['d'] for a, b2 in zip(m1['racers'], m2['racers']))
    await jsclick(pg, '[data-action="resume"]')
    # ننتظر تقدّم الزمن فعليًا (الإطار الواحد قد يتجاوز ثانية على الرسم البرمجي) بدل مهلة ثابتة
    try:
        await pg.wait_for_function(f"{D}.model().time > {m2['time']} + 0.05", timeout=60000, polling=250)
    except Exception:
        pass
    m3 = await pg.evaluate(f'{D}.model()')
    resumed_ok = 0 < m3['time'] - m2['time'] < 2.0
    record('pause_button_freezes_and_resumes', paused_ok and resumed_ok, {'t_before': m1['time'], 't_after_2.5s_paused': m2['time'], 't_after_resume_1.5s': m3['time']})
    # إخفاء التبويب
    await pg.evaluate("Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); document.dispatchEvent(new Event('visibilitychange'))")
    st_hidden = await state(pg)
    paused_flag = await pg.evaluate(f'{D}._c.paused')
    h1 = await pg.evaluate(f'{D}.model()')
    await asyncio.sleep(3)
    await pg.evaluate("Object.defineProperty(document, 'hidden', {configurable: true, get: () => false}); document.dispatchEvent(new Event('visibilitychange'))")
    h2 = await pg.evaluate(f'{D}.model()')
    pause_visible = await pg.evaluate("!document.querySelector('#qcr-pause').hidden")
    await jsclick(pg, '[data-action="resume"]')
    await asyncio.sleep(0.5)
    h3 = await pg.evaluate(f'{D}.model()')
    jump = h3['time'] - h2['time']
    record('tab_hidden_autopauses_no_time_jump', paused_flag and h1['time'] == h2['time'] and pause_visible and jump < 0.8,
           {'paused_flag': paused_flag, 'time_hidden_start': h1['time'], 'time_after_3s_hidden': h2['time'], 'jump_after_resume_0.5s': round(jump, 3), 'pause_overlay_shown': pause_visible})
    # الإيقاف أثناء السؤال
    await pg.wait_for_function(f"{D}.state === 'question'", timeout=600000, polling=250)
    q1 = await pg.evaluate(f'{D}.model()')
    await jsclick(pg, '[data-action="pause"]')
    await asyncio.sleep(1)
    await jsclick(pg, '[data-action="resume"]')
    await asyncio.sleep(1)
    q2 = await pg.evaluate(f'{D}.model()')
    record('question_freeze_all_racers', all(a['d'] == b2['d'] for a, b2 in zip(q1['racers'], q2['racers'])) and await state(pg) == 'question',
           {'distances': [round(r['d'], 3) for r in q2['racers']]})
    record('no_console_errors_realtime', not pg.logs, pg.logs[:5])
    await c.close()

# ---------------------------------------------------------------- إعادة اللعب دون تراكم
async def t_replay(b):
    c, pg = await open_game(b, f'file://{DIST}/index.html?capture&debug&questions=2&segment=4')
    key = await sample_key(pg)
    await jsclick(pg, '[data-action="start"]')
    snaps = []
    for i in range(3):
        await play_to_end(pg, 'cw', key)
        await adv(pg, 1.0)
        r = await pg.evaluate(f'{D}.resources()')
        snaps.append(r)
        await jsclick(pg, '[data-action="replay"]')
        await adv(pg, 0.5)
    # إعادة من شاشة الإيقاف أيضًا
    await adv(pg, 3)
    await jsclick(pg, '[data-action="pause"]')
    await jsclick(pg, '[data-action="restart"]')
    await adv(pg, 1)
    r_end = await pg.evaluate(f'{D}.resources()')
    geo = [s['scene']['geometries'] for s in snaps]
    tex = [s['scene']['textures'] for s in snaps]
    nodes = [s['audio']['persistentNodes'] for s in snaps]
    ok = (len(set(geo)) == 1 and len(set(tex)) == 1 and all(s['timers'] <= 1 for s in snaps) and all(s['rafLoops'] <= 1 for s in snaps)
          and len(set(nodes)) == 1 and all(s['horses'] == 6 for s in snaps) and r_end['horses'] == 6)
    record('replay_no_accumulation', ok, {'geometries': geo, 'textures': tex, 'timers': [s['timers'] for s in snaps], 'audioNodes': nodes, 'rafLoops': [s['rafLoops'] for s in snaps], 'after_pause_restart': r_end})
    await c.close()

# ---------------------------------------------------------------- اللمس + الضغط المزدوج
async def t_touch(b):
    c, pg = await open_game(b, f'file://{DIST}/index.html?capture&debug&questions=2', viewport=(1024, 768), has_touch=True, is_mobile=False)
    key = await sample_key(pg)
    await pg.tap('[data-action="start"]')
    await adv(pg, 0.5)
    while await state(pg) != 'question':
        await adv(pg, 0.6)
    cur = await pg.evaluate(f'{D}.current()')
    cid = key[cur['questionId']]['correctChoiceId']
    other = [x for x in cur['choices'] if x != cid][0]
    sel = f'.qcr-choice[data-choice-id="{cid}"]'
    await pg.tap(sel)
    try:
        await pg.tap(sel, timeout=1500)
    except Exception:
        pass
    try:
        await pg.tap(f'.qcr-choice[data-choice-id="{other}"]', timeout=1500)
    except Exception:
        pass
    await adv(pg, 0.2)
    ans = await pg.evaluate(f'{D}.answers()')
    graded = await pg.evaluate(f'{D}._c.bridge.graded.size')
    await pg.screenshot(path=f'{OUT}/touch_tablet_feedback.png')
    record('touch_tap_and_double_tap_single_submission', ans[0]['choiceId'] == cid and ans[0]['correct'] and graded == 1, {'answer': ans[0]['choiceId'], 'graded_count_in_bridge': graded})
    await c.close()

# ---------------------------------------------------------------- تخطيطات الشاشات والنصوص الطويلة
async def t_layouts(b):
    for name, vp, extra in [('smartboard_1920x1080_classroom', (1920, 1080), '&mode=classroom'), ('laptop_1366x768', (1366, 768), ''), ('tablet_portrait_768x1024', (768, 1024), '')]:
        c, pg = await open_game(b, f'file://{DIST}/index.html?capture&debug{extra}', viewport=vp)
        await adv(pg, 0.4)
        await pg.screenshot(path=f'{OUT}/layout_{name}_start.png', timeout=120000)
        if 'classroom' in extra:
            await pg.fill('#qcr-team-name', 'فريق الصقور')
            await pg.fill('#qcr-students', 'سارة\nأحمد\nمريم')
        await jsclick(pg, '[data-action="start"]')
        # الوصول إلى السؤال الخامس (طويل)
        key = await sample_key(pg)
        overflow = None
        while True:
            st = await state(pg)
            if st == 'question':
                cur = await pg.evaluate(f'{D}.current()')
                if cur['index'] == 4:
                    await adv(pg, 0.5)
                    overflow = await pg.evaluate("""() => { const card = document.querySelector('#qcr-question .qcr-card'); const r = card.getBoundingClientRect();
                      const els = [...document.querySelectorAll('.qcr-q-text, .qcr-choice .txt')];
                      const over = (e) => Math.max(e.scrollWidth - e.clientWidth, e.scrollHeight - e.clientHeight);
                      const outside = (e) => { const q = e.getBoundingClientRect(); return q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1; };
                      const hidden = (e) => getComputedStyle(e).overflow !== 'visible';
                      const clipped = els.filter(e => (hidden(e) && over(e) > 1) || outside(e)).length;
                      const maxOverflowPx = Math.max(0, ...els.map(over));
                      return { maxGlyphOverflowPx_visible: maxOverflowPx, cardInViewport: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, clippedTexts: clipped,
                               qFont: getComputedStyle(document.querySelector('.qcr-q-text')).fontSize, choiceMinH: getComputedStyle(document.querySelector('.qcr-choice')).minHeight,
                               turn: document.querySelector('.qcr-q-turn').hidden ? null : document.querySelector('.qcr-q-turn').textContent }; }""")
                    await pg.screenshot(path=f'{OUT}/layout_{name}_long_question.png', timeout=120000)
                    break
                cid = key[cur['questionId']]['correctChoiceId']
                await jsclick(pg, f'.qcr-choice[data-choice-id="{cid}"]')
                await adv(pg, 0.2)
                if 'classroom' in extra:
                    await adv(pg, 0.3)
                    await jsclick(pg, '[data-action="continue"]')
                continue
            if st == 'feedback':
                await jsclick(pg, '[data-action="continue"]')
            await adv(pg, 0.6)
        if 'classroom' in extra:
            marker = await pg.evaluate("document.querySelector('.qcr-marker-label').textContent")
            overflow['marker'] = marker
        record(f'layout_{name}', overflow and overflow['clippedTexts'] == 0 and overflow['cardInViewport'], overflow)
        await c.close()

# ---------------------------------------------------------------- المحاكي المحلي: تأخير، فشل، انتظار
async def t_localsim(b):
    c, pg = await open_game(b, f'file://{DIST}/index.html?capture&debug&questions=2&sim=latency:600,fail:1')
    key = await sample_key(pg)
    await jsclick(pg, '[data-action="start"]')
    while await state(pg) != 'question':
        await adv(pg, 0.6)
    cur = await pg.evaluate(f'{D}.current()')
    cid = key[cur['questionId']]['correctChoiceId']
    before = await pg.evaluate(f'{D}.model()')
    await jsclick(pg, f'.qcr-choice[data-choice-id="{cid}"]')
    st_wait = await state(pg)
    await asyncio.sleep(1.0)
    await adv(pg, 0.2)
    err_visible = await pg.evaluate("!document.querySelector('[data-action=\"retry-submit\"]').hidden")
    st_err = await state(pg)
    after = await pg.evaluate(f'{D}.model()')
    ans_before_retry = await pg.evaluate(f'{D}.answers()')
    await pg.screenshot(path=f'{OUT}/localsim_connection_error.png')
    await jsclick(pg, '[data-action="retry-submit"]')
    await asyncio.sleep(1.0)
    await adv(pg, 0.2)
    st_after = await state(pg)
    ans = await pg.evaluate(f'{D}.answers()')
    frozen = all(a['d'] == x['d'] for a, x in zip(before['racers'], after['racers']))
    record('local_failure_retry_not_counted_wrong', st_wait == 'awaitingGrade' and err_visible and st_err == 'awaitingGrade' and len([a for a in ans_before_retry if a]) == 0 and st_after == 'feedback' and ans[0]['correct'] and frozen,
           {'state_while_waiting': st_wait, 'retry_button': err_visible, 'state_on_error': st_err, 'answers_before_retry': len([a for a in ans_before_retry if a]), 'state_after_retry': st_after, 'graded_correct': ans[0]['correct'], 'frozen_during_wait': frozen})
    await c.close()
    # بانتظار التصحيح
    c, pg = await open_game(b, f'file://{DIST}/index.html?capture&debug&questions=1&sim=pending:1,latency:1500')
    key = await sample_key(pg)
    await jsclick(pg, '[data-action="start"]')
    while await state(pg) != 'question':
        await adv(pg, 0.6)
    cur = await pg.evaluate(f'{D}.current()')
    await jsclick(pg, f'.qcr-choice[data-choice-id="{key[cur["questionId"]]["correctChoiceId"]}"]')
    await asyncio.sleep(1.8)
    snap = await pg.evaluate(f"({{st: {D}.state, txt: document.querySelector('.qcr-q-status').textContent, n: {D}.answers().filter(Boolean).length}})")
    st1, txt, n_ans = snap['st'], snap['txt'], snap['n']
    await pg.screenshot(path=f'{OUT}/localsim_pending.png')
    ans1 = [1] * n_ans
    await asyncio.sleep(3.6)
    await adv(pg, 0.1)
    st2 = await state(pg)
    record('pending_grade_is_neither_correct_nor_wrong', st1 == 'awaitingGrade' and 'بانتظار' in txt and len([a for a in ans1 if a]) == 0 and st2 == 'feedback',
           {'state_pending': st1, 'status_text': txt, 'answers_while_pending': len([a for a in ans1 if a]), 'state_after_grade': st2})
    await c.close()

# ---------------------------------------------------------------- محاكي المنصة (خادم + مجلد فرعي + postMessage)
async def t_platform(b):
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '--directory', SIM], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.0)
    try:
        c = await b.new_context(viewport={'width': 1500, 'height': 760})
        pg = await c.new_page()
        logs = []
        pg.on('pageerror', lambda e: logs.append(str(e)))
        await pg.goto('http://127.0.0.1:8765/index.html?debug&quality=low')
        fr = None
        for _ in range(200):
            fr = next((f for f in pg.frames if 'games/horse-jumping-race' in f.url), None)
            if fr:
                try:
                    if await fr.evaluate("window.HorseJumpingRace?.debug?.state === 'ready'"):
                        break
                except Exception:
                    pass
            await asyncio.sleep(0.5)
        bridge_mode = await fr.evaluate(f'{D}._c.bridge.mode')
        qids = await fr.evaluate(f"{D}._c.questions.map(q => q.id)")
        has_key = await fr.evaluate("JSON.stringify(window.HorseJumpingRace.debug._c.questions).includes('correctChoiceId')")
        record('platform_handshake_subfolder', bridge_mode == 'platform' and qids[0] == 'p-1' and not has_key, {'bridge': bridge_mode, 'questions': qids, 'answerKeyInGame': has_key, 'url': fr.url})
        await jsclick(fr, '[data-action="start"]')
        async def wait_state(s, timeout=600):
            t0 = time.time()
            while time.time() - t0 < timeout:
                if await fr.evaluate(f'{D}.state') == s:
                    return True
                await asyncio.sleep(0.3)
            return False
        KEY = {'p-1': 'x1', 'p-2': 'true', 'p-3': 'm1', 'p-4': 'b', 'p-5': 'g2', 'p-6': 'true'}
        async def answer(correct=True):
            cur = await fr.evaluate(f'{D}.current()')
            k = KEY[cur['questionId']]
            ch = k if correct else [x for x in cur['choices'] if x != k][0]
            await jsclick(fr, f'.qcr-choice[data-choice-id="{ch}"]')
            return cur
        # س١: خطأ اتصال من المنصة ثم إعادة المحاولة
        await wait_state('question')
        await jscheck(pg, '#fail')
        await answer(True)
        try:
            await fr.wait_for_function("!document.querySelector('[data-action=\"retry-submit\"]').hidden", timeout=30000, polling=250)
        except Exception:
            pass
        retry_vis = await fr.evaluate("!document.querySelector('[data-action=\"retry-submit\"]').hidden")
        st = await fr.evaluate(f'{D}.state')
        await jsclick(fr, '[data-action="retry-submit"]')
        ok = await wait_state('feedback', 10)
        a = await fr.evaluate(f'{D}.answers()')
        record('platform_error_then_retry', retry_vis and st == 'awaitingGrade' and ok and a[0]['correct'], {'retry_shown': retry_vis, 'state_on_error': st, 'graded_after_retry': a[0]['correct']})
        await jsclick(fr, '[data-action="continue"]')
        # س٢: ضياع الرد بعد التسجيل → انتهاء المهلة → إعادة المحاولة بنفس attemptId → المنصة ترفض التكرار
        await wait_state('question')
        await jscheck(pg, '#dropReply')
        await answer(False)
        t0 = time.time()
        await fr.wait_for_selector('[data-action="retry-submit"]:not([hidden])', timeout=60000, state='attached')
        waited = time.time() - t0
        await jsclick(fr, '[data-action="retry-submit"]')
        ok = await wait_state('feedback', 10)
        dup = await pg.evaluate('window.__sim.dupAnswers')
        graded_n = await pg.evaluate('window.__sim.graded.size')
        m2 = await fr.evaluate(f'{D}.model()')
        revealed = await fr.evaluate("document.querySelectorAll('.qcr-choice.correct').length")
        record('platform_lost_reply_timeout_retry_dedup', ok and dup == 1 and graded_n == 2 and m2['wrongAttempts'] == 1 and revealed == 0,
               {'timeout_after_s': round(waited, 1), 'platform_duplicates_rejected': dup, 'platform_graded_unique': graded_n, 'wrongAttempts': m2['wrongAttempts'], 'answer_revealed': revealed})
        await jscheck(pg, '#dropReply', False)
        await jsclick(fr, '[data-action="continue"]')
        # الرفض في وضع المنصة: يُعاد السؤال نفسه بمحاولة جديدة (attemptId جديد) ثم الإجابة الصحيحة
        await asyncio.sleep(0.5)
        await wait_state('question', 120)
        cur2 = await fr.evaluate(f'{D}.current()')
        await answer(True)
        ok2 = await wait_state('feedback', 15)
        graded_n2 = await pg.evaluate('window.__sim.graded.size')
        a = await fr.evaluate(f'{D}.answers()')
        record('platform_refusal_reasks_with_new_attempt', ok2 and cur2['questionId'] == 'p-2' and graded_n2 == 3 and a[1]['correct'] is False and a[1]['attempts'] == 2,
               {'question': cur2['questionId'], 'platform_graded_unique': graded_n2, 'first_try_correct': a[1]['correct'], 'attempts': a[1]['attempts']})
        await jsclick(fr, '[data-action="continue"]')
        # س٣: بانتظار التصحيح ثم تصحيح المعلم
        await wait_state('question')
        await jscheck(pg, '#pending')
        await answer(True)
        await asyncio.sleep(1.2)
        st_p = await fr.evaluate(f'{D}.state')
        m_a = await fr.evaluate(f'{D}.model()')
        await asyncio.sleep(1.5)
        m_b = await fr.evaluate(f'{D}.model()')
        await jscheck(pg, '#pending', False)
        await jsclick(pg, '#gradeNow')
        ok = await wait_state('feedback', 10)
        a = await fr.evaluate(f'{D}.answers()')
        record('platform_pending_then_teacher_grades', st_p == 'awaitingGrade' and ok and a[2]['correct'] and m_a['time'] == m_b['time'],
               {'state_while_pending': st_p, 'frozen_while_pending': m_a['time'] == m_b['time'], 'graded': a[2]['correct']})
        await jsclick(fr, '[data-action="continue"]')
        # أوامر المنصة: إيقاف/استئناف
        await asyncio.sleep(1.0)
        await jsclick(pg, '[data-cmd="pause"]')
        await asyncio.sleep(0.4)
        paused = await fr.evaluate(f'{D}._c.paused')
        await jsclick(pg, '[data-cmd="resume"]')
        await asyncio.sleep(0.4)
        resumed = not await fr.evaluate(f'{D}._c.paused')
        record('platform_control_pause_resume', paused and resumed, {'paused': paused, 'resumed': resumed})
        # بقية الأسئلة صحيحة
        for _ in range(3):
            await wait_state('question')
            await answer(True)
            await wait_state('feedback', 15)
            await jsclick(fr, '[data-action="continue"]')
        # النتيجة: فقدان التأكيد مرة → إعادة حفظ → المنصة ترفض التكرار
        await jscheck(pg, '#dropAck')
        await wait_state('results', 180)
        await fr.wait_for_selector('[data-action="retry-result"]:not([hidden])', timeout=60000, state='attached')
        await jsclick(fr, '[data-action="retry-result"]')
        await asyncio.sleep(1.5)
        save_txt = await fr.evaluate("document.querySelector('.qcr-r-save').textContent")
        n_res = await pg.evaluate('window.__sim.results.size')
        dup_res = await pg.evaluate('window.__sim.dupResults')
        last = await pg.evaluate("document.querySelector('#lastResult').textContent")
        res = await fr.evaluate(f'{D}.result()')
        await pg.screenshot(path=f'{OUT}/platform_sim_results.png')
        record('platform_result_saved_once_with_retry', n_res == 1 and dup_res == 1 and 'تم حفظ' in save_txt and res['gameId'] == 'horse-jumping-race',
               {'results_saved': n_res, 'duplicates_rejected': dup_res, 'game_message': save_txt, 'host_last_result': last, 'correctCount': res['correctCount'], 'points': res['points'], 'rank': res['rank']})
        record('platform_no_page_errors', not logs, logs[:5])
        await c.close()
        # عدم وجود منصة: انتهاء مهلة المصافحة برسالة واضحة (دون رجوع للمحاكي المحلي)
        c = await b.new_context(viewport={'width': 1000, 'height': 600})
        pg = await c.new_page()
        await pg.goto('http://127.0.0.1:8765/games/horse-jumping-race/index.html?bridge=postMessage&debug')
        await pg.wait_for_selector('.qcr-error:not([hidden])', timeout=30000)
        msg = await pg.evaluate("document.querySelector('.qcr-loading .qcr-error-msg').textContent")
        await pg.screenshot(path=f'{OUT}/platform_handshake_timeout.png')
        record('platform_missing_shows_clear_error_no_fallback', 'المنصة' in msg, {'message': msg})
        await c.close()
    finally:
        srv.terminate()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=ARGS)
        for name in WHICH:
            fn = globals().get('t_' + name)
            try:
                await fn(b)
            except Exception as e:
                record(name + '_EXCEPTION', False, repr(e)[:400])
        await b.close()
    with open(f'{OUT}/results_{"_".join(WHICH)}.json', 'w', encoding='utf-8') as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=1)
    print('SUMMARY', sum(r['ok'] for r in RESULTS), '/', len(RESULTS))

asyncio.run(main())
